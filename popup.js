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

// Function to show loading indicator
function showLoading() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
  }
}

// Function to hide loading indicator
function hideLoading() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
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

  // Hide loading indicator if it's visible
  hideLoading();

  // Show the container
  translationResult.style.display = 'block';
  
  // Process content
  let processedContent = '';
  
  // Split content by lines and process each line
  const lines = content.split('\n');
  
  // Detect if we're in the summary section (which comes after annotations)
  let inSummarySection = false;
  
  // Process each line of content
  lines.forEach(line => {
    // Skip empty lines
    if (!line.trim()) return;
    
    const trimmedLine = line.trim();
    
    // Check if this line indicates the start of a summary section
    if (trimmedLine.toLowerCase().includes('summary') || 
        trimmedLine.toLowerCase().includes('总结') ||
        trimmedLine.toLowerCase().includes('概述')) {
      inSummarySection = true;
    }
    
    // Enhanced bullet point detection for various bullet characters
    const bulletChars = ['●', '•', '-', '+', '*', '→', '⇒', '»', '‣', '⁃', '⦿', '⦾'];
    const firstChar = trimmedLine.charAt(0);
    
    if (bulletChars.includes(firstChar) && !inSummarySection) {
      // Only add green bullet points for annotation sections, not the summary
      processedContent += `<p><span class="bullet-point">•</span> ${trimmedLine.substring(1).trim()}</p>`;
    } else {
      // Regular paragraph without bullet styling
      processedContent += `<p>${trimmedLine}</p>`;
    }
  });
  
  // Apply formatting to make English phrases and Chinese translations bold
  processedContent = formatAnnotations(processedContent);
  
  // Handle streaming updates more smoothly
  updateContentWithScrollPreservation(translationContent, processedContent, content);
  
  // Update timestamp if provided
  if (timestamp) {
    timestampElement.textContent = `Generated at: ${timestamp}`;
    timestampElement.style.display = 'block';
  } else {
    timestampElement.style.display = 'none';
  }
}

// Helper function to format annotations with proper bold styling
function formatAnnotations(content) {
  // First handle any existing Markdown formatting
  let formattedContent = content
    // Convert Markdown bold to HTML
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Convert Markdown italic to HTML
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Remove square brackets around Chinese annotations
    .replace(/\[([^\[\]]+?)\]/g, '$1')
    // Remove quotation marks around text
    .replace(/"([^"]+?)"/g, '$1')
    .replace(/'([^']+?)'/g, '$1')
    .replace(/「([^」]+?)」/g, '$1')
    .replace(/『([^』]+?)』/g, '$1')
    .replace(/[""]/g, '')
    .replace(/['']/g, '');
  
  // Format English-Chinese pairs in annotations
  // This pattern looks for English text followed by a dash/hyphen and then Chinese text
  formattedContent = formattedContent.replace(
    /([A-Za-z][\w\s.,;!?()]+?)(\s*[-–—]\s*)([^\s<>][^<>]*?(?:[\u4e00-\u9fff]+)[^<>]*?)(<\/p>|<br>|$)/g, 
    '<strong>$1</strong>$2<strong>$3</strong>$4'
  );
  
  // Format labeled content patterns
  const labelPatterns = [
    // Original text patterns
    {
      label: /(Original|原文|原始文本)(\s*[:：]\s*)/gi,
      content: /([^<]+?)(<\/p>|<br>|$)/
    },
    // Translation patterns
    {
      label: /(Translation|翻译|译文)(\s*[:：]\s*)/gi,
      content: /([^<]+?)(<\/p>|<br>|$)/
    },
    // Example patterns
    {
      label: /(Example|例子|例句)(\s*[:：]\s*)/gi,
      content: /([^<]+?)(<\/p>|<br>|$)/
    }
  ];
  
  // Apply formatting for each label pattern
  labelPatterns.forEach(pattern => {
    formattedContent = formattedContent.replace(
      new RegExp(pattern.label.source + pattern.content.source, 'gi'),
      '$1$2<strong>$3</strong>$4'
    );
  });
  
  // Additional pattern for bullet point annotations that contain English-Chinese pairs
  // This looks for content after a bullet point that has both English and Chinese text
  formattedContent = formattedContent.replace(
    /<span class="bullet-point">•<\/span>\s*([A-Za-z][^<>]*?)(\s*[-–—]\s*)([^<>\s][^<>]*?(?:[\u4e00-\u9fff]+)[^<>]*?)(<\/p>|<br>|$)/g,
    '<span class="bullet-point">•</span> <strong>$1</strong>$2<strong>$3</strong>$4'
  );
  
  return formattedContent;
}

