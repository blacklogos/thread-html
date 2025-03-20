document.addEventListener('DOMContentLoaded', () => {
  const convertButton = document.getElementById('convert');
  const status = document.getElementById('status');
  
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
  
  convertButton.addEventListener('click', async () => {
    try {
      status.textContent = 'Getting active tab...';
      console.log('Getting active tab...');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      console.log('Active tab:', tab);
      
      if (!tab.url.includes('threads.net')) {
        throw new Error('Please navigate to a Threads post');
      }
      
      status.textContent = 'Checking content script...';
      console.log('Checking content script...');
      
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
      
      status.textContent = 'Sending data to background script...';
      console.log('Sending data to background script...');
      
      const downloadResponse = await chrome.runtime.sendMessage({
        action: 'download',
        data: response.data
      });
      
      console.log('Download response:', downloadResponse);
      
      if (!downloadResponse.success) {
        throw new Error(downloadResponse.error || 'Failed to generate HTML file');
      }
      
      status.textContent = 'Conversion complete! Check your downloads folder.';
      console.log('Conversion complete!');
      
    } catch (error) {
      console.error('Error:', error);
      status.textContent = `Error: ${error.message}`;
    }
  });
}); 