/** Central Hub preference; only display changes, never modifies hardware state. */
export function showBattery():boolean {
  return (window.parent as Window & {__CENTRAL_HUB_PANEL__?:{showBattery?:boolean}}).__CENTRAL_HUB_PANEL__?.showBattery!==false;
}
