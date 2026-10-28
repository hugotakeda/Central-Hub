use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct AudioEndpoint {
    pub id: String,
    pub name: String,
    pub direction: String,
    pub volume: Option<u8>,
    pub muted: Option<bool>,
    pub physical_id: Option<String>,
    pub form_factor: Option<String>,
}

#[cfg(windows)]
mod native {
    use super::AudioEndpoint;
    use windows::{
        core::{GUID, PCWSTR, PWSTR},
        Win32::{
            Devices::FunctionDiscovery::{PKEY_Device_ContainerId, PKEY_Device_FriendlyName},
            Media::Audio::{
                eCapture, eRender, Endpoints::IAudioEndpointVolume, IMMDevice, IMMDeviceEnumerator,
                MMDeviceEnumerator, PKEY_AudioEndpoint_FormFactor, DEVICE_STATE_ACTIVE,
            },
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
                StructuredStorage::{
                    PropVariantToGUID, PropVariantToStringAlloc, PropVariantToUInt32,
                },
                CLSCTX_ALL, COINIT_MULTITHREADED, STGM_READ,
            },
        },
    };

    struct Apartment;
    impl Apartment {
        fn enter() -> windows::core::Result<Self> {
            unsafe {
                CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
            }
            Ok(Self)
        }
    }
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }

    // IMMDevice and PropVariantToStringAlloc return CoTaskMem-owned strings.
    struct ComString(PWSTR);
    impl ComString {
        fn text(&self) -> windows::core::Result<String> {
            unsafe { Ok(self.0.to_string()?) }
        }
    }
    impl Drop for ComString {
        fn drop(&mut self) {
            unsafe {
                CoTaskMemFree(Some(self.0 .0.cast()));
            }
        }
    }

    unsafe fn enumerator() -> windows::core::Result<IMMDeviceEnumerator> {
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }
    }
    unsafe fn state(device: &IMMDevice) -> (Option<u8>, Option<bool>) {
        let Ok(control) = (unsafe { device.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) })
        else {
            return (None, None);
        };
        let volume = unsafe { control.GetMasterVolumeLevelScalar() }
            .ok()
            .map(|v| (v * 100.0).round().clamp(0.0, 100.0) as u8);
        let muted = unsafe { control.GetMute() }.ok().map(|v| v.as_bool());
        (volume, muted)
    }

    pub fn enumerate() -> Result<Vec<AudioEndpoint>, String> {
        let _apartment = Apartment::enter().map_err(|e| e.to_string())?;
        unsafe {
            let enumerator = enumerator().map_err(|e| e.to_string())?;
            let mut endpoints = vec![];
            for (flow, direction) in [(eRender, "output"), (eCapture, "input")] {
                let devices = enumerator
                    .EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE)
                    .map_err(|e| e.to_string())?;
                for i in 0..devices.GetCount().map_err(|e| e.to_string())? {
                    // A device can disappear mid-enumeration. Keep all other endpoints.
                    let Ok(device) = devices.Item(i) else {
                        continue;
                    };
                    let Ok(id) = device.GetId() else {
                        continue;
                    };
                    let id = ComString(id).text().map_err(|e| e.to_string())?;
                    let name = (|| -> windows::core::Result<String> {
                        let props = device.OpenPropertyStore(STGM_READ)?;
                        let value = props.GetValue(&PKEY_Device_FriendlyName)?;
                        ComString(PropVariantToStringAlloc(&value)?).text()
                    })()
                    .unwrap_or_else(|_| "Endpoint de áudio sem nome".into());
                    let (volume, muted) = state(&device);
                    let form_factor = (|| -> windows::core::Result<String> {
                        let props = device.OpenPropertyStore(STGM_READ)?;
                        let value = props.GetValue(&PKEY_AudioEndpoint_FormFactor)?;
                        Ok(match PropVariantToUInt32(&value)? {
                            0 => "network",
                            1 => "speakers",
                            2 => "line",
                            3 => "headphones",
                            4 => "microphone",
                            5 => "headset",
                            6 => "handset",
                            7 => "digital",
                            8 => "spdif",
                            9 => "display",
                            _ => "unknown",
                        }
                        .into())
                    })()
                    .ok();
                    let physical_id = (|| -> windows::core::Result<Option<String>> {
                        let props = device.OpenPropertyStore(STGM_READ)?;
                        let value = props.GetValue(&PKEY_Device_ContainerId)?;
                        let guid = PropVariantToGUID(&value)?;
                        Ok(crate::metadata::container_hash(
                            guid.data1, guid.data2, guid.data3, guid.data4,
                        ))
                    })()
                    .ok()
                    .flatten();
                    endpoints.push(AudioEndpoint {
                        id,
                        name,
                        direction: direction.into(),
                        volume,
                        muted,
                        physical_id,
                        form_factor,
                    });
                }
            }
            Ok(endpoints)
        }
    }

    pub fn change(id: &str, volume: Option<u8>, muted: Option<bool>) -> Result<(), String> {
        let _apartment = Apartment::enter().map_err(|e| e.to_string())?;
        let wide = id.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        unsafe {
            let device = enumerator()
                .map_err(|e| e.to_string())?
                .GetDevice(PCWSTR(wide.as_ptr()))
                .map_err(|e| e.to_string())?;
            if device.GetState().map_err(|e| e.to_string())? != DEVICE_STATE_ACTIVE {
                return Err("O endpoint não está mais disponível. Atualize a lista.".into());
            }
            let control: IAudioEndpointVolume = device
                .Activate(CLSCTX_ALL, None)
                .map_err(|e| e.to_string())?;
            let context = GUID::zeroed();
            if let Some(v) = volume {
                control
                    .SetMasterVolumeLevelScalar(f32::from(v) / 100.0, &context)
                    .map_err(|e| e.to_string())?;
            }
            if let Some(v) = muted {
                control.SetMute(v, &context).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }
}

pub fn enumerate() -> Result<Vec<AudioEndpoint>, String> {
    #[cfg(windows)]
    {
        native::enumerate()
    }
    #[cfg(not(windows))]
    {
        Err("Áudio Windows indisponível nesta plataforma.".into())
    }
}

#[tauri::command]
pub async fn set_audio_endpoint(
    id: String,
    volume: Option<u8>,
    muted: Option<bool>,
) -> Result<(), String> {
    if id.len() > 2048
        || id.contains('\0')
        || volume.is_some_and(|v| v > 100)
        || (volume.is_none() && muted.is_none())
    {
        return Err("Configuração de áudio inválida.".into());
    }
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(move || native::change(&id, volume, muted))
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(windows))]
    {
        Err("Controle disponível apenas no Windows.".into())
    }
}
