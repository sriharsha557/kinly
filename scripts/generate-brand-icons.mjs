// Rasterizes brand assets from two raster masters (both kept as raster,
// not traced into SVG, since they're photographic/gradient illustrations
// rather than flat vector art):
//
// - assets/brand/app-icon-master.png - flat orange background + solid
//   white "two people, hands reaching" glyph, purpose-built as an app icon.
//   Drives every native icon surface: icon.png, the Android adaptive-icon
//   layers, splash-icon.png, favicon.png.
// - assets/brand/logo-master.png - the original gradient version of the
//   same mark (orange-to-amber, white background). Drives only the
//   website's inline nav logo (logo-web.png), which needs to read on a
//   white/cream page background rather than sit on its own orange field.
//
// Run with: node scripts/generate-brand-icons.mjs
// Requires `sharp` (npm install --no-save sharp) - not a runtime dependency.
import sharp from 'sharp';

const APP_ICON_MASTER = 'assets/brand/app-icon-master.png';
const WEB_LOGO_MASTER = 'assets/brand/logo-master.png';
const BRAND_ORANGE = '#F97316'; // colors.primary - keep the adaptive-icon
// background pinned to this exact token rather than the master PNG's own
// sampled background pixel, which lands a shade more saturated (~#fb5c04)
// than what buttons/headers actually use elsewhere in the app.

// Keys out a solid/near-solid background by distance from a given color,
// snapping to a hard threshold with a narrow anti-aliasing band at the
// edge - a plain linear falloff would fade light, low-saturation glyph
// pixels toward transparent right along with the real background.
const AA_LOW = 20;
const AA_HIGH = 80;
async function keyOutColor(input, bg) {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, o = 0; i < data.length; i += channels, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const distance = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
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

async function flattenToWhite(rgba) {
  const { data, info } = await rgba.clone().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = data[i + 3];
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function samplePixel(input, x, y) {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

async function generateAppIcon() {
  const bgColor = await samplePixel(APP_ICON_MASTER, 2, 2);
  const keyed = await keyOutColor(APP_ICON_MASTER, bgColor);
  const box = await boundingBox(keyed.clone());
  // Same proportion the glyph already occupies in the master, so icon.png
  // reproduces its exact composition - just recolored onto BRAND_ORANGE
  // instead of the master's own slightly-off sampled orange (~#fb5c04),
  // so every icon surface (this, the adaptive-icon background, favicon)
  // is pixel-identical in color.
  const masterFill = Math.max(box.maxX - box.minX, box.maxY - box.minY) / box.width;

  async function iconOnBrandOrange(size) {
    const glyph = await glyphOnTransparent(keyed, box, size, masterFill);
    return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_ORANGE } })
      .composite([{ input: await glyph.png().toBuffer() }])
      .png();
  }

  // Main app icon (iOS + general) - OS applies its own corner mask, so an
  // opaque square is correct here.
  await (await iconOnBrandOrange(1024)).toFile('assets/icon.png');
  console.log('wrote assets/icon.png');

  // Android adaptive icon: transparent white-glyph foreground (66% safe
  // zone, deliberately tighter than icon.png's natural fill - the OS's own
  // circle/squircle mask crops closer to the safe-zone circle) + a solid
  // BRAND_ORANGE background layer.
  const foreground = await glyphOnTransparent(keyed, box, 1024, 0.66);
  await foreground.toFile('assets/android-icon-foreground.png');
  console.log('wrote assets/android-icon-foreground.png');

  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BRAND_ORANGE } })
    .png()
    .toFile('assets/android-icon-background.png');
  console.log(`wrote assets/android-icon-background.png (${BRAND_ORANGE})`);

  // Monochrome (Android 13+ themed icons) - same silhouette; already white,
  // flattened just to guarantee a pure white fill for OS tinting.
  const mono = await flattenToWhite(foreground);
  await mono.toFile('assets/android-icon-monochrome.png');
  console.log('wrote assets/android-icon-monochrome.png');

  // Favicon - reuses the opaque icon composition at browser tab size.
  await (await iconOnBrandOrange(196)).toFile('assets/favicon.png');
  console.log('wrote assets/favicon.png');
}

// The gradient master (orange-to-amber, keyed against its own white
// background) - used anywhere the glyph needs to sit on a light surface
// and therefore needs its own color to read at all: the website nav and
// the splash screen. app-icon-master's glyph is solid white, which is
// correct sitting on an orange field but would be invisible on cream.
async function keyGradientLogo() {
  const keyed = await keyOutColor(WEB_LOGO_MASTER, [254, 253, 253]);
  const box = await boundingBox(keyed.clone());
  return { keyed, box };
}

async function generateWebLogo() {
  const { keyed, box } = await keyGradientLogo();
  const webLogo = await glyphOnTransparent(keyed, box, 256, 0.88);
  await webLogo.toFile('assets/brand/logo-web.png');
  console.log('wrote assets/brand/logo-web.png');
}

async function generateSplashIcon() {
  const { keyed, box } = await keyGradientLogo();
  // Smaller/centered (splash reads as a logo on a plain field, not an icon
  // that needs to fill a safe zone), shown against the app's own cream
  // background color via expo-splash-screen.
  const splashGlyph = await glyphOnTransparent(keyed, box, 1024, 0.42);
  await splashGlyph.toFile('assets/splash-icon.png');
  console.log('wrote assets/splash-icon.png');
}

async function main() {
  await generateAppIcon();
  await generateWebLogo();
  await generateSplashIcon();
}

main();
