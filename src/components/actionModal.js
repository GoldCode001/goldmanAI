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
  inlineMapContainer = document.getElementById('inlineMapContainer');
  inlineMap = document.getElementById('inlineMap');
  
  // Make functions globally accessible for iOS Chrome compatibility
  window.confirmAction = confirmAction;
  window.saveAction = saveAction;
  window.hideActionModal = hideActionModal;
  
  // Close button
  const closeBtn = document.getElementById('actionModalClose');
  if (closeBtn) {
    closeBtn.onclick = hideActionModal; // Direct assignment for iOS
  }
  
  // Close on backdrop click
  if (actionModal) {
    actionModal.addEventListener('click', (e) => {
      if (e.target === actionModal) {
        hideActionModal();
      }
    });
  }
  
  console.log('Action modal initialized');
}

/**
 * Show inline Google Maps embed
 */
export function showInlineMap(latitude, longitude) {
  if (!inlineMapContainer || !inlineMap) {
    console.error('Map elements not found');
    return;
  }
  
  // Hide message, show map
  if (actionModalMessage) {
    actionModalMessage.classList.add('hidden');
  }
  if (inlineMapContainer) {
    inlineMapContainer.classList.remove('hidden');
  }
  
  // Create Google Maps embed URL with nearby restaurants
  // Using Google Maps Embed API - shows location with nearby places
  const embedUrl = `https://www.google.com/maps/embed/v1/search?key=AIzaSyBFw0Qbyq9zTFTd-tUY6d-s6U4uO3Zx&q=restaurants+near+${latitude},${longitude}&center=${latitude},${longitude}&zoom=15`;
  
  // Alternative: Use place search with location
  // const embedUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6d-s6U4uO3Zx&q=${latitude},${longitude}&zoom=15`;
  
  // For now, use a simpler approach - Google Maps with search query
  const simpleUrl = `https://www.google.com/maps?q=restaurants+near+${latitude},${longitude}&output=embed`;
  
  inlineMap.src = simpleUrl;
  
  // Show modal if not already shown
  if (actionModal && actionModal.classList.contains('hidden')) {
    actionModal.classList.remove('hidden');
    setTimeout(() => {
      if (actionModalContent) {
        actionModalContent.classList.add('show');
      }
    }, 10);
  }
  
  // Hide action buttons (map is interactive)
  if (actionModalActions) {
    actionModalActions.style.display = 'none';
  }
  
  // Update title
  if (actionModalTitle) {
    actionModalTitle.textContent = 'Your Location & Nearby Restaurants';
  }
  
  // Add close button functionality for map
  const closeBtn = document.getElementById('actionModalClose');
  if (closeBtn) {
    closeBtn.onclick = hideActionModal;
  }
}

/**
 * Show action modal with action details
 */
