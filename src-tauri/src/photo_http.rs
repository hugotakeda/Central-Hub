//! Small Windows-native HTTPS client and thumbnail encoder; no browser, cookies or shell process.
use std::path::Path;
#[cfg(windows)]
pub fn get(raw: &str, limit: usize) -> Result<Vec<u8>, String> {
    use std::{
        ffi::c_void,
        net::{IpAddr, ToSocketAddrs},
        time::{Duration, Instant},
    };
    use windows::{core::PCWSTR, Win32::Networking::WinHttp::*};
    struct Handle(*mut c_void);
    impl Drop for Handle {
        fn drop(&mut self) {
            let _ = unsafe { WinHttpCloseHandle(self.0) };
        }
    }
    fn handle(p: *mut c_void) -> Result<Handle, String> {
        if p.is_null() {
            Err(windows::core::Error::from_thread().to_string())
        } else {
            Ok(Handle(p))
        }
    }
    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }
    fn is_public(ip: IpAddr) -> bool {
        match ip {
            IpAddr::V4(v) => {
                !v.is_private()
                    && !v.is_loopback()
                    && !v.is_link_local()
                    && !v.is_unspecified()
                    && !v.is_broadcast()
                    && !v.is_documentation()
                    && !v.is_multicast()
                    && v.octets()[0] != 0
                    && !(v.octets()[0] == 100 && (64..=127).contains(&v.octets()[1]))
            }
            IpAddr::V6(v) => {
                !v.is_loopback()
                    && !v.is_unspecified()
                    && !v.is_multicast()
                    && (v.segments()[0] & 0xfe00) != 0xfc00
                    && (v.segments()[0] & 0xffc0) != 0xfe80
                    && v.to_ipv4_mapped().is_none_or(|v| is_public(IpAddr::V4(v)))
            }
        }
    }
    fn header(h: *mut c_void, field: u32) -> Option<String> {
        let mut data = [0u16; 4096];
        let mut bytes = (data.len() * 2) as u32;
        let mut index = 0;
        unsafe {
            WinHttpQueryHeaders(
                h,
                field,
                PCWSTR::null(),
                Some(data.as_mut_ptr().cast()),
                &mut bytes,
                &mut index,
            )
        }
        .ok()?;
        Some(String::from_utf16_lossy(
            &data[..data.iter().position(|c| *c == 0).unwrap_or(data.len())],
        ))
    }
    let started = Instant::now();
    let mut url = crate::photo_rules::allowed_url(raw)?;
    let agent = wide("CentralHub/0.9 (product-photo lookup)");
    let session = handle(unsafe {
        WinHttpOpen(
            PCWSTR(agent.as_ptr()),
            WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
            PCWSTR::null(),
            PCWSTR::null(),
            0,
        )
    })?;
    unsafe { WinHttpSetTimeouts(session.0, 2000, 3000, 3000, 4000) }.map_err(|e| e.to_string())?;
    for _ in 0..4 {
        if started.elapsed() > Duration::from_secs(12) {
            return Err("A fonte demorou para responder.".into());
        }
        let host = url.host_str().ok_or("Domínio inválido.")?;
        let addresses: Vec<_> = (host, 443)
            .to_socket_addrs()
            .map_err(|_| "Não foi possível consultar a fonte na internet.")?
            .collect();
        if addresses.is_empty() || addresses.iter().any(|a| !is_public(a.ip())) {
            return Err("A fonte não é um endereço público.".into());
        }
        let host_w = wide(host);
        let connection =
            handle(unsafe { WinHttpConnect(session.0, PCWSTR(host_w.as_ptr()), 443, 0) })?;
        let verb = wide("GET");
        let target = wide(&format!(
            "{}{}",
            url.path(),
            url.query().map(|s| format!("?{s}")).unwrap_or_default()
        ));
        let request = handle(unsafe {
            WinHttpOpenRequest(
                connection.0,
                PCWSTR(verb.as_ptr()),
                PCWSTR(target.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                std::ptr::null(),
                WINHTTP_FLAG_SECURE,
            )
        })?;
        let disabled =
            WINHTTP_DISABLE_REDIRECTS | WINHTTP_DISABLE_COOKIES | WINHTTP_DISABLE_AUTHENTICATION;
        unsafe {
            WinHttpSetOption(
                Some(request.0),
                WINHTTP_OPTION_DISABLE_FEATURE,
                Some(&disabled.to_ne_bytes()),
            )
        }
        .map_err(|e| e.to_string())?;
        let headers=wide("Accept: text/html,application/json,image/png,image/jpeg,image/webp;q=0.9,*/*;q=0.5\r\nAccept-Language: en-US,en;q=0.8\r\n");
        unsafe {
            WinHttpSendRequest(
                request.0,
                Some(&headers[..headers.len() - 1]),
                None,
                0,
                0,
                0,
            )
        }
        .map_err(|_| "Não foi possível acessar a fonte de fotos.")?;
        unsafe { WinHttpReceiveResponse(request.0, std::ptr::null_mut()) }
            .map_err(|_| "A fonte de fotos não respondeu.")?;
        let mut status = 0u32;
        let mut len = 4;
        let mut index = 0;
        unsafe {
            WinHttpQueryHeaders(
                request.0,
                WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                PCWSTR::null(),
                Some((&mut status as *mut u32).cast()),
                &mut len,
                &mut index,
            )
        }
        .map_err(|e| e.to_string())?;
        if [301, 302, 303, 307, 308].contains(&status) {
            let location = header(request.0, WINHTTP_QUERY_LOCATION)
                .ok_or("Redirecionamento sem endereço.")?;
            url = crate::photo_rules::allowed_url(
                url.join(&location)
                    .map_err(|_| "Redirecionamento inválido.")?
                    .as_str(),
            )?;
            continue;
        }
        if status == 403 || status == 429 {
            return Err("A fonte limitou o acesso. Tente novamente mais tarde.".into());
        }
        if status != 200 {
            return Err(if status == 404 {
                "A página do produto ou da foto não foi encontrada."
            } else {
                "A fonte de fotos está indisponível agora. Tente novamente mais tarde."
            }
            .into());
        }
        if header(request.0, WINHTTP_QUERY_CONTENT_LENGTH)
            .and_then(|v| v.parse::<usize>().ok())
            .is_some_and(|size| size > limit)
        {
            return Err("Arquivo maior que o limite de download.".into());
        }
        let mut bytes = vec![];
        loop {
            if started.elapsed() > Duration::from_secs(12) {
                return Err("Download excedeu o tempo limite.".into());
            }
            let mut chunk = [0u8; 16384];
            let mut n = 0;
            unsafe {
                WinHttpReadData(
                    request.0,
                    chunk.as_mut_ptr().cast(),
                    chunk.len() as u32,
                    &mut n,
                )
            }
            .map_err(|_| "Falha ao receber a foto.")?;
            if n == 0 {
                break;
            }
            if bytes.len() + n as usize > limit {
                return Err("Arquivo maior que o limite de download.".into());
            }
            bytes.extend_from_slice(&chunk[..n as usize]);
        }
        return Ok(bytes);
    }
    Err("A fonte redirecionou muitas vezes.".into())
}
#[cfg(not(windows))]
pub fn get(_: &str, _: usize) -> Result<Vec<u8>, String> {
    Err("Busca de fotos disponível no Windows.".into())
}

