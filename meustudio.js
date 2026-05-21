// ============================================
// MEUSTUDIO - Protótipo Broadcast Studio
// Inspired by Meld Studio
// ============================================

const state = {
  isLive: false,
  isRecording: false,
  isClipping: false,
  activeScene: 0,

  activeLayer: null,
  activeTransition: 'cut',
  multiCanvas: false,
  vodMode: false,
  sceneCount: 3,
  sceneNames: {},
  layerIdCounter: 100,
  effectIdCounter: 200,
  audioTrackIdCounter: 300,
  sceneData: {},
  settings: {
    canvasRes: '1920x1080',
    fps: 60,
    encoder: 'hw',
    vbitrate: 6000,
    abitrate: 160,
    quality: 'balanced'
  }
};

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('DOM loaded, initializing...');
    initDefaults();
    console.log('initDefaults done');
    initMixer();
    console.log('initMixer done');
    updateSystemTime();
    setInterval(updateSystemTime, 1000);
    startStatsSim();
    startFPS();
    initTimeline();
    setupMenuHandlers();
    Object.keys(streamTargets).forEach(k => updateStreamTargetUI(k));
    console.log('Initialization complete');

    // Auto-start projection
    setTimeout(() => {
      autoProjectionEnabled = true;
      checkAutoProjection();
    }, 1000);

    // Debug: check if canvas has content
    setTimeout(() => {
      const grid = document.getElementById('canvasGrid');
      const viewport = document.getElementById('viewport');
      const app = document.getElementById('app');
      console.log('=== DEBUG ===');
      console.log('App:', app ? 'exists' : 'MISSING', app ? getComputedStyle(app).display : '');
      console.log('Viewport:', viewport ? 'exists' : 'MISSING');
      if (viewport) {
        const vr = viewport.getBoundingClientRect();
        console.log('Viewport rect:', Math.round(vr.width), 'x', Math.round(vr.height));
        console.log('Viewport bg:', getComputedStyle(viewport).backgroundColor);
      }
      console.log('Canvas grid:', grid ? 'exists' : 'MISSING');
      if (grid) {
        const gr = grid.getBoundingClientRect();
        console.log('Grid rect:', Math.round(gr.width), 'x', Math.round(gr.height));
        console.log('Grid bg:', getComputedStyle(grid).backgroundColor);
        console.log('Grid children:', grid.children.length);
        console.log('Grid offsetParent:', grid.offsetParent);
        console.log('Grid display:', getComputedStyle(grid).display);
        // Check first layer
        const firstLayer = grid.querySelector('canvas-layer');
        if (firstLayer) {
          console.log('First layer:', firstLayer.dataset.layer);
          console.log('First layer content:', firstLayer.querySelector('.layer-content') ? 'exists' : 'MISSING');
          console.log('First layer innerHTML:', firstLayer.innerHTML.substring(0, 200));
        }
      }
    }, 500);
  } catch(e) {
    console.error('Init error:', e);
    document.body.innerHTML = '<div style="color:#ff0;padding:40px;font-family:monospace;background:#000;min-height:100vh"><h2>Erro ao carregar:</h2><pre>' + e.message + '\n' + e.stack + '</pre></div>';
  }
});

function initDefaults() {
  let n = 1;
  function t(type, name, icon, extra) {
    const d = createLayerData(type, `${n} - ${name}`, icon);
    n++;
    if (extra) Object.assign(d, extra);
    return d;
  }
  state.sceneData[0] = [
    t('Câmera', 'Câmera Principal', 'fa-camera'),
    t('Texto', 'Overlay de texto', 'fa-font'),
    t('Retângulo', 'Moldura', 'fa-square', { _fillColor: '#008080' })
  ];
  state.sceneData[1] = []; // Sala dos Convidados - auto-populada
  state.sceneData[2] = [
    t('Texto', 'Volto Já!', 'fa-font'),
    t('Retângulo', 'Background', 'fa-square', { _fillColor: '#000080', w: 960, h: 640 })
  ];

  renderScenes();
  renderLayers(0);
  selectScene(0);

  // Auto-connect default camera
  setTimeout(function() {
    var layers = state.sceneData[0] || [];
    var cam = layers.find(function(l) { return l.type === 'Câmera'; });
    if (cam) connectCameraForLayer(cam.id);
  }, 500);
}

function createLayerData(type, name, icon) {
  return {
    id: ++state.layerIdCounter,
    type: type,
    name: name,
    icon: icon || 'fa-layer-group',
    visible: true,
    locked: false,
    x: 0, y: 0, w: 960, h: 640, rot: 0, opac: 100, radius: 0,
    text: 'Novo Texto',
    color: '#ffffff',
    fontsize: 48,
    effects: []
  };
}

// ============================================
// SYSTEM TIME
// ============================================
function updateSystemTime() {
  const el = document.getElementById('systemTime');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

// ============================================
// SCENES
// ============================================
function renderScenes() {
  const list = document.getElementById('scenesList');
  if (!list) return;
  const names = ['Cena Principal', 'Sala dos Convidados', 'BRB'];
  let html = '';
  for (let i = 0; i < state.sceneCount; i++) {
    const active = i === state.activeScene ? 'active' : '';
    const n = names[i] || `Cena ${i + 1}`;
    html += `
      <div class="scene-item ${active}" draggable="true" data-scene="${i}" onclick="selectScene(${i})"
        ondragstart="onSceneDragStart(event, ${i})" ondragover="onSceneDragOver(event)" ondrop="onSceneDrop(event, ${i})" ondragend="onSceneDragEnd(event)">
        <div class="scene-thumb"><i class="fas ${getSceneIcon(i)}"></i></div>
        <span class="scene-name">${n}</span>
        <div class="scene-actions">
          <button class="scene-edit" onclick="event.stopPropagation();editScene(${i})"><i class="fas fa-pen"></i></button>
          <button class="scene-del" onclick="deleteScene(event, ${i})"><i class="fas fa-times"></i></button>
        </div>
      </div>`;
  }
  list.innerHTML = html;
}

let _dragSrcIdx = null;
function onSceneDragStart(e, idx) {
  _dragSrcIdx = idx;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onSceneDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.scene-item').forEach(el => el.classList.remove('drag-over'));
  e.target.closest('.scene-item')?.classList.add('drag-over');
}
function onSceneDrop(e, idx) {
  e.preventDefault();
  e.target.closest('.scene-item')?.classList.remove('drag-over');
  if (_dragSrcIdx !== null && _dragSrcIdx !== idx) {
    moveScene(_dragSrcIdx, idx);
  }
  _dragSrcIdx = null;
}
function onSceneDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.scene-item').forEach(el => el.classList.remove('drag-over'));
  _dragSrcIdx = null;
}
function moveScene(from, to) {
  if (from === to) return;
  const keys = Object.keys(state.sceneData).map(Number).sort((a, b) => a - b);
  const scenes = keys.map(k => state.sceneData[k]);
  const [moved] = scenes.splice(from, 1);
  scenes.splice(to, 0, moved);
  state.sceneData = {};
  scenes.forEach((s, i) => { state.sceneData[i] = s; });
  state.activeScene = to;
  renderScenes();
  renderLayers(to);
  updateSceneLabel();
  toast(`Cena movida para posição ${to + 1}`, 'info');
}

function getSceneIcon(i) {
  const icons = ['fa-camera', 'fa-users', 'fa-clock', 'fa-music', 'fa-image', 'fa-film', 'fa-microphone', 'fa-palette'];
  return icons[i] || 'fa-camera';
}

function selectScene(idx) {
  if (state.activeScene === idx || state._transitioning) return;
  const type = state.activeTransition || 'cut';
  const dur = transDuration();

  if (type === 'cut') {
    finishSceneSwitch(idx);
    return;
  }

  state._transitioning = true;
  const viewport = document.getElementById('viewport');
  const grid = document.getElementById('canvasGrid');
  const clone = grid.cloneNode(true);
  clone.id = 'transClone';
  clone.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:100;pointer-events:none;background:var(--bg1);overflow:hidden;';
  grid.parentNode.appendChild(clone);

  if (type === 'fade') {
    clone.style.transition = `opacity ${dur}ms ease`;
    requestAnimationFrame(() => { clone.style.opacity = '0'; });
  } else if (type === 'morph') {
    clone.style.transition = `opacity ${dur}ms ease, transform ${dur}ms ease`;
    clone.style.transformOrigin = 'center center';
    requestAnimationFrame(() => { clone.style.opacity = '0'; clone.style.transform = 'scale(0.85)'; });
  } else if (type === 'move') {
    clone.style.transition = `transform ${dur}ms ease`;
    requestAnimationFrame(() => { clone.style.transform = 'translateX(-100%)'; });
  }

  finishSceneSwitch(idx);

  setTimeout(() => {
    const c = document.getElementById('transClone');
    if (c) c.remove();
    state._transitioning = false;
  }, dur + 50);
}

function finishSceneSwitch(idx) {
  state.activeScene = idx;
  document.querySelectorAll('.scene-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  if (idx === 1) {
    updateGuestRoomScene();
  } else {
    renderLayers(idx);
  }
  updateSceneLabel();
  toast(`Cena: ${getSceneName(idx)}`, 'info');
}

function getSceneName(idx) {
  if (state.sceneNames && state.sceneNames[idx]) return state.sceneNames[idx];
  const names = ['Cena Principal', 'Sala dos Convidados', 'BRB'];
  return names[idx] || `Cena ${idx + 1}`;
}

function updateSceneLabel() {
  const el = document.getElementById('currentSceneLabel');
  if (el) el.textContent = getSceneName(state.activeScene);
}

function addScene() {
  state.sceneCount++;
  state.sceneData[state.sceneCount - 1] = [];
  if (!state.sceneNames) state.sceneNames = {};
  renderScenes();
  selectScene(state.sceneCount - 1);
  toast('Nova cena adicionada', 'success');
}

function editScene(idx) {
  var cur = getSceneName(idx);
  var name = prompt('Renomear cena:', cur);
  if (name && name.trim()) {
    if (!state.sceneNames) state.sceneNames = {};
    state.sceneNames[idx] = name.trim();
    renderScenes();
    updateSceneLabel();
    toast('Cena renomeada: ' + name.trim(), 'success');
  }
}

function deleteScene(e, idx) {
  e.stopPropagation();
  if (state.sceneCount <= 1) { toast('Deve haver pelo menos 1 cena', 'warning'); return; }
  if (state.activeScene === idx) {
    const next = idx > 0 ? idx - 1 : 0;
    selectScene(next);
  }
  delete state.sceneData[idx];
  state.sceneCount--;
  // Re-index data
  const newData = {};
  let j = 0;
  for (let i = 0; i < state.sceneCount + 1; i++) {
    if (state.sceneData[i] !== undefined) {
      newData[j++] = state.sceneData[i];
    }
  }
  state.sceneData = newData;
  if (state.activeScene >= state.sceneCount) state.activeScene = state.sceneCount - 1;
  renderScenes();
  selectScene(state.activeScene);
  toast('Cena removida', 'info');
}

// ============================================
// TRANSITIONS
// ============================================
function setTransition(type) {
  state.activeTransition = type;
  document.querySelectorAll('.trans-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.trans === type);
  });
  document.getElementById('viewport').style.transition = type === 'cut' ? 'none' : `all ${transDuration()}ms ease`;
  toast(`Transição: ${type.toUpperCase()}`, 'info');
}

function transDuration() {
  const inp = document.getElementById('transDuration');
  const lbl = document.getElementById('transDurationLabel');
  if (inp && lbl) lbl.textContent = inp.value + 'ms';
  return inp ? parseInt(inp.value) : 500;
}

// ============================================
// LAYERS
// ============================================
function renderLayers(sceneIdx) {
  const list = document.getElementById('layersList');
  if (!list) return;
  const layers = state.sceneData[sceneIdx] || [];
  if (layers.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:.7rem">Nenhuma camada</div>';
    renderCanvas(layers);
    return;
  }
  let html = '';
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const sel = state.activeLayer === l.id ? 'selected' : '';
    const vis = l.visible ? '' : 'hidden';
    const lock = l.locked ? 'locked' : '';
    html += `
      <div class="layer-item ${sel}" data-layer="${l.id}" onclick="selectLayer(${l.id})">
        <span class="lyr-icon"><i class="fas ${l.icon}"></i></span>
        <span class="lyr-name">${l.name}</span>
        <span class="lyr-actions">
          <button class="lyr-vis ${vis}" onclick="event.stopPropagation();toggleLayerVis(${l.id})" title="Visível"><i class="fas ${l.visible ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
          <button class="lyr-lock ${lock}" onclick="event.stopPropagation();toggleLayerLock(${l.id})" title="Travar"><i class="fas ${l.locked ? 'fa-lock' : 'fa-unlock'}"></i></button>
          <button onclick="event.stopPropagation();removeLayer(${l.id})" title="Remover"><i class="fas fa-times"></i></button>
        </span>
      </div>`;
  }
  list.innerHTML = html;
  renderCanvas(layers);
}

function selectLayer(id) {
  state.activeLayer = id;
  const layers = state.sceneData[state.activeScene] || [];
  document.querySelectorAll('.layer-item').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.layer) === id);
  });
  document.querySelectorAll('canvas-layer').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.layer) === id);
  });
  const layer = layers.find(l => l.id === id);
  if (layer) updateInspectorProps(layer);
}

function toggleLayerVis(id) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === id);
  if (l) { l.visible = !l.visible; renderLayers(state.activeScene); }
}

