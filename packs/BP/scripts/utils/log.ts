import { VERSION_STR } from "../constants";

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

export function raise(message: string): never {
  throw new Error(makeErrorString(message));
}
