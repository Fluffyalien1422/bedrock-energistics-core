import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const scriptsDir = "BP/scripts";
const entryPoint = `${scriptsDir}/index.ts`;
const outfile = `${scriptsDir}/__bundle.js`;

/**
 * Automatically external every '__*.js' module (e.g. '__config.js',
 * 'generated/__recipes.js'). These are hand-editable or pre-generated runtime
 * modules that must stay out of the bundle so they can be edited/replaced after
 * building; they survive prod cleanup for the same reason (see the
 * 'prod_finish_up_build_scripts' filter, which keeps '__*.js').
 */
const externals = fs
  .readdirSync(scriptsDir, { recursive: true, encoding: "utf8" })
  .map((file) => `./${scriptsDir}/${file.replaceAll("\\", "/")}`)
  .filter(
    (file) => path.basename(file).startsWith("__") && file.endsWith(".js"),
  );

console.log(`Building with externals: '${externals.join("', '")}'.`);

await esbuild.build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  format: "esm",
  logLevel: "warning",
  preserveSymlinks: true,
  external: [...externals, "@minecraft/server", "@minecraft/server-ui"],
});

console.log("Done.");
