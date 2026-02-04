/**
 * PAL Tool Executor
 * Executes tools on the local system (Tauri desktop)
 */

import { getTool, requiresApproval } from './registry.js';

// Approval callback - set by the app
let onApprovalRequest = null;
let approvedCommands = new Set(); // Commands user has approved
let autoApproveAll = false; // Full autonomy mode

/**
 * Set the approval callback
 */
export function setApprovalCallback(callback) {
    onApprovalRequest = callback;
}

/**
 * Set autonomy level
 * @param {'ask' | 'allowlist' | 'full'} level
 */
export function setAutonomyLevel(level) {
    autoApproveAll = (level === 'full');
    console.log('[Executor] Autonomy level:', level, 'autoApproveAll:', autoApproveAll);
}

/**
 * Add command to approved list
 */
export function approveCommand(command) {
    approvedCommands.add(command);
}

/**
 * Check if we have Tauri available
 */
function hasTauri() {
    return typeof window !== 'undefined' &&
           (window.__TAURI__ || window.__TAURI_INTERNALS__);
}

/**
 * Get Tauri invoke function
 */
async function getTauriInvoke() {
    if (window.__TAURI__?.core?.invoke) {
        return window.__TAURI__.core.invoke;
    }
    if (window.__TAURI_INTERNALS__?.invoke) {
        return window.__TAURI_INTERNALS__.invoke;
    }
    // Dynamic import for Tauri v2
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return invoke;
    } catch (e) {
        console.error('[Executor] Failed to get Tauri invoke:', e);
        return null;
    }
}

/**
 * Request approval for dangerous operation
 */
async function requestApproval(toolName, params) {
    if (autoApproveAll) return true;

    // Check allowlist
    const key = `${toolName}:${JSON.stringify(params)}`;
    if (approvedCommands.has(key) || approvedCommands.has(toolName)) {
        return true;
    }

    // Ask user
    if (onApprovalRequest) {
        const approved = await onApprovalRequest(toolName, params);
        if (approved) {
            approvedCommands.add(key);
        }
        return approved;
    }

    // No callback, deny by default
    console.warn('[Executor] No approval callback, denying:', toolName);
    return false;
}

/**
 * Execute a tool
 * @param {string} name - Tool name
 * @param {object} params - Tool parameters
 * @returns {Promise<{success: boolean, result?: any, error?: string}>}
 */
export async function executeTool(name, params) {
    console.log('[Executor] Executing tool:', name, params);

    const tool = getTool(name);
    if (!tool) {
        return { success: false, error: `Unknown tool: ${name}` };
    }

    // Check approval for dangerous tools
    if (requiresApproval(name)) {
        const approved = await requestApproval(name, params);
        if (!approved) {
            return { success: false, error: 'User denied permission' };
        }
    }

    try {
        // Route to appropriate executor
        switch (name) {
            case 'shell':
                return await executeShell(params);
            case 'read_file':
                return await executeReadFile(params);
            case 'write_file':
                return await executeWriteFile(params);
            case 'list_dir':
                return await executeListDir(params);
            case 'open_browser':
                return await executeOpenBrowser(params);
            case 'open_app':
                return await executeOpenApp(params);
            case 'system_info':
                return await executeSystemInfo(params);
            case 'clipboard_read':
                return await executeClipboardRead(params);
            case 'clipboard_write':
                return await executeClipboardWrite(params);
            case 'screenshot':
                return await executeScreenshot(params);
            case 'mouse_click':
                return await executeMouseClick(params);
            case 'type_text':
                return await executeTypeText(params);
            case 'web_search':
                return await executeWebSearch(params);
            case 'remember':
                return await executeRemember(params);
            case 'recall':
                return await executeRecall(params);
            default:
                return { success: false, error: `No executor for tool: ${name}` };
        }
    } catch (error) {
        console.error('[Executor] Tool error:', error);
        return { success: false, error: error.message || String(error) };
    }
}

// ============ TOOL IMPLEMENTATIONS ============

