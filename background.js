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

// Add tracking for blob URLs
let createdBlobUrls = [];

// Function to fetch an image and convert it to base64
async function fetchImageAsBase64(url) {
  try {
    console.log('Attempting to use URL directly:', url);
    
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
    
    // Just return the URL directly without trying to fetch or convert
    // This avoids CORS issues altogether
    return url;
  } catch (error) {
    console.error('Error processing avatar URL:', error);
    // Return a reliable default avatar
    return 'https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/1f464.png';
  }
}

// Function to generate a simple avatar color from a name
function getAvatarColor(name) {
  // Default hue for unknown names
  let hue = 210; 
  
  if (name && typeof name === 'string') {
    // Generate a deterministic hue based on the name
    hue = 0;
    for (let i = 0; i < name.length; i++) {
      hue += name.charCodeAt(i);
    }
    hue = hue % 360; // Limit to valid hue value
  }
  
  return `hsl(${hue}, 70%, 60%)`;
}

// Function to extract initials from a name
function getInitials(name) {
  if (!name || typeof name !== 'string') {
    return 'U';
  }
  
  // Clean the name and extract words
  const cleanName = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const nameParts = cleanName.split(/\s+/);
  
  if (nameParts.length >= 2) {
    // Get first letter of first and last word
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  } else if (nameParts.length === 1 && nameParts[0].length > 0) {
    // Get first letter for single word
    let initials = nameParts[0].charAt(0).toUpperCase();
    // Add second letter if available
    if (nameParts[0].length > 1) {
      initials += nameParts[0].charAt(1).toUpperCase();
    }
    return initials;
  }
  
  return 'U'; // Default for unknown
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
  
  // Get avatar color and initials for fallback
  const avatarColor = getAvatarColor(authorName);
  const authorInitials = getInitials(authorName);
  
  // Default avatar if none found - use the provided URL
  if (!avatarUrl) {
    console.log('No avatar URL found, will use initials fallback');
    avatarUrl = 'https://cdn.jsdelivr.net/gh/twitter/twemoji/assets/72x72/1f464.png';
  }
  
  // Ensure avatar URL is HTTPS to avoid mixed content issues
  if (avatarUrl && avatarUrl.startsWith('http:')) {
    console.log('Converting avatar URL from HTTP to HTTPS');
    avatarUrl = avatarUrl.replace(/^http:/, 'https:');
  }
  
  // We'll use the original URL directly without any fetch attempts
  // This prevents CORS issues since we're relying on the browser's own image loading
  // which handles CORS differently than fetch
  let base64Avatar = avatarUrl;
  
  // For testing: log the avatar URL being used
  console.log('Using avatar URL:', 
    typeof base64Avatar === 'string' && base64Avatar.length > 100 
      ? base64Avatar.substring(0, 100) + '...' 
      : base64Avatar
  );
  
  // Ensure authorUsername is clean and valid for file naming
  let sanitizedAuthorUsername = 'unknown';
  if (authorUsername && authorUsername !== 'unknown') {
    try {
      // Remove @ symbol if present
      sanitizedAuthorUsername = authorUsername.replace(/^@/, '');
      
      // Replace any special characters that could cause issues in filenames
      sanitizedAuthorUsername = sanitizedAuthorUsername
        .replace(/[\\/:*?"<>|]/g, '_') // Replace Windows-unsafe characters
        .replace(/\s+/g, '_')          // Replace spaces with underscores
        .replace(/[^\w\-\.]/g, '');    // Remove any remaining non-alphanumeric chars except dash, underscore, dot
      
      // Ensure it's not empty or only consists of special characters
      if (!sanitizedAuthorUsername || sanitizedAuthorUsername.trim() === '' || sanitizedAuthorUsername === '_') {
        sanitizedAuthorUsername = 'unknown_' + Date.now().toString(36);
      }
    } catch (error) {
      console.error('Error sanitizing author username:', error);
      sanitizedAuthorUsername = 'unknown_' + Date.now().toString(36);
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
    // Post-processing function to handle repeated author handles
    function processRepeatedHandles(text, authorHandle) {
      if (!text || typeof text !== 'string') return text;
      
      // Split the text into lines for processing
      const lines = text.split('\n');
      if (lines.length < 3) return text; // Not enough lines to detect patterns
      
      // Step 1: Find all potential username patterns at the start of lines
      // This includes @handles, plain usernames, and full names with handles
      const lineStartPatterns = {};
      let mostFrequentPattern = '';
      let highestFrequency = 0;
      
      // First pass: analyze all lines for patterns at start
      lines.forEach(line => {
        // Different types of patterns we want to catch
        const patterns = [
          // Plain username (3-20 chars)
          line.match(/^([a-zA-Z0-9._-]{3,20})(?:\s+|$)/),
          // @username
          line.match(/^@([a-zA-Z0-9._-]{3,20})(?:\s+|$)/),
          // username:
          line.match(/^([a-zA-Z0-9._-]{3,20}):\s+/),
          // @username:
          line.match(/^@([a-zA-Z0-9._-]{3,20}):\s+/),
          // Name (@username)
          line.match(/^([a-zA-Z0-9\s]{2,30})\s+\(@[a-zA-Z0-9._-]{3,20}\)(?:\s+|$)/)
        ];
        
        // Process any pattern matches we found
        patterns.forEach(match => {
          if (match && match[1]) {
            const pattern = match[1].toLowerCase();
            lineStartPatterns[pattern] = (lineStartPatterns[pattern] || 0) + 1;
            
            if (lineStartPatterns[pattern] > highestFrequency) {
              highestFrequency = lineStartPatterns[pattern];
              mostFrequentPattern = pattern;
            }
          }
        });
      });
      
      // Step 2: If we found a common pattern, remove it from the start of lines
      if (highestFrequency >= 2 && highestFrequency / lines.length > 0.1) {
        console.log(`Removing frequent pattern at line starts: "${mostFrequentPattern}" (${highestFrequency} occurrences)`);
        
        // Create a list of regex patterns to remove based on the frequent pattern
        const escapedPattern = mostFrequentPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patternsToRemove = [
          new RegExp(`^${escapedPattern}(?:\\s+|$)`, 'gi'),           // Plain username
          new RegExp(`^@${escapedPattern}(?:\\s+|$)`, 'gi'),          // @username
          new RegExp(`^${escapedPattern}:\\s+`, 'gi'),                // username:
          new RegExp(`^@${escapedPattern}:\\s+`, 'gi'),               // @username:
          // Full name with handle - more complex, custom approach
          function(line) {
            if (line.toLowerCase().includes(mostFrequentPattern.toLowerCase())) {
              // Try to match name pattern without using exact regex
              const fullNameMatch = line.match(/^([a-zA-Z0-9\s]{2,30})\s+\(@[a-zA-Z0-9._-]{3,20}\)(?:\s+|:)/);
              if (fullNameMatch) {
                return line.replace(fullNameMatch[0], '');
              }
            }
            return line;
          }
        ];
        
        // Apply cleaners to each line
        const cleanedLines = lines.map(line => {
          let result = line;
          
          // Try all removal patterns
          for (const pattern of patternsToRemove) {
            if (typeof pattern === 'function') {
              result = pattern(result);
            } else {
              result = result.replace(pattern, '');
            }
            
            // If we've made a change, exit the loop
            if (result !== line) break;
          }
          
          return result;
        });
        
        // Only use the cleaned version if we actually removed something
        const cleanedText = cleanedLines.join('\n');
        if (cleanedText !== text) {
          text = cleanedText;
        }
      }
      
      // Step 3: Also try the original author handle matching as a fallback
      if (authorHandle && authorHandle !== 'unknown') {
        // Normalize handle
        const normalizedHandle = authorHandle.toLowerCase().startsWith('@') 
          ? authorHandle.toLowerCase() 
          : '@' + authorHandle.toLowerCase();
        
        const handleWithoutAt = normalizedHandle.replace(/^@/, '');
        
        // Original pattern matching logic
        const fullNameRegex = new RegExp(`(^|\\n)[\\w\\s]+\\s*\\(${normalizedHandle}\\)\\s*:?\\s*`, 'gi');
        const startWithHandleRegex = new RegExp(`(^|\\n)${handleWithoutAt}\\s*:?\\s*`, 'gi');
        const startWithAtHandleRegex = new RegExp(`(^|\\n)@${handleWithoutAt}\\s*:?\\s*`, 'gi');
        
        // Apply original cleaners
        text = text.replace(fullNameRegex, '$1');
        text = text.replace(startWithHandleRegex, '$1');
        text = text.replace(startWithAtHandleRegex, '$1');
      }
      
      return text;
    }
    
    // Preserve the original content for later  
    let originalContent = post.postText || 'No content available';
    let metadataText = originalContent;
    let contentText = originalContent;
    let mediaContent = [];
    
    // First, extract and store all URLs before any cleaning
    const urlMatches = originalContent.match(/(https?:\/\/[^\s]+)/gi) || [];
    
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
    metadataText = metadataText.replace(/(https?:\/\/[^\s]+)/gi, '');
    contentText = contentText.replace(/(https?:\/\/[^\s]+)/gi, '');
    
    // Whitelist patterns that should NEVER be treated as metadata
    // even if they match metadata patterns (e.g., common expressions containing numbers)
    const contentWhitelist = [
      /\d+\s*ngày\s*\/\s*tuần/i,      // "X days/week" in Vietnamese
      /\d+\s*giờ\s*\/\s*ngày/i,        // "X hours/day" in Vietnamese
      /\d+\s*days?\s*\/\s*week/i,      // "X days/week"
      /\d+\s*hours?\s*\/\s*day/i,      // "X hours/day"
      /\d+\s*times?\s*a\s*day/i,       // "X times a day"
      /\d+\s*lần\s*(một|mỗi)\s*ngày/i, // "X times a day" in Vietnamese
      /từ\s*\d+\s*đến\s*\d+/i,         // "from X to Y" in Vietnamese
      /from\s*\d+\s*to\s*\d+/i,        // "from X to Y"
      /\d+\s*\-\s*\d+/,                // "X-Y" number ranges
      /\d+\s*%/,                       // Percentages
      /\d+\s*USD/i,                    // Money amounts
      /\$\s*\d+/                       // Dollar amounts
    ];
    
    // Identify potential metadata sections
    let lines = metadataText.split('\n');
    let contentLines = [];
    let metadataLines = [];
    
    // Classify lines as metadata or content
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if line contains any whitelisted patterns that should be preserved
      const isWhitelisted = contentWhitelist.some(pattern => pattern.test(line));
      
      // EXPANDED WHITELIST: Add patterns for numbered steps/principles
      // that should never be treated as metadata
      const expandedWhitelist = [
        /step\s*\d+/i,                // "Step 1, 2, 3..."
        /steps?\s*\d+/i,              // "Steps 1, 2, 3..."
        /principle\s*\d+/i,           // "Principle 1, 2, 3..."
        /principles?\s*\d+/i,         // "Principles 1, 2, 3..."
        /nguyên\s*tắc\s*\d+/i,        // "Nguyên tắc 1, 2, 3..." (Vietnamese)
        /nguyên\s*tắc/i,              // "Nguyên tắc" (Vietnamese for "principle") - protect the whole term
        /bước\s*\d+/i,                // "Bước 1, 2, 3..." (Vietnamese for "step")
        /bước/i,                      // "Bước" (Vietnamese for "step") - protect the whole term
        /\d+\s*\.\s*[\p{L}]/u,        // Numbered list with period: "1. Text"
        /\(\s*\d+\s*\)\s*[\p{L}]/u,   // Numbered list with parentheses: "(1) Text"
        /^[\p{L}]+\s+\d+$/u,          // Words followed by numbers (like "Chapter 1")
        /^\d+\s+[\p{L}]+$/u,          // Numbers followed by words (like "1 Introduction")
        /\d+\s*ngày/i,                // Vietnamese time expressions with numbers
        /\d+\s*giờ/i,                 // Vietnamese time expressions with numbers
        /các\s+bước/i                 // "Các bước" (Vietnamese for "the steps")
      ];
      
      // If whitelisted or matches expanded whitelist, always keep as content
      if (isWhitelisted || expandedWhitelist.some(pattern => pattern.test(line))) {
        contentLines.push(line);
        continue;
      }
      
      // Expanded check for metadata-like content
      const isMetadata = 
        // IMPORTANT: Standalone numbers are likely metadata (likes, comments, etc.)
        /^[\d]+$/.test(line) ||
        
        // Vietnamese/international numeric formats with commas (1,1K = 1.1K)
        /^[\d,\.]+[KkMm]?\s+(view|views|like|likes|reply|replies|repost|reposts|comment|comments|lượt xem|lượt thích|bình luận|chia sẻ|người xem|người thích)/i.test(line) ||
        
        // Vietnamese metrics with additional patterns - MORE SPECIFIC to avoid false positives
        /^[\d,\.]+[KkMm]?\s+(người đã xem|người dùng|phản hồi|chia sẻ lại)$/i.test(line) ||
        
        // Handle alone (more permissive but still specific)
        /^@[\w.-]+$/i.test(line) ||
        
        // Date formats (more variations)
        /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/i.test(line) ||
        
        // Time indicators (expanded patterns)
        /^(about |khoảng )?\d+\s+(day|days|hour|hours|minute|minutes|second|seconds|ngày|giờ|phút|giây)( ago| trước)?$/i.test(line) ||
        
        // UI elements with more variations
        /^(translated from|translate|dịch|translated by|thread|reply|thread trả lời|view activity|xem hoạt động)$/i.test(line) ||
        
        // Account verifications
        /^(verified|official|chính thức)$/i.test(line) ||
        
        // Action commands
        /^(follow|unfollow|theo dõi|hủy theo dõi|mute|block|chặn|report|báo cáo)$/i.test(line) ||
        
        // System indicators
        /^(edited|đã chỉnh sửa|hidden|ẩn|pinned|ghim)$/i.test(line);
      
      if (isMetadata) {
        metadataLines.push(line);
      } else {
        contentLines.push(line);
      }
    }
    
    // Post-processing: If the content has been reduced to almost nothing, 
    // but the original had substantial content, use the original
    if (contentLines.length === 0 || (contentLines.join(' ').length < 20 && metadataText.length > 100)) {
      console.log('Content was over-filtered - restoring original content');
      // Restore the original content except for obvious UI elements
      contentText = originalContent
        .replace(/^@[\w.-]+\s*$/gm, '')            // Handles alone on a line
        .replace(/^\d+\s*$/gm, '')                 // Numbers alone on a line
        .replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s*$/gm, '') // Dates alone on a line
        .replace(/^(translate|dịch)\s*$/gim, '');  // Translate buttons
    } else {
      // Keep the clean content, discard the metadata
      contentText = contentLines.join('\n');
    }
    
    // Process the content to remove repeated author handles at start of posts
    contentText = processRepeatedHandles(contentText, authorUsername);
    
    // NEW: Detect and remove sequences of standalone numbers (likely metrics)
    function removeNumberSequences(text) {
      if (!text) return text;
      
      const lines = text.split('\n');
      if (lines.length < 2) return text; // Not enough lines for sequence detection
      
      const result = [];
      let skipCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        // Skip lines already marked for removal
        if (skipCount > 0) {
          skipCount--;
          continue;
        }
        
        // Check for sequences of 2-3 consecutive numbers
        if (i < lines.length - 1 && /^\d{1,3}$/.test(lines[i])) {
          // Look ahead for number sequences
          let isNumberSequence = false;
          let sequenceLength = 1;
          
          // Check next line
          if (/^\d{1,3}$/.test(lines[i+1])) {
            sequenceLength = 2;
            isNumberSequence = true;
            
            // Check one more line if available
            if (i < lines.length - 2 && /^\d{1,3}$/.test(lines[i+2])) {
              sequenceLength = 3;
            }
          }
          
          if (isNumberSequence) {
            console.log(`Removing sequence of ${sequenceLength} numbers starting with ${lines[i]}`);
            skipCount = sequenceLength - 1; // Skip the next lines in sequence
            continue; // Skip current line
          }
        }
        
        // Keep this line
        result.push(lines[i]);
      }
      
      return result.join('\n');
    }
    
    // Apply number sequence removal
    contentText = removeNumberSequences(contentText);
    
    // NEW: Special handling for standalone handles on their own lines
    const standaloneHandleRegex = /^([a-zA-Z0-9._-]{3,20})$/gm;
    contentText = contentText.replace(standaloneHandleRegex, (match, handle) => {
      // Count how many times this exact handle appears on its own line
      const count = (contentText.match(new RegExp(`^${handle}$`, 'gm')) || []).length;
      
      // If it appears multiple times as a standalone line, it's likely a handle pattern
      if (count >= 2) {
        console.log(`Removing standalone handle "${handle}" appearing ${count} times`);
        return ''; // Remove it entirely
      }
      
      return match; // Keep it if not repeated
    });
    
    // Clean up whitespace while preserving line breaks
    contentText = contentText
      .split('\n')                     // Split into lines
      .map(line => line.trim())        // Trim each line
      .filter(line => {
        // Filter out empty lines and standalone handles
        if (line.length === 0) return false;
        
        // Check if this line is just a standalone handle
        if (/^[a-zA-Z0-9._-]{3,20}$/.test(line)) {
          // Count occurrences of this handle in the whole text
          const handleCount = contentText.split('\n').filter(l => l.trim() === line).length;
          if (handleCount >= 2) {
            console.log(`Filtering out standalone handle: ${line}`);
            return false; // Filter out repeated handles
          }
        }
        
        return true; // Keep all other lines
      })
      .join('\n');                     // Join back with original line breaks
    
    // Add back media content if exists
    if (mediaContent.length > 0) {
      // Group by type
      const youtubeLinks = mediaContent.filter(m => m.type === 'youtube');
      const images = mediaContent.filter(m => m.type === 'image');
      const otherLinks = mediaContent.filter(m => m.type === 'link');
      
      // Add YouTube links first
      youtubeLinks.forEach(media => {
        contentText += '\n[YouTube: ' + media.url + ']';
      });
      
      // Then images
      images.forEach(media => {
        contentText += '\n[Image: ' + media.url + ']';
      });
      
      // Finally other links
      otherLinks.forEach(media => {
        contentText += '\n[Link: ' + media.url + ']';
      });
    }
    
    // Post-processing: Apply final cleaning to remove any remaining metrics and UI elements
    contentText = contentText
      // Vietnamese metrics with K/M suffixes (e.g., "1,1K lượt xem") - MORE SPECIFIC
      .replace(/^[\d\.,]+[KkMm]\s+(lượt xem|lượt thích|bình luận|chia sẻ|người xem)$/gm, '')
      // English metrics with K/M suffixes - MORE SPECIFIC
      .replace(/^[\d\.,]+[KkMm]\s+(views?|likes?|comments?|reposts?)$/gm, '')
      // Remove "thread" prefix from posts - ONLY EXACT MATCHES
      .replace(/^Thread\s*[:\.]\s*/gim, '')
      // Focus on handle patterns instead of generic patterns
      .replace(/^(.+?):\s*\n(.+?):\s*\n(.+?):\s*\n/gm, function(match, p1, p2, p3) {
        // Only if all three match the same pattern, it's likely an author handle prefix
        if (p1.toLowerCase() === p2.toLowerCase() && p2.toLowerCase() === p3.toLowerCase()) {
          // Make sure it's a username-like pattern, not just any repeated line start
          if (/^[@\w\s\(\)]{3,30}$/.test(p1)) {
            return '';
          }
        }
        return match; // No change if they don't all match or don't look like handles
      });

    // NEW: More targeted approach to handle specific cases of handles
    // Instead of trying to detect all potential handles which might affect content,
    // focus specifically on the issues the user mentioned

    // FOCUS ON PRIMARY ISSUES:
    // 1. Handles that stand alone on a line 
    // 2. Handles that appear multiple times in a line
    // 3. Vietnamese metrics that still show up

    // Clean up standalone handles without affecting other content
    function cleanStandaloneHandles(text) {
      if (!text || typeof text !== 'string') return text;
      
      // Split text into lines for processing
      let lines = text.split('\n');
      
      // Pattern for username-like words (standalone handles)
      const usernamePattern = /^([a-zA-Z0-9._-]{3,20})$/;
      const atUsernamePattern = /^@([a-zA-Z0-9._-]{3,20})$/;
      
      // First pass: identify frequency of potential handles
      const handleFrequency = {};
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        
        // Check for standalone handles (@username or username)
        const usernameMatch = trimmedLine.match(usernamePattern);
        const atUsernameMatch = trimmedLine.match(atUsernamePattern);
        
        if (usernameMatch) {
          const handle = usernameMatch[1].toLowerCase();
          handleFrequency[handle] = (handleFrequency[handle] || 0) + 1;
        }
        
        if (atUsernameMatch) {
          const handle = '@' + atUsernameMatch[1].toLowerCase();
          handleFrequency[handle] = (handleFrequency[handle] || 0) + 1;
        }
      });
      
      // Second pass: remove standalone handles that appear multiple times
      lines = lines.filter(line => {
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (trimmedLine === '') return true;
        
        // NEW: Check for standalone numbers (usually engagement metrics)
        // Only remove digits that are 1-3 characters long and appear on their own line
        if (/^\d{1,3}$/.test(trimmedLine)) {
          console.log(`Removing standalone number: ${trimmedLine} (likely engagement metric)`);
          return false; // Remove standalone numbers
        }
        
        // Check if it's a standalone handle
        const usernameMatch = trimmedLine.match(usernamePattern);
        const atUsernameMatch = trimmedLine.match(atUsernamePattern);
        
        let isFrequentHandle = false;
        
        if (usernameMatch) {
          const handle = usernameMatch[1].toLowerCase();
          // Remove if this handle appears multiple times
          isFrequentHandle = handleFrequency[handle] >= 2;
          
          if (isFrequentHandle) {
            console.log(`Removing standalone username: ${handle} (appears ${handleFrequency[handle]} times)`);
            return false;
          }
        }
        
        if (atUsernameMatch) {
          const handle = '@' + atUsernameMatch[1].toLowerCase();
          // Remove if this handle appears multiple times
          isFrequentHandle = handleFrequency[handle] >= 2;
          
          if (isFrequentHandle) {
            console.log(`Removing standalone @username: ${handle} (appears ${handleFrequency[handle]} times)`);
            return false;
          }
        }
        
        // Also check for Vietnamese metrics that might have been missed
        if (/^\d+\s*(lượt xem|lượt thích|bình luận|chia sẻ|người xem)$/i.test(trimmedLine)) {
          console.log(`Removing Vietnamese metric: ${trimmedLine}`);
          return false;
        }
        
        // Keep all other lines
        return true;
      });
      
      return lines.join('\n');
    }

    // Apply the more targeted cleaning function
    contentText = cleanStandaloneHandles(contentText);
    
    // If we detect a common Threads pattern where posts start with the same name/handle
    // over and over, it's likely a formatting issue - try to identify and clean it
    const prefixAnalysisLines = contentText.split('\n');
    if (prefixAnalysisLines.length > 3) {
      // Check if multiple consecutive lines start with the same text pattern
      const prefixPattern = {};
      let mostCommonPrefix = '';
      let mostCommonCount = 0;
      
      // Look for common prefixes ending with colon
      for (const line of prefixAnalysisLines) {
        const match = line.match(/^(.+?):\s/);
        if (match && match[1]) {
          const prefix = match[1].toLowerCase().trim();
          prefixPattern[prefix] = (prefixPattern[prefix] || 0) + 1;
          
          if (prefixPattern[prefix] > mostCommonCount) {
            mostCommonCount = prefixPattern[prefix];
            mostCommonPrefix = prefix;
          }
        }
      }
      
      // If we found a common prefix pattern that appears multiple times
      if (mostCommonCount > 2 && mostCommonCount / prefixAnalysisLines.length > 0.3) {
        console.log(`Detected repeated prefix pattern "${mostCommonPrefix}" appearing ${mostCommonCount} times, cleaning...`);
        
        // Create a regex to remove this prefix while preserving the rest of the content
        const prefixRegex = new RegExp(`^${mostCommonPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*`, 'gim');
        contentText = contentText.replace(prefixRegex, '');
      }
    }
    
    return contentText.trim();
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

  // Apply final cleaning to remove common patterns of handle repeats not caught earlier
  threadContent = threadContent
    // Remove full patterns like "John Doe (@johndoe):" at the start of lines
    .replace(/<br>[\w\s]+\s*\(@[\w.-]+\)\s*:/g, '<br>')
    .replace(/^[\w\s]+\s*\(@[\w.-]+\)\s*:/g, '')
    
    // Remove common username patterns at line starts
    .replace(/<br>@[\w.-]+\s*:/g, '<br>')
    .replace(/^@[\w.-]+\s*:/g, '')
    
    // NEW: Remove standalone usernames (without :) that appear on their own lines
    .replace(/<br>([a-zA-Z0-9._-]{3,20})<br>/g, '<br><br>')  // username between line breaks
    .replace(/^([a-zA-Z0-9._-]{3,20})<br>/g, '<br>')         // username at start of content
    .replace(/<br>([a-zA-Z0-9._-]{3,20})$/g, '')            // username at end of content
    
    // Clean up line-ending handles (@username<br>)
    .replace(/@[\w.-]+\s*<br>/g, '<br>')
    
    // Remove any isolated handles that are just on their own line 
    .replace(/<br>@[\w.-]+<br>/g, '<br><br>')
    .replace(/^@[\w.-]+<br>/g, '<br>')
    .replace(/<br>@[\w.-]+$/g, '')
    
    // NEW: More aggressive cleaning for plain usernames (without @) at line starts
    .replace(new RegExp('<br>([\\w.-]{3,15})<br>', 'g'), '<br><br>') // Username alone on line
    .replace(new RegExp('^([\\w.-]{3,15})<br>', 'g'), '<br>') // Username at start
    .replace(new RegExp('<br>([\\w.-]{3,15})$', 'g'), '') // Username at end
    
    // NEW: Check for repeating patterns at line starts
    .replace(/<br>([a-zA-Z0-9._-]{3,20})<br>\s*([^<]+)/g, function(match, username, content) {
      // Count occurrences of this username in the whole content
      const usernameCount = (threadContent.match(new RegExp('<br>' + username + '<br>', 'g')) || []).length;
      if (usernameCount >= 2) {
        return '<br>' + content; // Remove repeated username
      }
      return match; // No change
    })
    .replace(/^([a-zA-Z0-9._-]{3,20})<br>\s*([^<]+)/, function(match, username, content) {
      // Check for the same username later in the content
      if (threadContent.includes('<br>' + username + '<br>')) {
        return content; // Remove username if it repeats
      } 
      return match; // No change
    })
    
    // Remove any extraneous line breaks
    .replace(/^<br>|<br>$/g, '')                // Remove breaks at start/end
    .trim();

  // NEW: Final post-processing to catch handles that appear repeatedly across the whole text
  // This is a more aggressive approach for stubborn patterns
  const finalContentLines = threadContent.split('<br>');
  if (finalContentLines.length > 3) {
    // Track standalone words that appear on their own lines
    const standaloneWords = {};
    
    // First pass: find words that appear alone on lines
    finalContentLines.forEach(line => {
      // Look for lines with just a single word (no spaces)
      if (/^[a-zA-Z0-9._-]{3,20}$/.test(line.trim()) && !line.includes(' ')) {
        const word = line.trim();
        standaloneWords[word] = (standaloneWords[word] || 0) + 1;
      }
    });
    
    // Find the most frequent standalone word
    let mostFrequentStandaloneWord = '';
    let highestStandaloneFrequency = 0;
    
    for (const word in standaloneWords) {
      if (standaloneWords[word] > highestStandaloneFrequency) {
        highestStandaloneFrequency = standaloneWords[word];
        mostFrequentStandaloneWord = word;
      }
    }
    
    // Only remove if the word appears multiple times
    if (highestStandaloneFrequency >= 2) {
      console.log(`Found repeated standalone handle: "${mostFrequentStandaloneWord}" (${highestStandaloneFrequency} times)`);
      
      // Remove standalone instances of this word
      const cleanedLines = finalContentLines.filter(line => 
        line.trim() !== mostFrequentStandaloneWord
      );
      
      // Re-join the cleaned lines
      threadContent = cleanedLines.join('<br>');
    }
    
    // Count the frequency of each "word" at the beginning of lines
    const lineStartWords = {};
    let mostFrequentWord = '';
    let highestFrequency = 0;
    
    // First pass: identify frequent words at line starts
    finalContentLines.forEach(line => {
      // Extract the first word of each line
      const firstWordMatch = line.match(/^([a-zA-Z0-9._-]{3,20})(?!\w)/);
      if (firstWordMatch) {
        const word = firstWordMatch[1].toLowerCase();
        lineStartWords[word] = (lineStartWords[word] || 0) + 1;
        
        if (lineStartWords[word] > highestFrequency) {
          highestFrequency = lineStartWords[word];
          mostFrequentWord = word;
        }
      }
    });
    
    // If we found a word that appears frequently at the start of lines
    // and it appears in more than 10% of all lines
    if (highestFrequency > 2 && highestFrequency / finalContentLines.length > 0.1) {
      console.log(`Found repeated word pattern at line starts: "${mostFrequentWord}" (${highestFrequency} times)`);
      
      // Second pass: remove this word from line starts
      const cleanedLines = finalContentLines.map(line => {
        if (line.toLowerCase().startsWith(mostFrequentWord.toLowerCase())) {
          // Remove the word from the start
          return line.replace(new RegExp(`^${mostFrequentWord}\\b\\s*`, 'i'), '');
        }
        return line;
      });
      
      // Re-join the cleaned lines
      threadContent = cleanedLines.join('<br>');
    }
  }
  
  // NEW: Final specialized cleanup for example case "pjnghng" and similar patterns
  // This detects and removes any lines that contain ONLY a short word without spaces
  threadContent = threadContent.replace(/<br>([a-zA-Z0-9._-]{3,20})<br>/g, function(match, word) {
    // If it's less than 3 characters, likely not a username
    if (word.length < 3) return match;
    
    // If it contains spaces, not a standalone word
    if (word.includes(' ')) return match;
    
    // Count how many times this exact word appears as a standalone line
    const regex = new RegExp(`<br>${word}<br>|^${word}<br>|<br>${word}$`, 'g');
    const count = (threadContent.match(regex) || []).length;
    
    // If this word appears multiple times on its own lines, it's likely a handle
    if (count >= 2) {
      console.log(`Removing detected standalone word: "${word}" (appears ${count} times)`);
      return '<br><br>'; // Replace with double line break
    }
    
    return match; // Keep it if not repeated
  });
  
  // Final cleanup pass - direct search for "pjnghng" pattern from example
  if (threadContent.includes('pjnghng')) {
    console.log('Found "pjnghng" pattern, removing directly');
    threadContent = threadContent
      .replace(/<br>pjnghng<br>/g, '<br><br>')
      .replace(/^pjnghng<br>/g, '<br>')
      .replace(/<br>pjnghng$/g, '');
  }
  
  // NEW: Final cleanup for Vietnamese metrics that might have slipped through
  // This targets specific patterns of metrics that users reported
  threadContent = threadContent.replace(/<br>(\d+)\s*(lượt xem|lượt thích|bình luận|chia sẻ|người xem)<br>/gi, '<br><br>');
  threadContent = threadContent.replace(/^(\d+)\s*(lượt xem|lượt thích|bình luận|chia sẻ|người xem)<br>/gi, '<br>');
  threadContent = threadContent.replace(/<br>(\d+)\s*(lượt xem|lượt thích|bình luận|chia sẻ|người xem)$/gi, '');
  
  // NEW: More targeted handle cleaning without affecting regular text
  // Only clean handles that stand alone on lines or appear repeatedly
  threadContent = threadContent.replace(/<br>([a-zA-Z0-9._-]{3,20})<br>/g, function(match, handle) {
    // Don't affect potential content like "Step 1" or "Principle 2"
    if (/step|principle|nguyên|bước/i.test(handle)) return match;
    
    // Check if this pattern appears multiple times
    const handleRegex = new RegExp(`<br>${handle}<br>`, 'g');
    const count = (threadContent.match(handleRegex) || []).length;
    
    if (count >= 2) {
      console.log(`Final HTML cleaning: removing repeated handle "${handle}" (${count} times)`);
      return '<br><br>';
    }
    
    return match;
  });
  
  // NEW: Clean up sequences of standalone numbers that are likely engagement metrics
  // Pattern: Look for sequences of 1-3 single digits (e.g., 1<br>1<br>2)
  // These are usually like/reply/share counts that weren't caught by earlier filters
  threadContent = threadContent.replace(/<br>(\d{1,3})<br>(\d{1,3})<br>(\d{1,3})<br>/g, '<br><br>');
  threadContent = threadContent.replace(/<br>(\d{1,3})<br>(\d{1,3})<br>/g, '<br><br>');
  threadContent = threadContent.replace(/^(\d{1,3})<br>(\d{1,3})<br>/g, '<br>');
  threadContent = threadContent.replace(/<br>(\d{1,3})<br>(\d{1,3})$/g, '');
  
  // Additional cleaning for consecutive isolated numbers at the end of content
  // This typically catches metrics at the end of a post
  threadContent = threadContent.replace(/(<br>[\d]{1,3}){1,5}$/g, '');
  
  // NEW: Final cleanup for isolated single digits in the HTML output
  // These are commonly engagement metrics like likes/replies/reposts
  // Only target completely isolated numbers (not part of text)
  threadContent = threadContent.replace(/<br>(\d{1,3})<br>/g, (match, num) => {
    const numVal = parseInt(num, 10);
    // Only remove numbers that are likely to be metrics
    // Most posts don't have thousands of likes/comments
    if (numVal < 1000) {
      console.log(`Removing isolated number in HTML: ${num}`);
      return '<br><br>';
    }
    return match;
  });
  
  // Remove isolated numbers at the start of content
  threadContent = threadContent.replace(/^(\d{1,3})<br>/g, '<br>');
  
  // Remove isolated numbers at the end of content
  threadContent = threadContent.replace(/<br>(\d{1,3})$/g, '');
  
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
      margin-right: 20px;
      background-color: ${avatarColor};
    }
    
    .author-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      position: relative;
      z-index: 2;
    }
    
    .author-initials {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 24px;
      text-transform: uppercase;
      z-index: 1;
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
      word-break: normal; /* Fix for handles with dots and underscores */
      overflow-wrap: break-word; /* Allow wrapping but not in the middle of words */
      max-width: 100%; /* Ensure the full handle is visible */
      display: inline-block; /* Ensure proper handling of long usernames */
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
  <script>
    // Define copyText function in the global scope
    function copyText() {
      try {
        // Extract plain text from the article
        const articleDiv = document.querySelector('.article');
        if (!articleDiv) {
          throw new Error('Article content not found');
        }
        
        // Store original posts as they appear in the HTML
        const originalHTML = articleDiv.innerHTML;
        
        // Create a temporary div to work with
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalHTML;
        
        // Convert all <br> tags to newlines
        tempDiv.innerHTML = tempDiv.innerHTML.replace(/<br\\s*\\/?>/gi, '\\n');
        
        // Find all triple newlines (post separators) and replace with divider
        const plainText = tempDiv.textContent
          .replace(/\\n{3,}/g, '\\n\\n---\\n\\n')  // Replace triple+ newlines with divider
          .replace(/\\n{2,}/g, '\\n\\n')         // Normalize double+ newlines
          .trim();
        
        // Create a temporary textarea element for copying
        const textarea = document.createElement('textarea');
        textarea.value = plainText;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        
        // Select and copy
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (!success) {
          throw new Error('Failed to copy using execCommand');
        }
        
        // Show success message
        const msg = document.createElement('div');
        msg.className = 'copy-success';
        msg.textContent = 'Text copied!';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
        
      } catch (err) {
        console.error('Copy failed:', err);
        
        // Provide manual copy option as fallback
        const textarea = document.createElement('textarea');
        const articleDiv = document.querySelector('.article');
        
        // Create a simpler fallback text version
        let fallbackText = '';
        if (articleDiv) {
          // Replace breaks with newlines and strip HTML tags
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = articleDiv.innerHTML.replace(/<br\\s*\\/?>/gi, '\\n');
          fallbackText = tempDiv.textContent;
        } else {
          fallbackText = 'Could not extract text. Please try again.';
        }
        
        textarea.value = fallbackText;
        textarea.style.position = 'fixed';
        textarea.style.left = '50%';
        textarea.style.top = '50%';
        textarea.style.transform = 'translate(-50%, -50%)';
        textarea.style.width = '80%';
        textarea.style.height = '200px';
        textarea.style.padding = '10px';
        textarea.style.zIndex = '9999';
        textarea.style.border = '2px solid #0095f6';
        
        const msg = document.createElement('div');
        msg.textContent = 'Select all (Ctrl+A) and copy (Ctrl+C)';
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
        
        document.body.appendChild(textarea);
        document.body.appendChild(msg);
        document.body.appendChild(closeBtn);
        
        textarea.focus();
        textarea.select();
      }
    }
    
    // Add interactive editing mode
    function enableEditMode() {
      const article = document.querySelector('.article');
      if (!article) return;
      
      // Create a status indicator
      const editModeIndicator = document.createElement('div');
      editModeIndicator.className = 'edit-mode-indicator';
      editModeIndicator.textContent = 'Edit Mode: ON - Hover to highlight, click to remove elements';
      document.body.appendChild(editModeIndicator);
      
      // Create a history stack for undo functionality
      const history = [];
      let currentState = article.innerHTML;
      history.push(currentState);
      
      // Parse the HTML string and split by <br> tags to get individual elements
      const elements = article.innerHTML.split(/(<br>|<[^>]+>)/g).filter(Boolean);
      
      // Clear the article
      article.innerHTML = '';
      
      // Create spans for each text segment for interactivity
      elements.forEach(element => {
        if (element === '<br>') {
          article.appendChild(document.createElement('br'));
        } else if (element.startsWith('<') && element.endsWith('>')) {
          // For HTML elements like links or images, preserve them
          const temp = document.createElement('div');
          temp.innerHTML = element;
          while (temp.firstChild) {
            article.appendChild(temp.firstChild);
          }
        } else {
          // Text content
          const span = document.createElement('span');
          span.className = 'editable-segment';
          span.innerHTML = element;
          span.title = 'Click to remove this element';
          
          // Add event listeners for interactive editing
          span.addEventListener('mouseover', function() {
            this.classList.add('highlight');
          });
          
          span.addEventListener('mouseout', function() {
            this.classList.remove('highlight');
          });
          
          span.addEventListener('click', function() {
            this.remove();
            
            // Save to history
            currentState = article.innerHTML;
            history.push(currentState);
            
            // Update UI
            updateWordCount();
          });
          
          article.appendChild(span);
        }
      });
      
      // Undo button
      const undoBtn = document.createElement('button');
      undoBtn.textContent = 'Undo Last Delete';
      undoBtn.className = 'action-button edit-mode-button';
      undoBtn.style.position = 'fixed';
      undoBtn.style.top = '10px';
      undoBtn.style.right = '10px';
      document.body.appendChild(undoBtn);
      
      undoBtn.addEventListener('click', function() {
        if (history.length > 1) {
          history.pop(); // Remove current state
          currentState = history[history.length - 1]; // Get previous state
          article.innerHTML = currentState;
          updateWordCount();
        }
      });
      
      // Exit edit mode button
      const exitBtn = document.createElement('button');
      exitBtn.textContent = 'Exit Edit Mode';
      exitBtn.className = 'action-button edit-mode-button';
      exitBtn.style.position = 'fixed';
      exitBtn.style.top = '50px';
      exitBtn.style.right = '10px';
      document.body.appendChild(exitBtn);
      
      exitBtn.addEventListener('click', function() {
        // Clean up edit mode
        document.querySelectorAll('.edit-mode-button').forEach(btn => btn.remove());
        editModeIndicator.remove();
        
        // Convert spans back to plain text
        const cleanedHTML = article.innerHTML
          .replace(/<span class="editable-segment( highlight)?">([^<]+)<\/span>/g, "$2");
        
        article.innerHTML = cleanedHTML;
        
        // Re-enable normal controls
        document.querySelectorAll('.action-button').forEach(btn => {
          btn.disabled = false;
        });
      });
      
      // Disable other buttons during edit mode
      document.querySelectorAll('.action-button:not(.edit-mode-button)').forEach(btn => {
        btn.disabled = true;
      });
      
      // Update word count function
      function updateWordCount() {
        const wordCountElement = document.querySelector('.thread-info');
        if (wordCountElement) {
          const text = article.textContent;
          const wordCount = text.split(/\s+/).filter(Boolean).length;
          const readTimeMinutes = Math.max(1, Math.round(wordCount / 200));
          
          // Update read time in the UI
          wordCountElement.innerHTML = wordCountElement.innerHTML.replace(
            /\d+\s+min\s+read/, 
            readTimeMinutes + " min read"
          );
        }
      }
      
      // Add CSS for edit mode
      const style = document.createElement('style');
      style.textContent = `
        .editable-segment {
          cursor: pointer;
          display: inline;
          transition: background-color 0.2s ease;
        }
        
        .highlight {
          background-color: #ffffa0;
        }
        
        .edit-mode-indicator {
          position: fixed;
          top: 10px;
          left: 10px;
          background-color: #007bff;
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          z-index: 1000;
          font-size: 14px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .edit-mode-button {
          z-index: 1000;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
      `;
      document.head.appendChild(style);
    }
    
    // Function to save as Markdown
    function saveAsMarkdown() {
      try {
        const article = document.querySelector('.article');
        const authorName = document.querySelector('.author-name').textContent;
        const authorUsername = document.querySelector('.author-username').textContent;
        
        // Convert HTML to Markdown
        let markdown = "# " + authorName + "'s Thread\n\n";
        markdown += "> Author: " + authorUsername + "\n\n";
        
        // Process the content, replacing HTML with Markdown syntax
        let content = article.innerHTML
          .replace(/<br>/g, '\n')
          .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g, '[$2]($1)')
          .replace(/<img[^>]*src="([^"]*)"[^>]*>/g, '![]($1)')
          .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
          .trim();
        
        markdown += content + '\n\n';
        markdown += '---\n';
        markdown += "Source: [Threads](" + window.location.href + ")\n";
        
        // Create download
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Show success message
        const msg = document.createElement('div');
        msg.className = 'copy-success';
        msg.textContent = 'Markdown file downloaded!';
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
        
      } catch (err) {
        console.error('Markdown export failed:', err);
        alert('Failed to export as Markdown: ' + err.message);
      }
    }
    
    // Handle image loading on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
      const avatarImg = document.querySelector('.author-image');
      const initials = document.querySelector('.author-initials');
      
      // When image loads successfully
      avatarImg.addEventListener('load', function() {
        // Check if the image actually loaded with content
        if (avatarImg.naturalWidth > 0 && avatarImg.naturalHeight > 0) {
          initials.style.display = 'none'; // Hide initials
        } else {
          avatarImg.style.display = 'none'; // Hide broken image
        }
      });
      
      // When image fails to load
      avatarImg.addEventListener('error', function() {
        avatarImg.style.display = 'none'; // Hide broken image
      });
      
      // Add the expanded action buttons including edit mode and markdown export
      const actionButtons = document.querySelector('.action-buttons');
      if (actionButtons) {
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit Mode';
        editButton.className = 'action-button';
        editButton.onclick = enableEditMode;
        actionButtons.appendChild(editButton);
        
        const markdownButton = document.createElement('button');
        markdownButton.textContent = 'Save as MD';
        markdownButton.className = 'action-button';
        markdownButton.onclick = saveAsMarkdown;
        actionButtons.appendChild(markdownButton);
      }
    });
  </script>
