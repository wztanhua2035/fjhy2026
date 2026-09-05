$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
# Compiles first so this verification path does not require tsx's temporary-directory helper.
& node node_modules/typescript/bin/tsc --noEmit false --outDir artifacts/compiled
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& node artifacts/compiled/tools/build-assets.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& node --test artifacts/compiled/tests/game.test.js artifacts/compiled/tests/postgres.test.js artifacts/compiled/tests/client.test.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& node node_modules/vite/bin/vite.js build --config apps/admin/vite.config.ts
exit $LASTEXITCODE
