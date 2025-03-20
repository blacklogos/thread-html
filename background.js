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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    try {
      console.log('Background script received download request:', request);
      
      if (!request.data) {
        throw new Error('No data provided in request');
      }
      
      const { posts, author, url: threadUrl, metaData } = request.data;
      
      // Log the received data for debugging
      console.log('Received data:', {
        postsCount: posts?.length || 0,
        author,
        threadUrl,
        metaData
      });
      
      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        throw new Error('No posts provided or invalid posts data');
      }
      
      // Try to get author information from metadata if available
      let authorName = 'Unknown Author';
      let authorUsername = 'unknown';
      let avatarUrl = '';
      
      if (metaData) {
        // Extract author name and username from og:title if available
        if (metaData.ogTitle) {
          const titleMatch = metaData.ogTitle.match(/on Threads: "(.*)" \| (@[a-zA-Z0-9._]+)/);
          if (titleMatch && titleMatch.length >= 3) {
            authorName = titleMatch[1] || authorName;
            authorUsername = titleMatch[2] || authorUsername;
          } else {
            // Simpler fallback pattern
            const simpleTitleMatch = metaData.ogTitle.match(/(.*) \(@([a-zA-Z0-9._]+)\)/);
            if (simpleTitleMatch && simpleTitleMatch.length >= 3) {
              authorName = simpleTitleMatch[1] || authorName;
              authorUsername = `@${simpleTitleMatch[2]}` || authorUsername;
            }
          }
        }
        
        // Get avatar from og:image
        if (metaData.ogImage) {
          avatarUrl = metaData.ogImage;
        }
      }
      
      // Fallback to author data provided directly if metadata extraction failed
      if (authorName === 'Unknown Author' && author && author.displayName) {
        authorName = author.displayName;
      }
      
      if (authorUsername === 'unknown' && author && author.name) {
        authorUsername = `@${author.name}`;
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
      
      // Get cleaned posts - only extract the pure content
      const cleanedPosts = posts.map(post => {
        // Clean up the post text by removing metadata, usernames, dates, metrics
        let cleanText = post.postText || 'No content available';
        
        // Add specific patterns to remove author handles if we have author info
        const specificCleaningPatterns = [...cleaningPatterns];
        
        if (authorUsername && authorUsername !== 'unknown') {
          // Extract username without @ if present
          const usernameWithoutAt = authorUsername.startsWith('@') 
            ? authorUsername.substring(1) 
            : authorUsername;
            
          // Add pattern to remove this specific author's handle
          specificCleaningPatterns.push({ 
            pattern: new RegExp(`\\b${usernameWithoutAt}\\b`, 'gi'), 
            replacement: '' 
          });
          specificCleaningPatterns.push({ 
            pattern: new RegExp(`\\b@${usernameWithoutAt}\\b`, 'gi'), 
            replacement: '' 
          });
        }
        
        // Apply all patterns to clean the text
        specificCleaningPatterns.forEach(({ pattern, replacement }) => {
          cleanText = cleanText.replace(pattern, replacement);
        });
        
        // Add any final cleanup needed
        cleanText = cleanText.trim();
        
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
      
      // Join all cleaned posts into a single content body
      const threadContent = finalPosts.join('\n\n');
      
      // Count total words for read time calculation
      const totalWords = threadContent.split(/\s+/).length;
      
      // Estimate read time (average reading speed is ~200-250 words per minute)
      const readTimeMinutes = Math.max(1, Math.round(totalWords / 200));
      
      // Generate a unique cache-busting timestamp for this export
      const cacheBustTimestamp = Date.now();
      
      console.log('Generating HTML content for author:', authorName);
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>${authorName}'s Thread</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Thread by ${authorName} (${authorUsername}) on Threads">
  <!-- Cache busting meta tags -->
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="generated" content="${cacheBustTimestamp}">
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
  
  <div class="article">${threadContent.replace(/\n/g, '<br>')
                                      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
                                      .replace(/@(\w+)/g, '<a href="https://www.threads.net/@$1" target="_blank">@$1</a>')}</div>
  
  <div class="footer">
    <p>Source: <a href="${threadUrl}" target="_blank">Threads</a></p>
  </div>
  
  <div class="download-info">File downloaded successfully!</div>
</body>
</html>`;

      console.log('Creating data URL from HTML content...');
      // Add cache-busting parameter to data URL
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent) + '&cachebust=' + cacheBustTimestamp;
      
      // Generate a filename based on the thread content
      const sanitizedAuthorName = authorUsername.replace(/[@\s]/g, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `thread_${sanitizedAuthorName}_${cacheBustTimestamp}.html`;
      
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
}); 