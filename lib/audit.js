// Append-only maintenance audit log. Sensitive field names are filtered and
// the log never records prompt/body/credential values.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const AUDIT_FILE = "audit.jsonl";
export const AUDIT_MAX_BYTES = 1024 * 1024;
export const AUDIT_KEEP = 2;

function dshHome(explicit) {
  const env = String(process.env.DSH_HOME || "").trim();
  if (env) return env;
  return explicit || path.join(os.homedir(), ".dsh");
}

function auditPath(home) {
  return path.join(home || dshHome(), "dsh-purge", AUDIT_FILE);
}

function rotate(file) {
  try {
    if (fs.statSync(file).size < AUDIT_MAX_BYTES) return;
  } catch { return; }
  for (let i = AUDIT_KEEP; i >= 1; i -= 1) {
    const from = i === 1 ? file : `${file}.${i - 1}`;
    const to = `${file}.${i}`;
    try {
      if (fs.existsSync(to)) fs.rmSync(to, { force: true });
      if (fs.existsSync(from)) fs.renameSync(from, to);
    } catch { /* audit logging must not interrupt the main operation */ }
  }
}

function safeFields(data) {
  const safe = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(key)) continue;
    if (/(prompt|token|secret|password|credential|authorization|content|body|cookie|api.?key)/i.test(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      safe[key] = typeof value === "string" ? value.slice(0, 300) : value;
    }
  }
  return safe;
}

export function logAudit(event, data = {}, home) {
  try {
    const name = String(event || "").trim();
    if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(name)) return false;
    const file = auditPath(home);
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    rotate(file);
    const row = { at: new Date().toISOString(), event: name, pid: process.pid, ...safeFields(data) };
    fs.appendFileSync(file, JSON.stringify(row) + "\n", { encoding: "utf8", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

export function readAudit({ limit = 50, home } = {}) {
  const file = auditPath(home);
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch { return []; }
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row && typeof row.event === "string") rows.push(row);
    } catch { /* ignore incomplete lines */ }
  }
  const count = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 50;
  return rows.slice(-count).reverse();
}
