'use strict';

// Convert rendered HTML to plain text with preserved line breaks and paragraphs
function htmlToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = String(html || '').replace(/<br\s*\/?>(\s*)/gi, '\n');
  const text = div.textContent || '';
  return text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// Collect unique absolute image URLs from HTML (<img src>, [Image: URL] markers)
function collectImageUrls(html) {
  const urls = new Set();
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  div.querySelectorAll('img[src]').forEach(img => {
    const u = img.getAttribute('src') || '';
    if (/^https?:\/\//i.test(u)) urls.add(u);
  });
  (String(html || '').match(/\[Image:\s*(https?:\/\/[^\]\s]+)\]/gi) || [])
    .forEach(m => { const u = m.replace(/^\[Image:\s*/i,'').replace(/\]$/,'').trim(); urls.add(u); });
  return Array.from(urls);
}

// Sanitize filenames for downloaded assets
function sanitizeFilename(base, idx = 1, dateStr = '', domain = 'threads') {
  const safeBase = String(base || 'unknown').replace(/^@/, '').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 40) || 'unknown';
  const safeDom = String(domain || 'threads').replace(/[^a-z0-9.-]/gi, '-');
  const safeDate = String(dateStr || '').replace(/[^0-9-]/g, '') || '00000000';
  const n = String(idx).padStart(2, '0');
  return `${safeDom}_${safeBase}_${safeDate}_${n}.jpg`;
}

// Apply rule-based cleaning patterns safely
function applyCleaningPatterns(text, patterns) {
  let out = String(text || '');
  (patterns || []).forEach(p => { try { out = out.replace(p, ''); } catch (_) {} });
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

// Language-agnostic heuristic cleaning
function heuristicClean(text) {
  let out = String(text || '');
  // Standalone handles
  out = out.replace(/^@?[a-z0-9._-]{3,20}\s*$/gim, '');
  // 2-3 lines of pure small numbers (likely metrics)
  out = out.replace(/^(\d{1,3})\s*$\n^(\d{1,3})\s*$(?:\n^(\d{1,3})\s*$)?/gim, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

// Build Markdown from HTML and metadata
function buildMarkdown(html, meta) {
  const body = htmlToPlainText(html);
  const a = meta || {};
  const header = `# Thread by ${a.authorName || 'Unknown'} (${a.authorUsername || '@unknown'})\n\n` +
                 `${a.originalUrl ? ('Original: ' + a.originalUrl + '\n') : ''}` +
                 `${a.threadInfo || ''}\n\n---\n\n`;
  return (header + body + '\n');
}

window.RuntimeUtils = {
  htmlToPlainText,
  collectImageUrls,
  sanitizeFilename,
  applyCleaningPatterns,
  heuristicClean,
  buildMarkdown,
};
