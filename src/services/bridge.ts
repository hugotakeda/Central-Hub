import { invoke, isTauri } from '@tauri-apps/api/core';
import type { HidScan, DeviceSettingsSnapshot, SettingChange, HardwareTestReport } from '../domain/types';
export const desktop = isTauri();
export async function scanHid(): Promise<HidScan> {
  if (!desktop) return { devices: [], audio: [], available: false, error: 'Abra o app desktop para detectar seus dispositivos.' };
  try {
    const scan = await invoke<{ devices: HidScan['devices']; audio: HidScan['audio']; system: HidScan['system']; errors: string[] }>('scan_hardware');
    return { devices: scan.devices, audio: scan.audio, system: scan.system, error: scan.errors.length ? scan.errors.join(' · ') : null, available: true };
  } catch (e) { return { devices: [], audio: [], available: false, error: `Falha na detecção: ${String(e)}` }; }
}
export async function setAudioEndpoint(id: string, volume: number | null, muted: boolean | null): Promise<void> {
  if (!desktop) throw new Error('Controle de áudio disponível somente no app Windows.');
  await invoke('set_audio_endpoint', { id, volume, muted });
}
export async function readDeviceSettings(deviceId: string): Promise<DeviceSettingsSnapshot> {
  if (!desktop) throw new Error('Configuração disponível somente no app Windows.');
  return invoke('read_device_settings', { deviceId });
}
export async function applyDeviceSetting(deviceId: string, revision: string, change: SettingChange): Promise<DeviceSettingsSnapshot> {
  if (!desktop) throw new Error('Configuração disponível somente no app Windows.');
  return invoke('apply_device_setting', { deviceId, revision, change });
}
export async function runHardwareTest(deviceId: string, audioIds: string[]): Promise<HardwareTestReport> {
  if (!desktop) throw new Error('Teste de hardware disponível somente no app Windows.');
  return invoke('run_hardware_test', { deviceId, audioIds });
}
