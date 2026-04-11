import * as ipc from "mcbe-addon-ipc";
import { getIpcRouter } from "./init.js";
import { BecIpcListener } from "./bec_ipc_listener.js";

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
 * @internal
 */
export function ipcInvoke<TResult extends ipc.SerializableValue>(
  event: BecIpcListener,
  payload: ipc.SerializableValue,
  throwFailures?: true,
): Promise<TResult>;
export function ipcInvoke<TResult extends ipc.SerializableValue>(
  event: BecIpcListener,
  payload: ipc.SerializableValue,
  throwFailures: false,
): Promise<TResult | ipc.Failure>;
export function ipcInvoke<TResult extends ipc.SerializableValue>(
  event: BecIpcListener,
  payload: ipc.SerializableValue,
  throwFailures = true,
): Promise<TResult> {
  return getIpcRouter().invokeAuto({
    event,
    payload,
    throwFailures,
  }) as Promise<TResult>;
}
