export type McpContentItem =
  | { type: 'text'; text: string; [key: string]: unknown }
  | { type: 'image'; data: string; mimeType: string; [key: string]: unknown };

export interface McpToolResponse {
  [key: string]: unknown;
  content: McpContentItem[];
  isError?: boolean;
}

export type Style = 'neon' | 'retro' | 'gameboy' | 'snes' | 'clean';

export interface ModelDef {
  id: string;
  engine: 'gemini';
  description: string;
}

export interface GeneratedImage {
  b64: string;
  ext: string;
}

export interface ImageData {
  width: number;
  height: number;
  pixels: Buffer;
}

export interface ForgeResult {
  path: string;
  width: number;
  height: number;
  size: number;
}