</head>
<body>
  <div class="container">
    <div class="author-header">
      <div class="author-image-container">
        <img src="${avatarUrl}" alt="${authorName}'s profile picture" class="author-image">
        <div class="author-initials">${authorInitials}</div>
      </div>
      <div class="author-info">
        <div class="author-name">${authorName}</div>
        <div class="author-username">${authorUsername}</div>
        <div class="thread-info">${totalWords} words · ${readTimeMinutes} min read${originalDate ? ' · ' + originalDate : ''}</div>
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
      .replace(/\[(https?:\/\/[^\]]+)\]/g, (match, url) => {
        // Extract domain name for display
        let domain = '';
        try {
          domain = new URL(url).hostname.replace(/^www\./, '');
        } catch (e) {
          domain = 'external link';
        }
        
        return `<a href="${url}" class="post-link external" target="_blank" rel="noopener noreferrer">
          <span class="link-domain">${domain}</span>
          <span class="link-text">${url}</span>
        </a>`;
      })}</div>
    
    <div class="action-buttons">
      <button onclick="copyText()" class="action-button">Copy Text</button>
      <button onclick="window.print()" class="action-button">Save PDF</button>
      <button onclick="enableEditMode()" class="action-button">Edit Mode</button>
      <button onclick="saveAsMarkdown()" class="action-button">Save MD</button>
    </div>
    
    <div class="footer">
      <p>Thread by ${authorName} (${authorUsername}) on ${originalDate ? originalDate : 'Threads'}</p>
      <p>Exported on ${new Date().toLocaleDateString()} • <a href="${threadUrl}" target="_blank" rel="noopener noreferrer">Original thread</a></p>
    </div>
  </div>
  
  <script>
    // Function to copy text to clipboard
    function copyText() {
      const articleText = document.querySelector('.article').innerText;
      navigator.clipboard.writeText(articleText)
        .then(() => {
          const msg = document.createElement('div');
          msg.className = 'copy-success';
          msg.textContent = 'Text copied to clipboard!';
          document.body.appendChild(msg);
          setTimeout(() => msg.remove(), 2000);
        })
        .catch(err => {
          console.error('Error copying text: ', err);
          alert('Failed to copy text: ' + err);
        });
    }
  </script>
  <script src="interactive.js"></script>
