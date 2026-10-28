import type { AudioEndpoint, DeviceVisual, DeviceKind, HidDevice, HidScan, ProductModel, SystemDevice } from './types';
export interface HardwareGroup {
  id: string; model?: ProductModel; name: string; kind: DeviceKind; hid: HidDevice[]; audio: AudioEndpoint[];
  identity: 'protocol' | 'model-name' | 'interface-group';
  virtual?: boolean;
  system?: SystemDevice[];
  protocol?: import('../services/protocolTypes').ProtocolDevice;
}
const models: { model: ProductModel; name: string; kind: DeviceKind; pattern: RegExp }[] = [
  { model: 'superlight', name: 'G Pro X Superlight', kind: 'mouse', pattern: /\bsuperlight\b(?!\s*(?:2|3|dex)\b)/i },
  { model: 'f75', name: 'Aula F75', kind: 'keyboard', pattern: /\bf75\b(?!\s*(?:pro|max)\b)/i },
  { model: 'cloud-flight', name: 'Cloud Flight', kind: 'headset', pattern: /\bcloud\s*flight\b(?!\s*(?:s|2|s2)\b)/i },
  { model: 'g-pro-tkl', name: 'G Pro TKL', kind: 'keyboard', pattern: /\b(?:g\s+)?pro\s+(?:gaming\s+)?keyboard\b/i },
];
export function hardwareGroups(scan: HidScan | null): HardwareGroup[] {
  if (!scan?.available) return [];
  const collections = new Map<string, HidDevice[]>();
  for (const device of scan.devices) {
    const key = device.physical_id ?? `interfaces:${device.vendor_id}:${device.product_id}:${device.product_string ?? device.id}`;
    const list = collections.get(key) ?? []; list.push(device); collections.set(key, list);
  }
  const groups: HardwareGroup[] = [];
  for (const [key, hid] of collections) {
    const verified = hid.find(d => d.identity)?.identity;
    const product = models.find(m => verified ? m.model === verified.model : m.model === 'g-pro-tkl' && hid.some(d => d.vendor_id === 0x046d && d.product_id === 0xc339) || hid.some(d => m.pattern.test(d.product_string ?? '')));
    const keyboard = hid.some(d => d.usage_page === 1 && d.usage === 6);
    const mouse = hid.some(d => d.usage_page === 1 && d.usage === 2);
    const controller = hid.some(d => d.usage_page === 1 && [4, 5, 8].includes(d.usage));
    const virtual = hid.some(d => d.virtual_device || d.vendor_id === 0x046d && d.product_id === 0xc232);
    const rawName = hid.find(d => d.product_string?.trim())?.product_string;
    const name = virtual && !rawName ? 'Logitech G HUB Virtual Keyboard' : rawName ?? `${keyboard ? 'Teclado' : mouse ? 'Mouse' : 'Dispositivo'} HID · ${hex(hid[0].vendor_id)}:${hex(hid[0].product_id)}`;
    groups.push({
      id: key, model: product?.model, name: product?.name ?? name,
      kind: product?.kind ?? (/keyboard|teclado/i.test(name) ? 'keyboard' : /receiver|receptor/i.test(name) ? 'unknown' : mouse && !keyboard ? 'mouse' : keyboard && !mouse ? 'keyboard' : controller ? 'controller' : 'unknown'),
      identity: product ? verified ? 'protocol' : 'model-name' : 'interface-group', hid, audio: [], virtual,
    });
  }
  for (const node of scan.system ?? []) {
    let group = groups.find(g => g.id === node.physical_id);
    if (!group) {
      const product = node.vendor_id === 0x046d && node.product_id === 0xc339 ? models.find(m => m.model === 'g-pro-tkl') : models.find(m => m.kind === node.kind && m.pattern.test(node.name));
      group = { id: node.physical_id, model: product?.model, name: product?.name ?? node.name, kind: product?.kind ?? node.kind, identity: product ? 'model-name' : 'interface-group', virtual: node.virtual_device, hid: [], audio: [], system: [] };
      groups.push(group);
    }
    (group.system ??= []).push(node);
    group.virtual ||= node.virtual_device;
  }
  for (const endpoint of scan.audio) {
    const product = models.find(m => m.kind === 'headset' && m.pattern.test(endpoint.name));
    let group = endpoint.physical_id ? groups.find(g => g.id === endpoint.physical_id || g.id === `audio:${endpoint.physical_id}`) : undefined;
    if (!group && product && !endpoint.physical_id) {
      const matches = groups.filter(g => g.model === product.model);
      if (matches.length === 1) group = matches[0];
    }
    if (!group) {
      group = { id: `audio:${endpoint.physical_id ?? endpoint.id}`, model: product?.model, name: product?.name ?? endpoint.name, kind: product?.kind ?? 'audio', identity: product ? 'model-name' : 'interface-group', hid: [], audio: [] };
      groups.push(group);
    }
    group.audio.push(endpoint);
    if (!group.model && group.kind === 'unknown') { group.kind = 'audio'; group.name = endpoint.name; }
  }
  for (const protocol of scan.protocols ?? []) {
    const group = groups.find(g => g.id === protocol.physicalId || g.hid.some(d => d.id === protocol.interfaceId));
    if (!group || group.virtual) continue;
    group.protocol = protocol;
    if (protocol.confirmed || protocol.catalogOnly) {
      group.name = group.model ? group.name : protocol.name;
      group.kind = protocol.kind;
      group.identity = protocol.catalogOnly ? 'model-name' : 'protocol';
    }
  }
  return groups.sort((a, b) => {
    const rank = (g: HardwareGroup) => { const i = models.findIndex(m => m.model === g.model); return i < 0 ? models.length : i; };
    return rank(a) - rank(b) || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);
  });
}
export function identifiedDevices(scan: HidScan | null): HardwareGroup[] {
  return hardwareGroups(scan).filter(group => group.identity !== 'interface-group');
}
export function peripheralDevices(scan: HidScan | null): HardwareGroup[] {
  return hardwareGroups(scan).filter(group => !group.virtual
    && ['mouse', 'keyboard', 'headset'].includes(group.kind)
    && (group.model || !/\b(?:receiver|receptor|dongle)\b/i.test(group.name)));
}
export function illustration(group: HardwareGroup): DeviceVisual {
  return { id: group.model ?? group.id, kind: group.kind, physicalId: group.id, virtual: group.virtual, photoQuery: { name: group.name, manufacturer: manufacturer(group), kind: group.kind } };
}
export function connectionLabel(group: HardwareGroup): string {
  if(group.protocol?.catalogOnly)return 'Detectado · modelo do catálogo';
  if (group.protocol?.confirmed) return group.protocol.mouse?.connectionType === 'Wireless' || group.protocol.keyboard?.connectionType === 'Wireless' ? 'Sem fio · identificado' : group.protocol.mouse?.connectionType === 'Wired' || group.protocol.keyboard?.connectionType === 'Wired' ? 'USB · identificado' : 'Protocolo identificado';
  if (isWirelessF75(group)) return group.hid.some(d=>d.identity_cached) ? '2,4 GHz · receptor presente' : '2,4 GHz · identificado';
  if (group.model === 'superlight' && group.identity === 'protocol') return group.hid.some(d => d.product_id === 0xc547) ? 'LIGHTSPEED · identificado' : 'USB · identificado';
  if (group.identity === 'protocol') return 'USB · identificado';
  if (group.audio.length) return 'Áudio disponível no Windows';
  if (group.virtual) return 'Interface virtual';
  return `${[...new Set(group.hid.map(d => d.bus))].join(' / ') || 'Windows'} · detectado`;
}
export const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');
export const kindLabel = (kind: DeviceKind) => ({ mouse: 'Mouse', keyboard: 'Teclado', headset: 'Headset', controller: 'Controle', audio: 'Áudio', unknown: 'Dispositivo' })[kind];
export const isWirelessF75 = (g: HardwareGroup) => g.model === 'f75' && g.hid.some(d=>d.vendor_id===0x3554 && d.product_id===0xfa09);
export const supportsSettings = (g: HardwareGroup) => !g.protocol && g.identity === 'protocol' && (g.model === 'superlight' || g.model === 'f75');
export const canConfigure = (g: HardwareGroup) => !!g.protocol || g.audio.length > 0 || supportsSettings(g);
export const manufacturer = (g: HardwareGroup) => g.protocol?.confirmed ? g.protocol.brand : g.model === 'g-pro-tkl' || g.model === 'superlight' ? 'Logitech' : g.model === 'f75' ? 'Aula' : g.model === 'cloud-flight' ? 'HyperX' : g.hid.find(d => d.manufacturer)?.manufacturer ?? 'Windows';
