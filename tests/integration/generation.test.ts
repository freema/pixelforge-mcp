import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readdir, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { handleForgeTileset } from '../../src/tools/forge-tileset.js';
import { handleForgeItemKit } from '../../src/tools/forge-item-kit.js';
import { handleForgeSprite } from '../../src/tools/forge-sprite.js';
import { handleForgeAnimation } from '../../src/tools/forge-animation.js';

const HAS_KEY = !!process.env.GEMINI_API_KEY;

describe.skipIf(!HAS_KEY)('Integration: generation tools', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pixelforge-integ-'));
  });

  afterAll(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('forge_tileset generates a valid PNG of correct size', { timeout: 45000 }, async () => {
    const outputPath = join(tmpDir, 'grass.png');
    const result = await handleForgeTileset({
      description: 'green grass terrain',
      outputPath,
      size: 32,
    });

    expect(result.isError).toBeUndefined();
    const fileInfo = await stat(outputPath);
    expect(fileInfo.size).toBeGreaterThan(0);

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.files[0].width).toBe(32);
    expect(parsed.files[0].height).toBe(32);
  });

  it('forge_item_kit generates correct number of sprite files', { timeout: 45000 }, async () => {
    const prefix = join(tmpDir, 'fruit');
    const result = await handleForgeItemKit({
      items: ['red apple', 'yellow banana', 'purple grapes'],
      outputPrefix: prefix,
      size: 32,
      names: ['apple', 'banana', 'grapes'],
    });

    expect(result.isError).toBeUndefined();

    const files = await readdir(tmpDir);
    const fruitFiles = files.filter((f) => f.startsWith('fruit-'));
    expect(fruitFiles.length).toBe(3);
  });

  it(
    'forge_sprite with auto background produces a transparent sprite',
    { timeout: 45000 },
    async () => {
      const outputPath = join(tmpDir, 'forest-elf.png');
      const result = await handleForgeSprite({
        description: 'an elf archer in a forest',
        outputPath,
        size: 48,
        background: 'auto',
      });

      expect(result.isError).toBeUndefined();
      const fileInfo = await stat(outputPath);
      expect(fileInfo.size).toBeGreaterThan(0);
    }
  );

  it(
    'forge_animation with template produces correct number of frames',
    { timeout: 45000 },
    async () => {
      const prefix = join(tmpDir, 'slime-anim');
      const result = await handleForgeAnimation({
        description: 'green slime',
        action: 'bouncing up and down',
        frames: 3,
        outputPrefix: prefix,
        useTemplate: true,
        size: 32,
      });

      expect(result.isError).toBeUndefined();

      const text = (result.content[0] as { text: string }).text;
      const parsed = JSON.parse(text);
      expect(parsed.meta.frameCount).toBe(3);
    }
  );
});
