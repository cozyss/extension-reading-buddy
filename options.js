// Save the API key when the save button is clicked
document.getElementById('save').addEventListener('click', () => {
  const apiKey = document.getElementById('apiKey').value;
  
  if (!apiKey) {
    showStatus('Please enter an API key', false);
    return;
  }

  chrome.storage.local.set({ apiKey: apiKey }, () => {
    showStatus('API key saved successfully!', true);
    
    // Notify any open popups about the API key update
    chrome.runtime.sendMessage({ type: 'apiKeyUpdated', hasKey: true });
  });
});

// Load the saved API key when the options page is opened
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('apiKey', (data) => {
    if (data.apiKey) {
      document.getElementById('apiKey').value = data.apiKey;
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
