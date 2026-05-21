// ============================================
// RCT CALL - BROADCAST CONTROL ROOM
// Script de Controle Profissional
// ============================================

// FUNÇÕES GLOBAIS - ACESSÍVEIS VIA ONCLICK NO HTML
window.testarCamera = function() {
    navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
    })
    .then(function(stream) {
        // Program Output (16:9) - 1920x1080
        var video = document.getElementById('program-video');
        if (video) {
            video.srcObject = stream;
            video.play();
            
            var placeholder = document.getElementById('program-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
        }
        
        // Vertical Output (9:16) - 1080x1920 - DUPLICAR IMAGEM
        var videoVertical = document.getElementById('instagram-video');
        if (videoVertical) {
            videoVertical.srcObject = stream;
            videoVertical.play();
            
            var placeholderVertical = videoVertical.parentElement.querySelector('.placeholder');
            if (placeholderVertical) {
                placeholderVertical.style.display = 'none';
            }
        }
        
        alert('Câmera conectada nas duas saídas!');
    })
    .catch(function(err) {
        alert('ERRO: ' + err.message);
    });
};

window.conectarCamera = function(item, sourceName) {
    navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
    })
    .then(function(stream) {
        // Program Output (16:9)
        var video = document.getElementById('program-video');
        if (video) {
            video.srcObject = stream;
            video.play();
            
            var placeholder = document.getElementById('program-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
        }
        
        // Vertical Output (9:16) - DUPLICADO
        var videoVertical = document.getElementById('instagram-video');
        if (videoVertical) {
            videoVertical.srcObject = stream;
            videoVertical.play();
            
            var placeholderVertical = videoVertical.parentElement.querySelector('.placeholder');
            if (placeholderVertical) {
                placeholderVertical.style.display = 'none';
            }
        }
        
        // Update UI
        var allItems = document.querySelectorAll('.preview-item');
        allItems.forEach(function(i) {
            i.classList.remove('active');
            i.classList.remove('connected');
        });
        item.classList.add('active');
        item.classList.add('connected');
        
        alert(sourceName + ' conectado! (16:9 + 9:16)');
    })
    .catch(function(err) {
        alert('Erro: ' + err.message);
    });
};

