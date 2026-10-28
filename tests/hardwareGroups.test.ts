import { describe, expect, it } from 'vitest';
import { hardwareGroups, identifiedDevices, illustration, peripheralDevices, supportsSettings, canConfigure, connectionLabel } from '../src/domain/hardwareGroups';
import type { HidDevice, HidScan, ModelIdentity } from '../src/domain/types';
const hid = (id: string, product: string, usage = 2): HidDevice => ({ id, vendor_id: 0x046d, product_id: 0xc547, product_string: product, manufacturer: 'Logitech', usage_page: 1, usage, interface_number: 0, bus: 'USB' });
const scan = (devices: HidDevice[] = []): HidScan => ({ devices, audio: [], error: null, available: true });
const superlight: ModelIdentity = { model: 'superlight', name: 'PRO X Wireless', method: 'HID++', model_code: '4093C0940000' };
const aula: ModelIdentity = { model: 'f75', name: 'AULA F75', method: 'Sinowealth', model_code: 'CD' };
describe('hardware discovery identities', () => {
  it('keeps empty and failed discovery empty', () => {
    expect(identifiedDevices(null)).toEqual([]);
    expect(identifiedDevices(scan())).toEqual([]);
    expect(identifiedDevices({ ...scan([hid('a', 'SUPERLIGHT')]), available: false })).toEqual([]);
  });
  it('keeps a receiver in diagnostics without inventing a mouse card', () => {
    const s = scan([hid('a', 'USB Receiver')]);
    expect(hardwareGroups(s)[0]).toMatchObject({ name: 'USB Receiver', identity: 'interface-group' });
    expect(identifiedDevices(s)).toEqual([]);
  });
  it('does not identify a generic keyboard by its shared VID/PID', () => {
    const d = { ...hid('b', 'Gaming Keyboard', 6), vendor_id: 0x258a, product_id: 0x010c };
    expect(hardwareGroups(scan([d]))[0]).toMatchObject({ name: 'Gaming Keyboard', identity: 'interface-group', kind: 'keyboard' });
    expect(identifiedDevices(scan([d]))).toEqual([]);
  });
  it('does not turn a keyboard with an auxiliary pointer collection into a mouse', () => {
    expect(hardwareGroups(scan([hid('a', 'Gaming Keyboard', 6), hid('b', 'Gaming Keyboard', 2)]))[0].kind).toBe('keyboard');
  });
  it('recognizes the original Superlight from an actual HID++ identity', () => {
    const groups = identifiedDevices(scan([{ ...hid('a', 'USB Receiver'), physical_id: 'receiver-a', identity: superlight }]));
    expect(groups[0]).toMatchObject({ id: 'receiver-a', model: 'superlight', kind: 'mouse', identity: 'protocol' });
    expect(illustration(groups[0]).id).toBe('superlight');
  });
  it('recognizes F75 through its returned model code despite the generic USB name', () => {
    const groups = identifiedDevices(scan([{ ...hid('b', 'Gaming Keyboard', 6), physical_id: 'keyboard-a', identity: aula }]));
    expect(groups[0]).toMatchObject({ model: 'f75', kind: 'keyboard', identity: 'protocol' });
    expect(illustration(groups[0]).id).toBe('f75');
  });
  it('uses container identity to merge collections without merging separate receivers', () => {
    const groups = hardwareGroups(scan([
      { ...hid('a', 'USB Receiver'), physical_id: 'receiver-a', identity: superlight },
      { ...hid('b', 'USB Receiver', 6), physical_id: 'receiver-a' },
      { ...hid('c', 'USB Receiver'), physical_id: 'receiver-b' },
    ]));
    expect(groups).toHaveLength(2);
    expect(groups[0].hid).toHaveLength(2);
    expect(groups[1].model).toBeUndefined();
  });
  it('keeps Cloud Flight audio available when HID fails', () => {
    const s = { ...scan(), error: 'HID indisponível', audio: [{ id: 'endpoint', name: 'Alto-falantes (HyperX Cloud Flight Wireless)', direction: 'output' as const, volume: 30, muted: false }] };
    expect(identifiedDevices(s)[0]).toMatchObject({ model: 'cloud-flight', audio: [{ id: 'endpoint' }] });
  });
  it('does not use original product photos for newer model names', () => {
    expect(identifiedDevices(scan([hid('a', 'PRO X SUPERLIGHT 2')]))).toEqual([]);
    expect(identifiedDevices(scan([hid('b', 'AULA F75 Pro', 6)]))).toEqual([]);
  });
  it('puts exactly the identified models on the home screen in product order', () => {
    const s: HidScan = { ...scan([
      { ...hid('a', 'USB Receiver'), physical_id: 'mouse', identity: superlight },
      { ...hid('b', 'Gaming Keyboard', 6), physical_id: 'keyboard', identity: aula },
      { ...hid('c', '2.4G Wireless Receiver', 6), physical_id: 'dongle' },
    ]), audio: [{ id: 'flight', name: 'HyperX Cloud Flight Wireless', direction: 'output', volume: null, muted: null }] };
    expect(identifiedDevices(s).map(d => d.model)).toEqual(['superlight', 'f75', 'cloud-flight']);
    expect(hardwareGroups(s)).toHaveLength(4);
  });
});

