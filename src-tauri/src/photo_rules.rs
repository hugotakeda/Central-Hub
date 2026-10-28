//! Product-name matching and public page metadata. No hardware configuration logic.
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use url::Url;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct PhotoQuery {
    pub name: String,
    pub manufacturer: String,
    pub kind: String,
}
#[derive(Clone, Debug)]
pub struct Candidate {
    pub url: String,
    pub title: String,
    pub score: usize,
}
pub fn words(s: &str) -> Vec<String> {
    s.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .collect()
}
pub fn validate(q: &PhotoQuery) -> Result<(), String> {
    if q.name.trim().is_empty()
        || q.name.len() > 160
        || q.manufacturer.len() > 80
        || ![
            "mouse",
            "keyboard",
            "headset",
            "audio",
            "controller",
            "unknown",
        ]
        .contains(&q.kind.as_str())
    {
        return Err("Informe a marca e o modelo do produto.".into());
    }
    if [&q.name, &q.manufacturer].iter().any(|s| {
        s.chars().any(|c| c.is_control())
            || s.contains(['\\', '/', '@'])
            || s.contains("physical-")
            || s.contains("VID_")
            || s.contains("{0.")
    }) {
        return Err(
            "Use somente o nome público do produto, sem caminhos ou identificadores locais.".into(),
        );
    }
    Ok(())
}
const GENERIC: &[&str] = &[
    "usb",
    "hid",
    "wireless",
    "bluetooth",
    "receiver",
    "receptor",
    "gaming",
    "keyboard",
    "teclado",
    "mouse",
    "device",
    "dispositivo",
    "headset",
    "audio",
    "headphones",
    "speaker",
    "speakers",
    "microfone",
    "microphone",
    "alto",
    "falantes",
    "compatível",
    "com",
    "sem",
    "fio",
    "windows",
    "standard",
    "system",
    "devices",
    "generic",
    "2",
    "4g",
    "2g",
    "inc",
    "ltd",
    "limited",
    "technology",
    "company",
    "controller",
    "control",
    "hub",
];
pub fn model_words(q: &PhotoQuery) -> Vec<String> {
    let brand = words(&q.manufacturer);
    words(&q.name)
        .into_iter()
        .filter(|s| {
            !GENERIC.contains(&s.as_str())
                && !brand.contains(s)
                && ![
                    "logitech",
                    "razer",
                    "nzxt",
                    "hyperx",
                    "steelseries",
                    "corsair",
                    "asus",
                ]
                .contains(&s.as_str())
                && !s.starts_with("usb")
                && !(s.len() == 4 && s.bytes().all(|b| b.is_ascii_hexdigit()))
        })
        .collect()
}
pub fn specific(q: &PhotoQuery) -> bool {
    let w = model_words(q);
    w.iter()
        .any(|s| s.chars().any(|c| c.is_ascii_digit()) && s.chars().any(|c| c.is_alphabetic()))
        || w.iter().any(|s| {
            s.len() >= 4
                && ![
                    "realtek", "logitech", "razer", "nzxt", "hyperx", "msi", "compx",
                ]
                .contains(&s.as_str())
        })
}
pub fn search_text(q: &PhotoQuery) -> String {
    let name = words(&q.name);
    let brand: Vec<_> = words(&q.manufacturer)
        .into_iter()
        .filter(|w| !GENERIC.contains(&w.as_str()))
        .collect();
    if brand.iter().all(|w| name.contains(w)) {
        q.name.trim().into()
    } else {
        format!("{} {}", q.manufacturer.trim(), q.name.trim())
    }
}
pub fn rss_pages(q: &PhotoQuery, xml: &str) -> Vec<Candidate> {
    static ITEMS: OnceLock<Regex> = OnceLock::new();
    static FIELDS: OnceLock<Regex> = OnceLock::new();
    let mut out = vec![];
    for item in ITEMS
        .get_or_init(|| Regex::new(r"(?is)<item\b[^>]*>(.*?)</item>").unwrap())
        .captures_iter(xml)
    {
        let mut title = String::new();
        let mut link = String::new();
        for field in FIELDS
            .get_or_init(|| Regex::new(r"(?is)<(title|link)>(.*?)</(?:title|link)>").unwrap())
            .captures_iter(&item[1])
        {
            if &field[1] == "title" {
                title = unescape(&field[2]);
            } else {
                link = unescape(&field[2]);
            }
        }
        if allowed_url(&link).is_ok()
            && matches_model(q, &title)
            && !link.to_lowercase().contains(".pdf")
        {
            out.push(Candidate {
                url: link,
                title,
                score: 1,
            });
        }
    }
    out.truncate(3);
    out
}
pub fn brand_domain(q: &PhotoQuery) -> Option<&'static str> {
    let name = format!("{} {}", q.manufacturer, q.name).to_lowercase();
    if name.contains("logitech") {
        Some("logitechg.com")
    } else if name.contains("razer") {
        Some("razer.com")
    } else if name.contains("nzxt") {
        Some("nzxt.com")
    } else if name.contains("hyperx") {
        Some("hyperx.com")
    } else if name.contains("steelseries") {
        Some("steelseries.com")
    } else if name.contains("corsair") {
        Some("corsair.com")
    } else if name.contains("asus") {
        Some("asus.com")
    } else {
        None
    }
}
pub fn matches_model(q: &PhotoQuery, text: &str) -> bool {
    let expected = model_words(q);
    let candidate = words(&unescape(text));
    if expected.is_empty() || !expected.iter().all(|w| candidate.contains(w)) {
        return false;
    }
    let original = words(&q.name);
    let variants = [
        "pro", "plus", "mini", "ultra", "max", "dex", "se", "v2", "v3", "v4", "2", "3", "4", "x",
    ];
    let mut end = 0;
    for expected in &expected {
        if let Some(index) = candidate
            .iter()
            .enumerate()
            .skip(end)
            .find_map(|(i, w)| (w == expected).then_some(i))
        {
            end = index + 1;
        }
    }
    let suffix = &candidate[end..candidate.len().min(end + 2)];
    !variants
        .iter()
        .any(|v| suffix.iter().any(|w| w == v) && !original.iter().any(|w| w == v))
}
pub fn allowed_url(raw: &str) -> Result<Url, String> {
    let u = Url::parse(raw).map_err(|_| "Endereço de imagem inválido.")?;
    let host = u.host_str().ok_or("Endereço sem domínio.")?;
    if u.scheme() != "https"
        || u.port().is_some_and(|p| p != 443)
        || !u.username().is_empty()
        || u.password().is_some()
        || !host.contains('.')
        || host.ends_with(".local")
        || host.ends_with(".internal")
        || host.ends_with(".localhost")
        || host.ends_with(".test")
        || host.parse::<std::net::IpAddr>().is_ok()
        || host.contains(':')
        || raw.len() > 4096
    {
        return Err("Somente fontes públicas HTTPS são aceitas.".into());
    }
    Ok(u)
}
pub fn unescape(s: &str) -> String {
    let s = s
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&");
    static NUM: OnceLock<Regex> = OnceLock::new();
    NUM.get_or_init(|| Regex::new(r"&#(x[0-9a-fA-F]+|[0-9]+);").unwrap())
        .replace_all(&s, |cap: &regex::Captures| {
            let v = &cap[1];
            let n = if let Some(h) = v.strip_prefix('x') {
                u32::from_str_radix(h, 16).ok()
            } else {
                v.parse().ok()
            };
            n.and_then(char::from_u32)
                .filter(|c| !c.is_control())
                .map(|c| c.to_string())
                .unwrap_or_default()
        })
        .into_owned()
}
pub fn attrs(tag: &str) -> Vec<(String, String)> {
    static ATTR: OnceLock<Regex> = OnceLock::new();
    ATTR.get_or_init(|| Regex::new(r#"(?is)([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')"#).unwrap())
        .captures_iter(tag)
        .map(|c| {
            (
                c[1].to_lowercase(),
                unescape(c.get(2).or_else(|| c.get(3)).unwrap().as_str()),
            )
        })
        .collect()
}
pub fn page_candidates(q: &PhotoQuery, html: &str, page: &str) -> Vec<Candidate> {
    static TAG: OnceLock<Regex> = OnceLock::new();
    static TITLE: OnceLock<Regex> = OnceLock::new();
    static URLS: OnceLock<Regex> = OnceLock::new();
    let title = TITLE
        .get_or_init(|| Regex::new(r"(?is)<title[^>]*>(.*?)</title>").unwrap())
        .captures(html)
        .map(|c| unescape(&c[1]))
        .unwrap_or_default();
    if !matches_model(q, &title) {
        return vec![];
    }
    let mut results = vec![];
    for tag in TAG
        .get_or_init(|| Regex::new(r"(?is)<(?:meta|img|link)\b[^>]{0,6000}>").unwrap())
        .find_iter(html)
    {
        let a = attrs(tag.as_str());
        let get = |k: &str| {
            a.iter()
                .find(|(key, _)| key == k)
                .map(|(_, v)| v.as_str())
                .unwrap_or("")
        };
        let property = get("property");
        let name = get("name");
        let raw = if property == "og:image" || name == "twitter:image" {
            get("content")
        } else if tag.as_str().to_lowercase().starts_with("<img") {
            let src = get("src");
            if src.is_empty() {
                get("data-src")
            } else {
                src
            }
        } else {
            continue;
        };
        let raw = if raw.starts_with("//") {
            format!("https:{raw}")
        } else if raw.starts_with('/') {
            Url::parse(page)
                .ok()
                .and_then(|u| u.join(raw).ok())
                .map(|u| u.to_string())
                .unwrap_or_default()
        } else {
            raw.to_string()
        };
        add_image(
            &mut results,
            q,
            &raw,
            &title,
            if property == "og:image" || name == "twitter:image" {
                4
            } else {
                1
            },
        );
    }
    // Product galleries often expose better art than their generic social preview.
    for m in URLS
        .get_or_init(|| Regex::new(r#"https://[^\s"'<>\\]{8,2000}"#).unwrap())
        .find_iter(html)
        .take(1200)
    {
        let raw = unescape(m.as_str());
        if raw.to_lowercase().split('?').next().is_some_and(|p| {
            p.ends_with(".png")
                || p.ends_with(".jpg")
                || p.ends_with(".jpeg")
                || p.ends_with(".webp")
        }) {
            if let Some(offset) = raw.find("https%3A").or_else(|| raw.find("https%3a")) {
                let encoded = &raw[offset..];
                if let Ok(wrapped) = Url::parse(&format!("https://unused.invalid/?image={encoded}"))
                {
                    if let Some((_, decoded)) = wrapped.query_pairs().next() {
                        add_image(&mut results, q, &decoded, &title, 3);
                    }
                }
            }
            add_image(&mut results, q, &raw, &title, 2);
        }
    }
    results.sort_by(|a, b| b.score.cmp(&a.score));
    results.dedup_by(|a, b| a.url == b.url);
    results.truncate(8);
    results
}
fn add_image(out: &mut Vec<Candidate>, q: &PhotoQuery, url: &str, title: &str, base: usize) {
    let Ok(u) = allowed_url(url) else {
        return;
    };
    let lower = u.path().to_lowercase();
    if [
        "logo",
        "favicon",
        "sprite",
        "homepage",
        "social",
        "banner",
        "in-the-box",
        "bottom-angle",
    ]
    .iter()
    .any(|s| lower.contains(s))
    {
        return;
    }
    let tokens = words(&lower);
    let matched = model_words(q).iter().filter(|w| tokens.contains(w)).count();
    if matched == 0 && base < 4 {
        return;
    }
    if lower.contains("og-image") && matched < model_words(q).len() {
        return;
    }
    let top =
        if lower.contains("top-angle") || lower.contains("gallery-1") || lower.contains("front") {
            5
        } else {
            0
        };
    let png = if lower.ends_with(".png") { 2 } else { 0 };
    if !out.iter().any(|c| c.url == url) {
        out.push(Candidate {
            url: url.into(),
            title: title.into(),
            score: base + matched * 3 + top + png,
        });
    }
}
pub fn search_pages(q: &PhotoQuery, html: &str) -> Vec<Candidate> {
    static LINKS: OnceLock<Regex> = OnceLock::new();
    static STRIP: OnceLock<Regex> = OnceLock::new();
    let mut out = vec![];
    for c in LINKS
        .get_or_init(|| Regex::new(r"(?is)<a\b([^>]{0,6000})>(.*?)</a>").unwrap())
        .captures_iter(html)
    {
        let a = attrs(&c[1]);
        if !a
            .iter()
            .any(|(k, v)| k == "class" && v.split_whitespace().any(|s| s == "result__a"))
        {
            continue;
        }
        let Some((_, href)) = a.iter().find(|(k, _)| k == "href") else {
            continue;
        };
        let href = if href.starts_with("//") {
            format!("https:{href}")
        } else {
            href.clone()
        };
        let Ok(u) = Url::parse(&href) else {
            continue;
        };
        let url = if u
            .host_str()
            .is_some_and(|h| h == "duckduckgo.com" || h.ends_with(".duckduckgo.com"))
        {
            u.query_pairs()
                .find(|(k, _)| k == "uddg")
                .map(|(_, v)| v.to_string())
                .unwrap_or_default()
        } else {
            href
        };
        if allowed_url(&url).is_err() || url.to_lowercase().contains(".pdf") {
            continue;
        }
        let title = unescape(
            &STRIP
                .get_or_init(|| Regex::new(r"<[^>]*>").unwrap())
                .replace_all(&c[2], " "),
        );
        if !matches_model(q, &format!("{title} {url}")) {
            continue;
        }
        let host = Url::parse(&url)
            .ok()
            .and_then(|u| u.host_str().map(str::to_owned))
            .unwrap_or_default();
        let score = if brand_domain(q).is_some_and(|d| {
            host == d
                || host.ends_with(&format!(".{d}"))
                || d == "logitechg.com" && host.ends_with("logitech.com")
        }) {
            10
        } else {
            1
        };
        out.push(Candidate { url, title, score });
    }
    out.sort_by(|a, b| b.score.cmp(&a.score));
    out.truncate(4);
    out
}
pub fn direct_pages(q: &PhotoQuery) -> Vec<String> {
    let tokens = words(&q.name);
    let mut out = vec![];
    if brand_domain(q) == Some("logitechg.com") {
        let routes = [
            ("g502", "hero", "g502-hero-gaming-mouse"),
            ("g305", "", "g305-lightspeed-wireless-gaming-mouse"),
            ("g703", "hero", "g703-hero-wireless-gaming-mouse"),
            ("master", "3s", "mx-master-3s"),
        ];
        for (a, b, path) in routes {
            if tokens.iter().any(|w| w == a) && (b.is_empty() || tokens.iter().any(|w| w == b)) {
                out.push(format!("https://www.logitechg.com/en-us/shop/p/{path}"));
            }
        }
    }
    if brand_domain(q) == Some("razer.com") {
        let meaningful: Vec<_> = tokens
            .iter()
            .filter(|s| s.as_str() != "razer" && !GENERIC.contains(&s.as_str()))
            .cloned()
            .collect();
        if !meaningful.is_empty() {
            out.push(format!(
                "https://www.razer.com/{}/razer-{}",
                if q.kind == "keyboard" {
                    "gaming-keyboards"
                } else if q.kind == "headset" {
                    "gaming-headsets-and-audio"
                } else {
                    "gaming-mice"
                },
                meaningful.join("-")
            ));
        }
    }
    if brand_domain(q) == Some("steelseries.com") {
        let slug = model_words(q).join("-");
        if !slug.is_empty() {
            out.push(format!(
                "https://steelseries.com/{}/{}",
                if q.kind == "keyboard" {
                    "gaming-keyboards"
                } else if q.kind == "headset" {
                    "gaming-headsets"
                } else {
                    "gaming-mice"
                },
                slug
            ));
        }
    }
    if brand_domain(q) == Some("nzxt.com") {
        let slug = model_words(q).join("-");
        if !slug.is_empty() {
            out.push(format!("https://nzxt.com/products/{slug}"));
        }
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    fn q(name: &str) -> PhotoQuery {
        PhotoQuery {
            name: name.into(),
            manufacturer: "Logitech".into(),
            kind: "mouse".into(),
        }
    }
    #[test]
    fn generic_names_do_not_trigger_arbitrary_image_search() {
        for name in [
            "USB Receiver",
            "Gaming Keyboard",
            "2.4G Wireless Receiver",
            "HID device",
            "Realtek USB Audio",
        ] {
            assert!(!specific(&q(name)), "{name}");
        }
        assert!(specific(&q("G502 HERO")));
    }
    #[test]
    fn rejects_other_generations_and_unrelated_titles() {
        assert!(matches_model(
            &q("G502 HERO"),
            "G502 HERO High Performance Gaming Mouse | Logitech G"
        ));
        assert!(!matches_model(&q("G502 HERO"), "Logitech G502 X PLUS"));
        assert!(!matches_model(
            &q("DeathAdder V3"),
            "Razer DeathAdder V3 Pro"
        ));
    }
    #[test]
    fn marketing_adjectives_before_the_model_are_not_variant_names() {
        assert!(matches_model(
            &q("DeathAdder V3"),
            "Ultra-lightweight Ergonomic Mouse - Razer DeathAdder V3 | Razer"
        ));
        assert!(!specific(&q("Alto-falantes Realtek USB2.0 Audio")));
    }
    #[test]
    fn rss_search_preserves_exact_model_matching() {
        let xml="<rss><item><title>Logitech G502 HERO</title><link>https://www.logitechg.com/g502-hero</link></item><item><title>Logitech G502 X PLUS</title><link>https://www.logitechg.com/g502-x</link></item></rss>";
        let rows = rss_pages(&q("G502 HERO"), xml);
        assert_eq!(rows.len(), 1);
        assert!(rows[0].url.contains("g502-hero"));
    }
    #[test]
    fn only_public_https_urls_are_accepted() {
        for u in [
            "http://example.com/a.png",
            "https://localhost/a.png",
            "https://127.0.0.1/a.png",
            "https://192.168.0.1/a.png",
            "https://a.local/a.png",
            "https://user:pass@example.com/a.png",
            "https://example.com:8443/a.png",
            "file:///a.png",
        ] {
            assert!(allowed_url(u).is_err(), "{u}");
        }
        assert!(allowed_url("https://resource.logitechg.com/image.png").is_ok());
    }
    #[test]
    fn rejects_device_paths_in_queries() {
        let mut query = q("G502 HERO");
        query.name = "HID\\VID_046D".into();
        assert!(validate(&query).is_err());
    }
    #[test]
    fn generic_social_preview_does_not_replace_the_product() {
        let h = r#"<title>G502 HERO Mouse | Logitech G</title><meta content="https://resource.logitechg.com/homepage/logo.png" property="og:image"><img src="https://resource.logitechg.com/g502-hero-top-angle-gallery-1.png">"#;
        let r = page_candidates(&q("G502 HERO"), h, "https://www.logitechg.com/g502-hero");
        assert_eq!(r.len(), 1);
        assert!(r[0].url.contains("gallery-1"));
        assert!(
            page_candidates(&q("G703 HERO"), h, "https://www.logitechg.com/g502-hero").is_empty()
        );
    }
    #[test]
    fn extracts_search_links_and_decodes_entities() {
        let h = r#"<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.logitechg.com%2Fg502-hero&amp;rut=1">G502 HERO &amp; Mouse</a>"#;
        let r = search_pages(&q("G502 HERO"), h);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].url, "https://www.logitechg.com/g502-hero");
    }
}
