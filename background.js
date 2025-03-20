// Initialize the cleaning patterns
let cleaningPatterns = [];

// Load patterns from JSON file using fetch with better error handling
function loadPatternsFromJson() {
  console.log('Attempting to load cleaning patterns from JSON...');
  
  fetch('./utils/cleaning-patterns.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load patterns: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (!data || !Array.isArray(data.patterns)) {
        throw new Error('Invalid patterns format: expected array in "patterns" property');
      }
      
      // Convert string patterns from JSON to actual RegExp objects
      cleaningPatterns = data.patterns.map(pattern => {
        try {
          return {
            name: pattern.name || 'Unnamed pattern',
            pattern: new RegExp(pattern.pattern, pattern.flags || 'g'),
            replacement: pattern.replacement || '',
            description: pattern.description || ''
          };
        } catch (regexError) {
          console.error(`Invalid regex pattern "${pattern.pattern}": ${regexError.message}`);
          return null;
        }
      }).filter(Boolean); // Filter out any null patterns from regex errors
      
      console.log(`Loaded ${cleaningPatterns.length} cleaning patterns from cleaning-patterns.json`);
      console.log('To modify patterns, edit utils/cleaning-patterns.json');
    })
    .catch(error => {
      console.error('Error loading cleaning patterns:', error);
      // Use default patterns as fallback
      initializeDefaultPatterns();
    });
}

// Fallback function to initialize default patterns if JSON loading fails
function initializeDefaultPatterns() {
  console.log('Using default patterns');
  cleaningPatterns = [
    { pattern: /^(@[a-zA-Z0-9_.-]+|[a-zA-Z0-9_]+)\n/m, replacement: '', name: 'Username/handle at start' },
    { pattern: /\d{1,2}\/\d{1,2}\/\d{4}\n/g, replacement: '', name: 'Date (MM/DD/YYYY)' },
    { pattern: /\n\d+ (days?|hours?|minutes?|seconds?) ago\b/g, replacement: '', name: 'Relative time (English)' },
    { pattern: /\n\d+ (ngày|giờ|phút|giây)( trước)?\b/g, replacement: '', name: 'Relative time (Vietnamese)' },
    { pattern: /\n\d+\n\d+\n\d+(\n\d+)?$/g, replacement: '', name: 'Multiple metrics' },
    { pattern: /\n\d+ (likes?|replies?|reposts?|comments?)(\n|$)/g, replacement: '\n', name: 'Engagement metrics (English)' },
    { pattern: /\n\d+ (lượt thích|bình luận|trả lời|chia sẻ)(\n|$)/g, replacement: '\n', name: 'Engagement metrics (Vietnamese)' },
    { pattern: /\nTranslate\n/g, replacement: '\n', name: 'Translate (English)' },
    { pattern: /\nDịch\n/g, replacement: '\n', name: 'Translate (Vietnamese)' },
    { pattern: /\nThread trả lời\n/g, replacement: '\n', name: 'Reply thread (Vietnamese)' },
    { pattern: /\nReply thread\n/g, replacement: '\n', name: 'Reply thread (English)' },
    { pattern: /\nXem hoạt động\n/g, replacement: '\n', name: 'View activity (Vietnamese)' },
    { pattern: /\nView activity\n/g, replacement: '\n', name: 'View activity (English)' },
    { pattern: /@[a-zA-Z0-9._-]+\s*$/gm, replacement: '', name: 'Handle at end of line' },
    { pattern: /^@[a-zA-Z0-9._-]+\s*/gm, replacement: '', name: 'Handle at start of line' },
    { pattern: /\n{3,}/g, replacement: '\n\n', name: 'Multiple line breaks' }
  ];
}

// Load patterns immediately when script loads
loadPatternsFromJson();

// Track active preview tabs
let previewTabs = {};

