import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';

describe('World can ship independently of Cardinal and the browser runtime', () => {
  it('bundles WorldEngine without a Cardinal, Gateway transport or browser runtime dependency', async () => {
    const result = await build({entryPoints:['src/world/WorldEngine.ts'],bundle:true,write:false,
      platform:'node',format:'esm',metafile:true,logLevel:'silent'});
    const inputs=Object.keys(result.metafile!.inputs);
    expect(inputs.some(path=>path.endsWith('src/core/WorldContracts.ts'))).toBe(false); // type-only wire contract
    expect(inputs.filter(path=> /src\/(cardinal|runtime|boundary)\//.test(path))).toEqual([]);
    expect(result.outputFiles[0].text).toContain('WorldEngine');
  });
});
