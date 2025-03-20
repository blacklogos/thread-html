// Add initialization flag
let isInitialized = false;

// Initialize the content script
function initialize() {
  console.log('Content script initialized');
  isInitialized = true;
}

// Initialize immediately
initialize();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'ping') {
    console.log('Content script responding to ping');
    sendResponse({ initialized: isInitialized });
    return true;
  }
  
  if (request.action === 'extract') {
    console.log('Starting content extraction...');
    extractThreadData()
      .then(data => {
        console.log('Extracted thread data:', data);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        console.error('Extraction error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Helper function to wait for an element
function waitForElement(selector, timeout = 10000) {
  console.log('Waiting for element:', selector);
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Found element:', selector);
        resolve(element);
        return;
      }
      
      if (Date.now() - startTime >= timeout) {
        console.error('Timeout waiting for element:', selector);
        reject(new Error(`Timeout waiting for element: ${selector}`));
        return;
      }
      
      requestAnimationFrame(checkElement);
    };
    
    checkElement();
  });
}

// Function to find the post container using multiple selectors
function findPostContainer() {
  console.log('Searching for post container...');
  
  // Try multiple possible selectors for the post container
  const selectors = [
    // Threads specific selectors
    'div[data-testid="post-container"]',
    'div[data-testid="thread-post"]',
    'div[data-testid="post"]',
    'div[role="article"]',
    'article',
    
    // Generic content containers
    'div.x1iorvi4',
    'div.x1n2onr6',
    'div.xrvj5dj',
    'div.x1yztbdb',
    'div.x1d52u69',
    'div.xz62fqu',
    'div.x16ldp7u',
    
    // Fallback selectors
    'div[class*="post"]',
    'div[class*="thread"]',
    'div[class*="content"]'
  ];

  for (const selector of selectors) {
    console.log(`Trying selector: ${selector}`);
    const element = document.querySelector(selector);
    if (element) {
      console.log(`Found post container with selector: ${selector}`);
      return element;
    }
  }

  // If no container found, try to find any content that looks like a post
  console.log('No specific container found, searching for post-like content...');
  
  // Look for elements with post-like content
  const possiblePosts = Array.from(document.querySelectorAll('div')).filter(div => {
    const text = div.innerText.trim();
    const hasAuthor = div.querySelector('a[role="link"]') || div.querySelector('a[href*="/"]');
    const hasTimestamp = div.querySelector('time') || div.querySelector('div[data-testid="post-timestamp"]');
    const hasContent = text.length > 50; // Arbitrary length to filter out small divs
    
    return hasAuthor && hasTimestamp && hasContent;
  });

  if (possiblePosts.length > 0) {
    console.log('Found post-like content');
    return possiblePosts[0];
  }

  // Log the page structure for debugging
  console.log('Page structure:', document.body.innerHTML.substring(0, 5000) + '...');
  console.error('No post container found with any selector');
  throw new Error('Post container not found');
}

