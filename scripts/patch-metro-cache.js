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

// This SDK51-era @expo/cli builds the dev-server URL for expo-router's
// static/SSR HTML render via `path.relative(...)`, which returns
// backslash-separated paths on Windows, then passes that straight into the
// bundle URL without the slash-conversion every other code path in the same
// file applies. The result is a bundle URL like
// "/node_modules%5Cexpo-router%5Centry.bundle" that the browser can't fetch,
// so the whole app fails to bundle on Windows. Only the root-hoisted
// @expo/cli (shared by apps without their own nested copy, e.g.
// partner-mobile) has this bug; newer versions already convert.
function patchExpoCliWindowsPathBug() {
  const file = path.join(
    repoRoot,
    'node_modules/@expo/cli/build/src/start/server/getStaticRenderFunctions.js'
  );
  if (!fs.existsSync(file)) return false;
  let contents = fs.readFileSync(file, 'utf8');
  const broken = 'path().default.relative(root, safeOtherFile).replace(/\\.[jt]sx?$/, "")';
  const fixed = 'path().default.relative(root, safeOtherFile).replace(/\\\\/g, "/").replace(/\\.[jt]sx?$/, "")';
  if (!contents.includes(broken)) return false;
  contents = contents.replace(broken, fixed);
  fs.writeFileSync(file, contents);
  return true;
}

if (patchExpoCliWindowsPathBug()) {
  console.log('patch-metro-cache: fixed @expo/cli Windows backslash bug in getStaticRenderFunctions.js.');
}

// react-native-web ships Alert.alert() as a total no-op on web (browsers
// can't replicate a native multi-button dialog), which silently breaks
// every confirm/cancel flow built on Alert.alert — logout confirmations,
// delete confirmations, etc. — since the buttons' onPress callbacks never
// fire. Shim both the ESM and CJS builds with window.confirm/alert.
const ALERT_SHIM_BODY = `class Alert {
  static alert(title, message, buttons, _options) {
    if (typeof window === 'undefined') return;

    const btns = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    const text = [title, message].filter(Boolean).join('\\n\\n');

    if (btns.length <= 1) {
      window.alert(text);
      const btn = btns[0];
      if (btn && typeof btn.onPress === 'function') btn.onPress();
      return;
    }

    const cancelBtn = btns.find((b) => b.style === 'cancel');
    const confirmBtn = btns.find((b) => b !== cancelBtn) || btns[btns.length - 1];

    if (window.confirm(text)) {
      if (confirmBtn && typeof confirmBtn.onPress === 'function') confirmBtn.onPress();
    } else {
      if (cancelBtn && typeof cancelBtn.onPress === 'function') cancelBtn.onPress();
    }
  }

  static prompt() {}
}`;

function patchReactNativeWebAlert() {
  const esmFile = path.join(repoRoot, 'node_modules/react-native-web/dist/exports/Alert/index.js');
  const cjsFile = path.join(repoRoot, 'node_modules/react-native-web/dist/cjs/exports/Alert/index.js');
  let patched = 0;

  if (fs.existsSync(esmFile)) {
    let contents = fs.readFileSync(esmFile, 'utf8');
    if (/class Alert \{\s*static alert\(\) \{\}\s*\}/.test(contents)) {
      contents = contents.replace(/class Alert \{\s*static alert\(\) \{\}\s*\}/, ALERT_SHIM_BODY);
      fs.writeFileSync(esmFile, contents);
      patched++;
    }
  }

  if (fs.existsSync(cjsFile)) {
    let contents = fs.readFileSync(cjsFile, 'utf8');
    if (/class Alert \{\s*static alert\(\) \{\}\s*\}/.test(contents)) {
      contents = contents.replace(/class Alert \{\s*static alert\(\) \{\}\s*\}/, ALERT_SHIM_BODY);
      fs.writeFileSync(cjsFile, contents);
      patched++;
    }
  }

  return patched;
}

const alertPatchCount = patchReactNativeWebAlert();
if (alertPatchCount > 0) {
  console.log(`patch-metro-cache: shimmed react-native-web's no-op Alert.alert() in ${alertPatchCount} build(s).`);
}
