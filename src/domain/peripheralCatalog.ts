import entries from './peripheralCatalog.json';
import type { DeviceKind } from './types';
export interface CatalogProduct { id:string; name:string; brand:string; kind:'mouse'|'keyboard'|'headset'; analog?:boolean }
export const peripheralCatalog=entries as CatalogProduct[];
export const normalizeModel=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function searchHeadsets(query:string,brand='') {
  const terms=query.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return peripheralCatalog.filter(p=>p.kind==='headset'&&(!brand||p.brand===brand)&&terms.every(t=>p.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(t)))
    .sort((a,b)=>Number(!!b.analog)-Number(!!a.analog)||a.name.localeCompare(b.name,'pt-BR'));
}
const descriptors=/\b(?:alto-falantes|speakers|headphones|headset|earphones|gaming|mouse|keyboard|teclado|usb|device|dispositivo|audio)\b/gi;
/** Exact normalized model/brand matching: no fuzzy prefix and no shared VID/PID guesses. */
export function catalogProduct(name:string,brand='',kind?:DeviceKind):CatalogProduct|undefined {
  const clean=name.replace(descriptors,'').trim(), full=normalizeModel(clean);
  const maker=normalizeModel(brand);
  const found=peripheralCatalog.filter(p=>(!kind||kind===p.kind||kind==='unknown'||kind==='audio') && (
    normalizeModel(p.name.replace(descriptors,''))===full || maker===normalizeModel(p.brand) && normalizeModel(p.name.slice(p.brand.length).replace(descriptors,''))===full
  ));
  return found.length===1?found[0]:undefined;
}
