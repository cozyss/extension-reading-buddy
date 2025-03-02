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

  // Save the API key to storage
  chrome.storage.local.set({ apiKey: apiKey }, () => {
    showStatus('API key saved successfully!', true);
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
    } catch (error) {
      console.error('Error connecting to background script via port:', error);
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
function showStatus(message, success) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.display = 'block';
  status.className = success ? 'success' : 'error';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}
