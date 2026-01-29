// Desktop Agent - Autonomous agent capabilities for desktop platforms
// Works on Windows, macOS, and Linux using Tauri

let platformInfo = null;
let tauriAvailable = false;
let invokeFunction = null;

/**
 * Initialize desktop agent and check Tauri availability
 */
export async function initDesktopAgent() {
  try {
    console.log('[Desktop Agent] Checking for Tauri environment...');

    // Check if loader detected Tauri (stored in localStorage)
    const tauriDetected = localStorage.getItem('__TAURI_DETECTED__');
    const platformStr = localStorage.getItem('__TAURI_PLATFORM__');

    if (tauriDetected === 'true' && platformStr) {
      platformInfo = JSON.parse(platformStr);

      // Use invoke function from window (IPC persists after redirect)
      if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
        invokeFunction = window.__TAURI_INTERNALS__.invoke;
        tauriAvailable = true;
        console.log('[Desktop Agent] Tauri IPC available! Platform:', platformInfo);
        return true;
      } else {
        console.error('[Desktop Agent] Loader detected Tauri but IPC not available');
        tauriAvailable = false;
        return false;
      }
    }

    console.log('[Desktop Agent] Not running in Tauri');
    return false;

  } catch (error) {
    console.error('[Desktop Agent] Init error:', error);
    return false;
  }
}

/**
 * Get platform information
 */
export function getPlatformInfo() {
  return platformInfo;
}

/**
 * Check if desktop agent is available
 */
export function isDesktopAgentAvailable() {
  return tauriAvailable;
}

/**
 * Execute shell command on the system
 */
