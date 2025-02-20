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
    .replace(/●/g, '<br>●')
    .replace(/\*/g, '•');
  
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
  const indicator = document.getElementById('apiStatusIndicator');
  const statusText = document.getElementById('apiStatusText');
  
  indicator.className = 'status-indicator ' + (hasKey ? 'active' : 'inactive');
  statusText.textContent = hasKey ? 'API Key Configured' : 'API Key Not Configured';
}

// Connection management
let port = null;

function connectToBackground() {
  try {
    port = chrome.runtime.connect({ name: 'translator-port' });
    
    port.onMessage.addListener((message) => {
      console.log('Received message:', message);
      
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
      }
    });
    
    port.onDisconnect.addListener(() => {
      port = null;
    });
    
    return true;
  } catch (error) {
    console.error('Connection error:', error);
    return false;
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  if (!connectToBackground()) {
    showStatus('Failed to establish connection', false);
    return;
  }

  // Load previous translation
  chrome.storage.local.get(['translationResult', 'translationTimestamp'], (data) => {
    if (data.translationResult) {
      displayTranslation(data.translationResult, data.translationTimestamp);
    }
  });
});

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
    showStatus('Failed to start translation. Please try again.', false);
  }
});

// Handle "Update API Key" click
document.getElementById('updateApiKey').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Cleanup on unload
window.addEventListener('unload', () => {
  if (port) {
    try {
      port.disconnect();
    } catch (e) {
      console.warn('Error during cleanup:', e);
    }
    port = null;
  }
});
