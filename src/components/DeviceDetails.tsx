import type { HardwareGroup } from '../domain/hardwareGroups';
import { canConfigure, connectionLabel, hex, illustration, manufacturer, kindLabel } from '../domain/hardwareGroups';
import type { DeviceSettingsSnapshot } from '../domain/types';
import { DeviceArt } from './DeviceArt';
import { useGearStore } from '../store/useGearStore';
export function DeviceRail({ group }: { group: HardwareGroup }) {
  const navigate = useGearStore(s => s.navigate);
  return <aside className="device-rail"><button className="back-button" onClick={() => navigate('home')}>← Dispositivos</button><h1>{group.name}</h1><p className="device-subtitle">{manufacturer(group)} · {kindLabel(group.kind)}</p><span className="status-badge"><i/>{connectionLabel(group)}</span><DeviceArt key={group.id} device={illustration(group)} large editable/><p className="field-help">{canConfigure(group) ? 'Configuração disponível' : 'Detecção e diagnóstico disponíveis'}</p></aside>;
}
export function DeviceFacts({ group, snapshot }: { group: HardwareGroup; snapshot?: DeviceSettingsSnapshot | null }) {
  const identity = group.hid.find(d => d.identity)?.identity, state = snapshot?.settings;
  const unique = (items: (string | null | undefined)[]) => [...new Set(items.filter(Boolean))].join(' / ') || 'Não informado';
  const rows: [string, string][] = [
    ['Fabricante', manufacturer(group)], ['Tipo', kindLabel(group.kind)],
    ['VID / PID', unique([...group.hid, ...(group.system ?? [])].filter(d => d.vendor_id !== null && d.product_id !== null).map(d => `0x${hex(d.vendor_id!)} / 0x${hex(d.product_id!)}`))],
    ['Barramento', unique(group.hid.map(d => d.bus))],
    ['Protocolo integrado', identity?.method ?? (group.audio.length ? 'Windows Core Audio' : 'Windows HID · metadados')],
    ['Versão do driver', unique([...group.hid, ...(group.system ?? [])].map(d => d.driver_version))],
    ['Modelo retornado', identity?.model_code ?? 'Não consultado pelo protocolo'],
    ['Coleções HID', String(group.hid.length)], ['Endpoints de áudio', String(group.audio.length)],
    ['Interfaces PnP de entrada', String(group.system?.length ?? 0)],
    ['Usos HID', unique(group.hid.map(d => `0x${hex(d.usage_page)}:0x${hex(d.usage)}`))],
    ['ID local', group.id], ['Origem da identidade', group.hid.some(d=>d.identity_cached) ? 'Última resposta confirmada nesta sessão; sem resposta atual' : identity ? 'Resposta do dispositivo' : group.identity === 'protocol' ? 'Não confirmada nesta leitura' : group.model ? 'Nome/ID de produto' : 'Metadados do Windows'],
  ];
  if (state?.kind === 'mouse') rows.push(['DPI atual', String(state.dpi)], ['Polling anunciado', state.polling_options.map(n => `${n} Hz`).join(' / ') || 'Não informado'], ['Polling atual', state.polling_hz === null ? 'Não informado' : `${state.polling_hz} Hz`], ['Modo', state.mode === 2 ? 'Software (Host)' : state.mode === 1 ? 'Memória interna' : 'Não informado'], ['Bateria', state.battery_percent === null ? 'Não informada' : `${state.battery_percent}%`]);
  if (state?.kind === 'keyboard') rows.push(['Efeito atual', String(state.effect)], ['Brilho global', state.brightness === null ? 'Níveis diferentes por efeito' : String(state.brightness)], ['Velocidade global', state.speed === null ? 'Níveis diferentes por efeito' : String(state.speed)]);
  return <dl className="device-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
