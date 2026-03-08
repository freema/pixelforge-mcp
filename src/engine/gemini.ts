import { readFile } from 'fs/promises';
import { resolve, extname } from 'path';
import { resolveModel, DEFAULT_MODEL } from './models.js';
import { log } from '../utils/logger.js';
import type { GeneratedImage } from '../types/common.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY environment variable is not set');
  return key;
}

function mimeFromPath(p: string): string {
  const e = extname(p).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return map[e] ?? 'image/png';
}

interface RefImage {
  b64: string;
  mime: string;
  path: string;
}

export async function loadRefImages(paths: string[]): Promise<RefImage[]> {
  return Promise.all(
    paths.map(async (p) => {
      const buf = await readFile(resolve(p));
      return { b64: buf.toString('base64'), mime: mimeFromPath(p), path: p };
    })
  );
}

async function generateViaGemini(
  prompt: string,
  modelId: string,
  count: number,
  refs: RefImage[],
  aspect?: string
): Promise<GeneratedImage[]> {
  const url = `${BASE}/${modelId}:generateContent?key=${getApiKey()}`;

  const parts: unknown[] = [];
  for (const ref of refs) {
    parts.push({ inlineData: { mimeType: ref.mime, data: ref.b64 } });
  }
  parts.push({ text: prompt });

  if (refs.length) {
    log(`Reference images: ${refs.map((r) => r.path).join(', ')}`);
  }

  const generationConfig: Record<string, unknown> = {
    responseModalities: ['IMAGE'],
    candidateCount: count,
  };

  // Aspect ratio goes inside imageConfig per Gemini API docs
  if (aspect) {
    generationConfig.imageConfig = { aspectRatio: aspect };
    log(`Aspect ratio: ${aspect} (via imageConfig)`);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  };
  const images: GeneratedImage[] = [];

  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        images.push({
          b64: part.inlineData.data!,
          ext: part.inlineData.mimeType.split('/')[1] ?? 'png',
        });
      }
    }
  }

  return images;
}

export interface GenerateOptions {
  prompt: string;
  model?: string;
  aspect?: string;
  count?: number;
  references?: string[];
}

export async function generate(opts: GenerateOptions): Promise<GeneratedImage[]> {
  const modelDef = resolveModel(opts.model ?? DEFAULT_MODEL);
  const count = Math.min(4, Math.max(1, opts.count ?? 1));

  log(`Generating: "${opts.prompt.slice(0, 80)}..."`);
  log(`Model: ${modelDef.id} | Count: ${count}`);

  const refs = opts.references?.length ? await loadRefImages(opts.references) : [];
  const images = await generateViaGemini(opts.prompt, modelDef.id, count, refs, opts.aspect);

  if (!images.length) {
    throw new Error('No images returned. Try a different model or prompt.');
  }

  return images;
}
