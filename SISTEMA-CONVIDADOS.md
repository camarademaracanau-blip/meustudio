# SISTEMA DE CONVIDADOS - DOCUMENTAÇÃO COMPLETA

## Visão Geral

Sistema de recepção de convidados via celular/câmera remota para transmissões ao vivo. Inspirado no vMix Call / VDO.Ninja.

---

## Arquitetura

```
┌─────────────────────────────────────┐                    ┌──────────────────────┐
│  meustudio.html (estúdio)           │                    │  guest.html          │
│                                     │                    │  (celular/convidado) │
│  ┌─────────────────────────────┐    │                    │                      │
│  │ Painel Convidados (12 salas)│    │                    │  ┌────────────────┐  │
│  │ Sala 1  [🟡 Aguardando]     │    │  localStorage      │  │  📹 Câmera     │  │
│  │ Sala 2  [🟢 Conectado]      │◄───┼───────────────────│  │  🎤 Microfone  │  │
│  │ Sala 3  [⚪ Vazia]    [📱]  │    │  postMessage       │  │  Nome          │  │
│  │ ...                         │    │                    │  └────────────────┘  │
│  └─────────────────────────────┘    │                    │                      │
│                                     │                    │  WebRTC (getUserMedia)
│  ┌─────────────────────────────┐    │                    └──────────────────────┘
│  │ Janela Flutuante            │    │
│  │ ┌───────────────────────┐   │    │
│  │ │  📹 Vídeo do convidado│   │    │
│  │ │  [✓] [✗] [-]          │   │    │
│  │ └───────────────────────┘   │    │
│  └─────────────────────────────┘    │
│                                     │
│  Ao aceitar → camada na cena        │
└─────────────────────────────────────┘
```

---

## Fluxo de Uso

### 1. Gerar Link
- Clique no botão **👤+** (Novo Convidado) no painel
- OU clique no ícone **WhatsApp** [📱] de uma sala vazia
- Link é copiado automaticamente
- WhatsApp abre com mensagem pré-formatada

### 2. Convidado Acessa
- Abre link no celular: `http://servidor/guest.html?room=sala-01`
- Digita nome
- Clica "Entrar na Sala"
- Permite câmera e microfone

### 3. Recepção
- Janela flutuante aparece no estúdio com vídeo do convidado
- Status: "Aguardando..."
- Diretor pode:
  - **✓ Aceitar** → convidado vira camada na cena
  - **✗ Recusar** → convidado é desconectado
  - **- Fechar** → esconde janela (convidado continua aguardando)

### 4. Na Cena
- Convidado aceito → nova camada "Video Device" adicionada
- Nome = nome do convidado
- Stream = stream WebRTC do convidado
- Pode ser arrastado, redimensionado, etc.

---

## 12 Salas

| Sala | Nome Padrão | Uso Sugerido |
|------|-------------|--------------|
| Sala 1 | Entrevista | Convidado principal |
| Sala 2 | Reportagem | Repórter externo |
| Sala 3 | Ao Vivo | Campo ao vivo |
| Sala 4 | Estúdio A | Convidado estúdio |
| Sala 5 | Estúdio B | Segundo convidado |
| Sala 6 | Externa | Câmera externa |
| Sala 7 | Remote 1 | Remoto 1 |
| Sala 8 | Remote 2 | Remoto 2 |
| Sala 9 | Remote 3 | Remoto 3 |
| Sala 10 | Backup | Reserva |
| Sala 11 | Reserva | Reserva |
| Sala 12 | BRB Group | Grupo BRB |

---

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `guest.html` | Página do convidado (câmera + nome + controles) |
| `meustudio.html` | Painel de convidados + janela flutuante |
| `meustudio.js` | Lógica de gestão (initGuestRooms, openGuestFloat, acceptGuest, etc.) |
| `meustudio.css` | Estilos das salas e janela flutuante |
| `server.js` | Servidor HTTP local |

---

## Funções JavaScript

| Função | Descrição |
|--------|-----------|
| `initGuestRooms()` | Inicializa as 12 salas no painel |
| `handleGuestConnection(roomId, data)` | Recebe conexão de convidado |
| `updateGuestRoomUI(roomId)` | Atualiza visual da sala |
| `shareGuestLink(idx)` | Gera link + abre WhatsApp |
| `addNewGuest()` | Encontra sala vazia e gera link |
| `removeGuest(idx)` | Remove convidado da sala |
| `openGuestFloat(roomId)` | Abre janela flutuante de recepção |
| `closeGuestFloat()` | Fecha janela flutuante |
| `acceptGuest()` | Aceita convidado → camada na cena |
| `rejectGuest()` | Recusa convidado |

---

## Comunicação

### localStorage (mesma origem)
```javascript
// Guest → Studio
localStorage.setItem('guest-sala-01', JSON.stringify({
  type: 'guest-connected',
  roomId: 'sala-01',
  guestName: 'João',
  timestamp: Date.now(),
  status: 'waiting'
}));

// Studio → Guest
localStorage.setItem('guest-action-sala-01', JSON.stringify({
  type: 'director-action',
  action: 'accept', // 'reject' | 'cut'
  timestamp: Date.now()
}));
```

### postMessage (janelas)
```javascript
// Guest → Studio (window.opener)
window.opener.postMessage({
  type: 'guest-connected',
  roomId: 'sala-01',
  guestName: 'João'
}, '*');

// Studio → Guest
guestWindow.postMessage({
  type: 'director-action',
  action: 'accept'
}, '*');
```

---

## Limitações Atuais

| Limitação | Solução Futura |
|-----------|----------------|
| localStorage só funciona na mesma origem | Servidor WebSocket/Signaling |
| Sem WebRTC real (P2P) | Implementar signaling server |
| Vídeo na janela flutuante usa câmera local (simulação) | Stream real do convidado via WebRTC |
| Sem áudio na projeção | WebRTC audio track |
| Máximo 12 salas | Dinâmico com backend |

---

## Melhorias Futuras

### 1. WebRTC Signaling Server (Node.js)
```javascript
// Servidor WebSocket para signaling
const io = require('socket.io')(server);
io.on('connection', socket => {
  socket.on('offer', data => socket.to(data.room).emit('offer', data));
  socket.on('answer', data => socket.to(data.room).emit('answer', data));
  socket.on('ice-candidate', data => socket.to(data.room).emit('ice-candidate', data));
});
```

### 2. Múltiplos Convidados na Cena
- Cada sala conectada pode ser adicionada como camada
- Layout automático (grid, spotlight, etc.)

### 3. Controles do Diretor
- Mutar áudio do convidado remotamente
- Desligar câmera do convidado remotamente
- Colocar convidado em fullscreen
- Mover convidado entre salas

### 4. Gravação Individual
- Gravar stream de cada convidado separadamente
- Útil para edição posterior

### 5. Chat por Sala
- Chat texto entre diretor e convidado
- Instruções pré-transmissão

---

## Histórico

| Data | Mudança |
|------|---------|
| 2026-05-19 | Criado sistema de convidados com 12 salas |
| 2026-05-19 | Criado `guest.html` para acesso via celular |
| 2026-05-19 | Implementado link WhatsApp com mensagem pré-formatada |
| 2026-05-19 | Janela flutuante de recepção com drag & drop |
| 2026-05-19 | Aceitar/Recusar convidado → camada na cena |
