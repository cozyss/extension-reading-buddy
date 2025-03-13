// Save the API key when the save button is clicked
document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiKey) {
    showStatus('Please enter an API key', false);
    return;
  }

  // Validate API key format (basic check)
  if (!apiKey.startsWith('sk-ant-')) {
    showStatus('Invalid API key format. Claude API keys start with "sk-ant-"', false);
    return;
  }

  // First show a persistent status message about reinitialization
  showStatus('Saving API key and reinitializing extension...', true, true);

  // Save the API key to storage
  chrome.storage.local.set({ apiKey: apiKey }, () => {
    console.log('API key saved to storage');
    
    // Try multiple methods to notify about the update
    
    // Method 1: Connect to background script
    try {
      const port = chrome.runtime.connect({ name: 'options-port' });
      port.postMessage({
        action: 'updateApiKey',
        apiKey: apiKey
      });
      console.log('Notified background script about API key update via port');
      
      // Listen for reinitialization completion message
      port.onMessage.addListener((message) => {
        if (message.type === 'reinitializationComplete') {
          showStatus('API key saved and extension reinitialized successfully!', true);
        }
      });
    } catch (error) {
      console.error('Error connecting to background script via port:', error);
      showStatus('API key saved but failed to notify extension. Please refresh your browser.', false);
    }
    
    // Method 2: Send a runtime message
    try {
      chrome.runtime.sendMessage({
        action: 'updateApiKey',
        apiKey: apiKey
      });
      console.log('Sent API key update message via runtime');
    } catch (error) {
      console.error('Error sending runtime message:', error);
    }
    
    // Set a timeout to update the status message if we don't get a completion message
    setTimeout(() => {
      const status = document.getElementById('status');
      if (status.textContent === 'Saving API key and reinitializing extension...') {
        showStatus('API key saved successfully! You may need to refresh open pages.', true);
      }
    }, 5000);
  });
});

// Load the saved API key when the options page is opened
document.addEventListener('DOMContentLoaded', () => {
  console.log('Options page loaded, checking for existing API key');
  chrome.storage.local.get('apiKey', (data) => {
    if (data.apiKey) {
      document.getElementById('apiKey').value = data.apiKey;
      console.log('Loaded existing API key');
    } else {
      console.log('No API key found in storage');
    }
  });
});

// Helper function to show status messages
function showStatus(message, success, persistent = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.display = 'block';
  status.className = success ? 'success' : 'error';
  
  if (!persistent) {
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }
}