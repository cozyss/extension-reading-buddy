// Listen for text selection events
document.addEventListener('selectionchange', () => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    chrome.runtime.sendMessage({
      action: 'textSelected',
      text: selectedText
    });
  }
}); 