function toggleLayerLock(id) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === id);
  if (l) { l.locked = !l.locked; renderLayers(state.activeScene); }
}

function removeLayer(id) {
  let layers = state.sceneData[state.activeScene] || [];
  layers = layers.filter(l => l.id !== id);
  state.sceneData[state.activeScene] = layers;
  if (state.activeLayer === id) state.activeLayer = null;
  renderLayers(state.activeScene);
  toast('Camada removida', 'info');
}

function addLayer(type) {
  const layers = state.sceneData[state.activeScene] || [];
  const iconMap = {
    'Câmera': 'fa-camera',
    'Tela': 'fa-desktop',
    'Jogo': 'fa-gamepad',
    'Mídia': 'fa-file-video',
    'Imagem': 'fa-image',
    'Navegador': 'fa-globe',
    'Texto': 'fa-font',
    'Markdown': 'fab fa-markdown',
    'Retângulo': 'fa-square',
    'Widget': 'fa-puzzle-piece',
    'Group': 'fa-object-group'
  };
  const data = createLayerData(type, type, iconMap[type] || 'fa-layer-group');
  layers.push(data);
  state.sceneData[state.activeScene] = layers;
  renderLayers(state.activeScene);
  selectLayer(data.id);
  document.getElementById('addLayerMenu').style.display = 'none';
  toast(`Camada adicionada: ${type}`, 'success');
  // Auto-connect camera devices
  if (type === 'Câmera') {
    setTimeout(function() { connectCameraForLayer(data.id); }, 100);
  }
}

function toggleAddLayerMenu() {
  const m = document.getElementById('addLayerMenu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

// ============================================
// CANVAS RENDERING
// ============================================
function renderCanvas(layers) {
  const grid = document.getElementById('canvasGrid');
  const empty = document.getElementById('emptyCanvas');
  if (!grid) return;
  const visible = (layers || []).filter(l => l.visible);

  if (visible.length === 0) {
    empty.style.display = 'flex';
    grid.querySelectorAll('canvas-layer').forEach(el => el.remove());
    return;
  }
  empty.style.display = 'none';

  // Remove elements for deleted layers
  const existing = grid.querySelectorAll('canvas-layer');
  existing.forEach(el => {
    const id = parseInt(el.dataset.layer);
    if (!visible.find(l => l.id === id)) el.remove();
  });

  visible.forEach(l => {
    let el = grid.querySelector(`canvas-layer[data-layer="${l.id}"]`);
    if (!el) {
      el = document.createElement('canvas-layer');
      el.dataset.layer = l.id;
      el.style.position = 'absolute';
      el.onclick = () => selectLayer(l.id);
      grid.appendChild(el);

      const content = document.createElement('div');
      content.className = 'layer-content';
      el.appendChild(content);
    }
    const content = el.querySelector('.layer-content');
    el.style.left = l.x + 'px';
    el.style.top = l.y + 'px';
    el.style.width = l.w + 'px';
    el.style.height = l.h + 'px';
    el.style.transform = `rotate(${l.rot}deg)`;
    el.style.opacity = l.opac / 100;
    el.style.borderRadius = l.radius + 'px';
    el.classList.toggle('selected', state.activeLayer === l.id);

    // Number badge
    let badge = el.querySelector('.layer-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'layer-badge';
      el.appendChild(badge);
    }
    const num = (l.name || '').match(/^(\d+)/);
    badge.textContent = num ? num[1] : '';
    badge.style.display = num ? 'flex' : 'none';

    console.log('Rendering layer', l.id, 'type:', l.type, 'stream:', !!l._stream, 'size:', l.w, 'x', l.h);
    renderLayerContent(l, content);
  });
}

let _colorIdx = 0;
function randomColor() {
  const colors = ['#B8860B','#2979ff','#00e5ff','#ff9100','#00e676','#ffc107','#aa00ff','#ff6d00'];
  return colors[_colorIdx++ % colors.length];
}

// ============================================
// INSPECTOR
// ============================================
function updateInspectorProps(layer) {
  const fields = ['propX', 'propY', 'propW', 'propH'];
  const vals = [layer.x, layer.y, layer.w, layer.h];
  fields.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.value = vals[i];
  });
  const rot = document.getElementById('propRot');
  if (rot) rot.value = layer.rot;
  const rotL = document.getElementById('propRotLabel');
  if (rotL) rotL.textContent = layer.rot + '°';
  const op = document.getElementById('propOpac');
  if (op) op.value = layer.opac;
  const opL = document.getElementById('propOpacLabel');
  if (opL) opL.textContent = layer.opac + '%';
  const rd = document.getElementById('propRadius');
  if (rd) rd.value = layer.radius;
  const rdL = document.getElementById('propRadiusLabel');
  if (rdL) rdL.textContent = layer.radius;

  const textRow = document.getElementById('propRowText');
  const styleRow = document.getElementById('propRowStyle');
  if (layer.type === 'Texto') {
    if (textRow) textRow.style.display = 'flex';
    if (styleRow) styleRow.style.display = 'grid';
    const textEl = document.getElementById('propText');
    if (textEl) textEl.value = layer._textContent || layer.text || layer.name || '';
    const colorEl = document.getElementById('propColor');
    if (colorEl) colorEl.value = layer.color || '#ffffff';
    const fontEl = document.getElementById('propFontSize');
    if (fontEl) fontEl.value = layer.fontsize || 48;
  } else if (layer.type === 'Retângulo') {
    if (textRow) textRow.style.display = 'none';
    if (styleRow) styleRow.style.display = 'grid';
    const colorEl = document.getElementById('propColor');
    if (colorEl) colorEl.value = layer._fillColor || '#2979ff';
    const fontEl = document.getElementById('propFontSize');
    if (fontEl) fontEl.value = layer.fontsize || 48;
  } else {
    if (textRow) textRow.style.display = 'none';
    if (styleRow) styleRow.style.display = 'none';
  }
}

function updateLayerProp(prop, value) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === state.activeLayer);
  if (!l) return;
  const val = parseFloat(value);
  switch (prop) {
    case 'x': l.x = val; break;
    case 'y': l.y = val; break;
    case 'w': l.w = val; break;
    case 'h': l.h = val; break;
    case 'rot': l.rot = val; document.getElementById('propRotLabel').textContent = val + '°'; break;
    case 'opac': l.opac = val; document.getElementById('propOpacLabel').textContent = val + '%'; break;
    case 'radius': l.radius = val; document.getElementById('propRadiusLabel').textContent = val; break;
    case 'text': l.text = value; l._textContent = value; break;
    case 'color': l.color = value; if (l.type === 'Retângulo') l._fillColor = value; break;
    case 'fontsize': l.fontsize = val; break;
  }
  renderCanvas(state.sceneData[state.activeScene]);
}

function toggleAspectRatio() { /* no-op for prototype */ }
function flipLayer(dir) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === state.activeLayer);
  if (!l) return;
  if (dir === 'h') { l.w = -l.w; } else { l.h = -l.h; }
  renderCanvas(state.sceneData[state.activeScene]);
  toast('Layer invertido', 'info');
}
function resetLayer() {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === state.activeLayer);
  if (!l) return;
  l.x = 0; l.y = 0; l.w = 640; l.h = 360; l.rot = 0; l.opac = 100; l.radius = 0;
  updateInspectorProps(l);
  renderCanvas(state.sceneData[state.activeScene]);
  toast('Layer resetado', 'info');
}

// ============================================
// INSPECTOR TABS
// ============================================
function switchInspector(tab) {
  document.querySelectorAll('.inspector-tab').forEach(t => t.classList.toggle('active', t.dataset.ipanel === tab));
  document.querySelectorAll('.inspector-content').forEach(c => c.classList.toggle('active', c.id === 'ipanel-' + tab));
}

// ============================================
// EFFECTS
// ============================================
function showAddEffect() {
  const m = document.getElementById('addEffectMenu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}

function addEffect(name) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === state.activeLayer);
  if (!l) { toast('Selecione uma camada primeiro', 'warning'); return; }
  if (!l.effects) l.effects = [];
  l.effects.push({ id: ++state.effectIdCounter, name: name, bypass: false });
  renderEffects(l);
  document.getElementById('addEffectMenu').style.display = 'none';
  toast(`Efeito adicionado: ${name}`, 'success');
}

