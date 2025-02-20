# Chrome Extension: Text Translator

This Chrome extension allows users to translate selected text on any webpage to Chinese using the Anthropic Claude API.

## Features

- Right-click menu integration for easy translation
- Secure API key management
- Translation of selected text to Chinese
- Clean popup display of translations

## Setup Instructions

1. Clone this repository
2. Load this directory in Chrome as an [unpacked extension](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked)
3. Click the extension icon in Chrome's toolbar and select "Options"
4. Enter your Anthropic Claude API key in the options page
5. Save your API key

## Using the Translator

1. Select any text on a webpage
2. Right-click the selected text
3. Choose "Translate to Chinese" from the context menu
4. The translation will appear in a popup window

## Troubleshooting

- If no translation appears, check that your API key is correctly set in the options page
- Make sure you have selected text before attempting to translate
- Check your internet connection if translations fail

## Privacy & Security

- Your API key is stored securely in Chrome's local storage
- No translation data is stored permanently
- All translations are performed directly through the Anthropic Claude API

## Requirements

- Google Chrome browser
- Anthropic Claude API key
