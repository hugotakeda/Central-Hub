use crate::identity::ModelIdentity;
use serde::Serialize;
pub(crate) static DEVICE_IO: std::sync::Mutex<()> = std::sync::Mutex::new(());
#[derive(Clone, Debug, Serialize)]
pub struct HidDevice {
    pub id: String,
    pub physical_id: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub product_string: Option<String>,
    pub manufacturer: Option<String>,
    pub usage_page: u16,
    pub usage: u16,
    pub interface_number: i32,
    pub bus: String,
    pub identity: Option<ModelIdentity>,
    pub probe_error: Option<String>,
    pub driver_version: Option<String>,
    pub virtual_device: bool,
    pub identity_cached: bool,
}
#[cfg(all(windows, feature = "hardware-hid"))]
#[derive(Default)]
struct WirelessIdentities(std::collections::HashMap<String, ModelIdentity>);
#[cfg(all(windows, feature = "hardware-hid"))]
impl WirelessIdentities {
    fn resolve(
        &mut self,
        key: &str,
        result: &Result<Option<ModelIdentity>, String>,
    ) -> Option<ModelIdentity> {
        match result {
            Ok(Some(identity)) => {
                self.0.insert(key.into(), identity.clone());
                None
            }
            Err(error) if error.starts_with("O teclado não respondeu pelo receptor 2,4 GHz.") => {
                self.0.get(key).cloned()
            }
            _ => {
                self.0.remove(key);
                None
            }
        }
    }
}
#[cfg(all(windows, feature = "hardware-hid"))]
pub fn enumerate() -> Result<Vec<HidDevice>, String> {
    let _guard = DEVICE_IO
        .lock()
        .map_err(|_| "Acesso ao hardware indisponível.")?;
    use std::{
        collections::HashMap,
        hash::{Hash, Hasher},
    };
    fn hash(value: impl Hash) -> String {
        let mut hash = std::collections::hash_map::DefaultHasher::new();
        value.hash(&mut hash);
        format!("{:016x}", hash.finish())
    }
    let api = hidapi::HidApi::new().map_err(|e| e.to_string())?;
    let mut records = vec![];
    let mut identities = HashMap::new();
    let mut candidates = vec![];
    static WIRELESS_IDENTITIES: std::sync::OnceLock<std::sync::Mutex<WirelessIdentities>> =
        std::sync::OnceLock::new();
    let mut wireless_identities = WIRELESS_IDENTITIES
        .get_or_init(Default::default)
        .lock()
        .map_err(|_| "Identidades temporariamente indisponíveis.")?;
    let mut cached_ids = std::collections::HashSet::new();
    for info in api.device_list() {
        let id = format!("hid-{}", hash(info.path()));
        let meta = crate::metadata::for_interface(&info.path().to_string_lossy());
        let relevant = (info.vendor_id() == 0x046d
            && [0xc547, 0xc094].contains(&info.product_id()))
            || (info.vendor_id() == 0x258a && info.product_id() == 0x010c)
            || (info.vendor_id() == 0x3554
                && info.product_id() == 0xfa09
                && info.usage_page() == 0xff02
                && info.usage() == 2);
        let handle = if relevant {
            info.open_device(&api).ok()
        } else {
            None
        };
        let physical_id = meta
            .physical_id
            .or_else(|| {
                handle
                    .as_ref()
                    .and_then(|d| crate::controls::physical_id(d).ok())
            })
            .unwrap_or_else(|| id.clone());
        let logitech = info.vendor_id() == 0x046d
            && [0xc547, 0xc094].contains(&info.product_id())
            && info.usage_page() == 0xff00
            && info.usage() == 2;
        let aula = info.vendor_id() == 0x258a
            && info.product_id() == 0x010c
            && info.usage_page() == 0xff00;
        let aula_wireless = info.vendor_id() == 0x3554
            && info.product_id() == 0xfa09
            && info.usage_page() == 0xff02
            && info.usage() == 2;
        let index = records.len();
        records.push(HidDevice {
            id,
            physical_id,
            vendor_id: info.vendor_id(),
            product_id: info.product_id(),
            product_string: info
                .product_string()
                .filter(|n| !n.trim().is_empty())
                .map(str::to_owned)
                .or(meta.name),
            manufacturer: info.manufacturer_string().map(str::to_owned),
            usage_page: info.usage_page(),
            usage: info.usage(),
            interface_number: info.interface_number(),
            bus: match info.bus_type() {
                hidapi::BusType::Usb => "USB",
                hidapi::BusType::Bluetooth => "Bluetooth",
                hidapi::BusType::I2c => "I²C",
                hidapi::BusType::Spi => "SPI",
                _ => "Não informado",
            }
            .into(),
            identity: None,
            probe_error: None,
            driver_version: meta.driver_version,
            virtual_device: meta.virtual_device,
            identity_cached: false,
        });
        if logitech || aula || aula_wireless {
            if let Some(handle) = handle {
                candidates.push((index, handle, logitech, aula_wireless));
            } else {
                records[index].probe_error =
                    Some("Interface de identificação em uso ou sem acesso.".into());
            }
        }
    }
    wireless_identities.0.retain(|key, _| {
        records
            .iter()
            .any(|d| &d.physical_id == key && d.vendor_id == 0x3554 && d.product_id == 0xfa09)
    });
    for (index, handle, is_logitech, is_aula_wireless) in candidates {
        let key = records[index].physical_id.clone();
        if identities.contains_key(&key) {
            continue;
        }
        let result = if is_logitech {
            crate::identity::logitech(&handle, records[index].product_id == 0xc094).map(Some)
        } else if is_aula_wireless {
            crate::identity::aula_wireless(&handle)
        } else {
            crate::identity::aula(&handle)
        };
        if is_aula_wireless {
            if let Some(identity) = wireless_identities.resolve(&key, &result) {
                identities.insert(key.clone(), identity);
                cached_ids.insert(key.clone());
            }
        }
        match result {
            Ok(Some(identity)) => {
                identities.insert(key, identity);
            }
            Ok(None) => {}
            Err(error) => records[index].probe_error = Some(error),
        }
    }
    for record in &mut records {
        record.identity = identities.get(&record.physical_id).cloned();
        record.identity_cached = cached_ids.contains(&record.physical_id);
    }
    Ok(records)
}
#[cfg(all(test, windows, feature = "hardware-hid"))]
mod tests {
    use super::*;
    #[test]
    fn wireless_cache_requires_real_identity_and_only_survives_silence_on_the_same_receiver() {
        let mut cache = WirelessIdentities::default();
        let silent =
            Err("O teclado não respondeu pelo receptor 2,4 GHz. Pressione uma tecla.".into());
        assert!(cache.resolve("receiver", &silent).is_none());
        let identity = ModelIdentity {
            model: "f75".into(),
            name: "AULA F75".into(),
            method: "Compx".into(),
            model_code: "CD".into(),
        };
        assert!(cache.resolve("receiver", &Ok(Some(identity))).is_none());
        assert_eq!(cache.resolve("receiver", &silent).unwrap().model_code, "CD");
        assert!(cache.resolve("another-receiver", &silent).is_none());
        assert!(cache
            .resolve(
                "receiver",
                &Err("Modelo 2,4 GHz não integrado: 0xA4.".into())
            )
            .is_none());
        assert!(cache.resolve("receiver", &silent).is_none());
    }
}
#[cfg(not(all(windows, feature = "hardware-hid")))]
pub fn enumerate() -> Result<Vec<HidDevice>, String> {
    Err("Enumeração HID desativada neste build.".into())
}
