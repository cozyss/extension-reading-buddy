// Log that content script has loaded
console.log('Reading Buddy content script loaded');

// Function to send selected text to the background script
function sendSelectedText(text) {
  if (!text || text.trim() === '') return;
  
  console.log('Sending selected text to background:', text);
  chrome.runtime.sendMessage({
    action: 'textSelected',
    text: text.trim()
  }, response => {
    if (chrome.runtime.lastError) {
      console.error('Error sending text:', chrome.runtime.lastError);
    } else {
      console.log('Text sent successfully');
    }
  });
}

// Handle text selection with debounce to avoid too many events
let selectionTimeout = null;
function handleTextSelection() {
  clearTimeout(selectionTimeout);
  
  selectionTimeout = setTimeout(() => {
    const selectedText = window.getSelection().toString();
    if (selectedText && selectedText.trim() !== '') {
      console.log('Text selected:', selectedText);
      sendSelectedText(selectedText);
    }
  }, 300); // 300ms debounce
}

// Add event listeners
document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('keyup', handleTextSelection);

// Keep the connection alive with the background script
function keepAlive() {
  let port = chrome.runtime.connect({ name: 'content-keepalive' });
  port.onDisconnect.addListener(() => {
    console.log('Connection to background lost, reconnecting...');
    setTimeout(keepAlive, 1000);
  });
}

// Start the keepalive connection
keepAlive(); 