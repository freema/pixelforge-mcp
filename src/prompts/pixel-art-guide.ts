export const pixelArtGuideName = 'pixel_art_guide';

export const pixelArtGuideDescription =
  'Comprehensive pixel art generation guidelines — prompting rules, style tips, and best practices for creating game assets with AI.';

export function getPixelArtGuide(): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: PIXEL_ART_GUIDE,
        },
      },
    ],
  };
}

const PIXEL_ART_GUIDE = `# Pixel Art Generation Guide

## Prompting Rules (Critical)

1. **Always specify background**: "pure black background" or "pure white background"
   - Black works best for neon/dark-themed games
   - White works best for light/casual games
   - Solid color backgrounds enable clean extraction

2. **Always add "No text, no labels, no watermark, no other elements"**
   - AI models love adding random text — this prevents it

3. **Specify proportions**: "square shape", "7 times wider than tall", "~2.5:1 aspect ratio"

4. **Be specific about visual style**:
   - "pixel art" (always include this)
   - "dark outline" (gives sprites clean edges)
   - Add style keywords: "8-bit", "16-bit", "retro arcade", "neon glowing"

## Style Presets

| Style    | Best For                        | Keywords                                            |
|----------|--------------------------------|-----------------------------------------------------|
| neon     | Arcade, space, cyberpunk       | neon glowing, vibrant colors, dark outline, glow    |
| retro    | Classic arcade, NES style      | 8-bit, limited palette, chunky pixels               |
| gameboy  | Monochrome, minimal            | 4-color green palette, dithered shading             |
| snes     | RPG, detailed games            | 16-bit, rich colors, detailed shading               |
| clean    | Generic, versatile             | solid colors, dark outline, no anti-aliasing        |

## Aspect Ratio Selection

| Content          | Aspect | Why                                    |
|------------------|--------|----------------------------------------|
| Single sprite    | 1:1    | Square works for most game objects     |
| Wide asset       | 16:9   | Paddles, platforms, wide items         |
| Sprite sheet     | 4:3    | Horizontal row of frames needs width   |
| Portrait game bg | 3:4    | Mobile/portrait game backgrounds       |
| Landscape bg     | 16:9   | Desktop/landscape game backgrounds     |

## Animation Sprite Sheets

When generating animation frames:
- Always request "in horizontal row, evenly spaced"
- Specify exact frame count and describe each frame
- Use 4:3 aspect for sheets (gives room for horizontal layout)
- Example: "three frames: first pose wings up, second pose wings middle, third pose wings down"

## Reference Images

- Use reference images when you need style consistency across multiple assets
- Most useful for thumbnails that should match actual game sprites
- Gemini will attempt to match the visual style of reference images

## Post-Processing

All forge_sprite and forge_animation outputs are automatically:
- Cropped to content bounding box
- Background removed (made transparent)
- Optionally padded to square

For backgrounds and thumbnails, no processing is applied — they go straight to the game.
`;
