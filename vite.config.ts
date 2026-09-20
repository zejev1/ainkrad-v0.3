import { defineConfig } from 'vite';
import { releaseMetadata } from './scripts/release.mjs';

const release = releaseMetadata();

export default defineConfig({
  define: { __AINKRAD_RELEASE__: JSON.stringify(release) },
  plugins: [{ name: 'ainkrad-release-identity', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify(release, null, 2) + '\n' });
  } }],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local'],
  },
});
