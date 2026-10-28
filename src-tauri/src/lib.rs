mod audio;
#[cfg(all(windows, feature = "hardware-hid"))]
mod aula_wireless;
pub mod controls;
mod discovery;
pub mod hardware_test;
mod hid;
mod identity;
mod metadata;
mod monitor;
mod photo_http;
mod photo_rules;
pub mod photos;
mod pnp;
pub mod protocol_hid;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            monitor::register(app.handle());
            app.manage(photos::PhotoService::new(
                app.path().app_cache_dir()?.join("device-photos-v1"),
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            discovery::scan_hardware,
            audio::set_audio_endpoint,
            controls::read_device_settings,
            controls::apply_device_setting,
            hardware_test::run_hardware_test,
            protocol_hid::protocol_inventory,
            protocol_hid::protocol_open,
            protocol_hid::protocol_exchange,
            protocol_hid::protocol_close,
            photos::resolve_device_photo,
            photos::photo_settings,
            photos::set_photo_search_enabled,
            photos::clear_photo_cache,
            photos::open_photo_source
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o Central Hub");
}

pub fn diagnostics_json() -> Result<String, String> {
    serde_json::to_string_pretty(&discovery::enumerate()).map_err(|e| e.to_string())
}
