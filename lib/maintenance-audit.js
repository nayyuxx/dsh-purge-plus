// Safe maintenance audit log. Records only explicit maintenance actions; never store prompts, tokens, or file contents.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const AUDIT_FILENAME = "maintenance-audit.jsonl";
export const AUDIT_MAX_BYTES = 1024 * 1024;
export const AUDIT_ROTATIONS = 2;

function resolveHome(explicitHome) {
  const supplied = String(explicitHome || process.env.DSH_HOME || "").trim();
  return supplied || path.join(os.homedir(), ".dsh");
}

export function auditFile(explicitHome) {
  return path.join(resolveHome(explicitHome), "dsh-purge-plus", AUDIT_FILENAME);
}

function rotate(file) {
  let size = 0;
  try { size = fs.statSync(file).size; } catch { return; }
  if (size < AUDIT_MAX_BYTES) return;
  for (let i = AUDIT_ROTATIONS; i >= 1; i -= 1) {
    const from = i === 1 ? file : `${file}.${i - 1}`;
    const to = `${file}.${i}`;
    try {
      if (fs.existsSync(to)) fs.rmSync(to, { force: true });
      if (fs.existsSync(from)) fs.renameSync(from, to);
    } catch { /* audit rotation must not interrupt normal operation */ }
  }
}

export function writeMaintenanceAudit(event, details = {}, explicitHome) {
  const name = String(event || "").trim();
  if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(name)) throw new Error("Invalid audit event name");
  const safeDetails = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(key)) continue;
    if (/(prompt|token|secret|password|credential|content|body)/i.test(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      const text = typeof value === "string" ? value.slice(0, 500) : value;
      safeDetails[key] = text;
    }
  }
  const file = auditFile(explicitHome);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  rotate(file);
  const row = { at: new Date().toISOString(), event: name, pid: process.pid, ...safeDetails };
  fs.appendFileSync(file, JSON.stringify(row) + "\n", { encoding: "utf8", mode: 0o600 });
  return row;
}

export function readMaintenanceAudit({ limit = 50, home } = {}) {
  const file = auditFile(home);
  let contents;
  try { contents = fs.readFileSync(file, "utf8"); } catch { return []; }
  const rows = [];
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row && typeof row === "object" && typeof row.event === "string") rows.push(row);
    } catch { /* ignore a partial final line */ }
  }
  const count = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 50;
  return rows.slice(-count).reverse();
}
