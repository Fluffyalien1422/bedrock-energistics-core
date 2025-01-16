import * as ipc from "mcbe-addon-ipc";
import { getIpcRouter } from "./init.js";
import { BecIpcListener } from "./bec_ipc_listener.js";

/**
 * @internal
 */
export function ipcSend(
  event: BecIpcListener,
  payload: ipc.SerializableValue,
): void {
  void getIpcRouter().sendAuto({ event, payload });
}

/**
 * @internal
 */
export function ipcInvoke(
  event: BecIpcListener,
  payload: ipc.SerializableValue,
  throwFailures = true,
): Promise<ipc.SerializableValue> {
  return getIpcRouter().invokeAuto({ event, payload, throwFailures });
}