// Function to find all posts from the same author
function findThreadPosts() {
  console.log('Searching for thread posts...');
  const posts = [];
  const postIds = new Set(); // Track post IDs to avoid duplicates
  const visitedDomNodes = new WeakSet(); // Track DOM nodes we've already processed
  
  // First, get the author information from meta tag
  const metaElement = document.querySelector('meta[property="og:title"]');
  if (!metaElement || !metaElement.content) {
    throw new Error('Author information not found in meta tag');
  }
  
  // Extract author name from meta content (format: "Name (@username) trên Threads")
  const metaContent = metaElement.content;
  const usernameMatch = metaContent.match(/@(\w+)/);
  if (!usernameMatch) {
    throw new Error('Could not extract username from meta tag');
  }
  
  const authorUsername = usernameMatch[1];
  console.log('Found author username:', authorUsername);
  
  // Try to find posts using more reliable methods
  // Method 1: Find articles or post containers
  const allPosts = document.querySelectorAll('article, div[role="article"], div[data-testid="post-container"], div[data-testid="thread-post"]');
  
  // Method 2: If no posts found, try a broader approach
  if (allPosts.length === 0) {
    console.log('No posts found using specific selectors, trying broader approach');
    const contentContainers = document.querySelectorAll('div.x1n2onr6, div.x1iorvi4, div[class*="post"], div[class*="thread"]');
    
    // Filter the containers to find those that look like posts
    for (const container of contentContainers) {
      if (visitedDomNodes.has(container)) continue;
      visitedDomNodes.add(container);
      
      if (container.innerText.length > 100 && 
         (container.querySelector('img') || container.querySelector('a[href*="/@"]'))) {
        
        // Generate a unique ID for this post to avoid duplicates
        const postId = generatePostId(container);
        if (!postIds.has(postId)) {
          postIds.add(postId);
          posts.push(container);
        } else {
          console.log('Skipping duplicate post with ID:', postId.substring(0, 30) + '...');
        }
      }
    }
  } else {
    console.log(`Found ${allPosts.length} potential posts`);
    
    // Filter posts by author
    for (const post of allPosts) {
      if (visitedDomNodes.has(post)) continue;
      visitedDomNodes.add(post);
      
      const postAuthor = post.querySelector(`a[href*="/@${authorUsername}"]`);
      if (postAuthor) {
        const postId = generatePostId(post);
        if (!postIds.has(postId)) {
          postIds.add(postId);
          posts.push(post);
        } else {
          console.log('Skipping duplicate post with ID:', postId.substring(0, 30) + '...');
        }
      }
    }
    
    // If still no posts, collect all posts that have content
    if (posts.length === 0) {
      for (const post of allPosts) {
        if (visitedDomNodes.has(post)) continue;
        visitedDomNodes.add(post);
        
        if (post.innerText.length > 100) {
          const postId = generatePostId(post);
          if (!postIds.has(postId)) {
            postIds.add(postId);
            posts.push(post);
          } else {
            console.log('Skipping duplicate post with ID:', postId.substring(0, 30) + '...');
          }
        }
      }
    }
  }
  
  // Last resort: find divs with significant text content
  if (posts.length === 0) {
    console.log('No posts found using previous methods, trying last resort');
    const contentDivs = Array.from(document.querySelectorAll('div'))
      .filter(div => {
        if (visitedDomNodes.has(div)) return false;
        visitedDomNodes.add(div);
        return div.innerText.length > 150; // Longer text is likely to be post content
      })
      .filter(div => !div.querySelector('script')) // Exclude divs with scripts
      .slice(0, 10); // Limit to 10 to avoid too many false positives
    
    for (const div of contentDivs) {
      const postId = generatePostId(div);
      if (!postIds.has(postId)) {
        postIds.add(postId);
        posts.push(div);
      } else {
        console.log('Skipping duplicate post with ID:', postId.substring(0, 30) + '...');
      }
    }
  }
  
  if (posts.length === 0) {
    throw new Error('No posts found for author: ' + authorUsername);
  }
  
  console.log(`Found ${posts.length} unique posts in thread for author: ${authorUsername}`);
  return posts;
}

