import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
export function checkRelease(base) {
  const pkg = read('package.json'), lock = read('package-lock.json');
  if (!/^\d+\.\d+\.\d+-f\d+$/.test(pkg.version) || !Number.isSafeInteger(pkg.ainkrad?.build) || pkg.ainkrad.build < 1) throw new Error('Release needs a fix version and positive integer build');
  if (pkg.version !== lock.version || pkg.version !== lock.packages[''].version) throw new Error('package.json and lockfile versions differ');
  if (base) {
    const previous = JSON.parse(git(['show', `${base}:package.json`]));
    const changed = git(['diff', '--name-only', base, '--', 'src', 'scripts', 'tests', 'package.json', 'package-lock.json', 'vite.config.ts', '.github', 'vercel.json']);
    if (changed) {
      const parts = version => version.split(/[.\-f]+/).map(Number);
      const a = parts(pkg.version), b = parts(previous.version);
      const index = a.findIndex((n, i) => n !== b[i]);
      if (index < 0 || a[index] < b[index] || pkg.ainkrad.build <= (previous.ainkrad?.build ?? 0)) throw new Error('Code changed: increment BOTH fix version and build with npm run release:fix');
    }
  }
  return pkg;
}
export function releaseMetadata() {
  const pkg = checkRelease();
  let commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '', dirty = false;
  try { commit ||= git(['rev-parse', 'HEAD']); dirty = Boolean(git(['status', '--porcelain', '--untracked-files=normal'])); } catch {}
  if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid release commit');
  return { version: pkg.version.replace('-f', '.f'), build: pkg.ainkrad.build,
    commit: commit || 'unversioned', dirty, builtAt: new Date().toISOString() };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const command = process.argv[2];
  if (command === 'fix') {
    const pkg = checkRelease(), lock = read('package-lock.json');
    pkg.version = pkg.version.replace(/-f(\d+)$/, (_, n) => `-f${Number(n) + 1}`);
    pkg.ainkrad.build++;
    lock.version = lock.packages[''].version = pkg.version;
    for (const [name, data] of [['package.json', pkg], ['package-lock.json', lock]]) writeFileSync(new URL(`../${name}`, import.meta.url), JSON.stringify(data, null, 2) + '\n');
    console.log(`Prepared ${pkg.version}, build ${pkg.ainkrad.build}; add its change log before release.`);
  } else {
    const baseIndex = process.argv.indexOf('--base');
    const pkg = checkRelease(baseIndex >= 0 ? process.argv[baseIndex + 1] : undefined);
    console.log(`Release identity valid: ${pkg.version} / build ${pkg.ainkrad.build}`);
  }
}
