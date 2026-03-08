#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolRequest, GetPromptRequest } from '@modelcontextprotocol/sdk/types.js';

import { SERVER_NAME, SERVER_VERSION } from './config/constants.js';
import { log, logError } from './utils/logger.js';
import * as tools from './tools/index.js';
import {
  pixelArtGuideName,
  pixelArtGuideDescription,
  getPixelArtGuide,
} from './prompts/pixel-art-guide.js';
import type { McpToolResponse } from './types/common.js';

const toolHandlers = new Map<string, (input: unknown) => Promise<McpToolResponse>>([
  ['forge_sprite', tools.handleForgeSprite],
  ['forge_animation', tools.handleForgeAnimation],
  ['forge_background', tools.handleForgeBackground],
  ['forge_thumbnail', tools.handleForgeThumbnail],
  ['process_sprite', tools.handleProcessSprite],
  ['optimize_sprite', tools.handleOptimizeSprite],
]);

const allTools = [
  tools.forgeSpriteTool,
  tools.forgeAnimationTool,
  tools.forgeBackgroundTool,
  tools.forgeThumbnailTool,
  tools.processSpriteTool,
  tools.optimizeSpriteTool,
];

async function main() {
  log(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);

  if (!process.env.GEMINI_API_KEY) {
    log('WARNING: GEMINI_API_KEY not set — generation tools will fail until it is provided');
  }

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    log('Listing tools');
    return { tools: allTools };
  });

  // Execute tool
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;
    log(`Executing: ${name}`);

    const handler = toolHandlers.get(name);
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      return await handler(args);
    } catch (error) {
      logError(`Tool ${name} failed`, error);
      throw error;
    }
  });

  // List prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [{ name: pixelArtGuideName, description: pixelArtGuideDescription }],
    };
  });

  // Get prompt
  server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
    const { name } = request.params;
    if (name === pixelArtGuideName) {
      return getPixelArtGuide();
    }
    throw new Error(`Unknown prompt: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log(`${SERVER_NAME} running on stdio`);
  log(
    'Tools: forge_sprite, forge_animation, forge_background, forge_thumbnail, process_sprite, optimize_sprite'
  );
  log('Prompts: pixel_art_guide');
}

main().catch((error) => {
  logError('Fatal error', error);
  process.exit(1);
});
