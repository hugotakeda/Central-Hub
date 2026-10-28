import { invoke, isTauri } from '@tauri-apps/api/core';
import { NativeHidDevice, logicalHidDevices, type NativeInterface } from './nativeHid';
import type { HidScan } from '../domain/types';
import type { ProtocolDevice, ProtocolPanelHost, PanelSnapshot } from './protocolTypes';
import type { MouseStatus } from '@openmouse/protocol/drivers/mouse-types';
import type { KeyboardStatus } from '@openmouse/keyboard-protocol/drivers/keyboard-types';

type Registries = { mouse: typeof import('@openmouse/protocol/drivers'); keyboard: typeof import('@openmouse/keyboard-protocol/drivers') };
let registry: Promise<Registries> | null = null;
export function registries() {
  registry ??= Promise.all([import('@openmouse/protocol/drivers'),import('@openmouse/keyboard-protocol/drivers')]).then(([mouse,keyboard])=>({mouse,keyboard}));
  return registry;
}
let inventory: NativeInterface[]=[];
let queue: Promise<unknown> = Promise.resolve();
export function protocolExclusive<T>(action:()=>Promise<T>):Promise<T> {
  const next=queue.catch(()=>{}).then(action); queue=next; return next;
}
let panel: { id:string; devices:NativeHidDevice[]; listeners:Map<string,Set<(event:HIDConnectionEvent)=>void>>; host:ProtocolPanelHost; pending:number; busy:boolean } | null = null;
export const protocolPanelActive=()=>panel!==null;
export const protocolPanelBusy=()=>!!panel && (panel.pending>0 || panel.busy);

function scopedHid(devices:NativeHidDevice[], listeners = new Map<string,Set<(event:HIDConnectionEvent)=>void>>()):HID {
  return {
    getDevices: async()=>[...devices],
    requestDevice:async({filters})=>devices.filter(d=>filters.length===0 || filters.some(f=>(f.vendorId===undefined||d.vendorId===f.vendorId)&&(f.productId===undefined||d.productId===f.productId)&&(f.usagePage===undefined||d.collections.some(c=>c.usagePage===f.usagePage&&(f.usage===undefined||c.usage===f.usage))))),
    addEventListener(type,listener){let set=listeners.get(type);if(!set)listeners.set(type,set=new Set());set.add(listener);},
    removeEventListener(type,listener){listeners.get(type)?.delete(listener);},
  };
}
async function vendors() {const r=await registries();return [...new Set([...r.mouse.SUPPORTED_HID_FILTERS,...r.keyboard.SUPPORTED_HID_FILTERS].map(f=>f.vendorId).filter((v):v is number=>v!==undefined))];}
async function getInventory() {return invoke<NativeInterface[]>('protocol_inventory',{vendorIds:await vendors()});}
function nativeF75(scan:HidScan, physicalId:string) {return scan.devices.some(d=>d.physical_id===physicalId && (d.identity?.model==='f75' || d.vendor_id===0x258a&&d.product_id===0x010c || d.vendor_id===0x3554&&d.product_id===0xfa09));}

