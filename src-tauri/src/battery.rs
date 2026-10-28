//! Central Hub read-only battery providers. See docs/PROTOCOLOS-NATIVOS.md.
//! No voltage curves, inferred charge flags, synthetic levels or retained stale replies.
use serde::Serialize;
#[derive(Clone, Debug, Serialize)]
pub struct BatteryReading {
    pub physical_id: String,
    pub source: String,
    pub percent: Option<u8>,
    pub voltage_mv: Option<u16>,
    pub charging: Option<bool>,
    pub observed_at_ms: u64,
    pub error: Option<String>,
    pub device_name: Option<String>,
}
fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
pub(crate) fn record(id: String, source: &str, name: Option<String>) -> BatteryReading {
    BatteryReading {
        physical_id: id,
        source: source.into(),
        percent: None,
        voltage_mv: None,
        charging: None,
        observed_at_ms: now(),
        error: None,
        device_name: name,
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Family {
    Flight,
    Cloud2,
    Cloud2Kingston,
    Alpha,
    Logitech,
    Corsair,
    Arctis,
}
fn family(v: u16, p: u16, page: u16, usage: u16, interface: i32) -> Option<Family> {
    match (v, p) {
        (0x0951, 0x16c4 | 0x1723) if [0xff90, 0xff53].contains(&page) && usage == 0x303 => {
            Some(Family::Flight)
        }
        (0x03f0, 0x0696 | 0x018b) if page == 0xff90 && usage == 0x303 => Some(Family::Cloud2),
        (0x0951, 0x1718) if page == 0xff90 && usage == 0x303 => Some(Family::Cloud2Kingston),
        (0x03f0, 0x098d) if page == 0xff90 && usage == 0x303 => Some(Family::Alpha),
        (0x046d, 0x0a5b | 0x0a87 | 0x0ab5 | 0x0afe | 0x0b1f)
            if page == 0xff43 && usage == 0x202 =>
        {
            Some(Family::Logitech)
        }
        (
            0x1b1c,
            0x1b1c | 0x1b27 | 0x0a14 | 0x0a16 | 0x0a17 | 0x0a1d | 0x0a1a | 0x1b2a | 0x1b23 | 0x1b29
            | 0x0a55 | 0x0a51 | 0x0a52 | 0x0a38 | 0x0a4f | 0x0a2b | 0x0a75 | 0x0a56,
        ) if page == 0xffc5 && usage == 1 && interface == 3 => Some(Family::Corsair),
        (0x1038, 0x1260 | 0x12ad) if interface == 5 && !(page == 1 || page == 7) => {
            Some(Family::Arctis)
        }
        _ => None,
    }
}
fn parse(f: Family, r: &[u8], cmd: u8) -> Result<(Option<u8>, Option<u16>, Option<bool>), String> {
    let percent = |v: u8| -> Result<Option<u8>, String> {
        if v <= 100 {
            Ok(Some(v))
        } else {
            Err("Nível de bateria fora da faixa; resposta descartada.".into())
        }
    };
    match f {
        Family::Flight if [15, 20].contains(&r.len()) && r.starts_with(&[0x21, 0xff, 0x05]) => {
            let mv = u16::from_be_bytes([r[3], r[4]]);
            if mv > 0x100b && mv <= 5000 {
                Ok((None, Some(mv), Some(true)))
            } else if (3000..=0x100b).contains(&mv) {
                Ok((None, Some(mv), None))
            } else {
                Err("Tensão de bateria indisponível ou fora da faixa.".into())
            }
        }
        Family::Logitech
            if r.len() >= 7 && [0x10, 0x11].contains(&r[0]) && r[1..4] == [0xff, 8, 0x0a] =>
        {
            let mv = u16::from_be_bytes([r[4], r[5]]);
            if !(3000..=5000).contains(&mv) {
                return Err("Tensão indisponível; headset pode estar desligado.".into());
            }
            Ok((
                None,
                Some(mv),
                match r[6] {
                    1 => Some(false),
                    3 => Some(true),
                    _ => None,
                },
            ))
        }
        Family::Cloud2 if r.len() == 20 && r.starts_with(&[6, 0xff, 0xbb, cmd]) => {
            if cmd == 2 {
                Ok((percent(r[7])?, Some(u16::from_be_bytes([r[5], r[6]])), None))
            } else {
                Ok((
                    None,
                    None,
                    match r[4] {
                        0 => Some(false),
                        1 => Some(true),
                        _ => None,
                    },
                ))
            }
        }
        Family::Cloud2Kingston if r.len() >= 8 && r[0] == 0x0b && r[2] == 0xbb && r[3] == cmd => {
            if cmd == 2 {
                Ok((percent(r[7])?, None, None))
            } else {
                Ok((
                    None,
                    None,
                    match r[4] {
                        0 => Some(false),
                        1 => Some(true),
                        _ => None,
                    },
                ))
            }
        }
        Family::Alpha if r.len() >= 4 && r.starts_with(&[0x21, 0xbb, cmd]) => match cmd {
            3 if r[3] == 1 => Err("Headset desligado ou sem link com o receptor.".into()),
            3 => Ok((None, None, None)),
            0x0c => Ok((
                None,
                None,
                match r[3] {
                    0 => Some(false),
                    1 => Some(true),
                    _ => None,
                },
            )),
            0x0b => Ok((percent(r[3])?, None, None)),
            _ => Err("Resposta sem comando de bateria.".into()),
        },
        Family::Corsair if r.len() == 5 && r[0] == 100 && r[1] == 0 && r[3] == 177 => {
            if ![1, 2, 4, 5].contains(&r[4]) {
                return Err("Headset desligado ou estado não reconhecido.".into());
            }
            Ok((percent(r[2] & 0x7f)?, None, Some([4, 5].contains(&r[4]))))
        }
        Family::Arctis if r.len() == 8 && r.starts_with(&[6, 0x18]) => {
            Ok((percent(r[2])?, None, None))
        }
        _ => Err("Resposta de bateria não corresponde ao comando enviado.".into()),
    }
}

#[cfg(all(windows, feature = "hardware-hid"))]
fn hid_readings() -> Result<Vec<BatteryReading>, String> {
    use crate::protocol_hid::{collections, report_len};
    use std::{
        collections::HashSet,
        time::{Duration, Instant},
    };
    let _guard = crate::hid::DEVICE_IO
        .lock()
        .map_err(|_| "HID indisponível.")?;
    let api = hidapi::HidApi::new().map_err(|e| e.to_string())?;
    let mut out = vec![];
    let mut seen = HashSet::new();
    for info in api.device_list() {
        if info.usage_page() == 7 || info.usage_page() == 1 && [2, 6].contains(&info.usage()) {
            continue;
        }
        let f = family(
            info.vendor_id(),
            info.product_id(),
            info.usage_page(),
            info.usage(),
            info.interface_number(),
        );
        // Descriptor reads are read-only. Only declare-and-read Battery Strength features.
        let Ok(device) = info.open_device(&api) else {
            continue;
        };
        let mut raw = [0u8; 16384];
        let Ok(n) = device.get_report_descriptor(&mut raw) else {
            continue;
        };
        let Ok(cs) = collections(&raw[..n]) else {
            continue;
        };
        let fields = crate::hid_battery::fields(&raw[..n]);
        if f.is_none() && fields.is_empty() {
            continue;
        }
        let meta = crate::metadata::for_interface(&info.path().to_string_lossy());
        let Some(id) = meta.physical_id else { continue };
        if seen.contains(&id) {
            continue;
        }
        let name = f.map(|family| match family {
            Family::Flight => "HyperX Cloud Flight".into(),
            Family::Cloud2 | Family::Cloud2Kingston => "HyperX Cloud II Wireless".into(),
            Family::Alpha => "HyperX Cloud Alpha Wireless".into(),
            Family::Logitech => match info.product_id() {
                0x0a5b => "Logitech G933",
                0x0a87 => "Logitech G935",
                _ => "Logitech G733",
            }
            .into(),
            Family::Arctis => "SteelSeries Arctis 7".into(),
            Family::Corsair => info
                .product_string()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or("Headset Corsair")
                .into(),
        });
        let mut reading = record(id.clone(), "HID Battery Strength", name);
        let result = (|| -> Result<(), String> {
            if let Some(f) = f {
                reading.source = match f {
                    Family::Flight => "Central Hub · HyperX Flight (tensão)",
                    Family::Cloud2 | Family::Cloud2Kingston => "Central Hub · HyperX Cloud II",
                    Family::Alpha => "Central Hub · HyperX Alpha",
                    Family::Logitech => "Central Hub · Logitech HID++ (tensão)",
                    Family::Corsair => "Central Hub · Corsair Void/HS",
                    Family::Arctis => "Central Hub · SteelSeries Arctis",
                }
                .into();
                // Refuse packets absent from the actual report descriptor.
                let exchange=|request:Vec<u8>,cmd:u8|->Result<(Option<u8>,Option<u16>,Option<bool>),String>{
                    let size=report_len(&cs,"send",request[0]).ok_or("Relatório de consulta não anunciado.")?+1;
                    if request.len()!=size{return Err("Tamanho de relatório diferente do protocolo conhecido.".into());}
                    for _ in 0..16{let mut stale=[0u8;128];if device.read_timeout(&mut stale,0).map_err(|e|e.to_string())?==0{break;}}
                    if device.write(&request).map_err(|e|e.to_string())?!=request.len(){return Err("Consulta HID incompleta.".into());}
                    let deadline=Instant::now()+Duration::from_millis(900);
                    while Instant::now()<deadline {
                        let mut response=[0u8;128];let n=device.read_timeout(&mut response,40).map_err(|e|e.to_string())?;
                        if n==0{continue;}
                        if let Ok(v)=parse(f,&response[..n],cmd){return Ok(v);}
                    }
                    Err("Sem resposta de bateria válida. Ligue o dispositivo e atualize.".into())
                };
                let packet = |len: usize, header: &[u8]| {
                    let mut p = vec![0u8; len];
                    p[..header.len()].copy_from_slice(header);
                    p
                };
                let (p, v, c) = match f {
                    Family::Flight => exchange(packet(20, &[0x21, 0xff, 5]), 5)?,
                    Family::Logitech => exchange(packet(20, &[0x11, 0xff, 8, 0x0a]), 0x0a)?,
                    Family::Cloud2 | Family::Cloud2Kingston => {
                        let command = |cmd| {
                            if f == Family::Cloud2 {
                                packet(52, &[6, 0xff, 0xbb, cmd, 0])
                            } else {
                                packet(
                                    62,
                                    &[
                                        6, 0, 2, 0, 0x9a, 0, 0, 0x68, 0x4a, 0x8e, 0x0a, 0, 0, 0,
                                        0xbb, cmd, 0,
                                    ],
                                )
                            }
                        };
                        let (p, v, _) = exchange(command(2), 2)?;
                        let c = exchange(command(3), 3).ok().and_then(|x| x.2);
                        (p, v, c)
                    }
                    Family::Alpha => {
                        exchange(packet(31, &[0x21, 0xbb, 3]), 3)?;
                        let c = exchange(packet(31, &[0x21, 0xbb, 0x0c]), 0x0c)?.2;
                        if c == Some(true) {
                            (None, None, c)
                        } else {
                            let (p, v, _) = exchange(packet(31, &[0x21, 0xbb, 0x0b]), 0x0b)?;
                            (p, v, c)
                        }
                    }
                    Family::Corsair => exchange(packet(2, &[0xc9, 0x64]), 0x64)?,
                    Family::Arctis => exchange(packet(2, &[6, 0x18]), 0x18)?,
                };
                reading.percent = p;
                reading.voltage_mv = v;
                reading.charging = c;
            } else {
                let field = fields.first().ok_or("Sem campo de bateria.")?;
                let mut response = vec![0u8; field.report_len + 1];
                response[0] = field.id;
                let n = device
                    .get_feature_report(&mut response)
                    .map_err(|e| e.to_string())?;
                reading.percent = field.percent(&response[..n]);
                if reading.percent.is_none() {
                    return Err("O relatório não informou um nível de bateria válido.".into());
                }
            }
            Ok(())
        })();
        reading.error = result.err();
        reading.observed_at_ms = now();
        if reading.error.is_none() {
            seen.insert(id);
        }
        out.push(reading);
    }
    Ok(out)
}

pub fn enumerate() -> Vec<BatteryReading> {
    #[cfg(all(windows, feature = "hardware-hid"))]
    let mut out = hid_readings().unwrap_or_default();
    #[cfg(not(all(windows, feature = "hardware-hid")))]
    let mut out = vec![];
    #[cfg(windows)]
    out.extend(crate::windows_battery::enumerate());
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn refuses_unrelated_ids_and_collections() {
        assert_eq!(family(0x0951, 0x1723, 1, 6, 3), None);
        assert_eq!(
            family(0x0951, 0x1723, 0xff90, 0x303, 3),
            Some(Family::Flight)
        );
        assert_eq!(family(0x1b1c, 0x0a55, 0xffc5, 1, 0), None);
    }
    #[test]
    fn flight_reports_voltage_without_inventing_percent() {
        let mut r = [0u8; 20];
        r[..5].copy_from_slice(&[0x21, 0xff, 5, 0x0f, 0x50]);
        assert_eq!(
            parse(Family::Flight, &r, 5).unwrap(),
            (None, Some(3920), None)
        );
        r[4] = 0;
        r[3] = 0;
        assert!(parse(Family::Flight, &r, 5).is_err());
    }
    #[test]
    fn battery_parsers_reject_wrong_echo_and_invalid_levels() {
        let mut r = [0u8; 20];
        r[..4].copy_from_slice(&[6, 0xff, 0xbb, 2]);
        r[7] = 0;
        assert_eq!(parse(Family::Cloud2, &r, 2).unwrap().0, Some(0));
        r[7] = 101;
        assert!(parse(Family::Cloud2, &r, 2).is_err());
        r[7] = 50;
        assert!(parse(Family::Cloud2, &r, 3).is_err());
        assert_eq!(
            parse(Family::Corsair, &[100, 0, 0x80 | 55, 177, 4], 0x64).unwrap(),
            (Some(55), None, Some(true))
        );
        assert!(parse(Family::Corsair, &[100, 0, 55, 177, 0], 0x64).is_err());
    }
}
