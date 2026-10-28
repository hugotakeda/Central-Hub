import type { MouseStatus } from '@openmouse/protocol/drivers/mouse-types';
/** Never turn a write-only driver's assumed defaults into current hardware readings. */
export function settingsAreReported(status:MouseStatus|null|undefined):boolean {
  return !!status && status.ui?.valuesVerified!==false && (status.ui?.settingsReady!==false || status.ui?.valuesVerified===true);
}
