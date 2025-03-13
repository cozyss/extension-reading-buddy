// Constants
const CLAUDE_API = {
  URL: "https://api.anthropic.com/v1/messages",
  VERSION: "2023-06-01",
  MODEL: "claude-3-7-sonnet-latest",
  MAX_TOKENS: 1024
};

// Log that background script has loaded
console.log('Reading Buddy background script loaded');

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked, opening side panel');
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Store the active port connection from the side panel
let activePanelPort = null;

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.action === 'textSelected') {
    console.log('Text selected:', message.text);
    console.log('Active panel port exists:', !!activePanelPort);
    
    // Store the selected text in local storage for later use
    chrome.storage.local.set({ selectedText: message.text });
    
    if (activePanelPort) {
      try {
        activePanelPort.postMessage({
          type: 'selectedText',
          text: message.text
        });
        console.log('Sent selected text to panel');
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error sending to panel:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.warn('No active panel port to send selected text to');
      sendResponse({ success: false, error: 'No active panel' });
    }
  } else if (message.action === 'updateApiKey') {
    console.log('Received API key update via runtime message');
    handleApiKeyUpdate(message.apiKey, { 
      postMessage: (msg) => {
        try {
          // Try to send a response back to the sender
          sendResponse(msg);
        } catch (error) {
          console.error('Error sending response to API key update:', error);
        }
      }
    });
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  // Return true to indicate we'll respond asynchronously
  return true;
});

