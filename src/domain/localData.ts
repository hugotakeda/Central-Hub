import type { DeviceSettingsSnapshot, SettingChange } from './types';
const prefix = 'central-hub:v1:';
function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(prefix + key) ?? 'null') ?? fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) { localStorage.setItem(prefix + key, JSON.stringify(value)); }
export interface BatteryPoint { at: number; value: number }
export function batteryHistory(id: string): BatteryPoint[] {
  const data = read<unknown>('battery:' + id, []);
  if (!Array.isArray(data)) return [];
  return data.filter((p): p is BatteryPoint => p && Number.isSafeInteger(p.at) && p.at > Date.now() - 7 * 86400000 && p.at <= Date.now() && Number.isInteger(p.value) && p.value >= 0 && p.value <= 100).slice(-100);
}
export function recordBattery(snapshot: DeviceSettingsSnapshot, at: number) {
  if (snapshot.settings.kind !== 'mouse' || snapshot.settings.battery_percent === null) return;
  const points = batteryHistory(snapshot.device_id);
  const last = points.at(-1), value = snapshot.settings.battery_percent;
  if (!last || last.value !== value || at - last.at >= 60000) {
    try { write('battery:' + snapshot.device_id, [...points, { at, value }].slice(-100)); } catch { /* History is optional; real configuration still works. */ }
  }
}
export interface LocalProfile { id: string; name: string; model: string; created_at: number; settings: DeviceSettingsSnapshot['settings'] }
export function localProfiles(model: string): LocalProfile[] {
  const data = read<unknown>('profiles:' + model, []);
  if (!Array.isArray(data)) return [];
  return data.filter((p): p is LocalProfile => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.length <= 48 && p.model === model && typeof p.created_at === 'number' && ['mouse', 'keyboard'].includes(p.settings?.kind)).slice(0, 20);
}
export function saveProfile(model: string, name: string, snapshot: DeviceSettingsSnapshot) {
  const profiles = localProfiles(model);
  if (profiles.length >= 20) throw new Error('Limite de 20 perfis por modelo.');
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 48) throw new Error('Use um nome de 1 a 48 caracteres.');
  write('profiles:' + model, [...profiles, { id: crypto.randomUUID(), name: trimmed, model, created_at: Date.now(), settings: snapshot.settings }]);
}
export function deleteProfile(model: string, id: string) { write('profiles:' + model, localProfiles(model).filter(p => p.id !== id)); }
export function profileChanges(profile: LocalProfile, current: DeviceSettingsSnapshot['settings']): SettingChange[] {
  const saved = profile.settings;
  if (saved.kind !== current.kind) throw new Error('O perfil pertence a outro tipo de dispositivo.');
  const changes: SettingChange[] = [];
  if (saved.kind === 'mouse' && current.kind === 'mouse') {
    if (current.mode !== 2) throw new Error('Ative o controle por software na aba Desempenho antes de aplicar um perfil.');
    if (!current.dpi_options.includes(saved.dpi) || saved.polling_hz !== null && !current.polling_options.includes(saved.polling_hz)) throw new Error('Este perfil contém valores não anunciados pelo mouse atual.');
    if (saved.dpi !== current.dpi) changes.push({ kind: 'mouse_dpi', dpi: saved.dpi });
    if (saved.polling_hz !== null && saved.polling_hz !== current.polling_hz) changes.push({ kind: 'mouse_polling', polling_hz: saved.polling_hz });
  } else if (saved.kind === 'keyboard' && current.kind === 'keyboard') {
    if (!current.effect_options.includes(saved.effect) || saved.brightness !== null && (!Number.isInteger(saved.brightness) || saved.brightness < 1 || saved.brightness > 9) || saved.speed !== null && (!Number.isInteger(saved.speed) || saved.speed < 0 || saved.speed > 4)) throw new Error('Perfil de iluminação inválido.');
    if (saved.effect !== current.effect) changes.push({ kind: 'keyboard_effect', effect: saved.effect });
    if (saved.brightness !== null && saved.brightness !== current.brightness) changes.push({ kind: 'keyboard_brightness', brightness: saved.brightness });
    if (saved.speed !== null && saved.speed !== current.speed) changes.push({ kind: 'keyboard_speed', speed: saved.speed });
  }
  return changes;
}
export function customPhoto(id: string): string | null {
  const value = read<unknown>('photo:' + id, null);
  return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value) && value.length < 360000 ? value : null;
}
export async function saveCustomPhoto(id: string, file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 256000) throw new Error('Escolha uma foto PNG, JPG ou WebP de até 250 KB.');
  const value = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file); });
  const ids = read<unknown>('photo-index', []);
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('Armazenamento de fotos indisponível.');
  if (!ids.includes(id) && ids.length >= 10) throw new Error('Limite de 10 fotos personalizadas.');
  write('photo:' + id, value);
  if (!ids.includes(id)) {
    try { write('photo-index', [...ids, id]); }
    catch(error) { localStorage.removeItem(prefix + 'photo:' + id); throw error; }
  }
}
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function photoModelName(id: string): string {
  const name = read<unknown>('photo-model:' + id, '');
  return typeof name === 'string' && name.length <= 160 ? name : '';
}
export function savePhotoModelName(id: string, name: string) {
  const value = name.trim(); if (!value || value.length > 160) throw new Error('Informe um modelo de até 160 caracteres.');
  write('photo-model:' + id, value); write('photo-hidden:' + id, false);
}
export function photoHidden(id: string): boolean { return read<unknown>('photo-hidden:' + id, false) === true; }
export function hidePhoto(id: string) { write('photo-hidden:' + id, true); }
export function removeCustomPhoto(id: string) {
  localStorage.removeItem(prefix + 'photo:' + id);
  const ids = read<unknown>('photo-index', []); if (Array.isArray(ids)) write('photo-index', ids.filter(value => value !== id));
}
