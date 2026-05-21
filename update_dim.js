const fs = require('fs');
let code = fs.readFileSync('meustudio.js', 'utf8');

// 1. Change default width and height in createLayerData
code = code.replace(/x: 0, y: 0, w: 640, h: 360, rot: 0/g, 'x: 0, y: 0, w: 960, h: 640, rot: 0');

// 2. Change width and height in syncHtmlOnly
code = code.replace(/const w = 960;\s*const h = 540;/g, 'const w = 960;\n     const h = 640;');

// 3. Change Background layer in initDefaults (it currently has w: 1920, h: 1080)
code = code.replace(/_fillColor: '#000080', w: 1920, h: 1080/g, "_fillColor: '#000080', w: 960, h: 640");

fs.writeFileSync('meustudio.js', code);
console.log('meustudio.js updated with new dimensions');
