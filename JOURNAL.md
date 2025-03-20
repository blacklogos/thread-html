# Development Journal for Threads to HTML

## Version 0.3 (March 22, 2024)

### Changes Implemented

1. **Fixed Copy Text functionality:**
   - Resolved issue with "---" dividers not appearing properly between posts
   - Improved HTML-to-text conversion during copy operations
   - Better handling of line breaks and content formatting

2. **Enhanced Avatar Display:**
   - Implemented initials-based fallback system for avatars
   - Added custom color generation based on author name
   - Created dual-layer approach with image and initials elements
   - Improved error handling for avatar image loading

3. **Better Error Handling:**
   - Added more graceful fallbacks for failed operations
   - Improved reliability across different browsers and contexts
   - Enhanced user feedback for operation success/failure

### Next Steps

1. **Enhance media handling:**
   - Improve support for Instagram reels and video content
   - Better handling of image galleries and carousels
   - Optimize image loading and display

2. **Add user settings:**
   - Create options for customizing exported HTML
   - Allow users to choose between different templates
   - Provide controls for which elements to include/exclude

## Version 0.2 (March 21, 2024)

### Changes Implemented

1. **Added utility buttons:**
   - "Copy Text" button that extracts the content and copies to clipboard with posts separated by "---" dividers
   - "Save PDF" button that uses the browser's print functionality to save content as PDF

2. **Fixed critical bugs:**
   - Added "scripting" permission to manifest.json to fix content script injection issue
   - Resolved "Cannot read properties of undefined (reading 'executeScript')" error 
   - Fixed ReferenceError for copyText and savePDF functions in data URLs
   - Implemented inline function execution in button onclick attributes to avoid dependency on external script functions
   - Fixed pattern loading errors with improved error handling and fallbacks

3. **Improved text handling:**
   - Better preservation of line breaks within posts
   - More accurate handling of text extraction from HTML elements
   - Enhanced text cleaning patterns

4. **UI Improvements:**
   - Added success notification when text is copied
   - Implemented print media query to hide buttons when printing
   - Improved styling for mobile devices
   - Added multiple fallback mechanisms for clipboard operations

5. **Media handling improvements:**
   - Fixed avatar display with reliable CDN-hosted fallbacks
   - Enhanced YouTube link handling with thumbnails and play button overlay
   - Added better error handling for image loading
   - Improved external link display with domain name highlighting

### Latest Fixes (March 21, 2024)

1. **Pattern loading improvements:**
   - Added robust error handling in JSON pattern loading
   - Added validation for pattern format and properties
   - Implemented safe RegExp creation with error catching
   - Better logging of pattern loading status
   - Moved pattern loading into a dedicated function

2. **Copy functionality:**
   - Implemented multi-layered clipboard access approach
   - Added fallback to document.execCommand when Clipboard API fails
   - Created manual copy interface with textarea when both methods fail
   - Added clear instructions and a close button for manual copy

3. **Media handling:**
   - Fixed avatar display with CDN-based fallback images
   - Added error handlers to all images with emoji fallbacks
   - Improved YouTube link handling with proper video ID extraction
   - Enhanced external link display with domain highlighting

### Current Issues

Some browser contexts may still limit clipboard access due to security restrictions, but our multiple fallback mechanisms should cover most scenarios. Long threads may experience performance issues, and some rich media content from Threads may not display perfectly.

### Immediate Next Steps

1. **Fix copy functionality:**
   - Implement a more robust clipboard access method
   - Add a fallback text area for manual copy when API fails
   - Test across different browsers and contexts

2. **Fix avatar display:**
   - Investigate CORS issues with Threads images
   - Implement base64 encoding for avatars when possible
   - Add fallback avatar placeholders that work reliably

3. **Improve link handling:**
   - Fix YouTube link detection and rendering
   - Enhance external URL preservation logic
   - Better formatting for links in the exported HTML

### Known Issues

- Avatar images sometimes fail to load or display correctly
- Some rich media content (such as embedded videos) is not preserved
- Clipboard API might behave differently across browsers

### Next Steps

1. **Fix avatar display issues:**
   - Investigate why avatar images sometimes fail to load
   - Implement better fallback mechanisms for missing avatars
   - Consider caching images or using base64 encoding for reliability

2. **Improve media handling:**
   - Better support for videos and rich media content
   - Consider thumbnail generation for videos
   - Implement better media detection patterns

3. **Enhance text formatting:**
   - Preserve more of the original text formatting
   - Support for bold, italic, and other rich text
   - Better handling of emojis and special characters

4. **Performance optimizations:**
   - Reduce memory usage for large threads
   - Improve processing speed for content extraction
   - Better error handling and user feedback

5. **User experience improvements:**
   - Progress indicator during processing
   - Options page for customization
   - Dark mode support

## Version 0.1 (March 2024)

### Initial Implementation

1. Basic extraction of thread content
2. Cleaning patterns for removing UI elements
3. Simple HTML generation with responsive design
4. Support for Vietnamese and English UI elements

### Key Features Implemented

- **Content Extraction**: Implemented a content script that can extract posts, author information, and metadata from Threads.net pages.
- **Text Cleaning System**: Created a pattern-based cleaning system that removes UI elements, timestamps, metrics, and other non-content text.
- **Pattern Customization**: Developed a JSON-based pattern system that allows users to easily add, modify, or remove cleaning patterns without coding.
- **HTML Generation**: Created a clean, responsive HTML template for displaying the thread content.
- **Error Handling**: Added robust error handling and fallback mechanisms to ensure the extension works even if parts of it fail.

### Challenges and Solutions

| Challenge | Solution |
|-----------|----------|
| MIME type errors with ES modules | Switched from ES6 imports to fetch API for loading patterns |
| Inconsistent HTML structure on Threads | Implemented multiple selector fallbacks to find content |
| Finding author information | Added extraction from meta tags and multiple fallback methods |
| Cached content in exports | Added cache-busting mechanisms to ensure fresh content |
| Cleaning various UI elements | Created a comprehensive pattern dictionary with support for multiple languages |

### User Feedback and Issues Addressed

- Added support for Vietnamese UI elements based on user feedback
- Fixed issue with duplicate posts in the exported HTML
- Improved pattern matching to remove more UI elements
- Addressed issues with author handles appearing in content

### Future Plans

#### Short-term Goals (for v0.2)
- [ ] Add option to save media files (images, videos) with the HTML
- [ ] Implement a more comprehensive theme system with light/dark mode
- [ ] Add options page for user configuration
- [ ] Improve error messaging in the UI

#### Mid-term Goals (for v0.5)
- [ ] Add support for exporting to PDF or Markdown formats
- [ ] Create a dynamic pattern update system
- [ ] Support for more languages and regional UI elements
- [ ] Add options for custom CSS in the exported HTML

#### Long-term Vision (v1.0+)
- [ ] Create a browser-agnostic version (Firefox, Safari)
- [ ] Add offline mode for viewing previously exported threads
- [ ] Implement batch export functionality
- [ ] Support for other social media platforms

### Technical Debt and Improvements

- Refactor the pattern application system for better performance
- Improve the HTML template with more semantic markup
- Add unit tests for key functionality
- Create a proper build system for easier deployment

### Lessons Learned

1. Browser extension development has unique constraints, particularly around ES modules and MV3 compatibility
2. Social media platforms often change their HTML structure, requiring robust selector strategies
3. Text processing with regex requires careful pattern design to avoid unintended consequences
4. User-facing error messages are critical for troubleshooting
5. JSON-based configuration provides a good balance of flexibility and usability

---

Last updated: March 22, 2024 