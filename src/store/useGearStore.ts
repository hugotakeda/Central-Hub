import { create } from 'zustand';
import type { HidScan, DeviceReading, DeviceSettingsSnapshot } from '../domain/types';
import { recordBattery } from '../domain/localData';
import { hardwareGroups, supportsSettings } from '../domain/hardwareGroups';
import * as bridge from '../services/bridge';
import { protocolPanelActive, protocolPanelBusy, refreshProtocolPanel } from '../services/protocols';
import type { PanelSnapshot } from '../services/protocolTypes';
export type Page = 'home' | 'device' | 'hardware' | 'settings' | 'test';
interface GearState {
  page: Page; selectedId: string; deviceTab: 'overview' | 'performance'; ready: boolean;
  notice: { message: string; error: boolean } | null; scan: HidScan | null; scanning: boolean;
  readings: Record<string, DeviceReading>; readingErrors: Record<string, string>;
  setReading(snapshot: DeviceSettingsSnapshot): void;
  clearReading(id: string, error: string): void;
  setProtocolReading(id: string, snapshot: PanelSnapshot): void;
  navigate(page: Page, id?: string, deviceTab?: 'overview' | 'performance'): void; initialize(): Promise<void>;
  changeAudio(id: string, volume: number | null, muted: boolean | null): Promise<boolean>;
  scanHid(): Promise<void>; notify(message: string, error?: boolean): void; clearNotice(): void;
}
let initialization: Promise<void> | null = null;
let pendingScan: Promise<void> | null = null;
let queuedScan = false;
export const useGearStore = create<GearState>((set, get) => ({
  page: 'home', selectedId: '', deviceTab:'overview', ready: false, notice: null, scan: null, scanning: false, readings: {}, readingErrors: {},
  setReading: snapshot => {
    const at = Date.now(); recordBattery(snapshot, at);
    set(s => ({ readings: { ...s.readings, [snapshot.device_id]: { snapshot, at } }, readingErrors: { ...s.readingErrors, [snapshot.device_id]: '' } }));
  },
  clearReading: (id, error) => set(s => ({ readings: Object.fromEntries(Object.entries(s.readings).filter(([key]) => key !== id)), readingErrors: { ...s.readingErrors, [id]: error } })),
  setProtocolReading: (id,value) => {
    if(value.pending||value.busy)return;
    set(s=>s.scan?{scan:{...s.scan,protocols:s.scan.protocols?.map(p=>p.physicalId===id&&value.status?{...p,mouse:value.status,name:value.status.name,brand:value.status.brand,confirmed:true,error:null,observedAt:Date.now()}:p)}}:{});
  },
  navigate: (page, id, deviceTab='overview') => {
    if(protocolPanelBusy()){get().notify('Aplique ou descarte os ajustes pendentes antes de sair da configuração.',true);return;}
    set({ page, deviceTab, ...(id ? { selectedId: id } : {}) });
  },
  initialize: () => {
    if (!initialization) initialization = get().scanHid().then(() => { set({ ready: true }); });
    return initialization;
  },
  changeAudio: async (id, volume, muted) => {
    if (!get().scan?.available || !get().scan?.audio.some(e => e.id === id)) {
      get().notify('Endpoint não disponível.', true); return false;
    }
    if ((volume === null && muted === null) || (volume !== null && (!Number.isInteger(volume) || volume < 0 || volume > 100))) {
      get().notify('Valor de áudio inválido.', true); return false;
    }
    try { await bridge.setAudioEndpoint(id, volume, muted); await get().scanHid(); return true; }
    catch (e) { get().notify(`Não foi possível alterar o áudio: ${String(e)}`, true); return false; }
  },
  scanHid: () => {
    if (protocolPanelActive()) return refreshProtocolPanel().catch(e=>{get().notify(String(e),true);});
    if (pendingScan) { queuedScan = true; return pendingScan; }
    set({ scanning: true });
    // Keep one native scan in flight; events received meanwhile request one fresh scan.
    pendingScan = (async () => {
      try {
        do {
          queuedScan = false;
          try {
            const scan = await bridge.scanHid();
            const ids = hardwareGroups(scan).filter(supportsSettings).map(g=>g.id);
            set(s => ({ scan, readings: Object.fromEntries(Object.entries(s.readings).filter(([id]) => ids.includes(id))), readingErrors: {} }));
            for (const id of ids) {
              try { get().setReading(await bridge.readDeviceSettings(id)); }
              catch (e) { get().clearReading(id, String(e)); }
            }
          }
          catch (e) { set({ scan: { devices: [], audio: [], available: false, error: String(e) }, readings: {}, readingErrors: {} }); }
        } while (queuedScan);
      } finally { pendingScan = null; set({ scanning: false }); }
    })();
    return pendingScan;
  },
  notify: (message, error = false) => set({ notice: { message, error } }),
  clearNotice: () => set({ notice: null }),
}));