// Helper function to generate a unique ID for a post to avoid duplicates
function generatePostId(postElement) {
  // Try to find specific identifier in post
  const postId = postElement.getAttribute('data-testid') || 
                postElement.id ||
                postElement.getAttribute('data-post-id');
                
  if (postId) return `id:${postId}`;
  
  // Extract important content to generate a robust fingerprint
  // 1. Text content (sanitized and normalized)
  const textContent = postElement.innerText
    .trim()
    .replace(/\s+/g, ' ')
    .substring(0, 100);
  
  // 2. Get timestamps if available
  const timeElement = postElement.querySelector('time');
  const timestamp = timeElement ? timeElement.getAttribute('datetime') : '';
  
  // 3. Image sources (take first 2 only to avoid excessive length)
  const imgElements = postElement.querySelectorAll('img');
  const imgSources = Array.from(imgElements)
    .slice(0, 2)
    .map(img => {
      const src = img.src || '';
      return src.split('/').pop().substring(0, 15); // Just the filename part
    })
    .join('|');
  
  // 4. Link URLs if present 
  const linkElements = postElement.querySelectorAll('a[href]');
  const linkHrefs = Array.from(linkElements)
    .slice(0, 2)
    .map(a => {
      const href = a.href || '';
      return href.split('/').pop().substring(0, 15); // Just the last part of URL
    })
    .join('|');
  
  // 5. Class names of key elements (compressed)
  const elementClasses = [
    postElement.className,
    postElement.querySelector('div')?.className || '',
    postElement.querySelector('a')?.className || ''
  ]
    .join('|')
    .substring(0, 30);
  
  // 6. Check for special elements that might indicate uniqueness
  const hasImages = postElement.querySelectorAll('img').length > 0;
  const hasVideo = postElement.querySelector('video') !== null;
  const hasLinks = postElement.querySelectorAll('a').length > 0;
  const specialElements = `${hasImages?1:0}${hasVideo?1:0}${hasLinks?1:0}`;
  
  // 7. Use position in the document as an additional signal
  const positionInfo = getElementPositionInfo(postElement);
  
  // Combine all factors into a complex fingerprint
  // Using a hash function would be ideal, but we'll concatenate for simplicity
  const fingerprint = `${textContent}|${timestamp}|${imgSources}|${linkHrefs}|${elementClasses}|${specialElements}|${positionInfo}`;
  
  // Log the fingerprint for debugging
  console.log('Generated post fingerprint:', fingerprint.substring(0, 30) + '...');
  
  return fingerprint;
}

// Helper function to get position information about an element
function getElementPositionInfo(element) {
  // Get the position in the DOM tree
  let position = 0;
  let sibling = element;
  while (sibling.previousElementSibling) {
    sibling = sibling.previousElementSibling;
    position++;
  }
  
  // Get depth in the DOM tree (how nested the element is)
  let depth = 0;
  let parent = element.parentElement;
  while (parent) {
    depth++;
    parent = parent.parentElement;
  }
  
  return `pos:${position}_depth:${depth}`;
}

// Helper function to create a unique fingerprint for the post data
function createPostFingerprint(postText, timestamp, mediaUrls) {
  // Clean and normalize post text - remove line breaks, extra spaces, and normalize case
  const normalizedText = postText
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200)
    .toLowerCase();
  
  // Get the number of lines originally in the text (helps identify unique posts)
  const lineCount = postText.split('\n').length;
  
  // Get word count as another identifying factor
  const wordCount = postText.split(/\s+/).length;
  
  // Process media URLs to get count and types
  const mediaCount = mediaUrls.length;
  const mediaTypes = mediaUrls
    .map(url => {
      if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png')) return 'img';
      if (url.includes('.mp4') || url.includes('.mov')) return 'video';
      return 'other';
    })
    .join('|');
  
  // Format timestamp consistently
  const formattedTime = new Date(timestamp).toISOString().substring(0, 19);
  
  // Add hash of first 3 words (or fewer if text is shorter)
  const firstWords = normalizedText.split(' ').slice(0, 3).join('_');
  const lastWords = normalizedText.split(' ').slice(-3).join('_');
  
  // Create a hash from the content
  const contentHash = hashString(normalizedText);
  
  // Combine all factors into a fingerprint
  return `${contentHash}|${lineCount}|${wordCount}|${mediaCount}|${mediaTypes}|${formattedTime}|${firstWords}|${lastWords}`;
}

// Simple hash function for strings
function hashString(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString(16);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(16);
}

