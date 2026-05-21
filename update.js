const fs = require('fs');
let code = fs.readFileSync('meustudio.js', 'utf8');

// 1. Translations
code = code.replace(/'Video Device'/g, "'Câmera'");
code = code.replace(/'Display Capture'/g, "'Tela'");
code = code.replace(/'Game Capture'/g, "'Jogo'");
code = code.replace(/'Media Source'/g, "'Mídia'");
code = code.replace(/'Image'/g, "'Imagem'");
code = code.replace(/'Browser'/g, "'Navegador'");
code = code.replace(/'Text'/g, "'Texto'");
code = code.replace(/'Rectangle'/g, "'Retângulo'");

// 2. createLayerData
code = code.replace(/radius: 0,(\s*)effects: \[\]/g, "radius: 0,\n    text: 'Novo Texto',\n    color: '#ffffff',\n    fontsize: 48,$1effects: []");

// 3. updateInspectorProps
let propsCode = `    if (rdL) rdL.textContent = layer.radius;
    const pText = document.getElementById('propText');
    if (pText) pText.value = layer.text !== undefined ? layer.text : '';
    const pColor = document.getElementById('propColor');
    if (pColor) pColor.value = layer.color || '#ffffff';
    const pFontSize = document.getElementById('propFontSize');
    if (pFontSize) pFontSize.value = layer.fontsize || 48;
    const rowText = document.getElementById('propRowText');
    const rowStyle = document.getElementById('propRowStyle');
    if (rowText) rowText.style.display = (layer.type === 'Texto') ? 'flex' : 'none';
    if (rowStyle) rowStyle.style.display = (layer.type === 'Texto' || layer.type === 'Retângulo') ? 'flex' : 'none';`;
code = code.replace(/    if \(rdL\) rdL\.textContent = layer\.radius;/g, propsCode);

// 4. updateLayerProp
let layerPropCode = `    case 'radius': l.radius = val; document.getElementById('propRadiusLabel').textContent = val; break;
    case 'text': l.text = value; break;
    case 'color': l.color = value; break;
    case 'fontsize': l.fontsize = val; break;`;
code = code.replace(/    case 'radius': l\.radius = val; document\.getElementById\('propRadiusLabel'\)\.textContent = val; break;/g, layerPropCode);

// 5. renderLayerContent - Texto
code = code.replace(/\} else if \(l\.type === 'Texto'\) \{\s*c\.innerHTML = '<i class="fas fa-font" style="font-size:2rem;margin-bottom:10px"><\/i><span>' \+ l\.name \+ '<\/span>';\s*\}/, `} else if (l.type === 'Texto') {
      c.style.background = 'transparent';
      const div = document.createElement('div');
      div.textContent = l.text;
      div.style.color = l.color;
      div.style.fontSize = l.fontsize + 'px';
      div.style.textAlign = 'center';
      div.style.whiteSpace = 'pre-wrap';
      c.appendChild(div);
    }`);

// 6. renderLayerContent - Retângulo
code = code.replace(/\} else if \(l\.type === 'Retângulo'\) \{\s*c\.style\.background = l\._fillColor \|\| randomColor\(\);\s*\}/, `} else if (l.type === 'Retângulo') {
      c.style.background = l.color || l._fillColor || randomColor();
    }`);

fs.writeFileSync('meustudio.js', code);
console.log('meustudio.js updated successfully');
