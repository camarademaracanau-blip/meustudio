# PROJEÇÃO (PROJECTOR) - DOCUMENTAÇÃO COMPLETA

## Visão Geral

O botão **PROJETAR** no MeuStudio abre uma janela secundária (`projecao.html`) que espelha o conteúdo do canvas principal em tempo real. O objetivo é permitir que o diretor projete a saída em um monitor secundário ou tela cheia.

---

## Arquitetura

```
┌──────────────────────────────────┐         postMessage          ┌──────────────────────┐
│  meustudio.html (parent)         │  ──────────────────────►     │  projecao.html       │
│                                  │   a cada 100ms               │  (child window)      │
│  canvasGrid                      │                              │                      │
│  ├── canvas-layer (data-layer=1) │   HTML (sem <video>)         │  <div id="container">│
│  ├── canvas-layer (data-layer=2) │   + ImageBitmap (video)      │    ├── canvas-layer 1│
│  └── canvas-layer (data-layer=3) │   + dataURL (fallback)       │    ├── canvas-layer 2│
│                                  │                              │    └── canvas-layer 3│
│  syncProjection()                │                              │                      │
│  1. Clona grid, remove <video>   │                              │  fit() → escala      │
│  2. Captura frames de vídeo      │                              │  applyVideoFrame()   │
│  3. postMessage(msg, '*', tx)    │                              │  auto-fullscreen     │
└──────────────────────────────────┘                              └──────────────────────┘
```

---

## O Que Foi Tentado

### 1. Abordagem Original (document.write inline)
- **Como**: `window.open('')` + `document.write()` com HTML/CSS/JS minificado inline
- **Problema**: Código ilegível, difícil de debugar, não preservava elementos de vídeo
- **Resultado**: ❌ Abandonado

### 2. Abordagem Atual (projecao.html separado)
- **Como**: `window.open('projecao.html')` com arquivo HTML dedicado
- **Vantagem**: Código legível, fácil de debugar, JS separado
- **Resultado**: ✅ Funcional para camadas estáticas

### 3. Centralização (fit())
- **Tentativa 1**: `left/top = (window - scaled) / 2 / scale` → centralização errada
- **Tentativa 2**: `margin-left/margin-top` com `left/top = 0` → melhor
- **Tentativa 3**: `transform-origin: 0 0` + `left/top` calculado → **funcionou**
- **Resultado**: ✅ Centralizado corretamente

### 4. Transmissão de Vídeo
- **Problema**: `<video srcObject=MediaStream>` não serializa via `innerHTML`
- **Tentativa 1**: `canvas.drawImage(video)` → `transferToImageBitmap()` → `postMessage` com transferable
  - **Erro**: `DataCloneError: Value at index 0 does not have a transferable type`
  - **Causa**: Em alguns navegadores, `transferToImageBitmap` retorna objeto não-transferível
- **Tentativa 2**: Fallback com `canvas.toDataURL('image/jpeg')` → envia como string no message
  - **Resultado**: ✅ Funciona, mas mais lento
- **Tentativa 3**: Anti-flicker — não reescrever innerHTML de layers com vídeo ativo
  - **Resultado**: ✅ Reduz flicker significativamente

### 5. Anti-Flicker
- **Problema**: A cada 100ms, o HTML era reescrito, causando piscada no vídeo
- **Solução**: 
  - Parent: só envia HTML se mudou (`html !== projLastHTML`)
  - Child: layers com `hasVideo=true` não têm innerHTML reescrito
  - Frames de vídeo são enviados separadamente via canvas overlay

---

## O Que Funciona

| Funcionalidade | Status |
|----------------|--------|
| Abrir janela de projeção | ✅ |
| Espelhar camadas estáticas (texto, retângulo, imagem) | ✅ |
| Centralização automática | ✅ |
| Auto-fullscreen na janela child | ✅ |
| Botão fullscreen manual | ✅ |
| Anti-flicker para camadas sem vídeo | ✅ |
| Remoção de camadas deletadas | ✅ |
| Adição de novas camadas | ✅ |

---

## O Que Não Funciona (ou Funciona Parcialmente)

| Funcionalidade | Status | Problema |
|----------------|--------|----------|
| Vídeo da câmera na projeção | ⚠️ Parcial | DataURL funciona mas é lento (~10fps) |
| TransferToImageBitmap | ❌ | DataCloneError em alguns browsers |
| Áudio na projeção | ❌ | Não implementado |
| Atualização em tempo real de vídeo | ⚠️ | DataURL a cada 100ms é pesado |
| Projeção via file:/// | ❌ | Bloqueio de same-origin |

---

## Problemas Conhecidos

### 1. DataCloneError no postMessage
```
DataCloneError: Failed to execute 'postMessage' on 'Window': 
Value at index 0 does not have a transferable type.
```
**Causa**: `transferToImageBitmap()` não retorna um objeto transferível em todas as versões do Chrome.
**Workaround**: Fallback para `toDataURL('image/jpeg')`.