// Function to extract data from a single post
function extractPostData(postElement) {
  console.log('Extracting data from post element...');
  
  try {
    // Extract post text - first try to find dedicated text containers
    const possibleTextContainers = [
      postElement.querySelector('div[data-testid="post-text"]'),
      postElement.querySelector('div.xrvj5dj'),
      postElement.querySelector('div.x1xdureb'),
      postElement.querySelector('div[dir="auto"]'),
      postElement.querySelector('div[class*="content"]'),
      postElement.querySelector('div[class*="post-content"]')
    ].filter(Boolean);
    
    // If none found, find divs with substantial text that aren't buttons or links
    if (possibleTextContainers.length === 0) {
      console.log('No dedicated text containers found, searching for text-rich divs');
      const textRichDivs = Array.from(postElement.querySelectorAll('div'))
        .filter(div => {
          const text = div.innerText.trim();
          // Must have substantial text and not be a UI element
          return text.length > 30 && 
                !div.querySelector('button') && 
                !div.querySelector('a') && 
                !div.matches('a') &&
                !div.querySelector('time');
        });
      
      possibleTextContainers.push(...textRichDivs);
    }
    
    let postText;
    
    if (possibleTextContainers.length === 0) {
      // Last resort: use the entire element's text if it's not too long (to avoid getting UI text)
      const elementText = postElement.innerText.trim();
      const lines = elementText.split('\n').filter(line => line.trim().length > 0);
      
      // Try to find meaningful content (usually longer lines)
      const contentLines = lines.filter(line => line.length > 20);
      
      if (contentLines.length > 0) {
        postText = contentLines.join('\n');
      } else if (lines.length > 0) {
        // Just take the longest line as the post text
        postText = lines.reduce((a, b) => a.length > b.length ? a : b);
      } else {
        postText = elementText;
      }
      
      console.log('Using fallback extraction method for post text');
    } else {
      // Use the container with the most text that's not a button or link
      const bestTextContainer = possibleTextContainers.reduce((best, current) => {
        return (current.innerText.length > best.innerText.length) ? current : best;
      }, possibleTextContainers[0]);
      
      postText = bestTextContainer.innerText.trim();
    }
    
    // Ensure we have content
    if (!postText || postText.length === 0) {
      postText = "No content available";
    }
    
    console.log('Extracted post text:', postText.substring(0, 100) + (postText.length > 100 ? '...' : ''));
    
    // Get author information
    const author = extractAuthorInfo(postElement);
    console.log('Extracted author:', author);
    
    // Extract timestamp
    const timestamp = extractTimestamp(postElement);
    console.log('Extracted timestamp:', new Date(timestamp).toISOString());
    
    // Extract media URLs
    const mediaUrls = extractMediaUrls(postElement);
    console.log('Extracted media URLs:', mediaUrls);
    
    // Extract replies
    const replies = [];
    const replyElements = postElement.querySelectorAll('div[data-testid="reply-container"], div[class*="reply"]');
    replyElements.forEach(reply => {
      const replyText = reply.innerText.trim();
      if (replyText && !replyText.includes('View more replies') && !replyText.includes('Reply to')) {
        replies.push({ text: replyText, timestamp: extractTimestamp(reply) });
      }
    });
    console.log('Extracted replies:', replies.length);
    
    // Create a unique fingerprint for this post
    const fingerprint = createPostFingerprint(postText, timestamp, mediaUrls);
    
    return {
      postText,
      author,
      timestamp,
      mediaUrls,
      replies,
      fingerprint // Add the fingerprint to identify duplicates later
    };
  } catch (error) {
    console.error('Error extracting post data:', error);
    // Return a valid post with default values
    return {
      postText: "Error extracting post content",
      author: {
        name: "unknown",
        displayName: "Unknown Author",
        url: "https://www.threads.net/"
      },
      timestamp: Date.now(),
      mediaUrls: [],
      replies: [],
      fingerprint: `error_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    };
  }
}

// Helper function to extract author information
function extractAuthorInfo(postElement) {
  // Get author information from meta tag
  const metaElement = document.querySelector('meta[property="og:title"]');
  if (metaElement && metaElement.content) {
    const metaContent = metaElement.content;
    console.log('Meta content:', metaContent);
    
    // Try to extract both display name and username if possible
    let authorDisplayName = '';
    let authorUsername = '';
    
    // Check if we can extract both the display name and username
    const fullNameMatch = metaContent.match(/(.*?)\s+\(@(\w+)\)/);
    if (fullNameMatch) {
      authorDisplayName = fullNameMatch[1].trim();
      authorUsername = fullNameMatch[2];
    } else {
      // Fall back to just extracting username
      const usernameMatch = metaContent.match(/@(\w+)/);
      if (usernameMatch) {
        authorUsername = usernameMatch[1];
        authorDisplayName = authorUsername; // Use username as display name fallback
      } else {
        authorUsername = 'unknown';
        authorDisplayName = metaContent;
      }
    }
    
    const authorUrl = `https://www.threads.net/@${authorUsername}`;
    
    return {
      name: authorUsername,
      displayName: authorDisplayName,
      url: authorUrl
    };
  }
  
  // Fallback to extracting from the post element
  const authorElement = postElement.querySelector('a[role="link"][href*="/@"]') || 
                       postElement.querySelector('a[href*="/@"]');
  
  let authorName = 'unknown';
  let authorUsername = 'unknown';
  let authorUrl = 'https://www.threads.net/';
  
  if (authorElement) {
    authorName = authorElement.textContent.trim();
    authorUrl = authorElement.href || 'https://www.threads.net/';
    // Try to extract username from URL
    const usernameMatch = authorUrl.match(/\/@([^\/]+)/);
    if (usernameMatch) {
      authorUsername = usernameMatch[1];
    }
  }
  
  return {
    name: authorUsername,
    displayName: authorName,
    url: authorUrl
  };
}

// Helper function to extract timestamp
function extractTimestamp(postElement) {
  const timestampElement = postElement.querySelector('time') ||
                          postElement.querySelector('div[data-testid="post-timestamp"]') ||
                          postElement.querySelector('div[class*="timestamp"]');
  
  return timestampElement ? 
    new Date(timestampElement.getAttribute('datetime') || timestampElement.textContent).getTime() : 
    Date.now();
}

// Helper function to extract media URLs
function extractMediaUrls(postElement) {
  const mediaElements = postElement.querySelectorAll('img[src*="threads.net"], img[src*="scontent"], img[src*="instagram"]');
  return Array.from(mediaElements)
    .map(img => img.src)
    .filter(src => !src.includes('emoji') && !src.includes('avatar'));
}

// Function to extract thread data
async function extractThreadData() {
  console.log('Starting thread data extraction...');
  
  try {
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Find all posts in the thread
    const posts = findThreadPosts();
    if (posts.length === 0) {
      throw new Error('No posts found in thread');
    }
    
    // Extract data from each post
    const threadData = posts.map(post => extractPostData(post)).filter(Boolean);
    if (threadData.length === 0) {
      throw new Error('No valid posts found in thread');
    }
    
    // Remove duplicates using the enhanced fingerprint
    const uniquePosts = removeDuplicatePosts(threadData);
    console.log(`Filtered ${threadData.length - uniquePosts.length} duplicate posts, ${uniquePosts.length} unique posts remaining`);
    
    // Sort posts by timestamp if available
    uniquePosts.sort((a, b) => a.timestamp - b.timestamp);
    
    // Get the current URL
    const url = window.location.href;
    
    // Get author information from meta tag
    const metaElement = document.querySelector('meta[property="og:title"]');
    if (!metaElement || !metaElement.content) {
      throw new Error('Author information not found in meta tag');
    }
    
    const metaContent = metaElement.content;
    
    // Try to extract both display name and username if possible
    let authorDisplayName = '';
    let authorUsername = '';
    
    // Check if we can extract both the display name and username
    const fullNameMatch = metaContent.match(/(.*?)\s+\(@(\w+)\)/);
    if (fullNameMatch) {
      authorDisplayName = fullNameMatch[1].trim();
      authorUsername = fullNameMatch[2];
    } else {
      // Fall back to just extracting username
      const usernameMatch = metaContent.match(/@(\w+)/);
      if (usernameMatch) {
        authorUsername = usernameMatch[1];
        authorDisplayName = authorUsername; // Use username as display name fallback
      } else {
        throw new Error('Could not extract username from meta tag');
      }
    }
    
    console.log('Extracted thread data:', {
      posts: uniquePosts.length,
      author: {
        name: authorUsername,
        displayName: authorDisplayName,
        url: `https://www.threads.net/@${authorUsername}`
      },
      url
    });
    
    return {
      posts: uniquePosts,
      url,
      author: {
        name: authorUsername,
        displayName: authorDisplayName,
        url: `https://www.threads.net/@${authorUsername}`
      }
    };
  } catch (error) {
    console.error('Error extracting thread data:', error);
    throw error;
  }
}

// Enhanced function to remove duplicate posts
function removeDuplicatePosts(posts) {
  const uniquePosts = [];
  const seenFingerprints = new Set();
  const contentHashes = new Set();
  
  // First sort by timestamp to prefer keeping the earliest version of a post
  posts.sort((a, b) => a.timestamp - b.timestamp);
  
  for (const post of posts) {
    // Skip posts with error content unless we have no posts yet
    if ((post.postText === "No content available" || post.postText === "Error extracting post content") && 
        uniquePosts.length > 0) {
      console.log('Skipping post with error content');
      continue;
    }
    
    // Create content hash for text-based deduplication
    const normalizedContent = post.postText
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    // Skip completely empty posts
    if (normalizedContent.length < 3 && uniquePosts.length > 0) {
      console.log('Skipping empty post');
      continue;
    }
    
    const contentHash = hashString(normalizedContent);
    
    // Check for near-duplicate content (exact text match)
    if (contentHashes.has(contentHash) && normalizedContent.length > 0) {
      console.log('Skipping content-duplicate post:', post.postText.substring(0, 30) + '...');
      continue;
    }
    
    // Use the fingerprint to identify duplicates
    const fingerprint = post.fingerprint;
    
    if (!seenFingerprints.has(fingerprint)) {
      seenFingerprints.add(fingerprint);
      contentHashes.add(contentHash);
      
      // Remove the fingerprint property before returning the post
      const { fingerprint: _, ...cleanPost } = post;
      uniquePosts.push(cleanPost);
    } else {
      // Compare text content length and keep the longer version if significantly different
      const existingPostIndex = uniquePosts.findIndex(p => {
        // Find the post with this fingerprint
        const existingFingerprint = p.fingerprint || createPostFingerprint(p.postText, p.timestamp, p.mediaUrls);
        return existingFingerprint === fingerprint;
      });
      
      if (existingPostIndex !== -1) {
        const existingPost = uniquePosts[existingPostIndex];
        
        // If new post has significantly more content, replace the old one
        if (post.postText.length > existingPost.postText.length * 1.5) {
          console.log('Replacing shorter duplicate with longer version');
          const { fingerprint: _, ...cleanPost } = post;
          uniquePosts[existingPostIndex] = cleanPost;
        } else {
          console.log('Skipping duplicate post:', post.postText.substring(0, 30) + '...');
        }
      }
    }
  }
  
  // Final pass: Check for posts that are subsets of other posts
  const finalPosts = [];
  const usedIndexes = new Set();
  
  // Sort by length descending to prefer keeping longer posts
  uniquePosts.sort((a, b) => b.postText.length - a.postText.length);
  
  for (let i = 0; i < uniquePosts.length; i++) {
    if (usedIndexes.has(i)) continue;
    
    const currentPost = uniquePosts[i];
    const normalizedCurrent = currentPost.postText
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    usedIndexes.add(i);
    finalPosts.push(currentPost);
    
    // Check if any remaining posts are subsets of this one
    for (let j = i + 1; j < uniquePosts.length; j++) {
      if (usedIndexes.has(j)) continue;
      
      const otherPost = uniquePosts[j];
      const normalizedOther = otherPost.postText
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      
      // If the other post's text is fully contained in the current one,
      // mark it as a duplicate (unless it has media the current one doesn't)
      if (normalizedCurrent.includes(normalizedOther) && 
          (otherPost.mediaUrls.length === 0 || otherPost.mediaUrls.length <= currentPost.mediaUrls.length)) {
        console.log('Excluding subset post:', otherPost.postText.substring(0, 30) + '...');
        usedIndexes.add(j);
      }
    }
  }
  
  // Sort by timestamp for chronological order
  finalPosts.sort((a, b) => a.timestamp - b.timestamp);
  
  console.log(`Final deduplication: ${uniquePosts.length} -> ${finalPosts.length} posts`);
  return finalPosts;
} 