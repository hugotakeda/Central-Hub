import { create } from 'zustand';
import { peripheralCatalog } from './peripheralCatalog';
export interface AudioBinding { outputId:string; inputId:string|null; catalogId:string|null; name:string; brand:string }
const key='central-hub:v1:device-preferences';
function read():{showBattery:boolean;audioBindings:AudioBinding[]} {
  try { const v=JSON.parse(localStorage.getItem(key)??'{}');return {showBattery:v.showBattery!==false,audioBindings:Array.isArray(v.audioBindings)?v.audioBindings.filter((b:AudioBinding)=>b&&typeof b.outputId==='string'&&b.outputId.length<=2048&&typeof b.name==='string'&&b.name.length>0&&b.name.length<=100&&typeof b.brand==='string'&&(b.inputId===null||typeof b.inputId==='string')&&(b.catalogId===null||peripheralCatalog.some(p=>p.id===b.catalogId&&p.kind==='headset'))).slice(0,20):[]}; }catch{return {showBattery:true,audioBindings:[]};}
}
export const useDevicePreferences=create<ReturnType<typeof read>&{setShowBattery(value:boolean):void;bindAudio(value:AudioBinding):void;removeAudio(outputId:string):void}>((set,get)=>({
  ...read(),
  setShowBattery:showBattery=>{localStorage.setItem(key,JSON.stringify({...get(),showBattery}));set({showBattery});},
  bindAudio:value=>{if(get().audioBindings.length>=20&&!get().audioBindings.some(b=>b.outputId===value.outputId))throw new Error('Limite de 20 associações de áudio.');const audioBindings=[...get().audioBindings.filter(b=>b.outputId!==value.outputId),value];localStorage.setItem(key,JSON.stringify({...get(),audioBindings}));set({audioBindings});},
  removeAudio:outputId=>{const audioBindings=get().audioBindings.filter(b=>b.outputId!==outputId);localStorage.setItem(key,JSON.stringify({...get(),audioBindings}));set({audioBindings});},
}));
