import { useState } from 'react';
import { useGearStore } from '../store/useGearStore';
import { peripheralDevices, illustration, connectionLabel, manufacturer, kindLabel, canConfigure } from '../domain/hardwareGroups';
import { DeviceArt } from '../components/DeviceArt';
import { Icon } from '../components/Icon';
import styles from './Home.module.css';
import { settingsAreReported } from '../domain/reportedSettings';
import { useDevicePreferences } from '../domain/devicePreferences';
import { deviceBattery, batteryLabel } from '../domain/deviceBattery';
export default function Home() {
  const scan = useGearStore(s => s.scan), readings = useGearStore(s => s.readings);
  const scanning = useGearStore(s => s.scanning), scanHid = useGearStore(s => s.scanHid), navigate = useGearStore(s => s.navigate);
  const [filter, setFilter] = useState('all'), [query, setQuery] = useState('');
  const showBattery=useDevicePreferences(s=>s.showBattery);
  useDevicePreferences(s=>s.audioBindings);
  const detected = peripheralDevices(scan);
  const devices = detected.filter(g => (filter === 'all' || g.kind === filter) && `${g.name} ${manufacturer(g)}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="page-title"><div><h1>Dispositivos</h1><p>{scanning ? 'Consultando dispositivos…' : scan?.available ? `${detected.length} dispositivos disponíveis` : 'Detecção indisponível'}</p></div><div className="header-actions"><button className="button" disabled={scanning} onClick={() => void scanHid()}><Icon name="refresh" size={13}/>{scanning ? 'Atualizando…' : 'Atualizar'}</button></div></div>
    <div className={styles.toolbar}><div className="segmented" aria-label="Tipo de dispositivo">{[['all', 'Todos'], ['mouse', 'Mouses'], ['keyboard', 'Teclados'], ['headset', 'Headsets']].map(([id, label]) => <button key={id} className={filter === id ? 'selected' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div><input aria-label="Buscar dispositivo" placeholder="Buscar dispositivo" value={query} onChange={e => setQuery(e.target.value)}/></div>
    {scan?.error && <p role="status" className="discovery-error">{scan.error}</p>}
    <div className={styles.grid}>{devices.map(device => {
      const reading = readings[device.id]?.snapshot.settings, battery=deviceBattery(device,readings[device.id]);
      const mouse = device.protocol?.mouse ? {battery_percent:device.protocol.mouse.batteryPercent,polling_hz:settingsAreReported(device.protocol.mouse)?device.protocol.mouse.pollingRateHz || null:null} : reading?.kind === 'mouse' ? reading : null;
      return <article className={styles.card} key={device.id}>
        <button className={styles.open} onClick={() => navigate('device', device.id)} aria-label={`Abrir ${device.name}`}><div className={styles.heading}><strong>{device.name}</strong><span className="status-badge"><i/>{device.manualAudio?'Áudio disponível':device.virtual ? 'Virtual' : mouse ? 'Conectado' : 'Detectado'}</span></div><small>{manufacturer(device)} · {kindLabel(device.kind)}</small><div className={styles.metrics}><span>{connectionLabel(device)}</span>{showBattery&&battery&&!battery.error&&<span title={battery.source}><Icon name="battery" size={14}/>{batteryLabel(battery)}</span>}{mouse?.polling_hz != null && <span><Icon name="speed" size={14}/>{mouse.polling_hz.toLocaleString('pt-BR')} Hz</span>}</div></button><DeviceArt device={illustration(device)}/>
        <div className={styles.actions}><button className="button primary" onClick={() => navigate('device', device.id, canConfigure(device) ? 'performance' : 'overview')}>{canConfigure(device) ? 'Configurar' : 'Ver dispositivo'}</button><button className="button" onClick={() => navigate('test', device.id)} aria-label={`Testar ${device.name}`} title="Teste de hardware"><Icon name="test" size={16}/></button></div>
      </article>;
    })}</div>
    {!devices.length && <div className="empty-state"><p>{scanning ? 'Consultando…' : query || filter !== 'all' ? 'Nenhum dispositivo neste filtro.' : 'Nenhum dispositivo disponível.'}</p></div>}
    <div className={styles.footer}><button className="text-button" onClick={()=>navigate('catalog')}>Catálogo · 225 modelos</button><button className="text-button" onClick={() => navigate('hardware')}>Ver interfaces do Windows →</button></div>
    <p className="field-help">Receptores genéricos, áudio do sistema e controladores internos ficam em Interfaces. Um periférico sem fio só aparece com sua identidade confirmada pelo dispositivo ou pelo nome do modelo.</p>
  </>;
}
