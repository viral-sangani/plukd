import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const SOURCE_ICON = path.join(__dirname, '../public/icon.png');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

async function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Generating PWA icons from:', SOURCE_ICON);

  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);

    await sharp(SOURCE_ICON)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 } // #0a0a0a background
      })
      .png()
      .toFile(outputPath);

    console.log(`Generated: icon-${size}x${size}.png`);
  }

  // Generate Apple touch icon (180x180)
  const appleTouchIconPath = path.join(__dirname, '../public/apple-touch-icon.png');
  await sharp(SOURCE_ICON)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 10, g: 10, b: 10, alpha: 1 }
    })
    .png()
    .toFile(appleTouchIconPath);
  console.log('Generated: apple-touch-icon.png');

  // Generate favicon (32x32)
  const faviconPath = path.join(__dirname, '../public/favicon.ico');
  await sharp(SOURCE_ICON)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 10, g: 10, b: 10, alpha: 1 }
    })
    .png()
    .toFile(faviconPath.replace('.ico', '.png'));
  console.log('Generated: favicon.png');

  console.log('\nAll PWA icons generated successfully!');
}

generateIcons().catch(console.error);