export async function runShellCommand(command) {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const result = await invokeFunction('run_shell_command', { command });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Open a URL or file in the default application
 */
export async function openExternal(path) {
  if (!tauriAvailable) {
    throw new Error('Desktop agent not available');
  }

  try {
    // Try to use shell.open if available
    let shellOpen = null;

    if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.shell && window.__TAURI_INTERNALS__.shell.open) {
      shellOpen = window.__TAURI_INTERNALS__.shell.open;
    } else if (window.__TAURI__ && window.__TAURI__.shell && window.__TAURI__.shell.open) {
      shellOpen = window.__TAURI__.shell.open;
    }

    if (shellOpen) {
      await shellOpen(path);
      return { success: true };
    } else {
      // Fallback: Use invoke to call a custom command
      await invokeFunction('open_url', { url: path });
      return { success: true };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get current working directory
 */
export async function getCurrentDirectory() {
  const result = await runShellCommand(
    platformInfo?.os === 'windows' ? 'cd' : 'pwd'
  );
  return result.success ? result.output.trim() : null;
}

/**
 * List files in directory
 */
export async function listFiles(directory = '.') {
  const cmd = platformInfo?.os === 'windows'
    ? `dir "${directory}" /B`
    : `ls -1 "${directory}"`;

  const result = await runShellCommand(cmd);
  if (result.success) {
    return result.output.split('\n').filter(line => line.trim());
  }
  return [];
}

/**
 * Read file contents
 */
export async function readFile(filepath) {
  const cmd = platformInfo?.os === 'windows'
    ? `type "${filepath}"`
    : `cat "${filepath}"`;

  return await runShellCommand(cmd);
}

/**
 * Write to file
 */
export async function writeFile(filepath, content) {
  const escapedContent = content.replace(/"/g, '\\"');
  const cmd = platformInfo?.os === 'windows'
    ? `echo "${escapedContent}" > "${filepath}"`
    : `echo "${escapedContent}" > "${filepath}"`;

  return await runShellCommand(cmd);
}

/**
 * Create directory
 */
export async function createDirectory(dirpath) {
  const cmd = platformInfo?.os === 'windows'
    ? `mkdir "${dirpath}"`
    : `mkdir -p "${dirpath}"`;

  return await runShellCommand(cmd);
}

/**
 * Check if path exists
 */
export async function pathExists(path) {
  const cmd = platformInfo?.os === 'windows'
    ? `if exist "${path}" echo EXISTS`
    : `test -e "${path}" && echo EXISTS`;

  const result = await runShellCommand(cmd);
  return result.success && result.output.includes('EXISTS');
}

// ============ MOUSE CONTROL ============

/**
 * Move mouse to specific coordinates
 */
export async function mouseMove(x, y) {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const result = await invokeFunction('mouse_move', { x, y });
    return { success: true, message: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Click mouse button
 */
export async function mouseClick(button = 'left') {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const result = await invokeFunction('mouse_click', { button });
    return { success: true, message: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Scroll mouse
 */
export async function mouseScroll(amount) {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const result = await invokeFunction('mouse_scroll', { amount });
    return { success: true, message: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get current mouse position
 */
export async function getMousePosition() {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const position = await invokeFunction('get_mouse_position');
    return { success: true, x: position[0], y: position[1] };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ============ KEYBOARD CONTROL ============

/**
 * Type text using keyboard
 */
export async function keyboardType(text) {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const result = await invokeFunction('keyboard_type', { text });
    return { success: true, message: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Press a special key (Enter, Tab, Escape, etc.)
 */
export async function keyboardPress(key) {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const result = await invokeFunction('keyboard_press', { key });
    return { success: true, message: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Execute keyboard shortcut (e.g., Ctrl+C, Alt+Tab)
 */
export async function keyboardShortcut(keys) {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const result = await invokeFunction('keyboard_shortcut', { keys });
    return { success: true, message: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ============ BROWSER AUTOMATION ============

/**
 * Open URL in default browser
 */
export async function browserOpen(url) {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const result = await invokeFunction('browser_open', { url });
    return { success: true, message: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Run a Playwright script for advanced browser automation
 */
export async function runPlaywrightScript(script) {
  if (!tauriAvailable || !invokeFunction) {
    throw new Error('Desktop agent not available');
  }

  try {
    const result = await invokeFunction('run_playwright_script', { script });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Run autonomous task on desktop
 * Similar to mobile agent but uses desktop-specific capabilities
 */
export async function runDesktopTask(goal, options = {}) {
  const {
    maxSteps = 20,
    onStep,
    onComplete,
    onError,
    getAIDecision
  } = options;

  if (!tauriAvailable) {
    const error = 'Desktop agent not available';
    if (onError) onError(error);
    return { success: false, error };
  }

  if (!getAIDecision) {
    const error = 'AI decision callback required';
    if (onError) onError(error);
    return { success: false, error };
  }

  let stepCount = 0;
  let completed = false;

  try {
    while (stepCount < maxSteps && !completed) {
      stepCount++;

      // Get current system state
      const cwd = await getCurrentDirectory();
      const files = await listFiles();

      // Format context for AI
      const context = `
Goal: ${goal}
Step: ${stepCount}/${maxSteps}
Platform: ${platformInfo.os} (${platformInfo.arch})
Current Directory: ${cwd}
Files in Directory: ${files.join(', ')}

Available Actions:
- run_command: Execute shell command
- open_external: Open URL or file
- read_file: Read file contents
- write_file: Write to file
- create_directory: Create new directory
- list_files: List directory contents
- complete: Mark task as complete

What should I do next to achieve the goal?
`;

      // Ask AI for next action
      const decision = await getAIDecision(context);

      if (onStep) {
        onStep({
          step: stepCount,
          decision,
          context: { cwd, files }
        });
      }

      // Parse and execute AI decision
      const action = parseAIDecision(decision);

      if (action.type === 'complete') {
        completed = true;
        if (onComplete) onComplete({ steps: stepCount, goal });
        return { success: true, steps: stepCount, message: 'Task completed' };
      }

      // Execute the action
      await executeDesktopAction(action);
    }

    if (!completed) {
      return {
        success: false,
        error: 'Max steps reached without completion',
        steps: stepCount
      };
    }

  } catch (error) {
    console.error('[Desktop Agent] Task error:', error);
    if (onError) onError(error);
    return { success: false, error: error.toString(), steps: stepCount };
  }
}

/**
 * Parse AI decision into actionable command
 */
function parseAIDecision(decision) {
  // Simple parsing - look for action keywords
  const lower = decision.toLowerCase();

  if (lower.includes('complete') || lower.includes('done')) {
    return { type: 'complete' };
  }

  if (lower.includes('run') || lower.includes('command')) {
    const cmdMatch = decision.match(/command[:\s]+(.+)/i);
    return {
      type: 'run_command',
      command: cmdMatch ? cmdMatch[1].trim() : ''
    };
  }

  if (lower.includes('open')) {
    const pathMatch = decision.match(/open[:\s]+(.+)/i);
    return {
      type: 'open_external',
      path: pathMatch ? pathMatch[1].trim() : ''
    };
  }

  if (lower.includes('read file')) {
    const fileMatch = decision.match(/read file[:\s]+(.+)/i);
    return {
      type: 'read_file',
      filepath: fileMatch ? fileMatch[1].trim() : ''
    };
  }

  // Default to running as command
  return {
    type: 'run_command',
    command: decision
  };
}

/**
 * Execute desktop action
 */
async function executeDesktopAction(action) {
  switch (action.type) {
    case 'run_command':
      return await runShellCommand(action.command);

    case 'open_external':
      return await openExternal(action.path);

    case 'read_file':
      return await readFile(action.filepath);

    case 'write_file':
      return await writeFile(action.filepath, action.content);

    case 'create_directory':
      return await createDirectory(action.dirpath);

    case 'list_files':
      return await listFiles(action.directory);

    default:
      return { success: false, error: 'Unknown action type' };
  }
}
