use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize)]
pub struct SettingsSnapshot {
    pub device_id: String,
    pub revision: String,
    pub settings: Settings,
}
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Settings {
    Mouse {
        dpi: u16,
        dpi_options: Vec<u16>,
        polling_hz: Option<u16>,
        polling_options: Vec<u16>,
        mode: Option<u8>,
        battery_percent: Option<u8>,
    },
    Keyboard {
        effect: u8,
        effect_options: Vec<u8>,
        brightness: Option<u8>,
        speed: Option<u8>,
        transport: String,
        brightness_min: u8,
    },
}
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum SettingChange {
    MouseDpi { dpi: u16 },
    MousePolling { polling_hz: u16 },
    MouseMode { mode: u8 },
    KeyboardEffect { effect: u8 },
    KeyboardBrightness { brightness: u8 },
    KeyboardSpeed { speed: u8 },
}
#[cfg(all(windows, feature = "hardware-hid"))]
mod native {
    use super::*;
    use crate::identity;
    use hidapi::HidDevice;
    use std::{
        hash::{Hash, Hasher},
        thread,
        time::Duration,
    };
    enum Target {
        Mouse { device: HidDevice, slot: u8 },
        Keyboard { device: HidDevice },
        WirelessKeyboard { device: HidDevice },
    }
    pub fn physical_id(device: &HidDevice) -> Result<String, String> {
        let g = device.get_container_id().map_err(|e| e.to_string())?;
        if (g.data1, g.data2, g.data3, g.data4) == (0, 0, 0, [0; 8]) {
            return Err("Identidade física indisponível.".into());
        }
        Ok(format!(
            "physical-{}",
            digest((g.data1, g.data2, g.data3, g.data4))
        ))
    }
    fn digest(value: impl Hash) -> String {
        let mut h = std::collections::hash_map::DefaultHasher::new();
        value.hash(&mut h);
        format!("{:016x}", h.finish())
    }
    fn open(id: &str) -> Result<Target, String> {
        if id.len() != 25
            || !id.starts_with("physical-")
            || !id[9..].bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("Dispositivo inválido.".into());
        }
        let api = hidapi::HidApi::new().map_err(|e| e.to_string())?;
        for info in api.device_list() {
            let mouse = info.vendor_id() == 0x046d
                && [0xc547, 0xc094].contains(&info.product_id())
                && info.usage_page() == 0xff00
                && info.usage() == 2;
            let keyboard = info.vendor_id() == 0x258a
                && info.product_id() == 0x010c
                && info.usage_page() == 0xff00;
            let wireless_keyboard = info.vendor_id() == 0x3554
                && info.product_id() == 0xfa09
                && info.usage_page() == 0xff02
                && info.usage() == 2;
            if !mouse && !keyboard && !wireless_keyboard {
                continue;
            }
            let Ok(device) = info.open_device(&api) else {
                continue;
            };
            if physical_id(&device).ok().as_deref() != Some(id) {
                continue;
            }
            if wireless_keyboard {
                if crate::identity::aula_wireless(&device)?.is_some() {
                    return Ok(Target::WirelessKeyboard { device });
                }
                continue;
            }
            if mouse {
                for slot in if info.product_id() == 0xc094 {
                    [0xff, 1]
                } else {
                    [1, 2]
                } {
                    let Ok(index) = identity::feature(&device, slot, 0x0003) else {
                        continue;
                    };
                    let Ok(reply) = identity::exchange(&device, slot, index, 0, &[]) else {
                        continue;
                    };
                    if reply.get(11..17) == Some(&[0x40, 0x93, 0xc0, 0x94, 0, 0]) {
                        return Ok(Target::Mouse { device, slot });
                    }
                }
                return Err(
                    "O Superlight não respondeu à identificação. Mova o mouse e tente novamente."
                        .into(),
                );
            }
            if matches!(identity::aula(&device), Ok(Some(_))) {
                return Ok(Target::Keyboard { device });
            }
        }
        Err("Dispositivo indisponível ou interface em uso. Atualize a detecção.".into())
    }
    fn payload(reply: &[u8]) -> Result<&[u8], String> {
        reply
            .get(4..)
            .ok_or_else(|| "Resposta HID++ incompleta.".into())
    }
    pub(super) fn dpi_options(data: &[u8]) -> Result<Vec<u16>, String> {
        if data.first() != Some(&0) {
            return Err("Sensor DPI inesperado.".into());
        }
        let mut options = Vec::new();
        let mut pos = 1;
        while pos + 1 < data.len() {
            let value = u16::from_be_bytes([data[pos], data[pos + 1]]);
            pos += 2;
            if value == 0 {
                break;
            }
            if value & 0xe000 == 0xe000 {
                let step = value & 0x1fff;
                let first = *options.last().ok_or("Faixa DPI inválida.")?;
                let last = u16::from_be_bytes([
                    *data.get(pos).ok_or("Faixa DPI incompleta.")?,
                    *data.get(pos + 1).ok_or("Faixa DPI incompleta.")?,
                ]);
                pos += 2;
                if step == 0
                    || last <= first
                    || (last - first) % step != 0
                    || ((last - first) / step) > 2048
                {
                    return Err("Faixa DPI inválida.".into());
                }
                let mut next = u32::from(first) + u32::from(step);
                while next <= u32::from(last) {
                    options.push(next as u16);
                    next += u32::from(step);
                }
            } else {
                options.push(value);
            }
        }
        if options.is_empty() || options.len() > 2048 {
            return Err("O mouse não informou uma faixa DPI válida.".into());
        }
        options.sort_unstable();
        options.dedup();
        Ok(options)
    }
    fn mouse_state(device: &HidDevice, slot: u8) -> Result<Settings, String> {
        let dpi_feature = identity::feature(device, slot, 0x2201)?;
        let list = identity::exchange(device, slot, dpi_feature, 0x10, &[0])?;
        let options = dpi_options(payload(&list)?)?;
        let current = identity::exchange(device, slot, dpi_feature, 0x20, &[0])?;
        let data = payload(&current)?;
        if data.len() < 3 || data[0] != 0 {
            return Err("DPI atual inválido.".into());
        }
        let dpi = u16::from_be_bytes([data[1], data[2]]);
        if !options.contains(&dpi) {
            return Err("DPI retornado fora da faixa anunciada.".into());
        }
        let rates = (|| -> Result<(u16, Vec<u16>), String> {
            let index = identity::feature(device, slot, 0x8060)?;
            let supported = identity::exchange(device, slot, index, 0, &[])?;
            let bitmap = *payload(&supported)?.first().ok_or("Polling inválido.")?;
            let options: Vec<u16> = (0..8)
                .filter(|i| bitmap & (1 << i) != 0)
                .map(|i| (1000f64 / f64::from(i + 1)).round() as u16)
                .collect();
            let current = identity::exchange(device, slot, index, 0x10, &[])?;
            let ms = *payload(&current)?.first().ok_or("Polling inválido.")?;
            if !(1..=8).contains(&ms) {
                return Err("Polling inválido.".into());
            }
            let hz = (1000f64 / f64::from(ms)).round() as u16;
            if !options.contains(&hz) {
                return Err("Polling não anunciado pelo mouse.".into());
            }
            Ok((hz, options))
        })()
        .ok();
        let mode = identity::feature(device, slot, 0x8100)
            .and_then(|f| identity::exchange(device, slot, f, 0x20, &[]))
            .ok()
            .and_then(|r| r.get(4).copied())
            .filter(|m| [1, 2].contains(m));
        let battery_percent = identity::feature(device, slot, 0x1004)
            .and_then(|f| identity::exchange(device, slot, f, 0x10, &[]))
            .ok()
            .and_then(|r| r.get(4).copied())
            .filter(|b| *b <= 100);
        Ok(Settings::Mouse {
            dpi,
            dpi_options: options,
            polling_hz: rates.as_ref().map(|r| r.0),
            polling_options: rates.map(|r| r.1).unwrap_or_default(),
            mode,
            battery_percent,
        })
    }
    const CONFIG_HEADER: [u8; 8] = [6, 0x84, 0, 0, 1, 0, 0x80, 0];
    fn keyboard_config(device: &HidDevice) -> Result<[u8; 128], String> {
        let mut request = [0u8; 520];
        request[..8].copy_from_slice(&CONFIG_HEADER);
        device
            .send_feature_report(&request)
            .map_err(|e| e.to_string())?;
        let mut response = [0u8; 520];
        response[0] = 6;
        let n = device
            .get_feature_report(&mut response)
            .map_err(|e| e.to_string())?;
        decode_config(&response[..n])
    }
    fn write_keyboard(device: &HidDevice, config: &[u8; 128]) -> Result<(), String> {
        let mut report = [0u8; 520];
        report[..8].copy_from_slice(&CONFIG_HEADER);
        report[1] = 4;
        report[8..136].copy_from_slice(config);
        device
            .send_feature_report(&report)
            .map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(60));
        if keyboard_config(device)? != *config {
            return Err(
                "O teclado não confirmou a alteração. Atualize para conferir o estado atual."
                    .into(),
            );
        }
        Ok(())
    }
    pub(super) fn decode_config(response: &[u8]) -> Result<[u8; 128], String> {
        if response.len() < 136 || response[..8] != CONFIG_HEADER {
            return Err("Resposta de configuração do F75 inválida.".into());
        }
        let config: [u8; 128] = response[8..136].try_into().unwrap();
        if config[126..] != [0x5a, 0xa5] || (!((0..=18).contains(&config[10])) && config[10] != 21)
        {
            return Err("Formato de configuração do F75 não reconhecido.".into());
        }
        for i in 0..19 {
            if !(1..=9).contains(&config[64 + i * 2]) || config[65 + i * 2] >> 4 > 4 {
                return Err("Tabela de iluminação do F75 não reconhecida.".into());
            }
        }
        Ok(config)
    }
    fn keyboard_state(config: &[u8; 128]) -> Settings {
        let brightness = config[64];
        let speed = config[65] >> 4;
        Settings::Keyboard {
            effect: config[10],
            effect_options: (0..=18).collect(),
            brightness: (0..19)
                .all(|i| config[64 + i * 2] == brightness)
                .then_some(brightness),
            speed: (0..19)
                .all(|i| config[65 + i * 2] >> 4 == speed)
                .then_some(speed),
            transport: "usb".into(),
            brightness_min: 1,
        }
    }
    pub(super) fn patch_keyboard(
        config: &[u8; 128],
        change: &SettingChange,
    ) -> Result<[u8; 128], String> {
        let mut next = *config;
        match change {
            SettingChange::KeyboardEffect { effect } if *effect <= 18 => next[10] = *effect,
            SettingChange::KeyboardBrightness { brightness } if (1..=9).contains(brightness) => {
                for i in 0..19 {
                    next[64 + i * 2] = *brightness;
                }
            }
            SettingChange::KeyboardSpeed { speed } if *speed <= 4 => {
                for i in 0..19 {
                    next[65 + i * 2] = (next[65 + i * 2] & 0x0f) | (speed << 4);
                }
            }
            _ => return Err("Ajuste de iluminação inválido.".into()),
        }
        Ok(next)
    }
    fn revision(settings: &Settings, config: Option<&[u8; 128]>) -> String {
        match settings {
            Settings::Mouse {
                dpi,
                polling_hz,
                mode,
                ..
            } => digest((*dpi, *polling_hz, *mode)),
            Settings::Keyboard { .. } => digest(config.unwrap()),
        }
    }
    fn snapshot(id: &str, target: &Target) -> Result<SettingsSnapshot, String> {
        let (settings, config) = match target {
            Target::Mouse { device, slot } => (mouse_state(device, *slot)?, None),
            Target::Keyboard { device } => {
                let c = keyboard_config(device)?;
                (keyboard_state(&c), Some(c))
            }
            Target::WirelessKeyboard { device } => {
                let config = crate::aula_wireless::read(device)?;
                return Ok(SettingsSnapshot {
                    device_id: id.into(),
                    revision: digest(config),
                    settings: crate::aula_wireless::state(&config),
                });
            }
        };
        Ok(SettingsSnapshot {
            device_id: id.into(),
            revision: revision(&settings, config.as_ref()),
            settings,
        })
    }
    pub fn read(id: &str) -> Result<SettingsSnapshot, String> {
        let _guard = crate::hid::DEVICE_IO
            .lock()
            .map_err(|_| "Acesso ao hardware indisponível.")?;
        snapshot(id, &open(id)?)
    }
    pub fn apply(
        id: &str,
        expected: &str,
        change: SettingChange,
    ) -> Result<SettingsSnapshot, String> {
        let _guard = crate::hid::DEVICE_IO
            .lock()
            .map_err(|_| "Acesso ao hardware indisponível.")?;
        let target = open(id)?;
        match &target {
            Target::Mouse { device, slot } => {
                let before = mouse_state(device, *slot)?;
                if revision(&before, None) != expected {
                    return Err("A configuração mudou em outro software. Os valores foram atualizados; aplique novamente.".into());
                }
                let Settings::Mouse {
                    dpi_options,
                    polling_options,
                    mode,
                    ..
                } = &before
                else {
                    unreachable!()
                };
                match &change {
                    SettingChange::MouseMode { mode: requested } if [1, 2].contains(requested) => {
                        let f = identity::feature(device, *slot, 0x8100)?;
                        identity::exchange(device, *slot, f, 0x10, &[*requested])?;
                    }
                    SettingChange::MouseDpi { dpi } if dpi_options.contains(dpi) => {
                        if *mode != Some(2) {
                            return Err(
                                "Ative o controle por software antes de alterar o DPI.".into()
                            );
                        }
                        let f = identity::feature(device, *slot, 0x2201)?;
                        let bytes = dpi.to_be_bytes();
                        identity::exchange(device, *slot, f, 0x30, &[0, bytes[0], bytes[1]])?;
                    }
                    SettingChange::MousePolling { polling_hz }
                        if polling_options.contains(polling_hz) =>
                    {
                        if *mode != Some(2) {
                            return Err(
                                "Ative o controle por software antes de alterar o polling.".into(),
                            );
                        }
                        let f = identity::feature(device, *slot, 0x8060)?;
                        let ms = (1000f64 / f64::from(*polling_hz)).round() as u8;
                        identity::exchange(device, *slot, f, 0x20, &[ms])?;
                    }
                    _ => return Err("Valor não suportado pelo dispositivo.".into()),
                }
            }
            Target::Keyboard { device } => {
                let before = keyboard_config(device)?;
                if revision(&keyboard_state(&before), Some(&before)) != expected {
                    return Err(
                        "A iluminação mudou. Os valores foram atualizados; aplique novamente."
                            .into(),
                    );
                }
                let next = patch_keyboard(&before, &change)?;
                if next != before {
                    write_keyboard(device, &next)?;
                }
            }
            Target::WirelessKeyboard { device } => {
                let before = crate::aula_wireless::read(device)?;
                if digest(before) != expected {
                    return Err(
                        "A iluminação mudou. Atualize os valores e aplique novamente.".into(),
                    );
                }
                let next = crate::aula_wireless::patch(&before, &change)?;
                if next != before {
                    crate::aula_wireless::write(device, &next)?;
                }
            }
        }
        let result = snapshot(id, &target)?;
        let matches = match (&result.settings, &change) {
            (Settings::Mouse { dpi, .. }, SettingChange::MouseDpi { dpi: requested }) => {
                dpi == requested
            }
            (
                Settings::Mouse { polling_hz, .. },
                SettingChange::MousePolling {
                    polling_hz: requested,
                },
            ) => *polling_hz == Some(*requested),
            (Settings::Mouse { mode, .. }, SettingChange::MouseMode { mode: requested }) => {
                *mode == Some(*requested)
            }
            (
                Settings::Keyboard { effect, .. },
                SettingChange::KeyboardEffect { effect: requested },
            ) => effect == requested,
            (
                Settings::Keyboard { brightness, .. },
                SettingChange::KeyboardBrightness {
                    brightness: requested,
                },
            ) => *brightness == Some(*requested),
            (
                Settings::Keyboard { speed, .. },
                SettingChange::KeyboardSpeed { speed: requested },
            ) => *speed == Some(*requested),
            _ => false,
        };
        if !matches {
            return Err("O dispositivo não confirmou o valor solicitado. Atualize para conferir o estado atual.".into());
        }
        Ok(result)
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn parses_advertised_dpi_range() {
            let values = dpi_options(&[0, 0, 100, 0xe0, 50, 0x64, 0, 0, 0]).unwrap();
            assert_eq!(values.first(), Some(&100));
            assert_eq!(values.last(), Some(&25600));
            assert_eq!(values.len(), 511);
            assert!(!values.contains(&825));
        }
        #[test]
        fn rejects_malformed_dpi_ranges() {
            for data in [
                vec![0, 0xe0, 50],
                vec![0, 0, 100, 0xe0, 0, 0x64, 0],
                vec![0, 0, 100, 0xe0, 50, 0, 90],
                vec![1, 0, 100],
            ] {
                assert!(dpi_options(&data).is_err());
            }
        }
        fn config() -> [u8; 128] {
            let mut c = [0x42; 128];
            c[10] = 11;
            c[126] = 0x5a;
            c[127] = 0xa5;
            for i in 0..19 {
                c[64 + i * 2] = 9;
                c[65 + i * 2] = 0x37;
            }
            c
        }
        #[test]
        fn lighting_patch_preserves_every_unrelated_byte() {
            let baseline = config();
            let effect =
                patch_keyboard(&baseline, &SettingChange::KeyboardEffect { effect: 0 }).unwrap();
            assert_eq!(
                effect
                    .iter()
                    .zip(baseline)
                    .filter(|(a, b)| **a != *b)
                    .count(),
                1
            );
            let bright = patch_keyboard(
                &baseline,
                &SettingChange::KeyboardBrightness { brightness: 5 },
            )
            .unwrap();
            for i in 0..128 {
                if (64..102).contains(&i) && i % 2 == 0 {
                    assert_eq!(bright[i], 5);
                } else {
                    assert_eq!(bright[i], baseline[i]);
                }
            }
            let speed =
                patch_keyboard(&baseline, &SettingChange::KeyboardSpeed { speed: 2 }).unwrap();
            for i in 0..19 {
                assert_eq!(speed[65 + i * 2], 0x27);
            }
        }
        #[test]
        fn rejects_unsupported_effects_and_levels() {
            let c = config();
            for change in [
                SettingChange::KeyboardEffect { effect: 21 },
                SettingChange::KeyboardBrightness { brightness: 0 },
                SettingChange::KeyboardSpeed { speed: 5 },
                SettingChange::MouseDpi { dpi: 800 },
            ] {
                assert!(patch_keyboard(&c, &change).is_err());
            }
        }
        #[test]
        fn validates_config_header_length_and_trailer() {
            let mut report = vec![0u8; 136];
            report[..8].copy_from_slice(&CONFIG_HEADER);
            report[8..].copy_from_slice(&config());
            assert!(decode_config(&report).is_ok());
            assert!(decode_config(&report[..135]).is_err());
            report[1] = 4;
            assert!(decode_config(&report).is_err());
            report[1] = 0x84;
            report[135] = 0;
            assert!(decode_config(&report).is_err());
        }
        #[test]
        fn battery_changes_do_not_invalidate_mouse_settings() {
            let mut state = Settings::Mouse {
                dpi: 800,
                dpi_options: vec![800],
                polling_hz: Some(1000),
                polling_options: vec![1000],
                mode: Some(2),
                battery_percent: Some(38),
            };
            let original = revision(&state, None);
            if let Settings::Mouse {
                battery_percent, ..
            } = &mut state
            {
                *battery_percent = Some(37);
            }
            assert_eq!(revision(&state, None), original);
        }
        fn hardware_roundtrip(change: SettingChange) {
            let devices = crate::hid::enumerate().unwrap();
            let id = &devices
                .iter()
                .find(|d| {
                    d.vendor_id == 0x258a
                        && d.product_id == 0x010c
                        && d.identity.as_ref().is_some_and(|i| i.model == "f75")
                })
                .expect("Conecte o F75 por USB")
                .physical_id;
            let _guard = crate::hid::DEVICE_IO.lock().unwrap();
            let Target::Keyboard { device } = open(id).unwrap() else {
                panic!("Modelo incorreto")
            };
            let baseline = keyboard_config(&device).unwrap();
            let modified = patch_keyboard(&baseline, &change).unwrap();
            let result = write_keyboard(&device, &modified);
            let restored = write_keyboard(&device, &baseline);
            assert!(
                restored.is_ok(),
                "Falha ao restaurar o teclado: {restored:?}"
            );
            assert_eq!(keyboard_config(&device).unwrap(), baseline);
            assert!(result.is_ok(), "Falha de aplicação/leitura: {result:?}");
        }
        #[test]
        #[ignore = "Requer F75 USB; altera brilho temporariamente e restaura os 128 bytes originais"]
        fn hardware_brightness_roundtrip() {
            hardware_roundtrip(SettingChange::KeyboardBrightness { brightness: 8 });
        }
        #[test]
        #[ignore = "Requer F75 USB; altera velocidade temporariamente e restaura os 128 bytes originais"]
        fn hardware_speed_roundtrip() {
            hardware_roundtrip(SettingChange::KeyboardSpeed { speed: 2 });
        }
        #[test]
        #[ignore = "Requires a real wireless F75; changes and restores its current effect through the app API"]
        fn hardware_wireless_apply_api() {
            let id = std::env::var("CENTRAL_HUB_WIRELESS_ID")
                .expect("Explicit receiver identity required");
            let before = read(&id).unwrap();
            let Settings::Keyboard {
                effect,
                ref transport,
                ..
            } = before.settings
            else {
                panic!("Not a keyboard")
            };
            assert_eq!(transport, "wireless");
            let result = apply(
                &id,
                &before.revision,
                SettingChange::KeyboardEffect {
                    effect: if effect == 15 { 14 } else { 15 },
                },
            );
            let current = read(&id).unwrap();
            let restored = apply(
                &id,
                &current.revision,
                SettingChange::KeyboardEffect { effect },
            );
            let restored = restored.expect("Failed to restore original effect through app API");
            assert_eq!(
                serde_json::to_value(&restored.settings).unwrap(),
                serde_json::to_value(&before.settings).unwrap()
            );
            result.expect("The normal app API did not confirm the change");
        }
    }
}
#[cfg(all(windows, feature = "hardware-hid"))]
pub(crate) use native::physical_id;
pub fn read(id: &str) -> Result<SettingsSnapshot, String> {
    #[cfg(all(windows, feature = "hardware-hid"))]
    {
        native::read(id)
    }
    #[cfg(not(all(windows, feature = "hardware-hid")))]
    {
        let _ = id;
        Err("Configuração disponível somente no Windows com HID.".into())
    }
}
pub fn apply(id: &str, expected: &str, change: SettingChange) -> Result<SettingsSnapshot, String> {
    #[cfg(all(windows, feature = "hardware-hid"))]
    {
        native::apply(id, expected, change)
    }
    #[cfg(not(all(windows, feature = "hardware-hid")))]
    {
        let _ = (id, expected, change);
        Err("Configuração disponível somente no Windows com HID.".into())
    }
}
#[tauri::command]
pub async fn read_device_settings(device_id: String) -> Result<SettingsSnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || read(&device_id))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn apply_device_setting(
    device_id: String,
    revision: String,
    change: SettingChange,
) -> Result<SettingsSnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || apply(&device_id, &revision, change))
        .await
        .map_err(|e| e.to_string())?
}
