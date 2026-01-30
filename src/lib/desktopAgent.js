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

    // DEBUG: Show visible alert
    const debugInfo = [];
    debugInfo.push(`__TAURI__: ${!!window.__TAURI__}`);
    debugInfo.push(`__TAURI_INTERNALS__: ${!!window.__TAURI_INTERNALS__}`);
    debugInfo.push(`window keys with TAURI: ${Object.keys(window).filter(k => k.includes('TAURI')).join(', ')}`);

    // Show debug info in page (remove after testing)
    if (document.body) {
      const debugDiv = document.createElement('div');
      debugDiv.style.cssText = 'position:fixed;top:10px;left:10px;background:red;color:white;padding:10px;z-index:99999;font-size:12px;max-width:300px;';
      debugDiv.innerHTML = debugInfo.join('<br>');
      document.body.appendChild(debugDiv);
      setTimeout(() => debugDiv.remove(), 10000); // Remove after 10s
    }

    // Use global Tauri object (injected by Tauri v2)
    if (window.__TAURI__) {
      console.log('[Desktop Agent] Using window.__TAURI__');
      invokeFunction = window.__TAURI__.core.invoke;
    } else if (window.__TAURI_INTERNALS__) {
      console.log('[Desktop Agent] Using window.__TAURI_INTERNALS__');
      invokeFunction = window.__TAURI_INTERNALS__.invoke;

      // DEBUG: Show we're using INTERNALS
      if (document.body) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'position:fixed;top:100px;left:10px;background:green;color:white;padding:10px;z-index:99999;font-size:12px;max-width:300px;';
        infoDiv.textContent = 'Using __TAURI_INTERNALS__.invoke';
        document.body.appendChild(infoDiv);
        setTimeout(() => infoDiv.remove(), 10000);
      }
    } else {
      throw new Error('Tauri API not available - neither __TAURI__ nor __TAURI_INTERNALS__ found');
    }

    // Get platform info
    console.log('[Desktop Agent] Calling get_platform_info...');
    platformInfo = await invokeFunction('get_platform_info');
    tauriAvailable = true;

    console.log('[Desktop Agent] SUCCESS! Tauri detected');
    console.log('[Desktop Agent] Platform:', platformInfo);

    // DEBUG: Show success
    if (document.body) {
      const successDiv = document.createElement('div');
      successDiv.style.cssText = 'position:fixed;top:150px;left:10px;background:blue;color:white;padding:10px;z-index:99999;font-size:12px;max-width:300px;';
      successDiv.innerHTML = `SUCCESS!<br>Platform: ${JSON.stringify(platformInfo)}`;
      document.body.appendChild(successDiv);
      setTimeout(() => successDiv.remove(), 10000);
    }

    return true;

  } catch (error) {
    console.log('[Desktop Agent] Not running in Tauri:', error.message);

    // Show error visibly
    if (document.body) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'position:fixed;top:50px;left:10px;background:darkred;color:white;padding:10px;z-index:99999;font-size:12px;max-width:300px;';
      errorDiv.innerHTML = `Tauri detection FAILED:<br>${error.message}`;
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 10000);
    }

    tauriAvailable = false;
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
    // On Windows, if it's a "start appname" command, try multiple approaches
    if (platformInfo?.os === 'windows' && command.toLowerCase().startsWith('start ')) {
      const appName = command.substring(6).trim().toLowerCase();

      // Common app locations and names
      const appPaths = {
        'telegram': [
          '%APPDATA%\\Telegram Desktop\\Telegram.exe',
          '%LOCALAPPDATA%\\Telegram Desktop\\Telegram.exe',
          'C:\\Program Files\\Telegram Desktop\\Telegram.exe'
        ],
        'chrome': [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ],
        'discord': [
          '%LOCALAPPDATA%\\Discord\\app-*\\Discord.exe'
        ],
        'vscode': [
          'C:\\Program Files\\Microsoft VS Code\\Code.exe',
          '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe'
        ]
      };

      // Try original command first
      try {
        const result = await invokeFunction('run_shell_command', { command });
        return { success: true, output: result };
      } catch (firstError) {
        // Try with .exe
        if (!appName.endsWith('.exe')) {
          try {
            const cmdWithExe = `start ${appName}.exe`;
            const result = await invokeFunction('run_shell_command', { command: cmdWithExe });
            return { success: true, output: result };
          } catch (secondError) {
            // Try known paths for common apps
            const baseAppName = appName.replace('.exe', '');
            if (appPaths[baseAppName]) {
              for (const path of appPaths[baseAppName]) {
                try {
                  const cmdWithPath = `start "" "${path}"`;
                  const result = await invokeFunction('run_shell_command', { command: cmdWithPath });
                  return { success: true, output: result };
                } catch (pathError) {
                  // Continue trying other paths
                }
              }
            }
          }
        }

        // Last resort: Try using PowerShell to find the exe
        try {
          const searchCmd = `powershell -command "Get-Process -Name '${baseAppName}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -First 1 | ForEach-Object { if ($_) { Start-Process -FilePath $_ } else { Get-ChildItem -Path $env:LOCALAPPDATA,$env:APPDATA,'C:\\Program Files','C:\\Program Files (x86)' -Filter '${baseAppName}.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { Start-Process -FilePath $_.FullName } } }"`;
          const result = await invokeFunction('run_shell_command', { command: searchCmd });
          return { success: true, output: result };
        } catch (psError) {
          // All attempts failed
          return {
            success: false,
            error: `Could not find or start ${appName}. Make sure it's installed.`
          };
        }
      }
    }

    // For other commands, execute normally
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
