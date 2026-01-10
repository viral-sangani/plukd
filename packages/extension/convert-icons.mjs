import sharp from 'sharp';

const convertSVGtoPNG = async () => {
  try {
    const sizes = [16, 48, 128];
    const svgPath = './public/icons/komand.svg';

    for (const size of sizes) {
      await sharp(svgPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(`./public/icons/icon${size}.png`);
      console.log(`✓ Created icon${size}.png`);
    }
    console.log('\n✨ Icon conversion complete!');
  } catch (error) {
    console.error('❌ Error converting icons:', error.message);
  }
};

convertSVGtoPNG();
