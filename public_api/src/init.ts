import { raise } from "./log.js";

let initNamespace: string | undefined;

/**
 * Initializes this package. Some APIs require this to be called.
 * @beta
 */
export function init(namespace: string): void {
  if (initNamespace) {
    raise("Library already initialized.");
  }

  initNamespace = namespace;
}

/**
 * @internal
 */
export function getNamespace(): string {
  if (!initNamespace) {
    raise("Library not initialized.");
  }

  return initNamespace;
}

/**
 * @internal
 */
export function tryGetNamespace(): string | undefined {
  return initNamespace;
}
