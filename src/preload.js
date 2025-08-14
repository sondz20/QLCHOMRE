const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Profile management
    createChromeProfile: (profileData) => ipcRenderer.invoke('create-chrome-profile', profileData),
    launchChrome: (profileId, proxyConfig, skipValidation) => ipcRenderer.invoke('launch-chrome', profileId, proxyConfig, skipValidation),
    launchChromeSimple: (profileId, proxyConfig, skipValidation) => ipcRenderer.invoke('launch-chrome-simple', profileId, proxyConfig, skipValidation),
    launchChromeWithPAC: (profileId, proxyConfig, skipValidation) => ipcRenderer.invoke('launch-chrome-pac', profileId, proxyConfig, skipValidation),
    launchChromeWithPuppeteer: (profileId, proxyConfig) => ipcRenderer.invoke('launch-chrome-puppeteer', profileId, proxyConfig),
    stopChrome: (instanceId) => ipcRenderer.invoke('stop-chrome', instanceId),
    getProfiles: () => ipcRenderer.invoke('get-profiles'),
    deleteProfile: (profileId) => ipcRenderer.invoke('delete-profile', profileId),
    updateProfile: (profileId, updateData) => ipcRenderer.invoke('update-profile', profileId, updateData),
    updateProfileProxy: (profileId, proxyConfig) => ipcRenderer.invoke('update-profile-proxy', profileId, proxyConfig),
    addBookmarksToProfile: (profileId, bookmarks) => ipcRenderer.invoke('add-bookmarks-to-profile', profileId, bookmarks),
    
    // Tab management
    addTabsToProfile: (profileId, tabs) => ipcRenderer.invoke('add-tabs-to-profile', profileId, tabs),
    deleteTabsFromProfile: (profileId, deleteConfig) => ipcRenderer.invoke('delete-tabs-from-profile', profileId, deleteConfig),
    
    // Card management
    getCards: () => ipcRenderer.invoke('get-cards'),
    addCard: (cardData) => ipcRenderer.invoke('add-card', cardData),
    updateCard: (cardId, cardData) => ipcRenderer.invoke('update-card', cardId, cardData),
    deleteCard: (cardId) => ipcRenderer.invoke('delete-card', cardId),
    
    // Group management
    getGroups: () => ipcRenderer.invoke('get-groups'),
    addGroup: (groupData) => ipcRenderer.invoke('add-group', groupData),
    updateGroup: (groupId, groupData) => ipcRenderer.invoke('update-group', groupId, groupData),
    deleteGroup: (groupId) => ipcRenderer.invoke('delete-group', groupId),
    
    // Proxy management
    getProxies: () => ipcRenderer.invoke('get-proxies'),
    addProxy: (proxyData) => ipcRenderer.invoke('add-proxy', proxyData),
    importProxiesDialog: () => ipcRenderer.invoke('import-proxies-dialog'),
    
    // Proxy status checking
    checkProxyStatus: (proxyData) => ipcRenderer.invoke('check-proxy-status', proxyData),
    checkMultipleProxies: (proxyList) => ipcRenderer.invoke('check-multiple-proxies', proxyList),
    updateProxyStatus: (proxyId, statusData) => ipcRenderer.invoke('update-proxy-status', proxyId, statusData),
    testProxy: (proxyData) => ipcRenderer.invoke('test-proxy', proxyData),
    
    // Extension management
    getExtensions: () => ipcRenderer.invoke('get-extensions'),
    addExtension: (extensionData) => ipcRenderer.invoke('add-extension', extensionData),
    updateExtension: (extensionId, extensionData) => ipcRenderer.invoke('update-extension', extensionId, extensionData),
    deleteExtension: (extensionId) => ipcRenderer.invoke('delete-extension', extensionId),
    installExtension: (extensionId, profileId) => ipcRenderer.invoke('install-extension', extensionId, profileId),
    loadExtensionFromManifest: (manifestPath) => ipcRenderer.invoke('load-extension-from-manifest', manifestPath),
    browseExtensionFolder: () => ipcRenderer.invoke('browse-extension-folder'),
    autoInstallExtensionsToAll: () => ipcRenderer.invoke('auto-install-extensions-to-all'),
    autoInstallExtensionToProfile: (profileId) => ipcRenderer.invoke('auto-install-extension-to-profile', profileId),
    
    // Menu events
    onMenuCreateProfile: (callback) => ipcRenderer.on('menu-create-profile', callback),
    onMenuManageExtensions: (callback) => ipcRenderer.on('menu-manage-extensions', callback),
    onMenuCheckProxies: (callback) => ipcRenderer.on('menu-check-proxies', callback),
    
    // Proxy validation events
    onProxyValidationStatus: (callback) => ipcRenderer.on('proxy-validation-status', callback),
    removeProxyValidationListener: () => ipcRenderer.removeAllListeners('proxy-validation-status'),
    
    // Proxy setup events
    onProxySetupStatus: (callback) => ipcRenderer.on('proxy-setup-status', callback),
    removeProxySetupListener: () => ipcRenderer.removeAllListeners('proxy-setup-status'),
    
    // Chrome instance monitoring
    getChromeInstances: () => ipcRenderer.invoke('get-chrome-instances'),
    refreshChromeStatus: () => ipcRenderer.invoke('refresh-chrome-status'),
    
    // Workflow management
    saveWorkflow: (workflowData) => ipcRenderer.invoke('save-workflow', workflowData),
    getSavedWorkflows: () => ipcRenderer.invoke('get-saved-workflows'),
    loadWorkflow: (workflowId) => ipcRenderer.invoke('load-workflow', workflowId),
    deleteWorkflow: (workflowId) => ipcRenderer.invoke('delete-workflow', workflowId),
    runWorkflow: (workflowData) => ipcRenderer.invoke('run-workflow', workflowData)
});
