import type { ModelDef } from '../types/common.js';
import { log } from '../utils/logger.js';

const NANO_BANANA: ModelDef = {
  id: 'nano-banana-pro-preview',
  engine: 'gemini',
  description: 'Nano Banana Pro — best for pixel art',
};
const GEMINI_FLASH: ModelDef = {
  id: 'gemini-3.1-flash-image-preview',
  engine: 'gemini',
  description: 'Gemini 3.1 Flash — fast, reliable',
};
const GEMINI_PRO: ModelDef = {
  id: 'gemini-3-pro-image-preview',
  engine: 'gemini',
  description: 'Gemini 3 Pro — best quality',
};
const GEMINI_25: ModelDef = {
  id: 'gemini-2.5-flash-image',
  engine: 'gemini',
  description: 'Gemini 2.5 Flash — stable fallback',
};

export const MODELS: Record<string, ModelDef> = {
  'nano-banana': NANO_BANANA,
  banana: NANO_BANANA,
  'banana-2': GEMINI_FLASH,
  'nano-banana-2': GEMINI_FLASH,
  'gemini-flash': GEMINI_FLASH,
  flash: GEMINI_FLASH,
  'gemini-pro': GEMINI_PRO,
  pro: GEMINI_PRO,
  'gemini-25': GEMINI_25,
  'gemini-flash-25': GEMINI_25,
  '25': GEMINI_25,
};

export const MODEL_ALIASES = Object.keys(MODELS);
export const DEFAULT_MODEL = 'nano-banana';

export function resolveModel(nameOrAlias: string): ModelDef {
  if (MODELS[nameOrAlias]) return MODELS[nameOrAlias]!;
  log(
    `Unknown model "${nameOrAlias}", falling back to ${DEFAULT_MODEL} (${MODELS[DEFAULT_MODEL]!.id})`
  );
  return MODELS[DEFAULT_MODEL]!;
}