function renderEffects(layer) {
  const list = document.getElementById('effectList');
  if (!list) return;
  const effs = layer.effects || [];
  if (effs.length === 0) {
    list.innerHTML = '<div class="empty-effects">Nenhum efeito aplicado</div>';
    return;
  }
  list.innerHTML = effs.map((e, i) => `
    <div class="effect-item">
      <span class="eff-icon"><i class="fas fa-magic"></i></span>
      <span class="eff-name">${e.name}</span>
      <button class="eff-bypass ${e.bypass ? '' : 'on'}" onclick="toggleEffectBypass(${layer.id}, ${i})" title="Ativar/Desativar"><i class="fas fa-power-off"></i></button>
      <button class="eff-del" onclick="removeEffect(${layer.id}, ${i})"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
}

function toggleEffectBypass(layerId, idx) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === layerId);
  if (l && l.effects && l.effects[idx]) {
    l.effects[idx].bypass = !l.effects[idx].bypass;
    renderEffects(l);
  }
}

function removeEffect(layerId, idx) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === layerId);
  if (l && l.effects) {
    l.effects.splice(idx, 1);
    renderEffects(l);
  }
}

// ============================================
// PRESETS
// ============================================
function applyPreset(name) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === state.activeLayer);
  if (!l) { toast('Selecione uma camada', 'warning'); return; }
  if (name === 'none') {
    l.effects = [];
    toast('Presets removidos', 'info');
  } else {
    const presets = {
      hologram: ['Chroma Key', 'Glow', 'Gaussian Blur'],
      '90s': ['Tritone', 'Glow'],
      duotone: ['Gradient', 'Hue/Saturation'],
      neon: ['Glow', 'Fill'],
      sepia: ['Hue/Saturation', 'Brightness/Contrast'],
      cinema: ['Black & White', 'Sharpen', 'Corner Pin'],
      vaporwave: ['Gradient', 'Glow', 'Hue/Saturation']
    };
    const effs = presets[name] || [];
    l.effects = effs.map(n => ({ id: ++state.effectIdCounter, name: n, bypass: false }));
    renderEffects(l);
    toast(`Preset "${name}" aplicado`, 'success');
  }
}

// ============================================
// CANVAS SWITCH
// ============================================
// ============================================
// AUDIO MIXER
// ============================================
function initMixer() {
  const tracks = [
    { name: 'Master', master: true },
    { name: 'Mic', master: false },
    { name: 'Game', master: false },
    { name: 'Music', master: false },
    { name: 'Alertas', master: false }
  ];
  const cont = document.getElementById('mixerChannels');
  if (!cont) return;
  cont.innerHTML = tracks.map(t => createTrackHTML(t)).join('');
  // VU meters animation
  setInterval(() => {
    cont.querySelectorAll('.mixer-track').forEach(el => {
      const fill = el.querySelector('.vu-fill');
      if (fill) {
        const level = el.classList.contains('master') ? 30 + Math.random() * 50 : 10 + Math.random() * 60;
        fill.style.height = level + '%';
      }
    });
  }, 60);
}

function createTrackHTML(t) {
  const cls = t.master ? 'mixer-track master' : 'mixer-track';
  return `
    <div class="${cls}" data-track="${t.name.toLowerCase()}">
      <div class="track-name">${t.name}</div>
      <div class="vu-met"><div class="vu-fill"></div></div>
      <div class="track-fader">
        <input type="range" min="0" max="100" value="${t.master ? 80 : 70}" oninput="trackFader(this, '${t.name}')">
      </div>
      <div class="track-btns">
        <button class="track-btn" onclick="toggleTrackMute(this)" title="Mute"><i class="fas fa-microphone-slash"></i></button>
        <button class="track-btn ${t.master ? 'cue-on' : ''}" onclick="toggleTrackCue(this)" title="CUE"><i class="fas fa-headphones"></i></button>
        <button class="track-btn" onclick="trackMenu(this)" title="Menu"><i class="fas fa-ellipsis-v"></i></button>
      </div>
    </div>`;
}

function addAudioTrack() {
  const cont = document.getElementById('mixerChannels');
  const n = cont.children.length + 1;
  const div = document.createElement('div');
  div.className = 'mixer-track';
  div.innerHTML = `
    <div class="track-name">Track ${n}</div>
    <div class="vu-met"><div class="vu-fill"></div></div>
    <div class="track-fader"><input type="range" min="0" max="100" value="70"></div>
    <div class="track-btns">
      <button class="track-btn" onclick="toggleTrackMute(this)"><i class="fas fa-microphone-slash"></i></button>
      <button class="track-btn" onclick="toggleTrackCue(this)"><i class="fas fa-headphones"></i></button>
      <button class="track-btn" onclick="trackMenu(this)"><i class="fas fa-ellipsis-v"></i></button>
    </div>`;
  cont.appendChild(div);
  toast('Nova track de áudio', 'success');
}

function trackFader(el, name) {
  // no-op
}

function toggleTrackMute(btn) {
  btn.classList.toggle('muted');
}

function toggleTrackCue(btn) {
  btn.classList.toggle('cue-on');
}

function trackMenu(btn) {
  toast('Track menu (editar nome, VOD, delay...)', 'info');
}

function toggleVODMode() {
  state.vodMode = !state.vodMode;
  const el = document.getElementById('vodBadge');
  if (el) el.classList.toggle('on', state.vodMode);
  toast(state.vodMode ? 'VOD Track ativado' : 'VOD Track desativado', 'info');
}

// ============================================
// WIDGETS
// ============================================
function toggleWidgets() {
  const grid = document.getElementById('widgetsGrid');
  const ch = document.getElementById('widgetChevron');
  if (!grid) return;
  const vis = grid.style.display !== 'none';
  grid.style.display = vis ? 'none' : 'grid';
  if (ch) ch.className = vis ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
}

function addWidget(type) {
  const names = {
    chat: 'Chat ao Vivo',
    activity: 'Feed de Atividade',
    goals: 'Metas',
    countdown: 'Contagem Regressiva',
    progress: 'Barra de Progresso',
    social: 'Redes Sociais',
    counter: 'Contador',
    spotlight: 'Destaque',
    wheel: 'Roleta',
    timer: 'Cronômetro'
  };
  addLayer('Widget');
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers[layers.length - 1];
  if (l) {
    l.name = names[type] || type;
    l.icon = 'fa-puzzle-piece';
    renderLayers(state.activeScene);
  }
  toast(`Widget adicionado: ${names[type] || type}`, 'success');
}

// ============================================
// LIVE / RECORD / CLIP
// ============================================
function toggleLive() {
  state.isLive = !state.isLive;
  const btn = document.getElementById('btnGoLive');
  const txt = document.getElementById('liveBtnText');
  const badge = document.getElementById('liveBadge');
  if (state.isLive) {
    btn.classList.add('live');
    txt.textContent = 'LIVE';
    if (badge) badge.classList.add('on');
    toast('Transmissão iniciada!', 'success');
  } else {
    btn.classList.remove('live');
    txt.textContent = 'GO LIVE';
    if (badge) badge.classList.remove('on');
    toast('Transmissão encerrada', 'warning');
  }
}

function toggleRecord() {
  state.isRecording = !state.isRecording;
  const btn = document.getElementById('btnRecord');
  const txt = document.getElementById('recBtnText');
  const ind = document.getElementById('recIndicator');
  if (state.isRecording) {
    btn.classList.add('live');
    txt.textContent = 'REC';
    if (ind) ind.classList.add('on');
    toast('Gravação iniciada', 'warning');
  } else {
    btn.classList.remove('live');
    txt.textContent = 'GRAVAR';
    if (ind) ind.classList.remove('on');
    toast('Gravação finalizada', 'success');
  }
}

function makeClip() {
  state.isClipping = !state.isClipping;
  if (state.isClipping) {
    toast('Clip criado! (90s)', 'success');
    state.isClipping = false; // auto-reset for single clip
  }
}

// ============================================
// CLIP / REPLAY / TIMELINE
// ============================================
function toggleClipMode() {
  toast('Modo Clip: ativado. Clique no botão CLIP para capturar.', 'info');
}

function toggleReplayClip() {
  toast('Replay Clip: exibindo na cena...', 'info');
}

function initTimeline() {
  let playing = false;
  let pos = 0;
  setInterval(() => {
    const ph = document.getElementById('playhead');
    if (!ph) return;
    pos = (pos + 0.5) % 100;
    ph.style.left = pos + '%';
  }, 30);
}

// ============================================
// STREAM TARGETS & OUTPUT MODE
// ============================================
const streamTargets = {
  youtube: { enabled: true, status: 'no-key', icon: 'fab fa-youtube', label: 'YouTube', url: 'rtmp://a.rtmp.youtube.com/live2', key: '', res: '1920x1080' },
  instagram: { enabled: true, status: 'no-key', icon: 'fab fa-instagram', label: 'Instagram', url: 'rtmps://edgetee-upload-for2-2.xx.fbcdn.net:443/rtmp/', key: '', res: '1080x1920' },
  facebook: { enabled: true, status: 'no-key', icon: 'fab fa-facebook', label: 'Facebook', url: '', key: '', res: '1920x1080' },
  rtmp: { enabled: true, status: 'no-key', icon: 'fas fa-bolt', label: 'RTMP', url: '', key: '', res: '1920x1080' }
};
let outputMode = 'horizontal'; // 'horizontal' | 'vertical' | 'dual'

function configStreamTarget(platform) {
  if (state.isLive) { toast('Pare a transmissão antes de configurar', 'warning'); return; }
  const t = streamTargets[platform];
  if (!t) return;
  // Create config overlay
  const old = document.getElementById('stConfigOverlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'stConfigOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;padding:20px;width:380px;box-shadow:0 8px 40px rgba(0,0,0,.6)';

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 12px;font-size:.9rem;display:flex;align-items:center;gap:8px';
  title.innerHTML = `<i class="${t.icon}"></i> ${t.label}`;
  box.appendChild(title);

  // URL field
  const urlLabel = document.createElement('label');
  urlLabel.textContent = 'URL do servidor RTMP:';
  urlLabel.style.cssText = 'display:block;font-size:.7rem;color:var(--text2);margin-bottom:4px';
  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.value = t.url || '';
  urlInput.placeholder = platform === 'rtmp' ? 'rtmp://seu-servidor.com/live' : `rtmp://a.rtmp.${platform}.com/live2`;
  urlInput.style.cssText = 'width:100%;padding:8px;background:var(--bg-app);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:.75rem;margin-bottom:12px';
  box.appendChild(urlLabel);
  box.appendChild(urlInput);

  // Stream key field
  const keyLabel = document.createElement('label');
  keyLabel.textContent = 'Chave de transmissão (Stream Key):';
  keyLabel.style.cssText = 'display:block;font-size:.7rem;color:var(--text2);margin-bottom:4px';
  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.value = t.key || '';
  keyInput.placeholder = '****-****-****-****';
  keyInput.style.cssText = 'width:100%;padding:8px;font-family:var(--mono);background:var(--bg-app);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:.75rem;margin-bottom:16px';
  box.appendChild(keyLabel);
  box.appendChild(keyInput);

  // Resolution selector
  const resRow = document.createElement('div');
  resRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px';
  const resLabel = document.createElement('span');
  resLabel.textContent = 'Resolução:';
  resLabel.style.cssText = 'font-size:.7rem;color:var(--text2)';
  const resSel = document.createElement('select');
  const resOpts = ['1920x1080', '1080x1920', '1280x720', '720x1280', '3840x2160', '2160x3840'];
  resOpts.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    if (r === t.res) opt.selected = true;
    resSel.appendChild(opt);
  });
  resSel.style.cssText = 'flex:1;padding:5px;background:var(--bg-app);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:.7rem';
  resRow.appendChild(resLabel);
  resRow.appendChild(resSel);
  box.appendChild(resRow);

  // Toggle enable checkbox
  const toggleRow = document.createElement('div');
  toggleRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:16px';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = t.enabled;
  cb.style.cssText = 'accent-color:var(--cyan);width:16px;height:16px';
  const cbLabel = document.createElement('span');
  cbLabel.textContent = 'Ativar este destino';
  cbLabel.style.cssText = 'font-size:.75rem;color:var(--text)';
  toggleRow.appendChild(cb);
  toggleRow.appendChild(cbLabel);
  box.appendChild(toggleRow);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid var(--border);background:var(--bg-panel3);color:var(--text2);border-radius:4px;cursor:pointer;font-size:.7rem';
  cancelBtn.onclick = () => overlay.remove();
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Salvar';
  saveBtn.style.cssText = 'padding:6px 16px;border:none;background:var(--cyan);color:#000;border-radius:4px;cursor:pointer;font-size:.7rem;font-weight:700';
  saveBtn.onclick = () => {
    t.url = urlInput.value.trim();
    t.key = keyInput.value.trim();
    t.res = resSel.value;
    t.enabled = cb.checked;
    t.status = t.enabled ? (t.url && t.key ? 'on' : 'no-key') : 'off';
    updateStreamTargetUI(platform);
    overlay.remove();
    if (t.enabled && (!t.url || !t.key)) {
      toast(`${t.label}: configure URL e chave`, 'warning');
    } else if (t.enabled) {
      toast(`${t.label} configurado e ativado`, 'success');
    } else {
      toast(`${t.label} desativado`, 'info');
    }
  };
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  box.appendChild(btnRow);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  setTimeout(() => urlInput.focus(), 100);
}

function updateStreamTargetUI(platform) {
  const el = document.getElementById(`st-${platform}`);
  if (!el) return;
  const t = streamTargets[platform];
  const status = t.status || 'off';
  if (status === 'con') {
    el.textContent = '...';
    el.className = 'st-status con';
  } else if (status === 'err') {
    el.textContent = 'ERR';
    el.className = 'st-status error';
  } else if (status === 'on') {
    el.textContent = 'on';
    el.className = 'st-status on';
  } else if (t.enabled && (!t.url || !t.key)) {
    el.textContent = 'cfg';
    el.className = 'st-status error';
  } else {
    el.textContent = 'off';
    el.className = 'st-status off';
  }
}

function setOutputMode(mode) {
  if (state.isLive) { toast('Pare a transmissão antes de alterar formato', 'warning'); return; }
  outputMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  const map = { horizontal: 'modeH', vertical: 'modeV', dual: 'modeDual' };
  const btn = document.getElementById(map[mode]);
  if (btn) btn.classList.add('active');
  const info = document.getElementById('modeInfo');
  if (info) {
    if (mode === 'horizontal') info.textContent = 'H: 1920×1080';
    else if (mode === 'vertical') info.textContent = 'V: 1080×1920';
    else info.textContent = 'H: 1920×1080 + V: 1080×1920';
  }
  toast(`Formato: ${mode === 'horizontal' ? '16:9 Horizontal' : mode === 'vertical' ? '9:16 Vertical (Shorts)' : 'Dual (16:9 + 9:16)'}`, 'info');
}

// Override toggleLive to connect/disconnect stream targets
const _origToggleLive = toggleLive;
toggleLive = function() {
  if (!state.isLive) {
    const enabled = Object.keys(streamTargets).filter(k => streamTargets[k].enabled && streamTargets[k].url && streamTargets[k].key);
    if (enabled.length === 0) {
      toast('Configure e ative ao menos um destino (YouTube, Instagram, Facebook ou RTMP)', 'warning');
      return;
    }
    // Show "connecting..." for all targets
    enabled.forEach(k => {
      streamTargets[k].status = 'con';
      updateStreamTargetUI(k);
    });
    toast('Conectando...', 'info');
    // Simulate connection delay per target
    let delay = 0;
    enabled.forEach(k => {
      delay += 600 + Math.random() * 800;
      setTimeout(() => {
        // Simulate ~85% success rate
        if (Math.random() < 0.85) {
          streamTargets[k].status = 'on';
          updateStreamTargetUI(k);
          toast(`${streamTargets[k].label}: conectado`, 'success');
        } else {
          streamTargets[k].status = 'err';
          updateStreamTargetUI(k);
          toast(`${streamTargets[k].label}: falha ao conectar`, 'error');
        }
      }, delay);
    });
    // Call original after all connect attempts
    setTimeout(() => {
      _origToggleLive();
      const connected = Object.keys(streamTargets).filter(k => streamTargets[k].status === 'on');
      if (connected.length > 0) {
        toast('Streaming ativo: ' + connected.map(k => streamTargets[k].label).join(', '), 'success');
      } else {
        toast('Nenhum destino conectado', 'error');
        _origToggleLive(); // revert live state
        state.isLive = false;
        const btn = document.getElementById('btnGoLive');
        const txt = document.getElementById('liveBtnText');
        if (btn) btn.classList.remove('live');
        if (txt) txt.textContent = 'GO LIVE';
      }
    }, delay + 200);
  } else {
    Object.keys(streamTargets).forEach(k => {
      if (streamTargets[k].status === 'on' || streamTargets[k].status === 'con' || streamTargets[k].status === 'err') {
        streamTargets[k].status = 'off';
        updateStreamTargetUI(k);
      }
    });
    _origToggleLive();
    toast('Transmissão encerrada', 'warning');
  }
};

// ============================================
// MULTI CANVAS
// ============================================
function toggleMultiCanvas(enabled) {
  state.multiCanvas = enabled;
  const btn = document.getElementById('floatToggle');
  if (btn) btn.style.display = enabled ? 'flex' : 'none';
  if (!enabled) {
    const fc = document.getElementById('floatCanvas');
    if (fc) fc.classList.remove('show');
  }
  toast(enabled ? 'Multi Canvas ativado' : 'Multi Canvas desativado', 'info');
}

// ============================================
// SETTINGS
// ============================================
function showSettings() {
  document.getElementById('settingsModal').classList.add('active');
}

function switchSettings(tab) {
  document.querySelectorAll('.settings-tabs .st').forEach(t => t.classList.toggle('active', t.dataset.stab === tab));
  document.querySelectorAll('.settings-content').forEach(c => c.classList.toggle('active', c.id === 'stab-' + tab));
}

function updateSetting(key, value) {
  state.settings[key] = value;
  if (key === 'fps') {
    document.getElementById('statFPS').textContent = value;
  }
  toast(`Config atualizada: ${key} = ${value}`, 'info');
}

// ============================================
// SESSION
// ============================================
function showSession() {
  document.getElementById('sessionModal').classList.add('active');
}

function exportSession() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meustudio-session.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Sessão exportada!', 'success');
}

