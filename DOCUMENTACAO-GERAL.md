# MEUSTUDIO - DOCUMENTAÇÃO COMPLETA DO PROJETO

## Visão Geral

Estúdio de transmissão web profissional inspirado no Meld Studio, vMix e OBS Studio.

---

## Estrutura de Arquivos

| Arquivo | Tamanho | Descrição |
|---------|---------|-----------|
| `meustudio.html` | ~18KB | Interface principal do estúdio |
| `meustudio.js` | ~83KB | Lógica completa do estúdio |
| `meustudio.css` | ~29KB | Estilos dark broadcast |
| `script.js` | ~30KB | Sistema RCT CALL (legado) |
| `style.css` | ~30KB | Estilos RCT CALL (legado) |
| `guest.html` | ~8KB | Página do convidado (celular) |
| `projecao.html` | ~6KB | Janela de projeção |
| `server.js` | ~1KB | Servidor HTTP local |
| `README.md` | ~2KB | Descrição original do projeto |

---

## Funcionalidades Implementadas

### Estúdio Principal
- [x] Cenas (adicionar, remover, reordenar por drag)
- [x] Camadas (11 tipos: vídeo, texto, imagem, browser, etc.)
- [x] Canvas com drag & drop
- [x] Transições (cut, fade, morph, move)
- [x] Inspector (propriedades, efeitos, presets)
- [x] Audio Mixer (VU meters, faders, mute, cue)
- [x] Widgets (chat, countdown, goals, etc.)
- [x] Stream targets (YouTube, Instagram, Facebook, RTMP)
- [x] Modos de saída (16:9, 9:16, dual)
- [x] Monitor flutuante
- [x] Session management (export/import JSON, backup)
- [x] Fullscreen
- [x] Timeline/Clips

### Sistema de Convidados
- [x] 12 salas de convidados
- [x] Página `guest.html` para celular
- [x] Links verdes via WhatsApp
- [x] Janela flutuante de recepção
- [x] Aceitar/recusar convidado
- [x] Drag & drop da janela flutuante
- [x] Convidado → camada na cena

### Projeção
- [x] Janela secundária (`projecao.html`)
- [x] Espelhamento do canvas
- [x] Centralização automática
- [x] Auto-fullscreen
- [x] Anti-flicker
- [x] Captura de vídeo (dataURL fallback)

---

## Bugs Corrigidos

| Bug | Solução |
|-----|---------|
| `initAudioMixer()` não existia | Renomeado para `initMixer()` |
| `startStatsSimulation()` não existia | Renomeado para `startStatsSim()` |
| CSS vars faltando (`--gold`, `--bg1`, `--purple`) | Adicionadas no `:root` |
| Projeção com DataCloneError | Fallback para `toDataURL()` |
| Projeção cortada | `fit()` corrigido |
| Flicker na projeção | Anti-flicker por layer |
| Código duplicado em `syncProjection` | Removido |
| Vídeo não aparecia nas camadas | Criar `<video>` novo + `play()` |
| Tela preta no init | Corrigidos nomes de funções |

---

## Tecnologias

| Tecnologia | Uso |
|------------|-----|
| HTML5 | Estrutura |
| CSS3 (Custom Properties) | Estilos dark broadcast |
| JavaScript (ES6+) | Lógica |
| WebRTC (`getUserMedia`) | Câmera e microfone |
| Canvas API | Renderização de camadas |
| localStorage | Backup e comunicação guest↔studio |
| postMessage | Comunicação entre janelas |
| Fullscreen API | Tela cheia |
| Font Awesome 6 | Ícones |

---

## Como Usar

### 1. Iniciar Servidor
```bash
node server.js
```

### 2. Abrir Estúdio
```
http://127.0.0.1:8080/meustudio.html
```

### 3. Convidado Acessa
```
http://127.0.0.1:8080/guest.html?room=sala-01
```

### 4. Projeção
- Clique botão **PROJETAR** no estúdio
- Abre `projecao.html` em nova janela

---

## Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+Shift+L` | Go Live |
| `Ctrl+Shift+R` | Gravar |
| `Ctrl+Shift+C` | Clip |
| `Ctrl+Shift+M` | Mutar tudo |
| `Enter` | Cut |
| `Shift+Enter` | Fade |
| `[` / `]` | Zoom monitor |

---

## Notas de Desenvolvimento

### Convenções
- CSS variables prefixadas com `--`
- Funções globais expostas via `window.functionName`
- Estado centralizado em objeto `state`
- Camadas renderizadas via `renderLayerContent()`

### Debug
- `console.log` em pontos chave
- `window.onerror` mostra erro na tela
- Info overlay na projeção mostra stats

### Performance
- VU meters: 60fps (setInterval 60ms)
- Stats: 1fps (setInterval 1000ms)
- Projeção: 10fps (setInterval 100ms)
- FPS counter: simulado

---

## Histórico Completo

| Data | Mudança |
|------|---------|
| Original | Projeto RCT CALL + MeuStudio base |
| 2026-05-19 | Corrigido init (nomes de funções) |
| 2026-05-19 | Corrigido CSS vars faltando |
| 2026-05-19 | Criado `server.js` |
| 2026-05-19 | Criado `projecao.html` |
| 2026-05-19 | Corrigido `syncProjection()` |
| 2026-05-19 | Corrigido anti-flicker |
| 2026-05-19 | Corrigido código duplicado |
| 2026-05-19 | Adicionado debug overlay |
| 2026-05-19 | Criado sistema de convidados |
| 2026-05-19 | Criado `guest.html` |
| 2026-05-19 | Implementado link WhatsApp |
| 2026-05-19 | Janela flutuante de recepção |
