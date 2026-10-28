import type { MouseStatus } from '@openmouse/protocol/drivers/mouse-types';
import type { KeyboardStatus } from '@openmouse/keyboard-protocol/drivers/keyboard-types';

export interface ProtocolDevice {
  physicalId: string; interfaceId: string; driver: string; kind: 'mouse'|'keyboard';
  name: string; brand: string; confirmed: boolean; error: string | null;
  mouse?: MouseStatus; keyboard?: KeyboardStatus; observedAt: number; catalogOnly?: boolean;
}
export interface PanelSnapshot {
  status: MouseStatus | null; keyboard: { name: string; family?: string; [key:string]:unknown } | null;
  pending: number; busy: boolean; error?: string;
}
export interface ProtocolPanelHost {
  deviceName?:string;
  showBattery?:boolean;
  hid: HID; initialTab: 'overview'|'performance'; artwork: string | null;
  artworkSource?: string | null; openArtworkSource?():void;
  capture(snapshot: PanelSnapshot): void; leave(): void;
}
declare global { interface Window { __CENTRAL_HUB_PANEL__?: ProtocolPanelHost } }
