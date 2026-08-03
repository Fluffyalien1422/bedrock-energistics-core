import * as ipc from "mcbe-addon-ipc";
import { PublicErrorType } from "./error.js";
import { raisePublic } from "./log.js";
import { isBedrockEnergisticsCoreInWorld } from "./misc.js";

let ipcRouter: ipc.Router | undefined;
let initBecVersion: string | undefined;

/**
 * Initializes this package. Some APIs require this to be called.
 * Must be called after `worldLoad`.
 * @beta
 * @remarks
 * `uid` is passed straight to `mcbe-addon-ipc`'s `Router` as its own unique ID.
 * Two routers sharing an ID will receive each other's messages, so if your
 * add-on constructs a `Router` of its own, give it an ID different from the one
 * passed here. Anything identifying your add-on works, as long as nothing else
 * in the world uses it.
 * @param uid A unique ID. Must be between one and `MAX_ROUTER_UID_LENGTH`
 * characters (see `mcbe-addon-ipc`).
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidState} if this package has already been initialized, if Bedrock Energistics Core is not in the world, or if called before `worldLoad`.
 * @throws Throws a {@link PublicError} of type {@link PublicErrorType.InvalidArgument} if `uid` is empty or too long.
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

  try {
    ipcRouter = new ipc.Router(uid);
  } catch {
    raisePublic(
      PublicErrorType.InvalidArgument,
      `Cannot initialize library. The unique ID '${uid}' is ${uid.length.toString()} characters; it must be between 1 and ${ipc.MAX_ROUTER_UID_LENGTH.toString()}.`,
    );
  }
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
