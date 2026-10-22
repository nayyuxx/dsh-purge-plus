// A short-lived nonce probe for checking whether the prompt injection path reaches
// the model. It does not change host permissions or approval policy.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { findDshHome } from "./core.js";

export const PROBE_SECTION = "dsh-purge:probe";
export const PROBE_TTL_MS = 30 * 60 * 1000;

function probePath(home) {
  const resolved = home || findDshHome();
  return resolved ? path.join(resolved, "dsh-purge", "probe.json") : "";
}

export function readProbe(home) {
  const file = probePath(home);
  if (!file) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!data || typeof data.nonce !== "string" || !/^purge-[0-9a-f]{8}$/.test(data.nonce)) return null;
    const at = Number(data.at) || 0;
    if (!at || Date.now() - at > PROBE_TTL_MS || at > Date.now() + 60_000) {
      try { fs.rmSync(file, { force: true }); } catch {}
      return null;
    }
    return { nonce: data.nonce, at };
  } catch {
    return null;
  }
}

export function createProbe(home) {
  const file = probePath(home);
  if (!file) throw new Error("Unable to locate the DSH data directory");
  const nonce = "purge-" + randomBytes(4).toString("hex");
  const at = Date.now();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + ".tmp";
  fs.writeFileSync(temp, JSON.stringify({ nonce, at }, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(temp, file);
  return { nonce, at, message: probeMessage(nonce) };
}

export function probeMessage(nonce) {
  if (typeof nonce !== "string" || !/^purge-[0-9a-f]{8}$/.test(nonce)) throw new Error("Invalid probe nonce");
  return [
    "请原样输出下面这行（不要改写、不要解释）：",
    `[${nonce}]`,
    "",
    "如果回复中出现这行随机标记，说明当前探针对应的提示词内容已到达模型上下文。",
  ].join("\n");
}

export function probeText(home) {
  const probe = readProbe(home);
  if (!probe) return "";
  return [
    "<dsh_probe>",
    "这条临时系统提示词用于验证提示词注入链路是否到达模型。",
    `如果本段在你的上下文里，请在回复的最后单独一行原样输出：[${probe.nonce}]`,
    "</dsh_probe>",
  ].join("\n");
}
