import { describe, it, expect } from 'vitest';
import {
  resolveBackground,
  bgPromptFragment,
  bgToRgb,
  BG_COLOR_MAP,
  VALID_BACKGROUNDS,
} from '../../src/pipeline/background.js';

describe('resolveBackground', () => {
  it('returns black for undefined input', () => {
    expect(resolveBackground(undefined, 'a sword')).toBe('black');
  });

  it('returns the key directly for known backgrounds', () => {
    expect(resolveBackground('white', 'a sword')).toBe('white');
    expect(resolveBackground('forest', 'a sword')).toBe('forest');
    expect(resolveBackground('lava', 'a sword')).toBe('lava');
  });

  it('falls back to black for unknown string', () => {
    expect(resolveBackground('purple', 'a sword')).toBe('black');
  });

  it('auto-detects forest from description', () => {
    expect(resolveBackground('auto', 'a tree in a forest')).toBe('forest');
  });

  it('auto-detects ocean from description', () => {
    expect(resolveBackground('auto', 'underwater coral reef')).toBe('ocean');
  });

  it('auto-detects snow from description', () => {
    expect(resolveBackground('auto', 'frozen ice blizzard')).toBe('snow');
  });

  it('auto-detects lava from description', () => {
    expect(resolveBackground('auto', 'volcano eruption')).toBe('lava');
  });

  it('auto-detects dungeon from description', () => {
    expect(resolveBackground('auto', 'dark dungeon corridor')).toBe('dungeon');
  });

  it('auto-detects sand from description', () => {
    expect(resolveBackground('auto', 'desert oasis with cactus')).toBe('sand');
  });

  it('auto-detects night from description', () => {
    expect(resolveBackground('auto', 'midnight moon scene')).toBe('night');
  });

  it('auto-detects sky from description', () => {
    expect(resolveBackground('auto', 'flying bird in the sky')).toBe('sky');
  });

  it('auto falls back to black when no keyword matches', () => {
    expect(resolveBackground('auto', 'a simple red apple')).toBe('black');
  });

  it('is case-insensitive for description matching', () => {
    expect(resolveBackground('auto', 'A FOREST MONSTER')).toBe('forest');
  });
});

describe('bgPromptFragment', () => {
  it('returns simple format for black', () => {
    const result = bgPromptFragment('black');
    expect(result).toContain('black');
    expect(result).not.toContain('#');
  });

  it('returns simple format for white', () => {
    const result = bgPromptFragment('white');
    expect(result).toContain('white');
    expect(result).not.toContain('#');
  });

  it('includes hex code for named colors', () => {
    const result = bgPromptFragment('forest');
    expect(result).toContain('#4A6741');
    expect(result).toContain('forest green');
  });

  it('includes hex code for lava', () => {
    const result = bgPromptFragment('lava');
    expect(result).toContain('#8B2500');
  });
});

describe('bgToRgb', () => {
  it('returns correct RGB for black', () => {
    const rgb = bgToRgb('black');
    expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('returns correct RGB for white', () => {
    const rgb = bgToRgb('white');
    expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns correct RGB for all named backgrounds', () => {
    for (const bg of VALID_BACKGROUNDS) {
      const rgb = bgToRgb(bg);
      const entry = BG_COLOR_MAP[bg];
      expect(rgb).toEqual(entry.rgb);
    }
  });

  it('returns a copy, not a reference', () => {
    const a = bgToRgb('forest');
    const b = bgToRgb('forest');
    a.r = 999;
    expect(b.r).toBe(74);
  });
});

describe('VALID_BACKGROUNDS', () => {
  it('includes black and white', () => {
    expect(VALID_BACKGROUNDS).toContain('black');
    expect(VALID_BACKGROUNDS).toContain('white');
  });

  it('includes all named colors', () => {
    expect(VALID_BACKGROUNDS).toContain('forest');
    expect(VALID_BACKGROUNDS).toContain('sky');
    expect(VALID_BACKGROUNDS).toContain('dungeon');
    expect(VALID_BACKGROUNDS).toContain('lava');
    expect(VALID_BACKGROUNDS).toContain('ocean');
    expect(VALID_BACKGROUNDS).toContain('sand');
    expect(VALID_BACKGROUNDS).toContain('snow');
    expect(VALID_BACKGROUNDS).toContain('night');
  });
});
