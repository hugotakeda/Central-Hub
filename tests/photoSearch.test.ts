import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/services/bridge',()=>({desktop:true}));
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
import { invoke } from '@tauri-apps/api/core';
import type { OnlinePhoto, PhotoQuery } from '../src/domain/types';
const query: PhotoQuery={name:'G502 HERO',manufacturer:'Logitech',kind:'mouse'};
const photo=():OnlinePhoto=>({status:'ready',query:'Logitech G502 HERO',message:'Photo',source_url:'https://www.logitechg.com/g502-hero',image_url:'https://resource.logitechg.com/g502-hero.png',title:'G502 HERO',data_url:'data:image/png;base64,test',width:512,height:442,checked_at:Math.floor(Date.now()/1000),cached:false});
beforeEach(()=>{vi.resetModules();vi.mocked(invoke).mockReset();});
it('coalesces simultaneous requests and reuses the returned photo',async()=>{
  let finish!:(value:OnlinePhoto)=>void;vi.mocked(invoke).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve as typeof finish;}));
  const {resolvePhoto}=await import('../src/services/photoSearch');
  const one=resolvePhoto(query),two=resolvePhoto(query);expect(invoke).toHaveBeenCalledTimes(1);finish(photo());
  expect(await one).toEqual(await two);await resolvePhoto(query);expect(invoke).toHaveBeenCalledTimes(1);
});
it('allows an explicit refresh without discarding identity fields into the request',async()=>{
  vi.mocked(invoke).mockResolvedValue(photo());const {resolvePhoto}=await import('../src/services/photoSearch');await resolvePhoto(query);await resolvePhoto(query,true);
  expect(invoke).toHaveBeenLastCalledWith('resolve_device_photo',{query,force:true});expect(invoke).toHaveBeenCalledTimes(2);
});
it('does not retain disabled replies after internet search is enabled again',async()=>{
  vi.mocked(invoke).mockResolvedValueOnce({...photo(),status:'disabled',data_url:undefined}).mockResolvedValueOnce(photo());
  const {resolvePhoto}=await import('../src/services/photoSearch');await resolvePhoto(query);expect((await resolvePhoto(query)).status).toBe('ready');expect(invoke).toHaveBeenCalledTimes(2);
});
it('expires failed searches so a temporary network failure can recover',async()=>{
  vi.mocked(invoke).mockResolvedValueOnce({...photo(),status:'unavailable',checked_at:Math.floor(Date.now()/1000)-1000,data_url:undefined}).mockResolvedValueOnce(photo());
  const {resolvePhoto}=await import('../src/services/photoSearch');await resolvePhoto(query);expect((await resolvePhoto(query)).status).toBe('ready');expect(invoke).toHaveBeenCalledTimes(2);
});
it('reads the saved preference before enabling automatic queries',async()=>{
  vi.mocked(invoke).mockResolvedValue({enabled:false,cached_photos:2,cache_bytes:100});const {usePhotoStore}=await import('../src/services/photoSearch');await usePhotoStore.getState().initialize();
  expect(usePhotoStore.getState()).toMatchObject({enabled:false,ready:true,settings:{cached_photos:2}});
});