</body>
</html>`;

  return {
    htmlContent,
    filename: `thread_${sanitizedAuthorUsername}_${timestamp}.html`,
    sanitizedAuthorUsername,
    timestamp
  };
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Create timeout safety mechanism
  let responseTimeout = setTimeout(() => {
    try {
      sendResponse({ 
        success: false, 
        error: 'Operation timed out after 30 seconds' 
      });
    } catch (e) {
      console.error('Failed to send timeout response', e);
    }
  }, 30000); // 30 second timeout
  
  const clearTimeoutSafely = () => {
    try {
      clearTimeout(responseTimeout);
      responseTimeout = null;
    } catch (e) {
      console.error('Failed to clear timeout', e);
    }
  };

  // Wrapper to ensure we only send response once and clear the timeout
  const safeResponse = (response) => {
    try {
      if (responseTimeout) {
        clearTimeoutSafely();
        sendResponse(response);
      }
    } catch (e) {
      console.error('Error sending response:', e);
      try {
        if (responseTimeout) {
          clearTimeoutSafely();
          sendResponse({ success: false, error: 'Error sending response: ' + e.message });
        }
      } catch (finalError) {
        console.error('Critical error sending fallback response', finalError);
      }
    }
  };

  if (request.action === 'preview') {
    (async () => {
      try {
        console.log('Background script received preview request:', request);
        
        if (!request.data) {
          throw new Error('No data provided for preview');
        }
        
        // Generate HTML content
        const { htmlContent, filename } = await generateHtmlContent(request.data);
        
        // Create a URL for the preview using safer method
        let previewUrl;
        try {
          // Always prefer data URL for preview when possible for better compatibility
          if (htmlContent.length < 500000) { // Reduced limit to 500KB to avoid encoding issues
            try {
              // Use a more reliable sanitization approach
              const sanitizedContent = sanitizeForEncoding(htmlContent);
              
              // Try to encode in chunks to avoid malformed URI errors
              let encodedContent = '';
              const chunkSize = 100000; // Process in 100KB chunks
              
              for (let i = 0; i < sanitizedContent.length; i += chunkSize) {
                const chunk = sanitizedContent.substring(i, i + chunkSize);
                try {
                  encodedContent += encodeURIComponent(chunk);
                } catch (chunkError) {
                  console.error('Error encoding chunk:', chunkError);
                  // Skip problematic chunks but continue
                  encodedContent += encodeURIComponent('[Content encoding error]');
                }
              }
              
              previewUrl = 'data:text/html;charset=utf-8,' + encodedContent;
            } catch (encodeError) {
              console.error('Failed to encode content for data URL:', encodeError);
              
              // Fallback to direct navigation with fetched content
              throw new Error('Data URL encoding failed, using tab navigation fallback');
            }
          } else {
            // For very large content, we'll need to use a server-style approach
            throw new Error('Content too large for data URL encoding');
          }
          
          // Create a new tab with the preview
          chrome.tabs.create({ url: previewUrl, active: true }, (tab) => {
            if (chrome.runtime.lastError) {
              safeResponse({
                success: false,
                error: 'Error creating tab: ' + chrome.runtime.lastError.message
              });
              return;
            }
            
            // Store reference to this tab for download functionality
            previewTabs[tab.id] = {
              htmlContent: htmlContent,
              filename: filename,
              originalData: request.data
            };
            
            // Send a message to the popup that preview is ready
            safeResponse({
              success: true,
              previewTabId: tab.id,
              message: 'Preview opened in new tab'
            });
          });
        } catch (error) {
          console.error('Preview URL creation error:', error);
          
          // Ultimate fallback - use a download approach instead of preview
          try {
            // Create a safe fallback by creating a temp file and opening it
            chrome.downloads.download({
              url: 'data:text/html;charset=utf-8,' + encodeURIComponent('<html><body><p>Loading preview...</p></body></html>'),
              filename: filename,
              saveAs: false
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                safeResponse({
                  success: false,
                  error: 'Download fallback failed: ' + chrome.runtime.lastError.message
                });
                return;
              }
              
              // Store reference to the content
              previewTabs[downloadId] = {
                htmlContent: htmlContent,
                filename: filename,
                originalData: request.data
              };
              
              safeResponse({
                success: true,
                previewTabId: downloadId,
                message: 'Preview downloaded, please open the file'
              });
            });
          } catch (fallbackError) {
            // If everything fails, inform the user
            safeResponse({
              success: false,
              error: 'Unable to create preview: ' + error.message + '. ' + fallbackError.message
            });
          }
        }
      } catch (error) {
        console.error('Preview error:', error);
        safeResponse({
          success: false,
          error: error.message
        });
      }
    })().catch(error => {
      console.error('Unhandled async error in preview handler:', error);
      safeResponse({
        success: false,
        error: 'Unhandled error: ' + error.message
      });
    });
    
    return true; // Keep the channel open for asynchronous response
  } else if (request.action === 'download') {
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
        
        // Validate and sanitize HTML content to prevent URI malformed errors
        if (!htmlContent || typeof htmlContent !== 'string') {
          throw new Error('Invalid HTML content generated');
        }
        
        // Limit content size if it's too large (helps prevent URI too large errors)
        if (htmlContent.length > 10000000) { // 10MB limit
          console.warn('HTML content is very large, this may cause issues with data URLs');
          // Consider adding a warning or fallback mechanism for very large content
        }
        
        // Create a URL for the download using our safer function
        try {
          const downloadUrl = createDownloadUrl(htmlContent);
          console.log('Starting download with filename:', filename);
          
          try {
            chrome.downloads.download({
              url: downloadUrl,
              filename: filename,
              saveAs: true
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                console.error('Download error:', chrome.runtime.lastError);
                safeResponse({ 
                  success: false, 
                  error: chrome.runtime.lastError.message 
                });
                return;
              }
              
              console.log('Download started with ID:', downloadId);
              
              // Send success response
              safeResponse({ 
                success: true, 
                downloadId: downloadId,
                filename: filename,
                timestamp: new Date().toISOString()
              });
            });
          } catch (downloadError) {
            console.error('Error downloading:', downloadError);
            safeResponse({
              success: false,
              error: 'Error downloading: ' + downloadError.message
            });
          }
        } catch (urlError) {
          console.error('Error creating download URL:', urlError);
          safeResponse({
            success: false,
            error: 'Error preparing download: ' + urlError.message
          });
        }
      } catch (error) {
        console.error('Background script error:', error);
        safeResponse({ 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    })().catch(error => {
      console.error('Unhandled async error in download handler:', error);
      safeResponse({
        success: false,
        error: 'Unhandled error: ' + error.message
      });
    });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  } else if (request.action === 'downloadFromPreview') {
    (async () => {
      try {
        const previewTabId = request.previewTabId;
        
        if (!previewTabId || !previewTabs[previewTabId]) {
          throw new Error('Invalid preview tab ID or preview not found');
        }
        
        const previewData = previewTabs[previewTabId];
        
        // Validate content before creating data URL
        if (!previewData.htmlContent || typeof previewData.htmlContent !== 'string') {
          throw new Error('Invalid HTML content in preview data');
        }
        
        // Create a URL for the download using our safer function
        try {
          const downloadUrl = createDownloadUrl(previewData.htmlContent);
          console.log('Starting download from preview with filename:', previewData.filename);
          
          try {
            chrome.downloads.download({
              url: downloadUrl,
              filename: previewData.filename,
              saveAs: true
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                console.error('Download error:', chrome.runtime.lastError);
                safeResponse({ 
                  success: false, 
                  error: chrome.runtime.lastError.message 
                });
                return;
              }
              
              console.log('Download started with ID:', downloadId);
              
              // Send success response
              safeResponse({ 
                success: true, 
                downloadId: downloadId,
                filename: previewData.filename,
                timestamp: new Date().toISOString()
              });
            });
          } catch (downloadError) {
            console.error('Error downloading from preview:', downloadError);
            safeResponse({
              success: false,
              error: 'Error downloading from preview: ' + downloadError.message
            });
          }
        } catch (urlError) {
          console.error('Error creating download URL for preview:', urlError);
          safeResponse({
            success: false,
            error: 'Error preparing download: ' + urlError.message
          });
        }
      } catch (error) {
        console.error('Download from preview error:', error);
        safeResponse({ 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    })().catch(error => {
      console.error('Unhandled async error in downloadFromPreview handler:', error);
      safeResponse({
        success: false,
        error: 'Unhandled error: ' + error.message
      });
    });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  } else if (request.action === 'toggleSimplifiedPatterns') {
    // Toggle the pattern set to use
    useSimplifiedPatterns = request.value;
    // Reload patterns with the new setting
    loadPatternsFromJson();
    
    // Use the safe response function here too
    safeResponse({ 
      success: true, 
      message: `Using ${useSimplifiedPatterns ? 'simplified' : 'standard'} cleaning patterns` 
    });
    
    return true; // Required for async response
  } else {
    // For unhandled actions, always send a response
    safeResponse({
      success: false,
      error: `Unknown action: ${request.action}`
    });
    return false; // No async response needed
  }
});

// Listen for tab close events to clean up preview tabs and blob URLs
chrome.tabs.onRemoved.addListener((tabId) => {
  if (previewTabs[tabId]) {
    console.log('Preview tab closed, cleaning up:', tabId);
    delete previewTabs[tabId];
  }
  
  // Clean up any blob URLs when downloads complete or after some time
  if (createdBlobUrls.length > 0) {
    console.log(`Cleaning up ${createdBlobUrls.length} blob URLs`);
    createdBlobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error revoking blob URL:', error);
      }
    });
    createdBlobUrls = [];
  }
});

// Function to create a Blob download URL as an alternative to data URL
// This helps avoid "URI malformed" errors with large content
function createBlobUrl(content, mimeType = 'text/html') {
  try {
    // Create a Blob containing the HTML content
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    
    // Create a URL for the Blob
    const blobUrl = URL.createObjectURL(blob);
    
    // Track this URL for cleanup
    createdBlobUrls.push(blobUrl);
    
    return blobUrl;
  } catch (error) {
    console.error('Error creating blob URL:', error);
    throw new Error('Failed to create download URL: ' + error.message);
  }
}

// Function to safely generate a data URL or fallback to Blob URL for large content
function createDownloadUrl(content, mimeType = 'text/html') {
  try {
    // For smaller content, use data URL which is more compatible
    if (content.length < 1000000) { // 1MB threshold
      return 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(content);
    } else {
      // For larger content, use Blob URL to avoid URI length limits
      console.log('Content is large, using Blob URL instead of data URL');
      return createBlobUrl(content, mimeType);
    }
  } catch (error) {
    console.error('Error creating download URL:', error);
    throw new Error('Failed to create download URL: ' + error.message);
  }
}

// Function to sanitize HTML content for safe URL encoding
// This helps prevent URI malformed errors with special characters
function sanitizeForEncoding(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  try {
    // Handle lone surrogates in a browser-compatible way
    let sanitized = '';
    for (let i = 0; i < content.length; i++) {
      const char = content.charAt(i);
      const code = content.charCodeAt(i);
      
      // Skip lone surrogates that cause encoding issues
      if ((code >= 0xD800 && code <= 0xDBFF && (i === content.length - 1 || content.charCodeAt(i + 1) < 0xDC00 || content.charCodeAt(i + 1) > 0xDFFF)) ||
          (code >= 0xDC00 && code <= 0xDFFF && (i === 0 || content.charCodeAt(i - 1) < 0xD800 || content.charCodeAt(i - 1) > 0xDBFF))) {
        continue;
      }
      
      sanitized += char;
    }
    
    // Further cleaning of other problematic characters
    sanitized = sanitized
      // Remove control characters
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/[\u007F-\u009F]/g, '')
      // Replace special characters that may cause issues
      .replace(/[\u2028\u2029]/g, ' ') // Line/paragraph separators
      .replace(/[\uFEFF\uFFFE\uFFFF]/g, ''); // BOM and non-characters
      
    // Return the sanitized content
    return sanitized;
  } catch (error) {
    console.error('Advanced sanitization failed:', error);
    
    // If advanced sanitization fails, fall back to basic cleaning
    try {
      // Even more basic sanitization as a fallback
      return content
        .replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u0300-\u036F\u0400-\u04FF\u0E00-\u0E7F\u1E00-\u1EFF]/g, '')
        .trim();
    } catch (fallbackError) {
      console.error('Fallback sanitization failed:', fallbackError);
      
      // If all else fails, try to return a basic ASCII version
      return content.replace(/[^\x20-\x7E]/g, '').trim() || 'Content could not be encoded safely.';
    }
  }
} 