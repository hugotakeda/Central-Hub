import { expect, it, vi } from 'vitest';
import { NativeHidDevice, logicalHidDevices, type HidTransport, type NativeReport } from '../src/services/nativeHid';
const info={id:'test-interface',physicalId:'test-physical',vendorId:1,productId:2,productName:'Test-only transport',collections:[]};
it('preserves WebHID report ids, typed-array offsets and feature GET framing',async()=>{
  const transport:HidTransport={open:vi.fn(async()=>{}),close:vi.fn(async()=>{}),exchange:vi.fn(async()=>[7,10,11])};
  const d=new NativeHidDevice(info,transport);await d.open();
  await d.sendReport(7,new Uint8Array([99,10,11,88]).subarray(1,3));
  expect(transport.exchange).toHaveBeenLastCalledWith(info.id,'send',7,[10,11]);
  await d.sendFeatureReport(7,new DataView(Uint8Array.from([88,10,11]).buffer,1,2));
  expect(transport.exchange).toHaveBeenLastCalledWith(info.id,'feature',7,[10,11]);
  expect(Array.from(new Uint8Array((await d.receiveFeatureReport(7)).buffer))).toEqual([7,10,11]);
  await d.dispose();expect(transport.close).toHaveBeenCalledTimes(1);
  await expect(d.open()).rejects.toThrow('encerrada');
});
it('merges Windows top-level collections only within one physical USB interface and routes reports correctly',async()=>{
  const collection=(reportId:number,usage:number):HIDCollectionInfo=>({usagePage:0xff00,usage,inputReports:[{reportId,items:[{reportSize:8,reportCount:6}]}],outputReports:[{reportId,items:[{reportSize:8,reportCount:6}]}],featureReports:[],children:[]});
  const short={...info,id:'short',interfaceNumber:2,collections:[collection(0x10,1)]};
  const long={...info,id:'long',interfaceNumber:2,collections:[collection(0x11,2)]};
  const other={...long,id:'other-mouse',physicalId:'different-physical-device'};
  const transport:HidTransport={open:vi.fn(async()=>{}),close:vi.fn(async()=>{}),exchange:vi.fn(async()=>[])};
  const devices=logicalHidDevices([short,long,other],transport);
  expect(devices).toHaveLength(2);expect(devices[0].collections).toHaveLength(2);
  await devices[0].open();expect(transport.open).toHaveBeenCalledTimes(2);
  await devices[0].sendReport(0x11,new Uint8Array([1,2]));expect(transport.exchange).toHaveBeenLastCalledWith('long','send',0x11,[1,2]);
  await expect(devices[0].sendReport(0x12,new Uint8Array([1]))).rejects.toThrow('não declarado');
  await devices[0].dispose();expect(transport.close).toHaveBeenCalledTimes(2);
});
it('waits for all partial opens before cleaning up an interface that failed to open',async()=>{
  let finish!:()=>void;
  const transport:HidTransport={open:vi.fn(async id=>{if(id==='failed')throw new Error('Em uso');await new Promise<void>(resolve=>{finish=resolve;});}),close:vi.fn(async()=>{}),exchange:vi.fn(async()=>[])};
  const d=new NativeHidDevice([{...info,id:'failed'},{...info,id:'pending'}],transport);
  const outcome=d.open().catch(e=>String(e));await Promise.resolve();
  expect(transport.close).not.toHaveBeenCalled();finish();
  expect(await outcome).toContain('Em uso');expect(transport.close).toHaveBeenCalledTimes(2);expect(d.opened).toBe(false);
});
it('coalesces opens and stops reports after disposal, including timed-out reads',async()=>{
  let listener!:(report:NativeReport)=>void;
  const transport:HidTransport={open:vi.fn(async(_,cb)=>{listener=cb;}),close:vi.fn(async()=>{}),exchange:vi.fn(async()=>[])};
  const d=new NativeHidDevice(info,transport),received=vi.fn();d.addEventListener('inputreport',received);
  await Promise.all([d.open(),d.open()]);expect(transport.open).toHaveBeenCalledTimes(1);
  listener({reportId:0x10,data:[1,2]});expect(received).toHaveBeenCalledTimes(1);
  expect(received.mock.calls[0][0].reportId).toBe(0x10);
  await d.dispose();listener({reportId:0x10,data:[1,2]});expect(received).toHaveBeenCalledTimes(1);
  await expect(d.sendReport(7,new Uint8Array())).rejects.toThrow('fechada');
});
