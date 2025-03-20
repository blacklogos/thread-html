# Development Journal - Threads to HTML

## Version 0.1 - March 2025

This journal tracks the development progress, challenges, and future plans for the Threads to HTML Chrome extension.

### Initial Development

The first version of the extension focused on creating a minimal viable product that could:
1. Extract thread content from Threads.net
2. Clean up UI elements and metadata
3. Generate a clean HTML file with the content

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