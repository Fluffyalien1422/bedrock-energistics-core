/**
 * Recursively renders a value as a human-readable string with Minecraft
 * formatting codes (colored keys/values), for debug output such as the debug
 * commands. Objects and arrays are expanded inline.
 */
export function toPrettyString(obj: unknown): string {
  if (obj === null) return "§pnull§r";

  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      const items = obj.map((item) => toPrettyString(item));
      return `[${items.join(", ")}]`;
    }

    const entries = Object.entries(obj as Record<string, unknown>).map(
      ([k, v]) => `§s${k}§r: ${toPrettyString(v)}`,
    );
    return `{ ${entries.join(", ")} }`;
  }

  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return `§p${String(obj)}§r`;
}
