import { Channel, invoke } from '@tauri-apps/api/core';
import type {} from '@openmouse/protocol/drivers';

export interface NativeInterface {
  id: string; physicalId: string; interfaceNumber?: number; vendorId: number; productId: number; productName: string;
  collections: HIDCollectionInfo[];
}
export interface NativeReport { reportId: number; data: number[] }
export interface HidTransport {
  open(id: string, listener: (report: NativeReport) => void): Promise<void>;
  close(id: string): Promise<void>;
  exchange(id: string, operation: 'send'|'feature'|'receive', reportId: number, data: number[]): Promise<number[]>;
}
export const tauriHidTransport: HidTransport = {
  async open(id, listener) {
    const reports = new Channel<NativeReport>(); reports.onmessage = listener;
    await invoke('protocol_open', { id, reports });
  },
  close: id => invoke('protocol_close', { id }),
  exchange: (id, operation, reportId, data) => invoke('protocol_exchange', { id, request: { operation, reportId, data } }),
};

/** WebHID semantics: output excludes the id; feature GET includes the id. */
export class NativeHidDevice implements HIDDevice {
  readonly openMouseTransport = 'bridge' as const;
  readonly key: string;
  readonly vendorId: number; readonly productId: number; readonly productName: string;
  readonly collections: HIDCollectionInfo[]; readonly id: string;
  opened = false;
  private expired = false;
  private listeners = new Set<(event: HIDInputReportEvent) => void>();
  private opening: Promise<void> | null = null;
  private sources: NativeInterface[];
  constructor(source: NativeInterface | NativeInterface[], private transport: HidTransport = tauriHidTransport) {
    this.sources=Array.isArray(source)?source:[source];const info=this.sources[0];
    this.key=info.physicalId;
    this.id=info.id;this.vendorId=info.vendorId;this.productId=info.productId;
    this.productName=info.productName;this.collections=this.sources.flatMap(s=>s.collections);
  }
  async open() {
    if (this.expired) throw new Error('A consulta HID foi encerrada. Atualize para tentar novamente.');
    if (this.opened) return;
    if (!this.opening) this.opening=Promise.allSettled(this.sources.map(source=>this.transport.open(source.id, report=>{
      if (this.expired) return;
      const bytes=Uint8Array.from(report.data);
      const event=Object.assign(new Event('inputreport'),{ device:this, reportId:report.reportId, data:new DataView(bytes.buffer) }) as HIDInputReportEvent;
      for (const listener of this.listeners) listener(event);
    }))).then(async results=>{
      const failure=results.find((r):r is PromiseRejectedResult=>r.status==='rejected');
      if(failure){await Promise.allSettled(this.sources.map(s=>this.transport.close(s.id)));throw failure.reason;}
      this.opened=true;
    }).finally(()=>{this.opening=null;});
    await this.opening;
  }
  async close() {
    if (this.opening) await this.opening.catch(()=>{});
    if (this.opened) {this.opened=false;await Promise.all(this.sources.map(s=>this.transport.close(s.id)));}
  }
  async dispose() {this.expired=true;this.listeners.clear();await this.close();}
  private async exchange(operation:'send'|'feature'|'receive', reportId:number, source?:BufferSource) {
    if (!this.opened || this.expired) throw new Error('Interface HID fechada.');
    if (!Number.isInteger(reportId) || reportId<0 || reportId>255) throw new Error('ID de relatório inválido.');
    const data=source ? Array.from(ArrayBuffer.isView(source) ? new Uint8Array(source.buffer,source.byteOffset,source.byteLength) : new Uint8Array(source)) : [];
    const key=operation==='send'?'outputReports':'featureReports';
    const declares=(cs:readonly HIDCollectionInfo[]):boolean=>cs.some(c=>c[key].some(r=>r.reportId===reportId)||declares(c.children));
    const sources=this.sources.filter(s=>declares(s.collections));
    // An empty descriptor is allowed only for injected unit-test transports.
    const target=sources[0]??(this.collections.length===0?this.sources[0]:undefined);
    if(!target)throw new Error('Relatório não declarado pelo dispositivo.');
    if(sources.length>1)throw new Error('Relatório HID ambíguo entre coleções; nenhuma escrita foi enviada.');
    try{return await this.transport.exchange(target.id,operation,reportId,data);}
    catch(error){await this.close().catch(()=>{});throw error;}
  }
  async sendReport(id:number,data:BufferSource) {await this.exchange('send',id,data);}
  async sendFeatureReport(id:number,data:BufferSource) {await this.exchange('feature',id,data);}
  async receiveFeatureReport(id:number) {const data=Uint8Array.from(await this.exchange('receive',id));return new DataView(data.buffer);}
  addEventListener(_type:'inputreport', listener:(event:HIDInputReportEvent)=>void) {this.listeners.add(listener);}
  removeEventListener(_type:'inputreport', listener:(event:HIDInputReportEvent)=>void) {this.listeners.delete(listener);}
}

/** Windows splits top-level collections; WebHID exposes them per USB interface. */
export function logicalHidDevices(infos:NativeInterface[],transport:HidTransport=tauriHidTransport) {
  const groups=new Map<string,NativeInterface[]>();
  for(const info of infos){
    const interfaceKey=info.interfaceNumber!==undefined&&info.interfaceNumber>=0?String(info.interfaceNumber):info.id;
    const key=`${info.physicalId}:${info.vendorId}:${info.productId}:${interfaceKey}`;
    const group=groups.get(key)??[];group.push(info);groups.set(key,group);
  }
  return [...groups.values()].map(group=>new NativeHidDevice(group,transport));
}
