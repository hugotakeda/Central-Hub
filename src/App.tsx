import { lazy, Suspense, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useGearStore } from './store/useGearStore';
import { Sidebar } from './components/Sidebar';
import { WindowChrome } from './components/WindowChrome';
import { Icon } from './components/Icon';
import Home from './pages/Home';
import { desktop } from './services/bridge';
import { useDevicePreferences } from './domain/devicePreferences';
const HardwareDevice = lazy(() => import('./pages/HardwareDevice'));
const Hardware = lazy(() => import('./pages/Hardware'));
const Settings = lazy(() => import('./pages/Settings'));
const HardwareTest = lazy(() => import('./pages/HardwareTest'));
const Catalog=lazy(()=>import('./pages/Catalog'));
const AudioSetup=lazy(()=>import('./pages/AudioSetup'));
export default function App() {
  useDevicePreferences(s=>s.audioBindings);
  const page = useGearStore(s => s.page);
  const id = useGearStore(s => s.selectedId), ready = useGearStore(s => s.ready);
  const notice = useGearStore(s => s.notice);
  const clearNotice = useGearStore(s => s.clearNotice), initialize = useGearStore(s => s.initialize);
  const scanHid = useGearStore(s => s.scanHid);
  const main = useRef<HTMLElement>(null);
  useEffect(() => { main.current?.scrollTo({top:0}); }, [page, id]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(clearNotice, notice.error ? 10000 : 4500); return () => clearTimeout(timer); }, [notice, clearNotice]);
  useEffect(() => {
    if (!desktop) { void initialize(); return; }
    let stop: (() => void) | undefined, timer: ReturnType<typeof setTimeout> | undefined, disposed = false;
    const rescan = () => { clearTimeout(timer); timer = setTimeout(() => void scanHid(), 700); };
    void listen('hardware-changed', rescan).then(unlisten => { if (disposed) unlisten(); else { stop = unlisten; void initialize(); } }).catch(() => { if (!disposed) void initialize(); });
    const focus = () => { if (document.visibilityState === 'visible') rescan(); };
    document.addEventListener('visibilitychange', focus);
    return () => { disposed = true; stop?.(); clearTimeout(timer); document.removeEventListener('visibilitychange', focus); };
  }, [scanHid, initialize]);
  return <><a className="skip-link" href="#main">Ir para o conteúdo</a><WindowChrome/><Sidebar/><div className="app-body"><main ref={main} className="app-main" id="main" tabIndex={-1}>
    {!ready ? <div className="empty-state" role="status">Detectando dispositivos…</div> : <Suspense fallback={<div className="empty-state" role="status">Carregando…</div>}>{page === 'home' ? <Home/> : page === 'device' ? <HardwareDevice key={id}/> : page === 'hardware' ? <Hardware/> : page === 'test' ? <HardwareTest key={id}/> : page==='catalog'?<Catalog/>:page==='audio-setup'?<AudioSetup/>:<Settings/>}</Suspense>}
  </main></div>{notice && <div className={`toast ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}><span>{notice.message}</span><button className="icon-button" onClick={clearNotice} aria-label="Fechar aviso"><Icon name="close" size={14}/></button></div>}</>;
}
