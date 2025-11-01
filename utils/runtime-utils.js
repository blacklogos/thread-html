'use strict';

// Convert rendered HTML to plain text with preserved line breaks and paragraphs
function htmlToPlainText(html) {
  let s = String(html || '');
  // Convert <br> to newline
  s = s.replace(/<br\s*\/?>(\s*)/gi, '\n');
  // Insert blank lines after common block elements when they close
  s = s.replace(/<\/(?:p|div|section|article|li|ul|ol|h[1-6])>/gi, '$&\n\n');
  // Remove opening tags of those blocks (no extra newline)
  s = s.replace(/<(?:p|div|section|article|li|ul|ol|h[1-6])[^>]*>/gi, '');
  const div = document.createElement('div');
  div.innerHTML = s;
  const text = div.textContent || '';
  return text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// Collect unique absolute image URLs from HTML (<img src>, [Image: URL] markers)
function collectImageUrls(html) {
  const urls = new Set();
  const div = document.createElement('div');
  div.innerHTML = String(html || '');

  // Helper to parse a srcset string and pick the last (often highest res)
  const pickFromSrcset = (srcset) => {
    try {
      const parts = String(srcset).split(',').map(s => s.trim()).filter(Boolean);
      if (!parts.length) return '';
      const last = parts[parts.length - 1].split(/\s+/)[0];
      return last || '';
    } catch { return ''; }
  };

  // <img> tags: prefer currentSrc, then srcset, then src
  div.querySelectorAll('img').forEach(img => {
    let u = '';
    if (img.currentSrc) u = img.currentSrc;
    if (!u && img.getAttribute('srcset')) u = pickFromSrcset(img.getAttribute('srcset'));
    if (!u) u = img.getAttribute('src') || '';
    if (/^https?:\/\//i.test(u)) urls.add(u);
  });

  // <source srcset> inside <picture>
  div.querySelectorAll('source[srcset]').forEach(src => {
    const u = pickFromSrcset(src.getAttribute('srcset'));
    if (/^https?:\/\//i.test(u)) urls.add(u);
  });

  // Markers like [Image: URL]
  (String(html || '').match(/\[Image:\s*(https?:\/\/[^\]\s]+)\]/gi) || [])
    .forEach(m => { const u = m.replace(/^\[Image:\s*/i,'').replace(/\]$/,'').trim(); if (/^https?:\/\//i.test(u)) urls.add(u); });

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
  const lines = String(text || '').split(/\n/);
  const preds = (patterns || []).map(p => (p instanceof RegExp ? p : new RegExp(p, 'i')));
  const out = [];
  let removedSinceLastKeep = false;
  for (const raw of lines) {
    const line = raw;
    const shouldRemove = preds.some(r => r.test(line.trim()));
    if (shouldRemove) { removedSinceLastKeep = true; continue; }
    if (out.length > 0 && removedSinceLastKeep && out[out.length - 1] !== '') {
      out.push('');
    }
    removedSinceLastKeep = false;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Language-agnostic heuristic cleaning
function heuristicClean(text) {
  const lines = String(text || '').split(/\n/);
  const kept = lines.filter(l => {
    const t = l.trim();
    if (t === '') return true; // preserve gaps (will be collapsed later)
    if (/^@?[a-z0-9._-]{3,20}$/i.test(t)) return false; // standalone handle
    if (/^\d{1,3}$/.test(t)) return false; // numeric-only small count
    return true;
  });
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
  // Utility helpers for preview features testing
  toggleContentEditable(el, enable){
    if (!el) return false;
    if (typeof enable === 'boolean') {
      el.setAttribute('contenteditable', enable ? 'true' : 'false');
    } else {
      const on = el.getAttribute('contenteditable') === 'true';
      el.setAttribute('contenteditable', on ? 'false' : 'true');
    }
    return el.getAttribute('contenteditable') === 'true';
  },
  buildImageDownloadPlan(html, authorUsername='unknown', domain='threads', dateStr='00000000'){
    const urls = collectImageUrls(html);
    const author = String(authorUsername||'').replace(/^@/,'') || 'unknown';
    const plan = [];
    let idx = 0;
    urls.forEach(u=>{
      idx += 1;
      // Try to preserve extension
      const m = (u.split('?')[0].split('#')[0].match(/\.(jpg|jpeg|png|gif|webp)$/i));
      const ext = m ? (m[0].toLowerCase()) : '.jpg';
      const n = String(idx).padStart(2,'0');
      const fname = `${domain}_${author}_${dateStr}_${n}${ext.startsWith('.')?'':'.'}${ext.replace(/^\./,'')}`;
      plan.push({ url: u, filename: fname });
    });
    return plan;
  }
};
