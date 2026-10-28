import { expect, it } from 'vitest';
import { profileChanges, type LocalProfile } from '../src/domain/localData';
import type { MouseSettings, KeyboardSettings } from '../src/domain/types';
const mouse: MouseSettings={kind:'mouse',dpi:800,dpi_options:[400,800,1600],polling_hz:1000,polling_options:[125,500,1000],mode:2,battery_percent:38};
const profile=(settings: LocalProfile['settings']):LocalProfile=>({id:'p',name:'Saved',model:'superlight',created_at:1,settings});
it('applies only actual changed values and never switches mouse mode implicitly',()=>{
  expect(profileChanges(profile({...mouse,dpi:400,polling_hz:500}),mouse)).toEqual([{kind:'mouse_dpi',dpi:400},{kind:'mouse_polling',polling_hz:500}]);
  expect(profileChanges(profile({...mouse,battery_percent:1}),mouse)).toEqual([]);
});
it('rejects values not announced by the current device and onboard mode',()=>{
  expect(()=>profileChanges(profile({...mouse,dpi:999}),mouse)).toThrow();
  expect(()=>profileChanges(profile({...mouse,polling_hz:8000}),mouse)).toThrow();
  expect(()=>profileChanges(profile(mouse),{...mouse,mode:1})).toThrow();
});
it('keeps mixed lighting levels and rejects unsupported keyboard effects',()=>{
  const keyboard:KeyboardSettings={kind:'keyboard',effect:11,effect_options:[0,1,11,18],brightness:null,speed:null};
  expect(profileChanges(profile({...keyboard,effect:1}),keyboard)).toEqual([{kind:'keyboard_effect',effect:1}]);
  expect(()=>profileChanges(profile({...keyboard,effect:255}),keyboard)).toThrow();
  expect(()=>profileChanges(profile({...keyboard,brightness:0}),keyboard)).toThrow();
  expect(()=>profileChanges(profile(keyboard),mouse)).toThrow();
});

it('allows zero brightness only when the current keyboard transport supports it',()=>{
  const wireless:KeyboardSettings={kind:'keyboard',effect:15,effect_options:[0,15],brightness:3,speed:2,transport:'wireless',brightness_min:0};
  expect(profileChanges(profile({...wireless,brightness:0}),wireless)).toEqual([{kind:'keyboard_brightness',brightness:0}]);
  expect(()=>profileChanges(profile({...wireless,brightness:0}),{...wireless,transport:'usb',brightness_min:1})).toThrow();
});
