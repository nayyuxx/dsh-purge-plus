#!/usr/bin/env node
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createSnapshot, restoreSnapshot, verifySnapshot } from "../lib/maintenance-backup.js";
import { readMaintenanceAudit } from "../lib/maintenance-audit.js";

function usage() {
  console.log(`purge-maintenance — safe local maintenance tools
  purge-maintenance backup <source-directory> <backup-directory>
  purge-maintenance verify <snapshot-directory>
  purge-maintenance restore <snapshot-directory> <new-destination-directory>
  purge-maintenance audit [limit] [DSH_HOME]

Restore never overwrites an existing destination. These commands do not apply host patches.`);
}

async function main(args) {
  const [command, first, second, third] = args;
  if (!command || command === "help" || command === "--help" || command === "-h") return usage();
  if (command === "backup") {
    if (!first || !second) throw new Error("backup requires source and backup directories");
    const result = createSnapshot(first, second);
    console.log(JSON.stringify({ ok: true, snapshotDir: result.snapshotDir, fileCount: result.manifest.fileCount }, null, 2));
    return;
  }
  if (command === "verify") {
    if (!first) throw new Error("verify requires a snapshot directory");
    const result = verifySnapshot(first);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "restore") {
    if (!first || !second) throw new Error("restore requires snapshot directory and a NEW destination directory");
    const result = restoreSnapshot(first, second);
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
    return;
  }
  if (command === "audit") {
    const limit = first === undefined ? 50 : Number(first);
    if (first !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 500)) throw new Error("audit limit must be an integer from 1 to 500");
    const home = second ? path.resolve(second) : undefined;
    console.log(JSON.stringify(readMaintenanceAudit({ limit, home }), null, 2));
    return;
  }
  usage();
  throw new Error("Unknown command: " + command);
}

main(process.argv.slice(2)).catch((error) => {
  console.error("[purge-maintenance] " + String(error?.message || error));
  process.exitCode = 1;
});
