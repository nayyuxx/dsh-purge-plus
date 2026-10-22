import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { logAudit, readAudit, AUDIT_MAX_BYTES } from "../lib/audit.js";

test("audit appends, rotates, reads newest first, and filters sensitive fields", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "purge-audit-"));
  try {
    assert.deepEqual(readAudit({ home }), []);
    assert.equal(logAudit("apply", { applied: 75, prompt: "private", token: "secret", nonce: "purge-deadbeef" }, home), true);
    assert.equal(logAudit("probe", { ok: true }, home), true);
    const rows = readAudit({ home });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].event, "probe");
    assert.equal(rows[1].nonce, "purge-deadbeef");
    assert.equal("prompt" in rows[1], false);
    assert.equal("token" in rows[1], false);
    const file = path.join(home, "dsh-purge", "audit.jsonl");
    fs.appendFileSync(file, '{"broken\n');
    assert.equal(readAudit({ home }).length, 2);
    fs.writeFileSync(file, "x".repeat(AUDIT_MAX_BYTES + 10));
    logAudit("revert", { reverted: 3 }, home);
    assert(fs.existsSync(file + ".1"));
    assert.equal(readAudit({ home })[0].event, "revert");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
