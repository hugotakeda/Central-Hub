import { expect, it, vi } from 'vitest';
import { ViaClient, viaDefinition } from '../src/services/ownVia';
import definitions from '../src/domain/viaDefinitions.json';
import { NativeHidDevice, type HidTransport, type NativeReport } from '../src/services/nativeHid';
const cs:HIDCollectionInfo={usagePage:0xff60,usage:0x61,children:[],featureReports:[],inputReports:[{reportId:0,items:[{reportSize:8,reportCount:32}]}],outputReports:[{reportId:0,items:[{reportSize:8,reportCount:32}]}]};
const info={id:'via',physicalId:'keyboard',vendorId:0x3434,productId:0x310,productName:'V1',collections:[cs]};
function transport(){
  let listener!:(r:NativeReport)=>void,key=4;const packets:number[][]=[];
  const t:HidTransport={open:async(_,cb)=>{listener=cb;},close:vi.fn(async()=>{}),exchange:async(_id,_op,id,data)=>{packets.push([...data]);expect(id).toBe(0);expect(data).toHaveLength(32);const r=[...data];if(data[0]===1){r[1]=0;r[2]=13;}if(data[0]===0x11)r[1]=4;if(data[0]===4){r[4]=key>>8;r[5]=key&255;}if(data[0]===5)key=(data[4]<<8)|data[5];if(data[0]===0x12)for(let i=0;i<data[3];i++)r[4+i]=(data[2]+i)%2?4:0;queueMicrotask(()=>listener({reportId:0,data:r}));return [];}};
  return {t,packets};
}
it('requires exact documented hardware variant and 32-byte raw HID collection',()=>{
  expect(viaDefinition(info)?.name).toBe('Keychron V1 ANSI');expect(viaDefinition({...info,productId:0x999})).toBeUndefined();expect(viaDefinition({...info,collections:[{...cs,usage:1}]})).toBeUndefined();expect(definitions).toHaveLength(13);
  for(const d of definitions){expect(new Set(d.keys.map(k=>k.join(','))).size).toBe(d.keys.length);for(const [r,c] of d.keys){expect(r).toBeLessThan(d.rows);expect(c).toBeLessThan(d.cols);}}
});
it('reads real returned protocol, layers and keymap, then checks old value and readback around one remap',async()=>{
  const {t,packets}=transport(),d=new NativeHidDevice(info,t);await d.open();const c=new ViaClient(d,definitions[0]);expect(await c.status()).toEqual({version:13,layers:4});const keys=await c.readLayer(1,4);expect(keys).toHaveLength(96);expect(new Set(keys)).toEqual(new Set([4]));await c.remap(0,0,0,4,5,4);expect(packets.filter(p=>p[0]===5)).toHaveLength(1);expect(packets.slice(-3).map(p=>p[0])).toEqual([4,5,4]);await d.dispose();expect(t.close).toHaveBeenCalled();
});
it('refuses stale edits, invalid matrix positions and unsupported keycodes before writing',async()=>{
  const {t,packets}=transport(),d=new NativeHidDevice(info,t);await d.open();const c=new ViaClient(d,definitions[0]);await expect(c.remap(0,0,0,9,5,4)).rejects.toThrow('mudou');await expect(c.remap(9,0,0,4,5,4)).rejects.toThrow('matriz');await expect(c.remap(0,0,0,4,0xffff,4)).rejects.toThrow('básico');expect(packets.some(p=>p[0]===5)).toBe(false);await d.dispose();
});
