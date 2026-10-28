//! Optional Windows device battery properties, scoped to present, connected nodes.
//! Values are the driver's last report, not a direct Bluetooth radio measurement.
#[cfg(windows)]
pub fn enumerate() -> Vec<crate::battery::BatteryReading> {
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
    let Ok(raw) = (unsafe {
        SetupDiGetClassDevsW(None, PCWSTR::null(), None, DIGCF_PRESENT | DIGCF_ALLCLASSES)
    }) else {
        return vec![];
    };
    let set = Set(raw);
    let mut out = vec![];
    let property = |info: &SP_DEVINFO_DATA, key: &DEVPROPKEY| -> Option<(DEVPROPTYPE, Vec<u8>)> {
        let mut kind = DEVPROPTYPE::default();
        let mut bytes = [0u8; 128];
        let mut size = 0;
        unsafe {
            SetupDiGetDevicePropertyW(
                set.0,
                info,
                key,
                &mut kind,
                Some(&mut bytes),
                Some(&mut size),
                0,
            )
        }
        .ok()?;
        if size > 128 {
            return None;
        }
        Some((kind, bytes[..size as usize].to_vec()))
    };
    let keys = [
        // Public PKEY_Devices_BatteryLife, then Bluetooth driver's property.
        DEVPROPKEY {
            fmtid: GUID::from_u128(0x49cd1f76_5626_4b17_a4e8_18b4aa1a2213),
            pid: 10,
        },
        DEVPROPKEY {
            fmtid: GUID::from_u128(0x104ea319_6ee2_4701_bd47_8ddbf425bbe5),
            pid: 2,
        },
    ];
    for index in 0..4096 {
        let mut info = SP_DEVINFO_DATA {
            cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
            ..Default::default()
        };
        if unsafe { SetupDiEnumDeviceInfo(set.0, index, &mut info) }.is_err() {
            break;
        }
        let mut status = CM_DEVNODE_STATUS_FLAGS::default();
        let mut problem = CM_PROB::default();
        if unsafe { CM_Get_DevNode_Status(&mut status, &mut problem, info.DevInst, 0) }
            != CR_SUCCESS
            || status.contains(DN_DEVICE_DISCONNECTED)
            || problem.0 != 0
        {
            continue;
        }
        let Some(percent) = keys.iter().find_map(|key| {
            let (t, d) = property(&info, key)?;
            (t == DEVPROP_TYPE_BYTE && d.len() == 1 && d[0] <= 100).then(|| d[0])
        }) else {
            continue;
        };
        let Some((t, d)) = property(&info, &DEVPKEY_Device_ContainerId) else {
            continue;
        };
        if t != DEVPROP_TYPE_GUID || d.len() != 16 {
            continue;
        }
        let Some(id) = crate::metadata::container_hash(
            u32::from_le_bytes(d[..4].try_into().unwrap()),
            u16::from_le_bytes(d[4..6].try_into().unwrap()),
            u16::from_le_bytes(d[6..8].try_into().unwrap()),
            d[8..].try_into().unwrap(),
        ) else {
            continue;
        };
        if out
            .iter()
            .any(|r: &crate::battery::BatteryReading| r.physical_id == id)
        {
            continue;
        }
        let mut reading = super::battery::record(id, "Windows · último valor do driver", None);
        reading.percent = Some(percent);
        out.push(reading);
    }
    out
}