function importSession(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      Object.assign(state, data);
      renderScenes();
      renderLayers(state.activeScene);
      initMixer();
      toast('Sessão importada!', 'success');
    } catch (err) {
      toast('Erro ao importar sessão', 'error');
    }
  };
  reader.readAsText(file);
}

function saveBackup() {
  toast('Backup salvo! (localStorage)', 'success');
  localStorage.setItem('meustudio_backup', JSON.stringify(state));
}

function restoreBackup() {
  const data = localStorage.getItem('meustudio_backup');
  if (!data) { toast('Nenhum backup encontrado', 'warning'); return; }
  try {
    Object.assign(state, JSON.parse(data));
    renderScenes();
    renderLayers(state.activeScene);
    initMixer();
    toast('Backup restaurado!', 'success');
  } catch (err) {
    toast('Erro ao restaurar backup', 'error');
  }
}

function importOBS() {
  toast('Importando do OBS Studio... (simulado)', 'info');
  setTimeout(() => toast('OBS importado com sucesso!', 'success'), 1200);
}

// ============================================
// STATS SIMULATION
// ============================================
function startStatsSim() {
  setInterval(() => {
    const cpu = document.getElementById('statCPU');
    const gpu = document.getElementById('statGPU');
    const bit = document.getElementById('statBitrate');
    if (cpu) cpu.textContent = (15 + Math.random() * 15).toFixed(1) + '%';
    if (gpu) gpu.textContent = (25 + Math.random() * 20).toFixed(1) + '%';
    if (bit) {
      const bps = state.isLive ? 5000 + Math.random() * 3000 : 0;
      bit.textContent = Math.round(bps) + ' kbps';
    }
  }, 1000);
}

function startFPS() {
  let frames = 0;
  setInterval(() => {
    frames++;
    const el = document.getElementById('fpsCounter');
    if (el) {
      const fps = 55 + Math.floor(Math.random() * 10);
      el.textContent = fps + ' fps';
    }
    frames = 0;
  }, 1000);
}

// ============================================
// MENU HANDLERS
// ============================================
function setupMenuHandlers() {
  document.querySelectorAll('.menu-btn[data-menu]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.menu;
      document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switch (m) {
        case 'file': showSession(); break;
        case 'settings': showSettings(); break;
        case 'scene': toast('Gerenciamento de cenas', 'info'); break;
        case 'edit': toast('Modo edição', 'info'); break;
        case 'view': toast('Opções de visualização', 'info'); break;
        case 'dock': toast('Painéis configurados', 'info'); break;
      }
    });
  });
}

// ============================================
// CLOSE MODALS
// ============================================
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) e.target.classList.remove('active');
});

// ============================================
// TOAST
// ============================================
function toast(msg, type) {
  type = type || 'info';
  const cont = document.getElementById('toastContainer');
  if (!cont) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icons = { info: 'fa-info-circle', success: 'fa-check-circle', warning: 'fa-exclamation-triangle', error: 'fa-times-circle' };
  t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${msg}`;
  cont.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toast-out .25s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 2500);
}

// ============================================
// DRAG & DROP ON CANVAS
// ============================================
let dragState = null;

function makeLayerDraggable(el) {
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const id = parseInt(el.dataset.layer);
    const layers = state.sceneData[state.activeScene] || [];
    const l = layers.find(x => x.id === id);
    if (!l || l.locked) return;

    selectLayer(id);
    const rect = el.getBoundingClientRect();
    const parentRect = el.parentElement.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;

    dragState = {
      layerId: id,
      el: el,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left - parentRect.left,
      origTop: rect.top - parentRect.top,
      offX: offX,
      offY: offY,
      parentRect: parentRect
    };

    el.classList.add('dragging');
    e.preventDefault();
  });
}

document.addEventListener('mousemove', (e) => {
  if (!dragState) return;
  const ds = dragState;
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === ds.layerId);
  if (!l) { stopDrag(); return; }

  // Calculate new position relative to parent
  const dx = e.clientX - ds.startX;
  const dy = e.clientY - ds.startY;
  const newLeft = ds.origLeft + dx;
  const newTop = ds.origTop + dy;

  // Update layer data (convert to canvas-local coords)
  const grid = ds.el.parentElement;
  const gridRect = grid.getBoundingClientRect();
  const scaleX = grid.offsetWidth / gridRect.width;
  const scaleY = grid.offsetHeight / gridRect.height;

  l.x = Math.round(newLeft / scaleX);
  l.y = Math.round(newTop / scaleY);

  // Update position live
  ds.el.style.left = l.x + 'px';
  ds.el.style.top = l.y + 'px';

  // Update inspector values
  const propX = document.getElementById('propX');
  const propY = document.getElementById('propY');
  if (propX) propX.value = l.x;
  if (propY) propY.value = l.y;

  // Sync other canvas instances
  syncCanvasLayer(l.id);
});

document.addEventListener('mouseup', () => {
  if (!dragState) return;
  dragState.el.classList.remove('dragging');
  dragState = null;
});

function stopDrag() {
  if (dragState) {
    dragState.el.classList.remove('dragging');
    dragState = null;
  }
}

function syncCanvasLayer(layerId) {
  const mainGrid = document.getElementById('canvasGrid');
  if (!mainGrid) return;
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === layerId);
  if (!l) return;
  const el = mainGrid.querySelector(`canvas-layer[data-layer="${layerId}"]`);
  if (el) {
    el.style.left = l.x + 'px';
    el.style.top = l.y + 'px';
    el.style.width = l.w + 'px';
    el.style.height = l.h + 'px';
    el.style.transform = `rotate(${l.rot}deg)`;
    el.style.opacity = l.opac / 100;
    el.style.borderRadius = l.radius + 'px';
  }
  syncFloatCanvas();
}

function applyDragToLayerElements() {
  document.querySelectorAll('#canvasGrid canvas-layer').forEach(el => makeLayerDraggable(el));
}

// ============================================
// CAMERA / DISPLAY CAPTURE
// ============================================
async function connectCameraForLayer(layerId) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === layerId);
  if (!l) return;
  try {
    console.log('Requesting camera for layer', layerId);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    console.log('Camera stream obtained, tracks:', stream.getTracks().map(t => t.kind + ':' + t.readyState).join(', '));
    // Stop any previous stream
    if (l._stream) l._stream.getTracks().forEach(t => t.stop());
    l._stream = stream;
    // Update all canvases
    renderLayers(state.activeScene);
    toast(`Câmera conectada: ${l.name}`, 'success');
  } catch (err) {
    console.error('Camera error:', err);
    toast(`Erro ao acessar câmera: ${err.message}`, 'error');
  }
}

async function connectDisplayForLayer(layerId) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === layerId);
  if (!l) return;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    if (l._stream) l._stream.getTracks().forEach(t => t.stop());
    l._stream = stream;
    renderLayers(state.activeScene);
    toast(`Captura de tela iniciada: ${l.name}`, 'success');
    // Auto-disconnect when user stops sharing
    stream.getVideoTracks()[0].onended = () => {
      disconnectCamera(layerId);
      toast('Compartilhamento de tela encerrado', 'info');
    };
  } catch (err) {
    if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
      toast(`Erro ao capturar tela: ${err.message}`, 'error');
    }
  }
}

function disconnectCamera(layerId) {
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === layerId);
  if (!l) return;
  if (l._stream) {
    l._stream.getTracks().forEach(t => t.stop());
    l._stream = null;
  }
  renderLayers(state.activeScene);
  toast('Câmera/Captura desconectada', 'info');
}

// ============================================
// FLOATING MONITOR WINDOW
// ============================================
let monitorLocked = false;

function toggleMonitorLock() {
  monitorLocked = !monitorLocked;
  const btn = document.getElementById('monitorLockBtn');
  if (btn) {
    btn.innerHTML = monitorLocked ? '<i class="fas fa-lock"></i>' : '<i class="fas fa-lock-open"></i>';
    btn.style.color = monitorLocked ? 'var(--red)' : 'var(--cyan)';
  }
  const fc = document.getElementById('floatCanvas');
  if (fc) fc.classList.toggle('locked', monitorLocked);
  toast(monitorLocked ? 'Monitor travado' : 'Monitor destravado', 'info');
}

function toggleFloatCanvas() {
  const fc = document.getElementById('floatCanvas');
  if (!fc) return;
  const show = !fc.classList.contains('show');
  fc.classList.toggle('show', show);
  const btn = document.getElementById('floatToggle');
  if (btn) {
    btn.classList.toggle('active', show);
    btn.innerHTML = show ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-external-link-alt"></i>';
  }
  if (show) syncFloatCanvas();
  toast(show ? 'Monitor aberto' : 'Monitor fechado', 'info');
}

function syncFloatCanvas() {
  const mirror = document.getElementById('floatMirror');
  if (!mirror) return;
  const layers = state.sceneData[state.activeScene] || [];
  const visible = layers.filter(l => l.visible);

  // Remove stale elements from mirror
  mirror.querySelectorAll('canvas-layer').forEach(el => {
    if (!visible.find(l => l.id === parseInt(el.dataset.layer))) el.remove();
  });

  // Calculate bounding box of all visible layers
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  visible.forEach(l => {
    if (l.x < minX) minX = l.x;
    if (l.y < minY) minY = l.y;
    if (l.x + l.w > maxX) maxX = l.x + l.w;
    if (l.y + l.h > maxY) maxY = l.y + l.h;
  });
  const groupW = maxX - minX;
  const groupH = maxY - minY;
  const offsetX = (1080 - groupW) / 2 - minX;
  const offsetY = (1920 - groupH) / 2 - minY;

  visible.forEach(l => {
    if (l._monitorScale === undefined) l._monitorScale = 1;
    let el = mirror.querySelector(`canvas-layer[data-layer="${l.id}"]`);
    if (!el) {
      el = document.createElement('canvas-layer');
      el.dataset.layer = l.id;
      el.style.position = 'absolute';
      mirror.appendChild(el);
      const content = document.createElement('div');
      content.className = 'layer-content';
      el.appendChild(content);
      el.onclick = () => { if (!monitorLocked) selectLayer(l.id); };
    }
    const ms = l._monitorScale || 1;
    el.style.left = (l.x + offsetX) + 'px';
    el.style.top = (l.y + offsetY) + 'px';
    el.style.width = l.w + 'px';
    el.style.height = l.h + 'px';
    el.style.transform = `rotate(${l.rot}deg) scale(${ms}) scale(${l.flipH ? -1 : 1}, ${l.flipV ? -1 : 1})`;
    el.style.opacity = l.opac / 100;
    el.style.borderRadius = l.radius + 'px';

    let badge = el.querySelector('.layer-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'layer-badge';
      el.appendChild(badge);
    }
    const num = (l.name || '').match(/^(\d+)/);
    badge.textContent = num ? num[1] : '';
    badge.style.display = num ? 'flex' : 'none';

    const content = el.querySelector('.layer-content');
    content.innerHTML = '';
    renderLayerContent(l, content);
  });

  // Scale mirror to fit float body
  fitMirrorToContainer();
}

function fitMirrorToContainer() {
  const mirror = document.getElementById('floatMirror');
  const body = document.getElementById('floatBody');
  if (!mirror || !body) return;
  const bw = body.clientWidth;
  const bh = body.clientHeight;
  if (bw === 0 || bh === 0) return;
  const scaleX = bw / 1080;
  const scaleY = bh / 1920;
  const scale = Math.min(scaleX, scaleY) * 1.8;
  mirror.style.transform = `scale(${scale})`;
  const mw = 1080 * scale;
  const mh = 1920 * scale;
  mirror.style.left = ((bw - mw) / 2) + 'px';
  mirror.style.top = ((bh - mh) / 2) + 'px';
}

// Drag mirror within float body
let mirrorDragState = null;

function initMirrorDrag() {
  const mirror = document.getElementById('floatMirror');
  if (!mirror) return;
  mirror.addEventListener('mousedown', (e) => {
    if (monitorLocked) return;
    if (e.target.closest('.layer-content')) return;
    mirrorDragState = {
      el: mirror,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: parseFloat(mirror.style.left) || 0,
      origTop: parseFloat(mirror.style.top) || 0,
      activated: false
    };
    e.preventDefault();
  });
}

document.addEventListener('mousemove', (e) => {
  if (!mirrorDragState) return;
  const dx = e.clientX - mirrorDragState.startX;
  const dy = e.clientY - mirrorDragState.startY;
  if (!mirrorDragState.activated) {
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    mirrorDragState.activated = true;
    mirrorDragState.el.style.cursor = 'grabbing';
  }
  const body = document.getElementById('floatBody');
  if (!body) return;
  const bw = body.clientWidth;
  const bh = body.clientHeight;
  const ms = mirrorDragState.el;
  const s = parseFloat(ms.style.transform.replace('scale(','').replace(')','')) || 1;
  const mw = 1080 * s;
  const mh = 1920 * s;
  let nx = mirrorDragState.origLeft + dx;
  let ny = mirrorDragState.origTop + dy;
  nx = Math.min(0, Math.max(bw - mw, nx));
  ny = Math.min(0, Math.max(bh - mh, ny));
  ms.style.left = nx + 'px';
  ms.style.top = ny + 'px';
});

document.addEventListener('mouseup', () => {
  if (mirrorDragState) {
    mirrorDragState.el.style.cursor = 'grab';
    mirrorDragState = null;
  }
});

// Mouse wheel to scale layers in the mirror
document.addEventListener('wheel', (e) => {
  if (monitorLocked) return;
  const cl = e.target.closest('#floatMirror canvas-layer');
  if (!cl) return;
  const id = parseInt(cl.dataset.layer);
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === id);
  if (!l) return;
  if (l._monitorScale === undefined) l._monitorScale = 1;
  const step = e.deltaY > 0 ? -0.1 : 0.1;
  l._monitorScale = Math.max(0.2, Math.min(5, l._monitorScale + step));
  const ms = l._monitorScale;
  cl.style.transform = `rotate(${l.rot}deg) scale(${ms}) scale(${l.flipH ? -1 : 1}, ${l.flipV ? -1 : 1})`;
  e.preventDefault();
}, { passive: false });

// Keyboard shortcuts for monitor zoom: [ ] keys
document.addEventListener('keydown', (e) => {
  if (e.key === '[' || e.key === ']') {
    const fc = document.getElementById('floatCanvas');
    if (!fc || !fc.classList.contains('show') || monitorLocked) return;
    monitorZoom(e.key === ']' ? 0.2 : -0.2);
    e.preventDefault();
  }
});

function monitorZoom(delta) {
  if (monitorLocked) return;
  let id = state.activeLayer;
  if (!id) {
    const layers2 = state.sceneData[state.activeScene] || [];
    if (layers2.length) {
      id = layers2[0].id;
      selectLayer(id);
    }
  }
  if (!id) return;
  const layers = state.sceneData[state.activeScene] || [];
  const l = layers.find(x => x.id === id);
  if (!l) return;
  if (l._monitorScale === undefined) l._monitorScale = 1;
  l._monitorScale = Math.max(0.2, Math.min(5, l._monitorScale + delta));
  const el = document.querySelector(`#floatMirror canvas-layer[data-layer="${id}"]`);
  if (el) {
    el.style.transform = `rotate(${l.rot}deg) scale(${l._monitorScale}) scale(${l.flipH ? -1 : 1}, ${l.flipV ? -1 : 1})`;
  }
  // Also update syncFloatCanvas to recalculate bounding box on next render
  syncFloatCanvas();
  toast(`Zoom: ${Math.round(l._monitorScale * 100)}%`, 'info');
}

