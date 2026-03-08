import type { McpToolResponse, ForgeResult } from '../types/common.js';

export function errorResponse(error: Error | string): McpToolResponse {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

export function forgeResponse(
  files: ForgeResult[],
  meta?: Record<string, unknown>
): McpToolResponse {
  const result = {
    files,
    ...(meta ?? {}),
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}
