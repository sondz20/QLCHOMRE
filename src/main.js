// Chrome Manager - Clean Version (No AI)
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const AutoUpdater = require('../auto-updater');

class ChromeManager {
  constructor() {
    this.mainWindow = null;
    this.profiles = [];
    this.proxies = [];
    this.cards = [];
    this.groups = [];
    this.extensions = [];
    this.chromeInstances = new Map();
    this.dataDir = path.join(__dirname, '..', 'data');
    this.profilesDir = path.join(this.dataDir, 'profiles');
    this.autoUpdater = new AutoUpdater();
    
    this.ensureDirectories();
    this.loadData();
    this.setupIPC();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  setupIPC() {
    // Basic IPC handlers
    ipcMain.handle('get-profiles', () => this.getProfiles());
    ipcMain.handle('add-proxy', (event, proxyData) => this.addProxy(proxyData));
    ipcMain.handle('get-proxies', () => this.getProxies());
    
    // Chrome launch methods
    ipcMain.handle('launch-chrome', async (event, profileId, proxyConfig, skipValidation) => {
      return await this.launchChromeWithPuppeteer(profileId, proxyConfig);
    });
    
    ipcMain.handle('launch-chrome-simple', async (event, profileId, proxyConfig, skipValidation) => {
      return await this.launchChromeWithPuppeteer(profileId, proxyConfig);
    });
    
    ipcMain.handle('launch-chrome-pac', async (event, profileId, proxyConfig, skipValidation) => {
      return await this.launchChromeWithPuppeteer(profileId, proxyConfig);
    });
    
    ipcMain.handle('launch-chrome-puppeteer', async (event, profileId, proxyConfig) => {
      return await this.launchChromeWithPuppeteer(profileId, proxyConfig);
    });
    
    ipcMain.handle('stop-chrome', async (event, instanceId) => {
      return await this.stopChrome(instanceId);
    });
    
    ipcMain.handle('create-chrome-profile', async (event, profileData) => {
      return await this.createProfile(profileData);
    });
    
    ipcMain.handle('update-profile', async (event, profileId, profileData) => {
      return await this.updateProfile(profileId, profileData);
    });
    
    ipcMain.handle('update-profile-proxy', async (event, profileId, proxyConfig) => {
      return await this.updateProfileProxy(profileId, proxyConfig);
    });
    
    ipcMain.handle('add-bookmarks-to-profile', async (event, profileId, bookmarks) => {
      return await this.addBookmarksToProfile(profileId, bookmarks);
    });
    
    ipcMain.handle('add-tabs-to-profile', async (event, profileId, tabs) => {
      return await this.addTabsToProfile(profileId, tabs);
    });
    
    ipcMain.handle('delete-tabs-from-profile', async (event, profileId, deleteConfig) => {
      return await this.deleteTabsFromProfile(profileId, deleteConfig);
    });
    
    ipcMain.handle('delete-profile', async (event, profileId) => {
      return await this.deleteProfile(profileId);
    });
    
    // Proxy checking
    ipcMain.handle('check-proxy-status', async (event, proxyData) => {
      return await this.checkProxyStatus(proxyData);
    });
    
    ipcMain.handle('check-multiple-proxies', async (event, proxyList) => {
      return await this.checkMultipleProxies(proxyList);
    });
    
    ipcMain.handle('update-proxy-status', async (event, proxyId, statusData) => {
      return await this.updateProxyStatus(proxyId, statusData);
    });

    ipcMain.handle('test-proxy', async (event, proxyData) => {
      return await this.testProxy(proxyData);
    });

    // Chrome instance monitoring
    ipcMain.handle('get-chrome-instances', () => {
      return this.getActiveInstances();
    });

    ipcMain.handle('refresh-chrome-status', () => {
      const instances = this.getActiveInstances();
      console.log(`🔄 Refreshed status for ${instances.length} Chrome instances`);
      return instances;
    });

    // Card management
    ipcMain.handle('get-cards', () => this.getCards());
    ipcMain.handle('add-card', async (event, cardData) => this.addCard(cardData));
    ipcMain.handle('update-card', async (event, cardId, cardData) => this.updateCard(cardId, cardData));
    ipcMain.handle('delete-card', async (event, cardId) => this.deleteCard(cardId));

    // Group management
    ipcMain.handle('get-groups', () => this.getGroups());
    ipcMain.handle('add-group', async (event, groupData) => this.addGroup(groupData));
    ipcMain.handle('update-group', async (event, groupId, groupData) => this.updateGroup(groupId, groupData));
    ipcMain.handle('delete-group', async (event, groupId) => this.deleteGroup(groupId));

    // Extension management
    ipcMain.handle('get-extensions', () => this.getExtensions());
    ipcMain.handle('add-extension', async (event, extensionData) => this.addExtension(extensionData));
    ipcMain.handle('update-extension', async (event, extensionId, extensionData) => this.updateExtension(extensionId, extensionData));
    ipcMain.handle('delete-extension', async (event, extensionId) => this.deleteExtension(extensionId));
    ipcMain.handle('install-extension', async (event, extensionId, profileId) => this.installExtensionToProfile(extensionId, profileId));
    ipcMain.handle('load-extension-from-manifest', async (event, manifestPath) => this.loadExtensionFromManifest(manifestPath));
    ipcMain.handle('browse-extension-folder', async (event) => this.browseExtensionFolder());
    ipcMain.handle('auto-install-extensions-to-all', async (event) => this.autoInstallExtensionsToAllProfiles());
    ipcMain.handle('auto-install-extension-to-profile', async (event, profileId) => this.autoInstallExtensionsToProfile(profileId));
    
    // Workflow management
    ipcMain.handle('save-workflow', async (event, workflowData) => this.saveWorkflow(workflowData));
    ipcMain.handle('get-saved-workflows', () => this.getSavedWorkflows());
    ipcMain.handle('load-workflow', async (event, workflowId) => this.loadWorkflow(workflowId));
    ipcMain.handle('delete-workflow', async (event, workflowId) => this.deleteWorkflow(workflowId));
    ipcMain.handle('run-workflow', async (event, workflowData) => this.runWorkflow(workflowData));
    
    // Auto-updater management
    ipcMain.handle('check-for-updates', () => this.autoUpdater.manualCheckForUpdates());
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      resizable: true,
      maximizable: true,
      minimizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, 'assets', 'icon.png'),
      show: false,
      frame: true,
      titleBarStyle: 'default'
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      this.mainWindow.maximize(); // Tự động maximize khi mở
      console.log('Chrome Manager window loaded successfully');
      
      // Khởi động auto-updater sau khi window sẵn sàng
      this.autoUpdater.start();
    });
    
    // Dev tools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  // Profile Management
  async createProfile(profileData) {
    try {
      const profileId = `chrome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const profilePath = path.join(this.profilesDir, profileId);
      
      // Create profile directory
      if (!fs.existsSync(profilePath)) {
        fs.mkdirSync(profilePath, { recursive: true });
      }
      
      const profile = {
        id: profileId,
        name: profileData.name,
        cardId: profileData.cardId || '',
        groupId: profileData.groupId || undefined,
        proxy: profileData.proxy || null,
        template: profileData.template || null,
        settings: profileData.settings || {},
        notes: profileData.notes || '',
        created: new Date().toISOString(),
        path: profilePath,
        extensions: [] // Khởi tạo array extensions cho profile mới
      };
      
      this.profiles.push(profile);
      this.saveProfiles();
      
      // Tự động cài tất cả extension vào profile mới
      await this.autoInstallExtensionsToProfile(profile.id);
      
      return { success: true, profile };
    } catch (error) {
      console.error('Error creating profile:', error);
      return { success: false, error: error.message };
    }
  }

  async updateProfile(profileId, profileData) {
    try {
      const profileIndex = this.profiles.findIndex(p => p.id === profileId);
      if (profileIndex === -1) {
        return { success: false, error: 'Profile not found' };
      }

      // Update profile data
      const updatedProfile = {
        ...this.profiles[profileIndex]
      };

      // Only update provided fields
      if (profileData.hasOwnProperty('name')) {
        updatedProfile.name = profileData.name;
      }
      if (profileData.hasOwnProperty('cardId')) {
        updatedProfile.cardId = profileData.cardId === null ? '' : profileData.cardId;
      }
      if (profileData.hasOwnProperty('groupId')) {
        updatedProfile.groupId = profileData.groupId === null ? undefined : profileData.groupId;
      }
      if (profileData.hasOwnProperty('proxy')) {
        updatedProfile.proxy = profileData.proxy;
      }
      if (profileData.hasOwnProperty('notes')) {
        updatedProfile.notes = profileData.notes;
      }
      
      updatedProfile.updated = new Date().toISOString();

      this.profiles[profileIndex] = updatedProfile;
      this.saveProfiles();

      return { success: true, profile: updatedProfile };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  }

  async updateProfileProxy(profileId, proxyConfig) {
    try {
      console.log(`Updating proxy for profile ${profileId}:`, proxyConfig);
      
      const profileIndex = this.profiles.findIndex(p => p.id === profileId);
      if (profileIndex === -1) {
        return { success: false, error: 'Profile not found' };
      }

      // Update proxy configuration
      this.profiles[profileIndex].proxy = proxyConfig;
      this.profiles[profileIndex].updated = new Date().toISOString();
      
      this.saveProfiles();

      if (proxyConfig) {
        console.log(`✅ Updated proxy for profile ${profileId}: ${proxyConfig.host}:${proxyConfig.port}`);
      } else {
        console.log(`✅ Updated proxy for profile ${profileId}: removed`);
      }

      return { success: true, profile: this.profiles[profileIndex] };
    } catch (error) {
      console.error('Error updating profile proxy:', error);
      return { success: false, error: error.message };
    }
  }

  async addBookmarksToProfile(profileId, bookmarks) {
    try {
      console.log(`Adding ${bookmarks.length} bookmarks to profile ${profileId}`);
      
      // CRITICAL: Close Chrome first if it's running to ensure bookmarks are properly loaded
      const chromeInfo = this.activeChromes && this.activeChromes.get ? this.activeChromes.get(profileId) : null;
      if (chromeInfo && chromeInfo.browser) {
        console.log(`🔄 Closing Chrome ${profileId} to update bookmarks safely...`);
        try {
          await chromeInfo.browser.close();
          this.activeChromes.delete(profileId);
          
          // Update profile status in UI
          const profile = this.profiles.find(p => p.id === profileId);
          if (profile) {
            profile.status = 'đã đóng';
          }
          
          // Wait for Chrome to fully close and release file locks
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log(`✅ Chrome ${profileId} closed successfully`);
        } catch (closeError) {
          console.log(`⚠️ Could not close Chrome: ${closeError.message}`);
        }
      }
      
      const profileIndex = this.profiles.findIndex(p => p.id === profileId);
      if (profileIndex === -1) {
        return { success: false, error: 'Profile not found' };
      }

      const profile = this.profiles[profileIndex];
      const profilePath = path.join(this.profilesDir, profileId);

      // Create bookmarks file path in Default folder (correct Chrome structure)
      const defaultPath = path.join(profilePath, 'Default');
      const bookmarksPath = path.join(defaultPath, 'Bookmarks');
      
      // Default Chrome bookmarks structure
      const defaultBookmarks = {
        "checksum": "",
        "roots": {
          "bookmark_bar": {
            "children": [],
            "date_added": Date.now().toString(),
            "date_modified": "0",
            "guid": "bookmark_bar_guid",
            "id": "1",
            "name": "Bookmarks bar",
            "type": "folder"
          },
          "other": {
            "children": [],
            "date_added": Date.now().toString(),
            "date_modified": "0",
            "guid": "other_bookmarks_guid",
            "id": "2",
            "name": "Other bookmarks",
            "type": "folder"
          },
          "synced": {
            "children": [],
            "date_added": Date.now().toString(),
            "date_modified": "0",
            "guid": "synced_bookmarks_guid",
            "id": "3",
            "name": "Mobile bookmarks",
            "type": "folder"
          }
        },
        "version": 1
      };

      // Try to read existing bookmarks, or use default structure
      let bookmarksData;
      try {
        if (fs.existsSync(bookmarksPath)) {
          const existingData = fs.readFileSync(bookmarksPath, 'utf8');
          bookmarksData = JSON.parse(existingData);
        } else {
          bookmarksData = defaultBookmarks;
        }
      } catch (error) {
        console.log('Could not read existing bookmarks, using default structure');
        bookmarksData = defaultBookmarks;
      }

      // Add new bookmarks to bookmark bar
      const newBookmarkItems = bookmarks.map((bookmark, index) => ({
        "date_added": Date.now().toString(),
        "guid": `bookmark_${Date.now()}_${index}`,
        "id": (1000 + index).toString(),
        "name": bookmark.name,
        "type": "url",
        "url": bookmark.url
      }));

      // Add to bookmark bar
      bookmarksData.roots.bookmark_bar.children.push(...newBookmarkItems);
      bookmarksData.roots.bookmark_bar.date_modified = Date.now().toString();

      // Ensure Default directory exists first
      if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true });
      }

      // Write bookmarks file to Default folder
      fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarksData, null, 2));

      // Also configure preferences to show bookmark bar
      const defaultPreferencesPath = path.join(profilePath, 'Default');
      const preferencesPath = path.join(defaultPreferencesPath, 'Preferences');
      
      try {
        // Ensure Default folder exists
        if (!fs.existsSync(defaultPreferencesPath)) {
          fs.mkdirSync(defaultPreferencesPath, { recursive: true });
        }

        let preferences = {};
        if (fs.existsSync(preferencesPath)) {
          const prefData = fs.readFileSync(preferencesPath, 'utf8');
          preferences = JSON.parse(prefData);
        }

        // Enable bookmark bar
        if (!preferences.bookmark_bar) {
          preferences.bookmark_bar = {};
        }
        preferences.bookmark_bar.show_on_all_tabs = true;

        // Write preferences
        fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
        console.log(`📑 Enabled bookmark bar for profile ${profileId}`);
      } catch (prefError) {
        console.log(`⚠️ Could not update preferences: ${prefError.message}`);
      }

      console.log(`✅ Added ${bookmarks.length} bookmarks to profile ${profileId}`);
      
      // Force Chrome to reload bookmarks by injecting script
      const self = this;
      setTimeout(async () => {
        console.log(`🔄 Attempting to reload bookmarks for ${profileId}...`);
        try {
          const chromeInfo = self.activeChromes && self.activeChromes.get ? self.activeChromes.get(profileId) : null;
          if (chromeInfo && chromeInfo.browser) {
            const pages = await chromeInfo.browser.pages();
            if (pages.length > 0) {
              // Inject script to force reload bookmarks
              await pages[0].evaluate(() => {
                console.log('🔄 Force reloading to show bookmarks...');
                // Method 1: Hard reload
                window.location.reload(true);
              });
              console.log(`✅ Successfully reloaded ${profileId} to show new bookmarks`);
            } else {
              console.log(`⚠️ No pages found in ${profileId} to reload`);
            }
          } else {
            console.log(`⚠️ Chrome ${profileId} not found in active instances`);
          }
        } catch (error) {
          console.log('Could not inject reload script:', error.message);
        }
      }, 2000);
      
      return { success: true, bookmarksAdded: bookmarks.length };
    } catch (error) {
      console.error('Error adding bookmarks to profile:', error);
      return { success: false, error: error.message };
    }
  }

  async addTabsToProfile(profileId, tabs) {
    try {
      console.log(`Adding ${tabs.length} tabs to profile ${profileId}`);
      
      const profileIndex = this.profiles.findIndex(p => p.id === profileId);
      if (profileIndex === -1) {
        return { success: false, error: 'Profile not found' };
      }

      const profile = this.profiles[profileIndex];
      const profilePath = path.join(this.profilesDir, profileId);
      
      // Sessions file path
      const defaultPath = path.join(profilePath, 'Default');
      const sessionsPath = path.join(defaultPath, 'Sessions');
      const currentTabsPath = path.join(defaultPath, 'Current Tabs');
      const currentSessionPath = path.join(defaultPath, 'Current Session');

      // Ensure Default directory exists
      if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true });
      }

      // Read existing sessions if available
      let existingTabs = [];
      try {
        if (fs.existsSync(currentTabsPath)) {
          const currentTabsData = fs.readFileSync(currentTabsPath, 'utf8');
          // Parse existing tabs (simplified format)
          existingTabs = JSON.parse(currentTabsData).tabs || [];
        }
      } catch (error) {
        console.log('Could not read existing tabs, starting fresh');
      }

      // Add new tabs to existing ones
      tabs.forEach(tab => {
        existingTabs.push({
          url: tab.url,
          title: tab.url,
          timestamp: Date.now()
        });
      });

      // Write updated tabs
      const tabsData = {
        version: 1,
        tabs: existingTabs
      };

      fs.writeFileSync(currentTabsPath, JSON.stringify(tabsData, null, 2));

      // Also update session files for Chrome to restore tabs
      const sessionData = {
        version: 1,
        tabs: existingTabs.map((tab, index) => ({
          tab_id: index + 1,
          window_id: 1,
          tab_index: index,
          url: tab.url,
          title: tab.title || tab.url,
          pinned: false,
          last_active_time: Date.now()
        }))
      };

      fs.writeFileSync(currentSessionPath, JSON.stringify(sessionData, null, 2));

      console.log(`✅ Added ${tabs.length} tabs to profile ${profileId}`);
      
      return { success: true, tabsAdded: tabs.length };
    } catch (error) {
      console.error('Error adding tabs to profile:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteTabsFromProfile(profileId, deleteConfig) {
    try {
      console.log(`Deleting tabs from profile ${profileId} with config:`, deleteConfig);
      
      const profileIndex = this.profiles.findIndex(p => p.id === profileId);
      if (profileIndex === -1) {
        return { success: false, error: 'Profile not found' };
      }

      // First, try to delete from running Chrome instance
      const chromeInfo = this.activeChromes && this.activeChromes.get ? this.activeChromes.get(profileId) : null;
      if (chromeInfo && chromeInfo.browser) {
        try {
          const pages = await chromeInfo.browser.pages();
          let deletedCount = 0;

          if (deleteConfig.mode === 'all') {
            // Close all tabs except the first one (Chrome needs at least one tab)
            for (let i = 1; i < pages.length; i++) {
              await pages[i].close();
              deletedCount++;
            }
            // Navigate first tab to blank page
            if (pages.length > 0) {
              await pages[0].goto('about:blank');
            }
          } else if (deleteConfig.mode === 'content') {
            // Close tabs containing specific content
            for (const page of pages) {
              try {
                const url = page.url();
                if (url.includes(deleteConfig.content)) {
                  await page.close();
                  deletedCount++;
                }
              } catch (err) {
                console.log('Could not check/close page:', err.message);
              }
            }
          } else if (deleteConfig.mode === 'pattern') {
            // Close tabs matching pattern (simplified pattern matching)
            const pattern = deleteConfig.pattern.replace(/\*/g, '.*');
            const regex = new RegExp(pattern);
            
            for (const page of pages) {
              try {
                const url = page.url();
                if (regex.test(url)) {
                  await page.close();
                  deletedCount++;
                }
              } catch (err) {
                console.log('Could not check/close page:', err.message);
              }
            }
          }

          console.log(`✅ Deleted ${deletedCount} tabs from running Chrome ${profileId}`);
          return { success: true, tabsDeleted: deletedCount };
        } catch (error) {
          console.log('Could not delete from running Chrome, will try session files:', error.message);
        }
      }

      // If Chrome is not running, try to modify session files
      const profile = this.profiles[profileIndex];
      const profilePath = path.join(this.profilesDir, profileId);
      const defaultPath = path.join(profilePath, 'Default');
      const currentTabsPath = path.join(defaultPath, 'Current Tabs');
      const currentSessionPath = path.join(defaultPath, 'Current Session');

      let deletedCount = 0;

      try {
        if (fs.existsSync(currentTabsPath)) {
          const currentTabsData = fs.readFileSync(currentTabsPath, 'utf8');
          const tabsData = JSON.parse(currentTabsData);
          const originalLength = tabsData.tabs ? tabsData.tabs.length : 0;

          if (deleteConfig.mode === 'all') {
            tabsData.tabs = [{ url: 'about:blank', title: 'New Tab', timestamp: Date.now() }];
            deletedCount = originalLength - 1;
          } else if (deleteConfig.mode === 'content') {
            tabsData.tabs = tabsData.tabs.filter(tab => !tab.url.includes(deleteConfig.content));
            deletedCount = originalLength - tabsData.tabs.length;
          } else if (deleteConfig.mode === 'pattern') {
            const pattern = deleteConfig.pattern.replace(/\*/g, '.*');
            const regex = new RegExp(pattern);
            tabsData.tabs = tabsData.tabs.filter(tab => !regex.test(tab.url));
            deletedCount = originalLength - tabsData.tabs.length;
          }

          // Ensure at least one tab remains
          if (tabsData.tabs.length === 0) {
            tabsData.tabs = [{ url: 'about:blank', title: 'New Tab', timestamp: Date.now() }];
          }

          fs.writeFileSync(currentTabsPath, JSON.stringify(tabsData, null, 2));

          // Update session file too
          const sessionData = {
            version: 1,
            tabs: tabsData.tabs.map((tab, index) => ({
              tab_id: index + 1,
              window_id: 1,
              tab_index: index,
              url: tab.url,
              title: tab.title || tab.url,
              pinned: false,
              last_active_time: Date.now()
            }))
          };

          fs.writeFileSync(currentSessionPath, JSON.stringify(sessionData, null, 2));
        }
      } catch (error) {
        console.log('Could not modify session files:', error.message);
      }

      console.log(`✅ Deleted ${deletedCount} tabs from profile ${profileId} session files`);
      
      return { success: true, tabsDeleted: deletedCount };
    } catch (error) {
      console.error('Error deleting tabs from profile:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteProfile(profileId) {
    try {
      const profileIndex = this.profiles.findIndex(p => p.id === profileId);
      if (profileIndex === -1) {
        return { success: false, error: 'Profile not found' };
      }

      const profile = this.profiles[profileIndex];
      const profilePath = path.join(this.profilesDir, profileId);

      // Stop Chrome if running
      for (const [instanceId, instance] of this.chromeInstances) {
        if (instance.profileId === profileId) {
          await this.stopChrome(instanceId);
        }
      }

      // Delete profile directory
      if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath, { recursive: true, force: true });
      }

      // Remove from profiles array
      this.profiles.splice(profileIndex, 1);
      this.saveProfiles();

      return { 
        success: true, 
        message: `Profile "${profile.name}" và tất cả dữ liệu Chrome đã được xóa hoàn toàn` 
      };
    } catch (error) {
      console.error('Error deleting profile:', error);
      return { success: false, error: error.message };
    }
  }

  // Tính toán kích thước và vị trí Chrome tối ưu dựa trên màn hình
  calculateOptimalChromeSize() {
    const { screen } = require('electron');
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    // Phân loại kích thước màn hình để tối ưu phù hợp
    let sizeCategory;
    if (screenWidth >= 2560) sizeCategory = 'ultra-wide'; // 4K, Ultra-wide
    else if (screenWidth >= 1920) sizeCategory = 'large';   // Full HD+
    else if (screenWidth >= 1366) sizeCategory = 'medium';  // HD+
    else sizeCategory = 'small';                            // HD và nhỏ hơn
    
    let width, height;
    
    switch (sizeCategory) {
      case 'ultra-wide':
        width = Math.min(1600, screenWidth * 0.7);
        height = Math.min(1000, screenHeight * 0.8);
        break;
      case 'large':
        width = Math.min(1400, screenWidth * 0.75);
        height = Math.min(900, screenHeight * 0.8);
        break;
      case 'medium':
        width = Math.min(1200, screenWidth * 0.8);
        height = Math.min(800, screenHeight * 0.8);
        break;
      case 'small':
        width = Math.min(1000, screenWidth * 0.85);
        height = Math.min(700, screenHeight * 0.85);
        break;
    }
    
    // Đảm bảo kích thước tối thiểu
    width = Math.max(width, 900);
    height = Math.max(height, 600);
    
    // Sắp xếp vị trí thông minh cho nhiều cửa sổ
    const windowCount = this.chromeInstances.size;
    let x, y;
    
    if (displays.length > 1 && windowCount > 0) {
      // Nhiều màn hình - phân bố qua các màn hình
      const targetDisplay = displays[windowCount % displays.length];
      const displayBounds = targetDisplay.workArea;
      
      x = displayBounds.x + Math.floor((displayBounds.width - width) / 2);
      y = displayBounds.y + Math.floor((displayBounds.height - height) / 2);
    } else {
      // Một màn hình - sắp xếp cascade
      if (windowCount === 0) {
        // Cửa sổ đầu tiên - trung tâm
        x = Math.floor((screenWidth - width) / 2);
        y = Math.floor((screenHeight - height) / 2);
      } else {
        // Cửa sổ tiếp theo - cascade với offset thông minh
        const offsetStep = Math.min(50, screenWidth / 30);
        const offset = (windowCount % 8) * offsetStep; // Reset sau 8 cửa sổ
        
        x = Math.floor((screenWidth - width) / 2) + offset;
        y = Math.floor((screenHeight - height) / 2) + offset;
        
        // Giữ trong màn hình
        if (x + width > screenWidth) x = screenWidth - width - 20;
        if (y + height > screenHeight) y = screenHeight - height - 50;
      }
    }
    
    console.log(`📏 Screen: ${screenWidth}x${screenHeight} (${sizeCategory}), Chrome: ${width}x${height} at (${x}, ${y})`);
    console.log(`🖥️ Displays: ${displays.length}, Current window: ${windowCount + 1}`);
    
    return { width, height, x, y, screenWidth, screenHeight, sizeCategory };
  }

  async handleAboutBlankTab(browser) {
    try {
      // Wait and check multiple times for session restore to complete
      let attempt = 0;
      const maxAttempts = 5;
      const waitTime = 1000; // 1 second each attempt
      
      while (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        const pages = await browser.pages();
        console.log(`🔍 Attempt ${attempt + 1}: Found ${pages.length} tab(s)`);
        
        if (pages.length === 0) {
          console.log('⚠️ No pages found, waiting for browser to initialize...');
          attempt++;
          continue;
        }
        
        // Count non-about:blank tabs
        let nonBlankTabs = 0;
        let aboutBlankTabs = [];
        
        for (let i = 0; i < pages.length; i++) {
          try {
            const pageUrl = await pages[i].url();
            console.log(`📝 Tab ${i + 1} URL: ${pageUrl}`);
            
            if (pageUrl === 'about:blank') {
              aboutBlankTabs.push(pages[i]);
            } else {
              nonBlankTabs++;
            }
          } catch (error) {
            console.log(`⚠️ Could not get URL of tab ${i + 1}, waiting...`);
            attempt++;
            continue;
          }
        }
        
        console.log(`� Found ${nonBlankTabs} non-blank tabs and ${aboutBlankTabs.length} about:blank tabs`);
        
        // Nếu có tabs khác (không phải about:blank), đóng tất cả about:blank tabs
        if (nonBlankTabs > 0 && aboutBlankTabs.length > 0) {
          console.log('🗑️ Closing about:blank tabs (other tabs restored)');
          
          for (const blankTab of aboutBlankTabs) {
            try {
              await blankTab.close();
              console.log('✅ Closed an about:blank tab');
            } catch (error) {
              console.log(`⚠️ Failed to close about:blank tab: ${error.message}`);
            }
          }
          return; // Success, exit
        }
        
        // Nếu chỉ có about:blank tabs và đây là attempt cuối
        if (nonBlankTabs === 0 && aboutBlankTabs.length > 0 && attempt >= 3) {
          console.log('📄 Keeping about:blank tab (no other tabs to restore)');
          return; // No other tabs, keep about:blank
        }
        
        // Nếu không có about:blank tabs, session restored successfully  
        if (aboutBlankTabs.length === 0) {
          console.log('✅ Session restored successfully, no about:blank to handle');
          return;
        }
        
        attempt++;
      }
      
      console.log('⏰ Timeout waiting for session restore, keeping current state');
      
    } catch (error) {
      console.error('❌ Error handling about:blank tab:', error.message);
    }
  }

  async checkForExistingSessionFile(profilePath) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Check for session files that indicate previous browsing session
      const sessionFiles = [
        path.join(profilePath, 'Default', 'Current Session'),
        path.join(profilePath, 'Default', 'Last Session'),
        path.join(profilePath, 'Default', 'Current Tabs'),
        path.join(profilePath, 'Default', 'Last Tabs'),
        path.join(profilePath, 'Default', 'Sessions', 'Session_13313'),
        path.join(profilePath, 'Default', 'Sessions', 'Tabs_13313'),
        path.join(profilePath, 'Default', 'Preferences'),
        path.join(profilePath, 'Default', 'History')
      ];
      
      console.log(`🔍 Checking session files in: ${profilePath}`);
      
      for (const sessionFile of sessionFiles) {
        try {
          const stats = await fs.stat(sessionFile);
          if (stats.size > 0) {
            console.log(`📁 Found session file: ${path.basename(sessionFile)} (${stats.size} bytes)`);
            return true;
          }
        } catch {
          // File doesn't exist, continue checking
          continue;
        }
      }
      
      // Additional check - look for any files in Sessions folder
      try {
        const sessionsDir = path.join(profilePath, 'Default', 'Sessions');
        const files = await fs.readdir(sessionsDir);
        if (files.length > 0) {
          console.log(`📁 Found ${files.length} files in Sessions folder`);
          return true;
        }
      } catch {
        // Sessions folder doesn't exist
      }
      
      console.log('📭 No session files found - treating as fresh profile');
      return false;
      
    } catch (error) {
      console.log('⚠️ Error checking session files:', error.message);
      return false; // Default to false - treat as fresh profile
    }
  }

  async launchChromeWithPuppeteer(profileId, proxyConfig) {
    try {
      const profile = this.profiles.find(p => p.id === profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      const profilePath = path.join(this.profilesDir, profileId);
      const instanceId = `${profileId}_${Date.now()}`;

      console.log(`🎭 Launching Chrome với Profile: ${profile.name}`);

      // Check if profile has existing session before launching
      const hasExistingSession = await this.checkForExistingSessionFile(profilePath);
      console.log(`📋 Profile has existing session: ${hasExistingSession}`);

      // Tính toán kích thước và vị trí tối ưu cho màn hình hiện tại
      const { width, height, x, y } = this.calculateOptimalChromeSize();

      // Prepare extension paths
      const extensionPaths = this.getExtensionPathsForProfile(profile);

      const chromeArgs = [
        `--user-data-dir=${profilePath}`,
        '--no-first-run',
        '--restore-last-session',             // Mặc định bật "Continue where you left off"
        '--show-bookmarks-bar',               // Hiển thị bookmark bar
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-default-apps',             // Không mở app mặc định
        '--disable-background-mode',          // Tắt chế độ nền
        '--aggressive-cache-discard',         // Load tabs ngay lập tức
        '--max-unused-resource-memory-usage-percentage=5', // Giảm memory usage để load nhanh hơn
        '--disable-backgrounding-occluded-windows', // Không để tabs nền bị chậm
        '--disable-renderer-backgrounding',   // Tắt background throttling
        '--disable-background-timer-throttling', // Load tất cả tabs ngay
        '--disable-features=TranslateUI,TabFreeze', // Tắt translate và freeze tabs
        `--window-size=${width},${height}`,   // Kích thước tự động theo màn hình
        `--window-position=${x},${y}`,        // Vị trí thông minh không chồng lấp
        '--force-device-scale-factor=1',      // Đảm bảo scaling nhất quán
        '--high-dpi-support=1',               // Hỗ trợ màn hình 4K/Retina
        '--enable-use-zoom-for-dsf=false',    // Tắt auto-zoom để có kích thước chính xác
        // Extension auto-accept và pin to toolbar flags
        '--disable-extensions-file-access-check',
        '--disable-extensions-http-throttling', 
        '--extensions-on-chrome-urls',
        '--enable-extension-activity-logging',
        '--allow-running-insecure-content',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--enable-automation',
        // Additional flags để force pin extensions và auto-accept
        '--force-app-mode',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=TranslateUI',
        '--disable-features=Translate',
        // FORCE PIN EXTENSIONS FLAGS
        '--disable-extensions-file-access-check',
        '--enable-extensions-api',
        '--extensions-install-verification=ignore',
        '--enable-experimental-extension-apis',
        '--allow-extension-manifest-v3',
        '--disable-extensions-ui-policy',
        // Auto-accept extension permissions 
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--silent-debugger-extension-api',
        // Auto-pin script injection
        '--enable-logging',
        '--log-level=0',
        '--disable-extensions-except=' + (extensionPaths.length > 0 ? extensionPaths.join(',') : ''),
        '--whitelisted-extension-id=*'
      ];

      // If no existing session, prevent opening about:blank by using a minimal app mode
      if (!hasExistingSession) {
        chromeArgs.push('--new-window');
        chromeArgs.push('--no-default-browser-check');
        console.log('🚫 No existing session - will open minimal window');
      }

      // Add extension arguments if extensions are available
      if (extensionPaths.length > 0) {
        chromeArgs.push('--disable-extensions-except=' + extensionPaths.join(','));
        chromeArgs.push('--load-extension=' + extensionPaths.join(','));
        console.log(`🧩 Loading ${extensionPaths.length} extensions: ${extensionPaths.join(', ')}`);
      }

      let browser;
      if (proxyConfig && proxyConfig.host && proxyConfig.port) {
        console.log(`🔐 Launching with proxy: ${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`);
        
        // Validate proxy type
        const validTypes = ['http', 'https', 'socks4', 'socks5'];
        const proxyType = proxyConfig.type ? proxyConfig.type.toLowerCase() : 'http';
        
        if (!validTypes.includes(proxyType)) {
          console.warn(`⚠️ Invalid proxy type: ${proxyConfig.type}, defaulting to http`);
          proxyConfig.type = 'http';
        }
        
        // Launch with proxy
        browser = await puppeteer.launch({
          headless: false,
          userDataDir: profilePath,
          defaultViewport: null,
          ignoreDefaultArgs: ['--enable-automation'],
          args: [
            ...chromeArgs,
            `--proxy-server=${proxyType}://${proxyConfig.host}:${proxyConfig.port}`
          ]
        });

        console.log('✅ Puppeteer browser launched with proxy');

        // Setup proxy authentication handler for all pages
        if (proxyConfig.username && proxyConfig.password) {
          console.log('🔐 Setting up proxy authentication...');
          
          // Set up authentication for current and future pages
          browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
              const page = await target.page();
              if (page) {
                try {
                  await page.authenticate({
                    username: proxyConfig.username,
                    password: proxyConfig.password
                  });
                  console.log('✅ Proxy auth applied to new page');
                  
                  // Wait a moment then reload new pages to ensure proxy auth takes effect
                  setTimeout(async () => {
                    try {
                      const currentUrl = page.url();
                      if (currentUrl && currentUrl !== 'about:blank' && !currentUrl.includes('chrome://')) {
                        console.log(`🔄 Reloading new page to apply proxy auth: ${currentUrl}`);
                        await page.reload({ waitUntil: 'networkidle2', timeout: 10000 });
                        console.log('✅ New page reloaded successfully');
                      }
                    } catch (error) {
                      console.log(`⚠️ Could not reload new page: ${error.message}`);
                    }
                  }, 2000);
                } catch (error) {
                  console.log(`⚠️ Could not apply auth to new page: ${error.message}`);
                }
              }
            }
          });

          // Apply to existing pages and reload them to ensure proxy auth works
          const allPages = await browser.pages();
          for (const page of allPages) {
            try {
              await page.authenticate({
                username: proxyConfig.username,
                password: proxyConfig.password
              });
              console.log('✅ Proxy auth applied to existing page');
              
              // Reload the page to ensure proxy authentication takes effect
              const currentUrl = page.url();
              if (currentUrl && currentUrl !== 'about:blank' && !currentUrl.includes('chrome://')) {
                try {
                  console.log(`🔄 Reloading page to apply proxy auth: ${currentUrl}`);
                  await page.reload({ waitUntil: 'networkidle2', timeout: 10000 });
                  console.log('✅ Page reloaded successfully');
                } catch (reloadError) {
                  console.log(`⚠️ Could not reload page: ${reloadError.message}`);
                }
              }
            } catch (error) {
              console.log(`⚠️ Could not apply auth to existing page: ${error.message}`);
            }
          }
        }

        // Wait longer for session restore to complete and check multiple times
        await this.handleAboutBlankTab(browser);

      } else {
        // Launch without proxy
        console.log('🚀 Launching without proxy');
        browser = await puppeteer.launch({
          headless: false,
          userDataDir: profilePath,
          defaultViewport: null,  // Viewport tự động theo window size
          ignoreDefaultArgs: ['--enable-automation'],
          args: chromeArgs
        });
        
        // Wait for session restore and handle about:blank tab
        await this.handleAboutBlankTab(browser);
      }

      // Thiết lập Chrome instance trước khi pin extensions
      this.chromeInstances.set(instanceId, {
        browser,
        profileId,
        proxyConfig,
        startTime: new Date(),
        windowSize: { width, height, x, y },  // Lưu thông tin kích thước và vị trí
        isActive: true  // Trạng thái hoạt động
      });

      // Auto-enable và pin extensions sau khi khởi chạy
      await this.setupExtensionsForProfile(profilePath, extensionPaths);
      await this.autoEnableAndPinExtensions(browser, extensionPaths, profileId);
      
      // Inject auto-pin script vào tất cả pages
      await this.injectAutoPinScript(browser, profilePath);

      // Thiết lập monitoring cho Chrome instance
      this.setupChromeMonitoring(instanceId, browser, profileId);

      console.log(`✅ SUCCESS: Chrome ${profileId} launched at ${width}x${height} position (${x}, ${y})!`);

      return {
        success: true,
        instanceId,
        profileId,
        message: 'Chrome launched with Puppeteer'
      };

    } catch (error) {
      console.error('Error launching Chrome:', error);
      return { success: false, error: error.message };
    }
  }

  async stopChrome(instanceId) {
    try {
      const instance = this.chromeInstances.get(instanceId);
      if (!instance) {
        return { success: false, error: 'Instance not found' };
      }

      if (instance.browser) {
        await instance.browser.close();
      }

      this.chromeInstances.delete(instanceId);
      return { success: true };
    } catch (error) {
      console.error('Error stopping Chrome:', error);
      return { success: false, error: error.message };
    }
  }

  // Setup extensions preferences cho profile  
  async setupExtensionsForProfile(profilePath, extensionPaths) {
    try {
      if (!extensionPaths || extensionPaths.length === 0) {
        return;
      }

      console.log('⚙️ Setting up extensions preferences...');
      
      const preferencesPath = path.join(profilePath, 'Default', 'Preferences');
      const localStatePath = path.join(profilePath, 'Local State');
      
      // Tạo thư mục Default nếu chưa có
      const defaultDir = path.join(profilePath, 'Default');
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
      }

      // Đọc hoặc tạo preferences hiện tại
      let preferences = {};
      if (fs.existsSync(preferencesPath)) {
        try {
          preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
        } catch (e) {
          console.log('Creating new preferences file...');
        }
      }

      // Initialize extensions settings
      if (!preferences.extensions) {
        preferences.extensions = {};
      }
      if (!preferences.extensions.settings) {
        preferences.extensions.settings = {};
      }
      if (!preferences.extensions.toolbar) {
        preferences.extensions.toolbar = [];
      }
      if (!preferences.extensions.pinned_extensions) {
        preferences.extensions.pinned_extensions = [];
      }

      // Core browser settings để support extensions
      preferences.browser = {
        ...preferences.browser,
        show_home_button: true,
        check_default_browser: false
      };

      // Session restore settings (Continue where you left off)
      preferences.session = {
        ...preferences.session,
        restore_on_startup: 1,                // 1 = Continue where you left off, 4 = Open specific pages, 5 = Open new tab page
        restore_on_startup_migrated: true,
        startup_urls: [],
        tabs_to_restore: -1,                  // Restore all tabs
        load_tabs_lazily: false               // Load all tabs immediately, not lazily
      };
      
      // Ensure startup preferences are set correctly
      preferences.browser = {
        ...preferences.browser,
        show_home_button: true,
        check_default_browser: false,
        clear_lso_data_enabled: false,        // Keep session data
        restore_on_startup: 1,                // Continue where you left off
        startup_urls: [],
        load_tabs_lazily: false               // Force load all tabs at startup
      };
      
      console.log('📋 Session restore configured: Continue where you left off enabled');

      // Alternative: Set trong browser object cho một số version Chrome
      if (!preferences.browser.startup) {
        preferences.browser.startup = {};
      }
      preferences.browser.startup = {
        ...preferences.browser.startup,
        restore_on_startup: 1,
        startup_urls: []
      };

      preferences.profile = {
        ...preferences.profile,
        default_content_setting_values: {
          notifications: 1
        },
        password_manager_enabled: false,
        // Session restore setting trong profile
        restore_on_startup: 1,
        startup_urls: [],
        exit_type: "Normal",                  // Normal exit to enable session restore
        exited_cleanly: true                  // Mark as cleanly exited
      };

      // Process each extension
      const extensionIds = [];
      extensionPaths.forEach(extPath => {
        try {
          const manifestPath = path.join(extPath, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            
            // Generate consistent extension ID
            const extId = this.generateExtensionId(extPath);
            extensionIds.push(extId);
            
            // Configure extension settings
            preferences.extensions.settings[extId] = {
              "active_permissions": {
                "api": manifest.permissions || [],
                "explicit_host": manifest.host_permissions || [],
                "manifest_permissions": manifest.permissions || []
              },
              "was_installed_by_default": false,
              "was_installed_by_oem": false,
              "disable_reasons": [],
              "incognito_enabled": true,
              "location": 1, // LOAD = 1 (unpacked extension)
              "manifest": manifest,
              "path": extPath,
              "state": 1, // ENABLED = 1
              "from_webstore": false,
              "from_bookmark": false,
              "install_time": Date.now().toString(),
              "creation_flags": 1,
              "was_installed_by_default": false,
              // CRITICAL: Force pin to toolbar
              "toolbar_pin_state": "force_pinned",
              "was_installed_by_custodian": false,
              "granted_permissions": {
                "api": manifest.permissions || [],
                "explicit_host": manifest.host_permissions || [],
                "manifest_permissions": manifest.permissions || []
              }
            };

            // Add to pinned extensions list
            if (!preferences.extensions.pinned_extensions.includes(extId)) {
              preferences.extensions.pinned_extensions.push(extId);
            }

            // Add to toolbar
            if (!preferences.extensions.toolbar.includes(extId)) {
              preferences.extensions.toolbar.push(extId);
            }
            
            console.log(`📌 Pre-configured extension: ${manifest.name} (${extId})`);
          }
        } catch (error) {
          console.warn(`⚠️ Could not pre-configure extension ${extPath}:`, error.message);
        }
      });

      // Write preferences file
      fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));

      // Create/update Local State for global extension settings
      let localState = {};
      if (fs.existsSync(localStatePath)) {
        try {
          localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
        } catch (e) {
          console.log('Creating new Local State file...');
        }
      }

      // Configure Local State for extensions
      if (!localState.extensions) {
        localState.extensions = {};
      }

      // Configure session restore (Continue where you left off)
      if (!localState.session) {
        localState.session = {};
      }
      
      localState.session = {
        ...localState.session,
        "restore_on_startup": 1,              // 1 = Continue where you left off
        "restore_on_startup_migrated": true,
        "startup_urls": [],
        "restore_tabs_on_startup": true,
        "load_tabs_lazily": false             // Disable lazy loading - load all tabs immediately
      };
      console.log('📋 Local State session restore configured: Continue where you left off enabled');
      
      localState.extensions = {
        ...localState.extensions,
        "alerts": {},
        "autoupdate": {
          "next_check": "13371337133713371337"
        },
        "blacklistupdate": {
          "next_check": "13371337133713371337"
        },
        "install_signature": {
          "timestamp": Date.now().toString()
        },
        // Force show extensions in toolbar
        "toolbar": extensionIds,
        "pinned_extensions": extensionIds,
        // Force visibility settings
        "toolbar_configuration": {
          "show_all_extensions": true,
          "pin_all_extensions": true,
          "auto_show": true
        },
        // Additional extension visibility options
        "ui": {
          "show_apps_shortcut": true,
          "show_bookmark_button": true,
          "show_extensions": true
        }
      };

      // Write Local State
      fs.writeFileSync(localStatePath, JSON.stringify(localState, null, 2));

      console.log('✅ Extensions preferences và Local State configured');

    } catch (error) {
      console.warn('⚠️ Could not setup extensions preferences:', error.message);
    }
  }

  // Generate extension ID từ path (simplified version)
  generateExtensionId(extensionPath) {
    // Chrome generates extension ID từ public key, nhưng cho unpacked extension
    // chúng ta có thể dùng hash của path
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(extensionPath).digest('hex');
    
    // Convert to Chrome extension ID format (32 characters, a-p)
    return hash.substring(0, 32).replace(/[0-9]/g, (match) => {
      return String.fromCharCode(97 + parseInt(match)); // 0-9 -> a-j
    });
  }

  // Tự động enable và pin extensions vào toolbar
  async autoEnableAndPinExtensions(browser, extensionPaths, profileId) {
    try {
      if (!extensionPaths || extensionPaths.length === 0) {
        return;
      }

      // Lấy danh sách tên extension hiện tại
      const path = require('path');
      const fs = require('fs');
      const currentExtNames = extensionPaths.map(e => {
        try {
          const manifest = require(path.join(e, 'manifest.json'));
          return manifest.name || path.basename(e);
        } catch {
          return path.basename(e);
        }
      }).sort();

      console.log('🔍 Current extension names:', currentExtNames);
      console.log('🔍 ProfileId passed:', profileId);

      // Đọc profiles.json để lấy EXTENSIONS cũ
      let lastPinnedExtensions = [];
      let needPin = true;
      if (profileId) {
        const profileIndex = this.profiles.findIndex(p => p.id === profileId);
        if (profileIndex !== -1) {
          const profile = this.profiles[profileIndex];
          lastPinnedExtensions = Array.isArray(profile.EXTENSIONS) ? profile.EXTENSIONS.sort() : [];
          console.log('🔍 Last pinned extensions:', lastPinnedExtensions);
          console.log('🔍 Current extensions:', currentExtNames);
          if (JSON.stringify(currentExtNames) === JSON.stringify(lastPinnedExtensions)) {
            needPin = false;
          }
        }
      }

      if (!needPin) {
        console.log('✅ Extensions đã được pin, không cần pin lại.');
        return;
      }

      console.log('🔧 Auto-enabling và pinning extensions...');
      
      // Đợi Chrome load hoàn toàn
      await new Promise(resolve => setTimeout(resolve, 4000));

      const pages = await browser.pages();
      let page = pages[0];

      // Method 1: Force pin via chrome://extensions/
      console.log('📌 Method 1: Force pin via extensions page...');
      await page.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
      
      // Enable developer mode
      await page.evaluate(() => {
        const devModeToggle = document.querySelector('#devMode');
        if (devModeToggle && !devModeToggle.checked) {
          devModeToggle.click();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get extension details và force pin
      const pinResults = await page.evaluate(() => {
        const results = [];
        const extensionCards = document.querySelectorAll('extensions-item');
        
        extensionCards.forEach(card => {
          const toggle = card.querySelector('#enableToggle');
          const nameElement = card.querySelector('#name');
          const idElement = card.getAttribute('id');
          const detailsButton = card.querySelector('#details-button, .details-button, [aria-label*="Details"]');
          
          // Enable extension
          if (toggle && !toggle.checked) {
            toggle.click();
          }
          
          // Try to access pin controls
          if (detailsButton) {
            detailsButton.click();
            
            // Look for pin option in details
            setTimeout(() => {
              const pinToggle = document.querySelector('#pin-to-toolbar, [aria-label*="pin"], .pin-button');
              if (pinToggle && !pinToggle.checked) {
                pinToggle.click();
                console.log('Pinned extension:', nameElement?.textContent);
              }
            }, 500);
          }
          
          results.push({
            id: idElement,
            name: nameElement ? nameElement.textContent : 'Unknown',
            enabled: toggle ? toggle.checked : false
          });
        });
        
        return results;
      });

      console.log('🔍 Processed extensions:', pinResults);

      // Method 2: Navigate to regular page và manipulate toolbar
      console.log('📌 Method 2: Toolbar manipulation...');
      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
      
      // Wait for toolbar to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to find và click extension puzzle piece để open menu
      await page.evaluate(() => {
        // Look for extensions button/menu
        const selectors = [
          '[aria-label*="Extension"]',
          '[title*="Extension"]', 
          '.extensions-menu-button',
          '[data-tooltip*="extension"]',
          'button[id*="extension"]',
          '.puzzle-piece-icon'
        ];
        
        for (const selector of selectors) {
          const button = document.querySelector(selector);
          if (button) {
            console.log('Found extensions button:', selector);
            button.click();
            
            // Look for pin options in the opened menu
            setTimeout(() => {
              const pinButtons = document.querySelectorAll('[aria-label*="pin"], .pin-button, [data-action="pin"]');
              pinButtons.forEach(pinBtn => {
                if (pinBtn && pinBtn.textContent.includes('pin')) {
                  pinBtn.click();
                  console.log('Clicked pin button');
                }
              });
            }, 1000);
            
            return;
          }
        }
        
        console.log('Extensions button not found, trying alternative approach...');
        
        // Alternative: Try to find extension icons directly
        const extensionIcons = document.querySelectorAll('[data-extension-id], .extension-icon, [id*="extension-"]');
        console.log('Found extension icons:', extensionIcons.length);
        
        extensionIcons.forEach(icon => {
          // Right click for context menu
          const contextEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          icon.dispatchEvent(contextEvent);
        });
      });

      // Method 3: Use keyboard shortcuts to pin extensions
      console.log('📌 Method 3: Keyboard shortcuts...');
      
      // Chrome extensions shortcut: Ctrl+Shift+E (may vary)
      await page.keyboard.down('Control');
      await page.keyboard.down('Shift');
      await page.keyboard.press('KeyE');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Control');
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Method 4: Final attempt - inject persistent script
      console.log('📌 Method 4: Persistent script injection...');
      
      await page.addScriptTag({
        content: `
          // Persistent extension pin script
          function attemptPinExtensions() {
            console.log('Attempting to pin extensions...');
            
            // Look for extension elements
            const extensionElements = document.querySelectorAll([
              '[data-extension-id]',
              '.extension-icon', 
              '[id*="extension-"]',
              '[class*="extension"]'
            ].join(','));
            
            console.log('Found extension elements:', extensionElements.length);
            
            // Try to access Chrome's internal extension API
            if (typeof chrome !== 'undefined') {
              // Method A: Try chrome.management
              if (chrome.management) {
                chrome.management.getAll((extensions) => {
                  extensions.forEach(ext => {
                    if (ext.enabled && ext.type === 'extension') {
                      console.log('Processing extension:', ext.name, ext.id);
                      // Extension is enabled, should be visible
                    }
                  });
                });
              }
              
              // Method B: Try chrome.browserAction (legacy)
              if (chrome.browserAction) {
                chrome.browserAction.enable();
              }
              
              // Method C: Try chrome.action (Manifest V3)
              if (chrome.action) {
                chrome.action.enable();
              }
            }
          }
          
          // Run immediately và setup interval
          attemptPinExtensions();
          setInterval(attemptPinExtensions, 5000);
          
          // Also run on various events
          document.addEventListener('DOMContentLoaded', attemptPinExtensions);
          window.addEventListener('load', attemptPinExtensions);
        `
      });

      console.log('✅ All extension pinning methods attempted');

      // Cập nhật EXTENSIONS cho profile tương ứng và lưu lại profiles.json
      if (profileId) {
        const profileIndex = this.profiles.findIndex(p => p.id === profileId);
        if (profileIndex !== -1) {
          this.profiles[profileIndex].EXTENSIONS = currentExtNames;
          this.saveProfiles();
          console.log('💾 Saved pinned extensions to profile:', currentExtNames);
        } else {
          console.log('⚠️ Profile not found in profiles array:', profileId);
        }
      } else {
        console.log('⚠️ ProfileId not found, cannot save EXTENSIONS');
      }

    } catch (error) {
      console.warn('⚠️ Could not auto-pin extensions:', error.message);
    }
  }

  // Setup auto-pin script cho tất cả profiles
  async setupAutoPinForAllProfiles() {
    try {
      console.log('🔧 Setting up auto-pin script for all profiles...');
      
      const profilesDir = path.join(this.dataDir, 'profiles');
      if (!fs.existsSync(profilesDir)) return;
      
      const profileDirs = fs.readdirSync(profilesDir)
        .filter(dir => fs.statSync(path.join(profilesDir, dir)).isDirectory());
      
      for (const profileDir of profileDirs) {
        const profilePath = path.join(profilesDir, profileDir);
        await this.setupAutoPinScript(profilePath);
      }
      
      console.log('✅ Auto-pin script setup completed for all profiles');
    } catch (error) {
      console.error('❌ Error setting up auto-pin script:', error);
    }
  }

  // Setup auto-pin script cho một profile
  async setupAutoPinScript(profilePath) {
    try {
      // Copy enhanced auto-pin script vào profile folder
      const scriptPath = path.join(profilePath, 'enhanced-auto-pin-script.js');
      const mainScriptPath = path.join(__dirname, '..', 'enhanced-auto-pin-script.js');
      
      if (fs.existsSync(mainScriptPath)) {
        fs.copyFileSync(mainScriptPath, scriptPath);
        console.log('📄 Enhanced auto-pin script copied to profile:', path.basename(profilePath));
        return true;
      } else {
        console.log('⚠️ Enhanced auto-pin script not found at:', mainScriptPath);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to setup enhanced auto-pin script:', error.message);
      return false;
    }
  }

  // Inject auto-pin script vào browser
  async injectAutoPinScript(browser, profilePath) {
    try {
      console.log('💉 Injecting auto-pin script into browser...');
      
      const pages = await browser.pages();
      const scriptPath = path.join(profilePath, 'extension-autopin.js');
      
      // Read auto-pin script content
      let scriptContent = '';
      if (fs.existsSync(scriptPath)) {
        scriptContent = fs.readFileSync(scriptPath, 'utf8');
      } else {
        // Fallback script
        scriptContent = `
          console.log('🔧 Fallback auto-pin script running...');
          
          function quickPin() {
            // Simple pin logic
            const hiddenExt = document.querySelectorAll('[data-extension-id][style*="display: none"]');
            hiddenExt.forEach(ext => {
              ext.style.display = 'inline-block';
              ext.style.visibility = 'visible';
            });
            
            // Click extension menu button
            const extBtn = document.querySelector('[aria-label*="Extension"], .extensions-menu-button');
            if (extBtn) {
              extBtn.click();
              setTimeout(() => {
                const pinBtns = document.querySelectorAll('[aria-label*="pin"], .pin-button');
                pinBtns.forEach(btn => btn.click());
              }, 500);
            }
          }
          
          setTimeout(quickPin, 2000);
          setInterval(quickPin, 15000);
        `;
      }
      
      // Inject vào existing pages với error handling
      for (const page of pages) {
        try {
          // Try multiple injection methods
          try {
            await page.addScriptTag({ content: scriptContent });
            console.log('✅ Auto-pin script injected into existing page');
          } catch (trustedScriptError) {
            // Fallback: Try via file path
            const scriptPath = path.join(__dirname, '..', 'enhanced-auto-pin-script.js');
            if (fs.existsSync(scriptPath)) {
              await page.addScriptTag({ path: scriptPath });
              console.log('✅ Auto-pin script injected via file path');
            }
          }
          
          // Also inject test script for debugging
          const testScriptPath = path.join(__dirname, '..', 'test-extension-pin.js');
          if (fs.existsSync(testScriptPath)) {
            try {
              const testContent = fs.readFileSync(testScriptPath, 'utf8');
              await page.addScriptTag({ content: testContent });
              console.log('🔍 Test script injected for debugging');
            } catch (testError) {
              await page.addScriptTag({ path: testScriptPath });
              console.log('🔍 Test script injected via file path');
            }
          }
        } catch (error) {
          console.log('⚠️ Could not inject into page:', error.message);
        }
      }
      
      // Setup injection for new pages với error handling
      browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
          try {
            const newPage = await target.page();
            
            // Try multiple injection methods
            try {
              await newPage.addScriptTag({ content: scriptContent });
              console.log('✅ Auto-pin script injected into new page');
            } catch (trustedScriptError) {
              // Fallback: Try via file path
              const scriptPath = path.join(__dirname, '..', 'enhanced-auto-pin-script.js');
              if (fs.existsSync(scriptPath)) {
                await newPage.addScriptTag({ path: scriptPath });
                console.log('✅ Auto-pin script injected into new page via file');
              }
            }
            
            // Also inject test script
            const testScriptPath = path.join(__dirname, '..', 'test-extension-pin.js');
            if (fs.existsSync(testScriptPath)) {
              try {
                const testContent = fs.readFileSync(testScriptPath, 'utf8');
                await newPage.addScriptTag({ content: testContent });
                console.log('🔍 Test script injected into new page');
              } catch (testError) {
                await newPage.addScriptTag({ path: testScriptPath });
                console.log('🔍 Test script injected into new page via file');
              }
            }
          } catch (error) {
            console.log('⚠️ Could not inject into new page:', error.message);
          }
        }
      });
      
      console.log('🎯 Auto-pin script injection setup completed');
      
    } catch (error) {
      console.error('❌ Error injecting auto-pin script:', error);
    }
  }

  // Thiết lập monitoring để theo dõi Chrome instance
  setupChromeMonitoring(instanceId, browser, profileId) {
    // Monitor browser disconnection
    browser.on('disconnected', () => {
      console.log(`🔴 Chrome ${profileId} (${instanceId}) đã bị đóng bằng tay`);
      this.handleChromeDisconnected(instanceId, profileId);
    });

    // Monitor target destruction (tab/window closed)
    browser.on('targetdestroyed', (target) => {
      if (target.type() === 'page') {
        console.log(`📝 Tab trong Chrome ${profileId} đã bị đóng`);
      }
    });

    // Monitor before browser close to save session
    browser.on('beforeunload', async () => {
      console.log(`💾 Saving session for Chrome ${profileId} before close...`);
      await this.forceSaveSession(browser, profileId);
    });

    // Periodic health check
    this.startHealthCheck(instanceId, browser, profileId);
  }

  // Force save session
  async forceSaveSession(browser, profileId) {
    try {
      const pages = await browser.pages();
      if (pages.length > 0) {
        // Execute script to force session save
        await pages[0].evaluate(() => {
          // Force Chrome to save current session
          if (window.chrome && window.chrome.sessions) {
            window.chrome.sessions.save();
          }
        });
        console.log(`💾 Session save triggered for ${profileId}`);
      }
    } catch (error) {
      console.log(`⚠️ Could not force save session for ${profileId}: ${error.message}`);
    }
  }

  // Xử lý khi Chrome bị disconnected
  handleChromeDisconnected(instanceId, profileId) {
    const instance = this.chromeInstances.get(instanceId);
    if (instance) {
      instance.isActive = false;
      instance.disconnectedAt = new Date();
      console.log(`♻️ Đã cập nhật trạng thái Chrome ${profileId} thành 'đã đóng'`);
    }
  }

  // Health check định kỳ
  startHealthCheck(instanceId, browser, profileId) {
    const healthCheckInterval = setInterval(async () => {
      try {
        const instance = this.chromeInstances.get(instanceId);
        if (!instance || !instance.isActive) {
          clearInterval(healthCheckInterval);
          return;
        }

        // Kiểm tra browser có còn connected không
        if (!browser.isConnected()) {
          console.log(`💔 Chrome ${profileId} mất kết nối - cập nhật trạng thái`);
          this.handleChromeDisconnected(instanceId, profileId);
          clearInterval(healthCheckInterval);
          return;
        }

      } catch (error) {
        console.log(`⚠️ Health check error cho ${profileId}: ${error.message}`);
        this.handleChromeDisconnected(instanceId, profileId);
        clearInterval(healthCheckInterval);
      }
    }, 5000); // Check mỗi 5 giây

    // Lưu interval để có thể clear sau
    const instance = this.chromeInstances.get(instanceId);
    if (instance) {
      instance.healthCheckInterval = healthCheckInterval;
    }
  }

  // Lấy danh sách Chrome instances với trạng thái
  getActiveInstances() {
    const instances = [];
    for (const [instanceId, instance] of this.chromeInstances.entries()) {
      instances.push({
        instanceId,
        profileId: instance.profileId,
        isActive: instance.isActive,
        startTime: instance.startTime,
        disconnectedAt: instance.disconnectedAt,
        windowSize: instance.windowSize,
        proxyConfig: instance.proxyConfig ? {
          host: instance.proxyConfig.host,
          port: instance.proxyConfig.port,
          type: instance.proxyConfig.type
        } : null
      });
    }
    return instances;
  }

  // Proxy Management
  async addProxy(proxyData) {
    try {
      const proxy = {
        id: `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        host: proxyData.host,
        port: proxyData.port,
        username: proxyData.username || '',
        password: proxyData.password || '',
        type: proxyData.type || 'http',
        created: new Date().toISOString(),
        status: 'unchecked'
      };

      this.proxies.push(proxy);
      this.saveProxies();

      return { success: true, proxy };
    } catch (error) {
      console.error('Error adding proxy:', error);
      return { success: false, error: error.message };
    }
  }

  async checkProxyStatus(proxyData) {
    // Simple proxy check implementation
    try {
      const startTime = Date.now();
      // TODO: Implement actual proxy checking logic
      const responseTime = Date.now() - startTime;

      return {
        status: 'working',
        responseTime,
        ip: '127.0.0.1',
        endpoint: 'test-endpoint'
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkMultipleProxies(proxyList) {
    const results = [];
    for (const proxy of proxyList) {
      const result = await this.checkProxyStatus(proxy);
      results.push({
        id: proxy.id,
        checkResult: result
      });
    }
    return results;
  }

  async updateProxyStatus(proxyId, statusData) {
    const proxy = this.proxies.find(p => p.id === proxyId);
    if (proxy) {
      proxy.status = statusData.status;
      proxy.responseTime = statusData.responseTime;
      proxy.error = statusData.error;
      proxy.lastChecked = new Date().toISOString();
      this.saveProxies();
    }
    return { success: true };
  }

  async testProxy(proxyData) {
    try {
      console.log('Testing proxy:', proxyData);
      const startTime = Date.now();
      
      // Basic proxy validation
      if (!proxyData.host || !proxyData.port) {
        return {
          success: false,
          error: 'Host và Port là bắt buộc'
        };
      }

      // TODO: Implement actual proxy testing logic
      // For now, simulate a basic test
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        ip: '127.0.0.1',
        endpoint: 'test-endpoint',
        status: 'working'
      };
    } catch (error) {
      console.error('Error testing proxy:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Data Management
  loadData() {
    try {
      const profilesFile = path.join(this.dataDir, 'profiles.json');
      const proxiesFile = path.join(this.dataDir, 'proxies.json');
      const cardsFile = path.join(this.dataDir, 'cards.json');
      const groupsFile = path.join(this.dataDir, 'groups.json');
      const extensionsFile = path.join(this.dataDir, 'extensions.json');

      if (fs.existsSync(profilesFile)) {
        this.profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
      }

      if (fs.existsSync(proxiesFile)) {
        this.proxies = JSON.parse(fs.readFileSync(proxiesFile, 'utf8'));
      }

      if (fs.existsSync(cardsFile)) {
        this.cards = JSON.parse(fs.readFileSync(cardsFile, 'utf8'));
      }

      if (fs.existsSync(groupsFile)) {
        this.groups = JSON.parse(fs.readFileSync(groupsFile, 'utf8'));
      }

      if (fs.existsSync(extensionsFile)) {
        this.extensions = JSON.parse(fs.readFileSync(extensionsFile, 'utf8'));
      }

      // Tự động cài extension vào tất cả profile khi khởi động
      this.autoInstallExtensionsToAllProfiles();
      
      // Setup auto-pin script cho tất cả profiles
      this.setupAutoPinForAllProfiles();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  saveProfiles() {
    try {
      const profilesFile = path.join(this.dataDir, 'profiles.json');
      fs.writeFileSync(profilesFile, JSON.stringify(this.profiles, null, 2));
    } catch (error) {
      console.error('Error saving profiles:', error);
    }
  }

  saveProxies() {
    try {
      const proxiesFile = path.join(this.dataDir, 'proxies.json');
      fs.writeFileSync(proxiesFile, JSON.stringify(this.proxies, null, 2));
    } catch (error) {
      console.error('Error saving proxies:', error);
    }
  }

  saveCards() {
    try {
      const cardsFile = path.join(this.dataDir, 'cards.json');
      fs.writeFileSync(cardsFile, JSON.stringify(this.cards, null, 2));
    } catch (error) {
      console.error('Error saving cards:', error);
    }
  }

  saveGroups() {
    try {
      const groupsFile = path.join(this.dataDir, 'groups.json');
      fs.writeFileSync(groupsFile, JSON.stringify(this.groups, null, 2));
    } catch (error) {
      console.error('Error saving groups:', error);
    }
  }

  getProfiles() {
    return this.profiles;
  }

  getProxies() {
    return this.proxies;
  }

  // Card management methods
  getCards() {
    return this.cards;
  }

  async addCard(cardData) {
    try {
      const newCard = {
        id: Date.now().toString(),
        name: cardData.name,
        note: cardData.note || '',
        created: new Date().toISOString()
      };

      this.cards.push(newCard);
      this.saveCards();

      return { success: true, card: newCard };
    } catch (error) {
      console.error('Error adding card:', error);
      return { success: false, error: error.message };
    }
  }

  async updateCard(cardId, cardData) {
    try {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return { success: false, error: 'Card not found' };
      }

      this.cards[cardIndex] = {
        ...this.cards[cardIndex],
        name: cardData.name,
        note: cardData.note || '',
        updated: new Date().toISOString()
      };

      this.saveCards();
      return { success: true, card: this.cards[cardIndex] };
    } catch (error) {
      console.error('Error updating card:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteCard(cardId) {
    try {
      const cardIndex = this.cards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        return { success: false, error: 'Card not found' };
      }

      // Remove card from profiles that use it
      this.profiles.forEach(profile => {
        if (profile.cardId === cardId) {
          profile.cardId = '';
        }
      });
      this.saveProfiles();

      this.cards.splice(cardIndex, 1);
      this.saveCards();

      return { success: true };
    } catch (error) {
      console.error('Error deleting card:', error);
      return { success: false, error: error.message };
    }
  }

  // Group management methods
  getGroups() {
    return this.groups;
  }

  async addGroup(groupData) {
    try {
      const newGroup = {
        id: Date.now().toString(),
        name: groupData.name,
        color: groupData.color || 'blue',
        description: groupData.description || '',
        created: new Date().toISOString()
      };

      this.groups.push(newGroup);
      this.saveGroups();

      return { success: true, group: newGroup };
    } catch (error) {
      console.error('Error adding group:', error);
      return { success: false, error: error.message };
    }
  }

  async updateGroup(groupId, groupData) {
    try {
      const groupIndex = this.groups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) {
        return { success: false, error: 'Group not found' };
      }

      this.groups[groupIndex] = {
        ...this.groups[groupIndex],
        name: groupData.name,
        color: groupData.color || 'blue',
        description: groupData.description || '',
        updated: new Date().toISOString()
      };

      this.saveGroups();
      return { success: true, group: this.groups[groupIndex] };
    } catch (error) {
      console.error('Error updating group:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteGroup(groupId) {
    try {
      const groupIndex = this.groups.findIndex(g => g.id === groupId);
      if (groupIndex === -1) {
        return { success: false, error: 'Group not found' };
      }

      // Remove group from profiles that use it
      this.profiles.forEach(profile => {
        if (profile.groupId === groupId) {
          profile.groupId = undefined;
        }
      });
      this.saveProfiles();

      this.groups.splice(groupIndex, 1);
      this.saveGroups();

      return { success: true };
    } catch (error) {
      console.error('Error deleting group:', error);
      return { success: false, error: error.message };
    }
  }
}

// Health monitoring
const healthMonitor = {
  start() {
    console.log('🏥 Health monitoring started');
    setInterval(() => {
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed / 1024 / 1024 > 500) { // > 500MB
        console.warn('⚠️ High memory usage detected');
      }
    }, 30000); // Check every 30 seconds
  }
};

// Global variable to store the chrome manager instance
let chromeManager;

// App Events
app.whenReady().then(() => {
  console.log('🚀 Starting Chrome Manager...');
  chromeManager = new ChromeManager();
  chromeManager.createWindow();
  
  // Start health monitoring
  healthMonitor.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      chromeManager.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  console.log('🛑 Shutting down Chrome Manager...');
  
  // Cleanup auto-updater
  if (chromeManager && chromeManager.autoUpdater) {
    chromeManager.autoUpdater.cleanup();
  }
  
  // Cleanup: Close all Chrome instances
  if (chromeManager && chromeManager.chromeInstances) {
    for (const [instanceId, instance] of chromeManager.chromeInstances) {
      try {
        if (instance.browser) {
          await instance.browser.close();
        }
      } catch (error) {
        console.error('Error closing Chrome instance:', error);
      }
    }
  }
  console.log('✅ Chrome Manager shutdown complete');
});

// Extension Management Methods
ChromeManager.prototype.getExtensions = function() {
  return this.extensions;
};

ChromeManager.prototype.addExtension = async function(extensionData) {
  try {
    const extensionId = Date.now().toString();
    const extension = {
      id: extensionId,
      name: extensionData.name,
      description: extensionData.description || '',
      version: extensionData.version || '1.0.0',
      path: extensionData.path || '',
      crxPath: extensionData.crxPath || '',
      chromeWebStoreId: extensionData.chromeWebStoreId || '',
      icon: extensionData.icon || '',
      enabled: extensionData.enabled !== false,
      category: extensionData.category || 'Other',
      created: new Date().toISOString()
    };
    
    this.extensions.push(extension);
    this.saveExtensions();
    
    // Tự động cài extension mới vào tất cả profile
    await this.autoInstallNewExtensionToAllProfiles(extensionId);
    
    return { success: true, extension };
  } catch (error) {
    console.error('Error adding extension:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.updateExtension = async function(extensionId, extensionData) {
  try {
    const extensionIndex = this.extensions.findIndex(e => e.id === extensionId);
    if (extensionIndex === -1) {
      return { success: false, error: 'Extension not found' };
    }

    const updatedExtension = { ...this.extensions[extensionIndex], ...extensionData };
    this.extensions[extensionIndex] = updatedExtension;
    this.saveExtensions();

    return { success: true, extension: updatedExtension };
  } catch (error) {
    console.error('Error updating extension:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.deleteExtension = async function(extensionId) {
  try {
    const extensionIndex = this.extensions.findIndex(e => e.id === extensionId);
    if (extensionIndex === -1) {
      return { success: false, error: 'Extension not found' };
    }

    this.extensions.splice(extensionIndex, 1);
    this.saveExtensions();

    return { success: true };
  } catch (error) {
    console.error('Error deleting extension:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.saveExtensions = function() {
  try {
    const extensionsFile = path.join(this.dataDir, 'extensions.json');
    fs.writeFileSync(extensionsFile, JSON.stringify(this.extensions, null, 2));
  } catch (error) {
    console.error('Error saving extensions:', error);
  }
};

ChromeManager.prototype.installExtensionToProfile = async function(extensionId, profileId) {
  try {
    const extension = this.extensions.find(e => e.id === extensionId);
    if (!extension) {
      return { success: false, error: 'Extension not found' };
    }

    const profile = this.profiles.find(p => p.id === profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Thêm extension vào profile settings
    if (!profile.extensions) {
      profile.extensions = [];
    }

    // Kiểm tra xem extension đã được thêm chưa
    if (!profile.extensions.find(e => e.id === extensionId)) {
      profile.extensions.push({
        id: extensionId,
        name: extension.name,
        enabled: true,
        installedAt: new Date().toISOString()
      });
    }

    this.saveProfiles();
    return { success: true };
  } catch (error) {
    console.error('Error installing extension to profile:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.getExtensionPathsForProfile = function(profile) {
  const extensionPaths = [];
  
  if (profile.extensions && profile.extensions.length > 0) {
    for (const profileExt of profile.extensions) {
      if (!profileExt.enabled) continue;
      
      const extension = this.extensions.find(e => e.id === profileExt.id);
      if (!extension) continue;
      
      // Add valid extension paths
      if (extension.path && fs.existsSync(extension.path)) {
        // If path is manifest.json, use the parent directory
        if (extension.path.endsWith('manifest.json')) {
          extensionPaths.push(path.dirname(extension.path));
        } else {
          extensionPaths.push(extension.path);
        }
      } else if (extension.crxPath && fs.existsSync(extension.crxPath)) {
        extensionPaths.push(extension.crxPath);
      }
    }
  }
  
  return extensionPaths;
};

ChromeManager.prototype.loadExtensionFromManifest = async function(manifestPath) {
  try {
    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: 'Manifest file not found' };
    }

    const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Check if extension already exists
    const existingExtension = this.extensions.find(e => e.path === manifestPath);
    if (existingExtension) {
      return { success: false, error: 'Extension already exists' };
    }

    // Get icon path
    let iconPath = '';
    if (manifestData.icons) {
      const iconSizes = Object.keys(manifestData.icons).sort((a, b) => b - a);
      if (iconSizes.length > 0) {
        iconPath = path.resolve(path.dirname(manifestPath), manifestData.icons[iconSizes[0]]);
      }
    }

    const extensionData = {
      name: manifestData.name || 'Unknown Extension',
      description: manifestData.description || '',
      version: manifestData.version || '1.0.0',
      path: manifestPath,
      icon: iconPath,
      enabled: true,
      category: 'Other'
    };

    return await this.addExtension(extensionData);
  } catch (error) {
    console.error('Error loading extension from manifest:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.browseExtensionFolder = async function() {
  try {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      title: 'Chọn thư mục Extension',
      properties: ['openDirectory'],
      filters: [
        { name: 'Chrome Extension Folder', extensions: [] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'No folder selected' };
    }

    const extensionPath = result.filePaths[0];
    const manifestPath = path.join(extensionPath, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: 'No manifest.json found in selected folder' };
    }

    // Read manifest data
    const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Get icon path
    let iconPath = '';
    if (manifestData.icons) {
      const iconSizes = Object.keys(manifestData.icons).sort((a, b) => b - a);
      if (iconSizes.length > 0) {
        iconPath = path.resolve(path.dirname(manifestPath), manifestData.icons[iconSizes[0]]);
      }
    }

    return { 
      success: true, 
      extensionData: {
        name: manifestData.name || 'Unknown Extension',
        description: manifestData.description || '',
        version: manifestData.version || '1.0.0',
        path: manifestPath,
        icon: iconPath
      }
    };
  } catch (error) {
    console.error('Error browsing extension folder:', error);
    return { success: false, error: error.message };
  }
};

// Auto-install extension methods
ChromeManager.prototype.autoInstallExtensionsToAllProfiles = async function() {
  try {
    console.log('🔄 Auto-installing extensions to all profiles...');
    
    if (this.extensions.length === 0) {
      console.log('ℹ️ No extensions to install');
      return;
    }

    let installedCount = 0;
    
    for (const profile of this.profiles) {
      const result = await this.autoInstallExtensionsToProfile(profile.id);
      if (result && result.installedCount > 0) {
        installedCount += result.installedCount;
      }
    }
    
    console.log(`✅ Auto-installed ${installedCount} extensions to ${this.profiles.length} profiles`);
    return { success: true, installedCount };
  } catch (error) {
    console.error('Error auto-installing extensions to all profiles:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.autoInstallExtensionsToProfile = async function(profileId) {
  try {
    const profile = this.profiles.find(p => p.id === profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Khởi tạo extensions array nếu chưa có
    if (!profile.extensions) {
      profile.extensions = [];
    }

    let installedCount = 0;

    // Cài đặt tất cả extension có sẵn vào profile
    for (const extension of this.extensions) {
      if (!extension.enabled) continue;
      
      // Kiểm tra xem extension đã được cài chưa
      const alreadyInstalled = profile.extensions.find(e => e.id === extension.id);
      if (alreadyInstalled) {
        console.log(`⏭️ Extension "${extension.name}" already installed in profile "${profile.name}"`);
        continue;
      }

      // Thêm extension vào profile
      profile.extensions.push({
        id: extension.id,
        name: extension.name,
        enabled: true,
        installedAt: new Date().toISOString(),
        autoInstalled: true
      });
      
      installedCount++;
      console.log(`✅ Auto-installed extension "${extension.name}" to profile "${profile.name}"`);
    }

    if (installedCount > 0) {
      this.saveProfiles();
    }
    
    return { success: true, installedCount };
  } catch (error) {
    console.error('Error auto-installing extensions to profile:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.autoInstallNewExtensionToAllProfiles = async function(extensionId) {
  try {
    const extension = this.extensions.find(e => e.id === extensionId);
    if (!extension) {
      return { success: false, error: 'Extension not found' };
    }

    let installedCount = 0;

    // Cài extension mới vào tất cả profile
    for (const profile of this.profiles) {
      if (!profile.extensions) {
        profile.extensions = [];
      }

      // Kiểm tra xem extension đã được cài chưa
      const alreadyInstalled = profile.extensions.find(e => e.id === extensionId);
      if (alreadyInstalled) {
        continue;
      }

      // Thêm extension vào profile
      profile.extensions.push({
        id: extensionId,
        name: extension.name,
        enabled: true,
        installedAt: new Date().toISOString(),
        autoInstalled: true
      });
      
      installedCount++;
      console.log(`✅ Auto-installed new extension "${extension.name}" to profile "${profile.name}"`);
    }

    if (installedCount > 0) {
      this.saveProfiles();
    }
    
    console.log(`🎉 Auto-installed extension "${extension.name}" to ${installedCount} profiles`);
    return { success: true, installedCount };
  } catch (error) {
    console.error('Error auto-installing new extension to all profiles:', error);
    return { success: false, error: error.message };
  }
};

// Workflow Management Methods
ChromeManager.prototype.saveWorkflow = async function(workflowData) {
  try {
    const workflowsFile = path.join(this.dataDir, 'workflows.json');
    let workflows = [];
    
    if (fs.existsSync(workflowsFile)) {
      workflows = JSON.parse(fs.readFileSync(workflowsFile, 'utf8'));
    }
    
    const existingIndex = workflows.findIndex(w => w.id === workflowData.id);
    
    if (existingIndex > -1) {
      workflows[existingIndex] = workflowData;
    } else {
      workflows.push(workflowData);
    }
    
    fs.writeFileSync(workflowsFile, JSON.stringify(workflows, null, 2));
    console.log(`💾 Saved workflow: ${workflowData.name}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error saving workflow:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.getSavedWorkflows = function() {
  try {
    const workflowsFile = path.join(this.dataDir, 'workflows.json');
    
    if (!fs.existsSync(workflowsFile)) {
      return [];
    }
    
    return JSON.parse(fs.readFileSync(workflowsFile, 'utf8'));
  } catch (error) {
    console.error('Error loading workflows:', error);
    return [];
  }
};

ChromeManager.prototype.loadWorkflow = async function(workflowId) {
  try {
    const workflows = this.getSavedWorkflows();
    const workflow = workflows.find(w => w.id === workflowId);
    
    if (!workflow) {
      return { success: false, error: 'Workflow not found' };
    }
    
    return { success: true, workflow };
  } catch (error) {
    console.error('Error loading workflow:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.deleteWorkflow = async function(workflowId) {
  try {
    const workflowsFile = path.join(this.dataDir, 'workflows.json');
    let workflows = this.getSavedWorkflows();
    
    workflows = workflows.filter(w => w.id !== workflowId);
    
    fs.writeFileSync(workflowsFile, JSON.stringify(workflows, null, 2));
    console.log(`🗑️ Deleted workflow: ${workflowId}`);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return { success: false, error: error.message };
  }
};

ChromeManager.prototype.runWorkflow = async function(workflowData) {
  try {
    console.log('🚀 Running workflow with nodes:', workflowData.nodes.length);
    
    let currentBrowser = null;
    let currentPage = null;
    
    // Sort nodes by execution order (for now, just use array order)
    const nodes = workflowData.nodes;
    
    for (const node of nodes) {
      console.log(`📋 Executing node: ${node.type}`);
      
      try {
        switch (node.type) {
          case 'open-profile':
            if (node.config.profileId) {
              const profile = this.profiles.find(p => p.id === node.config.profileId);
              if (profile) {
                console.log(`🔓 Opening profile: ${profile.name}`);
                // Use existing launch method
                const result = await this.launchChromeWithPuppeteer(node.config.profileId, profile.proxyConfig);
                if (result.success) {
                  currentBrowser = result.browser;
                  currentPage = result.page;
                }
              }
            }
            break;
            
          case 'goto-url':
            if (currentPage && node.config.url) {
              console.log(`🌐 Navigating to: ${node.config.url}`);
              await currentPage.goto(node.config.url, { waitUntil: 'networkidle2' });
            }
            break;
            
          case 'click-element':
            if (currentPage && node.config.selector) {
              console.log(`🖱️ Clicking element: ${node.config.selector}`);
              await currentPage.click(node.config.selector);
            }
            break;
            
          case 'fill-form':
            if (currentPage && node.config.selector && node.config.value) {
              console.log(`✏️ Filling form: ${node.config.selector} = ${node.config.value}`);
              await currentPage.type(node.config.selector, node.config.value);
            }
            break;
            
          case 'wait':
            const duration = parseInt(node.config.duration) || 1000;
            console.log(`⏱️ Waiting: ${duration}ms`);
            await new Promise(resolve => setTimeout(resolve, duration));
            break;
            
          case 'new-tab':
            if (currentBrowser) {
              console.log('📄 Opening new tab');
              currentPage = await currentBrowser.newPage();
              if (node.config.url) {
                await currentPage.goto(node.config.url, { waitUntil: 'networkidle2' });
              }
            }
            break;
            
          case 'close-tab':
            if (currentPage) {
              console.log('❌ Closing current tab');
              await currentPage.close();
              currentPage = null;
            }
            break;
            
          case 'switch-proxy':
            // For proxy switching, we'd need to restart with new proxy
            console.log('🔄 Proxy switching not implemented in workflow yet');
            break;
            
          case 'close-profile':
            if (currentBrowser) {
              console.log('🔒 Closing profile');
              await currentBrowser.close();
              currentBrowser = null;
              currentPage = null;
            }
            break;
            
          default:
            console.log(`⚠️ Unknown node type: ${node.type}`);
        }
        
        // Short delay between actions
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (nodeError) {
        console.error(`❌ Error executing node ${node.type}:`, nodeError);
        // Continue with next node unless it's critical
      }
    }
    
    console.log('✅ Workflow execution completed');
    return { success: true };
    
  } catch (error) {
    console.error('Error running workflow:', error);
    return { success: false, error: error.message };
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