### 2. Flicker do Vídeo
**Causa**: `innerHTML` reescrito a cada sync remove e recria o elemento de vídeo.
**Solução**: Não reescrever innerHTML de layers com vídeo ativo.

### 3. file:/// Restrictions
**Causa**: `window.open('projecao.html')` via `file:///` cria origem opaca (`null`), bloqueando acesso ao DOM da child.
**Solução**: Usar servidor local (`node server.js`).

---

## Arquivos Envolvidos

| Arquivo | Papel |
|---------|-------|
| `meustudio.js` (linhas ~2010-2162) | Funções `startProjection()`, `syncProjection()`, `stopProjection()`, `hasVideoChanges()`, `toggleFullscreen()` |
| `projecao.html` | Janela child standalone com `fit()`, `updateHTML()`, `applyVideoFrame()`, `applyVideoDataURL()` |
| `server.js` | Servidor HTTP local necessário para same-origin |

---

## O Que Poderia Ser Feito (Melhorias Futuras)

### 1. OffscreenCanvas + ImageBitmap (Alta Performance)
```javascript
// Parent: renderizar tudo num OffscreenCanvas
const offscreen = new OffscreenCanvas(1920, 1080);
const ctx = offscreen.getContext('2d');
// Desenhar todas as layers + vídeo no offscreen
ctx.drawImage(videoElement, 0, 0);
const bitmap = offscreen.transferToImageBitmap();
projWindow.postMessage({ type: 'frame', bitmap }, '*', [bitmap]);
```
**Vantagem**: Um único frame por sync, sem HTML diff, máxima performance.
**Desvantagem**: Requer reescrever toda a lógica de renderização.

### 2. WebCodecs API
```javascript
const encoder = new VideoEncoder({...});
encoder.configure({ codec: 'vp8', width: 1920, height: 1080 });
encoder.encode(frame);
// Enviar encoded frames via postMessage ou WebSocket
```
**Vantagem**: Compressão eficiente, baixa latência.
**Desvantagem**: API complexa, suporte limitado.

### 3. SharedArrayBuffer + Atomics
```javascript
// Parent escreve pixels num SharedArrayBuffer
// Child lê diretamente sem cópia
const sab = new SharedArrayBuffer(1920 * 1080 * 4);
```
**Vantagem**: Zero-copy, máxima performance.
**Desvantagem**: Requer headers de segurança específicos (`Cross-Origin-Opener-Policy`).

### 4. Canvas.captureStream() + WebRTC
```javascript
const stream = mainCanvas.captureStream(60);
const pc = new RTCPeerConnection();
pc.addTrack(stream.getVideoTracks()[0]);
// Child recebe via WebRTC
```
**Vantagem**: Stream nativo, baixa latência.
**Desvantagem**: Complexidade do WebRTC signaling.

### 5. Melhorar DataURL Atual
- Reduzir frequência de sync de 100ms para 200ms para vídeo
- Usar `image/webp` em vez de `image/jpeg` (menor tamanho)
- Só enviar frames de vídeo quando houver mudança significativa (diff de pixels)

### 6. Picture-in-Picture API
```javascript
// Usar PiP nativo do browser em vez de window.open
videoElement.requestPictureInPicture();
```
**Vantagem**: Nativo, sem necessidade de janela secundária.
**Desvantagem**: Só funciona com elemento `<video>`, não com canvas composto.

### 7. Fullscreen API na Parent
```javascript
// Em vez de abrir janela child, fazer o canvas entrar em fullscreen
document.getElementById('canvasGrid').requestFullscreen();
```
**Vantagem**: Simples, nativo.
**Desvantagem**: Perde a interface de controle do diretor.

---

## Histórico de Mudanças

| Data | Mudança |
|------|---------|
| 2026-05-19 | Criado `projecao.html` separado, reescrito `syncProjection()` |
| 2026-05-19 | Corrigido `fit()` para centralização correta |
| 2026-05-19 | Adicionado fallback `toDataURL` para `transferToImageBitmap` |
| 2026-05-19 | Implementado anti-flicker para layers com vídeo |
| 2026-05-19 | Adicionado auto-fullscreen na janela child |
| 2026-05-19 | Corrigido código duplicado em `syncProjection` (SyntaxError) |
| 2026-05-19 | Adicionado `server.js` para servir via HTTP (evitar file:/// restrictions) |

---

## Notas de Debug

### Logs Úteis
```javascript
// No parent (meustudio.js):
console.log('Rendering layer', l.id, 'type:', l.type, 'stream:', !!l._stream);

// No child (projecao.html):
// Info overlay mostra: srcW x srcH | layers: N | video: N
```

### Verificar se Projeção Está Ativa
```javascript
// No console do parent:
projWindow && !projWindow.closed // true = projeção ativa
```

### Forçar Sync Manual
```javascript
// No console do parent:
syncProjection();
```
