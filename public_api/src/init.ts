import * as ipc from "mcbe-addon-ipc";
import { raise } from "./log.js";
import { isBedrockEnergisticsCoreInWorld } from "./misc.js";

let ipcRouter: ipc.Router | undefined;
let initBecVersion: string | undefined;

/**
 * Initializes this package. Some APIs require this to be called.
 * This must be called in the `worldLoad` after event.
 * @param uid A unique ID.
 * @beta
 */
export function init(uid: string): void {
  if (ipcRouter) {
    raise("Library already initialized.");
  }

  if (!isBedrockEnergisticsCoreInWorld()) {
    raise(
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
    raise("Library not initialized.");
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
