//! Internet product photos, bounded cache and provenance. No hardware writes.
use crate::photo_rules as rules;
pub use crate::photo_rules::PhotoQuery;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::{
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
const CACHE_LIMIT: u64 = 32 * 1024 * 1024;
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PhotoResult {
    pub status: String,
    pub query: String,
    pub message: String,
    pub source_url: Option<String>,
    pub image_url: Option<String>,
    pub title: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub checked_at: u64,
    pub cached: bool,
    #[serde(skip_serializing_if = "Option::is_none", skip_deserializing)]
    pub data_url: Option<String>,
}
#[derive(Serialize, Deserialize)]
struct Entry {
    query: PhotoQuery,
    result: PhotoResult,
}
#[derive(Serialize)]
pub struct PhotoSettings {
    pub enabled: bool,
    pub cached_photos: usize,
    pub cache_bytes: u64,
}
pub struct PhotoService {
    root: PathBuf,
    gate: Mutex<()>,
    enabled: AtomicBool,
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn key(q: &PhotoQuery) -> String {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    (
        q.name.to_lowercase(),
        q.manufacturer.to_lowercase(),
        &q.kind,
    )
        .hash(&mut h);
    format!("{:016x}", h.finish())
}
fn named_file(path: &Path) -> bool {
    let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
        return false;
    };
    stem.len() == 16
        && stem.bytes().all(|b| b.is_ascii_hexdigit())
        && path
            .extension()
            .and_then(|s| s.to_str())
            .is_some_and(|s| ["json", "png", "tmp"].contains(&s))
}
fn small_file(path: &Path, limit: u64) -> Option<Vec<u8>> {
    let meta = std::fs::symlink_metadata(path).ok()?;
    if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > limit {
        return None;
    }
    std::fs::read(path).ok()
}
fn result(q: &PhotoQuery, status: &str, message: &str) -> PhotoResult {
    PhotoResult {
        status: status.into(),
        query: rules::search_text(q),
        message: message.into(),
        source_url: None,
        image_url: None,
        title: None,
        width: None,
        height: None,
        checked_at: now(),
        cached: false,
        data_url: None,
    }
}
fn entry(q: &PhotoQuery, r: &PhotoResult) -> Entry {
    let mut r = r.clone();
    r.data_url = None;
    Entry {
        query: q.clone(),
        result: r,
    }
}
impl PhotoService {
    pub fn new(root: PathBuf) -> Self {
        let enabled = small_file(&root.join("preferences.json"), 1024)
            .and_then(|s| serde_json::from_slice::<bool>(&s).ok())
            .unwrap_or(true);
        Self {
            root,
            gate: Mutex::new(()),
            enabled: AtomicBool::new(enabled),
        }
    }
    pub fn settings(&self) -> PhotoSettings {
        let (mut count, mut bytes) = (0, 0);
        if let Ok(dir) = std::fs::read_dir(&self.root) {
            for item in dir.flatten() {
                let path = item.path();
                if named_file(&path) {
                    if let Ok(meta) = std::fs::symlink_metadata(&path) {
                        if meta.is_file() && !meta.file_type().is_symlink() {
                            bytes += meta.len();
                            if path.extension().is_some_and(|e| e == "png") {
                                count += 1;
                            }
                        }
                    }
                }
            }
        }
        PhotoSettings {
            enabled: self.enabled.load(Ordering::Relaxed),
            cached_photos: count,
            cache_bytes: bytes,
        }
    }
    pub fn set_enabled(&self, enabled: bool) -> Result<PhotoSettings, String> {
        std::fs::create_dir_all(&self.root).map_err(|e| e.to_string())?;
        std::fs::write(
            self.root.join("preferences.json"),
            serde_json::to_vec(&enabled).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        self.enabled.store(enabled, Ordering::Relaxed);
        Ok(self.settings())
    }
    fn load(&self, q: &PhotoQuery, force: bool) -> Option<PhotoResult> {
        let k = key(q);
        let cached: Entry =
            serde_json::from_slice(&small_file(&self.root.join(format!("{k}.json")), 16384)?)
                .ok()?;
        if &cached.query != q {
            return None;
        }
        let mut r = cached.result;
        let age = now().saturating_sub(r.checked_at);
        let ttl = if r.status == "ready" {
            30 * 86400
        } else if r.status == "missing" {
            6 * 3600
        } else {
            15 * 60
        };
        if force || age > ttl && r.status != "ready" {
            return None;
        }
        if r.status == "ready" {
            let bytes = small_file(&self.root.join(format!("{k}.png")), 1_500_000)?;
            if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
                return None;
            }
            r.data_url = Some(format!(
                "data:image/png;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(bytes)
            ));
        }
        r.cached = true;
        Some(r)
    }
    fn store(&self, q: &PhotoQuery, r: &PhotoResult) -> Result<(), String> {
        std::fs::write(
            self.root.join(format!("{}.json", key(q))),
            serde_json::to_vec(&entry(q, r)).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())
    }
    fn prune(&self) {
        let Ok(dir) = std::fs::read_dir(&self.root) else {
            return;
        };
        let mut files: Vec<_> = dir
            .flatten()
            .filter_map(|item| {
                let p = item.path();
                let meta = std::fs::symlink_metadata(&p).ok()?;
                if !named_file(&p) || !meta.is_file() || meta.file_type().is_symlink() {
                    return None;
                }
                Some((p, meta.len(), meta.modified().ok()))
            })
            .collect();
        let mut bytes: u64 = files.iter().map(|x| x.1).sum();
        files.sort_by_key(|x| x.2);
        let mut remaining = files.len();
        for (path, size, _) in files {
            if bytes <= CACHE_LIMIT && remaining <= 192 {
                break;
            }
            if std::fs::remove_file(path).is_ok() {
                bytes = bytes.saturating_sub(size);
                remaining -= 1;
            }
        }
    }
    pub fn clear(&self) -> Result<PhotoSettings, String> {
        let _lock = self.gate.lock().map_err(|_| "Cache de fotos ocupado.")?;
        if let Ok(dir) = std::fs::read_dir(&self.root) {
            for item in dir.flatten() {
                let path = item.path();
                if named_file(&path)
                    && std::fs::symlink_metadata(&path)
                        .is_ok_and(|m| m.is_file() && !m.file_type().is_symlink())
                {
                    std::fs::remove_file(path).map_err(|e| e.to_string())?;
                }
            }
        }
        Ok(self.settings())
    }
    pub fn resolve(&self, q: PhotoQuery, force: bool) -> Result<PhotoResult, String> {
        rules::validate(&q)?;
        if !self.enabled.load(Ordering::Relaxed) {
            return Ok(result(
                &q,
                "disabled",
                "Busca de fotos na internet desativada.",
            ));
        }
        if !rules::specific(&q) {
            return Ok(result(
                &q,
                "needs-model",
                "Informe a marca e o modelo para encontrar uma foto correspondente.",
            ));
        }
        if let Some(cached) = self.load(&q, force) {
            return Ok(cached);
        }
        let _lock = self
            .gate
            .lock()
            .map_err(|_| "Busca de fotos indisponível.")?;
        if let Some(cached) = self.load(&q, force) {
            return Ok(cached);
        }
        if !self.enabled.load(Ordering::Relaxed) {
            return Ok(result(
                &q,
                "disabled",
                "Busca de fotos na internet desativada.",
            ));
        }
        std::fs::create_dir_all(&self.root).map_err(|e| e.to_string())?;
        let previous = self.load(&q, false).filter(|r| r.status == "ready");
        let started = Instant::now();
        let mut errors = vec![];
        let mut pages = rules::direct_pages(&q);
        let mut visited = vec![];
        let mut found = None;
        for stage in 0..3 {
            if stage == 1 && found.is_none() && started.elapsed() < Duration::from_secs(20) {
                let mut search = url::Url::parse("https://html.duckduckgo.com/html/").unwrap();
                search
                    .query_pairs_mut()
                    .append_pair("q", &format!("{} product", rules::search_text(&q)));
                match crate::photo_http::get(search.as_str(), 1_000_000) {
                    Ok(html) => {
                        let html = String::from_utf8_lossy(&html);
                        if html.contains("challenge-form") || html.contains("anomaly-modal") {
                            errors.push(
                                "O buscador limitou o acesso. Tente novamente mais tarde.".into(),
                            );
                        } else {
                            pages.extend(rules::search_pages(&q, &html).into_iter().map(|p| p.url));
                        }
                    }
                    Err(e) => errors.push(e),
                }
            }
            if stage == 2 && found.is_none() && started.elapsed() < Duration::from_secs(20) {
                let mut search = url::Url::parse("https://www.bing.com/search").unwrap();
                let text = rules::brand_domain(&q)
                    .map(|d| format!("site:{d} {}", rules::search_text(&q)))
                    .unwrap_or_else(|| rules::search_text(&q));
                search
                    .query_pairs_mut()
                    .append_pair("format", "rss")
                    .append_pair("q", &text);
                match crate::photo_http::get(search.as_str(), 1_000_000) {
                    Ok(xml) => pages.extend(
                        rules::rss_pages(&q, &String::from_utf8_lossy(&xml))
                            .into_iter()
                            .map(|p| p.url),
                    ),
                    Err(e) => errors.push(e),
                }
            }
            for page in &pages {
                if visited.contains(page) {
                    continue;
                }
                visited.push(page.clone());
                if visited.len() > 4
                    || started.elapsed() > Duration::from_secs(24)
                    || !self.enabled.load(Ordering::Relaxed)
                {
                    break;
                }
                let html = match crate::photo_http::get(page, 2_000_000) {
                    Ok(b) => b,
                    Err(e) => {
                        #[cfg(debug_assertions)]
                        eprintln!("Foto: página {page}: {e}");
                        errors.push(e);
                        continue;
                    }
                };
                let candidates = rules::page_candidates(&q, &String::from_utf8_lossy(&html), page);
                for candidate in candidates.into_iter().take(3) {
                    if started.elapsed() > Duration::from_secs(24)
                        || !self.enabled.load(Ordering::Relaxed)
                    {
                        break;
                    }
                    let bytes = match crate::photo_http::get(&candidate.url, 3_000_000) {
                        Ok(b) => b,
                        Err(e) => {
                            #[cfg(debug_assertions)]
                            eprintln!("Foto: imagem {}: {e}", candidate.url);
                            errors.push(e);
                            continue;
                        }
                    };
                    let tmp = self.root.join(format!("{}.tmp", key(&q)));
                    let dims = match crate::photo_http::thumbnail(&bytes, &tmp) {
                        Ok(d) => d,
                        Err(e) => {
                            #[cfg(debug_assertions)]
                            eprintln!("Foto: miniatura {}: {e}", candidate.url);
                            let _ = std::fs::remove_file(&tmp);
                            errors.push(e);
                            continue;
                        }
                    };
                    if !self.enabled.load(Ordering::Relaxed) {
                        let _ = std::fs::remove_file(&tmp);
                        break;
                    }
                    std::fs::rename(tmp, self.root.join(format!("{}.png", key(&q))))
                        .map_err(|e| e.to_string())?;
                    let mut r = result(
                        &q,
                        "ready",
                        "Foto sugerida pela busca online. Confira o modelo e a variante.",
                    );
                    r.source_url = Some(page.clone());
                    r.image_url = Some(candidate.url);
                    r.title = Some(candidate.title);
                    r.width = Some(dims.0);
                    r.height = Some(dims.1);
                    found = Some(r);
                    break;
                }
                if found.is_some() {
                    break;
                }
            }
            if found.is_some() {
                break;
            }
        }
        if !self.enabled.load(Ordering::Relaxed) {
            return Ok(result(
                &q,
                "disabled",
                "Busca de fotos na internet desativada.",
            ));
        }
        if found.is_none() {
            if let Some(mut old) = previous {
                old.cached = true;
                old.message =
                    "A busca não pôde atualizar a foto. A imagem em cache foi preservada.".into();
                return Ok(old);
            }
        }
        let ready = found.is_some();
        let r = found.unwrap_or_else(|| result(&q, if errors.is_empty() { "missing" } else { "unavailable" }, if errors.is_empty() { "Nenhuma foto com correspondência suficiente. Confira o modelo ou escolha uma foto local." } else { errors.last().map(String::as_str).unwrap_or("A busca não está disponível agora.") }));
        self.store(&q, &r)?;
        self.prune();
        if ready {
            self.load(&q, false)
                .map(|mut r| {
                    r.cached = false;
                    r
                })
                .ok_or_else(|| "Não foi possível carregar a foto do cache.".into())
        } else {
            Ok(r)
        }
    }
}
#[tauri::command]
pub async fn resolve_device_photo(
    app: tauri::AppHandle,
    query: PhotoQuery,
    force: bool,
) -> Result<PhotoResult, String> {
    tauri::async_runtime::spawn_blocking(move || app.state::<PhotoService>().resolve(query, force))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn photo_settings(app: tauri::AppHandle) -> PhotoSettings {
    app.state::<PhotoService>().settings()
}
#[tauri::command]
pub fn set_photo_search_enabled(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<PhotoSettings, String> {
    app.state::<PhotoService>().set_enabled(enabled)
}
#[tauri::command]
pub async fn clear_photo_cache(app: tauri::AppHandle) -> Result<PhotoSettings, String> {
    tauri::async_runtime::spawn_blocking(move || app.state::<PhotoService>().clear())
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn open_photo_source(url: String) -> Result<(), String> {
    rules::allowed_url(&url)?;
    #[cfg(windows)]
    {
        use windows::{
            core::PCWSTR,
            Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
        };
        let op: Vec<_> = "open".encode_utf16().chain(Some(0)).collect();
        let target: Vec<_> = url.encode_utf16().chain(Some(0)).collect();
        let opened = unsafe {
            ShellExecuteW(
                None,
                PCWSTR(op.as_ptr()),
                PCWSTR(target.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };
        if opened.0 as isize <= 32 {
            return Err("Não foi possível abrir a fonte no navegador.".into());
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn q() -> PhotoQuery {
        PhotoQuery {
            name: "G502 HERO".into(),
            manufacturer: "Logitech".into(),
            kind: "mouse".into(),
        }
    }
    #[test]
    fn cache_keys_follow_the_product() {
        assert_eq!(key(&q()).len(), 16);
        assert_ne!(
            key(&q()),
            key(&PhotoQuery {
                name: "G703 HERO".into(),
                ..q()
            })
        );
    }
    #[test]
    fn cleanup_only_selects_cache_files() {
        assert!(named_file(Path::new("0123456789abcdef.png")));
        for path in [
            "preferences.json",
            "personal.png",
            "../image.png",
            "0123456789abcdef.exe",
        ] {
            assert!(!named_file(Path::new(path)));
        }
    }
    #[test]
    fn disk_metadata_excludes_image_payload() {
        let mut r = result(&q(), "ready", "Photo");
        r.data_url = Some("data:image/png;base64,test".into());
        assert!(!serde_json::to_string(&entry(&q(), &r))
            .unwrap()
            .contains("data_url"));
    }
    fn temporary_service() -> PhotoService {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        PhotoService::new(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../../work/photo-unit-tests")
                .join(format!("cache-{}-{unique}", std::process::id())),
        )
    }
    #[test]
    fn disabled_search_is_persisted_and_never_creates_an_image() {
        let service = temporary_service();
        service.set_enabled(false).unwrap();
        assert_eq!(service.resolve(q(), false).unwrap().status, "disabled");
        assert!(!PhotoService::new(service.root.clone()).settings().enabled);
        assert_eq!(service.settings().cached_photos, 0);
    }
    #[test]
    fn cache_hit_and_cleanup_preserve_preferences_and_unrelated_files() {
        let service = temporary_service();
        service.set_enabled(true).unwrap();
        let mut photo = result(&q(), "ready", "Cached photo");
        photo.checked_at = 1;
        service.store(&q(), &photo).unwrap();
        std::fs::write(
            service.root.join(format!("{}.png", key(&q()))),
            b"\x89PNG\r\n\x1a\n",
        )
        .unwrap();
        std::fs::write(service.root.join("unrelated.txt"), "keep").unwrap();
        let found = service.resolve(q(), false).unwrap();
        assert!(found.cached);
        assert!(found
            .data_url
            .unwrap()
            .starts_with("data:image/png;base64,"));
        service.clear().unwrap();
        assert_eq!(service.settings().cached_photos, 0);
        assert!(service.root.join("preferences.json").exists());
        assert!(service.root.join("unrelated.txt").exists());
    }
}
