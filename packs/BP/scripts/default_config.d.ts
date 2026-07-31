/**
 * Type declarations for 'default_config.js'.
 *
 * 'default_config.js' does not exist in source — it is a build-time copy of the
 * user-editable '__config.js', made by the 'copy_default_config' filter (see
 * config.json) and bundled with the scripts to provide the trusted default
 * config values. Unlike '__config.js' (typed as 'unknown' because it is
 * hand-edited after install), these defaults are trusted, so the default export
 * is typed as {@link Config}.
 */

/** The add-on config. */
export interface Config {
  readonly customCommandNamespace: string;
}

declare const defaultConfig: Config;
export default defaultConfig;
