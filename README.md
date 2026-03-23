# pixelforge-mcp

MCP server that forges pixel art sprites & game assets using Google Gemini — generate, crop, split & process, all from your AI assistant.

## Features

- **AI-powered generation** — sprites, animations, backgrounds, thumbnails, tilesets, item kits via Google Gemini
- **Smart post-processing** — background removal, auto-crop, pixelation downscale, square padding
- **Sprite sheet splitting** — auto-detect and split sheets into individual frames
- **Seamless tiling** — generate tileable textures for terrain and backgrounds
- **Batch generation** — create multiple related sprites with visual consistency
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

## Quick Examples

```
"Generate a green slime enemy sprite, 48px, retro style"
"Create a bouncing ball animation with 4 frames"
"Make a grass tileset texture, 32px"
"Generate fruit item kit: apple, banana, cherry"
"Create space background with stars, 16:9 aspect ratio"
```

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

### `forge_tileset`

Generate a seamless tileable pixel art texture. Perfect for terrain, floors, walls, and backgrounds.

```
"Generate grass terrain tileset, 32px"
```

**Required:** `description`, `outputPath`
**Optional:** `size` (default: 32), `style`, `model`

### `forge_item_kit`

Generate multiple related sprites in a single batch for visual consistency. Ideal for item sets, collectibles, or inventory icons.

```
"Generate fruit items: apple, banana, cherry, grapes"
```

**Required:** `items`, `outputPrefix`
**Optional:** `names`, `size` (default: 48), `style`, `background`, `square`, `model`, `references`

### `optimize_sprite`

Downscale oversized AI images to true pixel art resolution using area-averaging (not blurry bilinear).

```
"Optimize this 1024px image down to 48px pixel art"
```

**Required:** `inputPath`, `size`
**Optional:** `outputPath`, `removeBackground`, `square`

## Models

| Alias | Model ID | Notes |
|-------|----------|-------|
| `nano-banana`, `banana` | nano-banana-pro-preview | **Default** — best for pixel art |
| `flash`, `gemini-flash`, `banana-2`, `nano-banana-2` | gemini-3.1-flash-image-preview | Fast, reliable |
| `pro`, `gemini-pro` | gemini-3-pro-image-preview | Best quality |
| `25`, `gemini-25`, `gemini-flash-25` | gemini-2.5-flash-image | Stable fallback |

## Prompts

### `pixel_art_guide`

Built-in MCP prompt with comprehensive pixel art generation guidelines — prompting rules, style tips, size recommendations, and best practices.

## License

MIT — see [LICENSE](LICENSE)

---

Built by [Tomas Grasl](https://tomasgrasl.cz)
