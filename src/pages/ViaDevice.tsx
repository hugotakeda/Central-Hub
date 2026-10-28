import { useEffect, useState } from 'react';
import type { HardwareGroup } from '../domain/hardwareGroups';
import { DeviceRail } from '../components/DeviceDetails';
import { DeviceBattery } from '../components/DeviceBattery';
import { basicKeyName, withVia } from '../services/ownVia';
import { protocolExclusive } from '../services/protocols';
import { useGearStore } from '../store/useGearStore';
export default function ViaDevice({group}:{group:HardwareGroup}){
  const via=group.via!,definition=via.definition,notify=useGearStore(s=>s.notify);
  const [layer,setLayer]=useState(0),[layers,setLayers]=useState(via.layers),[version,setVersion]=useState(via.version),[keys,setKeys]=useState<number[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<number|null>(null),[replacement,setReplacement]=useState('4'),[observed,setObserved]=useState(0);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let disposed=false;setBusy(true);setError('');setKeys([]);setSelected(null);
    void protocolExclusive(()=>withVia(via.interface,async c=>{const status=await c.status();if(layer>=status.layers)throw new Error('Esta camada não está mais disponível.');const data=await c.readLayer(layer,status.layers);return {...status,data};})).then(result=>{if(!disposed){setKeys(result.data);setLayers(result.layers);setVersion(result.version);setObserved(Date.now());}}).catch(e=>{if(!disposed)setError(String(e));}).finally(()=>{if(!disposed)setBusy(false);});
    return()=>{disposed=true;};
  },[group.id,via.interface.id,layer,revision]);
  const reload=()=>setRevision(n=>n+1);
  const apply=async()=>{
    if(selected===null||busy)return;setBusy(true);setError('');
    const row=Math.floor(selected/definition.cols),col=selected%definition.cols,code=Number(replacement),expected=keys[selected];
    try{await protocolExclusive(()=>withVia(via.interface,async c=>{const status=await c.status();if(status.version!==version||status.layers!==layers)throw new Error('O firmware mudou; atualize a leitura.');await c.remap(layer,row,col,expected,code,layers);}));setKeys(values=>values.map((v,i)=>i===selected?code:v));setObserved(Date.now());notify('Tecla gravada e confirmada pelo teclado.');}
    catch(e){setError(String(e));notify(String(e),true);}finally{setBusy(false);}
  };
  const choices=[0,1,...Array.from({length:79},(_,i)=>i+4),...Array.from({length:8},(_,i)=>224+i)];
  return <div className="device-workspace"><DeviceRail group={group}/><div className="device-content"><div className="page-title"><div><h1>Teclas e camadas</h1><p>Protocolo próprio Central Hub · VIA {version||'—'}</p></div><button className="button" disabled={busy} onClick={reload}>Atualizar leitura</button></div><section className="surface"><div className="section-title"><h2>Mapa real do teclado</h2><label className="via-layer">Camada<select disabled={busy||!layers} value={layer} onChange={e=>setLayer(+e.target.value)}>{Array.from({length:layers||1},(_,i)=><option key={i} value={i}>{i+1}</option>)}</select></label></div><p className="field-help">Selecione uma tecla para alterar sua função. A posição segue a matriz elétrica desta variante; os códigos são os que o firmware retornou.</p>{error&&<p className="control-error" role="alert">{error}</p>}{busy&&!keys.length&&<p className="empty-state">Lendo a matriz do teclado…</p>}{keys.length>0&&<div className="via-matrix-scroll"><div className="via-matrix" style={{gridTemplateColumns:`repeat(${definition.cols},minmax(32px,1fr))`}}>{Array.from({length:definition.rows*definition.cols},(_,index)=>{
    const row=Math.floor(index/definition.cols),col=index%definition.cols;
    return definition.keys.some(([r,c])=>r===row&&c===col)?<button key={index} className={selected===index?'selected':''} disabled={busy} aria-pressed={selected===index} title={`Linha ${row+1}, coluna ${col+1} · 0x${keys[index].toString(16).padStart(4,'0')}`} onClick={()=>{setSelected(index);setReplacement(String(choices.includes(keys[index])?keys[index]:4));}}>{basicKeyName(keys[index])}</button>:<span key={index}/>;
  })}</div></div>}{observed>0&&<p className="field-help">Lido às {new Date(observed).toLocaleTimeString('pt-BR')} · {layers} camadas · {definition.rows} × {definition.cols} posições.</p>}</section>{selected!==null&&<section className="surface"><h2>Alterar tecla</h2><p className="field-help">Linha {Math.floor(selected/definition.cols)+1}, coluna {selected%definition.cols+1} · Atual: {basicKeyName(keys[selected])}</p><label className="field-label" htmlFor="via-key-function">Nova função HID</label><div className="setting-row"><select id="via-key-function" disabled={busy} value={replacement} onChange={e=>setReplacement(e.target.value)}>{choices.map(code=><option key={code} value={code}>{basicKeyName(code)}</option>)}</select><button className="button primary" disabled={busy||+replacement===keys[selected]} onClick={()=>void apply()}>{busy?'Confirmando…':'Gravar tecla'}</button></div><p className="field-help">A gravação é persistente no teclado. O Central Hub verifica o valor anterior e relê a tecla depois de gravar. Códigos avançados existentes são preservados nas outras posições.</p></section>}<DeviceBattery group={group}/><section className="surface"><h2>Integração</h2><p className="field-help">Keychron V1/V2 e MonsGeek M1 nas variantes USB/VIA documentadas. Esta integração própria usa identificação de versão, leitura das camadas, remapeamento e confirmação por leitura. Cada variante ainda requer validação física local.</p></section></div></div>;
}
