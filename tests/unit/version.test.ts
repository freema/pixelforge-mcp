import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SERVER_NAME, SERVER_VERSION } from '../../src/config/constants.js';

function readJson(relativePath: string): any {
  return JSON.parse(readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8'));
}

const pkg = readJson('package.json');
const serverJson = readJson('server.json');
const plugin = readJson('.claude-plugin/plugin.json');

describe('version metadata', () => {
  it('reports the package.json version over MCP', () => {
    expect(SERVER_NAME).toBe(pkg.name);
    expect(SERVER_VERSION).toBe(pkg.version);
  });

  it('keeps server.json in sync with package.json', () => {
    expect(serverJson.name).toBe(pkg.mcpName);
    expect(serverJson.version).toBe(pkg.version);
    expect(serverJson.packages).toHaveLength(1);
    expect(serverJson.packages[0].identifier).toBe(pkg.name);
    expect(serverJson.packages[0].version).toBe(pkg.version);
  });

  it('keeps the Claude plugin manifest in sync with package.json', () => {
    expect(plugin.version).toBe(pkg.version);
  });

  it('declares the MCP Registry name in the README', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
    expect(readme).toContain(`<!-- mcp-name: ${pkg.mcpName} -->`);
  });
});