window.compartilharTela = function(item) {
    navigator.mediaDevices.getDisplayMedia({ 
        video: true, 
        audio: true 
    })
    .then(function(stream) {
        // Program Output (16:9)
        var video = document.getElementById('program-video');
        if (video) {
            video.srcObject = stream;
            video.play();
            
            var placeholder = document.getElementById('program-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
        }
        
        // Vertical Output (9:16) - DUPLICADO
        var videoVertical = document.getElementById('instagram-video');
        if (videoVertical) {
            videoVertical.srcObject = stream;
            videoVertical.play();
            
            var placeholderVertical = videoVertical.parentElement.querySelector('.placeholder');
            if (placeholderVertical) {
                placeholderVertical.style.display = 'none';
            }
        }
        
        item.classList.add('active');
        item.classList.add('connected');
        
        alert('Tela compartilhada! (16:9 + 9:16)');
        
        stream.getVideoTracks()[0].onended = function() {
            alert('Compartilhamento encerrado');
            item.classList.remove('connected');
        };
    })
    .catch(function(err) {
        alert('Erro: ' + err.message);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // STATE
    // ============================================
    const state = {
        isStreaming: false,
        isRecording: false,
        isOBSConnected: false,
        streamStartTime: null,
        calls: [],
        mediaStream: null
    };

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const elements = {
        // Menu
        systemTime: document.getElementById('system-time'),
        obsConnection: document.getElementById('obs-connection'),
        
        // Program Output
        programOutput: document.getElementById('program-output'),
        programVideo: document.getElementById('program-video'),
        programPlaceholder: document.getElementById('program-placeholder'),
        programStatus: document.getElementById('program-status'),
        programDuration: document.getElementById('program-duration'),
        
        // Vertical Output
        instagramOutput: document.getElementById('instagram-output'),
        instagramVideo: document.getElementById('instagram-video'),
        verticalStatus: document.getElementById('vertical-status'),
        verticalDuration: document.getElementById('vertical-duration'),
        
        // Stream controls
        startStreamBtn: document.getElementById('start-stream'),
        stopStreamBtn: document.getElementById('stop-stream'),
        restartStreamBtn: document.getElementById('restart-stream'),
        startVerticalBtn: document.getElementById('start-vertical'),
        stopVerticalBtn: document.getElementById('stop-vertical'),
        
        // Preview
        previewBus: document.getElementById('preview-bus'),
        
        // Mixer
        mixerChannels: document.querySelectorAll('.mixer-channel'),
        
        // Calls
        callList: document.getElementById('call-list'),
        newCallBtn: document.getElementById('new-call-btn'),
        
        // Status bar
        cpuUsage: document.getElementById('cpu-usage'),
        gpuUsage: document.getElementById('gpu-usage'),
        latency: document.getElementById('latency'),
        bitrate: document.getElementById('bitrate'),
        obsStatusBar: document.getElementById('obs-status-bar'),
        recordingStatus: document.getElementById('recording-status'),
        networkStatus: document.getElementById('network-status'),
        
        // Director controls
        btnCut: document.getElementById('btn-cut'),
        btnFade: document.getElementById('btn-fade'),
        btnTransition: document.getElementById('btn-transition'),
        btnFullscreen: document.getElementById('btn-fullscreen'),
        btnMuteAll: document.getElementById('btn-mute-all'),
        btnRecord: document.getElementById('btn-record'),
        
        // Modals
        obsModal: document.getElementById('obs-modal'),
        webrtcModal: document.getElementById('webrtc-modal'),
        scenesModal: document.getElementById('scenes-modal')
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        updateSystemTime();
        setInterval(updateSystemTime, 1000);
        
        initializeAudioMeters();
        initializePreviewBus();
        generateTestCalls();
        setupEventListeners();
        startStatsSimulation();
        
        // Update OBS status
        updateOBSStatus(false);
    }

    // ============================================
    // SYSTEM TIME
    // ============================================
    function updateSystemTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        elements.systemTime.textContent = timeStr;
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    function setupEventListeners() {
        // Stream controls
        elements.startStreamBtn.addEventListener('click', startStream);
        elements.stopStreamBtn.addEventListener('click', stopStream);
        elements.restartStreamBtn.addEventListener('click', restartStream);
        elements.startVerticalBtn.addEventListener('click', startVertical);
        elements.stopVerticalBtn.addEventListener('click', stopVertical);
        
        // Preview bus
        document.querySelectorAll('.preview-item').forEach(item => {
            item.addEventListener('click', () => selectPreviewSource(item));
        });
        
        // Calls
        elements.newCallBtn.addEventListener('click', simulateIncomingCall);
        
        // Audio mixer
        document.querySelectorAll('.channel-fader input').forEach(fader => {
            fader.addEventListener('input', handleFaderChange);
        });
        
        document.querySelectorAll('.btn-mute').forEach(btn => {
            btn.addEventListener('click', () => toggleMute(btn));
        });
        
        // Director controls
        elements.btnCut.addEventListener('click', () => performTransition('cut'));
        elements.btnFade.addEventListener('click', () => performTransition('fade'));
        elements.btnTransition.addEventListener('click', () => performTransition('auto'));
        elements.btnFullscreen.addEventListener('click', toggleFullscreen);
        elements.btnMuteAll.addEventListener('click', toggleMuteAll);
        elements.btnRecord.addEventListener('click', toggleRecording);
        
        // Menu buttons
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => handleMenuClick(btn));
        });
        
        // OBS Modal
        document.getElementById('connect-obs-btn').addEventListener('click', connectOBS);
        
        // WebRTC Modal
        document.getElementById('apply-webrtc-btn').addEventListener('click', applyWebRTC);
        document.getElementById('share-screen-btn').addEventListener('click', shareScreen);
        
        // Destination toggles
        document.querySelectorAll('.btn-dest-toggle').forEach(btn => {
            btn.addEventListener('click', () => toggleDestination(btn));
        });
    }

    // ============================================
    // STREAMING
    // ============================================
    function startStream() {
        state.isStreaming = true;
        state.streamStartTime = Date.now();
        
        elements.startStreamBtn.disabled = true;
        elements.stopStreamBtn.disabled = false;
        
        updateStreamStatus('program', true);
        
        elements.programPlaceholder.style.display = 'none';
        
        showNotification('Transmissão iniciada', 'success');
        startStreamTimer();
    }

    function stopStream() {
        state.isStreaming = false;
        state.streamStartTime = null;
        
        elements.startStreamBtn.disabled = false;
        elements.stopStreamBtn.disabled = true;
        
        updateStreamStatus('program', false);
        
        elements.programPlaceholder.style.display = 'flex';
        
        showNotification('Transmissão parada', 'warning');
    }

    function restartStream() {
        stopStream();
        setTimeout(startStream, 500);
    }

    function startVertical() {
        showNotification('Vertical transmission started', 'success');
    }

    function stopVertical() {
        showNotification('Vertical transmission stopped', 'warning');
    }

    function updateStreamStatus(output, isLive) {
        const statusEl = output === 'program' ? elements.programStatus : elements.verticalStatus;
        
        if (isLive) {
            statusEl.classList.add('live');
            statusEl.innerHTML = '<span class="live-dot"></span> AO VIVO';
        } else {
            statusEl.classList.remove('live');
            statusEl.innerHTML = '<span class="live-dot"></span> OFFLINE';
        }
    }

    function startStreamTimer() {
        const updateTimer = () => {
            if (!state.isStreaming || !state.streamStartTime) return;
            
            const elapsed = Date.now() - state.streamStartTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timeStr = [hours, minutes, seconds]
                .map(t => t.toString().padStart(2, '0'))
                .join(':');
            
            elements.programDuration.textContent = timeStr;
            elements.verticalDuration.textContent = timeStr;
            
            requestAnimationFrame(updateTimer);
        };
        
        requestAnimationFrame(updateTimer);
    }

    // ============================================
    // AUDIO MIXER
    // ============================================
    function initializeAudioMeters() {
        const channels = ['mic1', 'mic2', 'guest1', 'guest2', 'music', 'master'];
        
        setInterval(() => {
            channels.forEach(channel => {
                const channelEl = document.querySelector(`[data-channel="${channel}"]`);
                if (!channelEl) return;
                
                const vuFill = channelEl.querySelector('.vu-fill');
                if (!vuFill) return;
                
                // Generate random level
                let level = Math.random() * 100;
                
                if (channel === 'master') {
                    level = state.isStreaming ? 50 + Math.random() * 40 : 20 + Math.random() * 30;
                } else if (channel.includes('mic')) {
                    level = 30 + Math.random() * 50;
                } else if (channel.includes('guest')) {
                    level = 20 + Math.random() * 60;
                } else {
                    level = 10 + Math.random() * 40;
                }
                
                vuFill.style.height = level + '%';
                
                // Color based on level
                if (level > 85) {
                    vuFill.style.background = 'linear-gradient(to top, #ff0000, #ff0000)';
                } else if (level > 70) {
                    vuFill.style.background = 'linear-gradient(to top, #ffcc00, #ff0000)';
                } else {
                    vuFill.style.background = 'linear-gradient(to top, #00ff00, #ffcc00)';
                }
            });
            
            // Preview VU bars
            document.querySelectorAll('.preview-vu .vu-bar').forEach(bar => {
                bar.style.width = (Math.random() * 80 + 10) + '%';
            });
        }, 50);
    }

    function handleFaderChange(e) {
        const channel = e.target.closest('.mixer-channel');
        const channelName = channel.dataset.channel;
        const value = e.target.value;
        
        showNotification(`${channelName.toUpperCase()}: ${value} dB`, 'info');
    }

    function toggleMute(btn) {
        btn.classList.toggle('muted');
        const isMuted = btn.classList.contains('muted');
        
        if (isMuted) {
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
            btn.style.color = 'var(--danger)';
        } else {
            btn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            btn.style.color = '';
        }
    }

    // ============================================
    // PREVIEW BUS
    // ============================================
    function initializePreviewBus() {
        // Set first item as active by default
        const firstItem = document.querySelector('.preview-item');
        if (firstItem) {
            firstItem.classList.add('active');
        }
        
        // Add click to connect camera
        document.querySelectorAll('.preview-item').forEach(item => {
            item.addEventListener('dblclick', () => connectCamera(item));
        });
    }
    
    async function connectCamera(item) {
        const sourceName = item.querySelector('.preview-label').textContent;
        
        try {
            showNotification(`Conectando ${sourceName}...`, 'info');
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1920, height: 1080, facingMode: 'user' },
                audio: true
            });
            
            state.mediaStream = stream;
            elements.programVideo.srcObject = stream;
            elements.programVideo.play();
            
            elements.programPlaceholder.style.display = 'none';
            
            // Update preview item
            document.querySelectorAll('.preview-item').forEach(i => {
                i.classList.remove('active');
            });
            item.classList.add('active');
            
            showNotification(`${sourceName} conectado com sucesso!`, 'success');
            
        } catch (err) {
            showNotification(`Erro ao conectar ${sourceName}: ${err.message}`, 'error');
            console.error('Camera error:', err);
        }
    }

    function selectPreviewSource(item) {
        document.querySelectorAll('.preview-item').forEach(i => {
            i.classList.remove('active');
        });
        item.classList.add('active');
        
        const sourceName = item.querySelector('.preview-label').textContent;
        showNotification(`Preview: ${sourceName}`, 'info');
    }

    // ============================================
    // TRANSITIONS
    // ============================================
    function performTransition(type) {
        let duration = 500;
        
        if (type === 'cut') {
            elements.programOutput.style.transition = 'none';
            showNotification('Corte executado', 'success');
        } else if (type === 'fade') {
            elements.programOutput.style.transition = `all ${duration}ms ease`;
            elements.programOutput.style.opacity = '0';
            setTimeout(() => {
                elements.programOutput.style.opacity = '1';
            }, duration / 2);
            showNotification('Fade executado', 'success');
        } else if (type === 'auto') {
            showNotification('Transição automática: 1s', 'info');
        }
        
        // Visual feedback
        elements.programOutput.style.border = '2px solid var(--primary-red)';
        setTimeout(() => {
            elements.programOutput.style.border = 'none';
        }, 300);
    }

    // ============================================
    // CALLS
    // ============================================
    function generateTestCalls() {
        setTimeout(() => {
            // First call already in HTML
        }, 2000);
    }

    function simulateIncomingCall() {
        const callId = 'call_' + Date.now();
        const names = ['Maria_Silva', 'João_Pedro', 'Reporter_News', 'Entrevistado_01', 'Convidado_VIP'];
        const devices = [
            { icon: 'fab fa-android', name: 'Android' },
            { icon: 'fab fa-apple', name: 'iPhone' },
            { icon: 'fab fa-chrome', name: 'Browser' },
            { icon: 'fab fa-windows', name: 'Windows' }
        ];
        
        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomDevice = devices[Math.floor(Math.random() * devices.length)];
        
        const callRow = document.createElement('div');
        callRow.className = 'call-row waiting';
        callRow.dataset.call = callId;
        
        callRow.innerHTML = `
            <div class="call-user">
                <i class="fas fa-user-circle"></i>
                <span class="username">${randomName}</span>
            </div>
            <div class="call-device">
                <i class="${randomDevice.icon}"></i> ${randomDevice.name}
            </div>
            <div class="call-status waiting">AGUARDANDO</div>
            <div class="call-signal">
                <div class="signal-bar" style="width: ${20 + Math.random() * 60}%"></div>
            </div>
            <div class="call-actions-row">
                <button class="btn-action accept" onclick="acceptCall('${callId}')">
                    <i class="fas fa-phone"></i>
                </button>
                <button class="btn-action reject" onclick="rejectCall('${callId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        elements.callList.appendChild(callRow);
        showNotification(`Nova chamada: ${randomName}`, 'info');
    }

    window.acceptCall = function(callId) {
        const row = document.querySelector(`[data-call="${callId}"]`);
        if (row) {
            row.classList.remove('waiting');
            row.querySelector('.call-status').className = 'call-status online';
            row.querySelector('.call-status').textContent = 'ONLINE';
            
            showNotification('Chamada aceita', 'success');
        }
    };

    window.rejectCall = function(callId) {
        const row = document.querySelector(`[data-call="${callId}"]`);
        if (row) {
            row.remove();
            showNotification('Chamada rejeitada', 'warning');
        }
    };

    window.cutCall = function(callId) {
        showNotification('Call cut from program', 'warning');
    };

    window.muteCall = function(callId) {
        showNotification('Guest muted', 'info');
    };

    window.fullscreenCall = function(callId) {
        toggleFullscreen();
        showNotification('Guest on fullscreen', 'info');
    };

    // ============================================
    // DIRECTOR CONTROLS
    // ============================================
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    function toggleMuteAll() {
        const btn = elements.btnMuteAll;
        btn.classList.toggle('muted');
        
        if (btn.classList.contains('muted')) {
            btn.style.background = 'var(--danger)';
            showNotification('Todos os áudios mutados', 'warning');
        } else {
            btn.style.background = '';
            showNotification('Áudios ativados', 'success');
        }
    }

    function toggleRecording() {
        state.isRecording = !state.isRecording;
        const btn = elements.btnRecord;
        
        btn.classList.toggle('recording');
        
        if (state.isRecording) {
            elements.recordingStatus.style.display = 'flex';
            showNotification('Gravação iniciada', 'warning');
        } else {
            elements.recordingStatus.style.display = 'none';
            showNotification('Gravação finalizada', 'success');
        }
    }

    // ============================================
    // OBS CONNECTION
    // ============================================
    function connectOBS() {
        const address = document.getElementById('obs-address').value;
        const password = document.getElementById('obs-password').value;
        
        showNotification('Conectando ao OBS...', 'info');
        
        setTimeout(() => {
            state.isOBSConnected = true;
            updateOBSStatus(true);
            closeModal('obs-modal');
            showNotification('OBS conectado com sucesso!', 'success');
        }, 1500);
    }

    function updateOBSStatus(connected) {
        elements.obsConnection.classList.toggle('connected', connected);
        elements.obsConnection.innerHTML = `
            <span class="status-dot"></span> ${connected ? 'OBS' : 'OBS'}
        `;
        
        elements.obsStatusBar.classList.toggle('connected', connected);
    }

    // ============================================
    // WEBRTC
    // ============================================
    async function initializeWebRTCSources() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            const cameraSelect = document.getElementById('camera-select');
            const micSelect = document.getElementById('mic-select');
            
            cameraSelect.innerHTML = '<option value="">Selecionar câmera</option>';
            micSelect.innerHTML = '<option value="">Selecionar microfone</option>';
            
            devices.forEach(device => {
                if (device.kind === 'videoinput') {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Câmera ${cameraSelect.options.length}`;
                    cameraSelect.appendChild(option);
                } else if (device.kind === 'audioinput') {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Microfone ${micSelect.options.length}`;
                    micSelect.appendChild(option);
                }
            });
        } catch (err) {
            console.error('Error:', err);
        }
    }

    async function applyWebRTC() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            
            state.mediaStream = stream;
            elements.programVideo.srcObject = stream;
            elements.programVideo.play();
            
            elements.programPlaceholder.style.display = 'none';
            closeModal('webrtc-modal');
            showNotification('WebRTC conectado', 'success');
            
        } catch (err) {
            showNotification('Erro: ' + err.message, 'error');
        }
    }

    async function shareScreen() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            
            state.mediaStream = stream;
            elements.programVideo.srcObject = stream;
            elements.programVideo.play();
            
            elements.programPlaceholder.style.display = 'none';
            showNotification('Tela compartilhada', 'success');
            
            stream.getVideoTracks()[0].onended = () => {
                showNotification('Compartilhamento encerrado', 'info');
            };
            
        } catch (err) {
            showNotification('Erro ao compartilhar', 'error');
        }
    }

    // ============================================
    // DESTINATIONS
    // ============================================
    function toggleDestination(btn) {
        btn.classList.toggle('active');
        const isActive = btn.classList.contains('active');
        
        if (isActive) {
            btn.innerHTML = '<i class="fas fa-toggle-on"></i>';
            btn.closest('.destination').classList.add('active');
        } else {
            btn.innerHTML = '<i class="fas fa-toggle-off"></i>';
            btn.closest('.destination').classList.remove('active');
        }
    }

    // ============================================
    // MENU HANDLERS
    // ============================================
    function handleMenuClick(btn) {
        const menu = btn.dataset.menu;
        
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        switch(menu) {
            case 'menu':
                showNotification('Menu principal', 'info');
                break;
            case 'audio':
                showNotification('Configurações de áudio', 'info');
                break;
            case 'calls':
                showNotification('Gerenciamento de chamadas', 'info');
                break;
            case 'overlays':
                showNotification('Overlays e grafismos', 'info');
                break;
            case 'stream':
                showNotification('Configurações de stream', 'info');
                break;
            case 'rec':
                toggleRecording();
                break;
            case 'multiview':
                showNotification('Multiview configurado', 'info');
                break;
            case 'settings':
                showNotification('Configurações gerais', 'info');
                break;
            case 'network':
                showNotification('Status de rede', 'info');
                break;
            case 'director':
                showNotification('Modo diretor', 'info');
                break;
        }
    }

    // ============================================
    // STATS SIMULATION
    // ============================================
    function startStatsSimulation() {
        setInterval(() => {
            // CPU
            const cpu = 25 + Math.floor(Math.random() * 20);
            elements.cpuUsage.textContent = cpu + '%';
            
            // GPU
            const gpu = 35 + Math.floor(Math.random() * 20);
            elements.gpuUsage.textContent = gpu + '%';
            
            // Latency
            const lat = 30 + Math.floor(Math.random() * 20);
            elements.latency.textContent = lat + 'ms';
            
            // Bitrate
            const bit = state.isStreaming ? 7000 + Math.floor(Math.random() * 3000) : 0;
            elements.bitrate.textContent = bit + 'kbps';
            
            // Network
            const net = 40 + Math.floor(Math.random() * 20);
            elements.networkStatus.textContent = `WIFI: ${net}ms`;
            
        }, 1000);
    }

    // ============================================
    // MODALS
    // ============================================
    window.closeModal = function(modalId) {
        document.getElementById(modalId).classList.remove('active');
    };

    // Open WebRTC modal on camera icon click
    document.querySelector('.preview-item[data-source="cam01"]').addEventListener('dblclick', () => {
        initializeWebRTCSources();
        elements.webrtcModal.classList.add('active');
    });

    // Open OBS modal from menu bar
    elements.obsConnection.addEventListener('click', () => {
        elements.obsModal.classList.add('active');
    });

    // ============================================
    // NOTIFICATIONS
    // ============================================
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `<i class="fas fa-${getIcon(type)}"></i> ${message}`;
        
        document.body.appendChild(notification);
        
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }

    function getIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // ============================================
    // INIT
    // ============================================
    init();
});