// Resize observer to re-fit mirror when float window resizes
const _mirrorResizeObs = new ResizeObserver(() => fitMirrorToContainer());
document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('floatBody');
  if (body) _mirrorResizeObs.observe(body);
  initMirrorDrag();
});

function renderLayerContent(l, content) {
  const isFloat = content.closest('#floatMirror');
  const sz = isFloat ? '.55rem' : '.7rem';
  const iconSz = isFloat ? '.8rem' : '1.2rem';
  const txtSz = isFloat ? '.75rem' : '1rem';
  const btnStyle = 'background:rgba(41,121,255,.15);border:1.5px solid var(--blue);color:#fff;padding:6px 14px;border-radius:5px;cursor:pointer;font-weight:600;transition:all .2s;display:inline-flex;align-items:center;gap:6px';

  function makeBtn(html, cb) {
    const b = document.createElement('button');
    b.innerHTML = html;
    b.style.cssText = btnStyle + ';font-size:' + sz;
    b.onmouseenter = () => { b.style.background = 'rgba(41,121,255,.35)'; };
    b.onmouseleave = () => { b.style.background = 'rgba(41,121,255,.15)'; };
    b.onclick = (e) => { e.stopPropagation(); cb(); };
    return b;
  }

  function makeDisconnectBtn(cb) {
    const b = document.createElement('button');
    b.innerHTML = '<i class="fas fa-times"></i>';
    b.title = 'Remover';
    b.style.cssText = 'position:absolute;top:3px;right:3px;width:20px;height:20px;border:none;border-radius:3px;background:rgba(255,0,0,.7);color:#fff;cursor:pointer;font-size:.5rem;z-index:6;display:flex;align-items:center;justify-content:center';
    b.onclick = (e) => { e.stopPropagation(); cb(); };
    return b;
  }

  function wrap(children) {
    const d = document.createElement('div');
    d.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden';
    children.forEach(c => d.appendChild(c));
    content.innerHTML = '';
    content.appendChild(d);
    return d;
  }

  // ---- VIDEO DEVICE ----
  if (l.type === 'Câmera') {
    const c = document.createElement('div');
    c.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;background:#0a0a1a';
    if (l._stream) {
      const hasChroma = l.effects && l.effects.some(function(e) { return e.name === 'Chroma Key' && !e.bypass; });
      const vid = document.createElement('video');
      vid.srcObject = l._stream;
      vid.autoplay = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.onclick = (e) => { e.stopPropagation(); selectLayer(l.id); };

      if (hasChroma) {
        vid.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0';
        var cv = document.createElement('canvas');
        cv.style.cssText = 'width:100%;height:100%;display:block';
        cv.className = 'layer-chroma-canvas';
        var ctx = cv.getContext('2d');
        var cw = 0, ch = 0;
        function frame() {
          if (!vid.videoWidth || !vid.videoHeight) { requestAnimationFrame(frame); return; }
          if (cw !== vid.videoWidth || ch !== vid.videoHeight) {
            cw = vid.videoWidth; ch = vid.videoHeight;
            cv.width = cw; cv.height = ch;
          }
          ctx.drawImage(vid, 0, 0, cw, ch);
          var imageData = ctx.getImageData(0, 0, cw, ch);
          var d = imageData.data;
          for (var i = 0; i < d.length; i += 4) {
            if (d[i+1] > d[i] + 25 && d[i+1] > d[i+2] + 25) d[i+3] = 0;
          }
          ctx.putImageData(imageData, 0, 0);
          requestAnimationFrame(frame);
        }
        c.appendChild(vid);
        c.appendChild(cv);
        c.appendChild(makeDisconnectBtn(function() { disconnectCamera(l.id); }));
        requestAnimationFrame(function() {
          vid.play().catch(function(e) { console.warn('Play failed:', e); });
          frame();
        });
      } else {
        vid.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
        vid.onerror = () => console.error('Video error on layer', l.id);
        vid.onloadedmetadata = () => console.log('Video loaded:', l.id, vid.videoWidth, 'x', vid.videoHeight);
        vid.onplay = () => console.log('Video playing:', l.id);
        c.appendChild(vid);
        c.appendChild(makeDisconnectBtn(() => disconnectCamera(l.id)));
        requestAnimationFrame(() => { vid.play().catch(e => console.warn('Play failed:', e)); });
      }
    } else {
      c.appendChild(makeBtn('<i class="fas fa-camera" style="font-size:1.1rem"></i> Conectar Câmera', () => connectCameraForLayer(l.id)));
    }
    wrap([c]);

  // ---- DISPLAY / GAME CAPTURE ----
  } else if (l.type === 'Tela' || l.type === 'Jogo') {
    const c = document.createElement('div');
    c.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;background:#1a1a2e';
    if (l._stream) {
      const vid = document.createElement('video');
      vid.srcObject = l._stream;
      vid.autoplay = true;
      vid.muted = true;
      vid.playsInline = true;
      vid.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      vid.onclick = (e) => { e.stopPropagation(); selectLayer(l.id); };
      c.appendChild(vid);
      c.appendChild(makeDisconnectBtn(() => disconnectCamera(l.id)));
      requestAnimationFrame(() => { vid.play().catch(e => console.warn('Play failed:', e)); });
    } else {
      const label2 = l.type === 'Jogo' ? 'Jogo' : 'Tela';
      c.appendChild(makeBtn(`<i class="fas fa-desktop" style="font-size:1.1rem"></i> Capturar ${label2}`, () => connectDisplayForLayer(l.id)));
    }
    wrap([c]);

  // ---- MEDIA SOURCE ----
  } else if (l.type === 'Mídia') {
    const c = document.createElement('div');
    c.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;background:#0d0d1a';
    if (l._mediaUrl) {
      let vid = c.querySelector('video');
      if (!vid) { vid = document.createElement('video'); c.appendChild(vid); }
      vid.src = l._mediaUrl; vid.controls = true; vid.autoplay = false;
      vid.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      vid.onclick = (e) => { e.stopPropagation(); selectLayer(l.id); };
      const controlsRow = document.createElement('div');
      controlsRow.style.cssText = 'position:absolute;bottom:4px;left:4px;right:4px;display:flex;gap:4px;z-index:5';
      const playBtn = document.createElement('button');
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      playBtn.style.cssText = 'background:rgba(0,0,0,.6);border:1px solid var(--border);color:#fff;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:.55rem';
      playBtn.onclick = (e) => { e.stopPropagation(); if (vid.paused) { vid.play(); playBtn.innerHTML = '<i class="fas fa-pause"></i>'; } else { vid.pause(); playBtn.innerHTML = '<i class="fas fa-play"></i>'; } };
      controlsRow.appendChild(playBtn);
      controlsRow.appendChild(makeBtn('<i class="fas fa-exchange-alt"></i>', () => pickMediaForLayer(l.id)));
      controlsRow.appendChild(makeDisconnectBtn(() => { l._mediaUrl = null; renderLayers(state.activeScene); }));
      c.appendChild(controlsRow);
    } else {
      c.appendChild(makeBtn('<i class="fas fa-file-video" style="font-size:1.1rem"></i> Selecionar Mídia', () => pickMediaForLayer(l.id)));
    }
    wrap([c]);

  // ---- IMAGE ----
  } else if (l.type === 'Imagem') {
    const c = document.createElement('div');
    c.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;background:linear-gradient(135deg,#2a1a3a,#1a0a2a);display:flex;align-items:center;justify-content:center';
    if (l._imageUrl) {
      let img = c.querySelector('img');
      if (!img) { img = document.createElement('img'); c.appendChild(img); }
      img.src = l._imageUrl;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
      img.onclick = (e) => { e.stopPropagation(); selectLayer(l.id); };
      c.appendChild(makeDisconnectBtn(() => { l._imageUrl = null; renderLayers(state.activeScene); }));
    } else {
      c.appendChild(makeBtn('<i class="fas fa-image" style="font-size:1.1rem"></i> Upload Imagem', () => pickImageForLayer(l.id)));
    }
    wrap([c]);

  // ---- BROWSER ----
  } else if (l.type === 'Navegador') {
    const c = document.createElement('div');
    c.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden;background:#1a1a2a;display:flex;flex-direction:column';
    if (l._browserUrl) {
      c.innerHTML = '';
      const toolbar = document.createElement('div');
      toolbar.style.cssText = 'display:flex;gap:4px;padding:4px;background:rgba(0,0,0,.5);z-index:5;flex-shrink:0';
      const urlInput = document.createElement('input');
      urlInput.type = 'text'; urlInput.value = l._browserUrl;
      urlInput.style.cssText = 'flex:1;padding:3px 6px;background:var(--bg-app);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:.6rem';
      urlInput.onchange = () => { l._browserUrl = urlInput.value; renderLayers(state.activeScene); };
      const goBtn = document.createElement('button');
      goBtn.innerHTML = '<i class="fas fa-arrow-right"></i>';
      goBtn.style.cssText = 'background:var(--blue);border:none;color:#fff;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:.55rem';
      goBtn.onclick = () => { l._browserUrl = urlInput.value; renderLayers(state.activeScene); };
      toolbar.appendChild(urlInput);
      toolbar.appendChild(goBtn);
      c.appendChild(toolbar);
      const iframe = document.createElement('iframe');
      iframe.src = l._browserUrl;
      iframe.style.cssText = 'flex:1;border:none;background:#fff';
      iframe.sandbox = 'allow-scripts allow-same-origin allow-popups';
      iframe.onclick = (e) => { e.stopPropagation(); selectLayer(l.id); };
      c.appendChild(iframe);
    } else {
      c.appendChild(makeBtn('<i class="fas fa-globe" style="font-size:1.1rem"></i> Inserir URL', () => promptBrowserUrl(l)));
    }
    wrap([c]);

  // ---- TEXT ----
  } else if (l.type === 'Texto') {
    const c = document.createElement('div');
    c.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text2);flex-direction:column;gap:6px';
    if (l._editing) {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = l._textContent || l.name;
      inp.style.cssText = 'width:90%;padding:6px 8px;background:var(--bg-app);border:1px solid var(--blue);color:var(--text);border-radius:4px;font-size:.75rem;text-align:center';
      inp.onchange = () => { l._textContent = inp.value; l.name = inp.value; l._editing = false; renderLayers(state.activeScene); };
      inp.onblur = () => { l._textContent = inp.value; l.name = inp.value; l._editing = false; renderLayers(state.activeScene); };
      inp.onclick = (e) => e.stopPropagation();
      setTimeout(() => inp.focus(), 50);
      c.appendChild(inp);
    } else {
      const displayText = l._textContent || l.text || l.name;
      const textDiv = document.createElement('div');
      textDiv.textContent = displayText;
      textDiv.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${l._textColor || '#fff'};font-size:${txtSz};font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,.8);padding:4px;word-break:break-word;cursor:text`;
      textDiv.onclick = (e) => { e.stopPropagation(); selectLayer(l.id); };
      textDiv.ondblclick = (e) => { e.stopPropagation(); l._editing = true; renderLayers(state.activeScene); };
      c.appendChild(textDiv);
    }
    wrap([c]);

  // ---- MARKDOWN ----
  } else if (l.type === 'Markdown') {
    const c = document.createElement('div');
    c.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text2);flex-direction:column;gap:6px;padding:4px';
    if (l._editing) {
      const ta = document.createElement('textarea');
      ta.value = l._mdContent || '# Markdown';
      ta.style.cssText = 'width:100%;height:100%;padding:6px;background:var(--bg-app);border:1px solid var(--blue);color:var(--text);border-radius:4px;font-size:.65rem;resize:none';
      ta.onchange = () => { l._mdContent = ta.value; l._editing = false; renderLayers(state.activeScene); };
      ta.onblur = () => { l._mdContent = ta.value; l._editing = false; renderLayers(state.activeScene); };
      ta.onclick = (e) => e.stopPropagation();
      setTimeout(() => ta.focus(), 50);
      c.appendChild(ta);
    } else {
      const md = l._mdContent || '# Markdown';
      const html = md.replace(/^### (.+)/gm, '<b style="font-size:1rem">$1</b>')
                     .replace(/^## (.+)/gm, '<b style="font-size:1.2rem">$1</b>')
                     .replace(/^# (.+)/gm, '<b style="font-size:1.4rem">$1</b>')
                     .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
                     .replace(/\*(.+?)\*/g, '<i>$1</i>')
                     .replace(/\n/g, '<br>');
      const div = document.createElement('div');
      div.innerHTML = html;
      div.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${l._textColor || '#fff'};font-size:${sz};padding:4px;word-break:break-word;text-align:center`;
      div.ondblclick = (e) => { e.stopPropagation(); l._editing = true; renderLayers(state.activeScene); };
      c.appendChild(div);
    }
    wrap([c]);

  // ---- RECTANGLE ----
  } else if (l.type === 'Retângulo') {
    const c = document.createElement('div');
    const fill = l._fillColor || randomColor();
    const borderCol = l._borderColor || 'transparent';
    const borderW = l._borderW || 0;
    c.style.cssText = `width:100%;height:100%;background:${fill};border:${borderW}px solid ${borderCol};border-radius:inherit;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px`;
    if (!l._fillColor) { l._fillColor = fill; }
    c.onclick = (e) => { e.stopPropagation(); selectLayer(l.id); };
    c.ondblclick = (e) => { e.stopPropagation(); showRectPicker(l); };
    if (l._fillColor) {
      const hint = document.createElement('span');
      hint.textContent = 'duplo clique p/ cor';
      hint.style.cssText = 'font-size:.5rem;color:rgba(255,255,255,.3)';
      c.appendChild(hint);
    }
    wrap([c]);

  // ---- WIDGET ----
  } else if (l.type === 'Widget') {
    const c = document.createElement('div');
    c.style.cssText = 'width:100%;height:100%;background:#1a2a1a;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;color:var(--text3);font-size:' + sz;
    if (l._widgetData) {
      // Render active widget
      c.innerHTML = '';
      const wName = document.createElement('div');
      wName.textContent = l._widgetData.name;
      wName.style.cssText = 'font-size:' + txtSz + ';font-weight:700;color:#fff;text-align:center;padding:4px';
      c.appendChild(wName);
      if (l._widgetData.type === 'chat') {
        const msgs = document.createElement('div');
        msgs.style.cssText = 'flex:1;width:100%;overflow-y:auto;padding:4px;font-size:.6rem;color:var(--text2)';
        msgs.innerHTML = '<div style="padding:4px;border-bottom:1px solid #333"><b style="color:var(--cyan)">User1:</b> Olá!</div><div style="padding:4px;border-bottom:1px solid #333"><b style="color:var(--green)">Viewer:</b> ótimo stream!</div>';
        c.appendChild(msgs);
      } else if (l._widgetData.type === 'countdown') {
        const time = document.createElement('div');
        time.textContent = '05:00';
        time.style.cssText = 'font-size:1.5rem;font-weight:700;color:var(--yellow);font-family:var(--mono)';
        c.appendChild(time);
      } else if (l._widgetData.type === 'progress') {
        const bar = document.createElement('div');
        bar.style.cssText = 'width:80%;height:16px;background:var(--bg-app);border-radius:8px;overflow:hidden';
        const fill = document.createElement('div');
        fill.style.cssText = 'width:67%;height:100%;background:linear-gradient(90deg,var(--green),var(--cyan));border-radius:8px';
        bar.appendChild(fill);
        const lbl = document.createElement('div');
        lbl.textContent = '67%';
        lbl.style.cssText = 'font-size:.6rem;color:var(--text2)';
        c.appendChild(bar);
        c.appendChild(lbl);
      } else if (l._widgetData.type === 'counter') {
        const num = document.createElement('div');
        num.textContent = '1,337';
        num.style.cssText = 'font-size:1.5rem;font-weight:700;color:#fff;font-family:var(--mono)';
        c.appendChild(num);
      } else if (l._widgetData.type === 'goals') {
        const g = document.createElement('div');
        g.style.cssText = 'text-align:center';
        g.innerHTML = '<div style="font-size:.7rem;color:var(--text2)">Meta: R$ 500</div><div style="font-size:1.2rem;font-weight:700;color:var(--yellow)">R$ 340</div>';
        c.appendChild(g);
      } else if (l._widgetData.type === 'social') {
        c.innerHTML = '<div style="display:flex;gap:8px;font-size:1.2rem"><i class="fab fa-twitch" style="color:#9146FF"></i><i class="fab fa-youtube" style="color:#FF0000"></i><i class="fab fa-instagram" style="color:#E4405F"></i></div>';
      } else if (l._widgetData.type === 'timer') {
        const t2 = document.createElement('div');
        t2.textContent = '12:34:56';
        t2.style.cssText = 'font-size:1.3rem;font-weight:700;color:var(--green);font-family:var(--mono)';
        c.appendChild(t2);
      } else {
        const msg = document.createElement('div');
        msg.textContent = l._widgetData.name + ' ativo';
        msg.style.cssText = 'color:var(--green);font-size:' + sz;
        c.appendChild(msg);
      }
    } else {
      c.appendChild(makeBtn('<i class="fas fa-puzzle-piece" style="font-size:1rem"></i> Configurar Widget', () => showWidgetPicker(l)));
    }
    content.innerHTML = '';
    content.appendChild(c);

  // ---- GROUP / DEFAULT ----
  } else if (l.type === 'Group') {
    content.innerHTML = `<div style="width:100%;height:100%;background:linear-gradient(135deg,#2a2a1a,#1a1a0a);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:${sz};flex-direction:column;gap:4px"><i class="fas fa-object-group" style="font-size:${iconSz}"></i> Grupo</div>`;
  } else {
    content.innerHTML = `<div style="width:100%;height:100%;background:var(--bg-panel3);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:${sz}">${l.type}</div>`;
  }
}

