# Thread-html

A Chrome extension for exporting Threads.net posts as clean, formatted HTML, PDF, and Markdown files.

## Features

- Clean and format Threads.net posts for easy reading
- Remove unwanted metadata, engagement metrics, and redundant author handles
- Convert posts to HTML with a responsive, clean design
- Interactive editing mode to highlight and remove content
- Export as PDF (using print functionality)
- Export as Markdown
- Smart Vietnamese content preservation (keeps numbered lists, principles, etc.)
- Works with single posts and entire threads

## Recent Updates

- **Enhanced content cleaning** - Improved patterns to detect and remove standalone numbers, metrics, and author handles 
- **Vietnamese content preservation** - Better detection of important content like "Nguyên tắc 1, 2, 3"
- **Author handle display fix** - Properly handle dots, underscores, and special characters in author usernames
- **Interactive editing** - Added hover highlighting and click-to-remove functionality
- **Multiple export formats** - Added support for HTML, PDF, and Markdown exports

## Usage

1. Install the extension from the Chrome Web Store
2. Navigate to a Threads.net post you want to export
3. Click the extension icon
4. Choose whether to export just the current post or the entire thread
5. Click "Preview" to view the cleaned content
6. Use the interactive editing buttons to further customize the content
7. Choose your preferred export format (HTML, PDF, Markdown)

## Content Cleaning

The extension uses several approaches to clean Thread posts:

- Removes engagement metrics (likes, views, shares)
- Cleans up repeated author handles at the beginning of posts
- Preserves important content including Vietnamese numbered lists
- Removes standalone numbers that indicate metrics
- Keeps content structure while removing UI elements and metadata

## Interactive Editing

The HTML preview includes an "Edit Mode" that lets you:
- Hover over content to highlight it
- Click elements to remove them
- Undo deletions with a single click
- Exit edit mode to return to normal viewing

## Exporting

After previewing and editing, you can:
- Download as HTML
- Save as PDF (using built-in printing)
- Export as Markdown
- Copy text to clipboard

## Development

To contribute to this project:

1. Clone the repository
2. Make your changes
3. Test the extension in Chrome by loading it as an unpacked extension
4. Submit a pull request with your changes

## License

This project is licensed under the MIT License. 