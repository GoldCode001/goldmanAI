import { getApiEndpoint } from './supabase.js';
import { createChat, saveMessage } from './database.js';
import { updateStatus } from '../components/ui.js';

let currentChatId = null;
let chatMessages = [];
let attachedFiles = [];

export async function sendAIMessage(text, files = []) {
    const endpoint = getApiEndpoint();
    const model = document.getElementById('modelSelect').value;
    const provider = document.getElementById('providerSelect').value;

    try {
        updateStatus('sending...', 'loading');

        let fullPrompt = text;
        if (files.length > 0) {
            fullPrompt += '\n\nAttached files:\n';
            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    fullPrompt += `\n${file.name}:\n${file.data.substring(0, 8000)}\n`;
                } else {
                    fullPrompt += `\n[Image: ${file.name}]`;
                }
            }
        }

        const response = await fetch(`${endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                provider,
                messages: [
                    { role: 'user', content: fullPrompt }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err);
        }

        const data = await response.json();

        updateStatus('ready', 'success');

        return data.choices?.[0]?.message?.content || 'no response';

    } catch (error) {
        updateStatus('error: ' + error.message, 'error');
        throw error;
    }
}


export async function handleSendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text && attachedFiles.length === 0) return;
    // check if we have a chat
    if (!currentChatId) {
        const chat = await createChat(text.substring(0, 50));
        if (chat) {
            currentChatId = chat.id;
            updateChatTitle(text.substring(0, 50));
        }
    }

    // prepare file data
    const fileData = [];
    for (const file of attachedFiles) {
        const data = await readFile(file);
        fileData.push({
            name: file.name,
            type: file.type,
            size: file.size,
            data: data
        });
    }

    // add user message to ui
    addMessageToUI(text, 'user', fileData);
    
    // save to database
    if (currentChatId) {
        await saveMessage(currentChatId, 'user', text, fileData);
    }

    // clear input
    input.value = '';
    input.style.height = 'auto';
    attachedFiles = [];
    renderAttachedFiles();

    // show loading
    const loadingId = showLoading();

    try {
        // get ai response
        const response = await sendAIMessage(text, fileData);
        
        // remove loading
        removeLoading(loadingId);
        
        // add assistant message
        addMessageToUI(response, 'assistant');
        
        // save to database
        if (currentChatId) {
            await saveMessage(currentChatId, 'assistant', response);
        }

        // update chat title if first message
        if (chatMessages.length === 2) {
            await updateChatTitle(text.substring(0, 50));
        }

        // reload chat list
        await loadUserChats();
        
    } catch (error) {
        removeLoading(loadingId);
        addMessageToUI(`error: ${error.message}`, 'assistant');
    }
}

function addMessageToUI(text, role, files = []) {
    const messagesDiv = document.getElementById('messages');
    
    // remove welcome message if exists
    const welcomeMsg = messagesDiv.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    
    const avatar = role === 'user' ? '👤' : '🤖';
    
    let filesHtml = '';
    if (files.length > 0) {
        filesHtml = '<div class="message-attachment">';
        files.forEach(file => {
            filesHtml += `<div>📎 ${file.name} (${Math.round(file.size/1024)}kb)</div>`;
            if (file.type.startsWith('image/')) {
                filesHtml += `<img src="${file.data}" alt="${file.name}">`;
            }
        });
        filesHtml += '</div>';
    }

    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    messageEl.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${escapeHtml(text)}
            ${filesHtml}
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // store in memory
    chatMessages.push({ role, content: text, files, timestamp: new Date().toISOString() });
}

function showLoading() {
    const messagesDiv = document.getElementById('messages');
    const loadingId = 'loading-' + Date.now();
    
    const loadingEl = document.createElement('div');
    loadingEl.id = loadingId;
    loadingEl.className = 'message';
    loadingEl.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="loading">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    
    messagesDiv.appendChild(loadingEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    return loadingId;
}

function removeLoading(loadingId) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) {
        loadingEl.remove();
    }
}

async function loadChatMessages(chatId) {
    const messages = await loadMessages(chatId);
    
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = '';
    
    chatMessages = [];
    
    messages.forEach(msg => {
        addMessageToUI(msg.content, msg.role, msg.files || []);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

async function readFile(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        
        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });
}