// ---- HELPERS FOR INTERACTIVE LAYERS ----
function pickImageForLayer(layerId) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/gif,image/webp';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const layers = state.sceneData[state.activeScene] || [];
    const l = layers.find(x => x.id === layerId);
    if (l) {
      l._imageUrl = URL.createObjectURL(f);
      renderLayers(state.activeScene);
      toast(`Imagem carregada: ${f.name}`, 'success');
    }
  };
  inp.click();
}

function pickMediaForLayer(layerId) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.mp4,.webm,.mkv,.avi,.mov,.wmv,.flv,.m4v,.mpg,.mpeg,.3gp,.ogv,.ts,.mts,.m2ts,.vob,.divx,.xvid,.mp3,.wav,.flac,.aac,.ogg,.wma,.m4a,.opus,.aiff,.alac,.ac3,.dts,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.tiff,.ico,.heic,.heif,.raw,.psd,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.html,.htm,.css,.js,.ts,.zip,.rar,.7z,.tar,.gz,.iso,.bin,.cue,.srt,.ass,.vtt,.sub';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const layers = state.sceneData[state.activeScene] || [];
    const l = layers.find(x => x.id === layerId);
    if (l) {
      l._mediaUrl = URL.createObjectURL(f);
      renderLayers(state.activeScene);
      toast(`Mídia carregada: ${f.name}`, 'success');
    }
  };
  inp.click();
}

function promptBrowserUrl(l) {
  const url = prompt('Insira a URL para o Browser Source:', 'https://example.com');
  if (url) {
    l._browserUrl = url;
    renderLayers(state.activeScene);
    toast('Browser source configurado', 'success');
  }
}

function showWidgetPicker(l) {
  const names = {
    chat: 'Chat ao Vivo', activity: 'Feed de Atividade', goals: 'Metas',
    countdown: 'Contagem Regressiva', progress: 'Barra de Progresso',
    social: 'Redes Sociais', counter: 'Contador', spotlight: 'Destaque',
    wheel: 'Roleta', timer: 'Cronômetro'
  };
  const keys = Object.keys(names);
  const idx = Math.floor(Math.random() * keys.length);
  const chosen = keys[idx];
  l._widgetData = { type: chosen, name: names[chosen] };
  renderLayers(state.activeScene);
  toast(`Widget "${names[chosen]}" configurado!`, 'success');
}

function showRectPicker(l) {
  const colors = ['#B8860B','#2979ff','#00e5ff','#ff9100','#00e676','#ffc107','#aa00ff','#ff6d00','#ffffff','#000000'];
  const current = l._fillColor || '#2979ff';
  const c = prompt('Escolha uma cor (nome ou HEX):\n' + colors.join(', '), current);
  if (c) {
    l._fillColor = c;
    renderLayers(state.activeScene);
  }
}

// Floating window drag
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('floatHeader');
  const fc = document.getElementById('floatCanvas');
  if (header && fc) {
    let isDragging = false, startX, startY, origLeft, origTop;
    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('.float-actions')) return;
      isDragging = true;
      const rect = fc.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      origLeft = rect.left; origTop = rect.top;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      fc.style.left = (origLeft + e.clientX - startX) + 'px';
      fc.style.top = (origTop + e.clientY - startY) + 'px';
      fc.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'grab';
      }
    });
  }
});

// ---- PROJECTION (external display) ----
let projWindows = {};
let knownDisplays = [];
let lastVideoSend = {};
let lastVideoFrames = {};
let htmlSyncInterval = 100;
let videoSyncInterval = 33;
let pingInterval = 500;
let autoProjectionEnabled = true;
let lastHtmlSync = 0;
let lastVideoSync = 0;
let lastPingTime = 0;

function toggleProjection() {
  console.log('toggleProjection called');
  const keys = Object.keys(projWindows);
  if (keys.length > 0) {
    stopProjection();
    return;
  }
  detectDisplays();
  if (knownDisplays.length > 0) {
    knownDisplays.forEach(d => startProjectionOnDisplay(d));
  } else {
    openProjWindow('disp-0', 'Projeção', 0, 0, 1280, 720);
  }
}

