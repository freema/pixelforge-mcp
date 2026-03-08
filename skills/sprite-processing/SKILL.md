---
name: sprite-processing
description: Use when processing, cropping, splitting, or cleaning up existing sprite images or sprite sheets. Triggers on "crop sprite", "remove background", "split sprite sheet", "make transparent", "process PNG".
---

# Sprite Processing with PixelForge

Use `process_sprite` to clean up existing images into game-ready sprites.

## Single Sprite Processing

Remove background and auto-crop:
```
process_sprite
  inputPath: "raw-enemy.png"
  outputPath: "public/assets/games/rpg/enemy.png"
  background: "black"
  square: true
```

## Split Sprite Sheet

Split a horizontal sprite sheet into individual frames:
```
process_sprite
  inputPath: "animation-sheet.png"
  outputPath: "public/assets/games/rpg/hero"
  split: true
  names: ["idle", "walk-1", "walk-2", "attack"]
  background: "white"
  square: true
```
Outputs: `hero-idle.png`, `hero-walk-1.png`, `hero-walk-2.png`, `hero-attack.png`

## Two-Pass Processing

When sprite sheet has white background but individual sprites have black background:
```
# 1. Split sheet (removes white bg between sprites)
process_sprite
  inputPath: "sheet.png"
  outputPath: "public/assets/sprites/char"
  split: true
  names: ["head", "body", "legs"]
  background: "white"
  square: true

# 2. Remove black bg from each sprite
process_sprite
  inputPath: "public/assets/sprites/char-head.png"
  background: "black"
  threshold: 8
  skipCrop: true
```

## Options Reference

| Option | Default | Description |
|--------|---------|-------------|
| `background` | auto-detect | `"black"`, `"white"`, or `"auto"` |
| `threshold` | 20 | Color detection sensitivity (0-255) |
| `square` | false | Pad output to square dimensions |
| `padding` | 2 | Pixels of padding around content |
| `split` | false | Split sheet into individual sprites |
| `names` | 0, 1, 2... | Names for split sprites |
| `skipCrop` | false | Keep original dimensions |
| `skipTransparent` | false | Don't remove background |
