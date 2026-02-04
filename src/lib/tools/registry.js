/**
 * PAL Tool Registry
 * Defines all available tools that PAL can use
 */

export const TOOLS = {
    // Shell execution
    shell: {
        name: 'shell',
        description: 'Execute a shell command on the local system. Use for running programs, scripts, system commands.',
        dangerous: true,
        parameters: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The shell command to execute'
                },
                workingDir: {
                    type: 'string',
                    description: 'Working directory for the command (optional)'
                }
            },
            required: ['command']
        }
    },

    // File read
    read_file: {
        name: 'read_file',
        description: 'Read the contents of a file from the filesystem',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Absolute or relative path to the file'
                }
            },
            required: ['path']
        }
    },

    // File write
    write_file: {
        name: 'write_file',
        description: 'Write content to a file. Creates the file if it doesn\'t exist.',
        dangerous: true,
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Path to the file'
                },
                content: {
                    type: 'string',
                    description: 'Content to write'
                }
            },
            required: ['path', 'content']
        }
    },

    // List directory
    list_dir: {
        name: 'list_dir',
        description: 'List files and folders in a directory',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Path to the directory'
                }
            },
            required: ['path']
        }
    },

    // Web search
    web_search: {
        name: 'web_search',
        description: 'Search the internet for information',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query'
                }
            },
            required: ['query']
        }
    },

    // Open URL in browser
    open_browser: {
        name: 'open_browser',
        description: 'Open a URL in the default web browser. Only use for web URLs (http/https).',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: 'URL to open (must start with http:// or https://)'
                }
            },
            required: ['url']
        }
    },

    // Open desktop application
    open_app: {
        name: 'open_app',
        description: 'Open a desktop application by name. Examples: telegram, notepad, spotify, discord, chrome, vscode, explorer',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {
                app: {
                    type: 'string',
                    description: 'Application name (e.g., telegram, notepad, spotify, discord)'
                }
            },
            required: ['app']
        }
    },

    // Get system info
    system_info: {
        name: 'system_info',
        description: 'Get information about the current system (OS, memory, etc)',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {}
        }
    },

    // Clipboard operations
    clipboard_read: {
        name: 'clipboard_read',
        description: 'Read the current clipboard contents',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {}
        }
    },

    clipboard_write: {
        name: 'clipboard_write',
        description: 'Write text to the clipboard',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {
                text: {
                    type: 'string',
                    description: 'Text to copy to clipboard'
                }
            },
            required: ['text']
        }
    },

    // Screenshot
    screenshot: {
        name: 'screenshot',
        description: 'Take a screenshot of the screen',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {
                region: {
                    type: 'string',
                    description: 'Optional: "full" for full screen or coordinates "x,y,width,height"'
                }
            }
        }
    },

    // Mouse/keyboard (desktop automation)
    mouse_click: {
        name: 'mouse_click',
        description: 'Click the mouse at specific coordinates',
        dangerous: true,
        parameters: {
            type: 'object',
            properties: {
                x: { type: 'number', description: 'X coordinate' },
                y: { type: 'number', description: 'Y coordinate' },
                button: { type: 'string', description: 'Mouse button: left, right, middle' }
            },
            required: ['x', 'y']
        }
    },

    type_text: {
        name: 'type_text',
        description: 'Type text using the keyboard',
        dangerous: true,
        parameters: {
            type: 'object',
            properties: {
                text: {
                    type: 'string',
                    description: 'Text to type'
                }
            },
            required: ['text']
        }
    },

    // Memory/notes
    remember: {
        name: 'remember',
        description: 'Save a piece of information to memory for later recall',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {
                key: {
                    type: 'string',
                    description: 'A short key/label for this memory'
                },
                value: {
                    type: 'string',
                    description: 'The information to remember'
                }
            },
            required: ['key', 'value']
        }
    },

    recall: {
        name: 'recall',
        description: 'Recall information from memory',
        dangerous: false,
        parameters: {
            type: 'object',
            properties: {
                key: {
                    type: 'string',
                    description: 'The key to recall, or "all" for everything'
                }
            },
            required: ['key']
        }
    }
};

/**
 * Get tools formatted for OpenAI/Claude function calling
 */
export function getToolsForLLM() {
    return Object.values(TOOLS).map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));
}

/**
 * Check if a tool requires approval
 */
export function requiresApproval(toolName) {
    const tool = TOOLS[toolName];
    return tool ? tool.dangerous : true;
}

/**
 * Get tool by name
 */
export function getTool(name) {
    return TOOLS[name] || null;
}
