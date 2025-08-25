const fs = require('fs');
const PNG = require('pngjs').PNG;

// Create icons directory if it doesn't exist
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

// Function to create a simple colored square PNG
function createIcon(size, filename, color) {
  const png = new PNG({
    width: size,
    height: size,
    filterType: -1
  });
  
  // Fill with a solid color (simplified - just setting RGB values)
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = color.r;     // Red
      png.data[idx + 1] = color.g; // Green
      png.data[idx + 2] = color.b; // Blue
      png.data[idx + 3] = 255;     // Alpha
    }
  }
  
  png.pack().pipe(fs.createWriteStream(`icons/${filename}`));
}

// Create icons with different colors
createIcon(16, 'icon16.png', { r: 65, g: 105, b: 225 });   // Royal Blue
createIcon(48, 'icon48.png', { r: 50, g: 205, b: 50 });    // Lime Green
createIcon(128, 'icon128.png', { r: 255, g: 165, b: 0 });  // Orange

console.log('Icons generated successfully!');