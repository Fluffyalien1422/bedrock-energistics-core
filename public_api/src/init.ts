import * as ipc from "mcbe-addon-ipc";
import { PublicErrorType } from "./error.js";
import { raisePublic } from "./log.js";
import { isBedrockEnergisticsCoreInWorld } from "./misc.js";

let ipcRouter: ipc.Router | undefined;
let initBecVersion: string | undefined;

/**
 * Initializes this package. Some APIs require this to be called.
 * This must be called in the `worldLoad` after event.
 * @param uid A unique ID.
 * @beta
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has already been initialized, or if Bedrock Energistics Core is not in the world.
 */
export function init(uid: string): void {
  if (ipcRouter) {
    raisePublic(PublicErrorType.InvalidState, "Library already initialized.");
  }

  if (!isBedrockEnergisticsCoreInWorld()) {
    raisePublic(
      PublicErrorType.InvalidState,
      `Cannot initialize library (${uid}). Bedrock Energistics Core is not in the world.`,
    );
  }

  ipcRouter = new ipc.Router(uid);
}

/**
 * @internal
 */
export function getIpcRouter(): ipc.Router {
  if (!ipcRouter) {
    raisePublic(PublicErrorType.InvalidState, "Library not initialized.");
  }

  return ipcRouter;
}

/**
 * @internal
 */
export function tryGetIpcRouter(): ipc.Router | undefined {
  return ipcRouter;
}

/**
 * @internal
 */
export function __INIT_BEC__(version: string): void {
  initBecVersion = version;
}

/**
 * @internal
 */
export function __GET_INIT_BEC_VER__(): string | undefined {
  return initBecVersion;
}
