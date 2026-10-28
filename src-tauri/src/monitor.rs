#[cfg(windows)]
mod native {
    use std::{ffi::c_void, sync::Mutex};
    use tauri::Emitter;
    use windows::Win32::Devices::DeviceAndDriverInstallation::*;

    // The OS owns callback execution. The boxed AppHandle stays at a stable address
    // until unregister completes; no HID handles or polling thread are created.
    pub struct Notification {
        registration: HCMNOTIFICATION,
        _context: Box<tauri::AppHandle>,
    }
    unsafe impl Send for Notification {}
    impl Drop for Notification {
        fn drop(&mut self) {
            unsafe {
                CM_Unregister_Notification(self.registration);
            }
        }
    }
    pub struct Monitor {
        _registration: Mutex<Notification>,
    }

    unsafe extern "system" fn changed(
        _: HCMNOTIFICATION,
        context: *const c_void,
        action: CM_NOTIFY_ACTION,
        _: *const CM_NOTIFY_EVENT_DATA,
        _: u32,
    ) -> u32 {
        if action == CM_NOTIFY_ACTION_DEVICEINTERFACEARRIVAL
            || action == CM_NOTIFY_ACTION_DEVICEINTERFACEREMOVAL
        {
            // Never unwind through the Windows callback ABI.
            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                if let Some(app) = unsafe { (context as *const tauri::AppHandle).as_ref() } {
                    let _ = app.emit("hardware-changed", ());
                }
            }));
        }
        0
    }
    pub fn register(app: &tauri::AppHandle) -> Result<Monitor, String> {
        let context = Box::new(app.clone());
        let filter = CM_NOTIFY_FILTER {
            cbSize: std::mem::size_of::<CM_NOTIFY_FILTER>() as u32,
            Flags: CM_NOTIFY_FILTER_FLAG_ALL_INTERFACE_CLASSES,
            FilterType: CM_NOTIFY_FILTER_TYPE_DEVICEINTERFACE,
            ..Default::default()
        };
        let mut registration = HCMNOTIFICATION::default();
        let result = unsafe {
            CM_Register_Notification(
                &filter,
                Some((&*context as *const tauri::AppHandle).cast()),
                Some(changed),
                &mut registration,
            )
        };
        if result != CR_SUCCESS {
            return Err(format!("Notificações PnP indisponíveis: {}", result.0));
        }
        Ok(Monitor {
            _registration: Mutex::new(Notification {
                registration,
                _context: context,
            }),
        })
    }
}

pub fn register(app: &tauri::AppHandle) {
    #[cfg(windows)]
    {
        use tauri::Manager;
        match native::register(app) {
            Ok(monitor) => {
                app.manage(monitor);
            }
            Err(e) => eprintln!("{e}; atualização manual continua disponível."),
        }
    }
}