pub fn raster(bytes: &[u8]) -> bool {
    bytes.starts_with(b"\x89PNG\r\n\x1a\n")
        || bytes.starts_with(&[0xff, 0xd8, 0xff])
        || (bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP"))
}
#[cfg(windows)]
pub fn thumbnail(bytes: &[u8], path: &Path) -> Result<(u32, u32), String> {
    use windows::{
        core::PCWSTR,
        Win32::{
            Foundation::GENERIC_WRITE,
            Graphics::Imaging::*,
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
                COINIT_MULTITHREADED,
            },
        },
    };
    if !raster(bytes) {
        return Err("A fonte não retornou uma foto PNG, JPG ou WebP válida.".into());
    }
    struct Apartment;
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe { CoUninitialize() };
        }
    }
    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }
        .ok()
        .map_err(|e| e.to_string())?;
    let _apt = Apartment;
    let dims = (|| -> windows::core::Result<(u32, u32)> {
        unsafe {
            let factory: IWICImagingFactory =
                CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?;
            let stream = factory.CreateStream()?;
            stream.InitializeFromMemory(bytes)?;
            let decoder = factory.CreateDecoderFromStream(
                &stream,
                std::ptr::null(),
                WICDecodeMetadataCacheOnDemand,
            )?;
            let frame = decoder.GetFrame(0)?;
            let (mut w, mut h) = (0, 0);
            frame.GetSize(&mut w, &mut h)?;
            if w < 32 || h < 32 || w > 8192 || h > 8192 || u64::from(w) * u64::from(h) > 16_000_000
            {
                return Err(windows::core::Error::new(
                    windows::core::HRESULT(0x80070057u32 as i32),
                    "Dimensões da imagem fora do limite.",
                ));
            }
            let scale = (512f64 / w.max(h) as f64).min(1.0);
            let tw = (w as f64 * scale).round().max(1.0) as u32;
            let th = (h as f64 * scale).round().max(1.0) as u32;
            let scaler = factory.CreateBitmapScaler()?;
            scaler.Initialize(&frame, tw, th, WICBitmapInterpolationModeFant)?;
            let out = factory.CreateStream()?;
            let filename: Vec<u16> = path
                .as_os_str()
                .to_string_lossy()
                .encode_utf16()
                .chain(Some(0))
                .collect();
            out.InitializeFromFilename(PCWSTR(filename.as_ptr()), GENERIC_WRITE.0)?;
            let encoder = factory.CreateEncoder(&GUID_ContainerFormatPng, std::ptr::null())?;
            encoder.Initialize(&out, WICBitmapEncoderNoCache)?;
            let (mut new_frame, mut props) = (None, None);
            encoder.CreateNewFrame(&mut new_frame, &mut props)?;
            let target = new_frame.ok_or_else(windows::core::Error::from_thread)?;
            target.Initialize(props.as_ref())?;
            target.SetSize(tw, th)?;
            let mut format = GUID_WICPixelFormat32bppBGRA;
            target.SetPixelFormat(&mut format)?;
            let convert = factory.CreateFormatConverter()?;
            convert.Initialize(
                &scaler,
                &format,
                WICBitmapDitherTypeNone,
                None,
                0.0,
                WICBitmapPaletteTypeCustom,
            )?;
            target.WriteSource(&convert, std::ptr::null())?;
            target.Commit()?;
            encoder.Commit()?;
            Ok((tw, th))
        }
    })()
    .map_err(|e| format!("Não foi possível preparar a miniatura: {e}"))?;
    if std::fs::metadata(path).map_err(|e| e.to_string())?.len() > 1_500_000 {
        let _ = std::fs::remove_file(path);
        return Err("A miniatura ultrapassou o limite de cache.".into());
    }
    Ok(dims)
}
#[cfg(not(windows))]
pub fn thumbnail(_: &[u8], _: &Path) -> Result<(u32, u32), String> {
    Err("Miniaturas disponíveis no Windows.".into())
}
#[cfg(test)]
mod tests {
    #[test]
    fn raster_signature_rejects_html_and_svg() {
        assert!(!super::raster(b"<svg xmlns='x'/>"));
        assert!(!super::raster(b"<!doctype html>"));
        assert!(super::raster(b"\x89PNG\r\n\x1a\n"));
        assert!(super::raster(b"RIFFxxxxWEBP"));
    }
}