// Helper function to update content while preserving scroll position
function updateContentWithScrollPreservation(contentElement, processedContent, rawContent) {
  if (contentElement.innerHTML === '') {
    // First update - set the content directly
    contentElement.innerHTML = processedContent;
    contentElement.style.opacity = '1';
  } else {
    // For streaming updates, only update if content has changed
    if (contentElement.getAttribute('data-content') !== rawContent) {
      // Store the scroll position
      const scrollContainer = document.querySelector('.results-container');
      const scrollPos = scrollContainer ? scrollContainer.scrollTop : 0;
      const isScrolledToBottom = scrollContainer ? 
        (scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 50) : false;
      
      // Update content without the fade effect for streaming updates
      contentElement.innerHTML = processedContent;
      
      // Store the current content for comparison in future updates
      contentElement.setAttribute('data-content', rawContent);
      
      // Restore scroll position or keep scrolled to bottom if user was at bottom
      if (scrollContainer) {
        if (isScrolledToBottom) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        } else {
          scrollContainer.scrollTop = scrollPos;
        }
      }
    }
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
          if (message.reinitialized) {
            showStatus('Extension reinitialized with new API key', true);
          }
          break;
          
        case 'reinitializing':
          console.log('Extension is reinitializing:', message.message);
          showStatus('Extension is reinitializing with new API key...', true, true);
          // Clear any existing translation results
          document.getElementById('translationContent').innerHTML = '';
          document.getElementById('translationResult').style.display = 'none';
          document.getElementById('timestamp').style.display = 'none';
          break;
          
        case 'partial':
          console.log('Received partial translation:', message.result);
          // Don't show loading indicator for partial updates to avoid UI flashing
          if (document.getElementById('translationResult').style.display !== 'block') {
            hideLoading();
            document.getElementById('translationResult').style.display = 'block';
          }
          displayTranslation(message.result);
          break;
          
        case 'complete':
          console.log('Translation complete, result:', message.result);
          hideLoading();
          displayTranslation(message.result, message.timestamp);
          showStatus('Translation completed!', true);
          break;
          
        case 'error':
          hideLoading();
          showStatus(message.error || 'Unknown error occurred', false);
          break;

        case 'selectedText':
          console.log('Received selected text:', message.text);
          const inputText = document.getElementById('inputText');
          inputText.value = message.text;
          // Optionally focus the input field for better UX
          inputText.focus();
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
  
  // Load any previously selected text and populate the input field
  chrome.storage.local.get(['selectedText'], (data) => {
    console.log('Loaded previously selected text:', data);
    if (data.selectedText) {
      const inputText = document.getElementById('inputText');
      inputText.value = data.selectedText;
      // Focus the input field for better UX
      inputText.focus();
    }
  });
  
  // Listen for runtime messages (like API key updates)
  chrome.runtime.onMessage.addListener((message) => {
    console.log('Popup received runtime message:', message);
    
    if (message.type === 'apiKeyStatus') {
      updateApiStatus(message.hasKey);
      if (message.reinitialized) {
        showStatus('Extension reinitialized with new API key', true);
        // Reconnect to background script to ensure we have a fresh connection
        if (port) {
          try {
            port.disconnect();
          } catch (e) {
            console.warn('Error disconnecting existing port:', e);
          }
          port = null;
        }
        connectToBackground();
      }
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
    
    // Hide any previous status message
    hideStatus();
    
    // Show loading indicator
    showLoading();
    
    try {
      port.postMessage({
        action: 'translateText',
        text: inputText
      });
    } catch (error) {
      console.error('Error sending translation request:', error);
      hideLoading();
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