function checkAutoProjection() {
  detectDisplays();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function detectDisplays() {
  try {
    console.log('detectDisplays called');
    knownDisplays = [];
    var sw = window.screen.width || 1920;
    var sh = window.screen.height || 1080;
    var sl = window.screen.availLeft || 0;
    var st = window.screen.availTop || 0;

    if (navigator.screenDetails) {
      navigator.screenDetails().then(function(details) {
        try {
          if (details && details.screens) {
            details.screens.forEach(function(s, i) {
              if (s !== details.primaryScreen) {
                var label = s.label || 'Monitor ' + (i + 1);
                var id = 'disp-' + i;
                var exists = knownDisplays.some(function(d) { return d.id === id; });
                if (!exists) {
                  knownDisplays.push({
                    id: id, label: label,
                    connType: label.indexOf('HDMI') >= 0 ? 'HDMI' : label.indexOf('VGA') >= 0 ? 'VGA' : 'HDMI',
                    width: s.width, height: s.height,
                    left: s.availLeft, top: s.availTop, isPrimary: false
                  });
                }
              }
            });
          }
          // Apply saved positions
          try {
            var saved = JSON.parse(localStorage.getItem('meustudio_display_pos') || '{}');
            knownDisplays.forEach(function(d) {
              if (saved[d.label]) {
                console.log('Loading saved position for', d.label, saved[d.label]);
                d.left = saved[d.label].left;
                d.top = saved[d.label].top;
              }
            });
          } catch(e4) {}
          renderDisplays();
        } catch(e2) {}
      }).catch(function(){});
    } else {
      try {
        if (window.screen && window.screen.isExtended) {
          knownDisplays.push({
            id: 'disp-1', label: 'Monitor Secundário', connType: 'HDMI',
            width: sw, height: sh, left: sl + 1920, top: st, isPrimary: false
          });
        }
      } catch(e3) {}
    }

    // Load saved positions
    try {
      var saved = JSON.parse(localStorage.getItem('meustudio_display_pos') || '{}');
      knownDisplays.forEach(function(d) {
        if (saved[d.label]) {
          console.log('Loading saved position for', d.label, saved[d.label]);
          d.left = saved[d.label].left;
          d.top = saved[d.label].top;
        }
      });
    } catch(e4) {}

    renderDisplays();
    toast(knownDisplays.length > 0 ? knownDisplays.length + ' saída(s) detectada(s)' : 'Nenhuma saída extra detectada', 'info');
  } catch(e) {
    console.warn('detectDisplays error:', e);
  }
  return knownDisplays;
}

function renderDisplays() {
  const list = document.getElementById('displaysList');
  if (!list) return;
  let html = '<span style="font-size:.6rem;color:var(--text3);font-weight:600;"><i class="fas fa-desktop"></i> SAÍDAS:</span>';
  knownDisplays.filter(function(d) { return !d.isPrimary; }).forEach(d => {
    const proj = projWindows[d.id];
    const active = proj ? 'active' : '';
    const status = proj ? 'on' : 'off';
    const stxt = proj ? 'ON' : 'OFF';
    html += '<div class="disp-target ' + active + '" onclick="toggleDisplayProj(\'' + d.id + '\')" title="' + d.label + ' - ' + d.width + 'x' + d.height + '">' +
      '<i class="fas fa-tv" style="font-size:.5rem"></i>' +
      '<span class="disp-name">' + d.label + '</span>' +
      '<span class="disp-res">' + d.width + 'x' + d.height + '</span>' +
      '<span class="disp-proj ' + status + '">' + stxt + '</span></div>';
  });
  list.innerHTML = html;
}

function toggleDisplayProj(dispId) {
  if (projWindows[dispId]) {
    stopProjectionOnDisplay(dispId);
  } else {
    const disp = knownDisplays.find(function(d) { return d.id === dispId; });
    if (disp) startProjectionOnDisplay(disp);
  }
}

function startProjectionOnDisplay(display) {
  console.log('startProjectionOnDisplay:', display.label, 'at', display.left, display.top, display.width, display.height);
  const dispId = display.id;
  if (projWindows[dispId]) { projWindows[dispId].win.focus(); return; }
  openProjWindow(dispId, display.label, display.left, display.top,
    display.width, display.height);
}

function openProjWindow(dispId, name, left, top, w, h) {
  console.log('openProjWindow:', name, left, top, w, h);
  const projUrl = 'projecao.html?disp=' + encodeURIComponent(name) + '&left=' + left + '&top=' + top + '&w=' + w + '&h=' + h;
  // Use small size to force popup mode (browser ignores left/top for tabs)
  const features = 'popup=1,width=400,height=300,left=' + left + ',top=' + top +
    ',menubar=no,toolbar=no,location=no,status=no,scrollbars=no';
  const win = window.open(projUrl, 'meustudio_proj_' + dispId, features);
  if (!win) {
    toast('Pop-up bloqueado! Permita pop-ups para este site e clique novamente.', 'error');
    return;
  }

  projWindows[dispId] = { win: win, interval: null, display: { id: dispId, name: name, left: left, top: top, w: w, h: h }, lastHTML: '' };

  var checkReady = setInterval(function() {
    try {
      if (win.document && win.document.readyState === 'complete') {
        clearInterval(checkReady);
        startProjSync(dispId, win);
      } else if (win.document && win.document.readyState) {
        clearInterval(checkReady);
        startProjSync(dispId, win);
      }
    } catch(e) {}
  }, 200);

  setTimeout(function() {
    clearInterval(checkReady);
    if (projWindows[dispId] && !projWindows[dispId].interval && win && !win.closed) {
      startProjSync(dispId, win);
      toast('Projeção em "' + name + '" ativa', 'warning');
    }
  }, 5000);

  updateProjectionUI();
  toast('Projetando em: ' + name, 'success');
}

function moveProjWindow(dispId) {
  var entry = projWindows[dispId];
  if (!entry) return;
  var disp = entry.display;
  var win = entry.win;
  if (!win || win.closed) return;
  // Try direct move/resize from opener (multiple attempts)
  for (var i = 0; i < 3; i++) {
    (function(attempt) {
      setTimeout(function() {
        if (!win || win.closed) return;
        try { win.moveTo(disp.left, disp.top); } catch(e) {}
        try { win.resizeTo(disp.w, disp.h); } catch(e) {}
        try {
          win.postMessage({
            type: 'proj-move',
            left: disp.left,
            top: disp.top,
            width: disp.w,
            height: disp.h
          }, '*');
        } catch(e) {}
      }, attempt * 800 + 200);
    })(i);
  }
}

function startProjSync(dispId, win) {
  console.log('startProjSync:', dispId);
  if (!projWindows[dispId]) return;
  var self = projWindows[dispId];
  self.interval = setInterval(function() {
    var now = Date.now();
    if (now - lastHtmlSync >= htmlSyncInterval) {
      syncHtmlOnlyFor(dispId);
      lastHtmlSync = now;
    }
    if (now - lastVideoSync >= videoSyncInterval) {
      syncVideoOnlyFor(dispId);
      lastVideoSync = now;
    }
    if (now - lastPingTime >= pingInterval) {
      sendPingFor(dispId);
      lastPingTime = now;
    }
    // Save window position frequently
    try {
      if (win && !win.closed) {
        var _sl = win.screenLeft;
        var _st = win.screenTop;
        if (_sl !== 0 || _st !== 0) {
          var saved = JSON.parse(localStorage.getItem('meustudio_display_pos') || '{}');
          saved[self.display.name] = { left: _sl, top: _st };
          localStorage.setItem('meustudio_display_pos', JSON.stringify(saved));
        }
      }
    } catch(e) {}
  }, 30);
  document.getElementById('btnProject')?.classList.add('active');
  setTimeout(function() { forceSyncFor(dispId); }, 500);
}

function stopProjectionOnDisplay(dispId) {
  var p = projWindows[dispId];
  if (!p) return;
  if (p.interval) clearInterval(p.interval);
  try { if (p.win && !p.win.closed) p.win.close(); } catch(e) {}
  delete projWindows[dispId];
  updateProjectionUI();
}

function updateProjectionUI() {
  var keys = Object.keys(projWindows);
  var btn = document.getElementById('btnProject');
  if (btn) btn.classList.toggle('active', keys.length > 0);
  renderDisplays();
  if (keys.length === 0) toast('Projeção encerrada', 'info');
}

function stopProjection() {
  Object.keys(projWindows).forEach(function(id) { stopProjectionOnDisplay(id); });
}

function syncHtmlOnlyFor(dispId) {
  var p = projWindows[dispId];
  if (!p || !p.win || p.win.closed) { stopProjectionOnDisplay(dispId); return; }
  var grid = document.getElementById('canvasGrid');
  if (!grid) return;
  try {
    var clone = grid.cloneNode(true);
    var html = clone.innerHTML || '';
    var isChanged = html !== p.lastHTML;
    if (isChanged) p.lastHTML = html;
    p.win.postMessage({ type: 'proj-update-html', html: html, w: 960, h: 540, changed: isChanged }, '*');
  } catch(e) {
    if (p.win && p.win.closed) stopProjectionOnDisplay(dispId);
  }
}

function syncVideoOnlyFor(dispId) {
  var p = projWindows[dispId];
  if (!p || !p.win || p.win.closed) { stopProjectionOnDisplay(dispId); return; }
  var grid = document.getElementById('canvasGrid');
  if (!grid) return;
  try {
    var vids = grid.querySelectorAll('canvas-layer[data-layer] video, canvas-layer[data-layer] canvas.layer-chroma-canvas');
    var msg = { type: 'proj-update-video', w: 960, h: 540, vdata: [] };
    var tx = [];
    var now = Date.now();
    vids.forEach(function(v) {
      var layer = v.closest('canvas-layer');
      var id = layer ? layer.getAttribute('data-layer') : null;
      var isCanvas = v.tagName === 'CANVAS';
      if (!id) return;
      if (isCanvas) {
        if (v.width < 1 || v.height < 1) return;
      } else {
        if ((!v.srcObject && !v.src) || v.videoWidth < 1 || v.videoHeight < 1) return;
      }
      var lastSend = lastVideoSend[id] || 0;
      if (now - lastSend < videoSyncInterval) {
        var cached = lastVideoFrames[id];
        if (cached && (now - cached.time < 1000)) {
          msg.vdata.push(cached.data);
          if (cached.transferable) tx.push(cached.transferable);
          return;
        }
      }
      try {
        var vw = isCanvas ? v.width : v.videoWidth;
        var vh = isCanvas ? v.height : v.videoHeight;
        var cv = document.createElement('canvas');
        cv.width = vw; cv.height = vh;
        cv.getContext('2d').drawImage(v, 0, 0, vw, vh);
        var videoData = null, transferable = null;
        if (cv.transferToImageBitmap) {
          try {
            var bmp = cv.transferToImageBitmap();
            videoData = { id: id, w: vw, h: vh, k: 'b' + id, type: 'bitmap' };
            transferable = bmp;
            msg['b' + id] = bmp; tx.push(bmp);
          } catch(e2) {
            videoData = { id: id, w: vw, h: vh, k: 'b' + id, type: 'dataurl', data: cv.toDataURL('image/webp', 0.8) };
          }
        } else {
          videoData = { id: id, w: vw, h: vh, k: 'b' + id, type: 'dataurl', data: cv.toDataURL('image/webp', 0.8) };
        }
        if (videoData) {
          lastVideoFrames[id] = { data: videoData, time: now, transferable: transferable };
          lastVideoSend[id] = now;
          msg.vdata.push(videoData);
          if (transferable) tx.push(transferable);
        }
      } catch(e2) {}
    });
    if (msg.vdata.length) p.win.postMessage(msg, '*', tx);
  } catch(e) {
    if (p.win && p.win.closed) stopProjectionOnDisplay(dispId);
  }
}

function sendPingFor(dispId) {
  var p = projWindows[dispId];
  if (!p || !p.win || p.win.closed) { stopProjectionOnDisplay(dispId); return; }
  try { p.win.postMessage({ type: 'proj-ping', t: Date.now() }, '*'); } catch(e) {}
}

function forceSyncFor(dispId) {
  var p = projWindows[dispId];
  if (!p || !p.win || p.win.closed) return;
  p.lastHTML = '';
  syncHtmlOnlyFor(dispId);
}
 
// Override renderCanvas to also sync float canvas and apply drag
const _origRenderCanvas = renderCanvas;
renderCanvas = function(layers) {
  _origRenderCanvas(layers);
  syncFloatCanvas();
  setTimeout(applyDragToLayerElements, 0);
};

// Override renderLayers to re-apply drag
const _origRenderLayers = renderLayers;
renderLayers = function(sceneIdx) {
  _origRenderLayers(sceneIdx);
  setTimeout(applyDragToLayerElements, 50);
};

// Expose dialogs to inline HTML
window.showSession = showSession;
window.toggleFullscreen = toggleFullscreen;
window.detectDisplays = detectDisplays;
window.toggleDisplayProj = toggleDisplayProj;
window.toggleProjection = toggleProjection;
window.editScene = editScene;
window.shareGuestLink = shareGuestLink;
window.toggleGuestMute = toggleGuestMute;
window.toggleGuestVideo = toggleGuestVideo;
window.addGuestToScene = addGuestToScene;
window.addNewGuest = addNewGuest;
window.removeGuest = removeGuest;
window.editGuest = editGuest;
window.updateGuestRoomScene = updateGuestRoomScene;
window.quickAddGuest = quickAddGuest;

// ============================================
// GUEST MANAGEMENT (24 convidados com vídeo)
// ============================================
// ALTERE AQUI O LINK BASE DOS CONVIDADOS (troque quando for para produção):
var GUEST_BASE_URL = 'http://127.0.0.1:8080/guest.html';

const guestList = [
  { name: 'Raphael Pessoa', title: 'Vereador - MDB' },
  { name: 'Rafael Lacerda', title: 'Vereador - REP' },
  { name: 'Silvana Maciel', title: 'Vereadora - PT' },
  { name: 'Demir Peixoto', title: 'Vereador - UNIÃO' },
  { name: 'Amanda Rodrigues', title: 'Vereadora - PMN' },
  { name: 'Manoel Correia', title: 'Vereador - PP' },
  { name: 'Júlio César', title: 'Vereador - PSD' },
  { name: 'Michele Rosa', title: 'Vereadora - PT' },
  { name: 'Dona Bruna', title: 'Vereadora - PT' },
  { name: 'Cristina Oliveira', title: 'Vereadora - PV' },
  { name: 'Anderson Souza (ET)', title: 'Vereador - UNIÃO' },
  { name: 'Capitão Martins', title: 'Vereador - PT' },
  { name: 'Carlos Alberto', title: 'Vereador - UNIÃO' },
  { name: 'Dr. Patriarca', title: 'Vereador - PODE' },
  { name: 'Edízio Moreira', title: 'Vereador - REP' },
  { name: 'Inspetor Morais', title: 'Vereador - PP' },
  { name: 'Ivonaldo Lima', title: 'Vereador - PP' },
  { name: 'João Bodó', title: 'Vereador - PMN' },
  { name: 'Jota Filho', title: 'Vereador - MDB' },
  { name: 'Léo Sales', title: 'Vereador - PP' },
  { name: 'Paulo Henrique', title: 'Vereador - UNIÃO' },
  { name: 'Tradutor de Libras 1', title: 'TVCamaraMaracanaú' },
  { name: 'Tradutor de Libras 2', title: 'TVCamaraMaracanaú' },
  { name: 'Convidado 3', title: 'Fulano de Tal' }
];

const guestRooms = [];
for (let i = 0; i < 24; i++) {
  var rid = 'sala-' + String(i + 1).padStart(2, '0');
  if (guestList[i].name === 'Tradutor de Libras 1') rid = 'tradutordelibras1';
  if (guestList[i].name === 'Tradutor de Libras 2') rid = 'tradutordelibras2';
  guestRooms.push({
    id: rid,
    personName: guestList[i].name,
    personTitle: guestList[i].title,
    guest: null,
    muted: false,
    videoOff: false
  });
}

function initGuestRooms() {
  const cont = document.getElementById('guestRooms');
  if (!cont) return;

  let html = '';
  for (let i = 0; i < 24; i++) {
    const r = guestRooms[i];
    html += `
      <div class="gslot" id="gslot-${i}" ondblclick="quickAddGuest(${i})">
        <video class="gslot-video" id="gvideo-${i}" autoplay muted playsinline poster="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect fill="#1a1a2e" width="160" height="90"/></svg>')}"></video>
        <div class="gslot-badge" id="gstatus-${i}"></div>
        <div class="gslot-overlay">
          <span class="gslot-name" id="gname-${i}">${r.personName}</span>
          <span class="gslot-title" id="gtitle-${i}">${r.personTitle}</span>
        </div>
        <div class="gslot-controls" id="gctrl-${i}">
          <button class="gbtn" onclick="event.stopPropagation();editGuest(${i})" title="Editar"><i class="fas fa-pen"></i></button>
          <button class="gbtn" onclick="event.stopPropagation();shareGuestLink(${i})" title="Link"><i class="fas fa-link"></i></button>
          <button class="gbtn" onclick="event.stopPropagation();toggleGuestMute(${i})" title="Mudo" id="gmute-${i}"><i class="fas fa-microphone"></i></button>
          <button class="gbtn" onclick="event.stopPropagation();toggleGuestVideo(${i})" title="Câmera" id="gcam-${i}"><i class="fas fa-video"></i></button>
          <button class="gbtn gbtn-add" onclick="event.stopPropagation();addGuestToScene(${i})" title="Adicionar à cena"><i class="fas fa-plus-circle"></i></button>
          <button class="gbtn gbtn-remove" onclick="event.stopPropagation();removeGuest(${i})" title="Excluir"><i class="fas fa-times"></i></button>
        </div>
      </div>`;
  }
  cont.innerHTML = html;

  window.addEventListener('storage', function(e) {
    if (e.key && e.key.startsWith('guest-')) {
      var roomId = e.key.replace('guest-', '');
      var data = JSON.parse(e.newValue);
      handleGuestConnection(roomId, data);
    }
  });

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'guest-connected') {
      handleGuestConnection(e.data.roomId, e.data);
    }
  });
}

