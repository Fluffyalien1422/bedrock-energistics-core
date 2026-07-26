/**
 * Logging helpers. All messages are prefixed with the add-on name and version
 * so they're identifiable in the shared content log.
 */

import {
  InternalError,
  PublicError,
  PublicErrorType,
} from "@/public_api/src/error";
import { VERSION_STR } from "./constants";

/** Formats a message with the standard `[Bedrock Energistics Core vX] LEVEL` prefix. */
export function makeLogString(logLevel: string, message: string): string {
  return `[Bedrock Energistics Core v${VERSION_STR}] ${logLevel} ${message}`;
}

export function logInfo(message: string): void {
  console.info(makeLogString("INFO", message));
}

export function logWarn(message: string): void {
  console.warn(makeLogString("WARN", message));
}

/**
 * Note: prefer {@link raise} in most cases.
 */
export function makeErrorString(message: string): string {
  return makeLogString("ERROR", message);
}

/**
 * Throws an {@link InternalError} with the standard prefix. Return type `never`
 * narrows control flow.
 * @remarks
 * Use this for failures the caller can't act on. Thrown inside an IPC listener,
 * the error is logged and the calling add-on just receives `null`. If the
 * failure is the caller's mistake, use {@link raisePublic} instead.
 */
export function raise(message: string): never {
  throw new InternalError(makeErrorString(message));
}

/**
 * Throws a {@link PublicError} with the standard prefix. Return type `never`
 * narrows control flow.
 * @remarks
 * Use this for failures caused by the caller (an unregistered ID, a location
 * with no machine at it, and so on). Thrown inside an IPC listener, the error
 * is returned to the add-on that made the call instead of being logged here.
 * @param type Lets the caller handle the error programmatically.
 */
export function raisePublic(type: PublicErrorType, message: string): never {
  throw new PublicError(type, makeErrorString(message));
}
