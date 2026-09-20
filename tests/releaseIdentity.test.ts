import { describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

describe('Release provenance gate', () => {
  it('rejects reused release numbers and advances fix, build and lockfile together', () => {
    const root = mkdtempSync(join(tmpdir(), 'ainkrad-release-'));
    const run = (command: string, args: string[]) => execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'src'));
      cpSync('scripts/release.mjs', join(root, 'scripts/release.mjs'));
      writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.3.22-f12', ainkrad: { build: 12 } }));
      writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: '0.3.22-f12', packages: { '': { version: '0.3.22-f12' } } }));
      writeFileSync(join(root, 'src/app.ts'), 'export const a = 1;');
      run('git', ['init', '-q']); run('git', ['add', '.']);
      run('git', ['-c', 'user.name=Release test', '-c', 'user.email=release-test@example.invalid', 'commit', '-qm', 'baseline']);
      writeFileSync(join(root, 'src/app.ts'), 'export const a = 2;');
      expect(() => run('node', ['scripts/release.mjs', 'check', '--base', 'HEAD'])).toThrow(/increment BOTH/);
      run('node', ['scripts/release.mjs', 'fix']);
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
      expect(pkg.version).toBe('0.3.22-f13'); expect(pkg.ainkrad.build).toBe(13);
      expect(lock.version).toBe(pkg.version); expect(lock.packages[''].version).toBe(pkg.version);
      expect(run('node', ['scripts/release.mjs', 'check', '--base', 'HEAD'])).toContain('identity valid');
      lock.version = '0.3.22-f12'; writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock));
      expect(() => run('node', ['scripts/release.mjs', 'check'])).toThrow(/versions differ/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
