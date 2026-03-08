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

## Quick Start

### Single Sprite
```
forge_sprite
  description: "green slime enemy with horns and glowing eyes"
  outputPath: "public/assets/games/rpg/slime.png"
  style: "neon"
  background: "black"
```

### Animation Frames
```
forge_animation
  description: "green slime enemy"
  action: "bouncing up and down"
  frames: 4
  outputPrefix: "public/assets/games/rpg/slime"
  names: ["bounce-0", "bounce-1", "bounce-2", "bounce-3"]
  style: "neon"
```
Returns individual frame files: `slime-bounce-0.png`, `slime-bounce-1.png`, etc.

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
| `gemini-pro` | Medium | Best | Default — best for final assets |
| `gemini-flash` | Fast | Good | Good for quick iteration |
| `imagen` | Medium | High | Supports negative prompts |
| `imagen-fast` | Fast | Good | Fastest option |

## Guidelines

1. **forge_sprite and forge_animation auto-process** — output is always cropped, transparent, and ready to use
2. **forge_background outputs raw** — no cropping, full size for game scenes
3. **Use references for thumbnails** — pass actual game sprites so thumbnail matches the game's look
4. **Choose aspect ratio wisely** — 1:1 for sprites, 4:3 for sheets, 3:4 or 16:9 for backgrounds
5. **After generating, verify with Read tool** — Claude Code can display PNG files natively
6. **Phaser sprite sizing** — generated images are large (~1000px), always use `setDisplaySize()` in game code
