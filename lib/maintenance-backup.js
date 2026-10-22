// Non-destructive file snapshots for plugin maintenance. No symlinks are followed.
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const inside = (root, candidate) => candidate === root || candidate.startsWith(root + path.sep);

function regularDirectory(dir) {
  const st = fs.lstatSync(dir);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error("Expected a real directory: " + dir);
}

function safeRelative(rel) {
  if (typeof rel !== "string" || !rel || path.isAbsolute(rel)) return false;
  const normalized = path.normalize(rel);
  return normalized !== "." && normalized !== ".." && !normalized.startsWith(".." + path.sep) && !normalized.split(/[\\/]/).includes("..");
}

function targetFor(root, rel) {
  if (!safeRelative(rel)) throw new Error("Unsafe snapshot path: " + String(rel));
  const target = path.resolve(root, rel);
  if (!inside(root, target) || target === root) throw new Error("Snapshot path escapes its root");
  return target;
}

function walkFiles(root, dir = root, rows = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const st = fs.lstatSync(full);
    if (st.isSymbolicLink()) throw new Error("Snapshot source contains a symbolic link: " + full);
    if (st.isDirectory()) walkFiles(root, full, rows);
    else if (st.isFile()) {
      const rel = path.relative(root, full);
      const data = fs.readFileSync(full);
      rows.push({ path: rel.split(path.sep).join("/"), size: data.length, sha256: sha256(data), mode: st.mode & 0o777 });
    } else {
      throw new Error("Snapshot source contains a special file: " + full);
    }
  }
  return rows;
}

function copyManifestFiles(sourceRoot, destinationRoot, manifest) {
  for (const entry of manifest.files) {
    const source = targetFor(sourceRoot, entry.path);
    const destination = targetFor(destinationRoot, entry.path);
    const st = fs.lstatSync(source);
    if (st.isSymbolicLink() || !st.isFile()) throw new Error("Snapshot entry is not a regular file: " + entry.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    try { fs.chmodSync(destination, entry.mode & 0o777); } catch { /* platform may not support chmod */ }
  }
}

export function createSnapshot(sourceDir, backupRoot) {
  const source = path.resolve(sourceDir);
  const root = path.resolve(backupRoot);
  regularDirectory(source);
  if (inside(source, root)) throw new Error("Backup directory must not be inside the source directory");
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  regularDirectory(root);
  const files = walkFiles(source).sort((a, b) => a.path.localeCompare(b.path));
  if (!files.length) throw new Error("Refusing to snapshot an empty directory");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const id = `${stamp}-${randomBytes(4).toString("hex")}`;
  const snapshotDir = path.join(root, id);
  fs.mkdirSync(snapshotDir, { recursive: false, mode: 0o700 });
  try {
    const manifest = {
      format: 1,
      createdAt: new Date().toISOString(),
      sourceName: path.basename(source),
      fileCount: files.length,
      files,
    };
    copyManifestFiles(source, snapshotDir, manifest);
    fs.writeFileSync(path.join(snapshotDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
    return { snapshotDir, manifest };
  } catch (error) {
    fs.rmSync(snapshotDir, { recursive: true, force: true });
    throw error;
  }
}

export function verifySnapshot(snapshotDir) {
  const root = path.resolve(snapshotDir);
  regularDirectory(root);
  const manifestPath = path.join(root, "manifest.json");
  const manifestStat = fs.lstatSync(manifestPath);
  if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) throw new Error("Snapshot manifest is not a regular file");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest?.format !== 1 || !Array.isArray(manifest.files)) throw new Error("Unsupported or invalid snapshot manifest");
  const expected = new Set();
  const errors = [];
  for (const entry of manifest.files) {
    let file;
    try { file = targetFor(root, entry.path); } catch (error) { errors.push(String(error.message || error)); continue; }
    expected.add(entry.path.split(path.sep).join("/"));
    try {
      const st = fs.lstatSync(file);
      if (st.isSymbolicLink() || !st.isFile()) { errors.push("not a regular file: " + entry.path); continue; }
      const data = fs.readFileSync(file);
      if (data.length !== entry.size) errors.push("size mismatch: " + entry.path);
      else if (sha256(data) !== entry.sha256) errors.push("hash mismatch: " + entry.path);
    } catch { errors.push("missing file: " + entry.path); }
  }
  const actual = new Set();
  const collect = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) { errors.push("unexpected symbolic link: " + path.relative(root, full)); continue; }
      if (st.isDirectory()) collect(full);
      else if (st.isFile() && full !== manifestPath) actual.add(path.relative(root, full).split(path.sep).join("/"));
      else if (!st.isFile()) errors.push("unexpected special file: " + path.relative(root, full));
    }
  };
  collect(root);
  for (const file of actual) if (!expected.has(file)) errors.push("unlisted file: " + file);
  for (const file of expected) if (!actual.has(file)) errors.push("missing listed file: " + file);
  return { ok: errors.length === 0, fileCount: manifest.files.length, errors, manifest };
}

export function restoreSnapshot(snapshotDir, newDestinationDir) {
  const verified = verifySnapshot(snapshotDir);
  if (!verified.ok) throw new Error("Snapshot verification failed: " + verified.errors.join("; "));
  const destination = path.resolve(newDestinationDir);
  if (fs.existsSync(destination)) throw new Error("Restore destination already exists; refusing to overwrite: " + destination);
  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });
  const staging = destination + ".restore-" + randomBytes(4).toString("hex");
  fs.mkdirSync(staging, { recursive: false, mode: 0o700 });
  try {
    copyManifestFiles(path.resolve(snapshotDir), staging, verified.manifest);
    fs.renameSync(staging, destination);
    return { destination, fileCount: verified.fileCount };
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}
