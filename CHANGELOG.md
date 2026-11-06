# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-11-06

### Added

- `background: "chromakey"` for `forge_sprite` and `forge_animation`: the sprite is generated on a pure green (`#00FF00`) screen that is removed with an HSV-based keyer, giving cleaner edges than the black/white backgrounds and never eating dark or light pixels of the sprite itself.
- `forge_animation` reference-chain mode (`useReferenceChain`, on by default): every frame is generated in its own request with the first frame as a reference image, which keeps proportions, colors and outlines consistent. Set `useReferenceChain: false` to get the previous single sprite-sheet behavior.
- Listing in the official [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.freema/pixelforge-mcp` (`server.json`, `mcpName`, publish workflow).
- README: documentation for backgrounds and chroma key transparency, `forge_tileset` and `forge_item_kit`.
- Node.js 24 in the CI matrix.

### Changed

- `forge_animation` now makes one Gemini request per frame by default (see reference-chain mode above), so an animation uses as many requests as it has frames.
- `@modelcontextprotocol/sdk` raised from `^1.17.1` to `^1.32.2`, and all transitive dependencies refreshed. `npm audit --omit=dev` reports no vulnerabilities. The update itself does not change the tool list or the tool schemas.
- Development dependencies refreshed within their current major versions (vitest 4.1, eslint 10.14, typescript-eslint 8.72, prettier 3.9, tsx 4.23).
- Releases are published to npm from GitHub Actions through trusted publishing (OIDC) with provenance; no npm token is involved.

### Fixed

- The server now reports its real version in the MCP `initialize` response (it was stuck at `0.1.0`).

## [0.2.0] - 2026-03-21

### Added

- Smart backgrounds (`auto` and named scene colors), `forge_tileset`, `forge_item_kit`, template-guided animations.

## [0.1.1] - 2026-03-08

### Fixed

- The publish workflow runs only on a GitHub release.

## [0.1.0] - 2026-03-08

### Added

- Initial release.

[0.3.0]: https://github.com/freema/pixelforge-mcp/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/freema/pixelforge-mcp/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/freema/pixelforge-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/freema/pixelforge-mcp/releases/tag/v0.1.0
