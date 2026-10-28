import { expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { NativeHidDevice, logicalHidDevices, type NativeInterface, type NativeReport, type HidTransport } from '../src/services/nativeHid';
// Explicit opt-in. These tests read actual connected hardware; none change settings.
it.skipIf(process.env.CENTRAL_HUB_PROTOCOL_HARDWARE!=='1')('reads the real Superlight through the upstream OpenMouse client and native HID transport',async()=>{
  const child=spawn(resolve('src-tauri/target/debug/hub-protocol-check.exe'),[],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  const pending=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void}>(),listeners=new Map<string,(r:NativeReport)=>void>();let seq=0;
  const lines=createInterface({input:child.stdout});
  const stderr:string[]=[];child.stderr.on('data',b=>stderr.push(String(b)));
  lines.on('line',line=>{const msg=JSON.parse(line);if(msg.event){listeners.get(msg.interface)?.(msg.report);return;}const waiter=pending.get(msg.id);pending.delete(msg.id);if(msg.error)waiter?.reject(new Error(msg.error));else waiter?.resolve(msg.result);});
  child.on('exit',()=>{for(const p of pending.values())p.reject(new Error(stderr.join('')||'Transporte encerrado'));pending.clear();});
  const call=(data:Record<string,unknown>):Promise<unknown>=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,...data})+'\n');});
  const transport:HidTransport={open:async(id,cb)=>{listeners.set(id,cb);await call({operation:'open',interface:id});},close:async id=>{await call({operation:'close',interface:id});listeners.delete(id);},exchange:async(id,operation,reportId,data)=>(await call({operation:'exchange',interface:id,request:{operation,reportId,data}})) as number[]};
  const devices:NativeHidDevice[]=[];
  let client:{readStatus:()=>Promise<unknown>;close:()=>Promise<void>}|null=null;
  try{
    Object.defineProperty(globalThis,'window',{value:globalThis,configurable:true});
    const r=await import('@openmouse/protocol/drivers');
    const infos=await call({operation:'inventory',vendors:[0x046d]}) as NativeInterface[];
    const mouseInfos=infos.filter(d=>[0xc547,0xc094].includes(d.productId));
    expect(mouseInfos.length,'Conecte o Superlight original').toBeGreaterThan(0);
    devices.push(...logicalHidDevices(mouseInfos,transport));
    console.log('Interfaces reais',JSON.stringify(mouseInfos.map(d=>({productId:d.productId,interface:d.interfaceNumber,usages:d.collections.map(c=>[c.usagePage,c.usage])}))));
    Object.defineProperty(globalThis,'navigator',{value:{hid:{getDevices:async()=>devices}},configurable:true});
    const selected=devices.filter(d=>r.clientSupportScore(d)>0).sort((a,b)=>r.clientSupportScore(b)-r.clientSupportScore(a))[0];
    expect(selected).toBeDefined();
    const actual=r.createSupportedClient(selected)!;client=actual;
    const open=(actual as unknown as {open?:()=>Promise<unknown>}).open;if(open)await open.call(actual);
    const status=await actual.readStatus();
    expect(status.brand).toBe('Logitech');expect(status.name).toMatch(/pro\s*x|superlight/i);
    expect(status.dpi).toBeGreaterThan(0);expect(status.pollingRateHz).toBeGreaterThan(0);
    expect(status.firmware.length).toBeGreaterThan(0);
    const options=await actual.getDpiOptions();expect(options).toContain(status.dpi);
    console.log(JSON.stringify({hardware:'Superlight original',name:status.name,brand:status.brand,dpi:status.dpi,polling:status.pollingRateHz,battery:status.batteryPercent,firmware:status.firmware,mode:status.deviceMode,dpiOptions:options.length}));
  }finally{await Promise.allSettled(devices.map(d=>d.dispose()));await client?.close().catch(()=>{});child.stdin.end();lines.close();child.kill();}
},60000);
