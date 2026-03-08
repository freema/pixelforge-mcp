# pixelforge-mcp

MCP server that forges pixel art sprites & game assets using Google Gemini — generate, crop, split & process, all from your AI assistant.

## Features

- **AI-powered generation** — sprites, animations, backgrounds, thumbnails via Google Gemini
- **Smart post-processing** — background removal, auto-crop, pixelation downscale, square padding
- **Sprite sheet splitting** — auto-detect and split sheets into individual frames
- **Style presets** — neon, retro, gameboy, snes, clean
- **Pure PNG pipeline** — zero-dependency PNG encoder/decoder, no native modules
- **Reference matching** — pass existing sprites to match visual style

## Installation

### Claude Code (CLI)

```bash
claude mcp add pixelforge npx pixelforge-mcp@latest \
  --env GEMINI_API_KEY=your-api-key
```

### Claude Code (Plugin)

```bash
/plugin marketplace add freema/pixelforge-mcp
/plugin install pixelforge-mcp
```

Restart Claude Code to load the MCP server (check with `/mcp`).

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pixelforge": {
      "command": "npx",
      "args": ["-y", "pixelforge-mcp@latest"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Manual (any MCP client)

Add to your `.mcp.json` or equivalent config:

```json
{
  "mcpServers": {
    "pixelforge": {
      "command": "npx",
      "args": ["-y", "pixelforge-mcp@latest"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Requirements

- Node.js >= 20
- [Google Gemini API key](https://aistudio.google.com/apikey)

## Tools

### `forge_sprite`

Generate a single pixel art sprite with automatic post-processing (crop, bg removal, downscale, square padding).

```
"Generate a green slime enemy sprite, 48px, retro style"
```

**Required:** `description`, `outputPath`
**Optional:** `size` (default: 48), `style`, `background`, `aspect`, `square`, `model`, `references`

### `forge_animation`

Generate animation frames as a sprite sheet, then auto-split into individual frame PNGs.

```
"Animate a slime bouncing, 4 frames"
```

**Required:** `description`, `action`, `outputPrefix`
**Optional:** `frames` (default: 3), `frameDescriptions`, `names`, `size`, `style`, `model`, `references`

### `forge_background`

Generate a full game background — no cropping, outputs the image as-is.

```
"Deep space background with stars and nebula, 16:9"
```

**Required:** `description`, `outputPath`, `aspect`
**Optional:** `style`, `model`

### `forge_thumbnail`

Generate a game thumbnail/screenshot. Pass `references` for visual consistency with your sprites.

```
"Space shooter scene with player ship vs alien rows"
```

**Required:** `description`, `outputPath`
**Optional:** `references`, `aspect` (default: 4:3), `style`, `model`

### `process_sprite`

Post-process an existing PNG — background removal, auto-crop, sprite sheet splitting.

```
"Split this sprite sheet into individual frames"
```

**Required:** `inputPath`
**Optional:** `outputPath`, `split`, `names`, `threshold`, `square`, `padding`, `skipCrop`, `skipTransparent`

### `optimize_sprite`

Downscale oversized AI images to true pixel art resolution using area-averaging (not blurry bilinear).

```
"Optimize this 1024px image down to 48px pixel art"
```

**Required:** `inputPath`, `size`
**Optional:** `outputPath`, `removeBackground`, `square`

> Full parameter docs: see [docs/tools.md](docs/tools.md)

## Models

| Alias | Model ID | Notes |
|-------|----------|-------|
| `nano-banana`, `banana` | nano-banana-pro-preview | **Default** — best for pixel art |
| `flash`, `gemini-flash` | gemini-3.1-flash-image-preview | Fast, reliable |
| `pro`, `gemini-pro` | gemini-3-pro-image-preview | Best quality |
| `25`, `gemini-25` | gemini-2.5-flash-image | Stable fallback |

## Prompts

### `pixel_art_guide`

Built-in MCP prompt with comprehensive pixel art generation guidelines — prompting rules, style tips, size recommendations, and best practices.

## License

MIT — see [LICENSE](LICENSE)

---

Built by [Tomas Grasl](https://tomasgrasl.cz)
