/**
 * The raw, user-editable add-on config.
 *
 * '__config.js' is excluded from the bundle so it can be edited by hand, which
 * means its contents are untrusted. It is typed as 'unknown' on purpose:
 * always read validated values from 'config_manager.ts' instead of importing
 * this file directly.
 */
declare const config: unknown;
export default config;
