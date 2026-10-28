import { useEffect, useRef, useState } from 'react';
import { useGearStore } from '../store/useGearStore';
import { peripheralDevices } from '../domain/hardwareGroups';
import type { HardwareTestReport } from '../domain/types';
import { runHardwareTest } from '../services/bridge';
import { DeviceRail, DeviceFacts } from '../components/DeviceDetails';
import { downloadJson } from '../domain/localData';
import { Icon } from '../components/Icon';
function InputTest() {
  const [active,setActive]=useState(false),[events,setEvents]=useState<string[]>([]),[count,setCount]=useState(0);
  const zone=useRef<HTMLDivElement>(null);
  const record=(label:string)=>{setCount(n=>n+1);setEvents(list=>[...list.filter(s=>s!==label),label].slice(-60));};
  return <section className="surface"><div className="setting-heading"><h2>Teste manual de entrada</h2><button className="button" onPointerDown={e=>{if(active)e.preventDefault();}} onClick={()=>{setActive(a=>!a);zone.current?.focus();}}>{active?'Encerrar':'Testar teclas e cliques'}</button></div><p className="field-help">Use a área abaixo. Só recebe eventos enquanto ela está em foco. O Windows não informa ao navegador qual periférico gerou cada evento; isole o aparelho que deseja testar. Tab ou Esc encerra a captura. Nenhum evento é salvo ou enviado.</p><div ref={zone} tabIndex={0} className={`input-test-zone ${active?'active':''}`} aria-label="Área de teste de teclado e mouse" onBlur={()=>setActive(false)} onKeyDown={e=>{if(!active)return;if(e.key==='Escape'||e.key==='Tab'){setActive(false);return;}e.preventDefault();if(!e.repeat)record(e.code||'Tecla sem código');}} onPointerDown={e=>{if(active){e.preventDefault();record(['Clique esquerdo','Clique do meio','Clique direito','Botão 4','Botão 5'][e.button]??`Botão ${e.button}`);}}} onContextMenu={e=>{if(active)e.preventDefault();}} onWheel={e=>{if(active)record(e.deltaY>0?'Scroll ↓':'Scroll ↑');}}><p>{active?'Pressione teclas ou clique nesta área.':'Inicie o teste para receber eventos.'}</p><div className="input-events">{events.map(event=><kbd key={event}>{event}</kbd>)}</div></div><div className="setting-footer"><span className="muted">{count} eventos recebidos nesta sessão</span><button className="text-button" onClick={()=>{setEvents([]);setCount(0);}}>Limpar</button></div></section>;
}
export default function HardwareTest() {
  const scan=useGearStore(s=>s.scan),id=useGearStore(s=>s.selectedId),navigate=useGearStore(s=>s.navigate);
  const groups=peripheralDevices(scan),group=groups.find(g=>g.id===id)??groups[0];
  const [report,setReport]=useState<HardwareTestReport|null>(null),[running,setRunning]=useState(false),[error,setError]=useState('');
  const generation=useRef(0),locked=useRef(false);
  useEffect(()=>{setReport(null);setError('');return()=>{generation.current++;};},[group?.id]);
  const run=async()=>{
    if(!group||locked.current)return;const runId=++generation.current;locked.current=true;setRunning(true);setReport(null);setError('');
    try{const value=await runHardwareTest(group.id,group.audio.map(e=>e.id));if(runId===generation.current){setReport(value);if(value.snapshot)useGearStore.getState().setReading(value.snapshot);}}
    catch(e){if(runId===generation.current)setError(String(e));}
    finally{locked.current=false;if(runId===generation.current)setRunning(false);}
  };
  if(!group)return <><h1>Teste de hardware</h1><div className="empty-state"><p>Conecte um dispositivo e atualize a lista.</p><button className="button" onClick={()=>navigate('home')}>Ver dispositivos</button></div></>;
  const failures=report?.checks.filter(c=>c.status==='fail').length??0,limits=report?.checks.some(c=>c.status==='unavailable');
  return <><div className="page-title"><div><h1>Teste de hardware</h1><p>Verificação de presença, interfaces e leitura. Nenhum ajuste é alterado.</p></div><div className="header-actions"><button className="button" disabled={!report||running} onClick={()=>report&&downloadJson('central-hub-teste-hardware.json',report)}>Exportar relatório</button><button className="button primary" disabled={running} onClick={()=>void run()}><Icon name="test" size={15}/>{running?'Testando…':'Iniciar teste'}</button></div></div><label className="test-device-picker">Dispositivo<select value={group.id} disabled={running} onChange={e=>navigate('test',e.target.value)}>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <div className="device-workspace"><DeviceRail group={group}/><div className="device-content"><section className="surface"><div className="setting-heading"><h2><Icon name="test" size={18}/>Diagnóstico de leitura</h2><span className="tag" role="status">{running?'Em andamento':report?failures?'Falhas encontradas':limits?'Concluído com limitações':'Verificações concluídas':'Aguardando'}</span></div>{error&&<p className="control-error" role="alert">{error}</p>}{running?<div className="empty-state" role="status">Consultando o Windows e os protocolos integrados…</div>:report?<><div className="test-checks">{report.checks.map((check,i)=><div className={`test-check ${check.status}`} key={i}><span className="check-symbol" aria-hidden="true">{check.status==='pass'?'✓':check.status==='fail'?'×':'—'}</span><div><strong>{check.name}</strong><p>{check.detail}</p></div><small>{check.status==='pass'?'Confirmado':check.status==='fail'?'Falhou':'Não verificado'}</small></div>)}</div><p className="field-help">Executado em {new Date(report.started_at_ms).toLocaleString('pt-BR')} · {report.elapsed_ms} ms. Não é uma certificação de integridade ou teste de escrita.</p>{report.discovery_errors.map(e=><p key={e} className="control-error">{e}</p>)}</>:<div className="empty-state"><Icon name="test" size={28}/><p>Inicie o teste para obter um relatório real deste dispositivo.</p></div>}</section><section className="surface"><h2>Dispositivo selecionado</h2><DeviceFacts group={report?{...group,hid:report.hid,audio:report.audio,system:report.system}:group} snapshot={report?.snapshot}/></section><InputTest/></div></div></>;
}
