import { stripTypeScriptTypes } from "node:module";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const sourceDir = join(rootDir, "src");
const outDir = join(rootDir, "public", "src");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.isFile() && extname(entry.name) === ".ts") {
      files.push(fullPath);
    }
  }

  return files;
}

function rewriteModuleSpecifiers(code) {
  return code
    .replace(/(from\s+["'][^"']+)\.ts(["'])/g, "$1.js$2")
    .replace(/(import\s*\(\s*["'][^"']+)\.ts(["']\s*\))/g, "$1.js$2");
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const sourceFiles = await walk(sourceDir);

for (const sourceFile of sourceFiles) {
  const relativePath = relative(sourceDir, sourceFile);
  const outFile = join(outDir, relativePath).replace(/\.ts$/, ".js");
  const source = await readFile(sourceFile, "utf8");
  const stripped = stripTypeScriptTypes(source, { mode: "strip" });
  const browserCode = rewriteModuleSpecifiers(stripped);

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, browserCode, "utf8");
}

await writeFile(
  join(rootDir, "public", "build-info.json"),
  JSON.stringify({ builtAt: new Date().toISOString(), files: sourceFiles.length }, null, 2),
  "utf8"
);

console.log(`Built ${sourceFiles.length} TypeScript modules into public/src`);