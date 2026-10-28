//! Explicit read-only diagnostics. Never calls configuration apply or writes profiles.
use serde::Serialize;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
#[derive(Serialize)]
pub struct Check {
    pub name: String,
    pub status: String,
    pub detail: String,
    pub elapsed_ms: u128,
}
#[derive(Serialize)]
pub struct Report {
    pub app_version: String,
    pub device_id: String,
    pub started_at_ms: u128,
    pub elapsed_ms: u128,
    pub checks: Vec<Check>,
    pub hid: Vec<crate::hid::HidDevice>,
    pub audio: Vec<crate::audio::AudioEndpoint>,
    pub snapshot: Option<crate::controls::SettingsSnapshot>,
    pub discovery_errors: Vec<String>,
    pub system: Vec<crate::pnp::SystemDevice>,
    pub batteries: Vec<crate::battery::BatteryReading>,
}
fn check(name: &str, status: &str, detail: String, elapsed_ms: u128) -> Check {
    Check {
        name: name.into(),
        status: status.into(),
        detail,
        elapsed_ms,
    }
}
fn known_collection(vendor: u16, product: u16, page: u16, usage: u16) -> bool {
    (vendor == 0x046d && [0xc547, 0xc094].contains(&product) && page == 0xff00 && usage == 2)
        || (vendor == 0x258a && product == 0x010c && page == 0xff00)
        || (vendor == 0x3554 && product == 0xfa09 && page == 0xff02 && usage == 2)
}
pub fn execute(device_id: &str, audio_ids: &[String]) -> Result<Report, String> {
    if device_id.is_empty()
        || device_id.len() > 256
        || audio_ids.len() > 32
        || audio_ids.iter().any(|s| s.len() > 512)
    {
        return Err("Seleção de dispositivo inválida.".into());
    }
    let started_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let start = Instant::now();
    let discovery = crate::discovery::enumerate();
    let batteries: Vec<_> = discovery
        .batteries
        .into_iter()
        .filter(|b| b.physical_id == device_id)
        .collect();
    let hid: Vec<_> = discovery
        .devices
        .into_iter()
        .filter(|d| d.physical_id == device_id || d.id == device_id)
        .collect();
    let audio: Vec<_> = discovery
        .audio
        .into_iter()
        .filter(|e| audio_ids.contains(&e.id) || e.physical_id.as_deref() == Some(device_id))
        .collect();
    let system: Vec<_> = discovery
        .system
        .into_iter()
        .filter(|d| d.physical_id == device_id || d.id == device_id)
        .collect();
    let present = !hid.is_empty() || !audio.is_empty() || !system.is_empty();
    let mut checks = vec![check(
        "Presença no Windows",
        if present { "pass" } else { "fail" },
        if present {
            format!(
                "{} coleções HID, {} endpoints ativos e {} interfaces PnP encontrados nesta leitura.",
                hid.len(),
                audio.len(), system.len()
            )
        } else {
            "O dispositivo selecionado não está presente. Atualize a lista e verifique a conexão."
                .into()
        },
        start.elapsed().as_millis(),
    )];
    for battery in &batteries {
        checks.push(check(
            "Bateria",
            if battery.error.is_none() {
                "pass"
            } else {
                "unavailable"
            },
            battery.error.clone().unwrap_or_else(|| {
                format!(
                    "{} · porcentagem: {} · tensão: {} mV. Somente leitura.",
                    battery.source,
                    battery
                        .percent
                        .map(|p| format!("{p}%"))
                        .unwrap_or_else(|| "não informada".into()),
                    battery
                        .voltage_mv
                        .map(|v| v.to_string())
                        .unwrap_or_else(|| "não informada".into())
                )
            }),
            0,
        ));
    }
    if !system.is_empty() {
        checks.push(check(
            "Presença Plug and Play",
            "pass",
            format!(
                "{} interfaces de entrada presentes no Windows.",
                system.len()
            ),
            0,
        ));
    }
    if !hid.is_empty() {
        checks.push(check("Descritores HID", if hid.iter().any(|d| d.usage_page > 0) {"pass"} else {"unavailable"}, "VID/PID, barramento e usos obtidos da enumeração HID do Windows. Não verifica a integridade física de cada tecla/sensor.".into(), 0));
        checks.push(check(
            "Driver do Windows",
            if hid.iter().any(|d| d.driver_version.is_some()) {
                "pass"
            } else {
                "unavailable"
            },
            hid.iter()
                .find_map(|d| d.driver_version.as_ref())
                .map(|v| format!("Versão informada: {v}. Não é uma certificação do driver."))
                .unwrap_or_else(|| {
                    "O Windows não informou a versão do driver desta interface.".into()
                }),
            0,
        ));
    }
    let mut snapshot = None;
    if let Some(identity) = hid
        .iter()
        .filter(|d| !d.identity_cached)
        .find_map(|d| d.identity.as_ref())
    {
        checks.push(check(
            "Identificação do modelo",
            "pass",
            format!(
                "{} · {} · modelo {} retornado pelo dispositivo.",
                identity.name, identity.method, identity.model_code
            ),
            0,
        ));
    }
    if hid.iter().any(|d| {
        known_collection(d.vendor_id, d.product_id, d.usage_page, d.usage)
            && d.identity
                .as_ref()
                .is_some_and(|i| matches!(i.model.as_str(), "superlight" | "f75"))
    }) || hid.iter().any(|d| {
        known_collection(d.vendor_id, d.product_id, d.usage_page, d.usage)
            && d.probe_error
                .as_ref()
                .is_some_and(|e| !e.contains("não integrado") && !e.contains("não reconhecido"))
    }) {
        let read = Instant::now();
        match crate::controls::read(device_id) {
            Ok(state) => {
                checks.push(check("Leitura do protocolo", "pass", "Configuração atual consultada e validada pelo protocolo do dispositivo. Nenhum ajuste foi aplicado.".into(), read.elapsed().as_millis()));
                snapshot = Some(state);
            }
            Err(error) => checks.push(check(
                "Leitura do protocolo",
                "fail",
                error,
                read.elapsed().as_millis(),
            )),
        }
    } else if let Some(error) = hid.iter().find_map(|d| d.probe_error.as_ref()) {
        checks.push(check(
            "Identificação do protocolo",
            if error.contains("não integrado") || error.contains("não reconhecido") {
                "unavailable"
            } else {
                "fail"
            },
            error.clone(),
            0,
        ));
    } else if !hid.is_empty() || !system.is_empty() {
        checks.push(check("Leitura do protocolo", "unavailable", "Modelo detectado; o protocolo de configuração ainda não foi integrado. O teste não envia comandos desconhecidos.".into(), 0));
    }
    if !audio.is_empty() {
        checks.push(check("Controles de áudio", if audio.iter().all(|e| e.volume.is_some() && e.muted.is_some()) {"pass"} else {"unavailable"}, "Volume e mudo consultados pelo Windows. Não houve reprodução, gravação ou alteração de volume.".into(), 0));
    }
    Ok(Report {
        app_version: env!("CARGO_PKG_VERSION").into(),
        device_id: device_id.into(),
        started_at_ms,
        elapsed_ms: start.elapsed().as_millis(),
        checks,
        hid,
        audio,
        system,
        batteries,
        snapshot,
        discovery_errors: discovery.errors,
    })
}
#[tauri::command]
pub async fn run_hardware_test(
    device_id: String,
    audio_ids: Vec<String>,
) -> Result<Report, String> {
    tauri::async_runtime::spawn_blocking(move || execute(&device_id, &audio_ids))
        .await
        .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    #[test]
    fn read_retry_is_restricted_to_existing_protocol_collections() {
        assert!(super::known_collection(0x046d, 0xc547, 0xff00, 2));
        assert!(super::known_collection(0x258a, 0x010c, 0xff00, 1));
        assert!(super::known_collection(0x3554, 0xfa09, 0xff02, 2));
        assert!(!super::known_collection(0x046d, 0xc339, 0xff00, 2));
        assert!(!super::known_collection(0x046d, 0xc547, 1, 6));
        assert!(!super::known_collection(0x3554, 0xfa09, 0xff00, 2));
    }
    #[test]
    fn rejects_invalid_selection_before_querying_hardware() {
        for id in [String::new(), "x".repeat(257)] {
            assert!(super::execute(&id, &[]).is_err());
        }
        assert!(super::execute("physical-test", &vec!["id".into(); 33]).is_err());
    }
}
