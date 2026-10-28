// One-time adaptation of the vendored eb318ad snapshot. Changes are kept in Git.
// This script deliberately fails against an already-adapted or changed snapshot.
import { readFileSync, writeFileSync } from 'node:fs';
const base = new URL('../vendor/openmouse/src/', import.meta.url);
function edit(file, action) { const url=new URL(file,base);writeFileSync(url,action(readFileSync(url,'utf8')),'utf8'); }
function replace(source, before, after) { if(!source.includes(before))throw new Error(`Upstream changed: ${before.slice(0,90)}`);return source.replace(before,after); }
edit('device/controller.ts', s=>{
  s=replace(s,'const previewModeEnabled = previewsEnabled(__BUILD_CHANNEL__, import.meta.env.DEV);','const previewModeEnabled = false;');
  const start=s.indexOf('async function loadPreviewEntries():');const end=s.indexOf('export function start():',start);
  if(start<0||end<start)throw new Error('Preview block changed');
  s=s.slice(0,start)+'const previewShelfKeys: readonly FixturePreviewMode[] = [];\nasync function loadPreviewEntries(): Promise<void> {}\n\n'+s.slice(end);
  const previews=s.indexOf('  if (previewMode === "superstrike")',s.indexOf('export function start():'));
  const connect=s.indexOf('  if (!isAnyPreview)',previews);
  if(previews<0||connect<previews)throw new Error('Preview start changed');
  s=s.slice(0,previews)+s.slice(connect);
  const auto=s.indexOf('function startAutomaticRefresh():');const refresh=s.indexOf('async function refreshStatus():',auto);
  if(auto<0||refresh<auto)throw new Error('Refresh changed');
  s=s.slice(0,auto)+'function startAutomaticRefresh(): void {\n  if (refreshTimer !== null) window.clearInterval(refreshTimer);\n  refreshTimer = null;\n}\n\n'+s.slice(refresh);
  s=replace(s,'async function refreshStatus(): Promise<void> {','export async function refreshStatus(): Promise<void> {');
  s=replace(s,'  startHidCapture();','  // Native transport: do not patch prototypes or retain an input capture in the background.');
  s=replace(s,'    const retryDelays = [0, 40, 60, 75, 100, 150, 225, 350, 500, 750];','    const retryDelays = [0]; // Inventory is already available from the native host.');
  s += '\n/** Central Hub owns the session lifetime. */\nexport async function stop(): Promise<void> {\n  if (refreshTimer !== null) window.clearInterval(refreshTimer);\n  navigator.hid?.removeEventListener("connect", handleHidConnect);\n  navigator.hid?.removeEventListener("disconnect", handleHidDisconnect);\n  await active?.close().catch(() => undefined);\n  clearActiveClients();\n  clearActiveKeyboard();\n}\n';
  return s;
});
edit('features/settings/interface-preferences.ts',s=>s.replaceAll('openmouse-interface-settings-v1','central-hub-protocol-settings-v1').replace('theme: "Emerald",','theme: "Mono",').replace('colorMode: "System",','colorMode: "Dark",').replace('locale: "en",','locale: "pt",').replace('reducedMotion: false,','reducedMotion: true,').replace('showExperimental: true,','showExperimental: false,').replace('enabledSounds: true,','enabledSounds: false,'));
edit('styles/fonts.css',()=> '/* Central Hub uses installed system fonts; no network font downloads. */\n');
edit('shared/device-images.ts',()=>`/** Central Hub artwork: local catalog, user photo or its native photo resolver. */
export function deviceImage(_device?: HIDDevice | null, _name = ""): string {
  return window.parent.__CENTRAL_HUB_PANEL__?.artwork ?? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";
}
export function deviceImageFilename(_name = ""): string {return "central-hub-photo";}
export function isUnknownDevice(_device?: HIDDevice | null, _name = ""): boolean {return false;}
export function showcaseDeviceImageUrls(): readonly string[] {return [];}
export const UNKNOWN_DEVICE_FILENAME = "unknown-device.png";
`);
edit('platform/analytics.ts',()=>`/** Analytics disabled in the Central Hub distribution. */
export const ANALYTICS_READY_EVENT = "central-hub-analytics-disabled";
export function analyticsEnabled(): boolean {return false;}
export function analyticsAvailable(): boolean {return false;}
export function setAnalyticsEnabled(_enabled: boolean): void {}
export interface DeviceFacts {vendorId?: number; productId?: number; productName?: string; brand?: string}
export function deviceProps(_device?: DeviceFacts | null): Record<string,string|number> {return {};}
export function track(_event: string, _props?: Record<string,unknown>): void {}
export function scrubError(error: unknown): {error_name:string;error_message:string} {return {error_name:error instanceof Error ? error.name : "Error",error_message:String(error)};}
`);
edit('features/devices/cards/FirmwareCard.tsx',()=>`import type { ReactNode } from "react";
import type { ControlSnapshot } from "../../../device/types";
/** Read firmware identity only. Central Hub does not flash firmware or claim it is current. */
export function FirmwareCard({snapshot}:{snapshot:ControlSnapshot}):ReactNode {
  if(!snapshot.status)return null;
  return <section className="card"><h2>Firmware</h2><p>{snapshot.status.firmware.length ? snapshot.status.firmware.join(" · ") : "Não informado pelo dispositivo"}</p><small>A versão é lida do hardware. Atualizações de firmware não estão integradas.</small></section>;
}
`);
console.log('Adaptado: painel local, sem simulação, telemetria, polling ou downloads de firmware.');