function handleGuestConnection(roomId, data) {
  var room = guestRooms.find(function(r) { return r.id === roomId; });
  if (!room) return;
  var idx = guestRooms.indexOf(room);

  room.guest = { name: data.guestName, status: 'connected', stream: null };

  var vid = document.getElementById('gvideo-' + idx);
  var st = document.getElementById('gstatus-' + idx);
  st.textContent = 'LIVE';
  st.className = 'gslot-badge live';

  // Request guest camera with noise/echo cancellation
  navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 360 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  }).then(function(stream) {
    vid.srcObject = stream;
    room.guest.stream = stream;
    if (room.id.indexOf('tradutordelibras') === 0) enableSlotChromaKey(idx);
    updateGuestRoomScene();
    toast(data.guestName + ' conectado', 'success');
  }).catch(function(err) {
    vid.poster = '';
    updateGuestRoomScene();
    var msg = data.guestName + ' conectado (c\u00E2mera indispon\u00EDvel)';
    if (err.message && err.message.indexOf('Device in use') >= 0) {
      msg = data.guestName + ' conectado (c\u00E2mera em uso por outro slot)';
    }
    toast(msg, 'warning');
  });
}

function updateSlotStatus(idx) {
  var room = guestRooms[idx];
  var el = document.getElementById('gslot-' + idx);
  var st = document.getElementById('gstatus-' + idx);
  if (!room.guest) {
    el.className = 'gslot';
    st.textContent = '';
    st.className = 'gslot-badge';
  } else if (room.guest.status === 'connected') {
    el.className = 'gslot live';
    st.textContent = 'LIVE';
    st.className = 'gslot-badge live';
  }
}

function shareGuestLink(idx) {
  var room = guestRooms[idx];
  var label = room.personName || ('Sala ' + (idx+1));
  var isLibras = label.indexOf('Tradutor de Libras') === 0 || label.indexOf('Convidado 3') === 0;
  var link = GUEST_BASE_URL + '?id=' + room.id;
  if (!isLibras) link += '&name=' + encodeURIComponent(label);

  navigator.clipboard.writeText(link).catch(function() {});
}

function addNewGuest() {
  for (var i = 0; i < 24; i++) {
    if (!guestRooms[i].guest) {
      shareGuestLink(i);
      var label = guestRooms[i].personName || 'Sala ' + (i+1);
      toast('Link gerado para ' + label, 'success');
      return;
    }
  }
  toast('Todas as 24 salas ocupadas!', 'warning');
}

function removeGuest(idx) {
  var room = guestRooms[idx];
  if (!room) return;

  if (room.guest) {
    localStorage.setItem('guest-action-' + room.id, JSON.stringify({
      type: 'director-action',
      action: 'cut',
      timestamp: Date.now()
    }));

    var vid = document.getElementById('gvideo-' + idx);
    if (vid.srcObject) {
      vid.srcObject.getTracks().forEach(function(t) { t.stop(); });
      vid.srcObject = null;
    }
    vid.poster = '';
  }

  var name = room.personName || room.guest?.name || 'Convidado';

  room.guest = null;
  room.personName = '';
  room.personTitle = '';
  document.getElementById('gname-' + idx).textContent = '(vazio)';
  document.getElementById('gtitle-' + idx).textContent = '';
  updateSlotStatus(idx);

  var muteBtn = document.getElementById('gmute-' + idx);
  muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
  muteBtn.className = 'gbtn';
  var camBtn = document.getElementById('gcam-' + idx);
  camBtn.innerHTML = '<i class="fas fa-video"></i>';
  camBtn.className = 'gbtn';
  room.muted = false;
  room.videoOff = false;

  updateGuestRoomScene();
  toast(name + ' exclu\u00EDdo', 'info');
}

function toggleGuestMute(idx) {
  var room = guestRooms[idx];
  if (!room || !room.guest || !room.guest.stream) return;
  room.muted = !room.muted;
  room.guest.stream.getAudioTracks().forEach(function(t) { t.enabled = !room.muted; });
  var btn = document.getElementById('gmute-' + idx);
  btn.innerHTML = room.muted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
  btn.classList.toggle('off', room.muted);
}

function toggleGuestVideo(idx) {
  var room = guestRooms[idx];
  if (!room || !room.guest || !room.guest.stream) return;
  room.videoOff = !room.videoOff;
  room.guest.stream.getVideoTracks().forEach(function(t) { t.enabled = !room.videoOff; });
  var btn = document.getElementById('gcam-' + idx);
  btn.innerHTML = room.videoOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
  btn.classList.toggle('off', room.videoOff);
}

function addGuestToScene(idx) {
  var room = guestRooms[idx];
  if (!room || !room.guest) return;
  if (!room.guest.stream) {
    toast('Convidado sem stream de v\u00EDdeo', 'warning');
    return;
  }
  var layers = state.sceneData[state.activeScene] || [];
  var guestLayer = createLayerData('C\u00E2mera', room.personName || room.guest.name, 'fa-user');
  guestLayer._stream = room.guest.stream;
  guestLayer._guestRoom = room.id;
  if (room.id.indexOf('tradutordelibras') === 0) {
    guestLayer.effects.push({ id: ++state.effectIdCounter, name: 'Chroma Key', bypass: false });
  }
  layers.push(guestLayer);
  state.sceneData[state.activeScene] = layers;
  renderLayers(state.activeScene);
  toast((room.personName || room.guest.name) + ' adicionado \u00E0 cena!', 'success');
}

function quickAddGuest(idx) {
  var room = guestRooms[idx];
  if (!room || !room.guest) {
    toast('N\u00E3o h\u00E1 convidado conectado nesta sala', 'warning');
    return;
  }
  if (!room.guest.stream) {
    toast('Convidado sem stream de v\u00EDdeo', 'warning');
    return;
  }
  var layers = state.sceneData[state.activeScene] || [];
  var guestLayer = createLayerData('C\u00E2mera', room.personName || room.guest.name, 'fa-user');
  guestLayer.x = 0;
  guestLayer.y = 0;
  guestLayer.w = 192;
  guestLayer.h = 144;
  guestLayer._stream = room.guest.stream;
  guestLayer._guestRoom = room.id;
  if (room.id.indexOf('tradutordelibras') === 0) {
    guestLayer.effects.push({ id: ++state.effectIdCounter, name: 'Chroma Key', bypass: false });
  }
  layers.push(guestLayer);
  state.sceneData[state.activeScene] = layers;
  renderLayers(state.activeScene);
  selectLayer(guestLayer.id);
  toast((room.personName || room.guest.name) + ' no canto esquerdo!', 'success');
}

function editGuest(idx) {
  var room = guestRooms[idx];
  var newName = prompt('Nome do convidado:', room.personName || '');
  if (newName === null) return;
  var newTitle = prompt('T\u00EDtulo / cargo:', room.personTitle || '');
  if (newTitle === null) return;
  if (newName.trim()) room.personName = newName.trim();
  room.personTitle = newTitle.trim();
  document.getElementById('gname-' + idx).textContent = room.personName;
  document.getElementById('gtitle-' + idx).textContent = room.personTitle;
  updateGuestRoomScene();
  toast(room.personName + ' atualizado', 'success');
}

function enableSlotChromaKey(idx) {
  var vid = document.getElementById('gvideo-' + idx);
  if (!vid) return;
  var slot = document.getElementById('gslot-' + idx);
  if (!slot) return;

  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;pointer-events:none';
  canvas.className = 'gslot-chroma';
  slot.appendChild(canvas);
  vid.style.display = 'none';

  var ctx = canvas.getContext('2d');
  var w = 0, h = 0, running = true;

  function process() {
    if (!running) return;
    if (!vid.videoWidth || !vid.videoHeight) { requestAnimationFrame(process); return; }
    if (w !== vid.videoWidth || h !== vid.videoHeight) {
      w = vid.videoWidth; h = vid.videoHeight;
      canvas.width = w; canvas.height = h;
    }
    ctx.drawImage(vid, 0, 0, w, h);
    var imageData = ctx.getImageData(0, 0, w, h);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i], g = data[i+1], b = data[i+2];
      if (g > r + 25 && g > b + 25) data[i+3] = 0;
    }
    ctx.putImageData(imageData, 0, 0);
    requestAnimationFrame(process);
  }
  process();

  // Stop when guest is removed
  var _obs = new MutationObserver(function() {
    if (!document.body.contains(slot)) { running = false; _obs.disconnect(); }
  });
  _obs.observe(document.body, { childList: true, subtree: true });
}

function updateGuestRoomScene() {
  var sceneIdx = 1;
  if (state.activeScene !== sceneIdx) return;

  var connected = [];
  for (var i = 0; i < 24; i++) {
    if (guestRooms[i].guest && guestRooms[i].guest.stream) {
      connected.push({ idx: i, room: guestRooms[i] });
    }
  }

  if (connected.length === 0) {
    state.sceneData[sceneIdx] = [];
    renderLayers(sceneIdx);
    return;
  }

  var canvasW = 1920, canvasH = 1080, pad = 4;
  var n = connected.length;
  var cols, rows;
  if (n === 1) { cols = 1; rows = 1; }
  else if (n === 2) { cols = 2; rows = 1; }
  else if (n <= 4) { cols = 2; rows = 2; }
  else if (n <= 6) { cols = 3; rows = 2; }
  else if (n <= 9) { cols = 3; rows = 3; }
  else if (n <= 12) { cols = 4; rows = 3; }
  else if (n <= 16) { cols = 4; rows = 4; }
  else if (n <= 20) { cols = 5; rows = 4; }
  else { cols = 6; rows = 4; }

  var cellW = (canvasW - pad * (cols + 1)) / cols;
  var cellH = (canvasH - pad * (rows + 1)) / rows;

  var layers = [];
  for (var i = 0; i < connected.length; i++) {
    var g = connected[i];
    var col = i % cols;
    var row = Math.floor(i / cols);
    var layer = createLayerData('Câmera', g.room.personName || g.room.guest.name, 'fa-user');
    layer.x = Math.round(pad + col * (cellW + pad));
    layer.y = Math.round(pad + row * (cellH + pad));
    layer.w = Math.round(cellW);
    layer.h = Math.round(cellH);
    layer.locked = true;
    layer.radius = 4;
    layer._stream = g.room.guest.stream;
    layer._guestRoom = g.room.id;
    layers.push(layer);
  }

  state.sceneData[sceneIdx] = layers;
  renderLayers(sceneIdx);
}

document.addEventListener('DOMContentLoaded', function() {
  initGuestRooms();
});

// Save projection window positions every 3s
setInterval(function() {
  for (var id in projWindows) {
    var entry = projWindows[id];
    if (entry && entry.win && !entry.win.closed) {
      try {
        var saved = JSON.parse(localStorage.getItem('meustudio_display_pos') || '{}');
        saved[entry.display.name] = { left: entry.win.screenLeft, top: entry.win.screenTop };
        localStorage.setItem('meustudio_display_pos', JSON.stringify(saved));
      } catch(e) {}
    }
  }
}, 3000);

// Also save position when projection stops
var _origStopProjection = stopProjectionOnDisplay;
stopProjectionOnDisplay = function(dispId) {
  var entry = projWindows[dispId];
  if (entry && entry.win && !entry.win.closed) {
    try {
      var saved = JSON.parse(localStorage.getItem('meustudio_display_pos') || '{}');
      saved[entry.display.name] = { left: entry.win.screenLeft, top: entry.win.screenTop };
      localStorage.setItem('meustudio_display_pos', JSON.stringify(saved));
    } catch(e) {}
  }
  _origStopProjection(dispId);
};
