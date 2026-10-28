import { useEffect, useState, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/services/protocolTypes';
import '../vendor/openmouse/src/styles/index.css';
import './panel.css';
import * as control from '../vendor/openmouse/src/device/controller';
import { useControl } from '../vendor/openmouse/src/app/useControl';
import { OverviewPage } from '../vendor/openmouse/src/features/devices/OverviewPage';
import { PendingBar } from '../vendor/openmouse/src/app/PendingBar';
import { ToastHost } from '../vendor/openmouse/src/app/Toasts';
import { UiLocaleContext } from '../vendor/openmouse/src/shared/ui-locale';
import { ensureDisplayLocale } from '../vendor/openmouse/src/i18n';
import { setSoundsEnabled } from '../vendor/openmouse/src/platform/sound-manager';
const CaptureDialog=lazy(()=>import('../vendor/openmouse/src/features/capture/CaptureDialog').then(m=>({default:m.CaptureDialog})));
const ShareProfileDialog=lazy(()=>import('../vendor/openmouse/src/features/profiles/ShareProfileDialog').then(m=>({default:m.ShareProfileDialog})));
const root=createRoot(document.getElementById('control-app')!);
const host=window.parent!==window ? window.parent.__CENTRAL_HUB_PANEL__ : undefined;

function Panel() {
  const snapshot=useControl(),[capture,setCapture]=useState(false),[share,setShare]=useState(false);
  const [entered,setEntered]=useState(false),[refreshing,setRefreshing]=useState(false);
  useEffect(()=>{
    if(!entered&&(snapshot.status||snapshot.keyboard)){
      setEntered(true);void control.showDeviceDashboard().then(()=>control.setWorkspaceTab(host!.initialTab));
    }
  },[snapshot.status,snapshot.keyboard,entered]);
  useEffect(()=>{
    const refreshArt=()=>control.refreshInterface();window.addEventListener('central-hub-artwork',refreshArt);
    return()=>window.removeEventListener('central-hub-artwork',refreshArt);
  },[]);
  useEffect(()=>{
    const keyboard=snapshot.keyboard;
    host!.capture({status:snapshot.status,keyboard:keyboard?{...keyboard}:null,pending:snapshot.pending.count,busy:snapshot.settingInProgress||snapshot.pending.busy});
  },[snapshot.status,snapshot.keyboard,snapshot.pending.count,snapshot.settingInProgress,snapshot.pending.busy]);
  useEffect(()=>{
    const navigate=(event:MouseEvent)=>{
      const target=event.target as Element;
      if(target.closest('.om-crumbs button')){event.preventDefault();event.stopPropagation();host!.leave();}
    };
    document.addEventListener('click',navigate,true);
    return()=>document.removeEventListener('click',navigate,true);
  },[]);
  const refresh=async()=>{setRefreshing(true);try{await control.refreshStatus();if(!snapshot.status&&!snapshot.keyboard)await control.connect();}finally{setRefreshing(false);}};
  return <UiLocaleContext.Provider value="pt"><div className="central-protocol-shell" data-interface-theme="mono"><header className="central-protocol-toolbar"><span>Configuração do dispositivo</span><button className="om-btn is-ghost is-sm" disabled={refreshing||snapshot.settingInProgress||snapshot.pending.count>0} onClick={()=>void refresh()}>{refreshing?'Consultando…':'Atualizar leitura'}</button></header><main className="full-desktop-content"><OverviewPage snapshot={snapshot} onOpenCapture={()=>setCapture(true)} onShareProfile={()=>setShare(true)}/></main><PendingBar snapshot={snapshot}/><ToastHost toasts={snapshot.toasts} locale="pt"/><Suspense fallback={null}>{capture&&<CaptureDialog open onClose={()=>setCapture(false)} locale="pt"/>}{share&&<ShareProfileDialog open onClose={()=>setShare(false)} snapshot={snapshot}/>}</Suspense><footer className="central-protocol-credit">Protocolos e controles baseados no OpenMouse · AGPL-3.0-or-later · <a href="https://github.com/hugotakeda/Central-Hub" target="_blank" rel="noreferrer">Código-fonte e créditos</a></footer></div></UiLocaleContext.Provider>;
}
if(!host)root.render(<p>Abra a configuração pelo aplicativo Central Hub.</p>);
else {
  Object.defineProperty(navigator,'hid',{value:host.hid,configurable:true});
  setSoundsEnabled(false);
  await ensureDisplayLocale('pt');
  control.setPreference('locale','pt');control.setPreference('theme','Mono');control.setPreference('reducedMotion',true);control.setPreference('enabledSounds',false);
  control.start();root.render(<Panel/>);
  window.addEventListener('pagehide',()=>void control.stop());
}
