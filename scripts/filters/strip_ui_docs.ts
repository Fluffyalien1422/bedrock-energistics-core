/**
 * Strips the '_doc' properties from the JSON UI files listed in
 * RP/ui/_ui_defs.json. '_doc' is used to generate the JSON UI reference guide
 * (see scripts/gen_json_ui_ref.ts), Minecraft does not allow it.
 */

import * as fs from "fs";

const uiDefsPath = "RP/ui/_ui_defs.json";

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function stripDocs(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(stripDocs);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const result: Record<string, JsonValue> = {};

  for (const [key, child] of Object.entries(value)) {
    if (key === "_doc") continue;
    result[key] = stripDocs(child);
  }

  return result;
}

const uiDefs = JSON.parse(fs.readFileSync(uiDefsPath, "utf8")) as {
  ui_defs: string[];
};

for (const uiDef of uiDefs.ui_defs) {
  const uiPath = `RP/${uiDef}`;

  const contents = JSON.parse(fs.readFileSync(uiPath, "utf8")) as JsonValue;

  fs.writeFileSync(uiPath, JSON.stringify(stripDocs(contents)));
}

console.log(
  `Stripped '_doc' from ${uiDefs.ui_defs.length.toString()} file(s).`,
);
