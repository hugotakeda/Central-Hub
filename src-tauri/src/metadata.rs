//! Windows metadata without opening protected mouse/keyboard input handles.
use std::hash::{Hash, Hasher};
pub fn container_hash(data1: u32, data2: u16, data3: u16, data4: [u8; 8]) -> Option<String> {
    if (data1, data2, data3, data4) == (0, 0, 0, [0; 8]) {
        return None;
    }
    let mut h = std::collections::hash_map::DefaultHasher::new();
    (data1, data2, data3, data4).hash(&mut h);
    Some(format!("physical-{:016x}", h.finish()))
}
#[derive(Default)]
pub struct Metadata {
    pub physical_id: Option<String>,
    pub name: Option<String>,
    pub driver_version: Option<String>,
    pub virtual_device: bool,
}

#[cfg(windows)]
pub fn for_interface(path: &str) -> Metadata {
    use windows::{
        core::PCWSTR,
        Win32::{
            Devices::{DeviceAndDriverInstallation::*, Properties::*},
            Foundation::DEVPROPKEY,
        },
    };
    fn text(data: &[u8]) -> Option<String> {
        let wide: Vec<u16> = data
            .chunks_exact(2)
            .map(|p| u16::from_le_bytes([p[0], p[1]]))
            .take_while(|v| *v != 0)
            .collect();
        let s = String::from_utf16(&wide).ok()?;
        (!s.trim().is_empty()).then_some(s)
    }
    fn property(node: u32, key: &DEVPROPKEY) -> Option<(DEVPROPTYPE, Vec<u8>)> {
        let mut kind = DEVPROPTYPE::default();
        let mut size = 0;
        if unsafe { CM_Get_DevNode_PropertyW(node, key, &mut kind, None, &mut size, 0) }
            != CR_BUFFER_SMALL
            || size > 16384
        {
            return None;
        }
        let mut data = vec![0u8; size as usize];
        if unsafe {
            CM_Get_DevNode_PropertyW(node, key, &mut kind, Some(data.as_mut_ptr()), &mut size, 0)
        } != CR_SUCCESS
        {
            return None;
        }
        data.truncate(size as usize);
        Some((kind, data))
    }
    fn string(node: u32, key: &DEVPROPKEY) -> Option<String> {
        let (kind, data) = property(node, key)?;
        (kind == DEVPROP_TYPE_STRING).then(|| text(&data)).flatten()
    }
    fn container(node: u32) -> Option<String> {
        let (kind, d) = property(node, &DEVPKEY_Device_ContainerId)?;
        if kind != DEVPROP_TYPE_GUID || d.len() != 16 {
            return None;
        }
        container_hash(
            u32::from_le_bytes(d[..4].try_into().ok()?),
            u16::from_le_bytes(d[4..6].try_into().ok()?),
            u16::from_le_bytes(d[6..8].try_into().ok()?),
            d[8..].try_into().ok()?,
        )
    }
    let path: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();
    let mut kind = DEVPROPTYPE::default();
    let mut bytes = 0;
    if unsafe {
        CM_Get_Device_Interface_PropertyW(
            PCWSTR(path.as_ptr()),
            &DEVPKEY_Device_InstanceId,
            &mut kind,
            None,
            &mut bytes,
            0,
        )
    } != CR_BUFFER_SMALL
        || kind != DEVPROP_TYPE_STRING
        || bytes > 16384
    {
        return Metadata::default();
    }
    let mut instance = vec![0u16; (bytes as usize).div_ceil(2)];
    if unsafe {
        CM_Get_Device_Interface_PropertyW(
            PCWSTR(path.as_ptr()),
            &DEVPKEY_Device_InstanceId,
            &mut kind,
            Some(instance.as_mut_ptr().cast()),
            &mut bytes,
            0,
        )
    } != CR_SUCCESS
    {
        return Metadata::default();
    }
    let mut node = 0;
    if unsafe {
        CM_Locate_DevNodeW(
            &mut node,
            PCWSTR(instance.as_ptr()),
            CM_LOCATE_DEVNODE_NORMAL,
        )
    } != CR_SUCCESS
    {
        return Metadata::default();
    }
    let mut result = Metadata {
        physical_id: container(node),
        ..Default::default()
    };
    result.driver_version = string(node, &DEVPKEY_Device_DriverVersion);
    for _ in 0..5 {
        let id = string(node, &DEVPKEY_Device_InstanceId)
            .unwrap_or_default()
            .to_uppercase();
        result.virtual_device |=
            id.starts_with("LGHUBDEVICE\\") || id.starts_with("ROOT\\") || id.starts_with("SWD\\");
        if let Some(name) = string(node, &DEVPKEY_Device_BusReportedDeviceDesc) {
            result.name = Some(name);
        }
        let mut parent = 0;
        if unsafe { CM_Get_Parent(&mut parent, node, 0) } != CR_SUCCESS
            || container(parent) != result.physical_id
            || result.physical_id.is_none()
        {
            break;
        }
        node = parent;
    }
    result
}
#[cfg(not(windows))]
pub fn for_interface(_: &str) -> Metadata {
    Metadata::default()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn container_ids_are_stable_and_zero_is_rejected() {
        assert_eq!(container_hash(0, 0, 0, [0; 8]), None);
        assert_eq!(
            container_hash(1, 2, 3, [4; 8]),
            container_hash(1, 2, 3, [4; 8])
        );
        assert_ne!(
            container_hash(1, 2, 3, [4; 8]),
            container_hash(2, 2, 3, [4; 8])
        );
    }
}
