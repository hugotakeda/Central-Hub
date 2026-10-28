/** Central Hub artwork: local catalog, user photo or its native photo resolver. */
export function deviceImage(_device?: HIDDevice | null, _name = ""): string {
  return window.parent.__CENTRAL_HUB_PANEL__?.artwork ?? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";
}
export function deviceImageFilename(_name = ""): string {return "central-hub-photo";}
export function isUnknownDevice(_device?: HIDDevice | null, _name = ""): boolean {return false;}
export function showcaseDeviceImageUrls(): readonly string[] {return [];}
export const UNKNOWN_DEVICE_FILENAME = "unknown-device.png";
