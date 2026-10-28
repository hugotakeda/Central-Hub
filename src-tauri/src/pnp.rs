//! Presence-only fallback for keyboards/mice not exposed through HIDAPI (e.g. PS/2).
use serde::Serialize;
#[derive(Clone, Debug, Serialize)]
pub struct SystemDevice {
    pub id: String,
    pub physical_id: String,
    pub name: String,
    pub manufacturer: Option<String>,
    pub kind: String,
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
    pub driver_version: Option<String>,
    pub virtual_device: bool,
}
#[cfg(windows)]
pub fn enumerate() -> Result<Vec<SystemDevice>, String> {
    use std::hash::{Hash, Hasher};
    use windows::{
        core::{GUID, PCWSTR},
        Win32::{
            Devices::{DeviceAndDriverInstallation::*, Properties::*},
            Foundation::DEVPROPKEY,
        },
    };
    struct Set(HDEVINFO);
    impl Drop for Set {
        fn drop(&mut self) {
            let _ = unsafe { SetupDiDestroyDeviceInfoList(self.0) };
        }
    }
    fn property(
        set: HDEVINFO,
        info: &SP_DEVINFO_DATA,
        key: &DEVPROPKEY,
    ) -> Option<(DEVPROPTYPE, Vec<u8>)> {
        let mut kind = DEVPROPTYPE::default();
        let mut required = 0;
        let mut data = vec![0; 8192];
        unsafe {
            SetupDiGetDevicePropertyW(
                set,
                info,
                key,
                &mut kind,
                Some(&mut data),
                Some(&mut required),
                0,
            )
        }
        .ok()?;
        data.truncate(required as usize);
        Some((kind, data))
    }
    fn text(set: HDEVINFO, info: &SP_DEVINFO_DATA, key: &DEVPROPKEY) -> Option<String> {
        let (kind, data) = property(set, info, key)?;
        if kind != DEVPROP_TYPE_STRING {
            return None;
        }
        let words: Vec<_> = data
            .chunks_exact(2)
            .map(|p| u16::from_le_bytes([p[0], p[1]]))
            .take_while(|v| *v != 0)
            .collect();
        let value = String::from_utf16(&words).ok()?;
        (!value.trim().is_empty()).then_some(value)
    }
    fn number(id: &str, tag: &str) -> Option<u16> {
        let offset = id.find(tag)? + tag.len();
        u16::from_str_radix(id.get(offset..offset + 4)?, 16).ok()
    }
    let mut devices = vec![];
    for (class, kind) in [
        (
            GUID::from_u128(0x4d36e96b_e325_11ce_bfc1_08002be10318),
            "keyboard",
        ),
        (
            GUID::from_u128(0x4d36e96f_e325_11ce_bfc1_08002be10318),
            "mouse",
        ),
    ] {
        let set =
            Set(
                unsafe { SetupDiGetClassDevsW(Some(&class), PCWSTR::null(), None, DIGCF_PRESENT) }
                    .map_err(|e| e.to_string())?,
            );
        for index in 0..4096 {
            let mut info = SP_DEVINFO_DATA {
                cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
                ..Default::default()
            };
            if unsafe { SetupDiEnumDeviceInfo(set.0, index, &mut info) }.is_err() {
                break;
            }
            let mut instance = [0u16; 1024];
            if unsafe { SetupDiGetDeviceInstanceIdW(set.0, &info, Some(&mut instance), None) }
                .is_err()
            {
                continue;
            }
            let instance = String::from_utf16_lossy(
                &instance[..instance
                    .iter()
                    .position(|v| *v == 0)
                    .unwrap_or(instance.len())],
            )
            .to_uppercase();
            let mut hash = std::collections::hash_map::DefaultHasher::new();
            instance.hash(&mut hash);
            let id = format!("pnp-{:016x}", hash.finish());
            let physical_id = property(set.0, &info, &DEVPKEY_Device_ContainerId)
                .and_then(|(t, d)| {
                    if t != DEVPROP_TYPE_GUID || d.len() != 16 {
                        return None;
                    }
                    crate::metadata::container_hash(
                        u32::from_le_bytes(d[..4].try_into().ok()?),
                        u16::from_le_bytes(d[4..6].try_into().ok()?),
                        u16::from_le_bytes(d[6..8].try_into().ok()?),
                        d[8..].try_into().ok()?,
                    )
                })
                .unwrap_or_else(|| id.clone());
            let (vendor_id, product_id) = (number(&instance, "VID_"), number(&instance, "PID_"));
            devices.push(SystemDevice {
                id,
                physical_id,
                name: text(set.0, &info, &DEVPKEY_Device_BusReportedDeviceDesc)
                    .or_else(|| text(set.0, &info, &DEVPKEY_Device_FriendlyName))
                    .or_else(|| text(set.0, &info, &DEVPKEY_Device_DeviceDesc))
                    .unwrap_or_else(|| format!("{kind} Windows")),
                manufacturer: text(set.0, &info, &DEVPKEY_Device_Manufacturer),
                kind: kind.into(),
                vendor_id,
                product_id,
                driver_version: text(set.0, &info, &DEVPKEY_Device_DriverVersion),
                virtual_device: instance.starts_with("ROOT\\")
                    || vendor_id == Some(0x046d) && product_id == Some(0xc232),
            });
        }
    }
    Ok(devices)
}
#[cfg(not(windows))]
pub fn enumerate() -> Result<Vec<SystemDevice>, String> {
    Ok(vec![])
}