async function executeShell({ command, workingDir }) {
    if (!hasTauri()) {
        return { success: false, error: 'Shell execution requires Tauri desktop app' };
    }

    const invoke = await getTauriInvoke();
    if (!invoke) {
        return { success: false, error: 'Tauri not available' };
    }

    try {
        const result = await invoke('run_shell_command', {
            command,
            workingDir: workingDir || null
        });
        return { success: true, result };
    } catch (e) {
        return { success: false, error: e };
    }
}

async function executeReadFile({ path }) {
    if (hasTauri()) {
        const invoke = await getTauriInvoke();
        try {
            const { readTextFile } = await import('@tauri-apps/plugin-fs');
            const content = await readTextFile(path);
            return { success: true, result: content };
        } catch (e) {
            // Fallback to shell
            const result = await executeShell({ command: `cat "${path}"` });
            return result;
        }
    }
    return { success: false, error: 'File read requires Tauri desktop app' };
}

async function executeWriteFile({ path, content }) {
    if (hasTauri()) {
        try {
            const { writeTextFile } = await import('@tauri-apps/plugin-fs');
            await writeTextFile(path, content);
            return { success: true, result: `Written to ${path}` };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
    return { success: false, error: 'File write requires Tauri desktop app' };
}

async function executeListDir({ path }) {
    if (hasTauri()) {
        try {
            const { readDir } = await import('@tauri-apps/plugin-fs');
            const entries = await readDir(path);
            return { success: true, result: entries };
        } catch (e) {
            // Fallback to shell
            const isWindows = navigator.platform.includes('Win');
            const cmd = isWindows ? `dir /b "${path}"` : `ls -la "${path}"`;
            return await executeShell({ command: cmd });
        }
    }
    return { success: false, error: 'List dir requires Tauri desktop app' };
}

async function executeOpenBrowser({ url }) {
    // Validate URL
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return { success: false, error: `Invalid URL: ${url}. Use open_app for desktop applications.` };
    }

    if (hasTauri()) {
        const invoke = await getTauriInvoke();
        try {
            await invoke('open_browser', { url });
            return { success: true, result: `Opened ${url}` };
        } catch (e) {
            return { success: false, error: e };
        }
    }
    // Fallback: open in new tab
    window.open(url, '_blank');
    return { success: true, result: `Opened ${url} in new tab` };
}

async function executeOpenApp({ app }) {
    if (!hasTauri()) {
        return { success: false, error: 'Opening apps requires Tauri desktop app' };
    }

    // Normalize app name
    const appLower = app.toLowerCase().trim();

    // Map common app names to Windows commands
    const appCommands = {
        'telegram': 'start telegram',
        'discord': 'start discord',
        'spotify': 'start spotify',
        'slack': 'start slack',
        'notepad': 'notepad',
        'calculator': 'calc',
        'calc': 'calc',
        'explorer': 'explorer',
        'file explorer': 'explorer',
        'files': 'explorer',
        'chrome': 'start chrome',
        'google chrome': 'start chrome',
        'firefox': 'start firefox',
        'edge': 'start msedge',
        'vscode': 'code',
        'visual studio code': 'code',
        'word': 'start winword',
        'excel': 'start excel',
        'powerpoint': 'start powerpnt',
        'outlook': 'start outlook',
        'terminal': 'start wt',
        'cmd': 'start cmd',
        'powershell': 'start powershell',
        'settings': 'start ms-settings:',
        'task manager': 'taskmgr',
        'paint': 'mspaint',
        'snipping tool': 'snippingtool',
        'obs': 'start obs64',
        'steam': 'start steam',
        'vlc': 'start vlc',
        'zoom': 'start zoom',
        'teams': 'start msteams',
        'whatsapp': 'start whatsapp'
    };

    // Find command or use generic start
    let command = appCommands[appLower];
    if (!command) {
        // Try generic start command
        command = `start ${app}`;
    }

    console.log(`[Executor] Opening app "${app}" with command: ${command}`);

    try {
        const result = await executeShell({ command });
        if (result.success) {
            return { success: true, result: `Opened ${app}` };
        } else {
            return { success: false, error: `Failed to open ${app}: ${result.error}` };
        }
    } catch (e) {
        return { success: false, error: `Failed to open ${app}: ${e.message}` };
    }
}

async function executeSystemInfo() {
    const info = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        language: navigator.language,
        online: navigator.onLine,
        memory: navigator.deviceMemory || 'unknown',
        cores: navigator.hardwareConcurrency || 'unknown'
    };

    if (hasTauri()) {
        const invoke = await getTauriInvoke();
        try {
            const platformInfo = await invoke('get_platform_info');
            info.tauri = platformInfo;
        } catch (e) {}
    }

    return { success: true, result: info };
}

