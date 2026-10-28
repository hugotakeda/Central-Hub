use crate::{audio, hid};
use serde::Serialize;

#[derive(Serialize)]
pub struct Discovery {
    pub devices: Vec<hid::HidDevice>,
    pub audio: Vec<audio::AudioEndpoint>,
    pub system: Vec<crate::pnp::SystemDevice>,
    pub batteries: Vec<crate::battery::BatteryReading>,
    pub errors: Vec<String>,
}

pub fn enumerate() -> Discovery {
    let mut errors = vec![];
    let devices = hid::enumerate().unwrap_or_else(|e| {
        errors.push(format!("HID: {e}"));
        vec![]
    });
    let audio = audio::enumerate().unwrap_or_else(|e| {
        errors.push(format!("Áudio: {e}"));
        vec![]
    });
    let system = crate::pnp::enumerate().unwrap_or_else(|e| {
        errors.push(format!("PnP: {e}"));
        vec![]
    });
    Discovery {
        devices,
        audio,
        system,
        batteries: crate::battery::enumerate(),
        errors,
    }
}

#[tauri::command]
pub async fn scan_hardware() -> Result<Discovery, String> {
    tauri::async_runtime::spawn_blocking(enumerate)
        .await
        .map_err(|e| e.to_string())
}
