/**
 * Logging helpers. All messages are prefixed with the add-on name and version
 * so they're identifiable in the shared content log.
 */

import { VERSION_STR } from "../constants";

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

/** Throws an `Error` with the standard prefix. Return type `never` narrows control flow. */
export function raise(message: string): never {
  throw new Error(makeErrorString(message));
}
