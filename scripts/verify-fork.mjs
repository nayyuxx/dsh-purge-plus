#!/usr/bin/env node
// Read-only fork-integrity check. It does not install, patch, or delete anything.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedRepo = "nayyuxx/dsh-purge-plus";
const problems = [];
const warnings = [];
const pass = [];
const ok = (label, detail = "") => pass.push({ label, detail });
const fail = (label, detail = "") => problems.push({ label, detail });
const warn = (label, detail = "") => warnings.push({ label, detail });
const exists = (rel) => fs.existsSync(path.join(root, rel));

let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  ok("package.json parses");
} catch (error) {
  fail("package.json parses", String(error));
  pkg = {};
}

const repoUrl = String(pkg.repository?.url || "");
const repoMatches = repoUrl.toLowerCase().includes(expectedRepo);
(repoMatches ? ok : fail)("repository points to target fork", repoUrl || "missing repository.url");
const homepageMatches = String(pkg.homepage || "").includes(expectedRepo);
(homepageMatches ? ok : warn)("homepage points to target fork", String(pkg.homepage || "missing"));
const bugsMatches = String(pkg.bugs?.url || "").includes(expectedRepo);
(bugsMatches ? ok : warn)("issue tracker points to target fork", String(pkg.bugs?.url || "missing"));

if (pkg.name === "dsh-purge-plus") ok("package name is dsh-purge-plus");
else fail("package name is dsh-purge-plus", "current value: " + String(pkg.name || "missing"));
if (pkg.version && pkg.dsh?.version && pkg.version === pkg.dsh.version) ok("package and DSH versions match");
else fail("package and DSH versions match", `package=${pkg.version || "missing"}, dsh.version=${pkg.dsh?.version || "missing"}`);

for (const rel of ["lib/index.js", "lib/core.js", "lib/rules.js", "lib/update.js", "lib/uninstall.js", "bin/dsh-purge.js", "client.js", "cordis.patch.yml", "LICENSE", "NOTICE.md"]) {
  (exists(rel) ? ok : fail)("required file exists: " + rel);
}
if (pkg.main && exists(pkg.main)) ok("package main exists", pkg.main);
else fail("package main exists", String(pkg.main || "missing"));
for (const [command, target] of Object.entries(pkg.bin || {})) {
  if (exists(target)) ok("CLI target exists: " + command, target);
  else fail("CLI target exists: " + command, target);
}
const install = pkg.dsh?.install || {};
const installTargets = [install.tarball, install.zip, install.git].filter(Boolean).join(" ");
if (installTargets.includes("YuJunZhiXue/dsh-purge") || installTargets.includes("luowang-ui/dsh-purge-plus") || installTargets.includes("nayyuxx/dsh-purge-plus2")) {
  fail("installer URLs do not point outside target fork", installTargets);
} else if (!installTargets.includes(expectedRepo)) {
  warn("installer URLs are configured for target fork", installTargets || "missing dsh.install targets");
} else {
  ok("installer URLs point to target fork");
}
const source = fs.readFileSync(path.join(root, "lib/index.js"), "utf8");
if (/export const name\s*=\s*["']dsh-purge-plus["']/.test(source)) ok("runtime plugin identity matches package");
else fail("runtime plugin identity matches package", "lib/index.js still exports a different plugin name");
const patch = fs.readFileSync(path.join(root, "cordis.patch.yml"), "utf8");
if (/name:\s*['"]dsh-purge-plus['"]/.test(patch)) ok("bundle patch uses the target plugin identity");
else fail("bundle patch uses the target plugin identity", "cordis.patch.yml still uses the legacy identity");

for (const s of ["test", "check:client", "smoke"]) {
  if (pkg.scripts?.[s]) ok("script configured: " + s, pkg.scripts[s]);
  else warn("script configured: " + s, "not configured yet");
}

console.log("Fork integrity check (read-only)");
console.log("Target: " + expectedRepo);
for (const item of pass) console.log("PASS  " + item.label + (item.detail ? " — " + item.detail : ""));
for (const item of warnings) console.log("WARN  " + item.label + (item.detail ? " — " + item.detail : ""));
for (const item of problems) console.log("FAIL  " + item.label + (item.detail ? " — " + item.detail : ""));
console.log(`Summary: ${pass.length} passed, ${warnings.length} warnings, ${problems.length} failures`);
if (problems.length) process.exitCode = 1;
