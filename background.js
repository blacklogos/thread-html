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

// Track active preview panels instead of tabs
let previewPanels = {};

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
  
  const timestamp = new Date().getTime();
  
  // Process thread content
  let threadContent = '';
  let wordCount = 0;
  
  // Check if we have posts
  if (posts && posts.length > 0) {
    const postsWithContent = posts.filter(post => post.text && post.text.trim());
    
    postsWithContent.forEach((post, index) => {
      const text = post.text || '';
      const words = text.split(/\s+/).filter(Boolean);
      wordCount += words.length;
      
      // Process the post content
      let postContent = text;
      
      // Add media (image or link) if available
      let mediaContent = '';
      
      // Add image if available
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        const imageUrl = post.mediaUrls[0]; // Take the first image
        mediaContent = `<div class="post-media"><img src="${imageUrl}" alt="Post image" class="post-image"></div>`;
      }
      
      // Extract links from the text
      const linkRegex = /(https?:\/\/[^\s]+)/g;
      const links = text.match(linkRegex);
      
      if (!mediaContent && links && links.length > 0) {
        // Use the first link if no image was added
        mediaContent = `<div class="post-link"><a href="${links[0]}" target="_blank">${links[0]}</a></div>`;
      }
      
      // Add the post with proper formatting
      threadContent += `<div class="post">
        <div class="post-content">${postContent}</div>
        ${mediaContent}
      </div>`;
      
      // Add divider between posts, except for the last post
      if (index < postsWithContent.length - 1) {
        threadContent += `<div class="post-divider">---</div>`;
      }
    });
  }
  
  // Calculate read time (avg reading speed: 200 words per minute)
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  
  // Generate HTML content
  const htmlContent = `<!DOCTYPE html>
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
    
    /* Article section */
    .article {
      font-size: 1.1rem;
      line-height: 1.8;
      margin-bottom: 40px;
    }
    
    /* Post styles */
    .post {
      margin-bottom: 25px;
    }
    
    .post-content {
      margin-bottom: 15px;
    }
    
    .post-media {
      margin: 15px 0;
    }
    
    .post-image {
      max-width: 100%;
      border-radius: 8px;
      margin-top: 10px;
    }
    
    .post-link {
      margin: 10px 0;
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 8px;
      word-break: break-all;
    }
    
    .post-divider {
      text-align: center;
      color: var(--muted-color);
      margin: 20px 0;
      opacity: 0.5;
    }
    
    /* Footer section */
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
      font-size: 0.9rem;
      color: var(--muted-color);
      text-align: center;
    }
    
    @media only screen and (max-width: 600px) {
      body {
        padding: 20px 15px;
      }
      
      .author-name {
        font-size: 1.3rem;
      }
      
      .article {
        font-size: 1rem;
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
  
  <div class="article">${threadContent}</div>
  
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

// Function to open a side panel with HTML content
async function openSidePanel(tabId, htmlContent, data) {
  console.log('Attempting to open side panel for tab:', tabId);
  
  // Create a unique ID for this panel
  const panelId = `panel_${Date.now()}`;
  
  try {
    // Check if the side panel API is available and properly implemented
    if (chrome.sidePanel && typeof chrome.sidePanel.setOptions === 'function' && typeof chrome.sidePanel.open === 'function') {
      console.log('Side panel API is available, attempting to use it');
      
      try {
        // Set the panel content
        await chrome.sidePanel.setOptions({
          tabId: tabId,
          path: 'panel.html',
          enabled: true
        });
        
        // Store the panel data for later use
        previewPanels[panelId] = {
          tabId: tabId,
          htmlContent: htmlContent,
          filename: `thread_${data.sanitizedAuthorUsername}_${data.timestamp}.html`,
          originalData: data,
          timestamp: Date.now(),
          type: 'sidePanel'
        };
        
        // Open the side panel
        await chrome.sidePanel.open({ tabId });
        
        console.log('Side panel opened successfully');
        
        // Return the panel ID
        return panelId;
      } catch (sidePanelError) {
        console.error('Failed to open side panel despite API being available:', sidePanelError);
        // Fall through to fallback mechanism
        throw new Error(`Side panel API failed: ${sidePanelError.message}`);
      }
    } else {
      console.log('Side panel API not available, falling back to tab preview');
      // Fall through to fallback mechanism
      throw new Error('Side panel API not available');
    }
  } catch (error) {
    console.warn('Using fallback preview method (new tab):', error.message);
    
    // Fallback: Use a new tab preview instead
    return new Promise((resolve, reject) => {
      try {
        // Create a data URL for the preview
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
        
        // Create a new tab with the preview
        chrome.tabs.create({ url: dataUrl, active: true }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Failed to create preview tab: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          // Store reference to this tab for download functionality
          const fallbackPanelId = `tab_${tab.id}_${Date.now()}`;
          previewPanels[fallbackPanelId] = {
            tabId: tab.id,
            htmlContent: htmlContent,
            filename: `thread_${data.sanitizedAuthorUsername}_${data.timestamp}.html`,
            originalData: data,
            timestamp: Date.now(),
            type: 'tab'
          };
          
          console.log('Created fallback preview tab with ID:', tab.id);
          resolve(fallbackPanelId);
        });
      } catch (fallbackError) {
        reject(new Error(`Fallback preview failed: ${fallbackError.message}`));
      }
    });
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Panel content request handler
  if (request.action === 'getPanelContent') {
    try {
      console.log('Background script received panel content request:', request);
      
      // Find the panel for this tab
      const tabId = request.tabId || (sender.tab && sender.tab.id);
      
      if (!tabId) {
        throw new Error('No tab ID provided for panel content request');
      }
      
      // Find the panel data
      let panelData = null;
      let panelId = null;
      
      Object.keys(previewPanels).forEach(id => {
        if (previewPanels[id].tabId === tabId) {
          panelData = previewPanels[id];
          panelId = id;
        }
      });
      
      if (!panelData) {
        // For the tab preview case, the data might be stored with the tab's ID directly
        if (previewPanels[tabId]) {
          panelData = previewPanels[tabId];
          panelId = tabId;
        } else {
          throw new Error('No panel data found for tab');
        }
      }
      
      // Send the panel content
      sendResponse({
        success: true,
        panelId: panelId,
        htmlContent: panelData.htmlContent,
        type: panelData.type || 'unknown'
      });
      
      return false;
    } catch (error) {
      console.error('Panel content request error:', error);
      sendResponse({
        success: false,
        error: error.message
      });
      return false;
    }
  }
  
  // Panel close handler
  if (request.action === 'closeSidePanel') {
    try {
      const tabId = sender.tab && sender.tab.id;
      
      if (!tabId) {
        throw new Error('No tab ID found for panel close request');
      }
      
      // Find the panel data
      let panelData = null;
      let panelId = null;
      
      Object.keys(previewPanels).forEach(id => {
        if (previewPanels[id].tabId === tabId) {
          panelData = previewPanels[id];
          panelId = id;
        }
      });
      
      if (panelData) {
        // Check the type of preview
        if (panelData.type === 'sidePanel') {
          // Close the side panel if the API is available
          if (chrome.sidePanel && chrome.sidePanel.close) {
            chrome.sidePanel.close({ tabId });
          }
        } else if (panelData.type === 'tab') {
          // Close the tab if it's a tab preview
          chrome.tabs.remove(tabId);
        }
        
        // Cleanup
        delete previewPanels[panelId];
      }
      
      sendResponse({ success: true });
      return false;
    } catch (error) {
      console.error('Panel close error:', error);
      sendResponse({
        success: false,
        error: error.message
      });
      return false;
    }
  }

  // Handle preview request (tries side panel first, falls back to tab)
  if (request.action === 'previewInSidePanel') {
    try {
      console.log('Background script received preview request:', request);
      
      if (!request.data) {
        throw new Error('No data provided for preview');
      }
      
      // Generate HTML content
      const htmlResult = generateHtmlContent(request.data);
      
      // Attempt to open side panel with the content (with fallback)
      openSidePanel(request.tabId, htmlResult.htmlContent, htmlResult)
        .then(panelId => {
          // Get panel type to inform popup
          const panelType = previewPanels[panelId]?.type || 'unknown';
          const message = panelType === 'sidePanel' 
            ? 'Preview opened in side panel' 
            : 'Preview opened in new tab';
          
          // Send a message to the popup that preview is ready
          sendResponse({
            success: true,
            panelId: panelId,
            type: panelType,
            message: message
          });
        })
        .catch(error => {
          console.error('Preview creation error:', error);
          sendResponse({
            success: false,
            error: error.message
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
  
  // Handle download from side panel or tab preview
  if (request.action === 'downloadFromSidePanel') {
    try {
      console.log('Background script received download request:', request);
      
      const panelId = request.panelId;
      
      if (!panelId || !previewPanels[panelId]) {
        throw new Error('Invalid panel ID or preview not found');
      }
      
      const panelData = previewPanels[panelId];
      
      // Create data URL for the download
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(panelData.htmlContent);
      
      console.log('Starting download with filename:', panelData.filename);
      
      chrome.downloads.download({
        url: dataUrl,
        filename: panelData.filename,
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
          filename: panelData.filename,
          timestamp: new Date().toISOString()
        });
      });
      
      // Return true to indicate we'll send a response asynchronously
      return true;
    } catch (error) {
      console.error('Download error:', error);
      sendResponse({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Original preview handler (fallback method)
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
        previewPanels[tab.id] = {
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
  
  // Original download handler
  if (request.action === 'download') {
    try {
      console.log('Background script received download request:', request);
      
      let htmlContent, filename;
      
      // Check if this is a download from a preview panel
      if (request.panelId && previewPanels[request.panelId]) {
        const previewData = previewPanels[request.panelId];
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
  
  // Fallback for original handler for backwards compatibility
  if (request.action === 'downloadFromPreview') {
    try {
      const previewTabId = request.previewTabId;
      
      if (!previewTabId || !previewPanels[previewTabId]) {
        throw new Error('Invalid preview tab ID or preview not found');
      }
      
      const previewData = previewPanels[previewTabId];
      
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

// Listen for tab close events to clean up preview panels
chrome.tabs.onRemoved.addListener((tabId) => {
  if (previewPanels[tabId]) {
    console.log('Preview panel closed, cleaning up:', tabId);
    delete previewPanels[tabId];
  }
}); 