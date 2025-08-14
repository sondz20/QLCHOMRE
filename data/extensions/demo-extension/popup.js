document.addEventListener('DOMContentLoaded', function() {
    const testBtn = document.getElementById('testBtn');
    
    testBtn.addEventListener('click', function() {
        // Query active tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            // Send message to content script
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'showAlert',
                message: 'Hello from Demo Extension!'
            });
        });
    });
    
    // Update popup content
    document.body.style.background = '#f0f8ff';
    console.log('Demo Extension popup loaded!');
});
