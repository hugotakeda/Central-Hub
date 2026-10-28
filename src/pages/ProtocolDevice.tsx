import { useEffect, useRef, useState } from 'react';
import { useGearStore } from '../store/useGearStore';
import type { HardwareGroup } from '../domain/hardwareGroups';
import { acquireProtocolPanel, protocolExclusive, releaseProtocolPanel } from '../services/protocols';
import { customPhoto, photoHidden, photoModelName } from '../domain/localData';
import { productPhoto } from '../domain/productPhotos';
import { illustration } from '../domain/hardwareGroups';
import { resolvePhoto, usePhotoStore, openPhotoSource } from '../services/photoSearch';
import { useDevicePreferences } from '../domain/devicePreferences';

export default function ProtocolDevice({group}:{group:HardwareGroup}) {
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  const frame=useRef<HTMLIFrameElement>(null);
  const navigate=useGearStore(s=>s.navigate),setReading=useGearStore(s=>s.setProtocolReading);
  useEffect(()=>{
    let disposed=false;
    const art=customPhoto(group.id)??productPhoto(illustration(group))?.src??null;
    void protocolExclusive(async()=>{
      if(disposed)return;
      await acquireProtocolPanel(group.id,useGearStore.getState().deviceTab,art,value=>setReading(group.id,value),()=>navigate('home'));
      if(window.__CENTRAL_HUB_PANEL__){window.__CENTRAL_HUB_PANEL__.showBattery=useDevicePreferences.getState().showBattery;window.__CENTRAL_HUB_PANEL__.deviceName=group.name;}
      if(!disposed)setReady(true);
      if(!art&&!photoHidden(group.id))void (async()=>{
        await usePhotoStore.getState().initialize();if(!usePhotoStore.getState().enabled)return;
        const query=illustration(group).photoQuery!;
        const photo=await resolvePhoto({...query,name:photoModelName(group.id)||query.name});
        const host=window.__CENTRAL_HUB_PANEL__;
        if(disposed||!host||!photo.data_url)return;
        host.artwork=photo.data_url;host.artworkSource=photo.source_url;
        host.openArtworkSource=()=>{if(photo.source_url)void openPhotoSource(photo.source_url).catch(e=>useGearStore.getState().notify(String(e),true));};
        frame.current?.contentWindow?.dispatchEvent(new Event('central-hub-artwork'));
      })().catch(()=>{});
    }).catch(error=>{if(!disposed)setError(String(error));});
    return()=>{disposed=true;void protocolExclusive(releaseProtocolPanel).then(()=>useGearStore.getState().scanHid());};
  },[group.id,navigate,setReading]);
  return <div className="protocol-device-page">{error?<section className="surface"><h1>Configuração indisponível</h1><p role="alert">{error}</p><button className="button" onClick={()=>navigate('home')}>Voltar</button></section>:ready?<iframe ref={frame} className="protocol-frame" src="/protocol/index.html" title={`Configurar ${group.name}`} sandbox="allow-scripts allow-same-origin allow-downloads allow-modals allow-popups"/>:<div className="empty-state" role="status">Abrindo os controles do dispositivo…</div>}</div>;
}
