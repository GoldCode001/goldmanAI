/**
 * Inline Output Manager - Shows code/text in expandable panel
 * Gives AI "free will" to decide when to show text vs speak
 */

/**
 * Detect if response contains code or long text
 */
export function shouldShowInline(text) {
  // Detect code blocks (markdown or plain)
  const hasCodeBlock = /```[\s\S]*```/.test(text) || /`[^`]+`/.test(text);

  // Detect long technical content (>300 chars with code patterns)
  const codePatterns = /\b(function|const|let|var|class|import|export|return|if|else|for|while)\b/g;
  const hasMultipleCodeKeywords = (text.match(codePatterns) || []).length > 3;

  // Detect structured lists/articles
  const hasStructuredContent = (text.match(/^(\d+\.|-|\*)/gm) || []).length > 3;

  return hasCodeBlock || hasMultipleCodeKeywords || hasStructuredContent;
}

/**
 * Extract displayable content from response
 */
export function extractInlineContent(text) {
  // Extract code blocks
  const codeBlockMatch = text.match(/```[\s\S]*?```/g);
  if (codeBlockMatch) {
    return codeBlockMatch.map(block => block.replace(/```/g, '').trim()).join('\n\n---\n\n');
  }

  // If no code blocks but has inline code/technical content, return full text
  return text;
}

/**
 * Generate voice-friendly summary when showing inline
 */
export function generateSummary(text) {
  if (/```[\s\S]*```/.test(text)) {
    // Has code blocks
    const blockCount = (text.match(/```/g) || []).length / 2;
    if (blockCount === 1) {
      return "I've provided the code below. You can copy it using the button.";
    }
    return `I've provided ${blockCount} code snippets below. You can copy them using the button.`;
  }

  if (text.length > 500) {
    return "I've provided the detailed response below. You can read and copy it there.";
  }

  return "Here's what you asked for, shown below.";
}

/**
 * Show inline output panel
 */
export function showInlineOutput(content) {
  const panel = document.getElementById('inlineOutput');
  const contentEl = document.getElementById('inlineOutputContent');

  if (!panel || !contentEl) return;

  contentEl.textContent = content;
  panel.classList.remove('hidden');

  // Face should minimize
  const face = document.getElementById('assistantFace');
  if (face) {
    face.style.opacity = '0.3';
    face.style.transform = 'scale(0.6)';
    face.style.transition = 'all 0.3s ease';
  }
}

/**
 * Hide inline output panel
 */
export function hideInlineOutput() {
  const panel = document.getElementById('inlineOutput');
  if (panel) {
    panel.classList.add('hidden');
  }

  // Restore face to center with smooth animation
  const face = document.getElementById('assistantFace');
  if (face) {
    face.style.opacity = '1';
    face.style.transform = 'scale(1)';
    face.style.transition = 'all 0.3s ease';
  }
}

/**
 * Copy inline content to clipboard
 */
export async function copyInlineContent() {
  const contentEl = document.getElementById('inlineOutputContent');
  if (!contentEl) return;

  try {
    await navigator.clipboard.writeText(contentEl.textContent);

    // Visual feedback
    const copyBtn = document.getElementById('copyInlineBtn');
    if (copyBtn) {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    }
  } catch (err) {
    console.error('Copy failed:', err);
  }
}

/**
 * Initialize inline output listeners
 */
export function initInlineOutput() {
  const copyBtn = document.getElementById('copyInlineBtn');
  const closeBtn = document.getElementById('closeInlineBtn');

  if (copyBtn) {
    copyBtn.addEventListener('click', copyInlineContent);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', hideInlineOutput);
  }
}
