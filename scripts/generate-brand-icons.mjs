// One-off script to rasterize the new assets/brand SVGs into the PNG sizes
// Expo's app.json icon config actually needs (SVG can't be used directly for
// native app icons). Run with: node scripts/generate-brand-icons.mjs
// Requires `sharp` (npm install --no-save sharp) - not a runtime dependency.
import sharp from 'sharp';
import { readFileSync } from 'fs';

const BRAND_COLOR = '#F97316';

const appIconSvg = readFileSync('assets/brand/app_icon.svg', 'utf8');
const glyphSvg = readFileSync('assets/brand/logo.svg', 'utf8');
const glyphWhiteSvg = glyphSvg.replace(/#F97316/g, '#FFFFFF');

async function render(svg, size, outPath) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log('wrote', outPath);
}

async function main() {
  // Main app icon (iOS + general) - full glyph-on-rounded-square mark.
  await render(appIconSvg, 1024, 'assets/icon.png');

  // Android adaptive icon: white glyph foreground + solid brand-color background,
  // composited by the OS. logo.svg's glyph already sits well inside the ~66%
  // safe zone at its native proportions, so no extra padding math needed.
  await render(glyphWhiteSvg, 1024, 'assets/android-icon-foreground.png');
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: BRAND_COLOR },
  })
    .png()
    .toFile('assets/android-icon-background.png');
  console.log('wrote assets/android-icon-background.png');

  // Monochrome (Android 13+ themed icons) - white glyph on transparent, OS tints it.
  await render(glyphWhiteSvg, 1024, 'assets/android-icon-monochrome.png');

  // Favicon (web tab icon, low-stakes) - same mark as the main app icon.
  await render(appIconSvg, 196, 'assets/favicon.png');
}

main();
