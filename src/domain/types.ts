export type DeviceKind = 'mouse' | 'headset' | 'keyboard' | 'controller' | 'audio' | 'unknown';
export type ProductModel = 'superlight' | 'f75' | 'cloud-flight' | 'g-pro-tkl';
export interface ModelIdentity { model: ProductModel; name: string; method: string; model_code: string }
export interface DeviceVisual { id: string; kind: DeviceKind; physicalId?: string; photoQuery?: PhotoQuery; virtual?: boolean }
export interface PhotoQuery { name: string; manufacturer: string; kind: DeviceKind }
export interface OnlinePhoto { status: 'ready' | 'needs-model' | 'missing' | 'unavailable' | 'disabled'; query: string; message: string; source_url: string | null; image_url: string | null; title: string | null; data_url?: string; width: number | null; height: number | null; checked_at: number; cached: boolean }
export interface PhotoSettings { enabled: boolean; cached_photos: number; cache_bytes: number }
export interface HidDevice {
  id: string; bus: string; vendor_id: number; product_id: number; product_string: string | null;
  manufacturer: string | null; usage_page: number; usage: number; interface_number: number;
  physical_id?: string; identity?: ModelIdentity | null; probe_error?: string | null;
  driver_version?: string | null; virtual_device?: boolean; identity_cached?: boolean;
}
export interface AudioEndpoint { id: string; name: string; direction: 'input' | 'output'; volume: number | null; muted: boolean | null; physical_id?: string | null }
export interface HidScan { devices: HidDevice[]; audio: AudioEndpoint[]; system?: SystemDevice[]; error: string | null; available: boolean }
export interface SystemDevice { id: string; physical_id: string; name: string; manufacturer: string | null; kind: 'mouse' | 'keyboard'; vendor_id: number | null; product_id: number | null; driver_version: string | null; virtual_device: boolean }
export interface MouseSettings {
  kind: 'mouse'; dpi: number; dpi_options: number[]; polling_hz: number | null; polling_options: number[]; mode: number | null; battery_percent: number | null;
}
export interface KeyboardSettings { kind: 'keyboard'; effect: number; effect_options: number[]; brightness: number | null; speed: number | null; transport?: 'usb' | 'wireless'; brightness_min?: number }
export interface DeviceSettingsSnapshot { device_id: string; revision: string; settings: MouseSettings | KeyboardSettings }
export interface DeviceReading { snapshot: DeviceSettingsSnapshot; at: number }
export interface HardwareTestReport {
  app_version: string; device_id: string; started_at_ms: number; elapsed_ms: number;
  checks: { name: string; status: 'pass' | 'fail' | 'unavailable'; detail: string; elapsed_ms: number }[];
  hid: HidDevice[]; audio: AudioEndpoint[]; system?: SystemDevice[]; snapshot: DeviceSettingsSnapshot | null; discovery_errors: string[];
}
export type SettingChange =
  | { kind: 'mouse_dpi'; dpi: number }
  | { kind: 'mouse_polling'; polling_hz: number }
  | { kind: 'mouse_mode'; mode: number }
  | { kind: 'keyboard_effect'; effect: number }
  | { kind: 'keyboard_brightness'; brightness: number }
  | { kind: 'keyboard_speed'; speed: number };
