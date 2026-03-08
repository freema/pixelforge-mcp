import { describe, it, expect } from 'vitest';
import { resolveModel, DEFAULT_MODEL, MODELS, MODEL_ALIASES } from '../../src/engine/models.js';

describe('resolveModel', () => {
  it('resolves known aliases', () => {
    expect(resolveModel('nano-banana').id).toBe('nano-banana-pro-preview');
    expect(resolveModel('banana').id).toBe('nano-banana-pro-preview');
    expect(resolveModel('flash').id).toBe('gemini-3.1-flash-image-preview');
    expect(resolveModel('pro').id).toBe('gemini-3-pro-image-preview');
    expect(resolveModel('25').id).toBe('gemini-2.5-flash-image');
  });

  it('falls back to default for unknown model', () => {
    const result = resolveModel('nonexistent-model');
    expect(result.id).toBe(MODELS[DEFAULT_MODEL]!.id);
  });

  it('DEFAULT_MODEL is a valid key', () => {
    expect(MODELS[DEFAULT_MODEL]).toBeDefined();
  });

  it('all aliases resolve to valid models', () => {
    for (const alias of MODEL_ALIASES) {
      const model = resolveModel(alias);
      expect(model.id).toBeTruthy();
      expect(model.engine).toBe('gemini');
    }
  });
});
