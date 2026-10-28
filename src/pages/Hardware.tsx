import { useState } from 'react';
import { useGearStore } from '../store/useGearStore';
import { Icon } from '../components/Icon';
export default function Hardware() {
  const scan = useGearStore(s => s.scan), scanning = useGearStore(s => s.scanning), scanHid = useGearStore(s => s.scanHid);
  const [query, setQuery] = useState('');
  const hex = (v: number) => v.toString(16).toUpperCase().padStart(4, '0');
  const items = scan?.devices.filter(d => `${d.product_string ?? ''} ${d.manufacturer ?? ''} ${hex(d.vendor_id)}:${hex(d.product_id)}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  const audio = scan?.audio.filter(e => e.name.toLowerCase().includes(query.toLowerCase())) ?? [];
  return <><div className="page-title"><div><h1>Interfaces</h1><p>Dados expostos pelo Windows</p></div><button className="text-button" onClick={() => void scanHid()} disabled={scanning}><Icon name="refresh" size={13}/>{scanning ? 'Consultando…' : 'Atualizar'}</button></div>
    <input className="filter-input" aria-label="Filtrar interfaces" placeholder="Filtrar nome ou VID:PID" value={query} onChange={e => setQuery(e.target.value)}/>
    {scan?.error && <p role="status" className="discovery-error">{scan.error}</p>}
    {audio.length > 0 && <section className="interfaces-section"><h2>Áudio</h2>{audio.map(e => <div key={e.id} className="interface-audio-row"><span>{e.name}</span><small>{e.direction === 'input' ? 'Entrada' : 'Saída'}</small></div>)}</section>}
    <section className="interfaces-section"><h2>HID <span className="muted">{items.length}</span></h2><div className="table-scroll"><table><thead><tr><th>Nome / fabricante</th><th>VID:PID</th><th>Barramento</th><th>Interface / uso</th></tr></thead><tbody>{items.map(d => <tr key={d.id}><td><strong>{d.product_string || 'Sem nome informado'}</strong><small>{d.manufacturer || 'Fabricante não informado'}</small>{d.identity && <small>{d.identity.name} · {d.identity.model_code}</small>}{d.probe_error && <small>{d.probe_error}</small>}</td><td className="mono">{hex(d.vendor_id)}:{hex(d.product_id)}</td><td>{d.bus}</td><td className="mono">{d.interface_number} · {hex(d.usage_page)}/{hex(d.usage)}</td></tr>)}</tbody></table></div>{!items.length && <p className="field-help">{scanning ? 'Consultando…' : query ? 'Nenhum resultado.' : 'Nenhuma interface HID disponível.'}</p>}</section>
    <p className="field-help">Interfaces não equivalem a aparelhos físicos. Um receptor pode estar presente com o periférico desligado; dispositivos virtuais também podem aparecer.</p>
  </>;
}
