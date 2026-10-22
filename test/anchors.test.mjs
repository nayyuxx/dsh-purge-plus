import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readOverrides, writeOverride, clearOverride, applyOverrides } from "../lib/anchors.js";

test("anchor overrides round-trip, apply by index, and clear", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "purge-anchor-"));
  try {
    const patch = () => ({ id: 42, replacements: [
      { pattern: "old anchor", replace: "NEW" },
      { pattern: "other", replace: "OTHER" },
    ] });
    assert.deepEqual(readOverrides(home), {});
    writeOverride(home, 42, 0, "new anchor", { host: "0.2.1-rc.2", token: "must-not-be-stored" });
    const all = readOverrides(home);
    assert.equal(all["42"]["0"].pattern, "new anchor");
    assert.equal("token" in all["42"]["0"], false);
    const changed = applyOverrides(patch(), all);
    assert.equal(changed.overridden, true);
    assert.equal(changed.replacements[0].pattern, "new anchor");
    assert.equal(changed.replacements[1].pattern, "other");
    assert.equal(patch().replacements[0].pattern, "old anchor");
    clearOverride(home, 42, 0);
    assert.deepEqual(readOverrides(home), {});
    assert.equal(applyOverrides(patch(), { 42: { 9: { pattern: "x" } } }).overridden, undefined);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
