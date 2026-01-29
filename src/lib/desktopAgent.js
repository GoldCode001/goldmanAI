// Desktop Agent - Autonomous agent capabilities for desktop platforms
// Works on Windows, macOS, and Linux using Tauri

let platformInfo = null;
let tauriAvailable = false;

/**
 * Initialize desktop agent and check Tauri availability
 */
export async function initDesktopAgent() {
  try {
    // Check if we're running in Tauri environment
    if (typeof window !== 'undefined' && window.__TAURI__) {
      tauriAvailable = true;
      console.log('[Desktop Agent] Tauri detected! Desktop agent ENABLED');

      // Try to get platform info but don't fail if it doesn't work
      try {
        const { invoke } = window.__TAURI__.core;
        platformInfo = await invoke('get_platform_info');
        console.log('[Desktop Agent] Platform info:', platformInfo);
      } catch (e) {
        console.warn('[Desktop Agent] Could not get platform info:', e);
        // Set default platform info
        platformInfo = { os: 'unknown', arch: 'unknown', family: 'unknown' };
      }

      return true;
    } else {
      console.log('[Desktop Agent] window.__TAURI__ not found - Not running in Tauri');
      console.log('[Desktop Agent] window keys:', typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('TAURI') || k.includes('tauri')) : 'no window');
      return false;
    }
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
  if (!tauriAvailable) {
    throw new Error('Desktop agent not available');
  }

  try {
    const { invoke } = window.__TAURI__.core;
    const result = await invoke('run_shell_command', { command });
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
    const { open } = window.__TAURI__.shell;
    await open(path);
    return { success: true };
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