// Function to fetch an image and convert it to base64
async function fetchImageAsBase64(url) {
  try {
    console.log('Fetching image as base64:', url);
    
    // If URL is already a data URL, return it as is
    if (url.startsWith('data:')) {
      console.log('URL is already a data URL, returning as is');
      return url;
    }
    
    // If the URL is relative, it can't be fetched, so use default
    if (!url.startsWith('http')) {
      console.log('URL is not absolute, using default avatar');
      return 'https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/1f464.png';
    }
    
    // Ensure the URL is HTTPS to avoid mixed content issues
    if (url.startsWith('http:')) {
      url = url.replace(/^http:/, 'https:');
      console.log('Converted to HTTPS:', url);
    }
    
    // Properly encode URL to handle special characters
    const encodedUrl = encodeURI(url);
    
    // Try fetching with regular CORS mode
    try {
      const response = await fetch(encodedUrl, { 
        mode: 'cors',
        cache: 'force-cache' 
      });
      
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
      
      throw new Error(`Failed to fetch image: ${response.status}`);
    } catch (corsError) {
      console.log('CORS fetch failed:', corsError);
      // Fall back to using the original URL with error handler in the img tag
      console.log('Using original URL with error handler');
      return encodedUrl;
    }
  } catch (error) {
    console.error('Failed to fetch image:', error);
    // Return a reliable default avatar
    return 'https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/1f464.png';
  }
}

