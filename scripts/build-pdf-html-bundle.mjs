import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "src/lib/pdf/print-report-html.tsx");
const outfile = path.join(root, "src/lib/pdf/print-report-html.bundle.cjs");

const result = spawnSync(
  "npx",
  [
    "esbuild@0.25.9",
    entry,
    "--bundle",
    "--platform=node",
    "--format=cjs",
    `--outfile=${outfile}`,
    "--packages=external",
    `--alias:@=${path.join(root, "src")}`,
    "--loader:.tsx=tsx",
    "--loader:.ts=ts",
  ],
  { stdio: "inherit", cwd: root },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Wrote ${outfile}`);
