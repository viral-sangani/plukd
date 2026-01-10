const fs = require('fs');
const { exec } = require('child_process');

// Simple SVG to PNG conversion using resvg or similar CLI tool
// For now, we'll use a Node.js script with canvas/sharp if available

const convertSVGtoPNG = async () => {
  try {
    // Try using sharp if available
    const sharp = require('sharp');
    
    const sizes = [16, 48, 128];
    const svgPath = './public/icons/komand.svg';
    
    for (const size of sizes) {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(`./public/icons/icon${size}.png`);
      console.log(`Created icon${size}.png`);
    }
    console.log('Icon conversion complete!');
  } catch (error) {
    console.error('Sharp not available, trying alternative method...');
    console.error('Please install sharp: npm install sharp --save-dev');
  }
};

convertSVGtoPNG();