// Function to generate HTML content from thread data
async function generateHtmlContent(data) {
  const { posts, author, url: threadUrl } = data;
  
  // Try to get author information from metadata if available
  let authorName = 'Unknown Author';
  let authorUsername = 'unknown';
  let avatarUrl = '';
  
  if (data.metaData) {
    // Extract author name and username from og:title if available
    if (data.metaData.ogTitle) {
      const titleMatch = data.metaData.ogTitle.match(/on Threads: "(.*)" \| (@[a-zA-Z0-9._]+)/);
      if (titleMatch && titleMatch.length >= 3) {
        authorName = titleMatch[1] || authorName;
        authorUsername = titleMatch[2] || authorUsername;
      } else {
        // Simpler fallback pattern
        const simpleTitleMatch = data.metaData.ogTitle.match(/(.*) \(@([a-zA-Z0-9._]+)\)/);
        if (simpleTitleMatch && simpleTitleMatch.length >= 3) {
          authorName = simpleTitleMatch[1] || authorName;
          authorUsername = `@${simpleTitleMatch[2]}` || authorUsername;
        }
      }
    }
    
    // Get avatar from og:image
    if (data.metaData.ogImage) {
      avatarUrl = data.metaData.ogImage;
    }
  }
  
  // Fallback to author data provided directly if metadata extraction failed
  if (authorName === 'Unknown Author' && author && author.displayName) {
    authorName = author.displayName;
  }
  
  if (authorUsername === 'unknown' && author && author.name) {
    authorUsername = author.name.startsWith('@') ? author.name : `@${author.name}`;
  }
  
  if (!avatarUrl && author && author.avatarUrl) {
    avatarUrl = author.avatarUrl;
  }
  
  // Fallback avatar
  if (!avatarUrl && posts && posts[0] && posts[0].mediaUrls && posts[0].mediaUrls[0]) {
    avatarUrl = posts[0].mediaUrls[0];
  }
  
  // Default avatar if none found - provide a reliable default from a CDN
  if (!avatarUrl) {
    avatarUrl = 'https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/1f464.png';
  }
  
  // Ensure avatar URL is HTTPS to avoid mixed content issues
  if (avatarUrl && avatarUrl.startsWith('http:')) {
    console.log('Converting avatar URL from HTTP to HTTPS');
    avatarUrl = avatarUrl.replace(/^http:/, 'https:');
  }
  
  // Try to convert avatar to base64 for embedding, but don't wait too long
  let base64Avatar = avatarUrl;
  try {
    console.log('Converting avatar to base64:', avatarUrl);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Fetch timeout')), 3000)
    );
    base64Avatar = await Promise.race([
      fetchImageAsBase64(avatarUrl),
      timeoutPromise
    ]);
    console.log('Successfully processed avatar URL');
  } catch (error) {
    console.error('Failed to convert avatar to base64:', error);
    // Keep the original URL if conversion fails
    base64Avatar = avatarUrl;
  }
  
  // For testing: log the avatar URL being used
  console.log('Using avatar URL:', 
    typeof base64Avatar === 'string' && base64Avatar.length > 100 
      ? base64Avatar.substring(0, 100) + '...' 
      : base64Avatar
  );
  
  // Ensure authorUsername is clean and valid for file naming
  let sanitizedAuthorUsername = 'unknown';
  if (authorUsername && authorUsername !== 'unknown') {
    // Remove @ symbol if present
    sanitizedAuthorUsername = authorUsername.replace(/^@/, '');
    
    // Ensure it's not empty
    if (!sanitizedAuthorUsername || sanitizedAuthorUsername.trim() === '') {
      sanitizedAuthorUsername = 'unknown';
    }
  }
  
  // Function to create author-specific cleaning patterns
  function createAuthorCleaningPatterns(username) {
    const patterns = [...cleaningPatterns];
    
    if (username && username !== 'unknown') {
      // Extract username without @ if present
      const usernameWithoutAt = username.startsWith('@') 
        ? username.substring(1) 
        : username;
      
      // Escape special characters in username for regex
      const escapedUsername = usernameWithoutAt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Add patterns to remove this specific author's handle ONLY in the content
      patterns.push({ 
        pattern: new RegExp(`(?<!<div class="author-name"|<div class="author-username">)^${escapedUsername}\\s*$`, 'gim'), 
        replacement: '' 
      });
      patterns.push({ 
        pattern: new RegExp(`(?<!<div class="author-name"|<div class="author-username">)^@${escapedUsername}\\s*$`, 'gim'), 
        replacement: '' 
      });
      patterns.push({ 
        pattern: new RegExp(`(?<!<div class="author-name"|<div class="author-username">)\\s${escapedUsername}\\s`, 'g'), 
        replacement: ' ' 
      });
      patterns.push({ 
        pattern: new RegExp(`(?<!<div class="author-name"|<div class="author-username">)\\s@${escapedUsername}\\s`, 'g'), 
        replacement: ' ' 
      });
    }
    
    return patterns;
  }
  
  // Get cleaned posts - only extract the pure content
  const cleanedPosts = posts.map(post => {
    // Clean up the post text by removing metadata, usernames, dates, metrics
    let cleanText = post.postText || 'No content available';
    let mediaContent = [];
    
    // First, extract and store all URLs before any cleaning
    const urlMatches = cleanText.match(/(https?:\/\/[^\s]+)/gi) || [];
    
    // Process and categorize each URL
    urlMatches.forEach(url => {
      // Clean the URL (remove any trailing punctuation or breaks)
      const cleanUrl = url.replace(/[.,!?]$/, '').trim();
      
      // Categorize the URL
      if (cleanUrl.match(/youtube\.com\/watch|youtu\.be\//i)) {
        mediaContent.push({
          type: 'youtube',
          url: cleanUrl,
          originalText: url
        });
      } else if (cleanUrl.match(/\.(jpg|jpeg|png|gif|webp)([?#].*)?$/i)) {
        mediaContent.push({
          type: 'image',
          url: cleanUrl,
          originalText: url
        });
      } else {
        mediaContent.push({
          type: 'link',
          url: cleanUrl,
          originalText: url
        });
      }
    });
    
    // Remove all URLs from the text temporarily
    cleanText = cleanText.replace(/(https?:\/\/[^\s]+)/gi, '');
    
    // Get cleaning patterns including author-specific ones
    const patterns = createAuthorCleaningPatterns(authorUsername);
    
    // Apply all cleaning patterns first
    patterns.forEach(({ pattern, replacement }) => {
      cleanText = cleanText.replace(pattern, replacement);
    });
    
    // Clean up whitespace while preserving line breaks
    cleanText = cleanText
      .split('\n')                    // Split into lines
      .map(line => line.trim())       // Trim each line
      .filter(line => line.length > 0) // Remove empty lines
      .join('\n');                    // Join back with original line breaks
    
    // Add back media content if exists
    if (mediaContent.length > 0) {
      // Group by type
      const youtubeLinks = mediaContent.filter(m => m.type === 'youtube');
      const images = mediaContent.filter(m => m.type === 'image');
      const otherLinks = mediaContent.filter(m => m.type === 'link');
      
      // Add YouTube links first
      youtubeLinks.forEach(media => {
        cleanText += '\n[YouTube: ' + media.url + ']';
      });
      
      // Then images
      images.forEach(media => {
        cleanText += '\n[Image: ' + media.url + ']';
      });
      
      // Finally other links
      otherLinks.forEach(media => {
        cleanText += '\n[Link: ' + media.url + ']';
      });
    }
    
    return cleanText.trim();
  });
  
  // Filter out empty posts
  const nonEmptyPosts = cleanedPosts.filter(post => 
    post.length > 0 && 
    post !== 'No content available' && 
    !/^\s*$/.test(post)
  );
  
  // Use non-empty posts or default to original cleaned posts if all were filtered out
  const finalPosts = nonEmptyPosts.length > 0 ? nonEmptyPosts : cleanedPosts;
  
  // Join all cleaned posts with double line breaks and convert to HTML breaks
  let threadContent = finalPosts.join('\n\n\n')  // Three newlines between posts
    .split('\n')                                 // Split all lines
    .map(line => line.trim())                    // Trim each line
    .filter(line => line.length > 0)             // Remove empty lines
    .join('<br>')                                // Convert to HTML breaks
    .replace(/<br>\s*<br>\s*<br>\s*<br>+/g, '<br><br><br>')  // Max triple breaks between posts
    .trim();
  
  // Final cleanup of any remaining excessive line breaks
  threadContent = threadContent
    .replace(/^<br>|<br>$/g, '')                // Remove breaks at start/end
    .trim();
  
  // Count total words for read time calculation
  const totalWords = threadContent.split(/\s+/).length;
  
  // Estimate read time (average reading speed is ~200-250 words per minute)
  const readTimeMinutes = Math.max(1, Math.round(totalWords / 200));
  
  // Generate a unique timestamp for this export
  const timestamp = Date.now();
  
  console.log('Generating HTML content for author:', authorName);
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>${authorName}'s Thread</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Thread by ${authorName} (${authorUsername}) on Threads">
  <style>
    :root {
      --bg-color: #ffffff;
      --text-color: #333333;
      --border-color: #e9ecef;
      --muted-color: #6c757d;
      --link-color: #0095f6;
      --button-bg: #0095f6;
      --button-hover: #0056b3;
      --header-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      --body-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--body-font);
      max-width: 680px;
      margin: 0 auto;
      padding: 30px 20px;
      line-height: 1.6;
      background-color: var(--bg-color);
      color: var(--text-color);
    }
    
    a {
      color: var(--link-color);
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    /* Author section */
    .author-header {
      display: flex;
      align-items: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .author-image-container {
      position: relative;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      overflow: hidden;
      background-color: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .author-image-container::before {
      content: "👤";
      font-size: 40px;
      line-height: 1;
    }
    
    .author-image {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      margin-right: 20px;
      object-fit: cover;
      display: block; /* Ensure it's not hidden */
      background-color: #f0f0f0; /* Light background while loading */
    }
    
    .author-info {
      flex-grow: 1;
    }
    
    .author-name {
      font-family: var(--header-font);
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .author-username {
      color: var(--muted-color);
      font-size: 1rem;
    }
    
    .thread-info {
      color: var(--muted-color);
      font-size: 0.9rem;
      margin-top: 5px;
    }
    
    /* Article content */
    .article {
      font-size: 1.05rem;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
      margin-bottom: 20px;
    }
    
    .article br {
      display: block;
      margin: 10px 0;
      content: "";
    }
    
    /* Footer */
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
      text-align: center;
      color: var(--muted-color);
      font-size: 0.9rem;
    }
    
    .download-info {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #28a745;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      z-index: 1000;
      animation: fadeOut 5s forwards 2s;
    }
    
    @keyframes fadeOut {
      to {
        opacity: 0;
        visibility: hidden;
      }
    }
    
    /* Responsive styles */
    @media (max-width: 600px) {
      body {
        padding: 20px 15px;
      }
      
      .author-image {
        width: 50px;
        height: 50px;
      }
      
      .author-name {
        font-size: 1.3rem;
      }
      
      .article {
        font-size: 1rem;
      }
    }
    
    /* Print styles */
    @media print {
      body {
        font-size: 12pt;
        line-height: 1.5;
        color: #000;
      }
      
      .footer, .download-info {
        display: none;
      }
    }
    
    .post-image {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 15px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .post-link {
      display: block;
      margin: 15px 0;
      padding: 12px 15px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      text-decoration: none;
      color: var(--text-color);
      background-color: #f8f9fa;
      transition: all 0.2s ease;
      font-size: 0.95em;
      word-break: break-all;
    }
    
    .post-link:hover {
      background-color: #f1f3f5;
      border-color: #dee2e6;
      text-decoration: none;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    .post-link::before {
      margin-right: 8px;
      opacity: 0.7;
    }
    
    .post-link.youtube::before {
      content: '▶️';
    }
    
    .post-link.external::before {
      content: '🔗';
    }
    
    .post-link .link-text {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .post-link .link-domain {
      display: block;
      font-weight: bold;
      margin-bottom: 5px;
      color: var(--muted-color);
      font-size: 0.9em;
    }
    
    .youtube-container {
      margin: 15px 0;
    }
    
    .youtube-thumbnail {
      position: relative;
      display: block;
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    
    .youtube-thumbnail img {
      width: 100%;
      display: block;
      height: auto;
      border-radius: 8px;
      transition: all 0.3s ease;
    }
    
    .youtube-play-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60px;
      height: 60px;
      background-color: rgba(0, 0, 0, 0.7);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      pointer-events: none;
    }
    
    .youtube-container:hover .youtube-thumbnail img {
      transform: scale(1.05);
    }
    
    .action-buttons {
      margin-top: 15px;
      display: flex;
      gap: 10px;
    }
    
    .action-button {
      padding: 6px 12px;
      font-size: 0.9rem;
      border: none;
      border-radius: 4px;
      background-color: var(--button-bg);
      color: white;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .action-button:hover {
      background-color: var(--button-hover);
    }
    
    .copy-success {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #28a745;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      animation: fadeOut 2s forwards;
    }
    
    @keyframes fadeOut {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }
    
    @media print {
      .action-buttons {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="author-header">
    <div class="author-image-container">
      <img src="${base64Avatar}" alt="${authorName}" class="author-image" 
           onerror="this.onerror=null; this.src='https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/1f464.png'; this.style.width='60px'; this.style.height='60px';">
    </div>
    <div class="author-info">
      <div class="author-name">${authorName}</div>
      <div class="author-username">${authorUsername}</div>
      <div class="thread-info">
        ${readTimeMinutes} min read • 
        <a href="${threadUrl}" target="_blank">View on Threads</a>
      </div>
      <div class="action-buttons">
        <button onclick="(function() {
          // Get all posts from the article
          const article = document.querySelector('.article');
          if (!article) return;
          
          // Get the text content
          const text = Array.from(article.childNodes)
            .map(node => {
              if (node.nodeType === 3) return node.textContent; // Text node
              if (node.tagName === 'BR') return '\\n';
              if (node.tagName === 'IMG') return '[Image]';
              if (node.tagName === 'A') {
                if (node.classList.contains('youtube')) return '[YouTube Link]';
                if (node.classList.contains('external')) return '[Link]';
                return node.textContent;
              }
              return node.textContent;
            })
            .join('')
            .split(/\\s*<br><br><br>\\s*/)
            .map(post => post.trim())
            .filter(post => post)
            .join('\\n\\n---\\n\\n');
          
          // Try using clipboard API first
          try {
            // Create a fallback textarea for browsers that restrict clipboard API in data URLs
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = 0;
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            
            // Try execCommand as fallback (works in more contexts)
            const successful = document.execCommand('copy');
            if (successful) {
              const msg = document.createElement('div');
              msg.className = 'copy-success';
              msg.textContent = 'Text copied!';
              document.body.appendChild(msg);
              setTimeout(() => msg.remove(), 2000);
              document.body.removeChild(textarea);
              return;
            }
            
            // If execCommand failed, try clipboard API
            navigator.clipboard.writeText(text).then(() => {
              const msg = document.createElement('div');
              msg.className = 'copy-success';
              msg.textContent = 'Text copied!';
              document.body.appendChild(msg);
              setTimeout(() => msg.remove(), 2000);
              document.body.removeChild(textarea);
            }).catch(err => {
              // Both methods failed, leave textarea for manual copy
              textarea.style.position = 'fixed';
              textarea.style.left = '50%';
              textarea.style.top = '50%';
              textarea.style.transform = 'translate(-50%, -50%)';
              textarea.style.width = '80%';
              textarea.style.height = '200px';
              textarea.style.padding = '10px';
              textarea.style.zIndex = '9999';
              textarea.style.opacity = '1';
              textarea.style.border = '2px solid #0095f6';
              
              const msg = document.createElement('div');
              msg.className = 'copy-message';
              msg.textContent = 'Select all text (Ctrl+A) and copy (Ctrl+C)';
              msg.style.position = 'fixed';
              msg.style.left = '50%';
              msg.style.top = 'calc(50% - 110px)';
              msg.style.transform = 'translateX(-50%)';
              msg.style.backgroundColor = '#0095f6';
              msg.style.color = 'white';
              msg.style.padding = '10px';
              msg.style.borderRadius = '4px';
              msg.style.zIndex = '10000';
              
              const closeBtn = document.createElement('button');
              closeBtn.textContent = 'Close';
              closeBtn.style.position = 'fixed';
              closeBtn.style.left = '50%';
              closeBtn.style.top = 'calc(50% + 110px)';
              closeBtn.style.transform = 'translateX(-50%)';
              closeBtn.style.backgroundColor = '#0095f6';
              closeBtn.style.color = 'white';
              closeBtn.style.border = 'none';
              closeBtn.style.padding = '10px 20px';
              closeBtn.style.borderRadius = '4px';
              closeBtn.style.cursor = 'pointer';
              closeBtn.style.zIndex = '10000';
              
              closeBtn.onclick = function() {
                document.body.removeChild(textarea);
                document.body.removeChild(msg);
                document.body.removeChild(closeBtn);
              };
              
              document.body.appendChild(msg);
              document.body.appendChild(closeBtn);
            });
          } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy text. Please try again or use Save PDF instead.');
          }
        })()" class="action-button">Copy Text</button>
        <button onclick="window.print()" class="action-button">Save PDF</button>
      </div>
    </div>
  </div>
  
  <div class="article">${threadContent
    .replace(/\[Image: (https?:\/\/[^\]]+)\]/g, '<img src="$1" class="post-image" alt="Thread image" loading="lazy" onerror="this.src=\'https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/1f5bc.png\'; this.style.width=\'72px\'; this.style.height=\'72px\';">')
    .replace(/\[YouTube: (https?:\/\/[^\]]+)\]/g, (match, url) => {
      // Extract video ID for YouTube embeds
      let videoId = '';
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split(/[?#]/)[0];
      } else if (url.includes('youtube.com/watch')) {
        const urlObj = new URL(url);
        videoId = urlObj.searchParams.get('v');
      }
      
      if (videoId) {
        // Return YouTube thumbnail with link as fallback
        return `
          <div class="youtube-container">
            <a href="${url}" class="post-link youtube" target="_blank" rel="noopener noreferrer">
              <div class="youtube-thumbnail">
                <img src="https://img.youtube.com/vi/${videoId}/0.jpg" alt="YouTube Thumbnail" loading="lazy" 
                     onerror="this.src='https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/25b6.png'; this.style.width='72px'; this.style.height='72px';">
                <div class="youtube-play-icon">▶</div>
              </div>
              <span class="link-text">Watch on YouTube</span>
            </a>
          </div>`;
      } else {
        // Fallback to regular link
        return `<a href="${url}" class="post-link youtube" target="_blank" rel="noopener noreferrer"><span class="link-text">Watch on YouTube: ${url}</span></a>`;
      }
    })
    .replace(/\[Link: (https?:\/\/[^\]]+)\]/g, (match, url) => {
      try {
        const hostname = new URL(url).hostname;
        return `<a href="${url}" class="post-link external" target="_blank" rel="noopener noreferrer">
                <span class="link-domain">${hostname}</span>
                <span class="link-text">${url}</span>
               </a>`;
      } catch (e) {
        return `<a href="${url}" class="post-link external" target="_blank" rel="noopener noreferrer"><span class="link-text">${url}</span></a>`;
      }
    })
    .replace(/@(\w+)/g, '<a href="https://www.threads.net/@$1" target="_blank">@$1</a>')}</div>
  
  <div class="footer">
    <p>Source: <a href="${threadUrl}" target="_blank">Threads</a></p>
  </div>
</body>
</html>`;

  return {
    htmlContent,
    filename: `thread_${sanitizedAuthorUsername}_${timestamp}.html`,
    sanitizedAuthorUsername,
    timestamp
  };
}

// Update the message listeners to handle async generateHtmlContent
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'preview') {
    (async () => {
      try {
        console.log('Background script received preview request:', request);
        
        if (!request.data) {
          throw new Error('No data provided for preview');
        }
        
        // Generate HTML content
        const { htmlContent, filename } = await generateHtmlContent(request.data);
        
        // Create a data URL for the preview
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        
        // Create a new tab with the preview
        chrome.tabs.create({ url: dataUrl, active: true }, (tab) => {
          // Store reference to this tab for download functionality
          previewTabs[tab.id] = {
            htmlContent: htmlContent,
            filename: filename,
            originalData: request.data
          };
          
          // Send a message to the popup that preview is ready
          sendResponse({
            success: true,
            previewTabId: tab.id,
            message: 'Preview opened in new tab'
          });
        });
      } catch (error) {
        console.error('Preview error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    
    return true; // Keep the channel open for asynchronous response
  }
  
  if (request.action === 'download') {
    (async () => {
      try {
        console.log('Background script received download request:', request);
        
        let htmlContent, filename;
        
        // Check if this is a download from a preview tab
        if (request.previewTabId && previewTabs[request.previewTabId]) {
          const previewData = previewTabs[request.previewTabId];
          htmlContent = previewData.htmlContent;
          filename = previewData.filename;
        } else if (request.data) {
          // Generate HTML content from scratch
          const result = await generateHtmlContent(request.data);
          htmlContent = result.htmlContent;
          filename = result.filename;
        } else {
          throw new Error('No data provided for download');
        }
        
        // Create a data URL for the download
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        
        console.log('Starting download with filename:', filename);
        
        chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download error:', chrome.runtime.lastError);
            sendResponse({ 
              success: false, 
              error: chrome.runtime.lastError.message 
            });
            return;
          }
          
          console.log('Download started with ID:', downloadId);
          
          // Send success response
          sendResponse({ 
            success: true, 
            downloadId: downloadId,
            filename: filename,
            timestamp: new Date().toISOString()
          });
        });
      } catch (error) {
        console.error('Background script error:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    })();
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
  
  if (request.action === 'downloadFromPreview') {
    (async () => {
      try {
        const previewTabId = request.previewTabId;
        
        if (!previewTabId || !previewTabs[previewTabId]) {
          throw new Error('Invalid preview tab ID or preview not found');
        }
        
        const previewData = previewTabs[previewTabId];
        
        // Create data URL for the download
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(previewData.htmlContent);
        
        console.log('Starting download from preview with filename:', previewData.filename);
        
        chrome.downloads.download({
          url: dataUrl,
          filename: previewData.filename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download error:', chrome.runtime.lastError);
            sendResponse({ 
              success: false, 
              error: chrome.runtime.lastError.message 
            });
            return;
          }
          
          console.log('Download started with ID:', downloadId);
          
          // Send success response
          sendResponse({ 
            success: true, 
            downloadId: downloadId,
            filename: previewData.filename,
            timestamp: new Date().toISOString()
          });
        });
      } catch (error) {
        console.error('Download from preview error:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    })();
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

// Listen for tab close events to clean up preview tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  if (previewTabs[tabId]) {
    console.log('Preview tab closed, cleaning up:', tabId);
    delete previewTabs[tabId];
  }
}); 