// Handle connection from popup or content script
chrome.runtime.onConnect.addListener((port) => {
  console.log('Connection established with:', port.name);
  
  // Store the active port if it's from the side panel
  if (port.name === 'translator-port') {
    activePanelPort = port;
    console.log('Stored active panel port');
    
    // Send initial API key status
    sendApiKeyStatus(port);
    
    // Send any previously selected text to the newly connected popup
    chrome.storage.local.get('selectedText', (data) => {
      if (data.selectedText) {
        console.log('Sending previously selected text to new panel:', data.selectedText);
        port.postMessage({
          type: 'selectedText',
          text: data.selectedText
        });
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Panel port disconnected');
      if (activePanelPort === port) {
        activePanelPort = null;
      }
    });
    
    port.onMessage.addListener(async (request) => {
      console.log('Received request from panel:', request);
      
      switch (request.action) {
        case "translateText":
          await handleTranslateRequest(request.text, port);
          break;
        case "updateApiKey":
          await handleApiKeyUpdate(request.apiKey, port);
          break;
      }
    });
  } else if (port.name === 'options-port') {
    console.log('Options page connected');
    
    port.onMessage.addListener(async (request) => {
      console.log('Received request from options page:', request);
      
      if (request.action === 'updateApiKey') {
        await handleApiKeyUpdate(request.apiKey, port);
        
        // Also notify the side panel if it's connected
        if (activePanelPort) {
          activePanelPort.postMessage({
            type: 'apiKeyStatus',
            hasKey: true
          });
        }
      }
    });
  }
});

// Helper Functions
async function sendApiKeyStatus(port) {
  try {
    const data = await chrome.storage.local.get("apiKey");
    port.postMessage({
      type: 'apiKeyStatus',
      hasKey: !!data.apiKey
    });
    console.log('Sent API key status:', !!data.apiKey);
  } catch (error) {
    console.error('Error sending API key status:', error);
  }
}

async function handleTranslateRequest(text, port) {
  const data = await chrome.storage.local.get("apiKey");
  
  if (!data.apiKey) {
    port.postMessage({
      type: 'error',
      error: "Please set your API key in the extension options"
    });
    return;
  }
  
  try {
    console.log('Starting translation...');
    const result = await translateTextWithResult(text, data.apiKey, port);
    console.log('Translation completed:', result);
    
    const timestamp = new Date().toLocaleString();
    
    // Store the result
    await chrome.storage.local.set({
      selectedText: text,
      translationResult: result,
      translationTimestamp: timestamp
    });

    // Send the result back to popup
    port.postMessage({
      type: 'complete',
      result: result,
      timestamp: timestamp
    });
    
  } catch (error) {
    console.error('Translation error:', error);
    handleTranslationError(error, port);
  }
}

// Function to reinitialize the extension after API key updates
async function reinitializeExtension(apiKey, port) {
  console.log('Reinitializing extension with new API key');
  
  // Store the new API key
  await chrome.storage.local.set({ apiKey });
  
  // Reset any active connections
  if (activePanelPort) {
    try {
      // Notify the panel that we're reinitializing
      activePanelPort.postMessage({
        type: 'reinitializing',
        message: 'Extension is reinitializing with new API key'
      });
    } catch (error) {
      console.error('Error notifying panel about reinitialization:', error);
    }
  }
  
  // Clear any cached data that might depend on the old API key
  await chrome.storage.local.remove(['translationResult', 'translationTimestamp', 'translationError']);
  
  // Broadcast to all runtime listeners that API key has been updated
  try {
    chrome.runtime.sendMessage({
      type: 'apiKeyStatus',
      hasKey: true,
      reinitialized: true
    });
    console.log('Broadcast API key update and reinitialization to all listeners');
  } catch (error) {
    console.error('Error broadcasting API key update and reinitialization:', error);
  }
  
  // Notify the port that sent the update
  try {
    port.postMessage({
      type: 'apiKeyStatus',
      hasKey: true
    });
    
    // Also send a reinitialization complete message
    port.postMessage({
      type: 'reinitializationComplete'
    });
    
    console.log('Notified sender about API key update and reinitialization completion');
  } catch (error) {
    console.error('Error notifying sender about API key update and reinitialization:', error);
  }
  
  // Also notify the side panel if it's connected and different from the sender
  if (activePanelPort && activePanelPort !== port) {
    try {
      activePanelPort.postMessage({
        type: 'apiKeyStatus',
        hasKey: true,
        reinitialized: true
      });
      console.log('Notified side panel about API key update and reinitialization');
    } catch (error) {
      console.error('Error notifying side panel about API key update and reinitialization:', error);
    }
  }
  
  console.log('Extension reinitialization complete');
  return true;
}

async function handleApiKeyUpdate(apiKey, port) {
  console.log('Handling API key update');
  
  // Use the new reinitializeExtension function
  const success = await reinitializeExtension(apiKey, port);
  
  if (!success) {
    console.error('Failed to reinitialize extension');
    try {
      port.postMessage({
        type: 'error',
        error: 'Failed to reinitialize extension with new API key'
      });
    } catch (error) {
      console.error('Error sending reinitialization failure message:', error);
    }
  }
}

function handleTranslationError(error, port) {
  const errorMessage = error.message || "Translation failed";
  
  chrome.storage.local.set({
    translationError: errorMessage,
    translationTimestamp: new Date().toLocaleString()
  });
  
  port.postMessage({
    type: 'error',
    error: errorMessage
  });
}

// Translation Function
async function translateTextWithResult(text, apiKey, port) {
  try {
    console.log('Starting API request with:', { 
      url: CLAUDE_API.URL, 
      version: CLAUDE_API.VERSION, 
      model: CLAUDE_API.MODEL,
      textLength: text.length
    });
    
    const response = await fetch(CLAUDE_API.URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": CLAUDE_API.VERSION,
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: CLAUDE_API.MODEL,
        max_tokens: CLAUDE_API.MAX_TOKENS,
        stream: true,
        messages: [{
          role: "user",
          content: `You are an experienced English literature professor at a top Chinese university. For the given text, provide 1-4 detailed annotations. Choose the 1-4 most significant elements from:

- Complex vocabulary or idioms
- Literary devices (metaphors, imagery)
- Advanced grammatical structures
- Cultural context or multiple meanings
- Unusual sentence patterns

Try to keep the annotations concise and to the point. Format each annotation as:
● [English word/phrase/structure] - [Chinese translation]
[Detailed explanation in Chinese covering relevant aspects:
  * Usage and context
  * Grammar structure if complex
  * Literary effect if relevant
  * Cultural background if needed
  * Multiple meanings if applicable]

In the end, provide a concise summary of the text and how it serves the writer's purpose to help the student understand the text better.

Please start directly with the bullet point format.

The text to analyze is: "${text}"`
        }]
      })
    });

    if (!response.ok) {
      console.error('API response not OK:', response.status, response.statusText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${response.statusText}`);
    }

    console.log('API response received, starting to read stream');
    const reader = response.body.getReader();
    let fullText = '';
    let buffer = '';
    let messageCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream reading complete');
        break;
      }
      
      // Convert the chunk to text
      const chunk = new TextDecoder().decode(value);
      buffer += chunk;
      
      // Process complete messages from the buffer
      let messages = buffer.split('\n\n');
      buffer = messages.pop() || ''; // Keep the last incomplete message in the buffer
      
      for (const message of messages) {
        if (!message.trim()) continue;
        messageCount++;
        
        // Parse the event data
        const lines = message.split('\n');
        let eventData = '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventData = line.slice(6);
            break;
          }
        }
        
        if (!eventData || eventData === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(eventData);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text;
            
            // Send the partial result through the port
            if (port) {
              port.postMessage({
                type: 'partial',
                result: fullText
              });
            }
          }
        } catch (e) {
          console.error('Error parsing SSE message:', e);
          console.error('Message:', eventData);
        }
      }
    }

    console.log('Translation complete, processed messages:', messageCount);
    
    if (!fullText) {
      console.error('No text was generated from the API');
      throw new Error('No text was generated from the API');
    }

    // Store and return the final result
    const timestamp = new Date().toLocaleString();
    await chrome.storage.local.set({
      selectedText: text,
      translationResult: fullText,
      translationTimestamp: timestamp
    });

    return fullText;
  } catch (error) {
    console.error('Translation error details:', error);
    // Add more context to the error
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Could not connect to Claude API. Please check your internet connection.');
    } else if (error.message.includes('401')) {
      throw new Error('Authentication error: Your API key may be invalid or expired.');
    } else if (error.message.includes('429')) {
      throw new Error('Rate limit exceeded: Too many requests to Claude API. Please try again later.');
    } else {
      throw error;
    }
  }
}