// Content script for Demo Extension
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'showAlert') {
        alert(request.message);
        sendResponse({status: 'success'});
    }
});

// Add a floating notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Show notification when extension loads
showNotification('Demo Extension loaded successfully!');
