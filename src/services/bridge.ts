import { invoke, isTauri } from '@tauri-apps/api/core';
import type { HidScan, DeviceSettingsSnapshot, SettingChange, HardwareTestReport } from '../domain/types';
import * as protocols from './protocols';
export const desktop = isTauri();
export async function scanHid(): Promise<HidScan> {
  if (!desktop) return { devices: [], audio: [], available: false, error: 'Abra o app desktop para detectar seus dispositivos.' };
  try {
    return await protocols.protocolExclusive(async()=>{
      const scan = await invoke<{ devices: HidScan['devices']; audio: HidScan['audio']; system: HidScan['system']; errors: string[] }>('scan_hardware');
      const result:HidScan = { devices: scan.devices, audio: scan.audio, system: scan.system, error: scan.errors.length ? scan.errors.join(' · ') : null, available: true };
      try {result.protocols = await protocols.discoverProtocols(result);}
      catch(error){result.error=[result.error,`Protocolos: ${String(error)}`].filter(Boolean).join(' · ');}
      return result;
    });
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
  return protocols.protocolExclusive(async()=>{
    const report=await invoke<HardwareTestReport>('run_hardware_test', { deviceId, audioIds });
    const started=performance.now();
    try{
      const result=await protocols.discoverProtocols({available:true,devices:report.hid,audio:report.audio,system:report.system,error:null},deviceId);
      const device=result.find(p=>p.physicalId===deviceId);
      if(device){report.protocol=device;report.checks.push({name:'Protocolo OpenMouse',status:device.confirmed?'pass':device.catalogOnly?'unavailable':'fail',detail:device.confirmed?`${device.driver} · ${device.name}. Leitura concluída pelo transporte HID nativo; nenhuma alteração de configuração foi solicitada.`:device.catalogOnly?'Modelo reconhecido pelo catálogo; o driver não confirmou uma leitura de estado.':device.error??'Sem resposta válida.',elapsed_ms:Math.round(performance.now()-started)});}
    }catch(error){report.checks.push({name:'Protocolo OpenMouse',status:'unavailable',detail:String(error),elapsed_ms:Math.round(performance.now()-started)});}
    report.elapsed_ms+=Math.round(performance.now()-started);return report;
  });
}
