//! Native, bounded WebHID transport for the upstream OpenMouse protocol clients.
//! No driver commands, USB paths or guessed report sizes cross the UI boundary.
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportItem {
    pub report_size: u32,
    pub report_count: u32,
}
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub report_id: u8,
    pub items: Vec<ReportItem>,
}
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub usage_page: u16,
    pub usage: u16,
    pub input_reports: Vec<Report>,
    pub output_reports: Vec<Report>,
    pub feature_reports: Vec<Report>,
    pub children: Vec<Collection>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Interface {
    pub id: String,
    pub physical_id: String,
    pub interface_number: i32,
    pub vendor_id: u16,
    pub product_id: u16,
    pub product_name: String,
    pub collections: Vec<Collection>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputReport {
    pub report_id: u8,
    pub data: Vec<u8>,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub operation: String,
    pub report_id: u8,
    #[serde(default)]
    pub data: Vec<u8>,
}

#[derive(Clone, Default)]
struct Globals {
    page: u16,
    size: u32,
    count: u32,
    id: u8,
}
pub fn collections(descriptor: &[u8]) -> Result<Vec<Collection>, String> {
    if descriptor.len() > 16384 {
        return Err("Descritor HID excede o limite.".into());
    }
    let mut roots = vec![];
    let mut stack: Vec<Collection> = vec![];
    let mut g = Globals::default();
    let mut globals = vec![];
    let mut usage: u32 = 0;
    let mut at = 0;
    while at < descriptor.len() {
        let prefix = descriptor[at];
        at += 1;
        if prefix == 0xfe {
            if at + 2 > descriptor.len() {
                return Err("Descritor HID truncado.".into());
            }
            let len = descriptor[at] as usize;
            at += 2 + len;
            if at > descriptor.len() {
                return Err("Item HID longo truncado.".into());
            }
            continue;
        }
        let size = [0, 1, 2, 4][(prefix & 3) as usize];
        if at + size > descriptor.len() {
            return Err("Item HID truncado.".into());
        }
        let value = descriptor[at..at + size]
            .iter()
            .enumerate()
            .fold(0u32, |v, (i, b)| v | ((*b as u32) << (8 * i)));
        at += size;
        let kind = (prefix >> 2) & 3;
        let tag = prefix >> 4;
        match (kind, tag) {
            (1, 0) => g.page = value as u16,
            (1, 7) => g.size = value,
            (1, 8) => {
                if value == 0 || value > 255 {
                    return Err("ID de relatório HID inválido.".into());
                }
                g.id = value as u8;
            }
            (1, 9) => g.count = value,
            (1, 10) => {
                if globals.len() >= 32 {
                    return Err("Pilha HID excedida.".into());
                }
                globals.push(g.clone());
            }
            (1, 11) => g = globals.pop().ok_or("Pilha global HID inválida.")?,
            (2, 0) | (2, 1) => usage = value,
            (0, 10) => {
                if stack.len() >= 32 {
                    return Err("Coleções HID excedidas.".into());
                }
                stack.push(Collection {
                    usage_page: if usage > 65535 {
                        (usage >> 16) as u16
                    } else {
                        g.page
                    },
                    usage: usage as u16,
                    ..Default::default()
                });
            }
            (0, 12) => {
                let c = stack.pop().ok_or("Coleção HID inválida.")?;
                if let Some(parent) = stack.last_mut() {
                    parent.children.push(c);
                } else {
                    roots.push(c);
                }
            }
            (0, 8 | 9 | 11) => {
                if g.size.saturating_mul(g.count) > 65536 {
                    return Err("Relatório HID excede o limite.".into());
                }
                let c = stack
                    .last_mut()
                    .ok_or("Relatório fora de uma coleção HID.")?;
                let reports = match tag {
                    8 => &mut c.input_reports,
                    9 => &mut c.output_reports,
                    _ => &mut c.feature_reports,
                };
                if let Some(r) = reports.iter_mut().find(|r| r.report_id == g.id) {
                    r.items.push(ReportItem {
                        report_size: g.size,
                        report_count: g.count,
                    });
                } else {
                    reports.push(Report {
                        report_id: g.id,
                        items: vec![ReportItem {
                            report_size: g.size,
                            report_count: g.count,
                        }],
                    });
                }
            }
            _ => {}
        }
        if kind == 0 {
            usage = 0;
        }
    }
    if !stack.is_empty() {
        return Err("Coleção HID não encerrada.".into());
    }
    Ok(roots)
}
pub(crate) fn report_len(collections: &[Collection], operation: &str, id: u8) -> Option<usize> {
    fn bits(cs: &[Collection], op: &str, id: u8) -> u64 {
        cs.iter()
            .map(|c| {
                let rs = match op {
                    "send" => &c.output_reports,
                    "feature" | "receive" => &c.feature_reports,
                    _ => &c.input_reports,
                };
                rs.iter()
                    .filter(|r| r.report_id == id)
                    .flat_map(|r| &r.items)
                    .map(|i| i.report_size as u64 * i.report_count as u64)
                    .sum::<u64>()
                    + bits(&c.children, op, id)
            })
            .sum()
    }
    let n = bits(collections, operation, id).div_ceil(8) as usize;
    (n > 0 && n <= 8192).then_some(n)
}
fn validate(cs: &[Collection], r: &Request) -> Result<usize, String> {
    if !["send", "feature", "receive"].contains(&r.operation.as_str()) {
        return Err("Operação HID desconhecida.".into());
    }
    let len = report_len(cs, &r.operation, r.report_id)
        .ok_or("Relatório não declarado pelo dispositivo.")?;
    if r.operation == "receive" {
        if !r.data.is_empty() {
            return Err("Leitura HID não aceita dados.".into());
        }
    } else if r.data.len() > len {
        return Err("Dados excedem o relatório HID declarado.".into());
    }
    Ok(len)
}

#[cfg(all(windows, feature = "hardware-hid"))]
pub mod native {
    use super::*;
    use std::{
        collections::HashMap,
        hash::{Hash, Hasher},
        sync::{mpsc, Arc, Mutex, OnceLock},
        time::Duration,
    };
    type Sink = Arc<dyn Fn(InputReport) -> bool + Send + Sync>;
    enum Command {
        Exchange(Request, mpsc::SyncSender<Result<Vec<u8>, String>>),
        Close(mpsc::SyncSender<()>),
    }
    struct Session {
        tx: mpsc::SyncSender<Command>,
    }
    static SESSIONS: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();
    fn sessions() -> &'static Mutex<HashMap<String, Session>> {
        SESSIONS.get_or_init(Default::default)
    }
    fn key(info: &hidapi::DeviceInfo) -> String {
        let mut h = std::collections::hash_map::DefaultHasher::new();
        info.path().hash(&mut h);
        format!("hid-{:016x}", h.finish())
    }
    fn descriptor(device: &hidapi::HidDevice) -> Result<Vec<Collection>, String> {
        let mut raw = [0u8; 16384];
        let n = device
            .get_report_descriptor(&mut raw)
            .map_err(|e| e.to_string())?;
        collections(&raw[..n])
    }
    fn protected(info: &hidapi::DeviceInfo) -> bool {
        info.usage_page() == 7 || info.usage_page() == 1 && info.usage() == 6
    }
    pub fn inventory(vendor_ids: Vec<u16>) -> Result<Vec<Interface>, String> {
        if vendor_ids.len() > 128 {
            return Err("Catálogo de fornecedores excedido.".into());
        }
        let _guard = crate::hid::DEVICE_IO
            .lock()
            .map_err(|_| "HID indisponível.")?;
        let api = hidapi::HidApi::new().map_err(|e| e.to_string())?;
        let mut out = vec![];
        for info in api
            .device_list()
            .filter(|d| vendor_ids.contains(&d.vendor_id()) && !protected(d))
        {
            let Ok(device) = info.open_device(&api) else {
                continue;
            };
            let Ok(cs) = descriptor(&device) else {
                continue;
            };
            if cs.is_empty() {
                continue;
            }
            let id = key(info);
            let physical_id = crate::metadata::for_interface(&info.path().to_string_lossy())
                .physical_id
                .unwrap_or_else(|| id.clone());
            out.push(Interface {
                id,
                physical_id,
                interface_number: info.interface_number(),
                vendor_id: info.vendor_id(),
                product_id: info.product_id(),
                product_name: info.product_string().unwrap_or_default().into(),
                collections: cs,
            });
        }
        Ok(out)
    }
    pub fn open(id: String, sink: Sink) -> Result<(), String> {
        let mut map = sessions()
            .lock()
            .map_err(|_| "Sessões HID indisponíveis.")?;
        if map.contains_key(&id) {
            return Err("Interface HID já aberta.".into());
        }
        if map.len() >= 8 {
            return Err("Limite de interfaces simultâneas atingido.".into());
        }
        let _guard = crate::hid::DEVICE_IO
            .lock()
            .map_err(|_| "HID indisponível.")?;
        let api = hidapi::HidApi::new().map_err(|e| e.to_string())?;
        let info = api
            .device_list()
            .find(|d| key(d) == id)
            .ok_or("Interface removida; atualize os dispositivos.")?;
        if protected(info) {
            return Err("Coleção de digitação protegida.".into());
        }
        let device = info
            .open_device(&api)
            .map_err(|e| format!("Não foi possível abrir a interface: {e}"))?;
        let cs = descriptor(&device)?;
        let can_read = !(info.usage_page() == 1 && info.usage() == 2)
            && (0..=255).any(|i| report_len(&cs, "input", i).is_some());
        let numbered = (1..=255).any(|i| report_len(&cs, "input", i).is_some());
        let (tx, rx) = mpsc::sync_channel(32);
        std::thread::Builder::new()
            .name("central-hub-hid".into())
            .spawn(move || {
                let mut input = [0u8; 8193];
                loop {
                    match rx.recv_timeout(Duration::from_millis(if can_read { 1 } else { 100 })) {
                        Ok(Command::Close(done)) => {
                            drop(device);
                            let _ = done.send(());
                            break;
                        }
                        Ok(Command::Exchange(r, done)) => {
                            let result = (|| {
                                let len = validate(&cs, &r)?;
                                let mut bytes = vec![0u8; len + 1];
                                bytes[0] = r.report_id;
                                if r.operation == "receive" {
                                    let n = device
                                        .get_feature_report(&mut bytes)
                                        .map_err(|e| e.to_string())?;
                                    bytes.truncate(n);
                                    Ok(bytes)
                                } else {
                                    bytes[1..1 + r.data.len()].copy_from_slice(&r.data);
                                    if r.operation == "feature" {
                                        device
                                            .send_feature_report(&bytes)
                                            .map_err(|e| e.to_string())?;
                                    } else {
                                        let n = device.write(&bytes).map_err(|e| e.to_string())?;
                                        if n != bytes.len() {
                                            return Err("Envio HID incompleto.".into());
                                        }
                                    }
                                    Ok(vec![])
                                }
                            })();
                            let _ = done.send(result);
                        }
                        Err(mpsc::RecvTimeoutError::Disconnected) => break,
                        Err(mpsc::RecvTimeoutError::Timeout) => {}
                    }
                    // Sleep when idle; input is read only while an upstream driver needs replies.
                    if can_read {
                        match device.read_timeout(&mut input, 25) {
                            Ok(n) if n > 0 => {
                                let (report_id, data) = if numbered {
                                    (input[0], input[1..n].to_vec())
                                } else {
                                    (0, input[..n].to_vec())
                                };
                                if report_len(&cs, "input", report_id).is_some()
                                    && !sink(InputReport { report_id, data })
                                {
                                    break;
                                }
                            }
                            Err(_) => break,
                            _ => {}
                        }
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        map.insert(id, Session { tx });
        Ok(())
    }
    pub fn exchange(id: String, request: Request) -> Result<Vec<u8>, String> {
        let tx = sessions()
            .lock()
            .map_err(|_| "HID indisponível.")?
            .get(&id)
            .ok_or("Interface fechada.")?
            .tx
            .clone();
        let (done, rx) = mpsc::sync_channel(1);
        tx.try_send(Command::Exchange(request, done))
            .map_err(|_| "Interface removida ou fila HID ocupada.")?;
        rx.recv_timeout(Duration::from_secs(5))
            .map_err(|_| "Tempo de comunicação HID esgotado.")?
    }
    pub fn close(id: String) -> Result<(), String> {
        let session = sessions()
            .lock()
            .map_err(|_| "HID indisponível.")?
            .remove(&id);
        if let Some(session) = session {
            let (done, rx) = mpsc::sync_channel(1);
            if session.tx.send(Command::Close(done)).is_ok() {
                let _ = rx.recv_timeout(Duration::from_secs(6));
            }
        }
        Ok(())
    }
    pub fn close_all() {
        let ids = sessions()
            .lock()
            .map(|s| s.keys().cloned().collect::<Vec<_>>())
            .unwrap_or_default();
        for id in ids {
            let _ = close(id);
        }
    }
}

#[tauri::command]
pub async fn protocol_inventory(vendor_ids: Vec<u16>) -> Result<Vec<Interface>, String> {
    #[cfg(all(windows, feature = "hardware-hid"))]
    return tauri::async_runtime::spawn_blocking(move || native::inventory(vendor_ids))
        .await
        .map_err(|e| e.to_string())?;
    #[cfg(not(all(windows, feature = "hardware-hid")))]
    {
        let _ = vendor_ids;
        Err("HID nativo indisponível.".into())
    }
}
#[tauri::command]
pub async fn protocol_open(
    id: String,
    reports: tauri::ipc::Channel<InputReport>,
) -> Result<(), String> {
    #[cfg(all(windows, feature = "hardware-hid"))]
    return tauri::async_runtime::spawn_blocking(move || {
        native::open(id, std::sync::Arc::new(move |r| reports.send(r).is_ok()))
    })
    .await
    .map_err(|e| e.to_string())?;
    #[cfg(not(all(windows, feature = "hardware-hid")))]
    {
        let _ = (id, reports);
        Err("HID nativo indisponível.".into())
    }
}
#[tauri::command]
pub async fn protocol_exchange(id: String, request: Request) -> Result<Vec<u8>, String> {
    #[cfg(all(windows, feature = "hardware-hid"))]
    return tauri::async_runtime::spawn_blocking(move || native::exchange(id, request))
        .await
        .map_err(|e| e.to_string())?;
    #[cfg(not(all(windows, feature = "hardware-hid")))]
    {
        let _ = (id, request);
        Err("HID nativo indisponível.".into())
    }
}
#[tauri::command]
pub async fn protocol_close(id: String) -> Result<(), String> {
    #[cfg(all(windows, feature = "hardware-hid"))]
    return tauri::async_runtime::spawn_blocking(move || native::close(id))
        .await
        .map_err(|e| e.to_string())?;
    #[cfg(not(all(windows, feature = "hardware-hid")))]
    {
        let _ = id;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn descriptor_preserves_collections_sizes_and_report_ids() {
        let cs = collections(&[
            0x06, 0x00, 0xff, 0x09, 2, 0xa1, 1, 0x85, 0x10, 0x75, 8, 0x95, 6, 0x81, 2, 0x91, 2,
            0x85, 0x11, 0x95, 19, 0x81, 2, 0x91, 2, 0xc0,
        ])
        .unwrap();
        assert_eq!(cs[0].usage_page, 0xff00);
        assert_eq!(cs[0].usage, 2);
        assert_eq!(report_len(&cs, "send", 0x10), Some(6));
        assert_eq!(report_len(&cs, "input", 0x11), Some(19));
        assert_eq!(report_len(&cs, "feature", 0x11), None);
    }
    #[test]
    fn nested_and_push_pop_descriptors_are_supported() {
        let cs = collections(&[
            0x06, 0x00, 0xff, 0x09, 1, 0xa1, 1, 0x75, 8, 0x95, 2, 0x09, 2, 0xa1, 0, 0xa4, 0x85, 5,
            0x95, 4, 0xb1, 2, 0xb4, 0xb1, 2, 0xc0, 0xc0,
        ])
        .unwrap();
        assert_eq!(cs[0].children.len(), 1);
        assert_eq!(report_len(&cs, "feature", 5), Some(4));
        assert_eq!(report_len(&cs, "feature", 0), Some(2));
    }
    #[test]
    fn malformed_descriptors_and_undeclared_writes_are_rejected() {
        for raw in [
            vec![0x06],
            vec![0xa1, 1],
            vec![0xc0],
            vec![0xb4],
            vec![0xfe, 4, 1, 0],
        ] {
            assert!(collections(&raw).is_err());
        }
        let cs = collections(&[
            0x06, 0x00, 0xff, 0x09, 1, 0xa1, 1, 0x85, 7, 0x75, 8, 0x95, 2, 0xb1, 2, 0xc0,
        ])
        .unwrap();
        assert!(validate(
            &cs,
            &Request {
                operation: "feature".into(),
                report_id: 7,
                data: vec![1, 2, 3]
            }
        )
        .is_err());
        assert!(validate(
            &cs,
            &Request {
                operation: "send".into(),
                report_id: 7,
                data: vec![]
            }
        )
        .is_err());
        assert!(validate(
            &cs,
            &Request {
                operation: "receive".into(),
                report_id: 7,
                data: vec![1]
            }
        )
        .is_err());
        assert_eq!(
            validate(
                &cs,
                &Request {
                    operation: "feature".into(),
                    report_id: 7,
                    data: vec![1]
                }
            )
            .unwrap(),
            2
        );
    }
}
