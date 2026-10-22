# Core functionality migration plan

Target repository: `nayyuxx/dsh-purge-plus`
Working branch: `repair/core-functionality`
Base branch: `main`

## Safety and scope

This branch is isolated from `main`. Do not install it on a working machine until the integrity checks and tests pass.

Prioritize maintainable, non-destructive functions:

1. Correct repository/package identity and make update sources point only to this repository.
2. Preserve the existing prompt/rule editor and ordinary plugin lifecycle.
3. Add read-only diagnostics for package identity, host compatibility, and patch status.
4. Improve backup verification, rollback reporting, and operation audit records.
5. Test the package in an isolated profile before any installation.

## Porting boundary

The `plus2` repository is a reference for implementation patterns, not an installation source. Keep the target repository and all release URLs under `nayyuxx/dsh-purge-plus`.

Do not copy its unrestricted-preset or host-sandbox/approval-bypass additions as part of this maintenance-focused migration. Keep any security-sensitive behavior outside the scope of this branch; do not weaken host permission checks as a way to make a patch test pass.

## Current findings

- The target `main` branch package metadata still identifies itself as `dsh-purge@1.4.2`.
- Its `repository`, `homepage`, `bugs`, and install/update URLs point at the original upstream rather than this fork.
- The target branch's runtime plugin identity and `cordis.patch.yml` still use the legacy `dsh-purge` identity.
- The local installed 1.6.1 snapshot was not sourced from this repository's current `main` branch.
- The working branch starts from `main`; it has not been released or installed.

## Release gate

Do not change the install target or publish a release until package name, runtime plugin name, patch entry, updater source, CLI/uninstall behavior, and tests agree. Verify rollback from a disposable profile first.

## Implemented on `repair/core-functionality`

- Added a read-only fork-integrity checker at `scripts/verify-fork.mjs`.
- Updated repository, homepage, and issue-tracker metadata to this fork; added `npm run check:fork`.
- Added an independent `purge-maintenance` CLI for verified snapshots and audit-log reading/writing.
- Snapshot restore requires a verified snapshot and a destination path that does not already exist. Symbolic links and special files are rejected.
- Added `npm run test:maintenance`.

## Test results

- JavaScript syntax checks passed for the new maintenance modules and CLI.
- Maintenance tests passed: 3 passed, 0 failed, 1 skipped (symbolic-link test is skipped on Windows).
- CLI smoke flow passed: help, snapshot creation, snapshot verification, and restore into a new destination; the temporary test directory was removed.
- The fork-integrity check is expected to report blockers until the package/runtime/patch identity and install source are migrated together. This branch is not release-ready and has not been installed on the user's working profile.
