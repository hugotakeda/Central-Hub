import type { HardwareGroup } from './hardwareGroups';
import type { BatteryReading, DeviceReading } from './types';
const percent=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?Math.round(value):null;
export function deviceBattery(group:HardwareGroup,reading?:DeviceReading):BatteryReading|null {
  if(group.manualAudio)return null;
  const protocol=group.protocol;
  if(protocol?.confirmed){const status=protocol.mouse;const value=status&&percent(status.batteryPercent);if(value!==null&&value!==undefined)return {physical_id:group.id,source:`${protocol.driver} · leitura do dispositivo`,percent:value,voltage_mv:null,charging:null,observed_at_ms:protocol.observedAt,error:null};}
  if(reading?.snapshot.settings.kind==='mouse'){const value=percent(reading.snapshot.settings.battery_percent);if(value!==null)return {physical_id:group.id,source:'Central Hub · HID++',percent:value,voltage_mv:null,charging:null,observed_at_ms:reading.at,error:null};}
  return group.battery??null;
}
export function batteryLabel(battery:BatteryReading|null):string {
  if(!battery||battery.error)return 'Não informada';
  const values=[battery.percent!==null?`${battery.percent}%`:null,battery.voltage_mv!==null?`${battery.voltage_mv} mV`:null,battery.charging===true?'Carregando':battery.charging===false?'Em uso':null].filter(Boolean);
  return values.join(' · ')||'Não informada';
}
