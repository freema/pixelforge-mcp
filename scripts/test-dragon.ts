import { handleForgeAnimation } from '../src/tools/forge-animation.js';

async function main() {
  console.log('🐉 Generating 6-frame dragon flying animation (template-guided)...\n');

  const result = await handleForgeAnimation({
    description: 'a red dragon',
    action: 'flying animation with wing flap cycle',
    frames: 6,
    frameDescriptions: [
      'wings fully up',
      'wings angling down',
      'wings at middle',
      'wings fully down',
      'wings angling up',
      'wings back to top',
    ],
    outputPrefix: 'debug/anim-dragon',
    names: ['up', 'down1', 'mid', 'down', 'up1', 'back'],
    size: 64,
    background: 'black',
    useTemplate: true,
  });

  if (result.isError) {
    console.error('❌ FAILED:', result.content);
    return;
  }

  const text = (result.content[0] as { text: string }).text;
  const parsed = JSON.parse(text);
  console.log(`✅ ${parsed.meta.frameCount} frames generated:`);
  for (const f of parsed.files) {
    console.log(`   ${f.path} (${f.width}x${f.height}, ${f.size} bytes)`);
  }
}

main().catch(console.error);
