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
  style.textContent = '\
    .editable-segment {\
      cursor: pointer;\
      display: inline;\
      transition: background-color 0.2s ease;\
    }\
    \
    .highlight {\
      background-color: #ffffa0;\
    }\
    \
    .edit-mode-indicator {\
      position: fixed;\
      top: 10px;\
      left: 10px;\
      background-color: #007bff;\
      color: white;\
      padding: 8px 12px;\
      border-radius: 4px;\
      z-index: 1000;\
      font-size: 14px;\
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);\
    }\
    \
    .edit-mode-button {\
      z-index: 1000;\
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);\
    }\
  ';
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
