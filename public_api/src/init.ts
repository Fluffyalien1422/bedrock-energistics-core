import * as ipc from "mcbe-addon-ipc";
import { raise } from "./log.js";

let ipcRouter: ipc.Router | undefined;

/**
 * Initializes this package. Some APIs require this to be called.
 * @beta
 */
export function init(namespace: string): void {
  if (ipcRouter) {
    raise("Library already initialized.");
  }

  ipcRouter = new ipc.Router(namespace);
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
