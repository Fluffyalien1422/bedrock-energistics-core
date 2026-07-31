/**
 * Add-on config system.
 *
 * '__config.js' holds the config and is excluded from the script bundle so it
 * can be edited by hand after installation. Because it is hand-edited, its
 * contents are untrusted: every option is optional and may be of any type.
 *
 * At build time '__config.js' is copied to 'default_config.js' (by the
 * 'copy_default_config' filter) and bundled with the scripts to provide the
 * trusted {@link DEFAULT_CONFIG} defaults. This module validates the untrusted
 * config against those defaults and exports a fully-typed {@link CONFIG}.
 * Missing or wrong-typed options never throw — they fall back to their default
 * and log a warning via {@link logWarn}. Read config values from the exported
 * `CONFIG`; never import '__config.js' directly.
 *
 * To add a new config option:
 *   1. Add it to '__config.js' with its default value. It is copied into
 *      {@link DEFAULT_CONFIG} at build time, so the default lives only there.
 *   2. Add the field to the {@link Config} interface in 'default_config.d.ts'
 *      so it is typed.
 *   3. Read it in `loadConfig()`: add a `readPrimitive(...)` call, and add its
 *      key to the `warnUnknownKeys(...)` list there.
 */

import rawConfig from "./__config";
import DEFAULT_CONFIG, { Config } from "./default_config";
import { logWarn } from "./log";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Warns about keys present in the config that are not recognized. */
function warnUnknownKeys(
  container: Record<string, unknown>,
  knownKeys: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(container)) {
    if (!knownKeys.includes(key)) {
      logWarn(`Unknown config option '${path}${key}' will be ignored.`);
    }
  }
}

/**
 * Reads a primitive config option, falling back to (and warning about) the
 * default if it is missing or the wrong type. The expected type is inferred
 * from the type of the default value.
 */
function readPrimitive<T extends number | boolean | string>(
  container: Record<string, unknown>,
  key: string,
  defaultValue: T,
  path: string,
): T {
  const value = container[key];
  if (value === undefined) return defaultValue;
  if (typeof value !== typeof defaultValue) {
    logWarn(
      `Config option '${path}' should be of type '${typeof defaultValue}' but got '${typeof value}'. Using the default value (${String(defaultValue)}).`,
    );
    return defaultValue;
  }
  return value as T;
}

function loadConfig(): Config {
  if (!isRecord(rawConfig)) {
    logWarn("The config should be an object. Using the default config.");
    return DEFAULT_CONFIG;
  }
  warnUnknownKeys(rawConfig, ["customCommandNamespace"], "");
  return {
    customCommandNamespace: readPrimitive(
      rawConfig,
      "customCommandNamespace",
      DEFAULT_CONFIG.customCommandNamespace,
      "customCommandNamespace",
    ),
  };
}

/**
 * The validated add-on config. Read config options from here; do not import
 * '__config.js' directly.
 */
export const CONFIG: Config = loadConfig();
