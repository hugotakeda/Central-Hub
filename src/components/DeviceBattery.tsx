import type { HardwareGroup } from '../domain/hardwareGroups';
import { batteryLabel, deviceBattery } from '../domain/deviceBattery';
import { useGearStore } from '../store/useGearStore';
import { useDevicePreferences } from '../domain/devicePreferences';
export function DeviceBattery({group}:{group:HardwareGroup}){
  const show=useDevicePreferences(s=>s.showBattery),reading=useGearStore(s=>s.readings[group.id]);
  if(!show)return null;
  const battery=deviceBattery(group,reading);
  return <section className="surface"><div className="setting-heading"><h2>Bateria</h2><strong className="battery-value">{group.catalog?.analog?'Sem bateria':batteryLabel(battery)}</strong></div><p className="field-help">{group.catalog?.analog?'Fone passivo conectado à saída de áudio.':group.manualAudio?'A conexão P2 não oferece telemetria de bateria.':battery?.source??'Este dispositivo não disponibilizou um nível de bateria nesta consulta.'}</p>{battery?.observed_at_ms&&<p className="field-help">Consulta às {new Date(battery.observed_at_ms).toLocaleTimeString('pt-BR')}{battery.source.startsWith('Windows')?' · valor mantido pelo driver do Windows':''}.</p>}{battery?.voltage_mv!==null&&battery?.voltage_mv!==undefined&&battery.percent===null&&<p className="field-help">O protocolo forneceu tensão, sem porcentagem. O Central Hub não converte esse valor por estimativa.</p>}{battery?.error&&<p className="field-help">{battery.error}</p>}</section>;
}
