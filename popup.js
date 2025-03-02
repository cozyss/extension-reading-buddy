// Function to show status messages
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

// Function to hide status message
function hideStatus() {
  const status = document.getElementById('status');
  status.style.display = 'none';
}

// Function to display translation result
function displayTranslation(content, timestamp = null) {
  console.log('Displaying translation:', { content, timestamp });
  
  const translationContent = document.getElementById('translationContent');
  const translationResult = document.getElementById('translationResult');
  const timestampElement = document.getElementById('timestamp');
  
  if (!translationContent || !translationResult || !timestampElement) {
    console.error('Required DOM elements not found');
    return;
  }
  
  if (content === undefined || content === null) {
    console.error('No content to display');
    return;
  }

  // Show the container
  translationResult.style.display = 'block';
  
  // Set the content, ensuring proper line breaks
  const formattedContent = content
    .replace(/\n/g, '<br>')
    .replace(/[●•]/g, '•') // Normalize bullet points to a single type
    .replace(/•/g, '<br>•'); // Add line break before bullet points
  
  translationContent.innerHTML = formattedContent;
  
  // Update timestamp if provided
  if (timestamp) {
    timestampElement.textContent = `Translated at: ${timestamp}`;
    timestampElement.style.display = 'block';
  } else {
    timestampElement.style.display = 'none';
  }
}

// Function to update API status display
function updateApiStatus(hasKey) {
  console.log('Updating API status:', hasKey);
  const indicator = document.getElementById('apiStatusIndicator');
  const statusText = document.getElementById('apiStatusText');
  
  indicator.className = 'status-indicator ' + (hasKey ? 'active' : 'inactive');
  statusText.textContent = hasKey ? 'API Key Configured' : 'API Key Not Configured';
}

// Connection management
let port = null;
let connectionCheckInterval = null;

function connectToBackground() {
  console.log('Connecting to background script...');
  try {
    if (port) {
      try {
        port.disconnect();
      } catch (e) {
        console.warn('Error disconnecting existing port:', e);
      }
    }

    port = chrome.runtime.connect({ name: 'translator-port' });
    console.log('Connected to background script');
    
    port.onMessage.addListener((message) => {
      console.log('Popup received message:', message);
      
      switch (message.type) {
        case 'apiKeyStatus':
          updateApiStatus(message.hasKey);
          break;
          
        case 'partial':
          console.log('Received partial translation:', message.result);
          displayTranslation(message.result);
          break;
          
        case 'complete':
          console.log('Translation complete, result:', message.result);
          displayTranslation(message.result, message.timestamp);
          showStatus('Translation completed!', true);
          break;
          
        case 'error':
          showStatus(message.error || 'Unknown error occurred', false);
          break;

        case 'selectedText':
          console.log('Received selected text:', message.text);
          document.getElementById('inputText').value = message.text;
          break;
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Port disconnected, attempting to reconnect...');
      port = null;
      // Try to reconnect after a short delay
      setTimeout(connectToBackground, 1000);
    });

    // Set up connection health check
    if (connectionCheckInterval) {
      clearInterval(connectionCheckInterval);
    }
    connectionCheckInterval = setInterval(() => {
      if (!port) {
        console.log('Connection check failed, attempting to reconnect...');
        connectToBackground();
      }
    }, 30000); // Check every 30 seconds
    
    return true;
  } catch (error) {
    console.error('Connection error:', error);
    port = null;
    return false;
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded, initializing...');
  
  // Try to connect to background script
  if (!connectToBackground()) {
    showStatus('Failed to establish connection', false);
    return;
  }
  
  // Check API key status directly
  checkApiKeyStatus();
  
  // Load previous translation
  chrome.storage.local.get(['translationResult', 'translationTimestamp'], (data) => {
    console.log('Loaded previous translation data:', data);
    if (data.translationResult) {
      displayTranslation(data.translationResult, data.translationTimestamp);
    }
  });
  
  // Also load any previously selected text
  chrome.storage.local.get(['selectedText'], (data) => {
    console.log('Loaded previously selected text:', data);
    if (data.selectedText) {
      document.getElementById('inputText').value = data.selectedText;
    }
  });
  
  // Listen for runtime messages (like API key updates)
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Popup received runtime message:', message);
    
    if (message.type === 'apiKeyStatus') {
      updateApiStatus(message.hasKey);
    }
  });
});

// Function to check API key status directly from storage
function checkApiKeyStatus() {
  chrome.storage.local.get('apiKey', (data) => {
    console.log('Checking API key status directly from storage');
    updateApiStatus(!!data.apiKey);
  });
}

// Handle translation button click
document.getElementById('translateButton').addEventListener('click', () => {
  const inputText = document.getElementById('inputText').value.trim();
  
  if (!inputText) {
    showStatus('Please enter text to translate', false);
    return;
  }

  if (!port && !connectToBackground()) {
    showStatus('Connection error. Please try again.', false);
    return;
  }

  // Check if API key is configured
  chrome.storage.local.get('apiKey', (data) => {
    if (!data.apiKey) {
      showStatus('API key not configured. Please update your API key.', false);
      return;
    }
    
    // Clear previous translation
    document.getElementById('translationContent').innerHTML = '';
    document.getElementById('timestamp').style.display = 'none';
    
    showStatus('Translating...', true, true);
    
    try {
      port.postMessage({
        action: 'translateText',
        text: inputText
      });
    } catch (error) {
      console.error('Error sending translation request:', error);
      showStatus('Failed to start translation. Please try again.', false);
    }
  });
});

// Handle "Update API Key" click
document.getElementById('updateApiKey').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Cleanup on unload
window.addEventListener('unload', () => {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
  }
  if (port) {
    try {
      port.disconnect();
    } catch (e) {
      console.warn('Error during cleanup:', e);
    }
    port = null;
  }
});
