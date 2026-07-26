/**
 * Thin wrapper around the mcbe-addon-ipc router that carries messages between
 * this core pack and dependent add-ons (the public API embedded in them).
 */

import { BecIpcListener } from "@/public_api/src/bec_ipc_listener";
import { PublicError } from "@/public_api/src/error";
import { publicErrorToIpcMessage } from "@/public_api/src/error_internal";
import * as ipc from "mcbe-addon-ipc";

export const ipcRouter = new ipc.Router("fluffyalien_energisticscore_router");

/**
 * Registers a handler for an incoming IPC event from a dependent add-on.
 * @remarks
 * Errors are split by audience. A {@link PublicError} is the caller's mistake,
 * so it's returned as an `ipc.Failure` encoding both its type and message: for
 * an invoke, the public API decodes it and rethrows it on the calling add-on's
 * side; for a send, mcbe-addon-ipc logs it (there is no caller to return it
 * to). Anything else is a bug in this pack, so it's rethrown for
 * mcbe-addon-ipc to catch and log, and the caller receives `null`.
 */
export function registerListener(
  id: BecIpcListener,
  listener: ipc.ScriptEventListener,
): void {
  ipcRouter.registerListener(id, async (payload) => {
    try {
      // Awaited (rather than returned) so that a rejected async listener is
      // caught here too, not just a synchronous throw.
      return await listener(payload);
    } catch (e) {
      if (e instanceof PublicError) {
        return new ipc.Failure(publicErrorToIpcMessage(e));
      }
      throw e;
    }
  });
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
