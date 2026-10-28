import type { ReactNode } from "react";
import type { ControlSnapshot } from "../../../device/types";
/** Read firmware identity only. Central Hub does not flash firmware or claim it is current. */
export function FirmwareCard({snapshot}:{snapshot:ControlSnapshot}):ReactNode {
  if(!snapshot.status)return null;
  return <section className="card"><h2>Firmware</h2><p>{snapshot.status.firmware.length ? snapshot.status.firmware.join(" · ") : "Não informado pelo dispositivo"}</p><small>A versão é lida do hardware. Atualizações de firmware não estão integradas.</small></section>;
}
