import * as ipc from "mcbe-addon-ipc";
import { getIpcRouter } from "./init.js";
import { BecIpcListener } from "./bec_ipc_listener.js";
import { publicErrorFromIpcMessage } from "./error_internal.js";
import { logInfo } from "./log.js";

/**
 * Registers an IPC listener, replacing any listener already registered under
 * the same ID.
 * @internal
 * @remarks
 * Listener IDs are derived from the ID of the machine or item machine that owns
 * them, so registering the same one twice would throw. Overriding instead keeps
 * registration idempotent: re-registering a machine (which is allowed, and
 * overrides the previous definition) swaps its handlers, rather than throwing
 * partway through and leaving some listeners replaced and others stale.
 */
export function registerOrOverrideIpcListener(
  event: string,
  listener: ipc.ScriptEventListener,
): void {
  const ipcRouter = getIpcRouter();

  if (ipcRouter.removeListener(event)) {
    logInfo(`Overrode IPC listener '${event}'.`);
  }

  ipcRouter.registerListener(event, listener);
}

/**
 * @internal
 */
export function ipcSendAny(
  event: string,
  payload: ipc.SerializableValue,
): void {
  void getIpcRouter().sendAuto({ event, payload });
}

/**
 * @internal
 */
export function ipcSend(
  event: BecIpcListener,
  payload: ipc.SerializableValue,
): void {
  ipcSendAny(event, payload);
}

/**
 * Invokes a Bedrock Energistics Core IPC listener.
 * @internal
 * @remarks
 * A failure returned by the core pack is decoded back into the
 * {@link PublicError} it was raised as and thrown here, so the caller sees the
 * original error type rather than an opaque failure.
 * @throws Throws a `PublicError` if the listener reported one. Other errors
 * from the IPC layer (a timeout, for example) propagate untouched.
 */
export async function ipcInvoke<TResult extends ipc.SerializableValue>(
  event: BecIpcListener,
  payload: ipc.SerializableValue,
): Promise<TResult> {
  // Failures are returned rather than thrown so they can be told apart from
  // other IPC errors without inspecting what was caught.
  const result = await getIpcRouter().invokeAuto({
    event,
    payload,
    throwFailures: false,
  });

  if (result instanceof ipc.Failure) {
    throw publicErrorFromIpcMessage(result.message);
  }

  return result as TResult;
}
