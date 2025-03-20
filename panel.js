document.addEventListener('DOMContentLoaded', () => {
  const previewContainer = document.getElementById('preview-container');
  const downloadBtn = document.getElementById('download-btn');
  const closeBtn = document.getElementById('close-btn');
  const status = document.getElementById('status');
  
  // Current panel information
  let panelId = null;
  
  // Determine if we're in a tab or side panel
  const isInTab = window.location.protocol === 'data:';
  
  // If we're loaded as a data URL in a tab, we need to handle differently
  if (isInTab) {
    console.log('Panel loaded in a tab via data URL');
    handlePreviewInTab();
  } else {
    console.log('Panel loaded in side panel');
    loadPreviewContent();
  }
  
  // Function to handle when loaded directly in a tab
  function handlePreviewInTab() {
    // In this case, we don't need to load the content as it's already in the page
    status.textContent = '';
    
    // Modify UI to indicate tab mode
    document.body.classList.add('tab-mode');
    
    // Set up the download button
    downloadBtn.addEventListener('click', () => {
      const htmlContent = document.documentElement.outerHTML;
      const filename = `thread_${Date.now()}.html`;
      
      // Create download link
      const link = document.createElement('a');
      link.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      status.textContent = 'Download started!';
      setTimeout(() => {
        status.textContent = '';
      }, 3000);
    });
    
    // Set up the close button
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }
  
  // Function to load the preview content
  async function loadPreviewContent() {
    status.textContent = 'Loading preview...';
    
    try {
      // Request the panel data from the background script
      const response = await chrome.runtime.sendMessage({
        action: 'getPanelContent',
        tabId: chrome.devtools?.inspectedWindow?.tabId
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to load preview content');
      }
      
      // Store the panel ID
      panelId = response.panelId;
      
      // Display the HTML content in the container
      previewContainer.innerHTML = response.htmlContent;
      
      // Hide loading status
      status.textContent = '';
      
      // Add event listeners for side panel mode
      downloadBtn.addEventListener('click', downloadHtml);
      closeBtn.addEventListener('click', closePanel);
    } catch (error) {
      console.error('Failed to load preview content:', error);
      status.textContent = `Error: ${error.message}`;
    }
  }
  
  // Function to handle download
  async function downloadHtml() {
    if (!panelId) {
      status.textContent = 'Error: No preview content found';
      return;
    }
    
    status.textContent = 'Preparing download...';
    downloadBtn.disabled = true;
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'downloadFromSidePanel',
        panelId: panelId
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to download HTML');
      }
      
      status.textContent = 'Download started!';
      setTimeout(() => {
        status.textContent = '';
        downloadBtn.disabled = false;
      }, 3000);
    } catch (error) {
      console.error('Download error:', error);
      status.textContent = `Error: ${error.message}`;
      downloadBtn.disabled = false;
    }
  }
  
  // Function to close the panel
  function closePanel() {
    chrome.runtime.sendMessage({ action: 'closeSidePanel' });
  }
  
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'panelContentReady') {
      // Reload preview content when notified
      loadPreviewContent();
    }
  });
}); 