// UI interactions

function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
}

function switchTab(tab) {
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const tabs = document.querySelectorAll('.auth-tab');
    
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'signin') {
        signinForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        tabs[0].classList.add('active');
    } else {
        signinForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        tabs[1].classList.add('active');
    }
}

function updateAuthStatus(message, type = '') {
    const status = document.getElementById('authStatus');
    status.textContent = message;
    status.className = 'status ' + type;
}

function updateStatus(message, type = '') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

async function loadUserData() {
    if (!currentUser) return;

    document.getElementById('userEmail').textContent = currentUser.email;

    await loadUserChats();

    const settings = await loadUserSettings();
    if (settings) {
        if (settings.model) document.getElementById('modelSelect').value = settings.model;
        if (settings.provider) document.getElementById('providerSelect').value = settings.provider;
    }
}

async function loadUserChats() {
    const chats = await loadChats();
    const historyList = document.getElementById('historyList');
    
    if (chats.length === 0) {
        historyList.innerHTML = '<p class="empty-state">no chats yet</p>';
        return;
    }

    historyList.innerHTML = '';
    
    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item';
        if (chat.id === currentChatId) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="history-item-title">${chat.title}</div>
            <div class="history-item-preview">${new Date(chat.updated_at).toLocaleDateString()}</div>
        `;
        
        item.onclick = () => loadChat(chat.id, chat.title);
        
        historyList.appendChild(item);
    });
}

async function loadChat(chatId, title) {
    currentChatId = chatId;
    
    document.getElementById('chatTitle').textContent = title;
    document.getElementById('chatSubtitle').textContent = 'loading messages...';
    
    await loadChatMessages(chatId);
    
    document.getElementById('chatSubtitle').textContent = `${chatMessages.length} messages`;
    
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.history-item')?.classList.add('active');
}

async function newChat() {
    currentChatId = null;
    chatMessages = [];
    
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">🤖</div>
            <h2>new chat started</h2>
            <p>what can i help you with?</p>
        </div>
    `;
    
    document.getElementById('chatTitle').textContent = 'new chat';
    document.getElementById('chatSubtitle').textContent = 'start a conversation';
    
    document.querySelectorAll('.history-item').forEach(item => {
        item.classList.remove('active');
    });
    
    updateStatus('new chat created', 'success');
}

async function deleteCurrentChat() {
    if (!currentChatId) return;
    
    if (!confirm('delete this chat? this cannot be undone.')) return;
    
    const success = await deleteChat(currentChatId);
    
    if (success) {
        updateStatus('chat deleted', 'success');
        await newChat();
        await loadUserChats();
    } else {
        updateStatus('failed to delete chat', 'error');
    }
}

function updateChatTitle(title) {
    document.getElementById('chatTitle').textContent = title;
    
    if (currentChatId) {
        updateChatTitle(currentChatId, title);
    }
}

async function exportAllChats() {
    const chats = await loadChats();
    
    const exportData = [];
    
    for (const chat of chats) {
        const messages = await loadMessages(chat.id);
        exportData.push({
            ...chat,
            messages
        });
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-assistant-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    updateStatus('chats exported', 'success');
}

// file handling ui
function renderAttachedFiles() {
    const attachedFilesDiv = document.getElementById('attachedFiles');
    attachedFilesDiv.innerHTML = '';
    
    attachedFiles.forEach((file, index) => {
        const fileEl = document.createElement('div');
        fileEl.className = 'attached-file';
        fileEl.innerHTML = `
            <span>📎 ${file.name}</span>
            <button onclick="removeFile(${index})">×</button>
        `;
        attachedFilesDiv.appendChild(fileEl);
    });
}

function removeFile(index) {
    attachedFiles.splice(index, 1);
    renderAttachedFiles();
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    await handleSendMessage();
}