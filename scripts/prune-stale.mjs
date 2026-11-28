// Unzipping a new version over an old project never deletes files that were removed or moved.
// A leftover file (for example the old app/api/admin/providers/route.ts) can then break `next build`.
//   node scripts/prune-stale.mjs            -> list files that are not part of this version (dry run)
//   node scripts/prune-stale.mjs --apply    -> delete them
import { existsSync, readdirSync, readFileSync, rmSync, rmdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keep = new Set(readFileSync(path.join(root, "scripts/manifest.txt"), "utf8").split("\n").map((l) => l.trim()).filter(Boolean));
const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = (p) => path.relative(root, p).split(path.sep).join("/");

const stale = ["app", "components", "lib", "tests"].filter((d) => existsSync(path.join(root, d))).flatMap((d) => walk(path.join(root, d))).map(rel).filter((f) => !keep.has(f));
if (!stale.length) { console.log("No stale files. The source tree matches this version."); process.exit(0); }
console.log((process.argv.includes("--apply") ? "Deleting" : "Stale files (not part of this version)") + ":");
for (const f of stale) console.log("  " + f);
if (!process.argv.includes("--apply")) { console.log("\nRun again with --apply to delete them."); process.exit(0); }
for (const f of stale) rmSync(path.join(root, f));
const dirs = new Set(stale.map((f) => path.dirname(f)));
for (const d of [...dirs].sort((a, b) => b.length - a.length)) { try { rmdirSync(path.join(root, d)); } catch {} }
console.log(`\nRemoved ${stale.length} file(s).`);
