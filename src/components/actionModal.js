/**
 * Action Modal Component
 * Shows confirmation popup for device actions
 */

let actionModal = null;
let actionModalContent = null;
let actionModalTitle = null;
let actionModalMessage = null;
let actionModalActions = null;
let currentAction = null;
let currentActionResult = null;

/**
 * Initialize action modal
 */
export function initActionModal() {
  actionModal = document.getElementById('actionModal');
  actionModalContent = document.getElementById('actionModalContent');
  actionModalTitle = document.getElementById('actionModalTitle');
  actionModalMessage = document.getElementById('actionModalMessage');
  actionModalActions = document.getElementById('actionModalActions');
  
  // Close button
  const closeBtn = document.getElementById('actionModalClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideActionModal);
  }
  
  // Confirm button
  const confirmBtn = document.getElementById('actionModalConfirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', confirmAction);
  }
  
  // Save button
  const saveBtn = document.getElementById('actionModalSave');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveAction);
  }
  
  // Close on backdrop click
  if (actionModal) {
    actionModal.addEventListener('click', (e) => {
      if (e.target === actionModal) {
        hideActionModal();
      }
    });
  }
}

/**
 * Show action modal with action details
 */
export function showActionModal(action, result) {
  if (!actionModal || !actionModalContent) {
    console.error('Action modal not initialized');
    return;
  }
  
  currentAction = action;
  currentActionResult = result;
  
  // Set title based on action type
  const titles = {
    'show_map': 'Location Request',
    'get_location': 'Get Location',
    'make_call': 'Make Call',
    'emergency_call': 'Emergency Call',
    'send_text': 'Send Text Message',
    'set_alarm': 'Set Alarm',
    'check_calendar': 'Calendar Access',
    'add_event': 'Add Calendar Event'
  };
  
  actionModalTitle.textContent = titles[action.type] || 'Action Confirmation';
  
  // Set message based on action
  let message = '';
  let showSave = false;
  
  switch (action.type) {
    case 'make_call':
      message = `Call ${formatPhoneNumber(action.params.number)}?`;
      break;
    case 'emergency_call':
      message = 'Call 911 (Emergency Services)?';
      break;
    case 'send_text':
      message = `Send text to ${formatPhoneNumber(action.params.number)}${action.params.message ? `:\n"${action.params.message}"` : ''}?`;
      break;
    case 'show_map':
    case 'get_location':
      message = 'Show your current location on map?';
      break;
    case 'set_alarm':
      message = `Set alarm for ${action.params.time}?`;
      showSave = true;
      break;
    case 'check_calendar':
      message = 'Open calendar to view your schedule?';
      break;
    case 'add_event':
      message = `Add event: "${action.params.description}"?`;
      showSave = true;
      break;
    default:
      message = 'Confirm this action?';
  }
  
  actionModalMessage.textContent = message;
  
  // Show/hide save button based on action type
  const saveBtn = document.getElementById('actionModalSave');
  if (saveBtn) {
    saveBtn.style.display = showSave ? 'inline-block' : 'none';
  }
  
  // Show modal
  actionModal.classList.remove('hidden');
  actionModalContent.classList.add('show');
}

/**
 * Hide action modal
 */
export function hideActionModal() {
  if (actionModal && actionModalContent) {
    actionModalContent.classList.remove('show');
    setTimeout(() => {
      actionModal.classList.add('hidden');
      // Reset message color
      if (actionModalMessage) {
        actionModalMessage.style.color = '#ccc';
      }
    }, 200); // Wait for animation
  }
  currentAction = null;
  currentActionResult = null;
}

/**
 * Confirm and execute action
 */
async function confirmAction() {
  if (!currentAction) return;
  
  // Execute the action
  const { executeAction } = await import('../lib/deviceActions.js');
  const result = await executeAction(currentAction);
  
  if (result.success) {
    // Show success message briefly
    actionModalMessage.textContent = result.message || 'Action executed successfully!';
    actionModalMessage.style.color = '#4CAF50';
    
    // Hide after 2 seconds
    setTimeout(() => {
      hideActionModal();
    }, 2000);
  } else {
    // Show error
    actionModalMessage.textContent = result.error || 'Action failed';
    actionModalMessage.style.color = '#ef4444';
  }
}

/**
 * Save action (for alarms, events, etc.)
 */
async function saveAction() {
  if (!currentAction) return;
  
  // Disable buttons during execution
  const confirmBtn = document.getElementById('actionModalConfirm');
  const saveBtn = document.getElementById('actionModalSave');
  if (confirmBtn) confirmBtn.disabled = true;
  if (saveBtn) saveBtn.disabled = true;
  
  // Execute and save
  const { executeAction } = await import('../lib/deviceActions.js');
  const result = await executeAction(currentAction);
  
  if (result.success) {
    actionModalMessage.textContent = result.message || 'Saved and executed!';
    actionModalMessage.style.color = '#4CAF50';
    
    setTimeout(() => {
      hideActionModal();
    }, 2000);
  } else {
    actionModalMessage.textContent = result.error || 'Failed to save';
    actionModalMessage.style.color = '#ef4444';
    
    // Re-enable buttons
    if (confirmBtn) confirmBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}

/**
 * Format phone number for display
 */
function formatPhoneNumber(number) {
  const cleaned = number.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return number;
}
