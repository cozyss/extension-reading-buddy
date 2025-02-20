// Function to send selected text to extension
function sendSelectedText(text) {
  if (text) {
    chrome.runtime.sendMessage({
      action: 'textSelected',
      text: text
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Error sending message:', chrome.runtime.lastError);
        // If there's an error, the extension might have been reloaded
        // Re-initialize the listeners
        initializeListeners();
      }
    });
  }
}

// Function to initialize event listeners
function initializeListeners() {
  // Remove existing listeners if any
  document.removeEventListener('selectionchange', handleSelectionChange);
  
  // Add listeners
  document.addEventListener('selectionchange', handleSelectionChange);
}

// Handler for selection change
function handleSelectionChange() {
  const selectedText = window.getSelection().toString().trim();
  sendSelectedText(selectedText);
}

// Initialize listeners when script loads
initializeListeners();

// Listen for extension reload/disconnect
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    // Re-initialize listeners when extension reconnects
    setTimeout(initializeListeners, 1000);
  });
}); 