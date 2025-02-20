// Constants
const CLAUDE_API = {
  URL: "https://api.anthropic.com/v1/messages",
  VERSION: "2023-06-01",
  MODEL: "claude-3-5-sonnet-20241022",
  MAX_TOKENS: 1024
};

const CONTEXT_MENU = {
  id: "translateToChinese",
  title: "Translate to Chinese",
  contexts: ["selection"]
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create(CONTEXT_MENU);
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU.id) {
    handleContextMenuClick(info.selectionText, tab.id);
  }
});

// Handle connection from popup
chrome.runtime.onConnect.addListener((port) => {
  console.log('Popup connected');
  
  // Send initial API key status
  sendApiKeyStatus(port);

  port.onMessage.addListener(async (request) => {
    console.log('Received request:', request);
    
    switch (request.action) {
      case "translateText":
        await handleTranslateRequest(request.text, port);
        break;
      case "updateApiKey":
        await handleApiKeyUpdate(request.apiKey, port);
        break;
    }
  });
});

// Helper Functions
async function handleContextMenuClick(selectedText, tabId) {
  if (!selectedText) {
    showNotification("Error", "No text selected");
    return;
  }

  const data = await chrome.storage.local.get("apiKey");
  if (!data.apiKey) {
    showNotification("Error", "Please set your API key in the extension options");
    return;
  }

  translateText(selectedText, data.apiKey, tabId);
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

async function handleApiKeyUpdate(apiKey, port) {
  await chrome.storage.local.set({ apiKey });
  port.postMessage({
    type: 'apiKeyStatus',
    hasKey: true
  });
}

async function sendApiKeyStatus(port) {
  const data = await chrome.storage.local.get("apiKey");
  port.postMessage({
    type: 'apiKeyStatus',
    hasKey: !!data.apiKey
  });
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

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'logo.png',
    title,
    message
  });
}

// Translation Function
async function translateTextWithResult(text, apiKey, port) {
  try {
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
- Advanced grammatical
- Cultural context or multiple meanings
- Unusual sentence patterns

Try to keep the annotations concise and to the point. Format each annotation as:
● [English word/phrase/structure] - [Chinese translation]
- [Detailed explanation in Chinese covering relevant aspects:
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      // Convert the chunk to text
      const chunk = new TextDecoder().decode(value);
      buffer += chunk;
      
      // Process complete messages from the buffer
      let messages = buffer.split('\n\n');
      buffer = messages.pop() || ''; // Keep the last incomplete message in the buffer
      
      for (const message of messages) {
        if (!message.trim()) continue;
        
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

    // Store and return the final result
    const timestamp = new Date().toLocaleString();
    await chrome.storage.local.set({
      selectedText: text,
      translationResult: fullText,
      translationTimestamp: timestamp
    });

    return fullText;
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}
