---
name: pixel-art-generation
description: Use when generating pixel art sprites, animations, backgrounds, thumbnails, or processing sprite sheets for games. Triggers on requests like "create a sprite", "generate pixel art", "make game assets", "split sprite sheet", "remove background from sprite".
---

# Pixel Art Generation with PixelForge

Use PixelForge MCP tools to generate and process pixel art game assets.

## Tools Overview

| Tool | When to Use |
|------|-------------|
| `forge_sprite` | Single sprite — character, item, icon, UI element |
| `forge_animation` | Animation frames — walk cycle, idle, attack, effects |
| `forge_background` | Full game background/scene — no processing applied |
| `forge_thumbnail` | Game thumbnail/screenshot — uses reference sprites |
| `process_sprite` | Post-process existing PNG — crop, bg removal, split |

## Background Removal — IMPORTANT

**Always use `background: "chromakey"` for sprites and animations.** This uses HSV-based green screen removal which is far more reliable than the old compositing equation approach.

- `chromakey` — **BEST** — pure green #00FF00, HSV-based removal, clean edges, no artifacts
- `black` / `white` — legacy compositing equation, can lose dark/light sprite pixels
- Other colors — fallback to compositing equation

## Quick Start

### Single Sprite
```
forge_sprite
  description: "green slime enemy with horns and glowing eyes"
  outputPath: "public/assets/games/rpg/slime.png"
  style: "neon"
  background: "chromakey"
```

### Animation Frames (Reference Chain — Default)
```
forge_animation
  description: "green slime enemy"
  action: "bouncing up and down"
  frames: 4
  frameDescriptions: ["idle resting on ground", "compressing flat", "stretching upward", "at peak of bounce"]
  outputPrefix: "public/assets/games/rpg/slime"
  names: ["idle", "compress", "stretch", "peak"]
  style: "neon"
  background: "chromakey"
```

**Reference chain mode (default):** Generates frame 0 first, then uses it as a reference image for all subsequent frames. This ensures consistent proportions, colors, and style across all frames. Each frame is a separate API call.

To use the legacy sprite-sheet mode instead: `useReferenceChain: false`

### Background
```
forge_background
  description: "deep space with stars, subtle neon grid on horizon, nebula wisps cyan and purple"
  outputPath: "public/assets/games/invaders/bg.png"
  aspect: "3:4"
  style: "neon"
```

### Thumbnail (with style-matching references)
```
forge_thumbnail
  description: "space shooter, cyan spaceship vs rows of colorful aliens, dark space"
  outputPath: "public/assets/games/invaders/thumbnail.png"
  references: ["public/assets/games/invaders/ship.png", "public/assets/games/invaders/alien.png"]
  aspect: "4:3"
```

## Animation Best Practices

1. **Always provide `frameDescriptions`** — explicit per-frame descriptions produce much better results than a generic action
2. **Use `chromakey` background** — prevents transparency artifacts
3. **Reference chain is default** — generates consistent frames by using frame 0 as reference
4. **For inconsistent results, try `useReferenceChain: false` with `useTemplate: true`** — grid template mode as fallback
5. **Keep frame count reasonable** — 3-4 frames per animation state is ideal

## Style Presets

| Style | Best For | Look |
|-------|----------|------|
| `neon` | Arcade, space, cyberpunk | Glowing, vibrant, dark outline |
| `retro` | Classic NES/arcade | 8-bit, limited palette, chunky |
| `gameboy` | Monochrome | 4-color green, dithered |
| `snes` | RPG, detailed | 16-bit, rich colors, detailed shading |
| `clean` | Generic/versatile | Solid colors, dark outline |

## Model Selection

| Alias | Speed | Quality | Notes |
|-------|-------|---------|-------|
| `nano-banana` | Fast | Good | Default — best balance |
| `pro` | Medium | Best | Best quality, use for hero assets |
| `gemini-flash` | Fast | Good | Good for quick iteration |

## Guidelines

1. **Always use `chromakey` background** for sprites and animations
2. **forge_sprite and forge_animation auto-process** — output is always cropped, transparent, and ready to use
3. **forge_background outputs raw** — no cropping, full size for game scenes
4. **Use references for thumbnails** — pass actual game sprites so thumbnail matches the game's look
5. **After generating, verify with Read tool** — Claude Code can display PNG files natively
6. **Phaser sprite sizing** — generated images are large (~1000px), always use `setDisplaySize()` in game code