it('detects unknown vendor HID devices without assigning a product image', () => {
  const d: HidDevice = { id: 'controller', physical_id: 'cooler', vendor_id: 0x1e71, product_id: 0x3014, product_string: 'Cooling Controller', manufacturer: 'NZXT', usage_page: 0xff00, usage: 1, interface_number: 0, bus: 'USB' };
  const groups = hardwareGroups(scan([d]));
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({ name: 'Cooling Controller', kind: 'unknown', model: undefined });
  expect(illustration(groups[0]).id).toBe('cooler');
});
it('recognizes a wired G Pro TKL by its USB product ID without claiming a configuration driver', () => {
  const groups = hardwareGroups(scan([{ ...hid('pro', '', 6), physical_id: 'pro-tkl', product_id: 0xc339 }]));
  expect(groups[0]).toMatchObject({ model: 'g-pro-tkl', name: 'G Pro TKL', identity: 'model-name', kind: 'keyboard' });
});
it('includes PnP-only keyboards, including devices missing from HIDAPI', () => {
  const s: HidScan = { ...scan(), system: [{ id:'node',physical_id:'pnp-only',name:'PS/2 Keyboard',manufacturer:null,kind:'keyboard',vendor_id:null,product_id:null,driver_version:'10.0',virtual_device:false }] };
  expect(hardwareGroups(s)[0]).toMatchObject({ id:'pnp-only',name:'PS/2 Keyboard',kind:'keyboard',hid:[],system:[{id:'node'}] });
});
it('merges PnP entries into the existing physical HID device', () => {
  const s: HidScan = { ...scan([{ ...hid('pro','PRO Gaming Keyboard',6),physical_id:'pro',product_id:0xc339 }]),system:[{id:'node',physical_id:'pro',name:'HID Keyboard',manufacturer:'Logitech',kind:'keyboard',vendor_id:0x046d,product_id:0xc339,driver_version:null,virtual_device:false}] };
  expect(hardwareGroups(s)).toHaveLength(1);
  expect(hardwareGroups(s)[0].system).toHaveLength(1);
});
it('shows generic audio and groups input/output by real container ID', () => {
  const s: HidScan = { ...scan(),audio:[{id:'out',name:'Speakers (USB Audio)',direction:'output',volume:10,muted:false,physical_id:'audio-container'},{id:'in',name:'Mic (USB Audio)',direction:'input',volume:20,muted:false,physical_id:'audio-container'}] };
  const groups=hardwareGroups(s);
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({kind:'audio',model:undefined,audio:[{id:'out'},{id:'in'}]});
});
it('does not merge two identical headsets when their containers differ', () => {
  const s: HidScan = { ...scan(),audio:[{id:'a',name:'Cloud Flight',direction:'output',volume:10,muted:false,physical_id:'one'},{id:'b',name:'Cloud Flight',direction:'output',volume:20,muted:false,physical_id:'two'}] };
  expect(hardwareGroups(s)).toHaveLength(2);
});

it('keeps internal controllers, generic receivers and motherboard audio out of the peripheral list', () => {
  const s: HidScan = { ...scan([
    {...hid('f75','Gaming Keyboard',6),physical_id:'f75',identity:aula},
    {...hid('wireless','2.4G Wireless Receiver',6),physical_id:'wireless'},
    {...hid('usb','USB Receiver'),physical_id:'usb'},
    {...hid('hub','NZXT Control Hub',1),physical_id:'hub',vendor_id:0x1e71,usage_page:0xff00},
    {...hid('cooler','NZXT Kraken Plus V2',1),physical_id:'cooler',vendor_id:0x1e71,usage_page:0xff00},
  ]), audio:[
    {id:'flight',name:'HyperX Cloud Flight',direction:'output',volume:null,muted:null},
    {id:'realtek',name:'Alto-falantes (Realtek USB2.0 Audio)',direction:'output',volume:null,muted:null},
  ] };
  expect(peripheralDevices(s).map(g=>g.name)).toEqual(['Aula F75','Cloud Flight']);
  expect(hardwareGroups(s)).toHaveLength(7);
  expect(s.devices).toHaveLength(5);
  expect(s.audio).toHaveLength(2);
});

it('retains other physical mice and keyboards without requiring a catalog entry', () => {
  const s=scan([
    {...hid('mouse','Other Mouse'),physical_id:'mouse'},
    {...hid('keyboard','Other Keyboard',6),physical_id:'keyboard'},
    {...hid('pro','PRO Gaming Keyboard',6),physical_id:'pro',product_id:0xc339},
    {...hid('superlight','USB Receiver'),physical_id:'superlight',identity:superlight},
  ]);
  expect(peripheralDevices(s).map(g=>g.id).sort()).toEqual(['keyboard','mouse','pro','superlight']);
});

it('excludes virtual input and unconfirmed keyboard receivers even when they advertise keyboard usage', () => {
  const s=scan([
    {...hid('virtual','Virtual Keyboard',6),physical_id:'virtual',virtual_device:true},
    {...hid('dongle','Wireless Keyboard Receiver',6),physical_id:'dongle'},
  ]);
  expect(peripheralDevices(s)).toEqual([]);
  expect(hardwareGroups(s)).toHaveLength(2);
});

it('shows a protocol-confirmed wireless F75 as a keyboard with its photo and correct connection', () => {
  const s=scan([{...hid('wireless','2.4G Wireless Receiver',6),physical_id:'wireless',vendor_id:0x3554,product_id:0xfa09,identity:{...aula,method:'Compx 2.4 GHz · identificação'}}]);
  const groups=peripheralDevices(s);
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({name:'Aula F75',kind:'keyboard',model:'f75'});
  expect(illustration(groups[0]).id).toBe('f75');
  expect(connectionLabel(groups[0])).toBe('2,4 GHz · identificado');
  expect(connectionLabel({...groups[0],hid:groups[0].hid.map(d=>({...d,identity_cached:true}))})).toBe('2,4 GHz · receptor presente');
  expect(supportsSettings(groups[0])).toBe(false);
  expect(canConfigure(groups[0])).toBe(false);
});
