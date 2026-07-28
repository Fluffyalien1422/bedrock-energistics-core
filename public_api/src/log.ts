import { VERSION } from "./constants.js";
import { PublicErrorType } from "./error.js";
import { __GET_INIT_BEC_VER__, tryGetIpcRouter } from "./init.js";
import { createLogger } from "./shared_logger.js";

function makeLogString(logLevel: string, message: string): string {
  let namespace: string;

  const ipcRouter = tryGetIpcRouter();
  if (ipcRouter) {
    namespace = ipcRouter.uid;
  } else {
    const initBecVer = __GET_INIT_BEC_VER__();
    namespace = initBecVer ? `<internal v${initBecVer}>` : "<uninitialized>";
  }

  return `[Bedrock Energistics Core API v${VERSION}] (${namespace}) ${logLevel} ${message}`;
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
