import { describe, it, expect } from 'vitest';
import {
  buildTilesetPrompt,
  buildItemKitPrompt,
  buildTemplateAnimationUserPrompt,
  buildTemplateSystemPrompt,
  computeGridLayout,
} from '../../src/pipeline/prompt-builder.js';

describe('buildTilesetPrompt', () => {
  it('contains seamless tileable', () => {
    const prompt = buildTilesetPrompt('grass terrain');
    expect(prompt).toContain('seamless tileable');
  });

  it('includes style', () => {
    const prompt = buildTilesetPrompt('stone wall', 'retro');
    expect(prompt).toContain('retro');
  });

  it('includes detail hint for size', () => {
    const prompt = buildTilesetPrompt('grass', 'clean', 16);
    expect(prompt).toContain('3-5 colors');
  });

  it('includes negative prompt', () => {
    const prompt = buildTilesetPrompt('grass');
    expect(prompt).toContain('No text');
    expect(prompt).toContain('no watermark');
  });

  it('mentions top-down view', () => {
    const prompt = buildTilesetPrompt('wooden floor');
    expect(prompt).toContain('Top-down view');
  });

  it('does not include sprite rules', () => {
    const prompt = buildTilesetPrompt('grass');
    expect(prompt).not.toContain('centered in frame');
    expect(prompt).not.toContain('no shadow on ground');
  });
});

describe('buildItemKitPrompt', () => {
  it('includes numbered items list', () => {
    const prompt = buildItemKitPrompt(['apple', 'banana', 'cherry']);
    expect(prompt).toContain('1: apple');
    expect(prompt).toContain('2: banana');
    expect(prompt).toContain('3: cherry');
  });

  it('includes grid dimensions', () => {
    const prompt = buildItemKitPrompt(['a', 'b', 'c', 'd']);
    expect(prompt).toContain('2x2');
  });

  it('includes background fragment', () => {
    const prompt = buildItemKitPrompt(['sword'], 'clean', 'forest');
    expect(prompt).toContain('#4A6741');
  });

  it('uses default black background', () => {
    const prompt = buildItemKitPrompt(['sword']);
    expect(prompt).toContain('black');
  });

  it('includes negative prompt', () => {
    const prompt = buildItemKitPrompt(['sword']);
    expect(prompt).toContain('No text');
  });
});

describe('buildTemplateSystemPrompt + buildTemplateAnimationUserPrompt', () => {
  it('system prompt references grid layout', () => {
    const system = buildTemplateSystemPrompt(3, 1, 3, '#000000');
    expect(system).toContain('3x1 grid');
    expect(system).toContain('cell 1 = first');
    expect(system).toContain('red lines');
  });

  it('user prompt includes frame descriptions when provided', () => {
    const prompt = buildTemplateAnimationUserPrompt(
      'a slime',
      'bouncing',
      ['compressed', 'stretched']
    );
    expect(prompt).toContain('Cell 1');
    expect(prompt).toContain('compressed');
    expect(prompt).toContain('Cell 2');
    expect(prompt).toContain('stretched');
  });

  it('user prompt falls back to action when no frame descriptions', () => {
    const prompt = buildTemplateAnimationUserPrompt(
      'a bird',
      'flying'
    );
    expect(prompt).toContain('Animation: a bird flying');
  });

  it('system prompt includes background hex', () => {
    const system = buildTemplateSystemPrompt(2, 1, 2, '#1A3A5C');
    expect(system).toContain('#1A3A5C');
  });
});

describe('computeGridLayout', () => {
  it('returns 1x1 for single item', () => {
    expect(computeGridLayout(1)).toEqual({ cols: 1, rows: 1, aspect: '1:1' });
  });

  it('returns 2x1 for 2 items', () => {
    expect(computeGridLayout(2)).toEqual({ cols: 2, rows: 1, aspect: '16:9' });
  });

  it('returns 2x2 for 3-4 items', () => {
    expect(computeGridLayout(3)).toEqual({ cols: 2, rows: 2, aspect: '1:1' });
    expect(computeGridLayout(4)).toEqual({ cols: 2, rows: 2, aspect: '1:1' });
  });

  it('returns 3x2 for 5-6 items', () => {
    expect(computeGridLayout(5)).toEqual({ cols: 3, rows: 2, aspect: '4:3' });
    expect(computeGridLayout(6)).toEqual({ cols: 3, rows: 2, aspect: '4:3' });
  });

  it('returns 4x2 for 7-8 items', () => {
    expect(computeGridLayout(7)).toEqual({ cols: 4, rows: 2, aspect: '16:9' });
    expect(computeGridLayout(8)).toEqual({ cols: 4, rows: 2, aspect: '16:9' });
  });

  it('returns 3x3 for 9 items', () => {
    expect(computeGridLayout(9)).toEqual({ cols: 3, rows: 3, aspect: '1:1' });
  });

  it('returns 4x3 for 10-12 items', () => {
    expect(computeGridLayout(10)).toEqual({ cols: 4, rows: 3, aspect: '4:3' });
    expect(computeGridLayout(12)).toEqual({ cols: 4, rows: 3, aspect: '4:3' });
  });

  it('returns 4x4 for 13-16 items', () => {
    expect(computeGridLayout(13)).toEqual({ cols: 4, rows: 4, aspect: '1:1' });
    expect(computeGridLayout(16)).toEqual({ cols: 4, rows: 4, aspect: '1:1' });
  });
});
