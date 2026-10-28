//! Read-only model identification. Queries never change settings, modes or flash.
use serde::Serialize;
#[derive(Clone, Debug, Serialize)]
pub struct ModelIdentity {
    pub model: String,
    pub name: String,
    pub method: String,
    pub model_code: String,
}
#[cfg(all(windows, feature = "hardware-hid"))]
mod native {
    use super::ModelIdentity;
    use hidapi::HidDevice;
    use std::{
        sync::atomic::{AtomicU8, Ordering},
        time::{Duration, Instant},
    };
    static REQUEST_ID: AtomicU8 = AtomicU8::new(3);

    pub(crate) fn exchange(
        dev: &HidDevice,
        slot: u8,
        feature: u8,
        function: u8,
        params: &[u8],
    ) -> Result<Vec<u8>, String> {
        // Rotate IDs so a late reply cannot satisfy the next root lookup.
        // Reserve 0/1/2 and B to avoid the vendor app and older Hub builds.
        let software = REQUEST_ID
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |id| {
                Some(if id == 15 {
                    3
                } else if id == 10 {
                    12
                } else {
                    id + 1
                })
            })
            .unwrap();
        let command = function | software;
        let mut report = [0u8; 20];
        report[..4].copy_from_slice(&[0x11, slot, feature, command]);
        report[4..4 + params.len()].copy_from_slice(params);
        dev.write(&report).map_err(|e| e.to_string())?;
        let deadline = Instant::now() + Duration::from_millis(1000);
        while Instant::now() < deadline {
            let mut buffer = [0u8; 64];
            let n = dev
                .read_timeout(&mut buffer, 40)
                .map_err(|e| e.to_string())?;
            if let Some(result) = decode_reply(&buffer[..n], slot, feature, command) {
                return result;
            }
        }
        Err("O mouse não respondeu. Mova-o e atualize; verifique se outro software está usando a interface.".into())
    }
    pub(super) fn decode_reply(
        bytes: &[u8],
        slot: u8,
        feature: u8,
        command: u8,
    ) -> Option<Result<Vec<u8>, String>> {
        if bytes.len() < 4 || ![0x10, 0x11].contains(&bytes[0]) || bytes[1] != slot {
            return None;
        }
        if bytes[2] == feature && bytes[3] == command {
            return Some(Ok(bytes.to_vec()));
        }
        if bytes.len() >= 6
            && [0x8f, 0xff].contains(&bytes[2])
            && bytes[3] == feature
            && bytes[4] == command
        {
            return Some(Err(format!(
                "HID++ recusou a consulta (0x{:02X}).",
                bytes[5]
            )));
        }
        None
    }
    pub(crate) fn feature(dev: &HidDevice, slot: u8, feature_id: u16) -> Result<u8, String> {
        let reply = exchange(dev, slot, 0, 0, &feature_id.to_be_bytes())?;
        reply
            .get(4)
            .copied()
            .filter(|v| *v != 0)
            .ok_or_else(|| "Identificação HID++ indisponível.".into())
    }
    pub fn logitech(dev: &HidDevice, direct: bool) -> Result<ModelIdentity, String> {
        let slots: &[u8] = if direct { &[0xff, 1] } else { &[1, 2] };
        let mut last_error = String::new();
        for &slot in slots {
            let result = (|| {
                let info_feature = feature(dev, slot, 0x0003)?;
                let reply = exchange(dev, slot, info_feature, 0, &[])?;
                let model = reply
                    .get(11..17)
                    .ok_or("Resposta de identificação HID++ incompleta.")?;
                // Original Superlight advertises wireless 4093 and wired C094.
                // Receiver PID C547 alone is never considered model evidence.
                if model != [0x40, 0x93, 0xc0, 0x94, 0, 0] {
                    return Err(format!("Modelo HID++ não integrado: {}", hex(model)));
                }
                let name_feature = feature(dev, slot, 0x0005)?;
                let header = exchange(dev, slot, name_feature, 0, &[])?;
                let length = header.get(4).copied().unwrap_or(0) as usize;
                if !(1..=96).contains(&length) {
                    return Err("Nome HID++ inválido.".into());
                }
                let mut name = Vec::with_capacity(length);
                for offset in (0..length).step_by(16) {
                    let fragment = exchange(dev, slot, name_feature, 0x10, &[offset as u8])?;
                    let size = (length - offset).min(16);
                    let data = fragment
                        .get(4..4 + size)
                        .ok_or("Fragmento HID++ incompleto.")?;
                    name.extend_from_slice(data);
                }
                let name = String::from_utf8(name).map_err(|_| "Nome HID++ inválido.")?;
                if !name.is_ascii() || name.trim().is_empty() {
                    return Err("Nome HID++ inválido.".into());
                }
                Ok(ModelIdentity {
                    model: "superlight".into(),
                    name,
                    method: "HID++".into(),
                    model_code: hex(model),
                })
            })();
            match result {
                Ok(identity) => return Ok(identity),
                Err(error) => last_error = error,
            }
        }
        Err(last_error)
    }
    fn hex(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{b:02X}")).collect()
    }

    pub fn aula(dev: &HidDevice) -> Result<Option<ModelIdentity>, String> {
        let mut descriptor = [0u8; 8192];
        let n = dev
            .get_report_descriptor(&mut descriptor)
            .map_err(|e| e.to_string())?;
        if feature_report_bytes(&descriptor[..n], 6) != 520 {
            return Ok(None);
        }
        // Sinowealth READ model header: report 06, command 82, address 00010001, length 6.
        let mut query = [0u8; 520];
        query[..7].copy_from_slice(&[6, 0x82, 1, 0, 1, 0, 6]);
        dev.send_feature_report(&query).map_err(|e| e.to_string())?;
        let mut response = [0u8; 520];
        response[0] = 6;
        let n = dev
            .get_feature_report(&mut response)
            .map_err(|e| e.to_string())?;
        decode_aula(&response[..n]).map(Some)
    }
    pub(super) fn decode_aula(response: &[u8]) -> Result<ModelIdentity, String> {
        if response.len() < 14 || response[..8] != [6, 0x82, 1, 0, 1, 0, 6, 0] {
            return Err("Resposta de identificação do teclado inválida.".into());
        }
        if response[13] != 0xcd {
            return Err(format!(
                "Modelo de teclado não integrado: 0x{:02X}.",
                response[13]
            ));
        }
        Ok(ModelIdentity {
            model: "f75".into(),
            name: "AULA F75".into(),
            method: "Sinowealth".into(),
            model_code: "CD".into(),
        })
    }
    pub fn aula_wireless(dev: &HidDevice) -> Result<Option<ModelIdentity>, String> {
        let mut descriptor = [0u8; 8192];
        let n = dev
            .get_report_descriptor(&mut descriptor)
            .map_err(|e| e.to_string())?;
        if report_bytes(&descriptor[..n], 0x13, 8) != 20
            || report_bytes(&descriptor[..n], 0x13, 9) != 20
        {
            return Ok(None);
        }
        // Compx model getter only. Never send wired feature reports to the receiver.
        let mut query = [0u8; 20];
        query[..3].copy_from_slice(&[0x13, 0x05, 1]);
        query[19] = 0x19;
        for attempt in 0..2 {
            if attempt > 0 {
                std::thread::sleep(Duration::from_millis(200));
            }
            for _ in 0..8 {
                let mut stale = [0u8; 64];
                if dev.read_timeout(&mut stale, 0).map_err(|e| e.to_string())? == 0 {
                    break;
                }
            }
            let written = dev.write(&query).map_err(|e| e.to_string())?;
            if written != query.len() {
                return Err("Consulta 2,4 GHz incompleta.".into());
            }
            let deadline = Instant::now() + Duration::from_millis(300);
            while Instant::now() < deadline {
                let mut response = [0u8; 64];
                let n = dev
                    .read_timeout(&mut response, 30)
                    .map_err(|e| e.to_string())?;
                if let Some(result) = decode_aula_wireless(&response[..n]) {
                    return result.map(Some);
                }
            }
        }
        Err("O teclado não respondeu pelo receptor 2,4 GHz. Pressione uma tecla e atualize; confirme o modo 2.4G.".into())
    }
    fn decode_aula_wireless(response: &[u8]) -> Option<Result<ModelIdentity, String>> {
        if response.len() != 20
            || response[0] != 0x13
            || response[1] & 0x7f != 0x05
            || response[2..5] != [1, 0, 10]
            || response[..19]
                .iter()
                .fold(0u8, |sum, b| sum.wrapping_add(*b))
                != response[19]
        {
            return None;
        }
        if response[10] != 0xcd {
            return Some(Err(format!(
                "Modelo 2,4 GHz não integrado: 0x{:02X}.",
                response[10]
            )));
        }
        Some(Ok(ModelIdentity {
            model: "f75".into(),
            name: "AULA F75".into(),
            method: "Compx 2.4 GHz · identificação".into(),
            model_code: "CD".into(),
        }))
    }
    // Parse feature lengths before sending a query; other collections remain untouched.
    pub(crate) fn feature_report_bytes(descriptor: &[u8], wanted: u8) -> usize {
        report_bytes(descriptor, wanted, 11)
    }
    fn report_bytes(descriptor: &[u8], wanted: u8, main_tag: u8) -> usize {
        let (mut size, mut count, mut id, mut bits, mut pos) =
            (0usize, 0usize, 0u8, 0usize, 0usize);
        let mut stack = vec![];
        while pos < descriptor.len() {
            let prefix = descriptor[pos];
            pos += 1;
            if prefix == 0xfe {
                if pos + 2 > descriptor.len() {
                    return 0;
                }
                pos += descriptor[pos] as usize + 2;
                continue;
            }
            let len = match prefix & 3 {
                3 => 4,
                n => n as usize,
            };
            if pos + len > descriptor.len() {
                return 0;
            }
            let value = descriptor[pos..pos + len]
                .iter()
                .enumerate()
                .fold(0usize, |a, (i, b)| a | ((*b as usize) << (8 * i)));
            pos += len;
            match ((prefix >> 2) & 3, prefix >> 4) {
                (1, 7) => size = value,
                (1, 8) => id = value as u8,
                (1, 9) => count = value,
                (1, 10) => stack.push((size, count, id)),
                (1, 11) => {
                    if let Some(state) = stack.pop() {
                        (size, count, id) = state;
                    } else {
                        return 0;
                    }
                }
                (0, tag) if tag == main_tag && id == wanted => {
                    bits = bits.saturating_add(size.saturating_mul(count))
                }
                _ => {}
            }
        }
        if bits == 0 {
            0
        } else {
            bits.div_ceil(8) + 1
        }
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn matches_slot_and_software_id() {
            assert!(decode_reply(&[0x11, 2, 0, 0x0b, 3], 1, 0, 0x0b).is_none());
            assert!(decode_reply(&[0x11, 1, 0, 0x01, 3], 1, 0, 0x0b).is_none());
            assert!(decode_reply(&[0x11, 1, 0, 0x0b, 3], 1, 0, 0x0b)
                .unwrap()
                .is_ok());
        }
        #[test]
        fn device_error_is_not_an_identity() {
            assert!(decode_reply(&[0x11, 1, 0xff, 0, 0x0b, 9], 1, 0, 0x0b)
                .unwrap()
                .is_err());
        }
        #[test]
        fn requires_complete_model_response() {
            let mut response = [6, 0x82, 1, 0, 1, 0, 6, 0, 3, 0, 0, 0, 0, 0xcd];
            assert_eq!(decode_aula(&response).unwrap().model, "f75");
            assert!(decode_aula(&response[..13]).is_err());
            response[13] = 0xa4;
            assert!(decode_aula(&response).is_err());
            response[1] = 4;
            assert!(decode_aula(&response).is_err());
        }
        #[test]
        fn checks_the_actual_feature_descriptor() {
            let desc = [0x85, 6, 0x75, 8, 0x96, 7, 2, 0xb1, 2];
            assert_eq!(feature_report_bytes(&desc, 6), 520);
            assert_eq!(feature_report_bytes(&desc, 5), 0);
            assert_eq!(feature_report_bytes(&desc[..6], 6), 0);
        }
        #[test]
        fn wireless_model_requires_checked_complete_reply_and_f75_code() {
            let mut response = [
                0x13, 0x05, 1, 0, 10, 3, 0, 0, 0, 0, 0xcd, 1, 0, 0, 0, 0, 0, 0, 0, 0xf4,
            ];
            assert_eq!(
                decode_aula_wireless(&response).unwrap().unwrap().model,
                "f75"
            );
            assert!(decode_aula_wireless(&response[..19]).is_none());
            response[19] ^= 1;
            assert!(decode_aula_wireless(&response).is_none());
            response[10] = 0xa4;
            response[19] = response[..19]
                .iter()
                .fold(0u8, |sum, b| sum.wrapping_add(*b));
            assert!(decode_aula_wireless(&response).unwrap().is_err());
            response[1] = 0x4a;
            assert!(decode_aula_wireless(&response).is_none());
        }
        #[test]
        fn wireless_descriptor_requires_both_input_and_output_reports() {
            let descriptor = [0x85, 0x13, 0x75, 8, 0x95, 19, 0x81, 2, 0x91, 2];
            assert_eq!(report_bytes(&descriptor, 0x13, 8), 20);
            assert_eq!(report_bytes(&descriptor, 0x13, 9), 20);
            assert_eq!(feature_report_bytes(&descriptor, 0x13), 0);
            assert_eq!(report_bytes(&descriptor[..8], 0x13, 9), 0);
        }
    }
}
#[cfg(all(windows, feature = "hardware-hid"))]
pub use native::{aula, aula_wireless, logitech};
#[cfg(all(windows, feature = "hardware-hid"))]
pub(crate) use native::{exchange, feature};
