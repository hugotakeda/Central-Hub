import definitions from '../domain/viaDefinitions.json';
import { NativeHidDevice, type NativeInterface } from './nativeHid';
import { invoke } from '@tauri-apps/api/core';
export type ViaDefinition=typeof definitions[number];
export interface ViaReading {physicalId:string;interface:NativeInterface;definition:ViaDefinition;version:number;layers:number;observedAt:number;error:string|null}
function rawCollection(cs:readonly HIDCollectionInfo[]):boolean{return cs.some(c=>c.usagePage===0xff60&&c.usage===0x61&&c.inputReports.some(r=>r.reportId===0&&r.items.reduce((n,i)=>n+i.reportSize*i.reportCount,0)===256)&&c.outputReports.some(r=>r.reportId===0&&r.items.reduce((n,i)=>n+i.reportSize*i.reportCount,0)===256));}
export function viaDefinition(info:NativeInterface){return rawCollection(info.collections)?definitions.find(d=>d.vendorId===info.vendorId&&d.productId===info.productId):undefined;}
/** Own VIA implementation. No bootloader, reset, firmware or arbitrary raw command API. */
export class ViaClient {
  constructor(private device:HIDDevice,readonly definition:ViaDefinition){}
  private async request(data:number[],echo=data.length):Promise<Uint8Array>{
    if(data.length>32)throw new Error('Pacote VIA excedido.');
    return new Promise((resolve,reject)=>{
      let done=false;
      const finish=(error:unknown,value?:Uint8Array)=>{if(done)return;done=true;clearTimeout(timer);this.device.removeEventListener('inputreport',receive);if(error)reject(error);else resolve(value!);};
      const receive=(event:HIDInputReportEvent)=>{if(event.reportId!==0||event.data.byteLength!==32)return;const r=new Uint8Array(event.data.buffer,event.data.byteOffset,event.data.byteLength);if(r[0]===0xff){finish(new Error('O firmware não oferece este comando VIA.'));return;}if(!data.slice(0,echo).every((v,i)=>r[i]===v))return;finish(null,r.slice());};
      const timer=setTimeout(()=>finish(new Error('O teclado não respondeu à consulta VIA.')),1000);
      this.device.addEventListener('inputreport',receive);
      const packet=new Uint8Array(32);packet.set(data);void this.device.sendReport(0,packet).catch(error=>finish(error));
    });
  }
  async status(){
    const versionReply=await this.request([1]);const version=(versionReply[1]<<8)|versionReply[2];
    if(version<9||version>13)throw new Error(`Versão VIA ${version} ainda não integrada.`);
    const reply=await this.request([0x11]);const layers=reply[1];
    if(layers<1||layers>16)throw new Error('Número de camadas VIA inválido.');
    return {version,layers};
  }
  private position(layer:number,row:number,col:number,layers:number){if(!Number.isInteger(layer)||layer<0||layer>=layers||!this.definition.keys.some(([r,c])=>r===row&&c===col))throw new Error('Posição de tecla não pertence à matriz deste modelo.');}
  async readLayer(layer:number,layers:number){
    if(!Number.isInteger(layer)||layer<0||layer>=layers)throw new Error('Camada inválida.');
    const size=this.definition.rows*this.definition.cols*2,bytes=new Uint8Array(size);
    for(let at=0;at<size;at+=28){const count=Math.min(28,size-at),offset=layer*size+at;const reply=await this.request([0x12,offset>>8,offset&255,count]);bytes.set(reply.slice(4,4+count),at);}
    return Array.from({length:size/2},(_,i)=>(bytes[i*2]<<8)|bytes[i*2+1]);
  }
  async remap(layer:number,row:number,col:number,expected:number,keycode:number,layers:number){
    this.position(layer,row,col,layers);
    if(!Number.isInteger(keycode)||keycode<0||keycode>0xe7)throw new Error('Escolha um código HID básico de 0000 a 00E7.');
    const read=async()=>{const r=await this.request([4,layer,row,col]);return (r[4]<<8)|r[5];};
    if(await read()!==expected)throw new Error('A tecla mudou desde a leitura. Atualize antes de aplicar.');
    await this.request([5,layer,row,col,keycode>>8,keycode&255]);
    if(await read()!==keycode)throw new Error('O teclado não confirmou a alteração. Atualize a leitura.');
  }
}
export async function withVia<T>(info:NativeInterface,action:(client:ViaClient)=>Promise<T>){
  const inventory=await invoke<NativeInterface[]>('protocol_inventory',{vendorIds:[info.vendorId]});
  const fresh=inventory.find(i=>i.id===info.id&&i.physicalId===info.physicalId&&i.vendorId===info.vendorId&&i.productId===info.productId);
  const definition=fresh&&viaDefinition(fresh);if(!fresh||!definition)throw new Error('Modelo/interface VIA removido ou alterado. Atualize os dispositivos.');
  const device=new NativeHidDevice(fresh);try{await device.open();return await action(new ViaClient(device,definition));}finally{await device.dispose();}
}
export async function discoverVia(inventory:NativeInterface[]):Promise<ViaReading[]>{
  const readings:ViaReading[]=[];
  for(const info of inventory){const definition=viaDefinition(info);if(!definition||readings.some(r=>r.physicalId===info.physicalId))continue;
    const reading:ViaReading={physicalId:info.physicalId,interface:info,definition,version:0,layers:0,observedAt:0,error:null};
    try{Object.assign(reading,await withVia(info,c=>c.status()),{observedAt:Date.now()});}catch(error){reading.error=String(error);}
    readings.push(reading);
  }
  return readings;
}
export function basicKeyName(code:number):string{
  if(code===0)return 'Sem ação';if(code===1)return 'Transparente';if(code>=4&&code<=29)return String.fromCharCode(65+code-4);
  if(code>=30&&code<=39)return String((code-29)%10);if(code>=58&&code<=69)return `F${code-57}`;
  return ({40:'Enter',41:'Esc',42:'Backspace',43:'Tab',44:'Espaço',45:'-',46:'=',47:'[',48:']',49:'\\',51:';',52:"'",53:'`',54:',',55:'.',56:'/',57:'Caps',70:'Print',71:'Scroll',72:'Pause',73:'Insert',74:'Home',75:'PgUp',76:'Delete',77:'End',78:'PgDn',79:'→',80:'←',81:'↓',82:'↑',224:'Ctrl E',225:'Shift E',226:'Alt E',227:'Win E',228:'Ctrl D',229:'Shift D',230:'Alt D',231:'Win D'} as Record<number,string>)[code]??`0x${code.toString(16).toUpperCase().padStart(4,'0')}`;
}
