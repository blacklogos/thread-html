# Threads to HTML

A Chrome extension that converts Threads.net posts to clean HTML files, preserving content while removing UI elements and unnecessary metadata.

**Version 0.3**

## Features

- Extract complete thread content from Threads.net posts
- Clean up UI elements, timestamps, metrics, and metadata
- Remove redundant author handles and usernames from post content
- Generate a single clean HTML file with all posts from the thread
- Preserve text formatting and line breaks from original posts
- Support for Vietnamese and English UI elements
- Easy customization of cleaning patterns without coding knowledge
- Save as PDF option using browser's print functionality
- Copy text with proper "---" dividers between posts
- Responsive design that works well on mobile and desktop

## Issues Fixed (March 22, 2024)
- Avatar images now display with reliable fallbacks (using author initials)
- YouTube links now show thumbnails with play button overlay
- Copy text functionality properly adds "---" dividers between posts
- External links display with proper formatting
- Image loading errors handled gracefully

## Known Issues (Still Working On)
- Some browser contexts may limit clipboard API access
- Very long threads may have performance issues
- Some rich media content from Threads may not display correctly
- Browser extensions like ad blockers might interfere with some functionality

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now be installed and visible in your Chrome toolbar

## Usage

1. Navigate to a Threads.net post or thread that you want to export
2. Click the extension icon in your Chrome toolbar
3. Click the "Convert to HTML" button
4. The thread will be processed and downloaded as an HTML file
5. Open the downloaded HTML file in any browser to view the clean content

## Customizing Text Cleaning

The extension removes UI elements, metadata, and other non-content text from the thread. You can customize which elements get removed by editing the `utils/cleaning-patterns.json` file.

### Pattern Structure

Each pattern in the JSON file has the following structure:

```json
{
  "name": "Pattern Name",
  "pattern": "regex_pattern",
  "flags": "regex_flags",
  "replacement": "replacement_text",
  "description": "Description of what this pattern does"
}
```

- **name**: A descriptive name for the pattern
- **pattern**: The regular expression pattern as a string (with escaped backslashes)
- **flags**: Regex flags (g, m, i, etc.)
- **replacement**: The text to replace matches with
- **description**: A description of what the pattern does

### Adding New Patterns

To add a new pattern:

1. Open `utils/cleaning-patterns.json`
2. Add a new pattern object to the "patterns" array
3. Save the file
4. Reload the extension in Chrome

### Example Pattern

To remove a text like "Posted on X platform":

```json
{
  "name": "Posted on platform",
  "pattern": "Posted on [\\w\\s]+ platform",
  "flags": "g",
  "replacement": "",
  "description": "Removes 'Posted on X platform' text"
}
```

## Troubleshooting

If the extension is not working properly:

1. Check the browser console for errors (Right-click > Inspect > Console)
2. Ensure the JSON patterns file is correctly formatted - invalid JSON will trigger fallback to default patterns
3. If patterns aren't being applied, try reloading the extension from the `chrome://extensions/` page
4. Verify permissions are correctly granted when requested
5. If the HTML output contains unwanted text, consider adding a new pattern to remove it

## Development

### Project Structure

- `popup.html` - The extension popup UI
- `popup.js` - Popup logic for handling user interactions
- `content.js` - Content script for extracting data from Threads posts
- `background.js` - Background script for cleaning text, generating HTML, and downloading
- `utils/cleaning-patterns.json` - Configurable cleaning patterns file
- `manifest.json` - Extension configuration and permissions

### How It Works

1. When the user clicks the "Convert to HTML" button in the popup, it sends a message to the active tab
2. The content script extracts posts, metadata, and media from the thread
3. Data is sent to the background script for processing
4. The background script cleans the text using patterns from `cleaning-patterns.json`
5. A clean HTML file is generated and downloaded

### Build and Test

This extension doesn't require a build step. To test changes:

1. Make your edits
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## Version History

- **0.3** (March 22, 2024)
  - Fixed "Copy Text" functionality to properly add "---" dividers between posts
  - Improved avatar display with color-coded initials for more reliable display
  - Better error handling for image loading and content display
  
- **0.2** (March 21, 2024)
  - Added "Copy Text" and "Save PDF" buttons
  - Fixed permission issues with content script injection
  - Improved handling of text content and line breaks
  - Enhanced UI elements with success notifications
  - Fixed various bugs with script execution in data URLs
  
- **0.1** (March 20, 2024)
  - Initial release
  - Support for text extraction and cleaning
  - Custom pattern system for removing UI elements
  - Basic HTML output with responsive design

## License

MIT License 