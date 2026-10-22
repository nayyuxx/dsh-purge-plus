# Plus / Plus2 feature migration inventory

Target repository: `nayyuxx/dsh-purge-plus`
Working branch: `repair/core-functionality`
Reference-only repository: `nayyuxx/dsh-purge-plus2`

## User requirement

Keep the original plus2 repository and its existing source untouched. Do not delete, rewrite, or enhance its existing behavior. This inventory is for a controlled migration to the target plus repository; the target branch is not installed or release-ready.

## Confirmed repository differences

### Features present in plus2 that are not yet in the target branch

- Community maintenance manager and compatibility/patch diagnostics (`lib/community.js`, `bin/community.js`).
- Layered self-check and prompt-delivery probe (`lib/selfcheck.js`, `lib/probe.js`).
- Preset registration and preset state management (`lib/presets.js`, `lib/presets-plugin.js`).
- Anchor override and audit support (`lib/anchors.js`, `lib/audit.js`).
- Tuning and boost state (`lib/tuning.js`, `lib/boost.js`).
- Modular updater implementation (`lib/update-state.js`, `lib/update-net.js`, `lib/update-install.js`).
- Native/community panel source and tests (`packages/purge-panel/**`).
- Additional self-check, preset, probe, audit, patch-anchor, and UI tests.
- Additional `workflows/**` automation.

### Existing target-plus assets that should be retained

- Core patch engine and its existing rollback/reapply flow.
- Prompt/rule editing and skill management.
- Red-team workbench, bundled red-team presets, and skills already present in this repository.
- Existing changelog, disclaimer, license, notices, and original project documentation.
- The separately added verified-backup and maintenance-audit utilities.

## Migration order

1. Fix the package identity and every install/update/uninstall reference together. The current branch still has package/runtime identity `dsh-purge@1.4.2`, while the updater still targets the upstream `YuJunZhiXue/dsh-purge`; this is a release blocker.
2. Port and test non-destructive diagnostics: compatibility checks, audit records with sensitive-field filtering, prompt-delivery probe, and anchor-override unit tests.
3. Port preset management only after validating its configuration and patch dependencies against the target host.
4. Port the community panel with its API and UI tests; ensure UI actions call the intended target repository and do not silently modify user files.
5. Run the complete test suite and build a package from this target repository only. Test against a disposable profile before considering installation.

## Security-sensitive source handling

The user's request is to leave the original plus2 source intact. The plus2 repository is not modified by this branch. This branch does not copy or connect code whose purpose is to bypass the host sandbox or skip real approval checks. Existing files in plus2 remain available in that repository, unchanged. Ordinary compatibility tests, diagnostics, and red-team evaluation can be migrated independently.

## Release gate

Do not install or publish until all of the following agree: package name/version, runtime plugin name, Cordis patch identity, CLI/uninstall behavior, update repository/ref, and tests. Do not use plus2 as an installation or update source.
