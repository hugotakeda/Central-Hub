import { expect,it,vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { discoverProtocols } from '../src/services/protocols';
import { createSupportedClient } from '../vendor/openmouse/src/device/device-clients';
vi.mock('@tauri-apps/api/core',()=>({Channel:class{},invoke:vi.fn(),isTauri:()=>true}));
vi.mock('@openmouse/protocol/drivers',()=>({SUPPORTED_HID_FILTERS:[{vendorId:0x0951}]}));
vi.mock('@openmouse/keyboard-protocol/drivers',()=>({SUPPORTED_HID_FILTERS:[],DEVICE_DRIVERS:[]}));
vi.mock('../vendor/openmouse/src/device/device-clients',()=>({createSupportedClient:vi.fn(),clientSupportScore:vi.fn(),deviceBrand:vi.fn()}));
import { hardwareGroups,canConfigure } from '../src/domain/hardwareGroups';
import { configurationRoute,upstreamDescriptorMatches } from '../src/domain/protocolRouting';
import type { HidScan } from '../src/domain/types';
it('keeps a Cloud Flight with an old failed HyperX mouse probe on the native audio configuration',()=>{
  const s:HidScan={available:true,error:null,devices:[{id:'flight-control',physical_id:'flight',vendor_id:0x0951,product_id:0x1723,product_string:'HyperX Cloud Flight Wireless',manufacturer:'HyperX',usage_page:0xff00,usage:1,interface_number:3,bus:'USB'}],audio:[{id:'output',physical_id:'flight',name:'Alto-falantes (HyperX Cloud Flight)',direction:'output',volume:40,muted:false}],protocols:[{physicalId:'flight',interfaceId:'flight-control',kind:'mouse',driver:'HyperX',brand:'HyperX',name:'HyperX Cloud Flight Wireless',confirmed:false,error:'HyperX control interface did not answer hardware info. Error: Relatório não declarado pelo dispositivo',observedAt:0}]};
  const group=hardwareGroups(s,[])[0];expect(group.kind).toBe('headset');expect(group.protocol).toBeUndefined();expect(configurationRoute(group)).toBe('native');expect(canConfigure(group)).toBe(true);expect(group.audio[0].id).toBe('output');
  expect(configurationRoute({...group,protocol:s.protocols![0]})).toBe('native');
});
it('refuses empty HyperX vendor collections and the Flight numbered 21 channel but permits the Haste 64-byte channel',()=>{
  const info={id:'flight',physicalId:'flight',vendorId:0x0951,productId:0x1723,productName:'Cloud Flight',collections:[{usagePage:0xff00,usage:1,inputReports:[],outputReports:[],featureReports:[],children:[]}]};
  expect(upstreamDescriptorMatches(info)).toBe(false);
  const report={reportId:0x21,items:[{reportSize:8,reportCount:19}]};
  expect(upstreamDescriptorMatches({...info,collections:[{...info.collections[0],usagePage:0xff90,usage:0x303,inputReports:[report],outputReports:[report]}]})).toBe(false);
  const haste={reportId:0,items:[{reportSize:8,reportCount:64}]};
  expect(upstreamDescriptorMatches({...info,productId:0x16e5,collections:[{...info.collections[0],inputReports:[haste],outputReports:[haste]}]})).toBe(true);
  expect(upstreamDescriptorMatches({...info,vendorId:0x046d})).toBe(true);
});
it('never constructs a mouse driver for an audio headset even if its vendor collection passes the mouse descriptor shape',async()=>{
  const report={reportId:0,items:[{reportSize:8,reportCount:64}]};
  vi.mocked(invoke).mockResolvedValue([{id:'control',physicalId:'flight',vendorId:0x0951,productId:0x1723,productName:'HyperX Cloud Flight',collections:[{usagePage:0xff00,usage:1,inputReports:[report],outputReports:[report],featureReports:[],children:[]}]}]);
  const s:HidScan={available:true,error:null,devices:[{id:'control',physical_id:'flight',vendor_id:0x0951,product_id:0x1723,product_string:'HyperX Cloud Flight',manufacturer:'HyperX',usage_page:0xff00,usage:1,interface_number:3,bus:'USB'}],audio:[]};
  expect(await discoverProtocols(s)).toEqual([]);expect(createSupportedClient).not.toHaveBeenCalled();
});
