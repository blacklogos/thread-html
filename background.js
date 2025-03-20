// Initialize the cleaning patterns
let cleaningPatterns = [];

// Load patterns from JSON file using fetch
fetch('./utils/cleaning-patterns.json')
  .then(response => response.json())
  .then(data => {
    // Convert string patterns from JSON to actual RegExp objects
    cleaningPatterns = data.patterns.map(pattern => {
      return {
        name: pattern.name,
        pattern: new RegExp(pattern.pattern, pattern.flags),
        replacement: pattern.replacement,
        description: pattern.description
      };
    });
    console.log(`Loaded ${cleaningPatterns.length} cleaning patterns from cleaning-patterns.json`);
    console.log('To modify patterns, edit utils/cleaning-patterns.json');
  })
  .catch(error => {
    console.error('Error loading cleaning patterns:', error);
    // Use default patterns as fallback
    initializeDefaultPatterns();
  });

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

// Track active preview tabs
let previewTabs = {};

// Function to generate HTML content from thread data
function generateHtmlContent(data) {
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
  
  // Default avatar if none found
  if (!avatarUrl) {
    avatarUrl = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';
  }
  
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
      
      // Add patterns to remove this specific author's handle
      patterns.push({ 
        pattern: new RegExp(`^${escapedUsername}\\s*$`, 'gim'), 
        replacement: '' 
      });
      patterns.push({ 
        pattern: new RegExp(`^@${escapedUsername}\\s*$`, 'gim'), 
        replacement: '' 
      });
      patterns.push({ 
        pattern: new RegExp(`\\s${escapedUsername}\\s`, 'g'), 
        replacement: ' ' 
      });
      patterns.push({ 
        pattern: new RegExp(`\\s@${escapedUsername}\\s`, 'g'), 
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
    
    // Extract all URLs before cleaning
    const urlMatches = cleanText.match(/(https?:\/\/[^\s]+)/gi) || [];
    
    // Process each URL
    urlMatches.forEach(url => {
      // Check if it's a YouTube URL
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        mediaContent.push({
          type: 'youtube',
          url: url
        });
      }
      // Check if it's an image URL
      else if (url.match(/\.(jpg|jpeg|png|gif)$/i)) {
        mediaContent.push({
          type: 'image',
          url: url
        });
      } 
      // Other links
      else {
        mediaContent.push({
          type: 'link',
          url: url
        });
      }
    });
    
    // Get cleaning patterns including author-specific ones
    const patterns = createAuthorCleaningPatterns(authorUsername);
    
    // Apply all patterns to clean the text
    patterns.forEach(({ pattern, replacement }) => {
      cleanText = cleanText.replace(pattern, replacement);
    });
    
    // Remove URLs from the text since we'll add them back in a structured way
    cleanText = cleanText.replace(/(https?:\/\/[^\s]+)/gi, '');
    
    // Add any final cleanup needed
    cleanText = cleanText.trim();
    
    // Add back media content if exists
    if (mediaContent.length > 0) {
      mediaContent.forEach(media => {
        if (media.type === 'youtube') {
          cleanText += `\n[YouTube: ${media.url}]`;
        } else if (media.type === 'image') {
          cleanText += `\n[Image: ${media.url}]`;
        } else {
          cleanText += `\n[Link: ${media.url}]`;
        }
      });
    }
    
    return cleanText;
  });
  
  // Filter out empty posts
  const nonEmptyPosts = cleanedPosts.filter(post => 
    post.length > 0 && 
    post !== 'No content available' && 
    !/^\s*$/.test(post)
  );
  
  // Use non-empty posts or default to original cleaned posts if all were filtered out
  const finalPosts = nonEmptyPosts.length > 0 ? nonEmptyPosts : cleanedPosts;
  
  // Join all cleaned posts with a line break
  let threadContent = finalPosts.join('\n\n');
  
  // Convert newlines to <br> tags
  threadContent = threadContent.replace(/\n/g, '<br>');
  
  // Apply HTML-specific cleaning patterns
  cleaningPatterns.forEach(({ pattern, replacement }) => {
    if (pattern.toString().includes('<br>')) {
      threadContent = threadContent.replace(pattern, replacement);
    }
  });
  
  // Clean up multiple breaks and empty lines
  threadContent = threadContent
    .replace(/(?:<br>){3,}/g, '<br><br>')  // Reduce multiple breaks to double
    .replace(/^\\s*<br>|<br>\\s*$/g, '')   // Remove breaks at start/end
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
    
    .author-image {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      margin-right: 20px;
      object-fit: cover;
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
  </style>
</head>
<body>
  <div class="author-header">
    <img src="${avatarUrl}" alt="${authorName}" class="author-image">
    <div class="author-info">
      <div class="author-name">${authorName}</div>
      <div class="author-username">${authorUsername}</div>
      <div class="thread-info">
        ${readTimeMinutes} min read • 
        <a href="${threadUrl}" target="_blank">View on Threads</a>
      </div>
    </div>
  </div>
  
  <div class="article">${threadContent
    .replace(/\[Image: (https?:\/\/[^\]]+)\]/g, '<img src="$1" class="post-image" alt="Thread image" loading="lazy">')
    .replace(/\[YouTube: (https?:\/\/[^\]]+)\]/g, (match, url) => {
      const linkText = url.includes('youtu.be') ? 'Watch on YouTube' : url;
      return `<a href="${url}" class="post-link youtube" target="_blank" rel="noopener noreferrer"><span class="link-text">${linkText}</span></a>`;
    })
    .replace(/\[Link: (https?:\/\/[^\]]+)\]/g, (match, url) => {
      return `<a href="${url}" class="post-link external" target="_blank" rel="noopener noreferrer"><span class="link-text">${url}</span></a>`;
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'preview') {
    try {
      console.log('Background script received preview request:', request);
      
      if (!request.data) {
        throw new Error('No data provided for preview');
      }
      
      // Generate HTML content
      const { htmlContent, filename } = generateHtmlContent(request.data);
      
      // Create a data URL for the preview (without cache busting parameter)
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
      
      return true; // Keep the channel open for asynchronous response
    } catch (error) {
      console.error('Preview error:', error);
      sendResponse({
        success: false,
        error: error.message
      });
      return false;
    }
  }
  
  if (request.action === 'download') {
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
        const result = generateHtmlContent(request.data);
        htmlContent = result.htmlContent;
        filename = result.filename;
      } else {
        throw new Error('No data provided for download');
      }
      
      // Create a data URL for the download (without cache busting parameter)
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
      
      // Return true to indicate we'll send a response asynchronously
      return true;
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  if (request.action === 'downloadFromPreview') {
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
      
      // Return true to indicate we'll send a response asynchronously
      return true;
    } catch (error) {
      console.error('Download from preview error:', error);
      sendResponse({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Listen for tab close events to clean up preview tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  if (previewTabs[tabId]) {
    console.log('Preview tab closed, cleaning up:', tabId);
    delete previewTabs[tabId];
  }
}); 