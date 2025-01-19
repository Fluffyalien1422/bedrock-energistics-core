import { VERSION } from "./constants.js";
import { tryGetIpcRouter } from "./init.js";

function makeLogString(logLevel: string, message: string): string {
  return `[Bedrock Energistics Core API v${VERSION}] (${tryGetIpcRouter()?.uid ?? "uninitialized"}) ${logLevel} ${message}`;
}

/**
 * @internal
 */
export function logInfo(message: string): void {
  console.info(makeLogString("INFO", message));
}

/**
 * @internal
 */
export function logWarn(message: string): void {
  console.warn(makeLogString("WARN", message));
}

/**
 * Note: prefer {@link raise} in most cases.
 * @internal
 */
export function makeErrorString(message: string): string {
  return makeLogString("ERROR", message);
}

/**
 * @internal
 */
export function raise(message: string): never {
  throw new Error(makeErrorString(message));
}
