/**
 * Thin wrapper around the mcbe-addon-ipc router that carries messages between
 * this core pack and dependent add-ons (the public API embedded in them).
 */

import { BecIpcListener } from "@/public_api/src/bec_ipc_listener";
import * as ipc from "mcbe-addon-ipc";

export const ipcRouter = new ipc.Router("fluffyalien_energisticscore_router");

/** Registers a handler for an incoming IPC event from a dependent add-on. */
export function registerListener(
  id: BecIpcListener,
  listener: ipc.ScriptEventListener,
): void {
  ipcRouter.registerListener(id, listener);
}

/** Sends an event without awaiting a response. */
export function ipcSend(event: string, payload: ipc.SerializableValue): void {
  void ipcRouter.sendAuto({ event, payload });
}

/** Sends an event and resolves with the handler's result. */
export function ipcInvoke(
  event: string,
  payload: ipc.SerializableValue,
  throwFailures = true,
): Promise<ipc.SerializableValue> {
  return ipcRouter.invokeAuto({ event, payload, throwFailures });
}
