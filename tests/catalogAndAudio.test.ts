import { expect, it } from 'vitest';
import { peripheralCatalog, catalogProduct, searchHeadsets } from '../src/domain/peripheralCatalog';
import { hardwareGroups, peripheralDevices, illustration, canConfigure } from '../src/domain/hardwareGroups';
import { deviceBattery, batteryLabel } from '../src/domain/deviceBattery';
import type { HidScan } from '../src/domain/types';
it('imports all 225 supplied models, unique per category, with strict model matching',()=>{
  expect(new Set(peripheralCatalog.map(p=>p.id)).size).toBe(225);
  for(const kind of ['mouse','keyboard','headset'])expect(peripheralCatalog.filter(p=>p.kind===kind)).toHaveLength(75);
  for(const p of peripheralCatalog)expect(catalogProduct(p.name,p.brand,p.kind)?.id,p.name).toBe(p.id);
  expect(catalogProduct('AJ199 Pro','Ajazz','mouse')).toBeUndefined();
  expect(catalogProduct('F75 MAX','AULA','keyboard')).toBeUndefined();
  expect(catalogProduct('Gaming Keyboard','AULA','keyboard')).toBeUndefined();
  expect(searchHeadsets('zs10 pro').map(p=>p.name)).toEqual(['KZ ZS10 Pro X']);
  expect(searchHeadsets('','KZ').every(p=>p.brand==='KZ')).toBe(true);
  expect(searchHeadsets('modelo inexistente')).toEqual([]);
});
it('identifies affordable products by exact name without granting configuration or a fake battery',()=>{
  const s:HidScan={available:true,error:null,audio:[],devices:[{id:'aj',physical_id:'ajazz',vendor_id:0x9999,product_id:1,product_string:'AJ199',manufacturer:'Ajazz',usage_page:1,usage:2,interface_number:0,bus:'USB'}]};
  const g=peripheralDevices(s)[0];expect(g.name).toBe('Ajazz AJ199');expect(g.catalog?.brand).toBe('Ajazz');expect(canConfigure(g)).toBe(false);expect(deviceBattery(g)).toBeNull();expect(illustration(g).photoQuery?.name).toBe('Ajazz AJ199');
});
it('shows only active real audio outputs explicitly bound to a P2 model and keeps unrelated system speakers hidden',()=>{
  const s:HidScan={available:true,error:null,devices:[],audio:[{id:'realtek',physical_id:'adapter',name:'Alto-falantes (Realtek)',direction:'output',volume:35,muted:false,form_factor:'speakers'},{id:'mic',physical_id:'adapter',name:'Microfone Realtek',direction:'input',volume:70,muted:false}]};
  expect(peripheralDevices(s)).toEqual([]);
  const binding={outputId:'realtek',inputId:'mic',catalogId:'headset-kz-zsn-pro',name:'KZ ZSN Pro',brand:'KZ'};
  const groups=hardwareGroups(s,[binding]);expect(groups).toHaveLength(1);expect(groups[0]).toMatchObject({name:'KZ ZSN Pro',kind:'headset',identity:'user',audio:[{id:'realtek'},{id:'mic'}]});expect(canConfigure(groups[0])).toBe(true);expect(deviceBattery(groups[0])).toBeNull();
  expect(hardwareGroups({...s,audio:[]},[binding])).toEqual([]);
  const headphones={...s,audio:[{...s.audio[0],form_factor:'headphones'}]};expect(peripheralDevices(headphones)[0].kind).toBe('headset');
});
it('keeps reported zero battery, voltage-only readings and absence distinct',()=>{
  const g=hardwareGroups({available:true,error:null,devices:[],audio:[{id:'flight',name:'Cloud Flight',direction:'output',physical_id:'flight',volume:30,muted:false}],batteries:[{physical_id:'audio:flight',source:'Native',percent:0,voltage_mv:null,charging:false,observed_at_ms:1,error:null}]})[0];
  const zero={physical_id:g.id,source:'Native',percent:0,voltage_mv:null,charging:false,observed_at_ms:1,error:null};expect(g.battery?.percent).toBe(0);g.battery=zero;
  expect(deviceBattery(g)?.percent).toBe(0);expect(batteryLabel(zero)).toBe('0% · Em uso');expect(batteryLabel({...zero,percent:null,voltage_mv:3900,charging:null})).toBe('3900 mV');expect(batteryLabel(null)).toBe('Não informada');expect(batteryLabel({...zero,error:'Sem resposta'})).toBe('Não informada');
});
