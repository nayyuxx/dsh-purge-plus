// Local anchor overrides for host-version drift. This module stores only explicitly
// supplied patch-pattern replacements; it does not apply patches by itself.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function dshHome() {
  const env = String(process.env.DSH_HOME || "").trim();
  if (env) return env;
  return path.join(os.homedir(), ".dsh");
}

export const OVERRIDES_FILE = "anchor-overrides.json";

function file(explicit) {
  const home = explicit || dshHome();
  return home ? path.join(home, "dsh-purge", OVERRIDES_FILE) : "";
}

export function readOverrides(home) {
  const fp = file(home);
  if (!fp) return {};
  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function writeOverride(home, patchId, index, pattern, extra = {}) {
  if (typeof pattern !== "string" || !pattern) throw new Error("Override pattern must be a non-empty string");
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) throw new Error("Override index must be a non-negative integer");
  const fp = file(home);
  if (!fp) throw new Error("Unable to locate the DSH data directory");
  const all = readOverrides(home);
  const key = String(patchId);
  all[key] = all[key] || {};
  const safeExtra = {};
  for (const [name, value] of Object.entries(extra || {})) {
    if (!/^[a-z][a-z0-9_-]{0,40}$/i.test(name) || /(token|secret|password|credential|prompt|content)/i.test(name)) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      safeExtra[name] = typeof value === "string" ? value.slice(0, 200) : value;
    }
  }
  all[key][String(i)] = { pattern, at: new Date().toISOString(), ...safeExtra };
  fs.mkdirSync(path.dirname(fp), { recursive: true, mode: 0o700 });
  const temp = fp + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(temp, fp);
  return all;
}

export function clearOverride(home, patchId, index) {
  const all = readOverrides(home);
  const key = String(patchId);
  if (!all[key]) return all;
  if (index === undefined) delete all[key];
  else delete all[key][String(index)];
  if (all[key] && Object.keys(all[key]).length === 0) delete all[key];
  const fp = file(home);
  if (fp) {
    fs.mkdirSync(path.dirname(fp), { recursive: true, mode: 0o700 });
    const temp = fp + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(all, null, 2) + "\n", { mode: 0o600 });
    fs.renameSync(temp, fp);
  }
  return all;
}

/** Return a copy of the patch with valid per-index anchor overrides applied. */
export function applyOverrides(patch, overrides) {
  const mine = (overrides || {})[String(patch?.id)];
  if (!mine || typeof mine !== "object") return patch;
  const list = Array.isArray(patch.replacements)
    ? patch.replacements.slice()
    : (patch.patterns ?? []).map((pattern) => ({ pattern, replace: patch.replace }));
  let changed = false;
  for (const [index, entry] of Object.entries(mine)) {
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= list.length) continue;
    if (!entry || typeof entry.pattern !== "string" || !entry.pattern) continue;
    list[i] = { ...list[i], pattern: entry.pattern };
    changed = true;
  }
  return changed ? { ...patch, replacements: list, overridden: true } : patch;
}