export async function showActionModal(action, result) {
  if (!actionModal || !actionModalContent) {
    console.error('Action modal not initialized');
    return;
  }
  
  currentAction = action;
  currentActionResult = result;
  
  // Import ActionTypes to match action types
  const { ActionTypes } = await import('../lib/deviceActions.js');
  
  // Set title based on action type
  const titles = {
    [ActionTypes.SHOW_MAP]: 'Location Request',
    [ActionTypes.GET_LOCATION]: 'Get Location',
    [ActionTypes.MAKE_CALL]: 'Make Call',
    [ActionTypes.EMERGENCY_CALL]: 'Emergency Call',
    [ActionTypes.SEND_TEXT]: 'Send Text Message',
    [ActionTypes.SET_ALARM]: 'Set Alarm',
    [ActionTypes.CHECK_CALENDAR]: 'Calendar Access',
    [ActionTypes.ADD_EVENT]: 'Add Calendar Event'
  };
  
  actionModalTitle.textContent = titles[action.type] || 'Action Confirmation';
  
  // Set message based on action
  let message = '';
  let showSave = false;
  
  switch (action.type) {
    case ActionTypes.MAKE_CALL:
      message = `Call ${formatPhoneNumber(action.params.number)}?`;
      break;
    case ActionTypes.EMERGENCY_CALL:
      message = 'Call 911 (Emergency Services)?';
      break;
    case ActionTypes.SEND_TEXT:
      message = `Send text to ${formatPhoneNumber(action.params.number)}${action.params.message ? `:\n"${action.params.message}"` : ''}?`;
      break;
    case ActionTypes.SHOW_MAP:
    case ActionTypes.GET_LOCATION:
      message = 'Show your current location on map?';
      break;
    case ActionTypes.SET_ALARM:
      message = `Set alarm for ${action.params.time}?`;
      showSave = true;
      break;
    case ActionTypes.CHECK_CALENDAR:
      message = 'Open calendar to view your schedule?';
      break;
    case ActionTypes.ADD_EVENT:
      message = `Add event: "${action.params.description}"?`;
      showSave = true;
      break;
    default:
      message = 'Confirm this action?';
  }
  
  actionModalMessage.textContent = message;
  actionModalMessage.style.color = '#ccc';
  
  // Show/hide save button based on action type
  const saveBtn = document.getElementById('actionModalSave');
  if (saveBtn) {
    saveBtn.style.display = showSave ? 'inline-block' : 'none';
  }
  
  // Use direct onclick assignment (more reliable on iOS Chrome)
  const confirmBtn = document.getElementById('actionModalConfirm');
  const saveBtnEl = document.getElementById('actionModalSave');
  const cancelBtn = document.getElementById('actionModalCancel');
  
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmAction();
    };
  }
  
  if (saveBtnEl) {
    saveBtnEl.disabled = false;
    saveBtnEl.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveAction();
    };
  }
  
  if (cancelBtn) {
    cancelBtn.disabled = false;
    cancelBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideActionModal();
    };
  }
  
  // Show modal
  actionModal.classList.remove('hidden');
  // Small delay to ensure transition works
  setTimeout(() => {
    actionModalContent.classList.add('show');
  }, 10);
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
        actionModalMessage.classList.remove('hidden');
      }
      // Hide map
      if (inlineMapContainer) {
        inlineMapContainer.classList.add('hidden');
      }
      if (inlineMap) {
        inlineMap.src = ''; // Clear iframe src
      }
      // Show action buttons again
      if (actionModalActions) {
        actionModalActions.style.display = 'flex';
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
  if (!currentAction) {
    console.error('No action to confirm');
    return;
  }
  
  console.log('Confirming action:', currentAction);
  
  // Disable buttons during execution
  const confirmBtn = document.getElementById('actionModalConfirm');
  const saveBtn = document.getElementById('actionModalSave');
  const cancelBtn = document.getElementById('actionModalCancel');
  if (confirmBtn) confirmBtn.disabled = true;
  if (saveBtn) saveBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  
  try {
    // Execute the action
    const { executeAction } = await import('../lib/deviceActions.js');
    const result = await executeAction(currentAction);
    
    console.log('Action result:', result);
    
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
      
      // Re-enable buttons
      if (confirmBtn) confirmBtn.disabled = false;
      if (saveBtn) saveBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
    }
  } catch (err) {
    console.error('Error executing action:', err);
    actionModalMessage.textContent = `Error: ${err.message || 'Failed to execute action'}`;
    actionModalMessage.style.color = '#ef4444';
    
    // Re-enable buttons
    if (confirmBtn) confirmBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

/**
 * Save action (for alarms, events, etc.)
 */
async function saveAction() {
  if (!currentAction) {
    console.error('No action to save');
    return;
  }
  
  console.log('Saving action:', currentAction);
  
  // Disable buttons during execution
  const confirmBtn = document.getElementById('actionModalConfirm');
  const saveBtn = document.getElementById('actionModalSave');
  const cancelBtn = document.getElementById('actionModalCancel');
  if (confirmBtn) confirmBtn.disabled = true;
  if (saveBtn) saveBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  
  try {
    // Execute and save
    const { executeAction } = await import('../lib/deviceActions.js');
    const result = await executeAction(currentAction);
    
    console.log('Save action result:', result);
    
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
      if (cancelBtn) cancelBtn.disabled = false;
    }
  } catch (err) {
    console.error('Error saving action:', err);
    actionModalMessage.textContent = `Error: ${err.message || 'Failed to save action'}`;
    actionModalMessage.style.color = '#ef4444';
    
    // Re-enable buttons
    if (confirmBtn) confirmBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
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
