<!-- mcp-name: io.github.freema/pixelforge-mcp -->

# pixelforge-mcp

MCP server that forges pixel art sprites & game assets using Google Gemini — generate, crop, split & process, all from your AI assistant.

## Features

- **AI-powered generation** — sprites, animations, backgrounds, thumbnails, tilesets and item kits via Google Gemini
- **Smart post-processing** — background removal, auto-crop, pixelation downscale, square padding
- **Chroma key transparency** — `background: "chromakey"` generates on pure green and keys it out in HSV space for clean edges
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
**Optional:** `size` (default: 48), `style`, `background` (default: black, see [Backgrounds & transparency](#backgrounds--transparency)), `aspect`, `square`, `model`, `references`

### `forge_animation`

Generate animation frames as individual, ready-to-use frame PNGs.

By default each frame is generated in its own request, with the first frame passed as a reference image to the following ones (reference chain) — this keeps proportions, colors and outline consistent across frames. Set `useReferenceChain: false` to generate a single sprite sheet and auto-split it instead. `useTemplate: true` does the same and additionally guides the sheet with a numbered grid template.

```
"Animate a slime bouncing, 4 frames"
```

**Required:** `description`, `action`, `outputPrefix`
**Optional:** `frames` (default: 3), `frameDescriptions`, `names`, `size`, `style`, `background` (default: black, see [Backgrounds & transparency](#backgrounds--transparency)), `square`, `useReferenceChain` (default: true), `useTemplate` (default: false), `model`, `references`

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

### `forge_tileset`

Generate a seamless, tileable square texture for terrain, floors and walls. No background removal — the texture fills the whole canvas.

```
"Seamless grass terrain tile, 32px, snes style"
```

**Required:** `description`, `outputPath`
**Optional:** `size` (default: 32), `style`, `model`

### `forge_item_kit`

Generate up to 16 related sprites in one batch. Items are drawn together on a grid for visual consistency, then split into individual PNGs.

```
"Fruit icons: red apple, banana, cherry, grapes"
```

**Required:** `items`, `outputPrefix`
**Optional:** `names`, `size` (default: 48), `style`, `background`, `square`, `model`, `references`

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

## Backgrounds & transparency

Sprites are generated on a flat background color that is removed afterwards. The `background` parameter picks that color:

| Value | Background | Removal |
|-------|------------|---------|
| `chromakey` | Pure green `#00FF00` | HSV chroma key — **recommended** for `forge_sprite` and `forge_animation` |
| `black` (default), `white` | Pure black / white | Soft alpha matting against the background color |
| `forest`, `sky`, `dungeon`, `lava`, `ocean`, `sand`, `snow`, `night` | Scene-tinted solid color | Soft alpha matting against the background color |
| `auto` | Picked from keywords in the description (falls back to `black`) | Soft alpha matting against the background color |

**Chroma key** (`background: "chromakey"`) asks the model for a pure green screen and a bold dark outline around the sprite, then removes every pixel whose hue is within ±22° of green (with saturation and value above 0.3). Pixels just outside that range get a soft alpha ramp, so edges stay clean. Unlike the black or white backgrounds, it cannot eat dark or light pixels that belong to the sprite itself.

```
"Generate a knight sprite, 64px, background chromakey"
```

Avoid `chromakey` for sprites that are themselves bright green (slimes, leaves, emeralds) — those pixels would be keyed out as well. Use `black`, `white` or a scene color for them.

`chromakey` is never chosen by `auto`; it has to be requested explicitly. The HSV keyer runs in `forge_sprite` and `forge_animation`; `forge_item_kit` accepts the same `background` values but always uses the regular matting.

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
