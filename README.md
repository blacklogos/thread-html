# Threads to HTML (Chrome Extension)

Threads to HTML turns any Threads post into a polished offline archive with an interactive preview tab, clean exports, and tooling that respects Chrome’s MV3 rules.

## Highlights

### Preview & Editing
- Opens a dedicated preview tab (MV3-safe, no inline scripts) with full thread context, metadata, and author card.
- Toggle edit mode to prune content in-place before exporting.
- Displays word count and reading-time estimates alongside the thread.

### Clean Exports
- Download rich HTML with author metadata, consistent filenames (`thread_<author>_<timestamp>.html`), and sanitized markup.
- Export Markdown or plain text with automatic source attribution and normalized spacing.
- Print-ready PDF uses the browser print dialog to capture the rendered preview.

### Image Handling
- Inline images render in the preview, even when Threads’ CDNs block cross-origin requests, thanks to an on-demand proxy fallback.
- “Images in thread” lists every deduped media URL so you can inspect or open them directly.
- Bulk image download queues each asset for saving with deterministic filenames.

### Productivity Boosts
- Keyboard shortcuts accelerate common actions (copy, export, edit toggles).
- Background service worker keeps state for recent previews so you can re-download without re-scraping.
- Cleans repeated UI chrome (timestamps, metrics, handles) using a configurable ruleset.

## Installation

1. Clone this repository or download the source ZIP.
2. In Chrome, navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Choose **Load unpacked** and select the project directory.

## Usage

1. Browse to any Threads post on `threads.com` or `threads.net`.
2. Click the extension icon and pick **Preview** to launch the preview tab, or **Download HTML** to save immediately.
3. Inside the preview tab you can:
   - Copy the cleaned text, save Markdown/TXT/PDF, or download the generated HTML.
   - Toggle edit mode to remove unwanted snippets before exporting.
   - Inspect the deduped image list, open originals, or trigger the bulk download button.
   - Retry blocked media with **Load via Proxy** when a CDN denies direct access.

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `c` | Copy cleaned thread text |
| `p` | Open print dialog for PDF |
| `m` | Save Markdown file |
| `Shift + m` | Copy Markdown to clipboard |
| `t` | Save plain-text export |
| `e` | Toggle edit mode |

Shortcuts ignore modifier keys and skip inputs/contenteditable regions to avoid conflicts.

## Permissions & Rationale

- `activeTab` — injects the content script only when you request a preview or download.
- `downloads` — saves generated HTML, Markdown, TXT, and fetched images.
- `scripting` — programmatically injects the content script on demand (MV3 requirement).
- Host access `threads.com`, `threads.net` — reads thread content directly from the viewed page.
- Host access `fbcdn.net`, `cdninstagram.com` — enables the background proxy to fetch blocked media for preview-only display.

All scraping and exports happen locally; no data is transmitted to remote services.

## Content Cleanup & Limitations

- The background worker loads regex patterns from `utils/cleaning-patterns.json` to strip timestamps, metrics, translations, and repeated handles.
- Proxy-fetching is limited to preview rendering. Exported HTML remains static and cannot bypass CDN protections — blocked images may require manual downloads.
- Threads UI changes can break selectors; if extraction fails, refresh the page or update the patterns/selectors in `content.js`.
- The “Download Thread Images” button currently runs client-side; premium gating will be added later.

## Project Layout

- `manifest.json` — MV3 definition, permissions, and action routing.
- `popup.html` / `popup.js` — entry point for preview/download requests.
- `content.js` — scrapes thread metadata, posts, and media references from the active tab.
- `background.js` — orchestrates cleaning, HTML generation, downloads, and preview state.
- `pages/preview.*` — standalone preview UI with export controls, keyboard shortcuts, and image tooling.
- `utils/cleaning-patterns.json` — configurable cleanup rules applied before rendering/exporting.

Adjust patterns or UI assets as needed, then reload the unpacked extension to see changes.