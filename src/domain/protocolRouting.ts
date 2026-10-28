import type { HardwareGroup } from './hardwareGroups';
import type { NativeInterface } from '../services/nativeHid';

export function configurationRoute(group:HardwareGroup):'via'|'upstream'|'native' {
  if(group.kind==='keyboard'&&group.via)return 'via';
  if(['mouse','keyboard'].includes(group.kind)&&group.protocol)return 'upstream';
  return 'native';
}
/** Pulsefire Haste's client matches a vendor/usage, also present on HyperX headsets.
 * Require its actual unnumbered 64-byte command channel before constructing it. */
export function upstreamDescriptorMatches(info:NativeInterface):boolean {
  if(![0x0951,0x03f0].includes(info.vendorId))return true;
  const size=(reports:readonly HIDReportInfo[])=>reports.some(r=>r.reportId===0&&r.items.reduce((n,i)=>n+i.reportSize*i.reportCount,0)===512);
  const matches=(cs:readonly HIDCollectionInfo[]):boolean=>cs.some(c=>c.usagePage===0xff00&&c.usage===1&&size(c.inputReports)&&size(c.outputReports)||matches(c.children));
  return matches(info.collections);
}
