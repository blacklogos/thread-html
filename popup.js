document.addEventListener('DOMContentLoaded', () => {
  const previewButton = document.getElementById('preview');
  const convertButton = document.getElementById('convert');
  const status = document.getElementById('status');
  
  // Keep track of current preview panel
  let currentPreviewPanelId = null;
  
  // Function to inject content script
  async function injectContentScript(tabId) {
    try {
      console.log('Injecting content script into tab:', tabId);
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      console.log('Content script injected successfully');
    } catch (error) {
      console.error('Failed to inject content script:', error);
      throw error;
    }
  }
  
  // Function to wait for content script to be ready
  async function waitForContentScript(tabId, maxAttempts = 5) {
    console.log('Waiting for content script to be ready...');
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        console.log('Content script response:', response);
        if (response && response.initialized) {
          console.log('Content script is ready');
          return true;
        }
      } catch (error) {
        console.log(`Attempt ${i + 1} failed:`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Content script not ready after multiple attempts');
  }
  
  // Function to check if we're on a valid Threads page
  async function validateThreadsPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    if (!tab.url.includes('threads.net')) {
      throw new Error('Please navigate to a Threads post');
    }
    
    return tab;
  }
  
  // Function to extract thread data
  async function extractThreadData(tab) {
    status.textContent = 'Checking content script...';
    
    try {
      // Try to ping the content script
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      console.log('Content script already injected');
    } catch (error) {
      console.log('Content script not found, injecting...');
      status.textContent = 'Injecting content script...';
      await injectContentScript(tab.id);
    }
    
    status.textContent = 'Waiting for content script...';
    await waitForContentScript(tab.id);
    
    status.textContent = 'Extracting post content...';
    console.log('Extracting post content...');
    
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });
    console.log('Extraction response:', response);
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to extract post content');
    }
    
    return response.data;
  }
  
  // Function to generate HTML preview in side panel
  async function generatePreview() {
    try {
      previewButton.disabled = true;
      convertButton.disabled = true;
      
      const tab = await validateThreadsPage();
      const threadData = await extractThreadData(tab);
      
      status.textContent = 'Generating preview...';
      
      // Send message to create side panel preview
      const previewResponse = await chrome.runtime.sendMessage({
        action: 'previewInSidePanel',
        tabId: tab.id,
        data: threadData
      });
      
      console.log('Preview response:', previewResponse);
      
      if (!previewResponse.success) {
        throw new Error(previewResponse.error || 'Failed to generate preview');
      }
      
      currentPreviewPanelId = previewResponse.panelId;
      status.textContent = 'Preview opened in side panel';
      
      // Re-enable buttons
      previewButton.disabled = false;
      convertButton.disabled = false;
    } catch (error) {
      console.error('Preview error:', error);
      status.textContent = `Error: ${error.message}`;
      
      // Re-enable buttons
      previewButton.disabled = false;
      convertButton.disabled = false;
    }
  }
  
  // Function to download HTML
  async function downloadHtml() {
    try {
      previewButton.disabled = true;
      convertButton.disabled = true;
      
      // If we have an active preview, download from that
      if (currentPreviewPanelId) {
        status.textContent = 'Downloading from preview...';
        
        const downloadResponse = await chrome.runtime.sendMessage({
          action: 'downloadFromSidePanel',
          panelId: currentPreviewPanelId
        });
        
        console.log('Download response:', downloadResponse);
        
        if (!downloadResponse.success) {
          throw new Error(downloadResponse.error || 'Failed to download from preview');
        }
        
        status.textContent = 'Download complete!';
      } else {
        // No preview, extract and download directly
        const tab = await validateThreadsPage();
        const threadData = await extractThreadData(tab);
        
        status.textContent = 'Generating HTML file...';
        
        const downloadResponse = await chrome.runtime.sendMessage({
          action: 'download',
          data: threadData
        });
        
        console.log('Download response:', downloadResponse);
        
        if (!downloadResponse.success) {
          throw new Error(downloadResponse.error || 'Failed to generate HTML file');
        }
        
        status.textContent = 'Download complete! Check your downloads folder.';
      }
      
      // Re-enable buttons
      previewButton.disabled = false;
      convertButton.disabled = false;
    } catch (error) {
      console.error('Download error:', error);
      status.textContent = `Error: ${error.message}`;
      
      // Re-enable buttons
      previewButton.disabled = false;
      convertButton.disabled = false;
    }
  }
  
  // Add event listeners for buttons
  previewButton.addEventListener('click', generatePreview);
  convertButton.addEventListener('click', downloadHtml);
}); 