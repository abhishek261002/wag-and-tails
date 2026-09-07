// Modern metro-family packages (metro-cache, metro-transform-worker, ...)
// lock their package.json "exports" field down to just "." and
// "./private/*", but @expo/metro-config's own file-store.js and related
// helpers (bundled with both Expo SDK 51 and SDK 57's toolchains here)
// still do legacy deep requires like
// `require('metro-cache/src/stores/FileStore')` and
// `require('metro-transform-worker/src/utils/getMinifier')` — the
// pre-restriction paths. That breaks `expo start`/`expo export` for
// partner-mobile with ERR_PACKAGE_PATH_NOT_EXPORTED. The underlying files
// still exist; only the exports allowlist blocks them. This restores a
// "./src/*" subpath on every metro-* package found in the workspace.
// node_modules is disposable, so this runs again via `postinstall` after
// every fresh install.
const fs = require('fs');
const path = require('path');

function patchOne(pkgJsonPath) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  } catch {
    return false;
  }
  if (!pkg.exports || typeof pkg.exports !== 'object' || pkg.exports['./src/*']) return false;
  pkg.exports['./src/*'] = './src/*.js';
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  return true;
}

function findMetroPackageJsons(nodeModulesDir, depth) {
  const results = [];
  if (depth > 3 || !fs.existsSync(nodeModulesDir)) return results;
  let entries;
  try {
    entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
  } catch {
    return results;
  }
  // Only descend into packages that could plausibly carry their own nested
  // metro-* copy, to avoid crawling the entire dependency tree.
  const INTERESTING = new Set(['metro', 'expo', '@expo', 'react-native']);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.bin') continue;
    const full = path.join(nodeModulesDir, entry.name);
    if (entry.name.startsWith('metro')) {
      const pkgJsonPath = path.join(full, 'package.json');
      if (fs.existsSync(pkgJsonPath)) results.push(pkgJsonPath);
    }
    if (entry.name === '@expo') {
      let scoped;
      try {
        scoped = fs.readdirSync(full, { withFileTypes: true });
      } catch {
        scoped = [];
      }
      for (const s of scoped) {
        if (s.isDirectory()) {
          results.push(...findMetroPackageJsons(path.join(full, s.name, 'node_modules'), depth + 1));
        }
      }
    }
    if (INTERESTING.has(entry.name)) {
      results.push(...findMetroPackageJsons(path.join(full, 'node_modules'), depth + 1));
    }
  }
  return results;
}

const repoRoot = path.resolve(__dirname, '..');
const roots = [
  path.join(repoRoot, 'node_modules'),
  path.join(repoRoot, 'apps/customer-mobile/node_modules'),
  path.join(repoRoot, 'apps/partner-mobile/node_modules'),
];

const targets = new Set();
for (const root of roots) {
  for (const p of findMetroPackageJsons(root, 0)) targets.add(p);
}

let patched = 0;
for (const target of targets) {
  if (patchOne(target)) patched++;
}
console.log(`patch-metro-cache: patched ${patched} of ${targets.size} metro-* package install(s) found.`);

// The workspace root's shared @expo/metro-config (the copy partner-mobile's
// own `expo` falls through to, since it carries no nested copy of its own —
// see apps/customer-mobile, which DOES get its own nested @expo/metro-config
// and never hits this) does an unpinned `require('metro-cache-key')`.
// Node resolves that relative to @expo/metro-config's own location, so it
// finds whatever's hoisted at the workspace root — customer-mobile's newer
// metro-cache-key (a different, named-export API shape) — never the older,
// default-export-function version partner-mobile's package.json pins nearby.
// Since @expo/metro-config doesn't declare metro-cache-key as its own
// dependency at all, npm has no edge to hang a nested copy off of; give it
// one directly by copying the pinned old copy into its node_modules.
function nestCompatibleMetroCacheKey() {
  const expoMetroConfigDir = path.join(repoRoot, 'node_modules/@expo/metro-config');
  const oldShapeSource = path.join(repoRoot, 'apps/partner-mobile/node_modules/metro-cache-key');
  const dest = path.join(expoMetroConfigDir, 'node_modules/metro-cache-key');
  if (!fs.existsSync(expoMetroConfigDir) || !fs.existsSync(oldShapeSource)) return false;
  if (fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(oldShapeSource, dest, { recursive: true });
  return true;
}

if (nestCompatibleMetroCacheKey()) {
  console.log('patch-metro-cache: nested a compatible metro-cache-key under @expo/metro-config for partner-mobile.');
}