async function executeClipboardRead() {
    try {
        const text = await navigator.clipboard.readText();
        return { success: true, result: text };
    } catch (e) {
        return { success: false, error: 'Clipboard access denied' };
    }
}

async function executeClipboardWrite({ text }) {
    try {
        await navigator.clipboard.writeText(text);
        return { success: true, result: 'Copied to clipboard' };
    } catch (e) {
        return { success: false, error: 'Clipboard write failed' };
    }
}

async function executeScreenshot({ region }) {
    if (!hasTauri()) {
        return { success: false, error: 'Screenshot requires Tauri desktop app' };
    }
    // TODO: Implement with Tauri screenshot plugin
    return { success: false, error: 'Screenshot not yet implemented' };
}

async function executeMouseClick({ x, y, button = 'left' }) {
    if (!hasTauri()) {
        return { success: false, error: 'Mouse control requires Tauri desktop app' };
    }

    const invoke = await getTauriInvoke();
    try {
        await invoke('mouse_click', { x, y, button });
        return { success: true, result: `Clicked at (${x}, ${y})` };
    } catch (e) {
        return { success: false, error: e };
    }
}

async function executeTypeText({ text }) {
    if (!hasTauri()) {
        return { success: false, error: 'Keyboard control requires Tauri desktop app' };
    }

    const invoke = await getTauriInvoke();
    try {
        await invoke('type_text', { text });
        return { success: true, result: `Typed: ${text.substring(0, 20)}...` };
    } catch (e) {
        return { success: false, error: e };
    }
}

async function executeWebSearch({ query }) {
    // Use DuckDuckGo instant answers API (no key needed)
    try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
        const response = await fetch(url);
        const data = await response.json();

        const results = {
            abstract: data.Abstract || null,
            abstractSource: data.AbstractSource || null,
            answer: data.Answer || null,
            relatedTopics: (data.RelatedTopics || []).slice(0, 5).map(t => ({
                text: t.Text,
                url: t.FirstURL
            }))
        };

        if (!results.abstract && !results.answer && results.relatedTopics.length === 0) {
            // Fallback: just open search in browser
            return await executeOpenBrowser({
                url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
            });
        }

        return { success: true, result: results };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Simple in-memory storage for now (will persist later)
const memoryStore = new Map();

async function executeRemember({ key, value }) {
    memoryStore.set(key, {
        value,
        timestamp: Date.now()
    });

    // TODO: Persist to local storage or file
    try {
        const stored = JSON.parse(localStorage.getItem('pal_memory') || '{}');
        stored[key] = { value, timestamp: Date.now() };
        localStorage.setItem('pal_memory', JSON.stringify(stored));
    } catch (e) {}

    return { success: true, result: `Remembered: ${key}` };
}

async function executeRecall({ key }) {
    // Try memory store first
    if (key === 'all') {
        const all = {};
        memoryStore.forEach((v, k) => all[k] = v.value);

        // Also load from localStorage
        try {
            const stored = JSON.parse(localStorage.getItem('pal_memory') || '{}');
            Object.keys(stored).forEach(k => all[k] = stored[k].value);
        } catch (e) {}

        return { success: true, result: all };
    }

    if (memoryStore.has(key)) {
        return { success: true, result: memoryStore.get(key).value };
    }

    // Try localStorage
    try {
        const stored = JSON.parse(localStorage.getItem('pal_memory') || '{}');
        if (stored[key]) {
            return { success: true, result: stored[key].value };
        }
    } catch (e) {}

    return { success: false, error: `No memory found for key: ${key}` };
}

/**
 * Execute multiple tools in sequence
 */
export async function executeToolChain(tools) {
    const results = [];
    for (const { name, params } of tools) {
        const result = await executeTool(name, params);
        results.push({ name, params, ...result });
        if (!result.success) break; // Stop on error
    }
    return results;
}
