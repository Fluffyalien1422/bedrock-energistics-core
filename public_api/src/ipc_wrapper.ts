import * as ipc from "mcbe-addon-ipc";
import { getNamespace } from "./init.js";

/**
 * @internal
 */
export function ipcSend(event: string, payload: ipc.SerializableValue): void {
  void ipc.sendAuto({ event, payload, namespace: getNamespace() });
}

/**
 * @internal
 */
export function ipcInvoke(
  event: string,
  payload: ipc.SerializableValue,
): Promise<ipc.SerializableValue> {
  return ipc.invokeAuto({ event, payload, namespace: getNamespace() });
}
