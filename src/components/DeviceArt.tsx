import { memo, useEffect, useId, useRef, useState } from 'react';
import type { DeviceVisual, OnlinePhoto } from '../domain/types';
import { productPhoto } from '../domain/productPhotos';
import { customPhoto, saveCustomPhoto, photoModelName, savePhotoModelName, photoHidden, hidePhoto, removeCustomPhoto } from '../domain/localData';
import { useGearStore } from '../store/useGearStore';
import { resolvePhoto, usePhotoStore, photoKey, openPhotoSource } from '../services/photoSearch';
import { Icon } from './Icon';
export const DeviceArt = memo(function DeviceArt({ device, large = false, editable = false }: { device: DeviceVisual; large?: boolean; editable?: boolean }) {
  const bundled = productPhoto(device), id = device.physicalId ?? device.id, inputId = useId();
  const [custom,setCustom] = useState(() => customPhoto(id)), [model,setModel] = useState(() => photoModelName(id));
  const [draft,setDraft] = useState(() => photoModelName(id) || device.photoQuery?.name || '');
  const [hidden,setHidden] = useState(() => photoHidden(id)), [online,setOnline] = useState<OnlinePhoto|null>(null);
  const [preview,setPreview] = useState<OnlinePhoto|null>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [imageFailed,setImageFailed] = useState(false);
  const enabled = usePhotoStore(s=>s.enabled), ready = usePhotoStore(s=>s.ready), epoch = usePhotoStore(s=>s.epoch);
  const generation = useRef(0);
  const query = device.photoQuery ? { ...device.photoQuery, name: model || device.photoQuery.name } : null;
  const key = query ? photoKey(query) : '';
  useEffect(()=>{ void usePhotoStore.getState().initialize(); },[]);
  useEffect(()=>{
    const run=++generation.current; setImageFailed(false);setOnline(null);setError('');setBusy(false);
    if (custom || bundled || !query || hidden || device.virtual || !ready || !enabled) return;
    setBusy(true);
    void resolvePhoto(query).then(photo=>{if(run===generation.current)setOnline(photo);}).catch(error=>{if(run===generation.current)setError(String(error));}).finally(()=>{if(run===generation.current)setBusy(false);});
    return()=>{generation.current++;};
  },[key,custom,bundled,hidden,ready,enabled,epoch,device.virtual]);
  const lookup = async () => {
    if (!device.photoQuery || busy) return;
    try {
      const run=++generation.current;setBusy(true);setError('');setPreview(null);
      const photo=await resolvePhoto({...device.photoQuery,name:draft.trim()},true);
      if(run===generation.current)setPreview(photo);
      if(run===generation.current)setBusy(false);
    } catch(error) {setBusy(false);setError(String(error));}
  };
  const src = custom ?? bundled?.src ?? (!hidden && enabled ? online?.data_url : undefined);
  const alt = custom ? 'Foto escolhida por você para este dispositivo' : bundled?.alt ?? `Foto sugerida para ${model || device.photoQuery?.name || 'o dispositivo'}; confira o modelo e a variante`;
  const source = online?.source_url ? (()=>{try{return new URL(online.source_url).hostname.replace(/^www\./,'');}catch{return '';}})() : '';
  return <><div className={`device-art product-art ${large ? 'large' : ''} art-${device.kind}`}>
    {src && !imageFailed ? <img src={src} alt={alt} decoding="async" loading="lazy" draggable={false} onError={()=>setImageFailed(true)}/> : <span className="no-photo"><Icon name={device.kind==='keyboard'?'keyboard':device.kind==='mouse'?'mouse':device.kind==='audio'||device.kind==='headset'?'audio':'usb'} size={54}/><span>{busy?'Buscando foto…':!enabled&&!bundled?'Sem foto local':'Foto não disponível'}</span></span>}
  </div>{!custom&&!bundled&&online?.data_url&&!hidden&&enabled&&<div className="photo-provenance"><span>Foto sugerida{online.cached?' · cache':''}</span>{source&&<button type="button" className="text-button" onClick={()=>{void openPhotoSource(online!.source_url!).catch(e=>useGearStore.getState().notify(String(e),true));}}>Fonte: {source} ↗</button>}</div>}
    {editable&&<div className="photo-options"><div className="photo-picker"><label className="text-button" htmlFor={inputId}>{custom?'Trocar foto local':'Escolher foto local'}</label><input id={inputId} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(!file)return;void saveCustomPhoto(id,file).then(()=>{setCustom(customPhoto(id));setImageFailed(false);}).catch(e=>useGearStore.getState().notify(String(e),true));e.target.value='';}}/>{custom&&<button type="button" className="text-button" onClick={()=>{try{removeCustomPhoto(id);setCustom(null);}catch(e){useGearStore.getState().notify(String(e),true);}}}>Usar foto automática</button>}</div>
      {!bundled&&!device.virtual&&<details className="photo-search-editor"><summary>Buscar ou corrigir foto</summary><p className="field-help">Informe a marca e o modelo público do produto. Isso só altera a busca da foto.</p><form onSubmit={e=>{e.preventDefault();void lookup();}}><input aria-label="Modelo para buscar foto" value={draft} maxLength={160} placeholder="Ex.: Logitech G502 HERO" disabled={busy||!enabled} onChange={e=>setDraft(e.target.value)}/><button className="button small" disabled={busy||!enabled||!draft.trim()}>{busy?'Buscando…':'Buscar na internet'}</button></form>{!enabled&&<p className="field-help">Ative a busca de fotos em Ajustes.</p>}{(preview?.message||online?.message||error)&&<p className="field-help" role="status">{error||preview?.message||online?.message}</p>}{preview?.data_url&&<div className="photo-preview"><p>Prévia · {preview.query}</p><img src={preview.data_url} alt={`Prévia da foto encontrada para ${preview.query}`}/><button type="button" className="button small" onClick={()=>{try{savePhotoModelName(id,draft);setModel(draft.trim());setHidden(false);setOnline(preview);setPreview(null);setImageFailed(false);}catch(e){useGearStore.getState().notify(String(e),true);}}}>Usar esta foto</button><button type="button" className="text-button" onClick={()=>setPreview(null)}>Cancelar prévia</button></div>}{online?.data_url&&!hidden&&<button type="button" className="text-button" onClick={()=>{try{hidePhoto(id);setHidden(true);}catch(e){useGearStore.getState().notify(String(e),true);}}}>Esta foto não corresponde ao meu produto</button>}</details>}
    </div>}
  </>;
});
