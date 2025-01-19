import { BecIpcListener } from "@/public_api/src/bec_ipc_listener";
import * as ipc from "mcbe-addon-ipc";

export const ipcRouter = new ipc.Router("fluffyalien_energisticscore_router");

export function registerListener(
  id: BecIpcListener,
  listener: (payload: ipc.SerializableValue) => ipc.SerializableValue,
): void {
  ipcRouter.registerListener(id, listener as ipc.ScriptEventListener);
}

export function ipcSend(event: string, payload: ipc.SerializableValue): void {
  void ipcRouter.sendAuto({ event, payload });
}

export function ipcInvoke(
  event: string,
  payload: ipc.SerializableValue,
  throwFailures = true,
): Promise<ipc.SerializableValue> {
  return ipcRouter.invokeAuto({ event, payload, throwFailures });
}
