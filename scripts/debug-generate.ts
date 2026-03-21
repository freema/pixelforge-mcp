#!/usr/bin/env tsx
/**
 * Debug script — generates sample assets into debug/ folder.
 * Usage: GEMINI_API_KEY=xxx npx tsx scripts/debug-generate.ts [tool]
 *
 * Tools: sprite, animation, tileset, item-kit, template-anim, all
 * Example: GEMINI_API_KEY=xxx npx tsx scripts/debug-generate.ts sprite
 */

import { mkdir } from 'fs/promises';
import { resolve } from 'path';
import { handleForgeSprite } from '../src/tools/forge-sprite.js';
import { handleForgeAnimation } from '../src/tools/forge-animation.js';
import { handleForgeTileset } from '../src/tools/forge-tileset.js';
import { handleForgeItemKit } from '../src/tools/forge-item-kit.js';

const DEBUG_DIR = resolve('debug');

async function ensureDir() {
  await mkdir(DEBUG_DIR, { recursive: true });
  console.log(`Output directory: ${DEBUG_DIR}\n`);
}

function printResult(name: string, result: { content: unknown[]; isError?: boolean }) {
  if (result.isError) {
    console.error(`❌ ${name} FAILED:`);
    console.error(result.content);
  } else {
    console.log(`✅ ${name} OK`);
    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    for (const f of parsed.files) {
      console.log(`   ${f.path} (${f.width}x${f.height}, ${f.size} bytes)`);
    }
  }
  console.log();
}

// ── Individual test functions ──────────────────────────────────────────

async function testSprite() {
  console.log('🎮 Generating sprite (auto background)...');
  const result = await handleForgeSprite({
    description: 'a cute green slime enemy with big eyes',
    outputPath: `${DEBUG_DIR}/sprite-slime.png`,
    size: 48,
    background: 'auto',
  });
  printResult('forge_sprite', result);
}

async function testSpriteForest() {
  console.log('🌲 Generating sprite (forest background)...');
  const result = await handleForgeSprite({
    description: 'a forest elf archer',
    outputPath: `${DEBUG_DIR}/sprite-elf-forest.png`,
    size: 48,
    background: 'forest',
  });
  printResult('forge_sprite (forest)', result);
}

async function testAnimation() {
  console.log('🎬 Generating animation (blob-based split)...');
  const result = await handleForgeAnimation({
    description: 'green slime enemy',
    action: 'bouncing up and down',
    frames: 3,
    outputPrefix: `${DEBUG_DIR}/anim-slime`,
    names: ['squash', 'mid', 'stretch'],
    size: 48,
    background: 'black',
  });
  printResult('forge_animation', result);
}

async function testTemplateAnimation() {
  console.log('📐 Generating animation (template-guided)...');
  const result = await handleForgeAnimation({
    description: 'a knight character',
    action: 'walking cycle',
    frames: 4,
    outputPrefix: `${DEBUG_DIR}/anim-knight-template`,
    names: ['step1', 'step2', 'step3', 'step4'],
    size: 48,
    background: 'black',
    useTemplate: true,
  });
  printResult('forge_animation (template)', result);
}

async function testTileset() {
  console.log('🧱 Generating tileset...');
  const result = await handleForgeTileset({
    description: 'green grass terrain with small flowers',
    outputPath: `${DEBUG_DIR}/tile-grass.png`,
    size: 32,
  });
  printResult('forge_tileset', result);
}

async function testItemKit() {
  console.log('🎒 Generating item kit...');
  const result = await handleForgeItemKit({
    items: ['red health potion', 'blue mana potion', 'golden coin', 'iron sword'],
    outputPrefix: `${DEBUG_DIR}/items`,
    names: ['health', 'mana', 'coin', 'sword'],
    size: 32,
    background: 'black',
  });
  printResult('forge_item_kit', result);
}

// ── Main ───────────────────────────────────────────────────────────────

const TESTS: Record<string, () => Promise<void>> = {
  sprite: async () => { await testSprite(); await testSpriteForest(); },
  animation: testAnimation,
  'template-anim': testTemplateAnimation,
  tileset: testTileset,
  'item-kit': testItemKit,
  all: async () => {
    await testSprite();
    await testSpriteForest();
    await testAnimation();
    await testTemplateAnimation();
    await testTileset();
    await testItemKit();
  },
};

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable is not set');
    process.exit(1);
  }

  const tool = process.argv[2] ?? 'all';
  const testFn = TESTS[tool];

  if (!testFn) {
    console.error(`Unknown tool: ${tool}`);
    console.error(`Available: ${Object.keys(TESTS).join(', ')}`);
    process.exit(1);
  }

  await ensureDir();
  console.log(`Running: ${tool}\n`);

  const start = Date.now();
  await testFn();
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(`\nOpen debug/ folder to see results.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
