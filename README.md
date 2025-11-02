# Threads to HTML (Chrome Extension)

Convert Threads posts (threads.com / threads.net) into clean HTML with a stable in‑extension preview, copy, PDF, and Markdown export.

## Features

- Preview in extension page (MV3‑safe, no inline JS)
- Copy Text (clipboard API + fallbacks)
- Save PDF (browser print)
- Save as Markdown (header + cleaned content)
- Images:
  - Preview displays images; auto‑proxy for hosts that block cross‑origin (fbcdn/cdninstagram)
  - “Images in thread” section with deduped links (params intact), labeled “image 1..N”
  - Premium: “Download Thread Images” button (bulk download; gating to be added later)
- Content cleanup:
  - Removes UI label “Hàng đầu” from content
  - No post separators (---)
- Export HTML:
  - Uses in‑text markers ([Image: URL], [YouTube: URL]) only (no per‑post embedding)
  - Filenames like `thread_<author>_<timestamp>.html`

## Permissions

- permissions: `activeTab`, `downloads`, `scripting`
- host_permissions:
  - `*://*.threads.com/*`, `*://*.threads.net/*`
  - `*://*.fbcdn.net/*`, `*://*.cdninstagram.com/*` (for image proxy in preview)

## Install

1. Clone or download this repo.
2. Open Chrome → `chrome://extensions`.
3. Enable “Developer mode”.
4. Click “Load unpacked” and select the repository folder.

## Use

1. Open a Threads post (threads.com or threads.net).
2. Click the extension icon → “Preview”.
3. In the preview tab:
   - Copy Text, Save PDF, Save as MD
   - View “Images in thread” links (image 1..N)
   - Load blocked images via auto‑proxy; use “Load via Proxy” if needed
   - Premium: “Download Thread Images” (bulk)

## Notes and Limitations

- Preview can proxy blocked images (fbcdn/cdninstagram). Exported HTML is static and cannot proxy; images may not render if the host blocks cross‑origin.
- URL parameters for image links are preserved (and used for dedupe).
- “Hàng đầu” label (VN UI copy) is removed; other languages will be added later.

## Troubleshooting

- “Please navigate to a Threads post”: ensure you’re on threads.com or threads.net.
- Images not visible in preview: try the “Load via Proxy” button on placeholders.
- Preview didn’t open: reload the extension and try again.

## What’s New (this version)

- Stable preview page (pages/preview.html/js), MV3‑compliant
- Background image proxy (`proxyFetchImage`) with limited host permissions
- Images list section with preserved URL params; Premium bulk download button
- Removed per‑post mediaUrls embedding; export relies on [Image:] and [YouTube:] markers
- Strips “Hàng đầu”; removed separators