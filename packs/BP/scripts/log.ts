import { PublicErrorType } from "@/public_api/src/error";
import { VERSION_STR } from "./constants";
import { createLogger } from "@/public_api/src/shared_logger";

export function makeLogString(logLevel: string, message: string): string {
  return `[Bedrock Energistics Core v${VERSION_STR}] ${logLevel} ${message}`;
}

const logger = createLogger(makeLogString);

/**
 * @internal
 */
export const logInfo = logger.logInfo;

/**
 * @internal
 */
export const logWarn = logger.logWarn;

// The following are wrapper functions instead of re-exports so that the return type is correctly `never`.

/**
 * Throws an {@link InternalError} with the standard prefix.
 * @internal
 * @remarks
 * Use this for failures the caller can't act on. Thrown inside an IPC listener,
 * the error is logged and the calling add-on just receives `null`. If the
 * failure is the caller's mistake, use {@link raisePublic} instead.
 */
export function raise(message: string): never {
  return logger.raise(message);
}

/**
 * Throws a {@link PublicError} with the standard prefix.
 * @internal
 * @remarks
 * Use this for failures caused by the caller. Thrown inside an IPC listener,
 * the error is returned to the add-on that made the call instead of being
 * logged by the pack that raised it.
 * @param type Lets the caller handle the error programmatically.
 */
export function raisePublic(type: PublicErrorType, message: string): never {
  return logger.raisePublic(type, message);
}