export async function discoverProtocols(scan:HidScan,onlyId?:string):Promise<ProtocolDevice[]> {
  if(!isTauri()||!scan.available) return [];
  inventory=await getInventory();
  const r=await registries(), upstream=await import('../../vendor/openmouse/src/device/device-clients'), groups=new Map<string,NativeInterface[]>();
  for(const info of inventory) {
    if(onlyId&&info.physicalId!==onlyId)continue;
    if(nativeF75(scan,info.physicalId)||scan.devices.some(d=>d.id===info.id&&d.virtual_device))continue;
    const devices=groups.get(info.physicalId)??[];devices.push(info);groups.set(info.physicalId,devices);
  }
  const found:ProtocolDevice[]=[];
  for(const [physicalId,peers] of groups) {
    const candidates=await Promise.all(logicalHidDevices(peers).map(async d=>{
      const info=peers.find(i=>i.id===d.id)!, k=r.keyboard.DEVICE_DRIVERS.find(x=>x.supports(d));
      const m=k?null:await upstream.createSupportedClient(d);
      return {info,k,m,brand:k?.brand??(m?await upstream.deviceBrand(m):''),score:k?k.score(d)+100:m?await upstream.clientSupportScore(d):0};
    }));
    const ranked=candidates.filter(c=>c.k||c.m).sort((a,b)=>b.score-a.score);
    if(!ranked.length)continue;
    let result:ProtocolDevice|null=null;
    for(const candidate of ranked.slice(0,3)) {
      const kind=candidate.k?'keyboard':'mouse';
      const next:ProtocolDevice={physicalId,interfaceId:candidate.info.id,driver:candidate.brand,kind,name:candidate.info.productName,brand:candidate.brand,confirmed:false,error:null,observedAt:0};
      const devices=logicalHidDevices(peers);
      const device=devices.find(d=>d.id===candidate.info.id)!;
      let client=candidate.k?.create(device)??await upstream.createSupportedClient(device);
      if(!client)continue;
      const previous=Object.getOwnPropertyDescriptor(navigator,'hid');
      Object.defineProperty(navigator,'hid',{value:scopedHid(devices),configurable:true});
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {
        const read=async()=>{
          if(!candidate.k){
            const egg=await import('@openmouse/protocol/drivers/endgame/egg-we-control');
            if(egg.isEggWeClient(client))await egg.eggWePrepare(client,devices);
          }
          const open=(client as unknown as {open?:()=>Promise<unknown>}).open;
          if(typeof open==='function')await open.call(client);
          return client.readStatus();
        };
        const status=await Promise.race([read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('O dispositivo não respondeu dentro do prazo.')),15000);})]);
        if(kind==='keyboard') next.keyboard=status as KeyboardStatus;
        else {
          const mouse=status as MouseStatus;
          // Old mouse registry includes identity-only keyboards; do not invent DPI for them.
          if(/keyboard|wooting/i.test(mouse.ui?.family??'')||(!mouse.dpi&&/keyboard|wooting|k-001|ak820/i.test(mouse.name)))next.kind='keyboard';
          else next.mouse=mouse;
        }
        const keyboard=next.keyboard;
        next.catalogOnly=keyboard ? !(keyboard.firmwareVersion||keyboard.serial||keyboard.activeProfile!==null||keyboard.kochi||keyboard.wuque?.device.info||keyboard.wuque?.device.protocol||keyboard.wuque?.device.feature) : (status.ui?.family==='wallhack-keyboard');
        next.name=status.name;next.brand=status.brand;next.confirmed=!next.catalogOnly;next.observedAt=Date.now();
        result=next;break;
      }catch(error){next.error=String(error);result??=next;}
      finally {
        clearTimeout(timer);
        await Promise.allSettled(devices.map(d=>d.dispose()));
        await client.close().catch(()=>{});
        if(previous)Object.defineProperty(navigator,'hid',previous);else Reflect.deleteProperty(navigator,'hid');
      }
    }
    if(result)found.push(result);
  }
  return found;
}

export async function acquireProtocolPanel(id:string,initialTab:ProtocolPanelHost['initialTab'],artwork:string|null,capture:(value:PanelSnapshot)=>void,leave:()=>void) {
  await releaseProtocolPanel();
  const devices=logicalHidDevices(inventory.filter(i=>i.physicalId===id));
  if(!devices.length)throw new Error('Interface removida. Atualize a lista de dispositivos.');
  const listeners=new Map<string,Set<(event:HIDConnectionEvent)=>void>>();
  const host:ProtocolPanelHost={hid:scopedHid(devices,listeners),initialTab,artwork,leave,capture(value){if(panel?.id!==id)return;panel.pending=value.pending;panel.busy=value.busy;capture(value);}};
  panel={id,devices,listeners,host,pending:0,busy:false};window.__CENTRAL_HUB_PANEL__=host;
}
export async function releaseProtocolPanel() {
  const current=panel;panel=null;delete window.__CENTRAL_HUB_PANEL__;
  if(current)await Promise.allSettled(current.devices.map(d=>d.dispose()));
}
export async function refreshProtocolPanel() {
  const current=panel;if(!current || current.busy || current.pending)return;
  const fresh=await getInventory();if(panel!==current)return;
  const freshDevices=logicalHidDevices(fresh.filter(i=>i.physicalId===current.id));
  const ids=new Set(freshDevices.map(i=>i.id));
  const removed=current.devices.filter(d=>!ids.has(d.id));
  for(const d of removed){await d.dispose();current.devices.splice(current.devices.indexOf(d),1);for(const cb of current.listeners.get('disconnect')??[])cb(Object.assign(new Event('disconnect'),{device:d}) as HIDConnectionEvent);}
  const added=freshDevices.filter(d=>!current.devices.some(existing=>existing.id===d.id));
  for(const d of added){current.devices.push(d);for(const cb of current.listeners.get('connect')??[])cb(Object.assign(new Event('connect'),{device:d}) as HIDConnectionEvent);}
  inventory=fresh;
}
