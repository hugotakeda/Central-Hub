import { useState } from 'react';
import { useGearStore } from '../store/useGearStore';
import { hardwareGroups, supportsSettings } from '../domain/hardwareGroups';
import { MouseControls, KeyboardControls } from '../components/HardwareControls';
import { AudioControls } from '../components/AudioControls';
import { DeviceRail, DeviceFacts } from '../components/DeviceDetails';
import { useDeviceSettings } from '../components/useDeviceSettings';
import { LocalProfiles } from '../components/LocalProfiles';
import { BatteryHistory } from '../components/BatteryHistory';
import { downloadJson } from '../domain/localData';
import { Icon, type IconName } from '../components/Icon';
import ProtocolDevice from './ProtocolDevice';
import ViaDevice from './ViaDevice';
import { DeviceBattery } from '../components/DeviceBattery';
import { useDevicePreferences } from '../domain/devicePreferences';
import { configurationRoute } from '../domain/protocolRouting';
export default function HardwareDevice() {
  const scan=useGearStore(s=>s.scan),id=useGearStore(s=>s.selectedId);
  useDevicePreferences(s=>s.audioBindings);
  const group=hardwareGroups(scan).find(g=>g.id===id);
  const route=group&&configurationRoute(group);
  return group&&route==='via'?<ViaDevice key={group.id} group={group}/>:group&&route==='upstream'?<ProtocolDevice group={group}/> : <NativeHardwareDevice/>;
}
function NativeHardwareDevice() {
  const scan = useGearStore(s => s.scan), id = useGearStore(s => s.selectedId), readings = useGearStore(s => s.readings);
  const navigate = useGearStore(s => s.navigate), scanHid = useGearStore(s => s.scanHid), scanning = useGearStore(s => s.scanning);
  const group = hardwareGroups(scan).find(g => g.id === id);
  const supported = !!group && supportsSettings(group);
  const controller = useDeviceSettings(id, supported), { snapshot, observedAt, busy, error, reload, apply, applyChanges } = controller;
  const [tab, setTab] = useState<string>(()=>useGearStore.getState().deviceTab);
  const showBattery=useDevicePreferences(s=>s.showBattery),removeAudio=useDevicePreferences(s=>s.removeAudio);
  if (!group) return <div className="empty-state"><p>Este dispositivo não aparece mais na detecção.</p><button className="button" onClick={() => navigate('home')}>Voltar</button></div>;
  const state = snapshot?.settings;
  const tabs: { id: string; label: string; icon: IconName }[] = [{id:'overview',label:'Visão geral',icon:'overview'},{id:'performance',label:group.kind === 'mouse' ? 'Desempenho' : 'Configuração',icon:'speed'},{id:'advanced',label:'Avançado',icon:'settings'},{id:'profiles',label:'Perfis',icon:'profiles'}];
  const metrics: [string, string, string][] = state?.kind === 'mouse' ? [['Sensibilidade', state.dpi.toLocaleString('pt-BR'), 'DPI'],['Taxa de atualização',state.polling_hz?.toLocaleString('pt-BR') ?? '—','Hz'],['Bateria',state.battery_percent === null ? '—' : String(state.battery_percent),'%']] : state?.kind === 'keyboard' ? [['Iluminação',state.effect === 0 ? 'Desligada' : String(state.effect),'efeito'],['Brilho global',state.brightness === null ? 'Misto' : String(state.brightness),'nível'],['Velocidade global',state.speed === null ? 'Mista' : String(state.speed),'nível']] : [['Coleções HID',String(group.hid.length),'interfaces'],['Áudio',String(group.audio.length),'endpoints'],['Acesso',group.virtual ? 'Virtual' : 'Windows','']];
  return <div className="device-workspace"><DeviceRail group={group}/><div className="device-content"><div className="device-toolbar"><div className="device-tabs" role="tablist" aria-label="Configuração do dispositivo">{tabs.map(t => <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={tab===t.id} aria-controls="device-tab-panel" className={tab===t.id?'selected':''} onClick={() => setTab(t.id)}><Icon name={t.icon} size={15}/>{t.label}</button>)}</div><button className="text-button" onClick={() => navigate('test',id)}><Icon name="test" size={15}/>Testar hardware</button></div>
    <div className="reading-toolbar"><span>{busy || scanning ? 'Consultando o dispositivo…' : supported && snapshot ? `Lido às ${new Date(observedAt).toLocaleTimeString('pt-BR')}` : 'Metadados da última consulta ao Windows'}</span><button className="text-button" disabled={busy || scanning} onClick={() => supported ? void reload() : void scanHid()}><Icon name="refresh" size={12}/>Atualizar</button></div>
    {error && <p role="alert" className="control-error">{error}</p>}
    {showBattery&&<DeviceBattery group={group}/>}
    {group.manualAudio&&<section className="surface"><h2>Associação de fone P2</h2><p className="field-help">O modelo foi escolhido por você. Volume e mudo são controlados na saída real do Windows. A disponibilidade do endpoint não confirma a presença física do plugue.</p><button className="text-button" onClick={()=>{removeAudio(group.manualAudio!.outputId);navigate('home');}}>Remover associação</button></section>}
    <section id="device-tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab==='overview' && <><section className="surface"><div className="setting-heading"><h2>Configuração atual</h2><span className="muted">{state ? 'Lida do dispositivo' : 'Dados do Windows'}</span></div><div className="metrics-grid">{metrics.filter(([label])=>showBattery||label!=='Bateria').map(([label,value,unit])=><div key={label}><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>)}</div></section><div className="overview-grid">{showBattery && state?.kind==='mouse' && <BatteryHistory id={id} updatedAt={readings[id]?.at ?? 0}/>}<section className="surface"><h2>Recursos disponíveis</h2><dl className="facts"><div><dt>Configuração do hardware</dt><dd>{supported ? 'Integrada' : 'Ainda não integrada'}</dd></div><div><dt>Áudio Windows</dt><dd>{group.audio.length ? 'Disponível' : 'Não exposto'}</dd></div><div><dt>Firmware</dt><dd>Não disponibilizado nesta integração</dd></div></dl><p className="field-help">A detecção não depende de um driver de configuração específico. Valores que o dispositivo não informou não são estimados.</p></section></div></>}
      {tab==='performance' && <>{state?.kind==='mouse' ? <MouseControls key={snapshot!.revision} state={state} busy={busy || scanning} apply={apply}/> : state?.kind==='keyboard' ? <KeyboardControls key={snapshot!.revision} state={state} busy={busy || scanning} apply={apply}/> : supported ? <section className="surface"><p className="field-help">{busy ? 'Lendo a configuração…' : 'Não foi possível ler os ajustes. Atualize para tentar novamente.'}</p></section> : !group.audio.length && <section className="surface"><h2>Dispositivo detectado</h2><p className="field-help">O protocolo de configuração deste modelo ainda não está integrado. Você pode consultar os detalhes, adicionar uma foto e executar o teste de hardware.</p><button className="button" onClick={() => navigate('test',id)}>Abrir teste de hardware</button></section>}{group.audio.map(endpoint=><section className="surface" key={endpoint.id}><AudioControls endpoint={endpoint}/></section>)}</>}
      {tab==='advanced' && <><section className="surface"><div className="setting-heading"><h2>Detalhes do dispositivo</h2><button className="button small" onClick={() => downloadJson('central-hub-diagnostico.json',{version:'0.0.4',at:new Date().toISOString(),device:group,snapshot})}>Exportar diagnóstico</button></div><DeviceFacts group={group} snapshot={snapshot}/></section>{group.hid.some(d=>d.probe_error) && <section className="surface"><h2>Observações de leitura</h2>{[...new Set(group.hid.map(d=>d.probe_error).filter(Boolean))].map(e=><p className="control-error" key={e}>{e}</p>)}</section>}<p className="field-help">ID local é um hash do Container ID, não um número de série. A presença do receptor USB não confirma o link do periférico sem fio.</p></>}
      {tab==='profiles' && (snapshot && group.model ? <LocalProfiles model={group.model} snapshot={snapshot} busy={busy || scanning} apply={applyChanges}/> : <section className="surface"><h2>Perfis locais</h2><p className="field-help">Perfis ficam disponíveis quando existe uma integração capaz de ler e confirmar os ajustes deste modelo. Nenhum perfil fictício foi criado.</p></section>)}
    </section>
  </div></div>;
}
