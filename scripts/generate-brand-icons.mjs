// Rasterizes brand icon assets from a single master PNG:
// assets/brand/logo-master.png - the "two people, hands reaching" mark, a
// gradient raster illustration (photographic shading, not flat vector art),
// so it's kept as a raster master rather than traced into SVG paths, which
// would lose the gradient fidelity.
//
// Run with: node scripts/generate-brand-icons.mjs
// Requires `sharp` (npm install --no-save sharp) - not a runtime dependency.
import sharp from 'sharp';

const MASTER = 'assets/brand/logo-master.png';
const CREAM = '#FBF7F2'; // colors.background - splash bg, matches app theme

// The master's background is near-white (~#FEFDFD). Keying purely on
// "distance from white" (255 - min(r,g,b)) fades light, low-saturation
// glyph colors (the amber side of the gradient) toward transparent right
// along with the true background, since both are "close to white" in that
// metric. Instead, snap to a hard threshold with a narrow anti-aliasing
// band right at the edge: anything clearly more saturated than the
// background goes fully opaque regardless of how light it is.
const AA_LOW = 12; // distance-from-white below this = pure background
const AA_HIGH = 40; // distance-from-white above this = pure glyph
async function keyOutWhite(input) {
  const img = sharp(input);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, o = 0; i < data.length; i += channels, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const distance = 255 - Math.min(r, g, b);
    let alpha;
    if (distance <= AA_LOW) alpha = 0;
    else if (distance >= AA_HIGH) alpha = 255;
    else alpha = Math.round(((distance - AA_LOW) / (AA_HIGH - AA_LOW)) * 255);
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = alpha;
  }
  return sharp(out, { raw: { width, height, channels: 4 } });
}

async function boundingBox(rgba) {
  const { data, info } = await rgba.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, width, height };
}

// Crops the keyed glyph to its content and pads it into a transparent square
// canvas at `size`, with the glyph's larger dimension scaled to `fill` (0-1)
// of the canvas - e.g. 0.66 for Android's adaptive-icon safe zone.
async function glyphOnTransparent(keyed, box, size, fill) {
  const contentW = box.maxX - box.minX;
  const contentH = box.maxY - box.minY;
  const scale = (size * fill) / Math.max(contentW, contentH);
  const targetW = Math.round(contentW * scale);
  const targetH = Math.round(contentH * scale);

  const cropped = await keyed
    .clone()
    .extract({ left: box.minX, top: box.minY, width: contentW, height: contentH })
    .resize(targetW, targetH)
    .png()
    .toBuffer();

  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: cropped, left: Math.round((size - targetW) / 2), top: Math.round((size - targetH) / 2) }])
    .png();
}

async function main() {
  const keyed = await keyOutWhite(MASTER);
  const box = await boundingBox(keyed.clone());

  // Main app icon (iOS + general) - full artwork on its native white ground,
  // OS applies its own corner mask, so an opaque square is correct here.
  await sharp(MASTER).resize(1024, 1024).png().toFile('assets/icon.png');
  console.log('wrote assets/icon.png');

  // Android adaptive icon: transparent glyph foreground (66% safe zone) +
  // solid background layer. White background (not brand orange) because the
  // glyph itself now carries the orange gradient - orange-on-orange would
  // have muddied the contrast the old white-glyph/orange-bg pairing relied on.
  const foreground = await glyphOnTransparent(keyed, box, 1024, 0.66);
  await foreground.toFile('assets/android-icon-foreground.png');
  console.log('wrote assets/android-icon-foreground.png');

  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#FFFFFF' } })
    .png()
    .toFile('assets/android-icon-background.png');
  console.log('wrote assets/android-icon-background.png');

  // Monochrome (Android 13+ themed icons): same silhouette, flattened to
  // solid white so the OS can tint it with the user's system accent color.
  const { data, info } = await foreground.clone().raw().toBuffer({ resolveWithObject: true });
  const mono = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    mono[i] = 255;
    mono[i + 1] = 255;
    mono[i + 2] = 255;
    mono[i + 3] = data[i + 3];
  }
  await sharp(mono, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile('assets/android-icon-monochrome.png');
  console.log('wrote assets/android-icon-monochrome.png');

  // Splash screen: transparent glyph, smaller/centered (splash reads as a
  // logo on a plain field, not an icon that needs to fill a safe zone),
  // shown against the app's own cream background color via expo-splash-screen.
  const splashGlyph = await glyphOnTransparent(keyed, box, 1024, 0.42);
  await splashGlyph.toFile('assets/splash-icon.png');
  console.log('wrote assets/splash-icon.png');

  // Favicon - reuses the opaque icon composition at browser tab size.
  await sharp(MASTER).resize(196, 196).png().toFile('assets/favicon.png');
  console.log('wrote assets/favicon.png');

  // Website nav logo - transparent glyph, generous but not safe-zone-tight
  // padding, sized for an inline <img> next to the "kinly" wordmark.
  const webLogo = await glyphOnTransparent(keyed, box, 256, 0.88);
  await webLogo.toFile('assets/brand/logo-web.png');
  console.log('wrote assets/brand/logo-web.png');
}

main();
