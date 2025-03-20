# Development Journal for Threads to HTML

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

3. **Improved text handling:**
   - Better preservation of line breaks within posts
   - More accurate handling of text extraction from HTML elements
   - Enhanced text cleaning patterns

4. **UI Improvements:**
   - Added success notification when text is copied
   - Implemented print media query to hide buttons when printing
   - Improved styling for mobile devices

### Current Issues (March 21, 2024)

1. **Copy functionality still not working:**
   - The copy button may fail due to clipboard API limitations in data URLs
   - Some browsers restrict clipboard access from data URLs for security reasons
   - Need to implement a fallback mechanism or alternative approach

2. **Avatar display issues:**
   - Author profile images often fail to load
   - This may be due to CORS restrictions or direct image URL access issues
   - Need to implement proper image loading or fallback placeholders

3. **Link and media handling:**
   - YouTube links don't render properly in the exported HTML
   - External URLs may not be correctly preserved
   - Media content (images, videos) needs better handling

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

Last updated: March 20, 2025 