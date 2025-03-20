document.addEventListener('DOMContentLoaded', () => {
  const previewContainer = document.getElementById('preview-container');
  const downloadBtn = document.getElementById('download-btn');
  const closeBtn = document.getElementById('close-btn');
  const status = document.getElementById('status');
  
  // Current panel information
  let panelId = null;
  
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
  
  // Add event listeners
  downloadBtn.addEventListener('click', downloadHtml);
  closeBtn.addEventListener('click', closePanel);
  
  // Load content when panel opens
  loadPreviewContent();
  
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'panelContentReady') {
      // Reload preview content when notified
      loadPreviewContent();
    }
  });
}); 