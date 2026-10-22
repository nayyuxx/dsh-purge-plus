import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProbe, readProbe, probeText, probeMessage, PROBE_TTL_MS } from "../lib/probe.js";

test("probe is short-lived, single-valued, and malformed state is ignored", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "purge-probe-"));
  try {
    assert.equal(readProbe(home), null);
    assert.equal(probeText(home), "");
    const created = createProbe(home);
    assert.match(created.nonce, /^purge-[0-9a-f]{8}$/);
    assert.equal(readProbe(home).nonce, created.nonce);
    assert(probeText(home).includes(created.nonce));
    assert(probeMessage(created.nonce).includes(created.nonce));
    const file = path.join(home, "dsh-purge", "probe.json");
    fs.writeFileSync(file, JSON.stringify({ nonce: created.nonce, at: Date.now() - PROBE_TTL_MS - 1000 }));
    assert.equal(readProbe(home), null);
    assert.equal(probeText(home), "");
    fs.writeFileSync(file, "{oops");
    assert.equal(readProbe(home), null);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
