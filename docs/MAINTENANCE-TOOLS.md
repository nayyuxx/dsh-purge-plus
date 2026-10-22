# Local maintenance tools

These commands are for inspecting and protecting files. They do not apply host patches or change DSH permissions.

## Commands

After installing the package in a test environment, run:

```powershell
purge-maintenance backup <source-directory> <backup-directory>
purge-maintenance verify <snapshot-directory>
purge-maintenance restore <snapshot-directory> <new-destination-directory>
purge-maintenance audit [limit] [DSH_HOME]
```

- `backup` makes a snapshot of regular files and records their SHA-256 hashes.
- `verify` checks the manifest, file sizes, hashes, and unexpected files.
- `restore` first verifies the snapshot and restores into a **new path only**. It refuses to overwrite an existing destination.
- `audit` reads the local maintenance audit log. The audit writer excludes fields whose names suggest prompts, tokens, secrets, passwords, credentials, or message bodies.

## Safety properties

- No host files are patched by these commands.
- Symbolic links and special files are rejected during snapshot creation.
- A snapshot that fails verification cannot be restored.
- Existing restore destinations are never overwritten.
- Use a disposable test profile before using any maintenance command on important files.

## Current status

This utility is available on the `repair/core-functionality` branch for testing. The package identity and update/install targets have not yet passed the fork-integrity gate, so this branch is **not a release or install target**.
