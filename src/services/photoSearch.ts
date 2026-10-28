import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { desktop } from './bridge';
import type { OnlinePhoto, PhotoQuery, PhotoSettings } from '../domain/types';
const pending = new Map<string, Promise<OnlinePhoto>>(), memory = new Map<string, OnlinePhoto>();
export const photoKey = (query: PhotoQuery) => JSON.stringify([query.manufacturer.trim().toLowerCase(), query.name.trim().toLowerCase(), query.kind]);
export async function resolvePhoto(query: PhotoQuery, force = false): Promise<OnlinePhoto> {
  if (!desktop) throw new Error('A busca de fotos funciona no aplicativo Windows.');
  const key = photoKey(query), existing = pending.get(key);
  if (existing) return existing;
  const cached = memory.get(key);
  const ttl = cached?.status === 'ready' ? 30 * 86400 : cached?.status === 'missing' ? 6 * 3600 : 15 * 60;
  if (cached && !force && Date.now() / 1000 - cached.checked_at < ttl) return cached;
  const job = invoke<OnlinePhoto>('resolve_device_photo', { query, force }).then(photo => {
    if (memory.size >= 24) memory.delete(memory.keys().next().value!);
    if (photo.status !== 'disabled') memory.set(key, photo); return photo;
  }).finally(() => pending.delete(key));
  pending.set(key, job); return job;
}
export function openPhotoSource(url: string): Promise<void> { return invoke('open_photo_source', { url }); }
interface PhotoState { enabled: boolean; ready: boolean; epoch: number; settings: PhotoSettings | null; error: string; initialize(): Promise<void>; refresh(): Promise<void>; setEnabled(enabled: boolean): Promise<void>; clearCache(): Promise<void>; }
let initialization: Promise<void> | null = null;
export const usePhotoStore = create<PhotoState>((set) => ({
  enabled: true, ready: false, epoch: 0, settings: null, error: '',
  initialize: () => {
    if (!initialization) initialization = (async () => {
      if (!desktop) { set({ enabled: false, ready: true }); return; }
      try { const settings = await invoke<PhotoSettings>('photo_settings'); set({ enabled: settings.enabled, settings, ready: true, error: '' }); }
      catch (error) { set({ enabled: false, ready: true, error: String(error) }); }
    })(); return initialization;
  },
  setEnabled: async enabled => {
    const settings = await invoke<PhotoSettings>('set_photo_search_enabled', { enabled });
    memory.clear(); set(s => ({ enabled, settings, error: '', epoch: s.epoch + 1 }));
  },
  refresh: async () => {
    if (!desktop) return;
    const settings=await invoke<PhotoSettings>('photo_settings');set({settings,enabled:settings.enabled,ready:true,error:''});
  },
  clearCache: async () => {
    const settings = await invoke<PhotoSettings>('clear_photo_cache');
    memory.clear(); set(s => ({ settings, error: '', epoch: s.epoch + 1 }));
  },
}));
