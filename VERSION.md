# Version History

## v0.3.0 - March 22, 2024

### Release Notes

Improves copy functionality and avatar display reliability.

#### Key Improvements
- Fixed "Copy Text" functionality to properly add "---" dividers between posts
- Enhanced avatar display with color-coded initials as fallback
- Improved error handling for image loading failures
- Better HTML-to-text conversion for copied content

#### Technical Details
- Implemented dual-layer avatar system with image and initials
- Improved content parsing for proper text extraction
- Better error handling across all operations

## v0.2.0 - March 21, 2024

### Release Notes

Added utility buttons and fixed critical bugs.

#### Key Improvements
- Added "Copy Text" and "Save PDF" buttons
- Fixed permission issues with content script injection
- Improved text handling and line break preservation
- Enhanced UI with success notifications
- Better media handling for YouTube links and images

#### Technical Details
- Implemented multi-layered clipboard access approach
- Added fallback mechanisms for browser restrictions
- Fixed pattern loading with better error handling

## v0.1.0 - March 20, 2024

### Release Notes

Initial release of the Threads to HTML Chrome extension.

#### Core Features
- Extract thread content from Threads.net
- Clean up UI elements and metadata
- Generate a clean HTML file with the thread content
- Preserve links and mentions as clickable elements
- Display author information with profile picture

#### Technical Highlights
- Pattern-based text cleaning system
- Configurable cleaning patterns via JSON
- Responsive HTML output format
- Support for Vietnamese and English UI elements
- Automatic cache busting to ensure fresh content

#### Known Issues
- Does not download media files (images, videos)
- No options page for configuration
- Limited theme support (only light mode)
- Limited language support (primarily English and Vietnamese)

#### Future Plans
See JOURNAL.md for detailed development roadmap.

---

© 2024 | Released under MIT License 