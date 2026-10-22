import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSnapshot, verifySnapshot, restoreSnapshot } from "../lib/maintenance-backup.js";
import { readMaintenanceAudit, writeMaintenanceAudit } from "../lib/maintenance-audit.js";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dsh-purge-maintenance-"));
}

test("snapshot verifies and restores to a new destination", () => {
  const root = tempDir();
  try {
    const source = path.join(root, "source");
    const backupRoot = path.join(root, "backups");
    const destination = path.join(root, "restored");
    fs.mkdirSync(path.join(source, "nested"), { recursive: true });
    fs.writeFileSync(path.join(source, "package.json"), '{"name":"test"}\n');
    fs.writeFileSync(path.join(source, "nested", "note.txt"), "keep me\n");
    const snapshot = createSnapshot(source, backupRoot);
    assert.equal(snapshot.manifest.fileCount, 2);
    assert.equal(verifySnapshot(snapshot.snapshotDir).ok, true);
    const restored = restoreSnapshot(snapshot.snapshotDir, destination);
    assert.equal(restored.fileCount, 2);
    assert.equal(fs.readFileSync(path.join(destination, "nested", "note.txt"), "utf8"), "keep me\n");
    assert.throws(() => restoreSnapshot(snapshot.snapshotDir, destination), /already exists/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("snapshot verification detects modified files and refuses restore", () => {
  const root = tempDir();
  try {
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "data.txt"), "original");
    const snapshot = createSnapshot(source, path.join(root, "backups"));
    fs.writeFileSync(path.join(snapshot.snapshotDir, "data.txt"), "changed");
    const report = verifySnapshot(snapshot.snapshotDir);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => e.includes("hash mismatch")));
    assert.throws(() => restoreSnapshot(snapshot.snapshotDir, path.join(root, "restored")), /verification failed/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("snapshot rejects symlinks and backup directories inside the source", { skip: process.platform === "win32" }) => {
  const root = tempDir();
  try {
    const source = path.join(root, "source");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(root, "outside.txt"), "x");
    fs.symlinkSync(path.join(root, "outside.txt"), path.join(source, "link.txt"));
    assert.throws(() => createSnapshot(source, path.join(root, "backups")), /symbolic link/);
    fs.rmSync(path.join(source, "link.txt"));
    assert.throws(() => createSnapshot(source, path.join(source, "backups")), /inside the source/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("audit log omits sensitive fields and reads newest entries first", () => {
  const root = tempDir();
  try {
    writeMaintenanceAudit("backup", { count: 2, prompt: "private prompt", note: "snapshot done" }, root);
    writeMaintenanceAudit("verify", { ok: true }, root);
    const rows = readMaintenanceAudit({ limit: 10, home: root });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].event, "verify");
    assert.equal(rows[1].event, "backup");
    assert.equal("prompt" in rows[1], false);
    assert.equal(rows[1].note, "snapshot done");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
