//! F75 receiver configuration, gated by a fresh model-CD response in controls.rs.
//! Reads the full device configuration; never substitutes factory templates or palettes.
use crate::controls::{SettingChange, Settings};
use hidapi::HidDevice;
use std::time::{Duration, Instant};
pub type Config = [[u8; 20]; 10];

fn checksum(frame: &[u8]) -> u8 {
    frame[..19].iter().fold(0u8, |sum, b| sum.wrapping_add(*b))
}
fn seal(frame: &mut [u8; 20]) {
    frame[19] = checksum(frame);
}
fn valid(frame: &[u8]) -> bool {
    frame.len() == 20 && frame[0] == 0x13 && checksum(frame) == frame[19]
}
fn table(effect: usize) -> (usize, usize) {
    match effect {
        1..=6 => (4, 7 + (effect - 1) * 2),
        7..=13 => (5, 5 + (effect - 7) * 2),
        14..=18 => (6, 5 + (effect - 14) * 2),
        _ => unreachable!(),
    }
}
fn validate(config: &Config) -> Result<(), String> {
    for (i, frame) in config.iter().enumerate() {
        if !valid(frame)
            || frame[1..4] != [0x44, 0x0a, i as u8]
            || frame[4] != if i == 9 { 2 } else { 14 }
        {
            return Err("Configuração 2,4 GHz incompleta ou formato não reconhecido.".into());
        }
    }
    if config[9][5..7] != [0x5a, 0xa5] || !(config[0][15] <= 18 || config[0][15] == 21) {
        return Err("Formato de iluminação sem fio não reconhecido.".into());
    }
    for effect in 1..=18 {
        let (seq, offset) = table(effect);
        if config[seq][offset] > 9 || config[seq][offset + 1] >> 4 > 4 {
            return Err("Tabela de iluminação sem fio não reconhecida.".into());
        }
    }
    Ok(())
}
fn send(device: &HidDevice, frame: &[u8; 20]) -> Result<(), String> {
    if device.write(frame).map_err(|e| e.to_string())? != 20 {
        return Err("Envio sem fio incompleto.".into());
    }
    Ok(())
}
fn drain(device: &HidDevice) -> Result<(), String> {
    for _ in 0..32 {
        let mut frame = [0u8; 64];
        if device
            .read_timeout(&mut frame, 0)
            .map_err(|e| e.to_string())?
            == 0
        {
            break;
        }
    }
    Ok(())
}
fn accept(config: &mut Config, seen: &mut [bool; 10], frame: &[u8]) -> Result<(), String> {
    if !valid(frame) || frame[1..3] != [0x44, 0x0a] || frame[3] >= 10 {
        return Ok(());
    }
    let i = frame[3] as usize;
    if seen[i] && config[i].as_slice() != frame {
        return Err("Fragmentos sem fio conflitantes. Atualize e tente novamente.".into());
    }
    config[i].copy_from_slice(frame);
    seen[i] = true;
    Ok(())
}
pub fn read(device: &HidDevice) -> Result<Config, String> {
    drain(device)?;
    let mut request = [0u8; 20];
    request[..3].copy_from_slice(&[0x13, 0x44, 1]);
    seal(&mut request);
    send(device, &request)?;
    let deadline = Instant::now() + Duration::from_millis(1200);
    let mut config = [[0u8; 20]; 10];
    let mut seen = [false; 10];
    while Instant::now() < deadline && !seen.iter().all(|s| *s) {
        let mut frame = [0u8; 64];
        let n = device
            .read_timeout(&mut frame, 40)
            .map_err(|e| e.to_string())?;
        accept(&mut config, &mut seen, &frame[..n])?;
    }
    if !seen.iter().all(|s| *s) {
        return Err(
            "O F75 não enviou toda a configuração por 2,4 GHz. Pressione uma tecla e atualize."
                .into(),
        );
    }
    validate(&config)?;
    Ok(config)
}
pub fn state(config: &Config) -> Settings {
    let values: Vec<_> = (1..=18)
        .map(|effect| {
            let (seq, offset) = table(effect);
            (config[seq][offset], config[seq][offset + 1] >> 4)
        })
        .collect();
    Settings::Keyboard {
        effect: config[0][15],
        effect_options: (0..=18).collect(),
        brightness: values
            .iter()
            .all(|v| v.0 == values[0].0)
            .then_some(values[0].0),
        speed: values
            .iter()
            .all(|v| v.1 == values[0].1)
            .then_some(values[0].1),
        transport: "wireless".into(),
        brightness_min: 0,
    }
}
pub fn patch(config: &Config, change: &SettingChange) -> Result<Config, String> {
    validate(config)?;
    let mut next = *config;
    match change {
        SettingChange::KeyboardEffect { effect } if *effect <= 18 => next[0][15] = *effect,
        SettingChange::KeyboardBrightness { brightness } if *brightness <= 9 => {
            for effect in 1..=18 {
                let (seq, offset) = table(effect);
                next[seq][offset] = *brightness;
            }
        }
        SettingChange::KeyboardSpeed { speed } if *speed <= 4 => {
            for effect in 1..=18 {
                let (seq, offset) = table(effect);
                next[seq][offset + 1] = (next[seq][offset + 1] & 15) | (*speed << 4);
            }
        }
        _ => return Err("Ajuste de iluminação sem fio inválido.".into()),
    }
    for frame in &mut next {
        seal(frame);
    }
    Ok(next)
}
fn echoed(sent: &[u8; 20], reply: &[u8]) -> bool {
    valid(reply) && reply == sent
}
fn exchange(device: &HidDevice, sent: &[u8; 20]) -> Result<(), String> {
    send(device, sent)?;
    let deadline = Instant::now() + Duration::from_millis(400);
    while Instant::now() < deadline {
        let mut reply = [0u8; 64];
        let n = device
            .read_timeout(&mut reply, 30)
            .map_err(|e| e.to_string())?;
        if echoed(sent, &reply[..n]) {
            return Ok(());
        }
    }
    Err("O receptor não confirmou um fragmento da alteração. Atualize para conferir o estado; a operação parou.".into())
}
pub fn write(device: &HidDevice, next: &Config) -> Result<(), String> {
    validate(next)?;
    drain(device)?;
    for (i, frame) in next.iter().enumerate() {
        let mut sent = *frame;
        sent[1] = 4;
        if i == 0 {
            sent[8] = 1;
            sent[14] = 0;
        }
        seal(&mut sent);
        exchange(device, &sent)?;
    }
    let mut commit = [0u8; 20];
    commit[..6].copy_from_slice(&[0x13, 0x0a, 1, 0, 4, 7]);
    seal(&mut commit);
    // This receiver does not echo SAVE. The following complete readback is confirmation.
    send(device, &commit)?;
    std::thread::sleep(Duration::from_millis(80));
    let actual = read(device)?;
    for effect in 1..=18 {
        let (seq, offset) = table(effect);
        if actual[seq][offset..offset + 2] != next[seq][offset..offset + 2] {
            return Err(
                "O F75 não confirmou a tabela de iluminação. Atualize para conferir o estado."
                    .into(),
            );
        }
    }
    if actual[0][15] != next[0][15] {
        return Err("O F75 não confirmou o efeito solicitado.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn config() -> Config {
        let mut c = [[0u8; 20]; 10];
        for (i, f) in c.iter_mut().enumerate() {
            f[..5].copy_from_slice(&[0x13, 0x44, 0x0a, i as u8, if i == 9 { 2 } else { 14 }]);
        }
        c[0][15] = 15;
        c[9][5..7].copy_from_slice(&[0x5a, 0xa5]);
        for effect in 1..=18 {
            let (s, o) = table(effect);
            c[s][o] = 5;
            c[s][o + 1] = 0x37;
        }
        for f in &mut c {
            seal(f);
        }
        c
    }
    #[test]
    fn rejects_incomplete_corrupt_or_unknown_configuration() {
        let c = config();
        validate(&c).unwrap();
        let mut x = c;
        x[1] = [0; 20];
        assert!(validate(&x).is_err());
        let mut x = c;
        x[9][6] = 0;
        seal(&mut x[9]);
        assert!(validate(&x).is_err());
        let mut x = c;
        x[0][15] = 99;
        seal(&mut x[0]);
        assert!(validate(&x).is_err());
    }
    #[test]
    fn preserves_unknown_fields_and_color_flags() {
        let c = config();
        let next = patch(&c, &SettingChange::KeyboardBrightness { brightness: 0 }).unwrap();
        for i in 0..10 {
            for j in 0..19 {
                let changed = (1..=18).any(|e| table(e) == (i, j));
                if changed {
                    assert_eq!(next[i][j], 0);
                } else {
                    assert_eq!(next[i][j], c[i][j]);
                }
            }
        }
        let speed = patch(&c, &SettingChange::KeyboardSpeed { speed: 4 }).unwrap();
        for e in 1..=18 {
            let (s, o) = table(e);
            assert_eq!(speed[s][o + 1], 0x47);
        }
        assert!(patch(&c, &SettingChange::KeyboardEffect { effect: 19 }).is_err());
    }
    #[test]
    fn aggregates_out_of_order_and_rejects_conflicts() {
        let c = config();
        let mut out = [[0; 20]; 10];
        let mut seen = [false; 10];
        for f in c.iter().rev() {
            accept(&mut out, &mut seen, f).unwrap();
        }
        assert_eq!(out, c);
        let mut conflict = c[0];
        conflict[15] = 3;
        seal(&mut conflict);
        assert!(accept(&mut out, &mut seen, &conflict).is_err());
    }
    #[test]
    fn does_not_use_unrelated_or_wrong_echoes() {
        let c = config();
        assert!(echoed(&c[0], &c[0]));
        assert!(!echoed(&c[0], &c[1]));
        let mut bad = c[0];
        bad[19] ^= 1;
        assert!(!echoed(&c[0], &bad));
    }
    #[test]
    fn mixed_levels_are_not_invented() {
        let mut c = config();
        c[4][7] = 2;
        seal(&mut c[4]);
        assert!(matches!(
            state(&c),
            Settings::Keyboard {
                brightness: None,
                speed: Some(3),
                ..
            }
        ));
    }
    #[test]
    #[ignore = "Changes lighting on a real F75 receiver and restores its original configuration"]
    fn hardware_wireless_settings_roundtrip() {
        let _guard = crate::hid::DEVICE_IO.lock().unwrap();
        let api = hidapi::HidApi::new().unwrap();
        let info = api
            .device_list()
            .find(|d| {
                d.vendor_id() == 0x3554
                    && d.product_id() == 0xfa09
                    && d.usage_page() == 0xff02
                    && d.usage() == 2
            })
            .expect("F75 receiver absent");
        let device = info.open_device(&api).unwrap();
        assert_eq!(
            crate::identity::aula_wireless(&device)
                .unwrap()
                .unwrap()
                .model_code,
            "CD"
        );
        let backup = std::env::var("CENTRAL_HUB_TEST_BACKUP")
            .expect("Explicit baseline backup path is required");
        let restoring = std::env::var("CENTRAL_HUB_RESTORE_ONLY").as_deref() == Ok("1");
        let before: Config = if restoring {
            serde_json::from_slice(&std::fs::read(&backup).unwrap()).unwrap()
        } else {
            let c = read(&device).unwrap();
            let mut file = std::fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&backup)
                .expect("Use a new backup path");
            std::io::Write::write_all(&mut file, &serde_json::to_vec_pretty(&c).unwrap()).unwrap();
            c
        };
        let result = (|| -> Result<(), String> {
            if restoring {
                return Ok(());
            }
            let changed_effect = if before[0][15] == 15 { 14 } else { 15 };
            let effect = patch(
                &before,
                &SettingChange::KeyboardEffect {
                    effect: changed_effect,
                },
            )?;
            write(&device, &effect)?;
            let level = patch(
                &read(&device)?,
                &SettingChange::KeyboardBrightness { brightness: 4 },
            )?;
            write(&device, &level)?;
            let speed = patch(&read(&device)?, &SettingChange::KeyboardSpeed { speed: 2 })?;
            write(&device, &speed)?;
            Ok(())
        })();
        let restored = write(&device, &before);
        let actual = read(&device);
        eprintln!("Wireless settings result: {result:?}; restoration: {restored:?}");
        restored.expect("Original configuration could not be restored; baseline backup preserved");
        let actual = actual.unwrap();
        for i in 0..10 {
            for j in 4..19 {
                if i == 0 && (j == 8 || j == 14) {
                    continue;
                }
                assert_eq!(actual[i][j], before[i][j], "Restoration byte {i}:{j}");
            }
        }
        result.unwrap();
    }
}
