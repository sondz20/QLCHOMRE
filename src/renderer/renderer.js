// Setup API mapping
window.api = window.electronAPI;

class ChromeManagerUI {
    constructor() {
        this.profiles = [];
        this.proxies = [];
        this.groups = [];
        this.extensions = [];
        this.runningInstances = new Map();
        this.currentTab = 'profiles';
        this.selectedProfiles = new Set();
        this.selectedProxies = new Set();
        this.filteredProfiles = [];
        this.currentGroupFilter = '';
        this.templates = this.getProfileTemplates();
        this.cards = [];
        
        // Cache for optimized proxy loading
        this.proxiesCache = {
            data: null,
            lastUpdated: 0,
            cacheTimeout: 30000, // 30 seconds cache
            isLoading: false // Prevent multiple simultaneous loads
        };
        
        // Track last active proxy tab to avoid unnecessary reloads
        this.lastProxyTab = null;
        this.lastTabClickTime = 0;
        this.tabClickDebounce = 150; // 150ms debounce
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setupModals();
        this.setupSearchAndFilter();
        this.setupBulkActions();
        this.setupFormValidation();
        this.initializeSettings();
        await this.loadData();
        this.updateStats();
        this.setupGroupManagement();
        
        // Initialize sidebar visibility for default tab (profiles)
        this.switchTab('profiles');
        
        // Start monitoring Chrome instances
        this.startInstanceMonitoring();
    }

    // Monitor Chrome instances và sync với backend
    startInstanceMonitoring() {
        // Sync ngay lập tức
        this.syncChromeInstances();
        
        // Setup interval để check định kỳ
        this.monitoringInterval = setInterval(() => {
            this.syncChromeInstances();
        }, 3000); // Check mỗi 3 giây
    }

    async syncChromeInstances() {
        try {
            // Kiểm tra xem API có sẵn không
            if (!window.electronAPI.getChromeInstances) return;
            
            const backendInstances = await window.electronAPI.getChromeInstances();
            
            // Update local running instances với data từ backend
            const previousInstances = new Map(this.runningInstances);
            this.runningInstances.clear();
            
            backendInstances.forEach(instance => {
                const profile = this.profiles.find(p => p.id === instance.profileId);
                if (profile) {
                    this.runningInstances.set(instance.instanceId, {
                        id: instance.instanceId,
                        profile: profile,
                        proxy: instance.proxyConfig,
                        startTime: new Date(instance.startTime),
                        windowSize: instance.windowSize,
                        isActive: instance.isActive,
                        disconnectedAt: instance.disconnectedAt ? new Date(instance.disconnectedAt) : null
                    });
                }
            });
            
            // Update UI nếu có thay đổi
            if (this.hasInstancesChanged(previousInstances, this.runningInstances)) {
                this.renderRunningInstances();
                this.renderProfiles(); // Cập nhật cả Profiles tab
                this.updateStats();
            }
            
        } catch (error) {
            console.error('Error syncing Chrome instances:', error);
        }
    }

    // Button loading state management
    setButtonLoading(profileId, isLoading = true) {
        const button = document.getElementById(`btn-${profileId}`);
        if (!button) return;

        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang mở...';
            button.classList.add('btn-loading');
        } else {
            button.disabled = false;
            button.classList.remove('btn-loading');
            // UI sẽ được cập nhật qua renderProfiles()
        }
    }

    hasInstancesChanged(oldInstances, newInstances) {
        if (oldInstances.size !== newInstances.size) return true;
        
        for (const [id, instance] of newInstances) {
            const oldInstance = oldInstances.get(id);
            if (!oldInstance || oldInstance.isActive !== instance.isActive) {
                return true;
            }
        }
        return false;
    }

    initializeSettings() {
        // Settings initialization removed
    }

    getProfileTemplates() {
        return {
            'social-media': {
                name: 'Social Media Profile',
                description: 'Optimized for social media platforms',
                settings: {
                    extensions: ['adblock', 'social-share'],
                    privacy: 'medium',
                    performance: 'optimized'
                }
            },
            'e-commerce': {
                name: 'E-commerce Profile', 
                description: 'Perfect for online shopping',
                settings: {
                    extensions: ['honey', 'cashback'],
                    privacy: 'high',
                    autofill: true
                }
            },
            'development': {
                name: 'Development Profile',
                description: 'For developers and testing',
                settings: {
                    extensions: ['react-devtools', 'redux-devtools'],
                    devtools: true,
                    cors: false
                }
            },
            'privacy-focus': {
                name: 'Privacy Focused Profile',
                description: 'Maximum privacy and security',
                settings: {
                    extensions: ['ublock-origin', 'privacy-badger'],
                    tracking: false,
                    javascript: 'limited'
                }
            },
            'gaming': {
                name: 'Gaming Profile',
                description: 'Optimized for gaming and streaming',
                settings: {
                    extensions: ['game-booster', 'twitch'],
                    performance: 'maximum',
                    memory: 'optimized'
                }
            },
            'business': {
                name: 'Business Profile',
                description: 'Professional work environment',
                settings: {
                    extensions: ['google-workspace', 'zoom'],
                    notifications: true,
                    sync: 'corporate'
                }
            }
        };
    }

    setupEventListeners() {
        // Helper function to safely add event listeners
        const safeAddEventListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.warn(`Element with ID '${id}' not found`);
            }
        };

        // Profile events
        safeAddEventListener('createProfileBtn', 'click', () => {
            this.showModal('createProfileModal');
        });

        safeAddEventListener('createProfileForm', 'submit', (e) => {
            e.preventDefault();
            this.createProfile();
        });

        // Templates button
        safeAddEventListener('templatesBtn', 'click', () => {
            this.showModal('templatesModal');
        });

        // Proxy validation status listener
        if (window.electronAPI && window.electronAPI.onProxyValidationStatus) {
            window.electronAPI.onProxyValidationStatus((event, data) => {
                this.handleProxyValidationStatus(data);
            });
        }

        // Proxy setup status listener
        if (window.electronAPI && window.electronAPI.onProxySetupStatus) {
            window.electronAPI.onProxySetupStatus((event, data) => {
                this.handleProxySetupStatus(data);
            });
        }

        // Bulk actions button
        safeAddEventListener('bulkActionsBtn', 'click', () => {
            this.showBulkActionsModal();
        });

        // Proxy events
        safeAddEventListener('addProxyBtn', 'click', () => {
            this.showModal('addProxyModal');
        });

        safeAddEventListener('cleanupDuplicateProxiesBtn', 'click', async () => {
            const confirmed = confirm('Bạn có chắc chắn muốn dọn dẹp các proxy trùng lặp? Các proxy trùng lặp sẽ được gộp lại và số lần sử dụng sẽ được cộng dồn.');
            if (confirmed) {
                this.showLoading(true, 'Đang dọn dẹp proxy trùng lặp...');
                try {
                    const result = await this.cleanupDuplicateProxies();
                    this.showToast(`Đã dọn dẹp ${result.cleaned} proxy trùng lặp. Còn lại ${result.remaining} proxy duy nhất.`, 'success');
                } catch (error) {
                    console.error('Error cleaning up duplicates:', error);
                    this.showToast('Lỗi khi dọn dẹp proxy trùng lặp: ' + error.message, 'error');
                } finally {
                    this.showLoading(false);
                }
            }
        });

        safeAddEventListener('addProxyForm', 'submit', (e) => {
            e.preventDefault();
            this.addProxy();
        });

        safeAddEventListener('importProxiesBtn', 'click', () => {
            this.importCheckedProxies();
        });

        // Select all checkbox
        safeAddEventListener('selectAllProfiles', 'change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        safeAddEventListener('selectAllProxies', 'change', (e) => {
            this.toggleSelectAllProxies(e.target.checked);
        });

        // Action buttons in search filter bar
        safeAddEventListener('openSelectedBtn', 'click', () => {
            this.openSelectedProfiles();
        });

        safeAddEventListener('closeSelectedBtn', 'click', () => {
            this.closeSelectedProfiles();
        });

        safeAddEventListener('editProfileBtn', 'click', () => {
            this.toggleEditDropdown();
        });

        // Edit Profile Dropdown Events
        safeAddEventListener('editCardsBtn', 'click', () => {
            this.showEditCardsModal();
        });

        safeAddEventListener('editGroupsBtn', 'click', () => {
            this.showEditGroupsModal();
        });

        safeAddEventListener('editBookmarksBtn', 'click', () => {
            this.showEditBookmarksModal();
        });

        safeAddEventListener('editTabsBtn', 'click', () => {
            this.showEditTabsModal();
        });

        safeAddEventListener('bulkImportProxyBtn', 'click', () => {
            this.showBulkImportProxyModal();
        });
        // Apply changes events
        safeAddEventListener('applyCardChanges', 'click', () => {
            this.applyCardChanges();
        });

        safeAddEventListener('applyGroupChanges', 'click', () => {
            this.applyGroupChanges();
        });

        safeAddEventListener('applyBookmarks', 'click', () => {
            this.applyBookmarks();
        });

        safeAddEventListener('applyTabs', 'click', () => {
            this.applyTabs();
        });

        safeAddEventListener('applyBulkProxyChanges', 'click', () => {
            this.applyBulkProxyChanges();
        });

        safeAddEventListener('confirmRemoveProxyBtn', 'click', () => {
            this.confirmRemoveProxy();
        });

        safeAddEventListener('cancelRemoveProxyBtn', 'click', () => {
            this.hideModal('removeProxyModal');
        });

        // Create new items for profiles
        safeAddEventListener('createNewCardForProfiles', 'click', () => {
            this.showAddCardModal(true);
        });

        safeAddEventListener('createNewGroupForProfiles', 'click', () => {
            this.showModal('createGroupModal');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('editProfileDropdown');
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });

        safeAddEventListener('deleteSelectedProfilesBtn', 'click', () => {
            this.deleteSelectedProfiles();
        });

        // Card management events
        safeAddEventListener('addCardBtn', 'click', () => {
            this.showModal('cardManagementModal');
        });

        safeAddEventListener('addNewCardBtn', 'click', () => {
            this.showAddCardModal();
        });

        safeAddEventListener('addCardForm', 'submit', (e) => {
            e.preventDefault();
            this.saveCard();
        });

        // Proxy tabs events - Use direct binding for better responsiveness
        safeAddEventListener('createProfileModal', 'click', (e) => {
            if (e.target.classList.contains('proxy-tab')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Immediate visual feedback
                this.handleProxyTabClick(e.target);
            }
        });

        // Proxy test and save buttons
        safeAddEventListener('testProxyBtn', 'click', () => {
            this.testProxyConnection();
        });

        safeAddEventListener('saveProxyBtn', 'click', () => {
            this.saveProxyToProfile();
        });

        safeAddEventListener('testTokenBtn', 'click', () => {
            this.testProxyToken();
        });

        safeAddEventListener('saveTokenBtn', 'click', () => {
            this.saveProxyTokenToProfile();
        });

        // Auto-parse proxy when pasting in Host IP field
        safeAddEventListener('proxyHost', 'paste', (e) => {
            // Small delay to let paste complete
            setTimeout(() => {
                this.autoParseProxyInput();
            }, 100);
        });

        safeAddEventListener('proxyHost', 'blur', () => {
            this.autoParseProxyInput();
        });

        // Existing proxy events
        safeAddEventListener('refreshProxyListBtn', 'click', () => {
            this.forceRefreshProxyCache();
        });

        safeAddEventListener('testSelectedProxyBtn', 'click', () => {
            this.testSelectedProxy();
        });

        safeAddEventListener('proxySearchInput', 'input', (e) => {
            this.filterProxyList(e.target.value);
        });

        // Menu events từ main process
        if (window.electronAPI && window.electronAPI.onMenuCreateProfile) {
            window.electronAPI.onMenuCreateProfile(() => {
                this.showModal('createProfileModal');
            });
        }

        if (window.electronAPI && window.electronAPI.onMenuManageExtensions) {
            window.electronAPI.onMenuManageExtensions(() => {
                this.switchTab('extensions');
            });
        }

        if (window.electronAPI && window.electronAPI.onMenuCheckProxies) {
            window.electronAPI.onMenuCheckProxies(() => {
                // this.checkAllProxies(); // Disabled - removed check all functionality
                this.showToast('Chức năng check all đã được tắt', 'info');
            });
        }

        // Extension events
        safeAddEventListener('addExtensionBtn', 'click', () => {
            this.showAddExtensionModal();
        });

        // Proxy modal events
        this.setupProxyModalEvents();
    }

    setupProxyModalEvents() {
        // Proxy mode tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchProxyMode(e.target.dataset.mode);
            });
        });

        // Bulk proxy form
        document.getElementById('bulkProxyForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.bulkImportProxies();
        });

        // Check Proxies button (dynamic)
        document.getElementById('checkProxiesBtn').addEventListener('click', () => {
            this.checkAndPreviewProxies();
        });

        // Real-time input changes
        document.getElementById('proxyList').addEventListener('input', () => {
            this.resetProxyCheckState();
        });

        // Check proxy buttons
        document.getElementById('checkSelectedProxiesBtn').addEventListener('click', () => {
            this.checkSelectedProxies();
        });
    }

    setupSearchAndFilter() {
        const searchInput = document.getElementById('profileSearch');
        const proxyFilter = document.getElementById('proxyFilter');

        // Debounced search
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterProfiles();
            }, 300);
        });

        proxyFilter.addEventListener('change', () => {
            this.filterProfiles();
        });
    }

    setupBulkActions() {
        // Bulk action handlers
        document.getElementById('bulkStart').addEventListener('click', () => {
            this.bulkStartProfiles();
        });

        document.getElementById('bulkStartSimple').addEventListener('click', () => {
            this.bulkStartProfilesSimple();
        });

        document.getElementById('bulkStartPAC').addEventListener('click', () => {
            this.bulkStartProfilesWithPAC();
        });

        document.getElementById('bulkStartPuppeteer').addEventListener('click', () => {
            this.bulkStartProfilesWithPuppeteer();
        });

        document.getElementById('bulkStop').addEventListener('click', () => {
            this.bulkStopProfiles();
        });

        document.getElementById('bulkExport').addEventListener('click', () => {
            this.bulkExportProfiles();
        });

        document.getElementById('bulkClone').addEventListener('click', () => {
            this.bulkCloneProfiles();
        });

        document.getElementById('bulkAssignProxy').addEventListener('click', () => {
            this.bulkAssignProxy();
        });

        document.getElementById('bulkDelete').addEventListener('click', () => {
            this.bulkDeleteProfiles();
        });
    }

    filterProfiles() {
        const searchInput = document.getElementById('profileSearch');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const proxyFilterElement = document.getElementById('proxyFilter');
        const proxyFilter = proxyFilterElement ? proxyFilterElement.value : '';

        this.filteredProfiles = this.profiles.filter(profile => {
            // Search filter
            const matchesSearch = !searchTerm || 
                (profile.name && profile.name.toLowerCase().includes(searchTerm));

            // Proxy filter
            const hasProxy = profile.proxy && this.proxies.find(p => p.id === profile.proxy);
            const matchesProxy = !proxyFilter ||
                (proxyFilter === 'with-proxy' && hasProxy) ||
                (proxyFilter === 'no-proxy' && !hasProxy);

            return matchesSearch && matchesProxy;
        });

        this.renderProfiles();
    }

    toggleSelectAll(checked) {
        this.selectedProfiles.clear();
        
        if (checked) {
            this.filteredProfiles.forEach(profile => {
                this.selectedProfiles.add(profile.id);
            });
        }

        this.updateProfileSelection();
        this.updateBulkActionsButton();
    }

    toggleProfileSelection(profileId, checked) {
        if (checked) {
            this.selectedProfiles.add(profileId);
        } else {
            this.selectedProfiles.delete(profileId);
        }

        this.updateBulkActionsButton();
        this.updateSelectAllState();
    }

    updateProfileSelection() {
        // Update all profile checkboxes
        document.querySelectorAll('.profile-checkbox').forEach(checkbox => {
            const profileId = checkbox.dataset.profileId;
            checkbox.checked = this.selectedProfiles.has(profileId);
            
            // Update row styling
            const row = checkbox.closest('tr');
            if (checkbox.checked) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
    }

    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('selectAllProfiles');
        const totalFilteredProfiles = this.filteredProfiles.length;
        const selectedCount = this.selectedProfiles.size;

        if (selectedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCount === totalFilteredProfiles) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    updateBulkActionsButton() {
        const bulkBtn = document.getElementById('bulkActionsBtn');
        const editDropdown = document.getElementById('editProfileDropdown');
        const startBtn = document.getElementById('openSelectedBtn');
        const stopBtn = document.getElementById('closeSelectedBtn');
        const deleteBtn = document.getElementById('deleteSelectedProfilesBtn');
        
        if (this.selectedProfiles.size > 0) {
            // Show all buttons when profiles are selected
            [bulkBtn, editDropdown, startBtn, stopBtn, deleteBtn].forEach(btn => {
                if (btn) {
                    btn.style.display = 'inline-flex';
                    btn.disabled = false;
                }
            });
            
            if (bulkBtn) {
                bulkBtn.innerHTML = `<i class="fas fa-tasks"></i> Actions (${this.selectedProfiles.size})`;
            }
        } else {
            // Hide all buttons when no profiles are selected
            [bulkBtn, editDropdown, startBtn, stopBtn, deleteBtn].forEach(btn => {
                if (btn) {
                    btn.style.display = 'none';
                    btn.disabled = true;
                }
            });
        }
    }

    showBulkActionsModal() {
        const selectedCount = document.getElementById('selectedCount');
        if (selectedCount) {
            selectedCount.textContent = this.selectedProfiles.size;
        }
        
        // Update bulk proxy select
        const bulkProxySelect = document.getElementById('bulkProxySelect');
        bulkProxySelect.innerHTML = '<option value="">Choose proxy for selected profiles</option>';
        this.proxies.forEach(proxy => {
            const option = document.createElement('option');
            option.value = proxy.id;
            
            // Get usage count for this proxy
            const usageCount = this.getProxyUsageCount(proxy.id);
            const usageText = usageCount > 0 ? ` [${usageCount} đang dùng]` : '';
            
            option.textContent = `${proxy.host}:${proxy.port} (${proxy.type.toUpperCase()})${usageText}`;
            bulkProxySelect.appendChild(option);
        });

        this.showModal('bulkActionsModal');
    }

    setupTabNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabName = item.dataset.tab;
                this.switchTab(tabName);
                
                // Update active nav item
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    setupModals() {
        // Modal close handlers
        document.querySelectorAll('.modal-close, .modal-cancel, .modal-btn-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.hideModal(modal.id);
            });
        });

        // Click outside to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}-tab`);
        if (selectedTab) {
            selectedTab.classList.add('active');
            this.currentTab = tabName;
        }

        // Show/hide sidebar based on tab
        const sidebar = document.querySelector('.groups-sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (sidebar && mainContent) {
            if (tabName === 'profiles') {
                sidebar.style.transform = 'translateX(0)';
                mainContent.style.marginLeft = '250px';
            } else {
                sidebar.style.transform = 'translateX(-100%)';
                mainContent.style.marginLeft = '0';
            }
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        
        // Update group select for create profile modal
        if (modalId === 'createProfileModal') {
            this.updateProfileGroupSelect();
            this.updateProfileCardSelect();
            
            // Pre-load proxy data in background for better UX
            this.preloadProxyDataForModal();
        }
        
        // Focus first input
        const firstInput = modal.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
        
        // Clear form
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }

    showConfirm(message, title = 'Xác nhận', type = 'warning') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const titleElement = document.getElementById('confirmTitle');
            const messageElement = document.getElementById('confirmMessage');
            const okButton = document.getElementById('confirmOk');
            const cancelButton = document.getElementById('confirmCancel');

            // Set content
            titleElement.textContent = title;
            messageElement.textContent = message;

            // Set modal style based on type
            modal.className = 'modal';
            if (type === 'warning') {
                modal.classList.add('warning');
            }

            // Remove previous event listeners
            const newOkButton = okButton.cloneNode(true);
            const newCancelButton = cancelButton.cloneNode(true);
            okButton.parentNode.replaceChild(newOkButton, okButton);
            cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);

            // Add event listeners
            newOkButton.addEventListener('click', () => {
                modal.classList.remove('show');
                resolve(true);
            });

            newCancelButton.addEventListener('click', () => {
                modal.classList.remove('show');
                resolve(false);
            });

            // Handle ESC key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    modal.classList.remove('show');
                    document.removeEventListener('keydown', handleEscape);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Show modal
            modal.classList.add('show');

            // Focus OK button for keyboard navigation
            setTimeout(() => newOkButton.focus(), 100);
        });
    }

    showLoading(show = true) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fa-check-circle' : 
                    type === 'error' ? 'fa-exclamation-circle' :
                    type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
        
        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <div class="toast-message">${message}</div>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    async loadData() {
        try {
            this.showLoading(true);
            
            // Load profiles, proxies and extensions
            [this.profiles, this.proxies, this.extensions] = await Promise.all([
                window.electronAPI.getProfiles(),
                window.electronAPI.getProxies(),
                window.electronAPI.getExtensions()
            ]);
            
            // Load groups from localStorage
            const savedGroups = localStorage.getItem('chromeManager_groups');
            if (savedGroups) {
                this.groups = JSON.parse(savedGroups);
            }

            // Load cards from localStorage
            this.loadCards();
            
            // Initialize filtered profiles
            this.filteredProfiles = [...this.profiles];
            
            // Check for and clean up duplicate proxies on startup
            await this.checkAndCleanupDuplicatesOnStartup();
            
            this.renderProfiles();
            this.renderProxies();
            this.renderExtensions();
            this.updateProxySelect();
            this.renderGroupFilter();
            this.updateGroupCounts();
            this.updateProfileGroupSelect();
            this.updateProfileCardSelect();
            this.renderGroupsSidebar();
            this.renderCards();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Lỗi khi tải dữ liệu: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadProxies() {
        try {
            // Load only proxies
            this.proxies = await window.electronAPI.getProxies();
            
            // Update cache when loading proxies
            this.proxiesCache.data = this.proxies;
            this.proxiesCache.lastUpdated = Date.now();
            
            this.renderProxies();
            this.updateProxySelect();
            
        } catch (error) {
            console.error('Error loading proxies:', error);
            this.showToast('Lỗi khi tải proxies: ' + error.message, 'error');
        }
    }

    // Template Methods
    async createFromTemplate(templateKey) {
        const template = this.templates[templateKey];
        if (!template) {
            this.showToast('Template không tìm thấy', 'error');
            return;
        }

        try {
            this.showLoading(true);
            
            const profileData = {
                name: `${template.name} ${Date.now()}`,
                proxy: null,
                template: templateKey,
                settings: template.settings
            };

            const result = await window.electronAPI.createChromeProfile(profileData);
            
            if (result.success) {
                this.profiles.push(result.profile);
                this.filteredProfiles = [...this.profiles];
                this.renderProfiles();
                this.updateStats();
                this.refreshProxyUsageCounts(); // Update proxy usage counts
                this.hideModal('templatesModal');
                this.showToast(`Profile "${profileData.name}" đã được tạo từ template!`);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Error creating profile from template:', error);
            this.showToast('Lỗi khi tạo profile từ template: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Bulk Action Methods
    async bulkStartProfiles() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        if (selectedProfiles.length === 0) return;

        this.showLoading(true);
        let successCount = 0;

        for (const profileId of selectedProfiles) {
            try {
                const profile = this.profiles.find(p => p.id === profileId);
                if (!profile) continue;

                const isRunning = Array.from(this.runningInstances.values())
                    .some(instance => instance.profile.id === profileId);
                
                if (!isRunning) {
                    let proxyConfig = null;
                    if (profile.proxy) {
                        proxyConfig = this.proxies.find(p => p.id === profile.proxy);
                    }

                    // Launch Chrome without validation
                    const skipValidation = false;

                    // Use the validation method with setting
                    const result = await window.electronAPI.launchChrome(profileId, proxyConfig, skipValidation);
                    if (result.success) {
                        this.runningInstances.set(result.instanceId, {
                            id: result.instanceId,
                            profile: profile,
                            proxy: proxyConfig,
                            startTime: new Date()
                        });
                        successCount++;
                    }
                }
            } catch (error) {
                console.error('Error starting profile:', error);
            }
        }

        this.renderProfiles();
        this.renderRunningInstances();
        this.updateStats();
        this.hideModal('bulkActionsModal');
        this.showLoading(false);
        this.showToast(`Đã khởi chạy ${successCount}/${selectedProfiles.length} profiles`, 'success');
    }

    // Bulk start profiles với Puppeteer (tự động xử lý proxy auth)
    async bulkStartProfilesWithPuppeteer() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        if (selectedProfiles.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile', 'warning');
            return;
        }

        this.showLoading(true);
        let successCount = 0;

        for (const profileId of selectedProfiles) {
            try {
                const profile = this.profiles.find(p => p.id === profileId);
                if (!profile) continue;

                const isRunning = Array.from(this.runningInstances.values())
                    .some(instance => instance.profile.id === profileId);
                
                if (!isRunning) {
                    let proxyConfig = null;
                    if (profile.proxy) {
                        proxyConfig = this.proxies.find(p => p.id === profile.proxy);
                    }

                    console.log(`🎭 Starting profile with Puppeteer: ${profile.name}`);

                    // Sử dụng Puppeteer approach
                    const result = await window.api.launchChromeWithPuppeteer(profileId, proxyConfig);
                    
                    if (result.success) {
                        this.runningInstances.set(result.instanceId, {
                            id: result.instanceId,
                            profile: profile,
                            proxy: proxyConfig,
                            startTime: new Date(),
                            method: 'puppeteer'
                        });
                        successCount++;
                        
                        this.showToast(`✅ ${profile.name} - Puppeteer với auto proxy auth`, 'success');
                    } else {
                        this.showToast(`❌ ${profile.name} - ${result.error}`, 'error');
                    }
                } else {
                    this.showToast(`⚠️ ${profile.name} đã đang chạy`, 'warning');
                }

                // Delay nhỏ giữa các launches
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error('Error starting profile with Puppeteer:', error);
                this.showToast(`❌ ${profile.name} - ${error.message}`, 'error');
            }
        }

        this.renderProfiles();
        this.renderRunningInstances();
        this.updateStats();
        this.hideModal('bulkActionsModal');
        this.showLoading(false);
        this.showToast(`🎭 Đã khởi chạy ${successCount}/${selectedProfiles.length} profiles với Puppeteer`, 'success');
    }

    // Bulk start profiles với Simple Environment Variables (working method!)
    async bulkStartProfilesSimple() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        if (selectedProfiles.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile', 'warning');
            return;
        }

        this.showLoading(true);
        let successCount = 0;

        for (const profileId of selectedProfiles) {
            try {
                const profile = this.profiles.find(p => p.id === profileId);
                if (!profile) continue;

                const isRunning = Array.from(this.runningInstances.values())
                    .some(instance => instance.profile.id === profileId);
                
                if (!isRunning) {
                    let proxyConfig = null;
                    if (profile.proxy) {
                        proxyConfig = this.proxies.find(p => p.id === profile.proxy);
                    }

                    console.log(`🚀 Starting profile with Simple Env: ${profile.name}`);

                    // Sử dụng Simple Environment approach (đã test thành công!)
                    const result = await window.api.launchChromeSimple(profileId, proxyConfig);
                    
                    if (result.success) {
                        this.runningInstances.set(result.instanceId, {
                            id: result.instanceId,
                            profile: profile,
                            proxy: proxyConfig,
                            startTime: new Date(),
                            method: 'simple-env'
                        });
                        successCount++;
                        
                        this.showToast(`🚀 ${profile.name} - Simple Environment Auth`, 'success');
                    } else {
                        this.showToast(`❌ ${profile.name} - ${result.error}`, 'error');
                    }
                } else {
                    this.showToast(`⚠️ ${profile.name} đã đang chạy`, 'warning');
                }

                // Delay nhỏ giữa các launches
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error('Error starting profile with Simple Env:', error);
                this.showToast(`❌ ${profile.name} - ${error.message}`, 'error');
            }
        }

        this.renderProfiles();
        this.renderRunningInstances();
        this.updateStats();
        this.hideModal('bulkActionsModal');
        this.showLoading(false);
        this.showToast(`🚀 Đã khởi chạy ${successCount}/${selectedProfiles.length} profiles với Simple Environment Auth`, 'success');
    }

    // Bulk start profiles với PAC file (Enterprise Method - Phổ Thông Nhất!)
    async bulkStartProfilesWithPAC() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        if (selectedProfiles.length === 0) return;

        this.showLoading(true);
        let successCount = 0;

        for (const profileId of selectedProfiles) {
            try {
                const profile = this.profiles.find(p => p.id === profileId);
                if (!profile) continue;

                const proxyConfig = this.getSelectedProxy(profile);
                if (proxyConfig) {
                    console.log(`🚀 Starting profile with PAC file: ${profile.name}`);
                    
                    // Skip validation để startup nhanh hơn
                    const result = await window.electronAPI.launchChromeWithPAC(
                        profileId, 
                        proxyConfig,
                        true // skip validation
                    );
                    
                    if (result.success) {
                        successCount++;
                        this.runningInstances.set(result.instanceId, {
                            profile: profile,
                            proxy: proxyConfig,
                            method: 'pac-file',
                            startTime: new Date()
                        });
                        this.showToast(`✅ ${profile.name} - Started với PAC file`, 'success');
                    } else {
                        this.showToast(`❌ ${profile.name} - ${result.error}`, 'error');
                    }
                }

                // Delay nhỏ giữa các launches
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error('Error starting profile with PAC file:', error);
                this.showToast(`❌ ${profile.name} - ${error.message}`, 'error');
            }
        }

        this.renderProfiles();
        this.renderRunningInstances();
        this.updateStats();
        this.hideModal('bulkActionsModal');
        this.showLoading(false);
        this.showToast(`🚀 Đã khởi chạy ${successCount}/${selectedProfiles.length} profiles với PAC File (Enterprise Standard)`, 'success');
    }

    async bulkStopProfiles() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        if (selectedProfiles.length === 0) return;

        this.showLoading(true);
        let successCount = 0;

        for (const profileId of selectedProfiles) {
            try {
                // Find running instance for this profile
                for (const [instanceId, instance] of this.runningInstances) {
                    if (instance.profile.id === profileId) {
                        const result = await window.electronAPI.stopChrome(instanceId);
                        if (result.success) {
                            this.runningInstances.delete(instanceId);
                            successCount++;
                        }
                        break;
                    }
                }
            } catch (error) {
                console.error('Error stopping profile:', error);
            }
        }

        this.renderProfiles();
        this.renderRunningInstances();
        this.updateStats();
        this.hideModal('bulkActionsModal');
        this.showLoading(false);
        this.showToast(`Đã dừng ${successCount} Chrome instances`, 'success');
    }

    bulkExportProfiles() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        if (selectedProfiles.length === 0) return;

        const exportData = this.profiles.filter(p => selectedProfiles.includes(p.id));
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `chrome-profiles-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        this.hideModal('bulkActionsModal');
        this.showToast(`Đã export ${selectedProfiles.length} profiles`, 'success');
    }

    async bulkCloneProfiles() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        if (selectedProfiles.length === 0) return;

        this.showLoading(true);
        let successCount = 0;

        for (const profileId of selectedProfiles) {
            try {
                const originalProfile = this.profiles.find(p => p.id === profileId);
                if (!originalProfile) continue;

                const clonedProfileData = {
                    name: `${originalProfile.name} (Copy)`,
                    proxy: originalProfile.proxy,
                    template: originalProfile.template,
                    settings: originalProfile.settings
                };

                const result = await window.electronAPI.createChromeProfile(clonedProfileData);
                if (result.success) {
                    this.profiles.push(result.profile);
                    successCount++;
                }
            } catch (error) {
                console.error('Error cloning profile:', error);
            }
        }

        this.filteredProfiles = [...this.profiles];
        this.renderProfiles();
        this.updateStats();
        this.refreshProxyUsageCounts(); // Update proxy usage counts after cloning
        this.hideModal('bulkActionsModal');
        this.showLoading(false);
        this.showToast(`Đã clone ${successCount}/${selectedProfiles.length} profiles`, 'success');
    }

    async bulkAssignProxy() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        const bulkProxySelect = document.getElementById('bulkProxySelect');
        const proxyId = bulkProxySelect ? bulkProxySelect.value : '';
        
        if (selectedProfiles.length === 0 || !proxyId) {
            this.showToast('Vui lòng chọn proxy và profiles', 'warning');
            return;
        }

        this.showLoading(true);
        let successCount = 0;

        selectedProfiles.forEach(profileId => {
            const profile = this.profiles.find(p => p.id === profileId);
            if (profile) {
                profile.proxy = proxyId;
                successCount++;
            }
        });

        // Save profiles (simplified - should call backend)
        this.renderProfiles();
        this.renderProxies(); // Update proxy usage count
        this.renderExistingProxyList(); // Update existing proxy list
        this.hideModal('bulkActionsModal');
        this.showLoading(false);
        this.showToast(`Đã gán proxy cho ${successCount} profiles`, 'success');
    }

    async bulkDeleteProfiles() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        if (selectedProfiles.length === 0) return;

        const confirmMessage = `Bạn có chắc chắn muốn xóa ${selectedProfiles.length} profiles được chọn?\n\n⚠️ CẢNH BÁO: Tất cả dữ liệu Chrome của các profiles này sẽ bị xóa vĩnh viễn!\nHành động này KHÔNG THỂ HOÀN TÁC!`;

        if (confirm(confirmMessage)) {
            try {
                this.showLoading(true, `Đang xóa ${selectedProfiles.length} profiles...`);
                
                let successCount = 0;
                let errors = [];

                // Xóa từng profile một cách tuần tự
                for (const profileId of selectedProfiles) {
                    try {
                        const result = await window.electronAPI.deleteProfile(profileId);
                        if (result.success) {
                            successCount++;
                        } else {
                            errors.push(`Profile ${profileId}: ${result.error}`);
                        }
                    } catch (error) {
                        errors.push(`Profile ${profileId}: ${error.message}`);
                    }
                }

                // Cập nhật UI
                this.profiles = this.profiles.filter(p => !selectedProfiles.includes(p.id));
                this.filteredProfiles = [...this.profiles];
                this.selectedProfiles.clear();
                
                this.renderProfiles();
                this.refreshProxyUsageCounts(); // Update proxy usage counts using new method
                this.updateStats();
                this.updateBulkActionsButton();
                this.hideModal('bulkActionsModal');

                // Hiển thị kết quả
                if (successCount === selectedProfiles.length) {
                    this.showToast(`Đã xóa hoàn toàn ${successCount} profiles và dữ liệu Chrome`, 'success');
                } else {
                    this.showToast(`Xóa thành công ${successCount}/${selectedProfiles.length} profiles. Có lỗi với ${errors.length} profiles.`, 'warning');
                    if (errors.length > 0) {
                        console.error('Bulk delete errors:', errors);
                        // Show detailed errors for debugging
                        alert(`Chi tiết lỗi:\n${errors.join('\n')}`);
                    }
                }

            } catch (error) {
                console.error('Error in bulk delete:', error);
                this.showToast('Lỗi khi xóa profiles: ' + error.message, 'error');
            } finally {
                this.showLoading(false);
            }
        }
    }

    updateStats() {
        const profileCountEl = document.getElementById('profileCount');
        const proxyCountEl = document.getElementById('proxyCount');
        const runningCountEl = document.getElementById('runningCount');
        
        if (profileCountEl) profileCountEl.textContent = this.profiles.length;
        if (proxyCountEl) proxyCountEl.textContent = this.proxies.length;
        if (runningCountEl) runningCountEl.textContent = this.runningInstances.size;
    }

    renderProfiles() {
        const tbody = document.getElementById('profilesTableBody');
        // Use filteredProfiles if filtering is active, otherwise use all profiles
        const profilesToRender = this.currentGroupFilter ? this.filteredProfiles : this.profiles;
        
        if (profilesToRender.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="profiles-empty">
                        <i class="fas fa-user-plus"></i>
                        <h3>${this.profiles.length === 0 ? 'Chưa có profile nào' : 'Không tìm thấy profile phù hợp'}</h3>
                        <p>${this.profiles.length === 0 ? 'Tạo profile đầu tiên để bắt đầu quản lý Chrome' : 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'}</p>
                        ${this.profiles.length === 0 ? `
                        ` : ''}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = profilesToRender.map((profile, index) => {
            const isRunning = Array.from(this.runningInstances.values())
                .some(instance => instance.profile.id === profile.id && instance.isActive);
            
            // Get proxy info - check if profile.proxy is an object or ID
            let proxyInfo = null;
            if (profile.proxy) {
                if (typeof profile.proxy === 'object') {
                    // Direct proxy object
                    proxyInfo = profile.proxy;
                } else {
                    // Proxy ID reference
                    proxyInfo = this.proxies.find(p => p.id === profile.proxy);
                }
            }

            // Get card info from profile
            const cardInfo = profile.cardId ? 
                this.cards.find(c => c.id === profile.cardId) : null;
            
            // Format date
            const createdDate = new Date(profile.created).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
            });

            const isSelected = this.selectedProfiles.has(profile.id);

            return `
                <tr class="${isSelected ? 'selected' : ''}" data-profile-id="${profile.id}">
                    <td>
                        <input type="checkbox" class="profile-checkbox" 
                               data-profile-id="${profile.id}" 
                               ${isSelected ? 'checked' : ''}
                               onchange="chromeManager.toggleProfileSelection('${profile.id}', this.checked)">
                    </td>
                    <td class="profile-stt">${index + 1}</td>
                    <td class="profile-name">${profile.name}</td>
                    <td class="profile-group">
                        ${this.getGroupBadgeHtml(profile.groupId)}
                    </td>
                    <td>
                        <div class="profile-card-info">
                            ${cardInfo ? 
                                `<span class="profile-card-name">${cardInfo.name}</span>` : 
                                '<span style="color: #9ca3af;">Không có</span>'
                            }
                        </div>
                    </td>
                    <td>
                        <div class="profile-extensions">
                            ${this.getProfileExtensionsHtml(profile)}
                        </div>
                    </td>
                    <td>
                        ${proxyInfo ? 
                            `<span class="profile-proxy">${proxyInfo.host}:${proxyInfo.port}</span>` : 
                            '<span style="color: #9ca3af;">Không có</span>'
                        }
                    </td>
                    <td class="profile-date">${createdDate}</td>
                    <td>
                        <div class="profile-actions">
                            <button class="btn ${isRunning ? 'btn-danger' : 'btn-success'} btn-sm" 
                                    id="btn-${profile.id}"
                                    onclick="chromeManager.${isRunning ? 'stopProfileInstance' : 'launchProfile'}('${profile.id}')">
                                <i class="fas ${isRunning ? 'fa-stop' : 'fa-play'}"></i>
                                ${isRunning ? 'Tắt' : 'Mở'}
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="chromeManager.deleteProfile('${profile.id}')">
                                <i class="fas fa-trash"></i> Xóa
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Update selection states
        this.updateSelectAllState();
    }

    getProfileExtensionsHtml(profile) {
        if (!profile.extensions || profile.extensions.length === 0) {
            return '<span style="color: #9ca3af; font-size: 12px;">Không có</span>';
        }

        const enabledExtensions = profile.extensions.filter(ext => ext.enabled);
        if (enabledExtensions.length === 0) {
            return '<span style="color: #9ca3af; font-size: 12px;">Không có</span>';
        }

        if (enabledExtensions.length <= 2) {
            return enabledExtensions.map(ext => 
                `<span class="extension-badge" title="${ext.name}">${ext.name}</span>`
            ).join(' ');
        } else {
            const firstTwo = enabledExtensions.slice(0, 2);
            const remaining = enabledExtensions.length - 2;
            
            return firstTwo.map(ext => 
                `<span class="extension-badge" title="${ext.name}">${ext.name}</span>`
            ).join(' ') + 
            ` <span class="extension-more" title="${enabledExtensions.slice(2).map(e => e.name).join(', ')}">+${remaining}</span>`;
        }
    }

    generateCardNumber() {
        // Generate a random card-like number for display purposes
        const prefixes = ['CN', 'VN', 'US', 'EU', 'AS'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const number = Math.floor(Math.random() * 900) + 100;
        return `${prefix} ${number}`;
    }

    async stopProfileInstance(profileId) {
        // Find running instance for this profile
        for (const [instanceId, instance] of this.runningInstances) {
            if (instance.profile.id === profileId) {
                await this.stopInstance(instanceId);
                break;
            }
        }
    }

    // Helper method to count how many profiles are using each proxy (REAL-TIME calculation)
    getProxyUsageCount(proxyId) {
        if (!this.profiles || !proxyId) return 0;
        
        const targetProxy = this.proxies.find(p => p.id === proxyId);
        if (!targetProxy) return 0;
        
        // Always calculate real-time from actual profiles
        return this.profiles.filter(profile => {
            // Check if profile has proxy and if it matches the target proxy
            if (!profile.proxy) return false;
            
            // Compare by host, port, username, password for exact match
            return profile.proxy.host === targetProxy.host && 
                   profile.proxy.port == targetProxy.port &&
                   (profile.proxy.username || '') === (targetProxy.username || '') &&
                   (profile.proxy.password || '') === (targetProxy.password || '');
        }).length;
    }

    // Helper method to refresh proxy usage counts in UI after profile changes
    refreshProxyUsageCounts() {
        // Update all proxy-related UI components that show usage counts
        this.renderProxies();
        this.renderExistingProxyList();
        this.updateProxySelect();
        console.log('Proxy usage counts refreshed after profile changes');
    }

    // Helper method to check if proxy exists and add it if not
    async ensureProxyExists(proxyConfig, showToast = true) {
        if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) {
            return proxyConfig;
        }

        // Check if proxy already exists (check host, port, username, password for exact match)
        const existingProxy = this.proxies.find(proxy => 
            proxy.host === proxyConfig.host && 
            proxy.port == proxyConfig.port &&
            (proxy.username || '') === (proxyConfig.username || '') &&
            (proxy.password || '') === (proxyConfig.password || '')
        );

        if (existingProxy) {
            console.log('Proxy already exists:', existingProxy.id);
            
            // Update last used time
            existingProxy.lastUsed = new Date().toISOString();
            
            // Save updated proxy to backend
            if (window.electronAPI && window.electronAPI.updateProxy) {
                try {
                    await window.electronAPI.updateProxy(existingProxy);
                    console.log('Updated last used time for existing proxy:', existingProxy.id);
                } catch (error) {
                    console.error('Failed to update proxy:', error);
                }
            }
            
            // Update UI to reflect changes (usage count will be calculated real-time)
            this.renderProxies();
            this.renderExistingProxyList();
            this.updateProxySelect();
            
            if (showToast) {
                const currentUsage = this.getProxyUsageCount(existingProxy.id);
                this.showToast(`Proxy ${proxyConfig.host}:${proxyConfig.port} đã tồn tại (đang dùng: ${currentUsage})`, 'info');
            }
            
            return proxyConfig;
        }

        // Proxy doesn't exist, add it to the proxy list
        console.log('Adding new proxy to management:', proxyConfig);
        
        try {
            const newProxy = {
                id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
                host: proxyConfig.host,
                port: proxyConfig.port,
                type: proxyConfig.type || 'http',
                username: proxyConfig.username || '',
                password: proxyConfig.password || '',
                status: 'unchecked',
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            };

            // Add to proxy list
            this.proxies.push(newProxy);
            
            // Save to backend if available
            if (window.electronAPI && window.electronAPI.addProxy) {
                const result = await window.electronAPI.addProxy(newProxy);
                if (result.success) {
                    console.log('Proxy added successfully to backend');
                } else {
                    console.error('Failed to add proxy to backend:', result.error);
                }
            }

            // Update UI
            this.renderProxies();
            this.renderExistingProxyList();
            this.updateProxySelect();
            this.updateStats();
            
            if (showToast) {
                this.showToast(`Đã thêm proxy ${proxyConfig.host}:${proxyConfig.port} vào quản lý`, 'success');
            }
            
            return proxyConfig;
            
        } catch (error) {
            console.error('Error adding proxy:', error);
            if (showToast) {
                this.showToast('Lỗi khi thêm proxy vào quản lý: ' + error.message, 'warning');
            }
            return proxyConfig;
        }
    }

    // Helper method to clean up duplicate proxies
    async cleanupDuplicateProxies() {
        console.log('Starting cleanup of duplicate proxies...');
        
        const uniqueProxies = new Map();
        const duplicatesToRemove = [];
        
        // Find duplicates and keep the best one
        this.proxies.forEach(proxy => {
            const key = `${proxy.host}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`;
            
            if (uniqueProxies.has(key)) {
                const existingProxy = uniqueProxies.get(key);
                
                // Keep the newer lastUsed date
                if (proxy.lastUsed && (!existingProxy.lastUsed || proxy.lastUsed > existingProxy.lastUsed)) {
                    existingProxy.lastUsed = proxy.lastUsed;
                }
                
                // Keep the better status (working > unchecked > error)
                const statusPriority = { 'working': 3, 'unchecked': 2, 'error': 1, 'timeout': 1 };
                const existingPriority = statusPriority[existingProxy.status] || 0;
                const currentPriority = statusPriority[proxy.status] || 0;
                
                if (currentPriority > existingPriority) {
                    existingProxy.status = proxy.status;
                    if (proxy.responseTime) {
                        existingProxy.responseTime = proxy.responseTime;
                    }
                    if (proxy.ip) {
                        existingProxy.ip = proxy.ip;
                    }
                    if (proxy.lastChecked) {
                        existingProxy.lastChecked = proxy.lastChecked;
                    }
                }
                
                // Mark this proxy for removal
                duplicatesToRemove.push(proxy.id);
                console.log(`Found duplicate proxy: ${key}, will remove duplicate ID: ${proxy.id}`);
                
            } else {
                // First occurrence of this proxy
                uniqueProxies.set(key, proxy);
            }
        });
        
        if (duplicatesToRemove.length === 0) {
            console.log('No duplicate proxies found.');
            return {
                cleaned: 0,
                remaining: this.proxies.length
            };
        }
        
        // Remove duplicates from the array
        this.proxies = this.proxies.filter(proxy => !duplicatesToRemove.includes(proxy.id));
        
        // Save updated proxies to backend
        if (window.electronAPI && window.electronAPI.saveProxies) {
            try {
                await window.electronAPI.saveProxies(this.proxies);
                console.log(`Cleaned up ${duplicatesToRemove.length} duplicate proxies`);
            } catch (error) {
                console.error('Failed to save cleaned proxies:', error);
            }
        }
        
        // Update UI
        this.renderProxies();
        this.renderExistingProxyList();
        this.updateProxySelect();
        this.updateStats();
        
        return {
            cleaned: duplicatesToRemove.length,
            remaining: this.proxies.length
        };
    }

    // Check and cleanup duplicates on startup (silent mode)
    async checkAndCleanupDuplicatesOnStartup() {
        const duplicateKeys = new Set();
        const seenKeys = new Set();
        
        // Check for duplicates
        this.proxies.forEach(proxy => {
            const key = `${proxy.host}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`;
            if (seenKeys.has(key)) {
                duplicateKeys.add(key);
            } else {
                seenKeys.add(key);
            }
        });
        
        if (duplicateKeys.size > 0) {
            console.log(`Found ${duplicateKeys.size} types of duplicate proxies on startup. Auto-cleaning...`);
            try {
                const result = await this.cleanupDuplicateProxies();
                console.log(`Startup cleanup completed: ${result.cleaned} duplicates removed, ${result.remaining} unique proxies remaining`);
            } catch (error) {
                console.error('Error during startup cleanup:', error);
            }
        }
    }

    renderProxies() {
        const tbody = document.getElementById('proxiesTableBody');
        
        if (this.proxies.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem;">
                        <i class="fas fa-network-wired" style="font-size: 2rem; color: #d1d5db; margin-bottom: 0.5rem;"></i>
                        <p>Chưa có proxy nào. Thêm proxy để bắt đầu.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.proxies.map(proxy => {
            const isSelected = this.selectedProxies.has(proxy.id);
            
            // Determine status display
            let statusHtml = '';
            const status = proxy.status || 'unchecked';
            
            switch (status) {
                case 'working':
                    statusHtml = `<span class="proxy-status working">
                        <i class="fas fa-check-circle"></i> Online
                    </span>`;
                    if (proxy.responseTime) {
                        statusHtml += `<span class="proxy-response-time">${proxy.responseTime}ms</span>`;
                    }
                    break;
                case 'error':
                    statusHtml = `<span class="proxy-status error" title="${proxy.error || 'Connection error'}">
                        <i class="fas fa-times-circle"></i> Error
                    </span>`;
                    break;
                case 'timeout':
                    statusHtml = `<span class="proxy-status timeout">
                        <i class="fas fa-clock"></i> Timeout
                    </span>`;
                    break;
                case 'checking':
                    statusHtml = `<span class="proxy-status checking">
                        <i class="fas fa-spinner fa-spin"></i> Checking...
                    </span>`;
                    break;
                default:
                    statusHtml = `<span class="proxy-status unchecked">
                        <i class="fas fa-question-circle"></i> Unchecked
                    </span>`;
            }
            
            // Get usage count for this proxy
            const usageCount = this.getProxyUsageCount(proxy.id);
            
            return `
            <tr class="${isSelected ? 'selected' : ''}" data-proxy-id="${proxy.id}">
                <td>
                    <input type="checkbox" class="proxy-checkbox" 
                           data-proxy-id="${proxy.id}" 
                           ${isSelected ? 'checked' : ''}
                           onchange="chromeManager.toggleProxySelection('${proxy.id}', this.checked)">
                </td>
                <td>${proxy.host}</td>
                <td>${proxy.port}</td>
                <td>${proxy.username || 'N/A'}</td>
                <td>${proxy.type.toUpperCase()}</td>
                <td class="proxy-status-cell">
                    ${statusHtml}
                </td>
                <td class="proxy-usage-cell">
                    <span class="proxy-usage-count" title="${usageCount} profile(s) đang sử dụng proxy này">
                        ${usageCount}
                    </span>
                </td>
                <td>
                    <div class="proxy-actions">
                        <button class="btn btn-warning btn-sm" onclick="chromeManager.editProxy('${proxy.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="chromeManager.deleteProxy('${proxy.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        // Kiểm tra proxy status
        setTimeout(() => this.checkProxiesStatus(), 1000);
    }

    updateProxySelect() {
        const select = document.getElementById('profileProxy');
        if (!select) return;
        
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">Không sử dụng proxy</option>';
        
        this.proxies.forEach(proxy => {
            const option = document.createElement('option');
            option.value = proxy.id;
            
            // Get usage count for this proxy
            const usageCount = this.getProxyUsageCount(proxy.id);
            const usageText = usageCount > 0 ? ` [${usageCount} đang dùng]` : '';
            
            option.textContent = `${proxy.host}:${proxy.port} (${proxy.type.toUpperCase()})${usageText}`;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    }

    async createProfile() {
        try {
            this.showLoading(true);
            
            const form = document.getElementById('createProfileForm');
            if (!form) {
                throw new Error('Form không tồn tại');
            }
            
            const isEditMode = form.dataset.editMode === 'true';
            const editProfileId = form.dataset.editProfileId;
            
            const formData = new FormData(form);
            
            // Get form values with safe handling
            const profileNameRaw = formData.get('profileName');
            const profileName = profileNameRaw && typeof profileNameRaw === 'string' ? profileNameRaw.trim() : '';
            const profileCard = formData.get('profileCard') || '';
            const groupId = formData.get('profileGroup') || '';
            const notesRaw = formData.get('profileNotes');
            const notes = notesRaw && typeof notesRaw === 'string' ? notesRaw.trim() : '';

            // Get proxy configuration from active tab
            const activeProxyTab = document.querySelector('.proxy-tab.active');
            const proxyType = activeProxyTab ? activeProxyTab.dataset.proxyType : 'none';
            
            let proxyConfig = null;
            if (proxyType === 'common') {
                const proxyHost = formData.get('proxyHost') || '';
                const proxyPort = formData.get('proxyPort') || '';
                const proxyUsername = formData.get('proxyUsername') || '';
                const proxyPassword = formData.get('proxyPassword') || '';
                const proxyTypeSelect = formData.get('proxyType') || 'HTTP';
                
                console.log('Proxy form values:', { proxyHost, proxyPort, proxyUsername, proxyTypeSelect });
                
                if (proxyHost && proxyPort) {
                    // Ensure proxy type is lowercase for Chrome compatibility
                    let normalizedType = proxyTypeSelect.toLowerCase();
                    if (normalizedType === 'https') {
                        normalizedType = 'http'; // Chrome treats HTTPS proxy as HTTP
                    }
                    
                    proxyConfig = {
                        host: proxyHost.trim(),
                        port: proxyPort.trim(),
                        type: normalizedType,
                        username: proxyUsername.trim(),
                        password: proxyPassword.trim()
                    };
                    
                    console.log('Created proxy config:', proxyConfig);
                }
            } else if (proxyType === 'existing') {
                const selectedProxyId = formData.get('selectedProxyId') || document.getElementById('selectedProxyId')?.value;
                if (selectedProxyId) {
                    const selectedProxy = this.proxies.find(p => p.id === selectedProxyId);
                    if (selectedProxy) {
                        proxyConfig = {
                            host: selectedProxy.host,
                            port: selectedProxy.port,
                            type: selectedProxy.type.toLowerCase(),
                            username: selectedProxy.username || '',
                            password: selectedProxy.password || ''
                        };
                        console.log('Selected existing proxy:', proxyConfig);
                    }
                }
            }

            console.log('Form data debug:', {
                profileName,
                profileCard,
                groupId,
                proxyType,
                proxyConfig,
                notes
            });

            // Validation
            if (!profileName || profileName === '') {
                this.showFormError('profileName', 'Tên profile không được để trống');
                this.showLoading(false);
                return;
            }

            if (profileName.length < 3) {
                this.showFormError('profileName', 'Tên profile phải có ít nhất 3 ký tự');
                this.showLoading(false);
                return;
            }

            if (profileName.length > 50) {
                this.showFormError('profileName', 'Tên profile không được quá 50 ký tự');
                this.showLoading(false);
                return;
            }

            // Check if profile name already exists (skip if editing same profile)
            const nameExists = this.profiles.some(p => {
                if (!p || !p.name || typeof p.name !== 'string') return false;
                if (isEditMode && p.id === editProfileId) return false; // Skip current profile in edit mode
                return p.name.toLowerCase() === profileName.toLowerCase();
            });
            
            if (nameExists) {
                this.showFormError('profileName', 'Tên profile đã tồn tại. Vui lòng chọn tên khác');
                this.showLoading(false);
                return;
            }

            // Prepare profile data
            const profileData = {
                name: profileName,
                cardId: profileCard,
                notes: notes
            };

            // Add groupId only if it's not empty
            if (groupId && groupId.trim() !== '') {
                profileData.groupId = groupId.trim();
            }

            // Add proxy configuration if available
            if (proxyConfig) {
                // Ensure proxy exists in management, add if not
                await this.ensureProxyExists(proxyConfig);
                profileData.proxy = proxyConfig;
            }

            console.log('Profile data:', profileData);

            let result;
            if (isEditMode) {
                // Update existing profile
                result = await window.electronAPI.updateProfile(editProfileId, profileData);
                if (result.success) {
                    const profileIndex = this.profiles.findIndex(p => p.id === editProfileId);
                    if (profileIndex !== -1) {
                        this.profiles[profileIndex] = result.profile;
                    }
                    this.showToast(`Profile "${profileName}" đã được cập nhật thành công!`, 'success');
                }
            } else {
                // Create new profile
                result = await window.electronAPI.createChromeProfile(profileData);
                if (result.success) {
                    this.profiles.push(result.profile);
                    this.showToast(`Profile "${profileName}" đã được tạo thành công!`, 'success');
                }
            }
            
            if (result.success) {
                this.filteredProfiles = [...this.profiles];
                this.renderProfiles();
                this.refreshProxyUsageCounts(); // Update proxy usage counts using new method
                this.updateStats();
                this.updateGroupCounts();
                this.renderGroupFilter();
                this.renderGroupsSidebar();
                this.hideModal('createProfileModal');
                
                // Clear form and reset edit mode
                form.reset();
                form.removeAttribute('data-edit-mode');
                form.removeAttribute('data-edit-profile-id');
                const modalTitle = document.querySelector('#createProfileModal .modal-title');
                if (modalTitle) modalTitle.textContent = 'Tạo Profile Mới';
                this.clearFormErrors();
                
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Error creating/updating profile:', error);
            this.showToast('Lỗi khi xử lý profile: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showFormError(fieldName, message) {
        const field = document.getElementById(fieldName);
        if (!field) return;
        
        const formGroup = field.closest('.form-group');
        if (!formGroup) return;
        
        // Remove existing error
        this.clearFormErrors(fieldName);
        
        // Add error class
        formGroup.classList.add('error');
        
        // Add error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        if (field.parentNode) {
            field.parentNode.appendChild(errorDiv);
        }
        
        // Focus on field
        field.focus();
    }

    clearFormErrors(fieldName = null) {
        if (fieldName) {
            const field = document.getElementById(fieldName);
            const formGroup = field.closest('.form-group');
            formGroup.classList.remove('error');
            const errorMsg = formGroup.querySelector('.error-message');
            if (errorMsg) errorMsg.remove();
        } else {
            // Clear all errors
            document.querySelectorAll('.form-group.error').forEach(group => {
                group.classList.remove('error');
                const errorMsg = group.querySelector('.error-message');
                if (errorMsg) errorMsg.remove();
            });
        }
    }

    setupFormValidation() {
        const profileNameInput = document.getElementById('profileName');
        
        if (profileNameInput) {
            profileNameInput.addEventListener('input', (e) => {
                try {
                    const value = e.target.value ? e.target.value.trim() : '';
                    
                    // Clear previous errors
                    this.clearFormErrors('profileName');
                    
                    // Real-time validation
                    if (value.length > 0 && value.length < 3) {
                        this.showFormError('profileName', 'Tên profile phải có ít nhất 3 ký tự');
                    } else if (value.length > 50) {
                        this.showFormError('profileName', 'Tên profile không được quá 50 ký tự');
                    } else if (value && this.profiles.some(p => p.name && p.name.toLowerCase() === value.toLowerCase())) {
                        this.showFormError('profileName', 'Tên profile đã tồn tại');
                    } else if (value.length >= 3) {
                        // Valid input
                        e.target.classList.add('valid');
                    }
                } catch (error) {
                    console.error('Error in form validation:', error);
                }
            });

            profileNameInput.addEventListener('blur', (e) => {
                e.target.classList.remove('valid');
            });
        }
    }

    async addProxy() {
        try {
            this.showLoading(true);
            
            const formData = new FormData(document.getElementById('addProxyForm'));
            const proxyData = {
                host: formData.get('proxyHost'),
                port: parseInt(formData.get('proxyPort')),
                username: formData.get('proxyUsername') || '',
                password: formData.get('proxyPassword') || '',
                type: formData.get('proxyType')
            };

            const result = await window.electronAPI.addProxy(proxyData);
            
            if (result.success) {
                this.proxies.push(result.proxy);
                
                // Invalidate proxy cache since we added new data
                this.invalidateProxyCache();
                
                this.renderProxies();
                this.updateProxySelect();
                this.updateStats();
                this.hideModal('addProxyModal');
                this.showToast(`Proxy ${proxyData.host}:${proxyData.port} đã được thêm!`);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Error adding proxy:', error);
            this.showToast('Lỗi khi thêm proxy: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async importCheckedProxies() {
        if (!this.parsedProxyData || !this.parsedProxyData.validProxies.length) {
            this.showToast('Vui lòng kiểm tra proxies trước khi thêm', 'warning');
            return;
        }

        try {
            const proxiesToAdd = this.parsedProxyData.validProxies;
            
            for (const proxy of proxiesToAdd) {
                await window.electronAPI.addProxy(proxy);
            }
            
            this.showToast(`Đã thêm ${proxiesToAdd.length} proxy thành công`, 'success');
            
            // Reset form
            const proxyListElement = document.getElementById('proxyList');
            if (proxyListElement) {
                proxyListElement.value = '';
            }
            this.resetProxyCheckState();
            this.clearProxyPreview();
            
            // Close modal and refresh
            document.getElementById('bulkProxyModal').style.display = 'none';
            this.loadProxies();
            
        } catch (error) {
            console.error('Error importing proxies:', error);
            this.showToast('Lỗi khi thêm proxies: ' + error.message, 'error');
        }
    }

    // ============ PROXY STATUS CHECK FUNCTIONS ============

    async checkSelectedProxies() {
        const selectedProxies = Array.from(this.selectedProxies);
        
        if (selectedProxies.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một proxy để kiểm tra', 'warning');
            return;
        }

        const proxiesToCheck = this.proxies.filter(p => selectedProxies.includes(p.id));
        await this.checkProxiesBatch(proxiesToCheck);
    }

    // DISABLED: Removed check all functionality
    /*
    async checkAllProxies() {
        if (this.proxies.length === 0) {
            this.showToast('Không có proxy nào để kiểm tra', 'warning');
            return;
        }

        await this.checkProxiesBatch(this.proxies);
    }
    */

    async checkProxiesBatch(proxies) {
        const checkBtn = document.getElementById('checkSelectedProxiesBtn');
        
        // Disable button during checking
        checkBtn.disabled = true;
        checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...';

        try {
            // Update UI to show checking status
            proxies.forEach(proxy => {
                this.updateProxyStatusInUI(proxy.id, 'checking', 0, 'Đang kiểm tra...');
            });

            // Check proxies in batches of 5 to avoid overload
            const batchSize = 5;
            const batches = [];
            for (let i = 0; i < proxies.length; i += batchSize) {
                batches.push(proxies.slice(i, i + batchSize));
            }

            let checkedCount = 0;
            let workingCount = 0;

            for (const batch of batches) {
                const results = await window.electronAPI.checkMultipleProxies(batch);
                
                for (const result of results) {
                    checkedCount++;
                    const status = result.checkResult.status;
                    const responseTime = result.checkResult.responseTime;
                    const error = result.checkResult.error;
                    const extraInfo = {
                        ip: result.checkResult.ip,
                        endpoint: result.checkResult.endpoint
                    };
                    
                    if (status === 'working') {
                        workingCount++;
                    }

                    // Update proxy status in backend
                    await window.electronAPI.updateProxyStatus(result.id, result.checkResult);
                    
                    // Update UI
                    this.updateProxyStatusInUI(result.id, status, responseTime, error, extraInfo);
                    
                    // Update progress
                    const progress = Math.round((checkedCount / proxies.length) * 100);
                    checkBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${progress}%`;
                }

                // Small delay between batches to prevent overwhelming
                if (batches.indexOf(batch) < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Show summary
            this.showToast(
                `Kiểm tra hoàn tất: ${workingCount}/${checkedCount} proxy hoạt động`, 
                workingCount > 0 ? 'success' : 'warning'
            );

            // Reload proxies to get updated data
            await this.loadProxies();

        } catch (error) {
            console.error('Error checking proxies:', error);
            this.showToast('Lỗi khi kiểm tra proxies: ' + error.message, 'error');
        } finally {
            // Re-enable button
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<i class="fas fa-check-circle"></i> Check Selected';
        }
    }

    updateProxyStatusInUI(proxyId, status, responseTime, error, extraInfo = {}) {
        const row = document.querySelector(`tr[data-proxy-id="${proxyId}"]`);
        if (!row) return;

        const statusCell = row.querySelector('.proxy-status-cell');
        if (!statusCell) return;

        let statusHtml = '';
        let icon = '';
        
        switch (status) {
            case 'working':
                icon = '<i class="fas fa-check-circle"></i>';
                let workingText = `${icon} Online`;
                let tooltip = 'Proxy đang hoạt động';
                
                if (extraInfo.ip) {
                    tooltip += `\nIP: ${extraInfo.ip}`;
                }
                if (extraInfo.endpoint) {
                    tooltip += `\nEndpoint: ${extraInfo.endpoint}`;
                }
                
                statusHtml = `<span class="proxy-status working" title="${tooltip}">${workingText}</span>`;
                if (responseTime) {
                    statusHtml += `<span class="proxy-response-time">${responseTime}ms</span>`;
                }
                break;
            case 'error':
                icon = '<i class="fas fa-times-circle"></i>';
                let errorTooltip = error || 'Connection error';
                statusHtml = `<span class="proxy-status error" title="${errorTooltip}">${icon} Error</span>`;
                break;
            case 'timeout':
                icon = '<i class="fas fa-clock"></i>';
                statusHtml = `<span class="proxy-status timeout" title="Connection timeout">${icon} Timeout</span>`;
                break;
            case 'checking':
                icon = '<i class="fas fa-spinner fa-spin"></i>';
                statusHtml = `<span class="proxy-status checking">${icon} Checking...</span>`;
                break;
            default:
                icon = '<i class="fas fa-question-circle"></i>';
                statusHtml = `<span class="proxy-status unchecked">${icon} Unchecked</span>`;
        }

        statusCell.innerHTML = statusHtml;
    }

    // DISABLED: Removed individual test functionality
    /*
    async testSingleProxy(proxyId) {
        const proxy = this.proxies.find(p => p.id === proxyId);
        if (!proxy) return;

        // Update UI to show checking
        this.updateProxyStatusInUI(proxyId, 'checking', 0, 'Đang kiểm tra...');

        try {
            const result = await window.electronAPI.checkProxyStatus(proxy);
            
            // Update proxy status in backend
            await window.electronAPI.updateProxyStatus(proxyId, result);
            
            // Update UI with extra info
            const extraInfo = {
                ip: result.ip,
                endpoint: result.endpoint
            };
            this.updateProxyStatusInUI(proxyId, result.status, result.responseTime, result.error, extraInfo);
            
            // Show result
            if (result.status === 'working') {
                let message = `Proxy ${proxy.host}:${proxy.port} hoạt động tốt (${result.responseTime}ms)`;
                if (result.ip) {
                    message += `\nIP: ${result.ip}`;
                }
                if (result.endpoint) {
                    message += `\nEndpoint: ${result.endpoint}`;
                }
                this.showToast(message, 'success');
            } else {
                this.showToast(`Proxy ${proxy.host}:${proxy.port} không hoạt động: ${result.error}`, 'error');
            }

            // Reload to get updated data
            await this.loadProxies();

        } catch (error) {
            console.error('Error testing proxy:', error);
            this.updateProxyStatusInUI(proxyId, 'error', 0, error.message);
            this.showToast('Lỗi khi test proxy: ' + error.message, 'error');
        }
    }
    */

    async importProxies() {
        try {
            this.showLoading(true);
            
            const result = await window.electronAPI.importProxiesDialog();
            
            if (result.success) {
                await this.loadData(); // Reload để cập nhật danh sách
                this.showToast(`Đã import thành công ${result.count} proxy!`);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Error importing proxies:', error);
            this.showToast('Lỗi khi import proxy: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async launchProfile(profileId) {
        try {
            // Chỉ set loading cho button này thay vì toàn màn hình
            this.setButtonLoading(profileId, true);
            
            const profile = this.profiles.find(p => p.id === profileId);
            if (!profile) {
                throw new Error('Profile không tìm thấy');
            }

            // Lấy thông tin proxy nếu có
            let proxyConfig = null;
            if (profile.proxy) {
                const proxy = this.proxies.find(p => p.id === profile.proxy);
                if (proxy) {
                    proxyConfig = proxy;
                }
            }

            // Launch Chrome without validation
            const skipValidation = false;

            // Launch Chrome with automatic proxy validation
            const result = await window.electronAPI.launchChrome(profileId, proxyConfig, skipValidation);
            
            if (result.success) {
                this.runningInstances.set(result.instanceId, {
                    id: result.instanceId,
                    profile: profile,
                    proxy: proxyConfig,
                    startTime: new Date()
                });
                
                this.renderProfiles();
                this.renderRunningInstances();
                this.updateStats();
                
                // Show success message with proxy info
                let message = `Chrome đã được khởi chạy với profile "${profile.name}"`;
                if (proxyConfig) {
                    if (proxyConfig.username && proxyConfig.password) {
                        message += ` và proxy authentication tự động: ${proxyConfig.host}:${proxyConfig.port} (${proxyConfig.username})`;
                    } else {
                        message += ` và proxy: ${proxyConfig.host}:${proxyConfig.port}`;
                    }
                }
                this.showToast(message, 'success');
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Error launching Chrome:', error);
            this.showToast('Lỗi khi khởi chạy Chrome: ' + error.message, 'error');
        } finally {
            // Tắt loading cho button này và refresh UI
            this.setButtonLoading(profileId, false);
            // Refresh UI để cập nhật trạng thái nút
            this.renderProfiles();
        }
    }

    async stopInstance(instanceId) {
        try {
            const result = await window.electronAPI.stopChrome(instanceId);
            
            if (result.success) {
                const instance = this.runningInstances.get(instanceId);
                this.runningInstances.delete(instanceId);
                
                this.renderProfiles();
                this.renderRunningInstances();
                this.updateStats();
                
                if (instance) {
                    this.showToast(`Chrome instance "${instance.profile.name}" đã được dừng`);
                }
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Error stopping Chrome:', error);
            this.showToast('Lỗi khi dừng Chrome: ' + error.message, 'error');
        }
    }

    // Method để restart Chrome instance đã bị đóng
    async restartInstance(instanceId, profileId) {
        try {
            const instance = this.runningInstances.get(instanceId);
            if (!instance) {
                throw new Error('Instance không tồn tại');
            }

            this.showLoading(true, 'Đang khởi động lại Chrome...');

            // Launch Chrome với cùng config cũ
            const result = await window.electronAPI.launchChromeWithPuppeteer(profileId, instance.proxy);
            
            if (result.success) {
                // Remove old instance và add new instance
                this.runningInstances.delete(instanceId);
                this.runningInstances.set(result.instanceId, {
                    id: result.instanceId,
                    profile: instance.profile,
                    proxy: instance.proxy,
                    startTime: new Date(),
                    isActive: true
                });

                this.renderProfiles();
                this.renderRunningInstances();
                this.updateStats();

                this.showToast(`Chrome "${instance.profile.name}" đã được mở lại thành công! 🔄`, 'success');
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Error restarting Chrome:', error);
            this.showToast('Lỗi khi mở lại Chrome: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Method để remove instance đã đóng khỏi danh sách
    async removeInstance(instanceId) {
        try {
            const instance = this.runningInstances.get(instanceId);
            if (instance) {
                this.runningInstances.delete(instanceId);
                this.renderRunningInstances();
                this.updateStats();
                this.showToast(`Đã xóa instance "${instance.profile.name}" khỏi danh sách`, 'info');
            }
        } catch (error) {
            console.error('Error removing instance:', error);
            this.showToast('Lỗi khi xóa instance: ' + error.message, 'error');
        }
    }

    renderRunningInstances() {
        const container = document.getElementById('runningInstances');
        
        if (this.runningInstances.size === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-play-circle" style="font-size: 3rem; color: #d1d5db; margin-bottom: 1rem;"></i>
                    <h3>Không có Chrome nào đang chạy</h3>
                    <p>Khởi chạy Chrome từ tab Profiles để thấy chúng ở đây</p>
                    <button class="btn btn-secondary" onclick="chromeManager.syncChromeInstances()">
                        <i class="fas fa-refresh"></i> Refresh Status
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="instances-header">
                <h3>Chrome Instances (${this.runningInstances.size})</h3>
                <button class="btn btn-secondary" onclick="chromeManager.syncChromeInstances()" title="Refresh trạng thái">
                    <i class="fas fa-refresh"></i> Refresh
                </button>
            </div>
            ${Array.from(this.runningInstances.values()).map(instance => `
                <div class="instance-card ${instance.isActive ? 'active' : 'inactive'}">
                    <div class="instance-info">
                        <h4>
                            ${instance.profile.name}
                            <span class="status-badge ${instance.isActive ? 'status-active' : 'status-inactive'}">
                                ${instance.isActive ? '🟢 Đang chạy' : '🔴 Đã đóng'}
                            </span>
                        </h4>
                        <div class="instance-details">
                            <span><i class="fas fa-globe"></i> Proxy: ${instance.proxy ? `${instance.proxy.host}:${instance.proxy.port}` : 'Không có'}</span> • 
                            <span><i class="fas fa-clock"></i> Chạy từ: ${instance.startTime.toLocaleTimeString('vi-VN')}</span>
                            ${instance.windowSize ? `• <span><i class="fas fa-expand"></i> ${instance.windowSize.width}x${instance.windowSize.height}</span>` : ''}
                        </div>
                    </div>
                    <div class="instance-actions">
                        ${instance.isActive ? `
                            <button class="btn btn-danger" onclick="chromeManager.stopInstance('${instance.id}')">
                                <i class="fas fa-stop"></i> Tắt
                            </button>
                        ` : `
                            <button class="btn btn-secondary" onclick="chromeManager.removeInstance('${instance.id}')">
                                <i class="fas fa-times"></i> Xóa
                            </button>
                        `}
                    </div>
                </div>
            `).join('')}
        `;
    }

    checkProxiesStatus() {
        // Auto check proxy status for display
        this.proxies.forEach(async (proxy) => {
            try {
                const result = await window.electronAPI.checkProxyStatus(proxy);
                await window.electronAPI.updateProxyStatus(proxy.id, result);
                const extraInfo = {
                    ip: result.ip,
                    endpoint: result.endpoint
                };
                this.updateProxyStatusInUI(proxy.id, result.status, result.responseTime, result.error, extraInfo);
            } catch (error) {
                console.error('Error checking proxy status:', error);
                this.updateProxyStatusInUI(proxy.id, 'error', 0, error.message);
            }
        });
    }

    // DISABLED: Removed test proxy functionality
    /*
    async testProxy(proxyId) {
        const proxy = this.proxies.find(p => p.id === proxyId);
        if (proxy) {
            await this.testSingleProxy(proxyId);
        }
    }
    */

    editProfile(profileId) {
        this.showToast('Chức năng sửa profile đang được phát triển', 'info');
    }

    async deleteProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) {
            this.showToast('Profile không tồn tại', 'error');
            return;
        }

        const confirmMessage = `Bạn có chắc chắn muốn xóa profile "${profile.name}"?\n\n⚠️ CẢNH BÁO: Tất cả dữ liệu Chrome của profile này sẽ bị xóa vĩnh viễn, bao gồm:\n- Bookmarks\n- History\n- Cookies\n- Saved passwords\n- Extensions data\n- Cache và tất cả dữ liệu khác\n\nHành động này KHÔNG THẾ HOÀN TÁC!`;
        
        if (confirm(confirmMessage)) {
            try {
                this.showLoading(true, 'Đang xóa profile và dữ liệu Chrome...');
                
                console.log(`Attempting to delete profile: ${profileId}`);
                
                // Gọi IPC để xóa profile và Chrome data
                const result = await window.electronAPI.deleteProfile(profileId);
                
                console.log(`Delete profile result:`, result);
                
                if (result.success) {
                    // Cập nhật UI sau khi xóa thành công
                    this.profiles = this.profiles.filter(p => p.id !== profileId);
                    this.filteredProfiles = this.filteredProfiles.filter(p => p.id !== profileId);
                    this.renderProfiles();
                    this.refreshProxyUsageCounts(); // Update proxy usage counts using new method
                    this.updateStats();
                    this.showToast(result.message || 'Profile đã được xóa hoàn toàn', 'success');
                } else {
                    console.error(`Delete failed for profile ${profileId}:`, result.error);
                    this.showToast('Lỗi khi xóa profile: ' + result.error, 'error');
                    alert(`Chi tiết lỗi xóa profile:\n${result.error}`);
                }
                
            } catch (error) {
                console.error('Error deleting profile:', error);
                this.showToast('Lỗi khi xóa profile: ' + error.message, 'error');
            } finally {
                this.showLoading(false);
            }
        }
    }

    async deleteSelectedProfiles() {
        const selectedProfileIds = Array.from(this.selectedProfiles);
        
        if (selectedProfileIds.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile để xóa', 'warning');
            return;
        }

        const selectedProfiles = this.profiles.filter(p => selectedProfileIds.includes(p.id));
        
        // Show modern confirmation modal
        this.showDeleteConfirmModal(selectedProfileIds, selectedProfiles);
    }

    showDeleteConfirmModal(selectedProfileIds, selectedProfiles) {
        const modal = document.getElementById('deleteConfirmModal');
        const messageEl = document.getElementById('deleteConfirmMessage');
        const detailsEl = document.getElementById('deleteConfirmDetails');
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const cancelBtn = document.getElementById('cancelDeleteBtn');

        // Update message
        messageEl.textContent = `Bạn có chắc chắn muốn xóa ${selectedProfileIds.length} hồ sơ đã chọn?`;

        // Update profile list
        detailsEl.innerHTML = `
            <h4>Danh sách hồ sơ sẽ bị xóa:</h4>
            <ul class="profile-list">
                ${selectedProfiles.map(profile => `
                    <li>
                        <i class="fas fa-user"></i>
                        ${profile.name}
                    </li>
                `).join('')}
            </ul>
        `;

        // Setup event listeners
        const handleCancel = () => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        const handleConfirm = async () => {
            confirmBtn.classList.add('loading');
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;

            try {
                this.showLoading(true, `Đang xóa ${selectedProfileIds.length} profile...`);
                
                let successCount = 0;
                let failedProfiles = [];

                // Xóa từng profile
                for (const profileId of selectedProfileIds) {
                    try {
                        const result = await window.electronAPI.deleteProfile(profileId);
                        if (result.success) {
                            successCount++;
                        } else {
                            failedProfiles.push(this.profiles.find(p => p.id === profileId)?.name || profileId);
                        }
                    } catch (error) {
                        console.error(`Error deleting profile ${profileId}:`, error);
                        failedProfiles.push(this.profiles.find(p => p.id === profileId)?.name || profileId);
                    }
                }

                // Cập nhật UI
                this.profiles = this.profiles.filter(p => !selectedProfileIds.includes(p.id));
                this.filteredProfiles = this.filteredProfiles.filter(p => !selectedProfileIds.includes(p.id));
                this.selectedProfiles.clear();
                this.renderProfiles();
                this.updateStats();

                // Hiển thị kết quả
                if (successCount === selectedProfileIds.length) {
                    this.showToast(`Đã xóa thành công ${successCount} profile`, 'success');
                } else if (successCount > 0) {
                    this.showToast(`Đã xóa ${successCount}/${selectedProfileIds.length} profile. Một số profile không thể xóa: ${failedProfiles.join(', ')}`, 'warning');
                } else {
                    this.showToast(`Không thể xóa profile: ${failedProfiles.join(', ')}`, 'error');
                }

                // Close modal
                modal.style.display = 'none';
                
            } catch (error) {
                console.error('Error deleting selected profiles:', error);
                this.showToast('Lỗi khi xóa profile: ' + error.message, 'error');
            } finally {
                this.showLoading(false);
                confirmBtn.classList.remove('loading');
                confirmBtn.disabled = false;
                cancelBtn.disabled = false;
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // Show modal
        modal.style.display = 'flex';
    }

    async startSelectedProfiles() {
        const selectedProfileIds = Array.from(this.selectedProfiles);
        
        if (selectedProfileIds.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile để mở', 'warning');
            return;
        }

        try {
            this.showLoading(true, `Đang mở ${selectedProfileIds.length} profile...`);
            
            let successCount = 0;
            let failedProfiles = [];

            for (const profileId of selectedProfileIds) {
                try {
                    const profile = this.profiles.find(p => p.id === profileId);
                    if (profile) {
                        await this.launchProfile(profileId);
                        successCount++;
                        // Small delay between launches
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    console.error(`Error starting profile ${profileId}:`, error);
                    failedProfiles.push(this.profiles.find(p => p.id === profileId)?.name || profileId);
                }
            }

            // Hiển thị kết quả
            if (successCount === selectedProfileIds.length) {
                this.showToast(`Đã mở thành công ${successCount} profile`, 'success');
            } else if (successCount > 0) {
                this.showToast(`Đã mở ${successCount}/${selectedProfileIds.length} profile. Một số profile không thể mở: ${failedProfiles.join(', ')}`, 'warning');
            } else {
                this.showToast(`Không thể mở profile: ${failedProfiles.join(', ')}`, 'error');
            }

        } catch (error) {
            console.error('Error starting selected profiles:', error);
            this.showToast('Lỗi khi mở profile: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async stopSelectedProfiles() {
        const selectedProfileIds = Array.from(this.selectedProfiles);
        
        if (selectedProfileIds.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile để tắt', 'warning');
            return;
        }

        // Chỉ lấy những profile đang chạy
        const runningProfileIds = selectedProfileIds.filter(profileId => {
            return Array.from(this.runningInstances.values())
                .some(instance => instance.profile.id === profileId && instance.isActive);
        });

        if (runningProfileIds.length === 0) {
            this.showToast('Không có profile nào đang chạy trong danh sách đã chọn', 'warning');
            return;
        }

        try {
            this.showLoading(true, `Đang tắt ${runningProfileIds.length} profile...`);
            
            let successCount = 0;
            let failedProfiles = [];

            for (const profileId of runningProfileIds) {
                try {
                    await this.stopProfileInstance(profileId);
                    successCount++;
                } catch (error) {
                    console.error(`Error stopping profile ${profileId}:`, error);
                    failedProfiles.push(this.profiles.find(p => p.id === profileId)?.name || profileId);
                }
            }

            // Hiển thị kết quả
            if (successCount === runningProfileIds.length) {
                this.showToast(`Đã tắt thành công ${successCount} profile`, 'success');
            } else if (successCount > 0) {
                this.showToast(`Đã tắt ${successCount}/${runningProfileIds.length} profile. Một số profile không thể tắt: ${failedProfiles.join(', ')}`, 'warning');
            } else {
                this.showToast(`Không thể tắt profile: ${failedProfiles.join(', ')}`, 'error');
            }

        } catch (error) {
            console.error('Error stopping selected profiles:', error);
            this.showToast('Lỗi khi tắt profile: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showProxyImportModal(selectedProfileIds) {
        // TODO: Implement proxy import modal
        this.showToast(`Chức năng nhập proxy cho ${selectedProfileIds.length} profile đang được phát triển`, 'info');
    }

    editProxy(proxyId) {
        this.showToast('Chức năng sửa proxy đang được phát triển', 'info');
    }

    async deleteProxy(proxyId) {
        const proxy = this.proxies.find(p => p.id === proxyId);
        if (!proxy) {
            this.showToast('Proxy không tồn tại', 'error');
            return;
        }

        if (confirm(`Bạn có chắc chắn muốn xóa proxy ${proxy.host}:${proxy.port}?`)) {
            try {
                // TODO: Implement deleteProxy API in backend
                // const result = await window.electronAPI.deleteProxy(proxyId);
                
                // For now, just remove from local array
                this.proxies = this.proxies.filter(p => p.id !== proxyId);
                
                // Invalidate proxy cache since we deleted data
                this.invalidateProxyCache();
                
                this.renderProxies();
                this.updateProxySelect();
                this.updateStats();
                this.showToast('Proxy đã được xóa', 'success');
            } catch (error) {
                console.error('Error deleting proxy:', error);
                this.showToast('Lỗi khi xóa proxy: ' + error.message, 'error');
            }
        }
    }

    // ============ PROXY SELECTION FUNCTIONS ============

    toggleProxySelection(proxyId, checked) {
        if (checked) {
            this.selectedProxies.add(proxyId);
        } else {
            this.selectedProxies.delete(proxyId);
        }
        this.updateProxySelection();
    }

    toggleSelectAllProxies(checked) {
        this.selectedProxies.clear();
        
        if (checked) {
            this.proxies.forEach(proxy => {
                this.selectedProxies.add(proxy.id);
            });
        }

        this.updateProxySelection();
    }

    updateProxySelection() {
        // Update checkboxes
        document.querySelectorAll('.proxy-checkbox').forEach(checkbox => {
            const proxyId = checkbox.dataset.proxyId;
            checkbox.checked = this.selectedProxies.has(proxyId);
            
            // Update row highlight
            const row = checkbox.closest('tr');
            row.classList.toggle('selected', this.selectedProxies.has(proxyId));
        });

        // Update select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllProxies');
        if (selectAllCheckbox) {
            const totalProxies = this.proxies.length;
            const selectedCount = this.selectedProxies.size;
            
            selectAllCheckbox.checked = totalProxies > 0 && selectedCount === totalProxies;
            selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalProxies;
        }
    }

    // ============ PROXY MANAGEMENT FUNCTIONS ============

    switchProxyMode(mode) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update content panels
        document.querySelectorAll('.proxy-mode').forEach(panel => {
            panel.classList.toggle('active', panel.id === `${mode}ProxyMode`);
        });

        // Clear preview when switching modes
        this.clearProxyPreview();
    }

    parseProxyString(proxyStr) {
        const trimmed = proxyStr.trim();
        if (!trimmed) return null;

        let result = {
            host: '',
            port: '',
            username: '',
            password: '',
            type: 'http'
        };

        try {
            // Pattern 1: protocol://username:password@host:port
            let match = trimmed.match(/^(https?|socks[45]?):\/\/(?:([^:@]+):([^@]+)@)?([^:]+):(\d+)$/i);
            if (match) {
                let protocol = match[1].toLowerCase();
                // Handle socks variants
                if (protocol === 'socks') protocol = 'socks5';
                else if (protocol === 'socks4') protocol = 'socks4';
                else if (protocol === 'socks5') protocol = 'socks5';
                
                result.type = protocol;
                result.username = match[2] || '';
                result.password = match[3] || '';
                result.host = match[4];
                result.port = parseInt(match[5]);
                return result;
            }

            // Pattern 2: host:port:username:password
            match = trimmed.match(/^([^:]+):(\d+):([^:]+):(.+)$/);
            if (match) {
                result.host = match[1];
                result.port = parseInt(match[2]);
                result.username = match[3];
                result.password = match[4];
                return result;
            }

            // Pattern 3: host:port
            match = trimmed.match(/^([^:]+):(\d+)$/);
            if (match) {
                result.host = match[1];
                result.port = parseInt(match[2]);
                return result;
            }

            return null;
        } catch (error) {
            console.warn('Error parsing proxy:', proxyStr, error);
            return null;
        }
    }

    // ============ BULK PROXY UI FUNCTIONS ============

    resetProxyCheckState() {
        const checkBtn = document.getElementById('checkProxiesBtn');
        const importBtn = document.getElementById('importProxiesBtn');
        
        // Reset to initial state
        checkBtn.innerHTML = '<i class="fas fa-search"></i> Check Proxy';
        checkBtn.className = 'btn btn-info';
        checkBtn.disabled = false;
        
        importBtn.disabled = true;
        
        // Hide preview
        this.clearProxyPreview();
    }

    updateProxyCheckButton(state, count = 0) {
        const checkBtn = document.getElementById('checkProxiesBtn');
        const importBtn = document.getElementById('importProxiesBtn');
        
        switch (state) {
            case 'checking':
                checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...';
                checkBtn.className = 'btn btn-warning';
                checkBtn.disabled = true;
                importBtn.disabled = true;
                break;
                
            case 'checked':
                checkBtn.innerHTML = '<i class="fas fa-check"></i> Đã kiểm tra';
                checkBtn.className = 'btn btn-success';
                checkBtn.disabled = false;
                importBtn.disabled = count === 0;
                importBtn.innerHTML = `<i class="fas fa-plus"></i> Thêm ${count} Proxy${count > 1 ? 's' : ''}`;
                break;
                
            case 'error':
                checkBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Kiểm tra lại';
                checkBtn.className = 'btn btn-danger';
                checkBtn.disabled = false;
                importBtn.disabled = true;
                break;
        }
    }

    async checkAndPreviewProxies() {
        const proxyListElement = document.getElementById('proxyList');
        if (!proxyListElement) {
            this.showToast('Không tìm thấy trường nhập proxy', 'error');
            return;
        }
        
        const proxyListText = proxyListElement.value.trim();
        
        if (!proxyListText) {
            this.showToast('Vui lòng nhập danh sách proxy', 'warning');
            return;
        }

        this.updateProxyCheckButton('checking');
        
        try {
            // Parse proxies
            const result = await this.parseAndValidateProxies(proxyListText);
            
            if (result.validProxies.length > 0) {
                this.displayProxyPreview(result.validProxies, result.errors);
                this.updateProxyCheckButton('checked', result.validProxies.length);
                this.parsedProxyData = result;
            } else {
                this.updateProxyCheckButton('error');
                this.showToast('Không có proxy hợp lệ nào được tìm thấy', 'error');
            }
            
        } catch (error) {
            console.error('Error checking proxies:', error);
            this.updateProxyCheckButton('error');
            this.showToast('Lỗi khi kiểm tra proxies: ' + error.message, 'error');
        }
    }

    async parseAndValidateProxies(proxyListText) {
        const defaultTypeElement = document.getElementById('defaultProxyType');
        const defaultType = defaultTypeElement ? defaultTypeElement.value : 'http';
        const lines = proxyListText.split('\n').filter(line => line.trim());
        
        const validProxies = [];
        const errors = [];

        lines.forEach((line, index) => {
            const parsed = this.parseProxyString(line);
            if (parsed) {
                // Use default type only for basic host:port format
                if (parsed.type === 'http' && !line.includes('://')) {
                    parsed.type = defaultType;
                }
                parsed.originalLine = line.trim();
                parsed.lineNumber = index + 1;
                validProxies.push(parsed);
            } else {
                errors.push({
                    line: line.trim(),
                    lineNumber: index + 1,
                    error: 'Invalid format'
                });
            }
        });

        return { validProxies, errors };
    }

    previewProxies() {
        const proxyListElement = document.getElementById('proxyList');
        const defaultTypeElement = document.getElementById('defaultProxyType');
        
        if (!proxyListElement) {
            this.showToast('Không tìm thấy trường nhập proxy', 'error');
            return;
        }
        
        const proxyListText = proxyListElement.value;
        const defaultType = defaultTypeElement ? defaultTypeElement.value : 'http';

        const lines = proxyListText.split('\n').filter(line => line.trim());
        const parsedProxies = [];
        const errors = [];

        lines.forEach((line, index) => {
            const parsed = this.parseProxyString(line);
            if (parsed) {
                // Use default type only for basic host:port format
                if (parsed.type === 'http' && !line.includes('://')) {
                    parsed.type = defaultType;
                }
                parsed.originalLine = line.trim();
                parsed.lineNumber = index + 1;
                parsedProxies.push(parsed);
            } else {
                errors.push({
                    line: line.trim(),
                    lineNumber: index + 1,
                    error: 'Invalid format'
                });
            }
        });

        this.displayProxyPreview(parsedProxies, errors);
    }

    displayProxyPreview(proxies, errors) {
        const previewContainer = document.getElementById('bulkPreview');
        const countSpan = document.getElementById('previewCount');
        const listContainer = document.getElementById('previewList');

        countSpan.textContent = proxies.length;
        
        let html = '';
        
        // Show successful proxies
        proxies.forEach(proxy => {
            const authInfo = proxy.username ? `${proxy.username}:***` : 'No auth';
            html += `
                <div class="preview-item">
                    <div class="proxy-details">
                        <span>${proxy.host}:${proxy.port} (${authInfo})</span>
                        <span class="proxy-type">${proxy.type}</span>
                    </div>
                </div>
            `;
        });

        // Show errors
        errors.forEach(error => {
            html += `
                <div class="preview-item error">
                    <div class="proxy-details">
                        <span>Line ${error.lineNumber}: ${error.line}</span>
                        <span style="color: #dc2626; font-size: 0.7rem;">${error.error}</span>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
        previewContainer.style.display = 'block';

        // Store parsed data for later use
        this.parsedProxyData = { proxies, errors };
    }

    clearProxyPreview() {
        document.getElementById('bulkPreview').style.display = 'none';
        this.parsedProxyData = null;
    }

    async bulkImportProxies() {
        if (!this.parsedProxyData) {
            this.showToast('Vui lòng preview proxies trước khi import', 'warning');
            return;
        }

        const { proxies, errors } = this.parsedProxyData;
        
        if (proxies.length === 0) {
            this.showToast('Không có proxy hợp lệ để import', 'error');
            return;
        }

        if (errors.length > 0) {
            const confirmMsg = `Có ${errors.length} dòng lỗi sẽ bị bỏ qua. Tiếp tục import ${proxies.length} proxies?`;
            if (!confirm(confirmMsg)) return;
        }

        try {
            this.showLoading(true, `Đang import ${proxies.length} proxies...`);
            
            let successCount = 0;
            let duplicateCount = 0;

            for (const proxy of proxies) {
                // Check for duplicates
                const exists = this.proxies.some(p => 
                    p.host === proxy.host && p.port === proxy.port
                );

                if (exists) {
                    duplicateCount++;
                    continue;
                }

                // Add proxy
                const proxyData = {
                    host: proxy.host,
                    port: proxy.port,
                    username: proxy.username,
                    password: proxy.password,
                    type: proxy.type
                };

                const result = await window.electronAPI.addProxy(proxyData);
                if (result.success) {
                    this.proxies.push(result.proxy);
                    successCount++;
                } else {
                    console.warn('Failed to add proxy:', proxyData, result.error);
                }
            }

            // Update UI
            this.renderProxies();
            this.updateProxySelect();
            this.updateStats();
            this.hideModal('addProxyModal');

            // Clear form
            document.getElementById('bulkProxyForm').reset();
            this.clearProxyPreview();

            // Show result
            let message = `Import hoàn tất: ${successCount} proxies được thêm`;
            if (duplicateCount > 0) {
                message += `, ${duplicateCount} trùng lặp bị bỏ qua`;
            }
            if (errors.length > 0) {
                message += `, ${errors.length} dòng lỗi bị bỏ qua`;
            }

            this.showToast(message, 'success');

        } catch (error) {
            console.error('Error in bulk import:', error);
            this.showToast('Lỗi khi import proxies: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    checkAllProxies() {
        this.showToast('Đang kiểm tra tất cả proxy...', 'info');
        this.checkProxiesStatus();
    }

    handleProxyValidationStatus(data) {
        const { status, message, proxyInfo } = data;
        
        switch (status) {
            case 'checking':
                // Hiển thị thông báo đang kiểm tra
                this.showToast(message, 'info', 5000);
                break;
                
            case 'success':
                // Hiển thị thông báo thành công
                this.showToast(`✅ ${message}`, 'success', 3000);
                if (proxyInfo) {
                    console.log('Proxy validation info:', proxyInfo);
                    
                    // Hiển thị thông tin IP được lấy từ proxy
                    if (proxyInfo.ip) {
                        setTimeout(() => {
                            this.showToast(`🌐 IP qua proxy: ${proxyInfo.ip}`, 'info', 4000);
                        }, 500);
                    }
                }
                break;
                
            case 'failed':
                // Hiển thị thông báo lỗi
                this.showToast(`❌ ${message}`, 'error', 5000);
                break;
                
            default:
                console.log('Unknown proxy validation status:', data);
        }
    }

    handleProxySetupStatus(data) {
        const { message, hasAuth, proxyInfo } = data;
        
        if (hasAuth) {
            // Hiển thị thông báo về proxy authentication tự động
            this.showToast(`🔐 ${message}`, 'info', 5000);
            setTimeout(() => {
                this.showToast(`⚡ Credentials được embedded trong proxy URL - Không cần popup!`, 'success', 4000);
            }, 1000);
        } else {
            // Hiển thị thông báo proxy thường
            this.showToast(`🌐 ${message}`, 'info', 3000);
        }
        
        console.log('Proxy setup completed:', proxyInfo);
    }

    async launchChromeWithValidation(profileId, proxyConfig) {
        try {
            // Disable launch button temporarily
            const launchBtn = document.querySelector(`[data-profile-id="${profileId}"] .launch-btn`);
            if (launchBtn) {
                launchBtn.disabled = true;
                launchBtn.textContent = 'Đang kiểm tra...';
            }

            const result = await window.electronAPI.launchChrome(profileId, proxyConfig);
            
            if (result.success) {
                this.runningInstances.set(profileId, result.instanceId);
                this.renderProfiles();
                this.showToast('Chrome đã được khởi chạy thành công với proxy đã xác thực', 'success');
            } else {
                this.showToast('Lỗi: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Error launching Chrome:', error);
            this.showToast('Lỗi khi khởi chạy Chrome: ' + error.message, 'error');
        } finally {
            // Re-enable launch button
            const launchBtn = document.querySelector(`[data-profile-id="${profileId}"] .launch-btn`);
            if (launchBtn) {
                launchBtn.disabled = false;
                launchBtn.textContent = 'Chạy';
            }
        }
    }

    // ===== HELPER METHODS =====
    
    // Safe UI update method
    safeUpdateUI() {
        try {
            if (this.renderProfiles && typeof this.renderProfiles === 'function') {
                this.renderProfiles();
            }
            if (this.updateStats && typeof this.updateStats === 'function') {
                this.updateStats();
            }
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }

    // ===== NEW ACTION BUTTON METHODS =====
    
    async openSelectedProfiles() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        
        if (selectedProfiles.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile để mở', 'warning');
            return;
        }

        if (selectedProfiles.length > 10) {
            if (!confirm(`Bạn đang mở ${selectedProfiles.length} profiles cùng lúc. Điều này có thể làm chậm hệ thống. Tiếp tục?`)) {
                return;
            }
        }

        this.showToast(`Đang mở ${selectedProfiles.length} profile(s)...`, 'info');
        let successCount = 0;
        let errorCount = 0;
        
        for (const profileId of selectedProfiles) {
            try {
                // Skip if already running
                if (this.runningInstances.has(profileId)) {
                    this.showToast(`Profile ${profileId} đã đang chạy`, 'info');
                    continue;
                }
                
                await this.launchProfile(profileId);
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 1500)); // Delay 1.5s giữa các profile
            } catch (error) {
                console.error(`Error opening profile ${profileId}:`, error);
                errorCount++;
                this.showToast(`Lỗi khi mở profile ${profileId}: ${error.message}`, 'error', 3000);
            }
        }
        
        this.showToast(`Hoàn tất: ${successCount} thành công, ${errorCount} lỗi`, successCount > 0 ? 'success' : 'error');
    }

    async closeSelectedProfiles() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        
        if (selectedProfiles.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile để tắt', 'warning');
            return;
        }

        const runningProfiles = selectedProfiles.filter(id => this.runningInstances.has(id));
        
        if (runningProfiles.length === 0) {
            this.showToast('Không có profile nào đang chạy trong danh sách đã chọn', 'info');
            return;
        }

        this.showToast(`Đang tắt ${runningProfiles.length} profile(s)...`, 'info');
        let successCount = 0;
        let errorCount = 0;
        
        for (const profileId of runningProfiles) {
            try {
                if (window.electronAPI && window.electronAPI.closeChromeInstance) {
                    await window.electronAPI.closeChromeInstance(profileId);
                    this.runningInstances.delete(profileId);
                    successCount++;
                } else {
                    throw new Error('API closeChromeInstance không khả dụng');
                }
            } catch (error) {
                console.error(`Error closing profile ${profileId}:`, error);
                errorCount++;
                this.showToast(`Lỗi khi tắt profile ${profileId}: ${error.message}`, 'error', 3000);
            }
        }
        
        this.renderProfiles();
        this.updateStats();
        this.showToast(`Hoàn tất: ${successCount} đã tắt, ${errorCount} lỗi`, successCount > 0 ? 'success' : 'error');
    }



    editSelectedProfile() {
        const selectedProfiles = Array.from(this.selectedProfiles);
        
        if (selectedProfiles.length === 0) {
            this.showToast('Vui lòng chọn một profile để chỉnh sửa', 'warning');
            return;
        }

        if (selectedProfiles.length > 1) {
            this.showToast('Chỉ có thể chỉnh sửa một profile tại một thời điểm', 'warning');
            return;
        }

        const profileId = selectedProfiles[0];
        const profile = this.profiles.find(p => p.id === profileId);
        
        if (!profile) {
            this.showToast('Không tìm thấy profile', 'error');
            return;
        }

        // Điền thông tin profile vào form
        const nameField = document.getElementById('profileName');
        const cardField = document.getElementById('profileCard');
        const groupField = document.getElementById('profileGroup');
        const hostField = document.getElementById('proxyHost');
        const portField = document.getElementById('proxyPort');
        const usernameField = document.getElementById('proxyUsername');
        const passwordField = document.getElementById('proxyPassword');

        if (nameField) nameField.value = profile.name || '';
        if (cardField) cardField.value = profile.cardId || '';
        if (groupField) groupField.value = profile.groupId || '';
        if (hostField) hostField.value = profile.proxy?.host || '';
        if (portField) portField.value = profile.proxy?.port || '';
        if (usernameField) usernameField.value = profile.proxy?.username || '';
        if (passwordField) passwordField.value = profile.proxy?.password || '';

        // Cập nhật form để edit mode
        const form = document.getElementById('createProfileForm');
        form.dataset.editMode = 'true';
        form.dataset.editProfileId = profileId;
        
        // Thay đổi title modal
        const modalTitle = document.querySelector('#createProfileModal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Chỉnh sửa Profile';
        
        // Hiển thị modal
        this.showModal('createProfileModal');
    }

    async launchProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) {
            throw new Error('Profile không tồn tại');
        }

        const result = await window.electronAPI.launchChrome(profileId, profile.proxy);
        
        if (result.success) {
            this.runningInstances.set(profileId, result.instanceId);
            this.safeUpdateUI();
        } else {
            throw new Error(result.error);
        }
        
        return result;
    }

    // Group Management Methods
    setupGroupManagement() {
        // Group creation button (sidebar)
        const createGroupBtnSidebar = document.getElementById('createGroupBtnSidebar');
        if (createGroupBtnSidebar) {
            createGroupBtnSidebar.addEventListener('click', () => {
                this.showModal('createGroupModal');
            });
        }

        // Group creation form
        const createGroupForm = document.getElementById('createGroupForm');
        if (createGroupForm) {
            createGroupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createGroup();
            });
        }

        // Group edit form
        const editGroupForm = document.getElementById('editGroupForm');
        if (editGroupForm) {
            editGroupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateGroup();
            });
        }

        // Initialize default groups
        if (this.groups.length === 0) {
            this.groups = [
                {
                    id: 'default',
                    name: 'Mặc định',
                    color: 'blue',
                    description: 'Nhóm mặc định',
                    profileCount: 0
                }
            ];
            this.saveData();
        }

        this.renderGroupFilter();
        this.renderGroupsSidebar();
    }

    createGroup() {
        const form = document.getElementById('createGroupForm');
        if (!form) {
            console.error('Create group form not found');
            return;
        }
        
        const formData = new FormData(form);
        
        const group = {
            id: Date.now().toString(),
            name: formData.get('groupName'),
            color: formData.get('groupColor'),
            description: formData.get('groupDescription') || '',
            profileCount: 0,
            createdAt: new Date().toISOString()
        };

        // Validate group name
        if (!group.name || !group.name.trim()) {
            alert('Vui lòng nhập tên nhóm');
            return;
        }

        // Check if group name already exists
        if (this.groups.some(g => g.name.toLowerCase() === group.name.toLowerCase())) {
            alert('Tên nhóm đã tồn tại');
            return;
        }

        this.groups.push(group);
        this.saveData();
        this.renderGroupFilter();
        this.renderGroupsSidebar();
        this.hideModal('createGroupModal');
        
        // Reset form
        const resetForm = document.getElementById('createGroupForm');
        if (resetForm) {
            resetForm.reset();
        }
        
        console.log('Group created:', group);
    }

    updateGroup() {
        const form = document.getElementById('editGroupForm');
        if (!form) {
            console.error('Edit group form not found');
            return;
        }

        const groupId = form.dataset.editGroupId;
        if (!groupId) {
            console.error('No group ID found for editing');
            return;
        }

        const group = this.getGroupById(groupId);
        if (!group) {
            console.error('Group not found');
            return;
        }

        const formData = new FormData(form);
        const newName = formData.get('groupName');
        const newColor = formData.get('groupColor');
        const newDescription = formData.get('groupDescription') || '';

        // Validate group name
        if (!newName || !newName.trim()) {
            alert('Vui lòng nhập tên nhóm');
            return;
        }

        const trimmedName = newName.trim();

        // Check if name already exists (exclude current group)
        if (this.groups.some(g => g.id !== groupId && g.name.toLowerCase() === trimmedName.toLowerCase())) {
            alert('Tên nhóm đã tồn tại');
            return;
        }

        // Update group
        group.name = trimmedName;
        group.color = newColor;
        group.description = newDescription;

        this.saveData();
        this.renderGroupFilter();
        this.renderGroupsSidebar();
        this.updateProfileGroupSelect();
        this.renderProfiles();
        this.hideModal('editGroupModal');

        // Reset form
        const resetForm = document.getElementById('editGroupForm');
        if (resetForm) {
            resetForm.reset();
            resetForm.removeAttribute('data-edit-group-id');
        }

        this.showToast(`Nhóm "${trimmedName}" đã được cập nhật`, 'success');
    }

    renderGroupFilter() {
        // Function disabled - group filter removed from top navigation
        return;
        /*
        const groupFilterSelect = document.getElementById('groupFilter');
        if (!groupFilterSelect) return;

        groupFilterSelect.innerHTML = `
            <option value="">Tất cả nhóm</option>
            <option value="unassigned">Không nhóm</option>
        `;

        this.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = `${group.name} (${group.profileCount || 0})`;
            groupFilterSelect.appendChild(option);
        });
        */
    }

    filterProfilesByGroup() {
        const selectedGroupId = this.currentGroupFilter;
        
        if (!selectedGroupId) {
            // Show all profiles
            this.filteredProfiles = [...this.profiles];
        } else if (selectedGroupId === 'unassigned') {
            // Show profiles without group
            this.filteredProfiles = this.profiles.filter(profile => !profile.groupId);
        } else {
            // Show profiles of selected group
            this.filteredProfiles = this.profiles.filter(profile => profile.groupId === selectedGroupId);
        }

        this.renderProfiles();
    }

    getGroupById(groupId) {
        return this.groups.find(group => group.id === groupId);
    }

    updateGroupCounts() {
        // Reset all group counts
        this.groups.forEach(group => {
            group.profileCount = 0;
        });

        // Count profiles for each group
        this.profiles.forEach(profile => {
            if (profile.groupId) {
                const group = this.getGroupById(profile.groupId);
                if (group) {
                    group.profileCount++;
                }
            }
        });

        this.saveData();
    }

    saveData() {
        try {
            // Save groups to localStorage
            localStorage.setItem('chromeManager_groups', JSON.stringify(this.groups));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    updateProfileGroupSelect() {
        const groupSelect = document.getElementById('profileGroup');
        if (!groupSelect) return;

        // Clear existing options except the first one
        groupSelect.innerHTML = '<option value="">Không nhóm</option>';

        // Add group options
        this.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });
    }

    updateProfileCardSelect() {
        const cardSelect = document.getElementById('profileCard');
        if (!cardSelect) return;

        // Clear existing options except the first one
        cardSelect.innerHTML = '<option value="">-- Chọn thẻ --</option>';

        // Add card options
        this.cards.forEach(card => {
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = card.name;
            cardSelect.appendChild(option);
        });
    }

    getGroupBadgeHtml(groupId) {
        if (!groupId) {
            return '<span class="group-badge group-badge-gray">Không nhóm</span>';
        }

        const group = this.getGroupById(groupId);
        if (!group) {
            return '<span class="group-badge group-badge-gray">Không nhóm</span>';
        }

        return `<span class="group-badge group-badge-${group.color}">${group.name}</span>`;
    }

    renderGroupsSidebar() {
        const groupsList = document.getElementById('groupsList');
        if (!groupsList) return;

        // Add "All Profiles" item
        let html = `
            <div class="group-item ${!this.currentGroupFilter ? 'active' : ''}" onclick="chromeManager.filterByGroup('')">
                <div class="group-info">
                    <div class="group-color-dot gray"></div>
                    <span class="group-name">Tất cả profiles</span>
                </div>
                <div class="group-actions">
                    <span class="group-count">${this.profiles.length}</span>
                    <div class="group-menu-placeholder"></div>
                </div>
            </div>
            <div class="group-item ${this.currentGroupFilter === 'unassigned' ? 'active' : ''}" onclick="chromeManager.filterByGroup('unassigned')">
                <div class="group-info">
                    <div class="group-color-dot gray"></div>
                    <span class="group-name">Không nhóm</span>
                </div>
                <div class="group-actions">
                    <span class="group-count">${this.profiles.filter(p => !p.groupId).length}</span>
                    <div class="group-menu-placeholder"></div>
                </div>
            </div>
        `;

        // Add groups
        this.groups.forEach(group => {
            const isActive = this.currentGroupFilter === group.id;
            html += `
                <div class="group-item ${isActive ? 'active' : ''}" onclick="chromeManager.filterByGroup('${group.id}')">
                    <div class="group-info">
                        <div class="group-color-dot ${group.color}"></div>
                        <span class="group-name">${group.name}</span>
                    </div>
                    <div class="group-actions">
                        <span class="group-count">${group.profileCount || 0}</span>
                        <button class="group-menu-btn" onclick="event.stopPropagation(); chromeManager.toggleGroupMenu('${group.id}')">
                            <i class="fas fa-ellipsis-h"></i>
                        </button>
                        <div class="group-menu" id="groupMenu-${group.id}">
                            <button class="group-menu-item" onclick="chromeManager.editGroup('${group.id}')">
                                <i class="fas fa-edit"></i>
                                Đổi tên
                            </button>
                            <button class="group-menu-item danger" onclick="chromeManager.deleteGroup('${group.id}')">
                                <i class="fas fa-trash"></i>
                                Xóa nhóm
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        groupsList.innerHTML = html;
    }

    filterByGroup(groupId) {
        this.currentGroupFilter = groupId;
        
        this.filterProfilesByGroup();
        this.renderGroupsSidebar();
    }

    toggleGroupMenu(groupId) {
        // Close all other menus
        document.querySelectorAll('.group-menu').forEach(menu => {
            if (menu.id !== `groupMenu-${groupId}`) {
                menu.classList.remove('show');
            }
        });

        // Toggle current menu
        const menu = document.getElementById(`groupMenu-${groupId}`);
        if (menu) {
            menu.classList.toggle('show');
        }

        // Add click outside listener to close menu
        document.addEventListener('click', this.closeGroupMenus.bind(this), { once: true });
    }

    closeGroupMenus() {
        document.querySelectorAll('.group-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }

    editGroup(groupId) {
        const group = this.getGroupById(groupId);
        if (!group) return;

        // Fill form with current group data
        const nameField = document.getElementById('editGroupName');
        const colorField = document.getElementById('editGroupColor');
        const descField = document.getElementById('editGroupDescription');

        if (nameField) nameField.value = group.name || '';
        if (colorField) colorField.value = group.color || 'blue';
        if (descField) descField.value = group.description || '';

        // Set form data for update
        const form = document.getElementById('editGroupForm');
        if (form) {
            form.dataset.editGroupId = groupId;
        }

        this.closeGroupMenus();
        this.showModal('editGroupModal');
    }

    deleteGroup(groupId) {
        const group = this.getGroupById(groupId);
        if (!group) return;

        const profilesInGroup = this.profiles.filter(p => p.groupId === groupId);
        let confirmMessage = `Bạn có chắc muốn xóa nhóm "${group.name}"?`;
        
        if (profilesInGroup.length > 0) {
            confirmMessage += `\n\n${profilesInGroup.length} profile(s) trong nhóm này sẽ được chuyển về "Không nhóm".`;
        }

        if (!confirm(confirmMessage)) return;

        // Remove group from list
        this.groups = this.groups.filter(g => g.id !== groupId);

        // Update profiles that were in this group
        this.profiles.forEach(profile => {
            if (profile.groupId === groupId) {
                delete profile.groupId;
            }
        });

        // Update current filter if deleted group was selected
        if (this.currentGroupFilter === groupId) {
            this.currentGroupFilter = '';
        }

        this.saveData();
        this.renderGroupFilter();
        this.renderGroupsSidebar();
        this.updateProfileGroupSelect();
        this.renderProfiles();
        this.filterProfilesByGroup();

        this.closeGroupMenus();
        this.showToast(`Nhóm "${group.name}" đã được xóa`, 'success');
    }

    // Card Management Methods
    loadCards() {
        const savedCards = localStorage.getItem('chromeManager_cards');
        if (savedCards) {
            this.cards = JSON.parse(savedCards);
        }
    }

    saveCards() {
        localStorage.setItem('chromeManager_cards', JSON.stringify(this.cards));
    }

    showAddCardModal(cardData = null) {
        const modal = document.getElementById('addCardModal');
        const title = document.getElementById('addCardModalTitle');
        const form = document.getElementById('addCardForm');
        
        if (cardData) {
            title.textContent = 'Chỉnh sửa thẻ';
            document.getElementById('cardName').value = cardData.name || '';
            document.getElementById('cardNote').value = cardData.note || '';
            form.dataset.editId = cardData.id;
        } else {
            title.textContent = 'Thêm thẻ mới';
            form.reset();
            delete form.dataset.editId;
        }
        
        this.showModal('addCardModal');
    }

    async saveCard() {
        const form = document.getElementById('addCardForm');
        const formData = new FormData(form);
        
        const cardData = {
            name: formData.get('cardName').trim(),
            note: formData.get('cardNote').trim(),
            created: new Date().toISOString()
        };

        if (!cardData.name) {
            this.showToast('Vui lòng nhập tên thẻ', 'error');
            return;
        }

        try {
            if (form.dataset.editId) {
                // Edit existing card
                const cardIndex = this.cards.findIndex(card => card.id === form.dataset.editId);
                if (cardIndex !== -1) {
                    this.cards[cardIndex] = { ...this.cards[cardIndex], ...cardData };
                    this.showToast('Cập nhật thẻ thành công', 'success');
                }
            } else {
                // Add new card
                cardData.id = 'card_' + Date.now();
                this.cards.push(cardData);
                this.showToast('Thêm thẻ thành công', 'success');
            }

            this.saveCards();
            this.renderCards();
            this.updateProfileCardSelect();
            this.hideModal('addCardModal');
            
        } catch (error) {
            console.error('Error saving card:', error);
            this.showToast('Lỗi khi lưu thẻ: ' + error.message, 'error');
        }
    }

    deleteCard(cardId) {
        if (confirm('Bạn có chắc chắn muốn xóa thẻ này?')) {
            this.cards = this.cards.filter(card => card.id !== cardId);
            this.saveCards();
            this.renderCards();
            this.updateProfileCardSelect();
            this.showToast('Xóa thẻ thành công', 'success');
        }
    }

    renderCards() {
        const cardsList = document.getElementById('cardsList');
        if (!cardsList) return;

        if (this.cards.length === 0) {
            cardsList.innerHTML = `
                <div class="cards-empty">
                    <i class="fas fa-credit-card"></i>
                    <h3>Chưa có thẻ nào</h3>
                    <p>Thêm thẻ đầu tiên để bắt đầu quản lý thông tin thẻ</p>
                    <button class="btn btn-primary" onclick="chromeManager.showAddCardModal()">
                        <i class="fas fa-plus"></i> Thêm thẻ mới
                    </button>
                </div>
            `;
            return;
        }

        cardsList.innerHTML = this.cards.map(card => {
            const displayInfo = [];
            if (card.note) displayInfo.push(card.note);
            
            return `
                <div class="card-item">
                    <div class="card-info">
                        <div class="card-name">${card.name}</div>
                        ${displayInfo.length > 0 ? `<div class="card-details">${displayInfo.join(' • ')}</div>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="card-action-btn edit" onclick="chromeManager.editCard('${card.id}')" title="Chỉnh sửa">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="card-action-btn delete" onclick="chromeManager.deleteCard('${card.id}')" title="Xóa">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Update pagination info
        const paginationInfo = document.getElementById('cardsPaginationInfo');
        if (paginationInfo) {
            paginationInfo.textContent = `1-${this.cards.length} trên ${this.cards.length}`;
        }
    }

    editCard(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (card) {
            this.showAddCardModal(card);
        }
    }

    // Handle proxy tab click with immediate feedback
    handleProxyTabClick(tabElement) {
        const proxyType = tabElement.dataset.proxyType;
        if (!proxyType) return;
        
        // Debounce rapid clicks
        const now = Date.now();
        if (now - this.lastTabClickTime < this.tabClickDebounce) {
            return;
        }
        this.lastTabClickTime = now;
        
        // Immediate visual feedback - update UI instantly
        document.querySelectorAll('.proxy-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        tabElement.classList.add('active');
        
        // Update content immediately
        document.querySelectorAll('.proxy-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const selectedContent = document.getElementById(`proxy-${proxyType}`);
        if (selectedContent) {
            selectedContent.classList.add('active');
        }
        
        // Add clicked state for visual feedback
        tabElement.style.transform = 'scale(0.98)';
        setTimeout(() => {
            tabElement.style.transform = '';
        }, 100);
        
        // Then handle data loading asynchronously
        this.switchProxyTabContent(proxyType);
    }

    // Async content loading for proxy tabs
    async switchProxyTabContent(proxyType) {
        // Update last active tab
        this.lastProxyTab = proxyType;
        
        // Only load existing proxies if switching to existing tab AND it's different from last content load
        if (proxyType === 'existing') {
            await this.loadExistingProxiesOptimized();
        }
    }

    // Edit Profile Dropdown Functions
    toggleEditDropdown() {
        const dropdown = document.getElementById('editProfileDropdown');
        dropdown.classList.toggle('active');
    }

    showEditCardsModal() {
        const selectedProfileIds = Array.from(this.selectedProfiles);
        if (selectedProfileIds.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile', 'warning');
            return;
        }

        // Hide dropdown
        document.getElementById('editProfileDropdown').classList.remove('active');

        // Update modal content
        document.getElementById('editCardsCount').textContent = selectedProfileIds.length;
        
        // Show selected profiles
        const selectedProfiles = this.profiles.filter(p => selectedProfileIds.includes(p.id));
        this.renderSelectedProfilesPreview('editCardsProfiles', selectedProfiles);

        // Load cards into select
        this.loadCardsIntoSelect('selectedCard');

        this.showModal('editCardsModal');
    }

    showEditGroupsModal() {
        const selectedProfileIds = Array.from(this.selectedProfiles);
        if (selectedProfileIds.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile', 'warning');
            return;
        }

        // Hide dropdown
        document.getElementById('editProfileDropdown').classList.remove('active');

        // Update modal content
        document.getElementById('editGroupsCount').textContent = selectedProfileIds.length;
        
        // Show selected profiles
        const selectedProfiles = this.profiles.filter(p => selectedProfileIds.includes(p.id));
        this.renderSelectedProfilesPreview('editGroupsProfiles', selectedProfiles);

        // Load groups into select
        this.loadGroupsIntoSelect('selectedGroup');

        this.showModal('editGroupsModal');
    }

    showEditBookmarksModal() {
        const selectedProfileIds = Array.from(this.selectedProfiles);
        if (selectedProfileIds.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile', 'warning');
            return;
        }

        // Hide dropdown
        document.getElementById('editProfileDropdown').classList.remove('active');

        // Update modal content
        document.getElementById('editBookmarksCount').textContent = selectedProfileIds.length;
        
        // Show selected profiles
        const selectedProfiles = this.profiles.filter(p => selectedProfileIds.includes(p.id));
        this.renderSelectedProfilesPreview('editBookmarksProfiles', selectedProfiles);

        // Setup bookmark preset buttons
        this.setupBookmarkPresets();

        // Setup add bookmark row functionality
        this.setupBookmarkRowEvents();

        this.showModal('editBookmarksModal');
    }

    showEditTabsModal() {
        const selectedProfileIds = Array.from(this.selectedProfiles);
        if (selectedProfileIds.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile', 'warning');
            return;
        }

        // Hide dropdown
        document.getElementById('editProfileDropdown').classList.remove('active');

        // Update modal content
        document.getElementById('editTabsCount').textContent = selectedProfileIds.length;
        
        // Show selected profiles
        const selectedProfiles = this.profiles.filter(p => selectedProfileIds.includes(p.id));
        this.renderSelectedProfilesPreview('editTabsProfiles', selectedProfiles);

        // Setup tab row events
        this.setupTabRowEvents();

        this.showModal('editTabsModal');
    }

    showRemoveProxyModal() {
        const selectedProfileIds = Array.from(this.selectedProfiles);
        if (selectedProfileIds.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile', 'warning');
            return;
        }

        // Hide dropdown
        document.getElementById('editProfileDropdown').classList.remove('active');
        
        // Update message
        document.getElementById('removeProxyMessage').textContent = 
            `Bạn có chắc chắn muốn gỡ bỏ proxy khỏi các hồ sơ đã chọn?`;

        // Show selected count
        document.getElementById('removeProxyCount').textContent = 
            `${selectedProfileIds.length} hồ sơ được chọn`;

        this.showModal('removeProxyModal');
    }

    renderSelectedProfilesPreview(containerId, profiles) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <h4><i class="fas fa-users"></i> Hồ sơ đã chọn (${profiles.length})</h4>
            <div class="selected-profiles-list">
                ${profiles.map(profile => `
                    <div class="selected-profile-tag">
                        <i class="fas fa-user"></i>
                        ${profile.name}
                    </div>
                `).join('')}
            </div>
        `;
    }

    loadCardsIntoSelect(selectId) {
        const select = document.getElementById(selectId);
        select.innerHTML = `
            <option value="">-- Chọn thẻ --</option>
            <option value="remove">🗑️ Gỡ thẻ hiện tại</option>
        `;

        this.cards.forEach(card => {
            const option = document.createElement('option');
            option.value = card.id;
            option.textContent = card.name;
            select.appendChild(option);
        });
    }

    loadGroupsIntoSelect(selectId) {
        const select = document.getElementById(selectId);
        select.innerHTML = `
            <option value="">-- Không nhóm --</option>
            <option value="remove">🗑️ Gỡ khỏi nhóm hiện tại</option>
        `;

        this.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            select.appendChild(option);
        });
    }

    // Bulk Import Proxy Methods
    showBulkImportProxyModal() {
        const selectedProfileIds = Array.from(this.selectedProfiles);
        if (selectedProfileIds.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một profile', 'warning');
            return;
        }

        // Hide dropdown
        document.getElementById('editProfileDropdown').classList.remove('active');

        // Update modal content
        document.getElementById('bulkImportProxyCount').textContent = selectedProfileIds.length;
        
        // Show selected profiles
        const selectedProfiles = this.profiles.filter(p => selectedProfileIds.includes(p.id));
        this.renderSelectedProfilesPreview('bulkImportProxyProfiles', selectedProfiles);

        // Clear previous data
        document.getElementById('bulkProxyList').value = '';
        document.getElementById('bulkProxyMethod').value = 'sequential';
        document.getElementById('proxySourceType').value = 'manual';
        this.hideBulkProxyPreview();
        this.handleProxySourceChange();

        this.showModal('bulkImportProxyModal');
    }

    // Handle proxy source type change
    handleProxySourceChange() {
        const sourceType = document.getElementById('proxySourceType').value;
        const manualSection = document.getElementById('manualProxySection');
        const existingSection = document.getElementById('existingProxySection');
        const removeSection = document.getElementById('removeProxySection');
        const methodGroup = document.querySelector('#bulkProxyMethod').closest('.form-group');
        const checkBtn = document.getElementById('checkBulkProxiesBtn');
        const applyBtn = document.getElementById('applyBulkProxyChanges');

        // Hide all sections first
        manualSection.style.display = 'none';
        existingSection.style.display = 'none';
        removeSection.style.display = 'none';
        methodGroup.style.display = 'none';
        checkBtn.style.display = 'none';
        this.hideBulkProxyPreview();

        switch (sourceType) {
            case 'manual':
                manualSection.style.display = 'block';
                methodGroup.style.display = 'block';
                checkBtn.style.display = 'inline-flex';
                applyBtn.innerHTML = '<i class="fas fa-upload"></i> Áp dụng';
                break;
            
            case 'existing':
                existingSection.style.display = 'block';
                methodGroup.style.display = 'block';
                this.renderExistingProxySelection();
                applyBtn.innerHTML = '<i class="fas fa-link"></i> Áp dụng Proxy Có Sẵn';
                break;
            
            case 'remove':
                removeSection.style.display = 'block';
                applyBtn.innerHTML = '<i class="fas fa-unlink"></i> Gỡ Bỏ Proxy';
                break;
        }
    }

    // Render existing proxy selection grid
    renderExistingProxySelection() {
        const grid = document.getElementById('existingProxyGrid');
        
        if (this.proxies.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #64748b;">
                    <i class="fas fa-server" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    Không có proxy nào trong hệ thống
                </div>
            `;
            return;
        }

        grid.innerHTML = this.proxies.map(proxy => {
            const usageCount = this.getProxyUsageCount(proxy.id);
            let usageClass = 'low';
            if (usageCount >= 5) usageClass = 'high';
            else if (usageCount >= 2) usageClass = 'medium';

            const statusClass = proxy.status || 'unchecked';
            const statusIcon = {
                'working': 'fas fa-check-circle',
                'error': 'fas fa-times-circle',
                'timeout': 'fas fa-clock',
                'unchecked': 'fas fa-question-circle'
            }[statusClass] || 'fas fa-question-circle';

            const statusText = {
                'working': 'Hoạt động',
                'error': 'Lỗi',
                'timeout': 'Timeout',
                'unchecked': 'Chưa kiểm tra'
            }[statusClass] || 'Không rõ';

            return `
                <div class="existing-proxy-item" onclick="chromeManager.toggleProxySelection('${proxy.id}')">
                    <input type="checkbox" class="proxy-checkbox" id="proxy_${proxy.id}">
                    <div class="existing-proxy-info">
                        <div class="existing-proxy-host">${proxy.host}:${proxy.port}</div>
                        <div class="existing-proxy-details">
                            <span class="existing-proxy-usage ${usageClass}">
                                <i class="fas fa-users"></i> ${usageCount}
                            </span>
                            <span class="existing-proxy-status ${statusClass}">
                                <i class="${statusIcon}"></i> ${statusText}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Toggle proxy selection
    toggleProxySelection(proxyId) {
        const checkbox = document.getElementById(`proxy_${proxyId}`);
        const item = checkbox ? checkbox.closest('.existing-proxy-item') : null;
        
        if (checkbox && item) {
            if (checkbox.checked) {
                checkbox.checked = false;
                item.classList.remove('selected');
            } else {
                checkbox.checked = true;
                item.classList.add('selected');
            }
        }
    }

    previewBulkProxies() {
        const proxyListText = document.getElementById('bulkProxyList').value.trim();
        
        if (!proxyListText) {
            this.hideBulkProxyPreview();
            return;
        }

        const proxies = this.parseBulkProxyList(proxyListText);
        this.displayBulkProxyPreview(proxies);
    }

    parseBulkProxyList(proxyListText) {
        const lines = proxyListText.split('\n').filter(line => line.trim());
        const validProxies = [];
        const errors = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            try {
                const parsed = this.parseProxyString(trimmedLine);
                if (parsed) {
                    validProxies.push({
                        ...parsed,
                        originalLine: trimmedLine,
                        lineNumber: index + 1
                    });
                } else {
                    errors.push({
                        line: trimmedLine,
                        lineNumber: index + 1,
                        error: 'Định dạng không hợp lệ'
                    });
                }
            } catch (error) {
                errors.push({
                    line: trimmedLine,
                    lineNumber: index + 1,
                    error: error.message
                });
            }
        });

        return { validProxies, errors };
    }

    displayBulkProxyPreview(result) {
        const { validProxies, errors } = result;
        const previewContainer = document.getElementById('bulkProxyPreview');
        const countSpan = document.getElementById('bulkPreviewCount');
        const listContainer = document.getElementById('bulkProxyPreviewList');

        countSpan.textContent = validProxies.length;
        
        let html = '';
        
        // Show valid proxies
        validProxies.forEach(proxy => {
            html += `
                <div class="proxy-preview-item valid">
                    <div class="proxy-info">
                        <div class="proxy-host">${proxy.host}:${proxy.port}</div>
                        <div class="proxy-details">
                            ${proxy.type.toUpperCase()} • ${proxy.username ? `Auth: ${proxy.username}` : 'Không auth'} • Line ${proxy.lineNumber}
                        </div>
                    </div>
                    <div class="proxy-status valid">
                        <i class="fas fa-check-circle"></i>
                        Hợp lệ
                    </div>
                </div>
            `;
        });

        // Show errors
        errors.forEach(error => {
            html += `
                <div class="proxy-preview-item error">
                    <div class="proxy-info">
                        <div class="proxy-host">${error.line}</div>
                        <div class="proxy-details">Line ${error.lineNumber}: ${error.error}</div>
                    </div>
                    <div class="proxy-status error">
                        <i class="fas fa-times-circle"></i>
                        Lỗi
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
        previewContainer.style.display = 'block';

        // Store parsed data for later use
        this.bulkParsedProxyData = result;
    }

    hideBulkProxyPreview() {
        document.getElementById('bulkProxyPreview').style.display = 'none';
        this.bulkParsedProxyData = null;
    }

    async checkBulkProxies() {
        if (!this.bulkParsedProxyData || this.bulkParsedProxyData.validProxies.length === 0) {
            this.showToast('Vui lòng nhập danh sách proxy hợp lệ', 'warning');
            return;
        }

        const button = document.getElementById('checkBulkProxiesBtn');
        const originalText = button.innerHTML;
        
        try {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...';
            button.disabled = true;

            this.showToast('Đang kiểm tra proxy...', 'info');

            // Check each proxy
            const { validProxies } = this.bulkParsedProxyData;
            let workingCount = 0;
            let errorCount = 0;

            for (const proxy of validProxies) {
                try {
                    const result = await window.electronAPI.testProxy({
                        host: proxy.host,
                        port: proxy.port,
                        username: proxy.username,
                        password: proxy.password,
                        type: proxy.type
                    });

                    if (result.success) {
                        workingCount++;
                        proxy.status = 'working';
                    } else {
                        errorCount++;
                        proxy.status = 'error';
                        proxy.error = result.error;
                    }
                } catch (error) {
                    errorCount++;
                    proxy.status = 'error';
                    proxy.error = error.message;
                }
            }

            // Update preview with test results
            this.displayBulkProxyPreview(this.bulkParsedProxyData);
            
            this.showToast(
                `Kiểm tra hoàn tất: ${workingCount} hoạt động, ${errorCount} lỗi`, 
                workingCount > 0 ? 'success' : 'warning'
            );

        } catch (error) {
            this.showToast('Lỗi khi kiểm tra proxy: ' + error.message, 'error');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async applyBulkProxyChanges() {
        const sourceType = document.getElementById('proxySourceType').value;
        const selectedProfileIds = Array.from(this.selectedProfiles);

        if (sourceType === 'remove') {
            return this.applyBulkRemoveProxy(selectedProfileIds);
        } else if (sourceType === 'existing') {
            return this.applyBulkExistingProxy(selectedProfileIds);
        } else {
            return this.applyBulkManualProxy(selectedProfileIds);
        }
    }

    // Apply bulk remove proxy
    async applyBulkRemoveProxy(selectedProfileIds) {
        const confirmResult = await this.showConfirm(
            `Bạn có chắc chắn muốn gỡ bỏ proxy khỏi ${selectedProfileIds.length} hồ sơ đã chọn?`,
            'Gỡ bỏ proxy',
            'warning'
        );
        
        if (!confirmResult) return;

        try {
            this.showLoading(true, 'Đang gỡ bỏ proxy...');
            let successCount = 0;

            for (const profileId of selectedProfileIds) {
                try {
                    const result = await window.electronAPI.updateProfileProxy(profileId, null);
                    if (result.success) {
                        // Update local data
                        const profile = this.profiles.find(p => p.id === profileId);
                        if (profile) {
                            profile.proxy = null;
                        }
                        successCount++;
                    }
                } catch (error) {
                    console.error(`Error removing proxy from profile ${profileId}:`, error);
                }
            }

            this.refreshProxyUsageCounts();
            this.renderProfiles();
            this.hideModal('bulkImportProxyModal');
            this.showToast(`Đã gỡ bỏ proxy khỏi ${successCount}/${selectedProfileIds.length} profiles`, 'success');

        } catch (error) {
            console.error('Error in bulk remove proxy:', error);
            this.showToast('Lỗi khi gỡ bỏ proxy: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Apply bulk existing proxy
    async applyBulkExistingProxy(selectedProfileIds) {
        const selectedProxies = Array.from(document.querySelectorAll('#existingProxyGrid .proxy-checkbox:checked'))
            .map(checkbox => {
                const proxyId = checkbox.id.replace('proxy_', '');
                return this.proxies.find(p => p.id === proxyId);
            })
            .filter(Boolean);

        if (selectedProxies.length === 0) {
            this.showToast('Vui lòng chọn ít nhất một proxy', 'warning');
            return;
        }

        const method = document.getElementById('bulkProxyMethod').value;

        if (method === 'sequential' && selectedProxies.length < selectedProfileIds.length) {
            const proceed = await this.showConfirm(
                `Bạn có ${selectedProfileIds.length} profiles nhưng chỉ chọn ${selectedProxies.length} proxy.\n\nMột số profile sẽ không có proxy. Bạn có muốn tiếp tục?`,
                'Cảnh báo số lượng proxy',
                'warning'
            );
            if (!proceed) return;
        }

        try {
            this.showLoading(true, 'Đang áp dụng proxy có sẵn...');
            let successCount = 0;

            for (let i = 0; i < selectedProfileIds.length; i++) {
                const profileId = selectedProfileIds[i];
                let selectedProxy;

                switch (method) {
                    case 'sequential':
                        selectedProxy = selectedProxies[i % selectedProxies.length];
                        break;
                    case 'random':
                        selectedProxy = selectedProxies[Math.floor(Math.random() * selectedProxies.length)];
                        break;
                    case 'single':
                        selectedProxy = selectedProxies[0];
                        break;
                }

                if (selectedProxy) {
                    const proxyConfig = {
                        host: selectedProxy.host,
                        port: selectedProxy.port,
                        type: selectedProxy.type || 'http',
                        username: selectedProxy.username || '',
                        password: selectedProxy.password || ''
                    };

                    try {
                        const result = await window.electronAPI.updateProfileProxy(profileId, proxyConfig);
                        if (result.success) {
                            // Update local data
                            const profile = this.profiles.find(p => p.id === profileId);
                            if (profile) {
                                profile.proxy = proxyConfig;
                            }
                            successCount++;
                        }
                    } catch (error) {
                        console.error(`Error updating profile ${profileId}:`, error);
                    }
                }
            }

            this.refreshProxyUsageCounts();
            this.renderProfiles();
            this.hideModal('bulkImportProxyModal');
            this.showToast(`Đã áp dụng proxy cho ${successCount}/${selectedProfileIds.length} profiles`, 'success');

        } catch (error) {
            console.error('Error in bulk existing proxy:', error);
            this.showToast('Lỗi khi áp dụng proxy: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Apply bulk manual proxy (original function)
    async applyBulkManualProxy(selectedProfileIds) {
        if (!this.bulkParsedProxyData || this.bulkParsedProxyData.validProxies.length === 0) {
            this.showToast('Vui lòng nhập danh sách proxy hợp lệ', 'warning');
            return;
        }

        const { validProxies } = this.bulkParsedProxyData;
        const method = document.getElementById('bulkProxyMethod').value;

        // Track new proxies added
        const initialProxyCount = this.proxies.length;

        if (method === 'sequential' && validProxies.length < selectedProfileIds.length) {
            const proceed = await this.showConfirm(
                `Bạn có ${selectedProfileIds.length} profiles nhưng chỉ có ${validProxies.length} proxy.\n\nMột số profile sẽ không có proxy. Bạn có muốn tiếp tục?`,
                'Cảnh báo số lượng proxy',
                'warning'
            );
            if (!proceed) return;
        }

        try {
            this.showLoading(true, 'Đang áp dụng proxy...');

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < selectedProfileIds.length; i++) {
                const profileId = selectedProfileIds[i];
                let proxyToAssign = null;

                // Determine which proxy to assign based on method
                switch (method) {
                    case 'sequential':
                        if (i < validProxies.length) {
                            proxyToAssign = validProxies[i];
                        }
                        break;
                    case 'random':
                        proxyToAssign = validProxies[Math.floor(Math.random() * validProxies.length)];
                        break;
                    case 'single':
                        proxyToAssign = validProxies[0];
                        break;
                }

                if (proxyToAssign) {
                    const proxyConfig = {
                        host: proxyToAssign.host,
                        port: proxyToAssign.port,
                        username: proxyToAssign.username || '',
                        password: proxyToAssign.password || '',
                        type: proxyToAssign.type || 'http'
                    };

                    // Ensure proxy exists in management, add if not
                    await this.ensureProxyExists(proxyConfig, false); // Don't show individual toast for bulk operations

                    const result = await window.electronAPI.updateProfile(profileId, {
                        proxy: proxyConfig
                    });

                    if (result.success) {
                        // Update local data
                        const profile = this.profiles.find(p => p.id === profileId);
                        if (profile) {
                            profile.proxy = proxyConfig;
                        }
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } else {
                    // No proxy to assign (sequential method with insufficient proxies)
                    const result = await window.electronAPI.updateProfile(profileId, {
                        proxy: null
                    });
                    if (result.success) {
                        const profile = this.profiles.find(p => p.id === profileId);
                        if (profile) {
                            profile.proxy = null;
                        }
                    }
                }
            }

            // Invalidate proxy cache since data changed
            this.invalidateProxyCache();
            
            this.renderProfiles();
            this.renderProxies(); // Update proxy usage count
            this.renderExistingProxyList(); // Update existing proxy list
            this.hideModal('bulkImportProxyModal');
            
            // Calculate and show results
            const newProxiesAdded = this.proxies.length - initialProxyCount;
            
            let resultMessage = '';
            if (errorCount === 0) {
                resultMessage = `Đã áp dụng proxy cho ${successCount} hồ sơ`;
            } else {
                resultMessage = `Đã áp dụng ${successCount}/${selectedProfileIds.length} hồ sơ. ${errorCount} lỗi`;
            }
            
            if (newProxiesAdded > 0) {
                resultMessage += `. Đã thêm ${newProxiesAdded} proxy mới vào quản lý`;
            }
            
            this.showToast(resultMessage, errorCount === 0 ? 'success' : 'warning');

        } catch (error) {
            console.error('Error applying bulk proxy changes:', error);
            this.showToast('Lỗi khi áp dụng proxy: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async applyCardChanges() {
        const selectedCardId = document.getElementById('selectedCard').value;
        const selectedProfileIds = Array.from(this.selectedProfiles);

        if (!selectedCardId && selectedCardId !== '') {
            this.showToast('Vui lòng chọn thẻ', 'warning');
            return;
        }

        try {
            this.showLoading(true, 'Đang cập nhật thẻ...');

            let successCount = 0;
            for (const profileId of selectedProfileIds) {
                const cardToAssign = selectedCardId === 'remove' ? null : 
                                   selectedCardId === '' ? null : selectedCardId;

                const result = await window.electronAPI.updateProfile(profileId, {
                    cardId: cardToAssign
                });

                if (result.success) {
                    // Update local data
                    const profile = this.profiles.find(p => p.id === profileId);
                    if (profile) {
                        profile.cardId = cardToAssign;
                    }
                    successCount++;
                }
            }

            this.renderProfiles();
            this.hideModal('editCardsModal');
            
            if (successCount === selectedProfileIds.length) {
                this.showToast(`Đã cập nhật thẻ cho ${successCount} hồ sơ`, 'success');
            } else {
                this.showToast(`Đã cập nhật ${successCount}/${selectedProfileIds.length} hồ sơ`, 'warning');
            }

        } catch (error) {
            console.error('Error updating cards:', error);
            this.showToast('Lỗi khi cập nhật thẻ: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async applyGroupChanges() {
        const selectedGroupId = document.getElementById('selectedGroup').value;
        const selectedProfileIds = Array.from(this.selectedProfiles);

        try {
            this.showLoading(true, 'Đang cập nhật nhóm...');

            let successCount = 0;
            for (const profileId of selectedProfileIds) {
                const groupToAssign = selectedGroupId === 'remove' ? null : 
                                     selectedGroupId === '' ? null : selectedGroupId;

                const result = await window.electronAPI.updateProfile(profileId, {
                    groupId: groupToAssign
                });

                if (result.success) {
                    // Update local data
                    const profile = this.profiles.find(p => p.id === profileId);
                    if (profile) {
                        profile.groupId = groupToAssign;
                    }
                    successCount++;
                }
            }

            this.renderProfiles();
            this.hideModal('editGroupsModal');
            
            if (successCount === selectedProfileIds.length) {
                this.showToast(`Đã cập nhật nhóm cho ${successCount} hồ sơ`, 'success');
            } else {
                this.showToast(`Đã cập nhật ${successCount}/${selectedProfileIds.length} hồ sơ`, 'warning');
            }

        } catch (error) {
            console.error('Error updating groups:', error);
            this.showToast('Lỗi khi cập nhật nhóm: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async applyBookmarks() {
        console.log('🔖 Starting applyBookmarks...');
        
        const selectedProfileIds = Array.from(this.selectedProfiles);
        console.log('Selected profiles:', selectedProfileIds);
        
        const bookmarkRows = document.querySelectorAll('.bookmark-row');
        console.log('Bookmark rows found:', bookmarkRows.length);
        
        // Collect bookmark data from form
        const bookmarks = [];
        for (const row of bookmarkRows) {
            const nameInput = row.querySelector('.bookmark-name');
            const urlInput = row.querySelector('.bookmark-url');
            
            console.log('Row inputs:', {
                name: nameInput?.value,
                url: urlInput?.value
            });
            
            if (nameInput.value.trim() && urlInput.value.trim()) {
                bookmarks.push({
                    name: nameInput.value.trim(),
                    url: urlInput.value.trim()
                });
            }
        }

        console.log('Collected bookmarks:', bookmarks);

        if (bookmarks.length === 0) {
            console.log('No bookmarks to add');
            this.showToast('Vui lòng nhập ít nhất một dấu trang', 'warning');
            return;
        }

        try {
            this.showLoading(true, 'Đang thêm dấu trang...');

            let successCount = 0;
            for (const profileId of selectedProfileIds) {
                console.log(`Adding bookmarks to profile: ${profileId}`);
                
                const result = await window.electronAPI.addBookmarksToProfile(profileId, bookmarks);
                console.log(`Result for profile ${profileId}:`, result);

                if (result.success) {
                    successCount++;
                }
            }

            this.hideModal('editBookmarksModal');
            
            if (successCount === selectedProfileIds.length) {
                this.showToast(`Đã thêm ${bookmarks.length} dấu trang cho ${successCount} hồ sơ. Nhấn F5 hoặc đóng/mở lại Chrome để xem dấu trang.`, 'success');
            } else {
                this.showToast(`Đã thêm dấu trang cho ${successCount}/${selectedProfileIds.length} hồ sơ. Nhấn F5 hoặc đóng/mở lại Chrome để xem dấu trang.`, 'warning');
            }

        } catch (error) {
            console.error('Error adding bookmarks:', error);
            this.showToast('Lỗi khi thêm dấu trang: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async confirmRemoveProxy() {
        const selectedProfileIds = Array.from(this.selectedProfiles);

        try {
            this.showLoading(true, 'Đang gỡ proxy...');

            let successCount = 0;
            for (const profileId of selectedProfileIds) {
                const result = await window.electronAPI.updateProfile(profileId, {
                    proxy: null
                });

                if (result.success) {
                    // Update local data
                    const profile = this.profiles.find(p => p.id === profileId);
                    if (profile) {
                        profile.proxy = null;
                    }
                    successCount++;
                }
            }

            this.renderProfiles();
            this.hideModal('removeProxyModal');
            
            if (successCount === selectedProfileIds.length) {
                this.showToast(`Đã gỡ proxy khỏi ${successCount} hồ sơ`, 'success');
            } else {
                this.showToast(`Đã gỡ proxy khỏi ${successCount}/${selectedProfileIds.length} hồ sơ`, 'warning');
            }

        } catch (error) {
            console.error('Error removing proxy:', error);
            this.showToast('Lỗi khi gỡ proxy: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Proxy Test Functions
    async testProxyConnection() {
        const host = document.getElementById('proxyHost').value.trim();
        const port = document.getElementById('proxyPort').value.trim();
        const username = document.getElementById('proxyUsername').value.trim();
        const password = document.getElementById('proxyPassword').value.trim();
        const type = document.getElementById('proxyType').value;

        if (!host || !port) {
            this.showToast('Vui lòng nhập host và port', 'warning');
            return;
        }

        try {
            const button = document.getElementById('testProxyBtn');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang test...';
            button.disabled = true;

            // Call proxy test API
            const result = await window.electronAPI.testProxy({
                host,
                port,
                username,
                password,
                type
            });

            if (result.success) {
                this.showToast('Proxy hoạt động tốt!', 'success');
            } else {
                this.showToast('Proxy không hoạt động: ' + result.error, 'error');
            }

        } catch (error) {
            this.showToast('Lỗi khi test proxy: ' + error.message, 'error');
        } finally {
            const button = document.getElementById('testProxyBtn');
            button.innerHTML = '<i class="fas fa-flask"></i> Kiểm tra';
            button.disabled = false;
        }
    }

    saveProxyToProfile() {
        const host = document.getElementById('proxyHost').value.trim();
        const port = document.getElementById('proxyPort').value.trim();
        
        if (!host || !port) {
            this.showToast('Vui lòng nhập đầy đủ thông tin proxy', 'warning');
            return;
        }

        this.showToast('Proxy đã được lưu vào profile', 'success');
    }

    async testProxyToken() {
        const token = document.getElementById('proxyToken').value.trim();
        
        if (!token) {
            this.showToast('Vui lòng nhập proxy token', 'warning');
            return;
        }

        try {
            const button = document.getElementById('testTokenBtn');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang test...';
            button.disabled = true;

            // Parse and test proxy token
            const parsedProxy = this.parseProxyToken(token);
            if (!parsedProxy) {
                this.showToast('Proxy token không hợp lệ', 'error');
                return;
            }

            const result = await window.electronAPI.testProxy(parsedProxy);
            
            if (result.success) {
                this.showToast('Proxy token hoạt động tốt!', 'success');
            } else {
                this.showToast('Proxy token không hoạt động: ' + result.error, 'error');
            }

        } catch (error) {
            this.showToast('Lỗi khi test proxy token: ' + error.message, 'error');
        } finally {
            const button = document.getElementById('testTokenBtn');
            button.innerHTML = '<i class="fas fa-flask"></i> Kiểm tra';
            button.disabled = false;
        }
    }

    saveProxyTokenToProfile() {
        const token = document.getElementById('proxyToken').value.trim();
        
        if (!token) {
            this.showToast('Vui lòng nhập proxy token', 'warning');
            return;
        }

        const parsedProxy = this.parseProxyToken(token);
        if (!parsedProxy) {
            this.showToast('Proxy token không hợp lệ', 'error');
            return;
        }

        this.showToast('Proxy token đã được lưu vào profile', 'success');
    }

    parseProxyToken(token) {
        try {
            // Basic proxy token parsing - implement more sophisticated parsing as needed
            // Support formats like: host:port:username:password or http://user:pass@host:port
            
            if (token.includes('://')) {
                // URL format: http://user:pass@host:port
                const url = new URL(token);
                let proxyType = url.protocol.replace(':', '').toLowerCase();
                
                // Normalize proxy types for Chrome compatibility
                if (proxyType === 'https') {
                    proxyType = 'http';
                }
                
                return {
                    host: url.hostname,
                    port: url.port || (proxyType === 'http' ? '8080' : '1080'),
                    username: url.username || '',
                    password: url.password || '',
                    type: proxyType
                };
            } else {
                // Simple format: host:port:username:password
                const parts = token.split(':');
                if (parts.length >= 2) {
                    return {
                        host: parts[0],
                        port: parts[1],
                        username: parts[2] || '',
                        password: parts[3] || '',
                        type: 'http' // Default to HTTP
                    };
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error parsing proxy token:', error);
            return null;
        }
    }

    // Auto-parse proxy input when user pastes full proxy string
    autoParseProxyInput() {
        const hostInput = document.getElementById('proxyHost');
        if (!hostInput) return;

        const inputValue = hostInput.value.trim();
        if (!inputValue) return;

        // Check if input contains colons (potential full proxy format)
        if (inputValue.includes(':')) {
            const parsed = this.parseProxyString(inputValue);
            if (parsed) {
                // Fill the form fields
                hostInput.value = parsed.host;
                
                const portInput = document.getElementById('proxyPort');
                const usernameInput = document.getElementById('proxyUsername');
                const passwordInput = document.getElementById('proxyPassword');
                const typeSelect = document.getElementById('proxyType');

                if (portInput) portInput.value = parsed.port;
                if (usernameInput) usernameInput.value = parsed.username;
                if (passwordInput) passwordInput.value = parsed.password;
                if (typeSelect && parsed.type) typeSelect.value = parsed.type.toUpperCase();

                // Show success message
                this.showToast('✅ Proxy đã được parse tự động!', 'success');
            }
        }
    }

    parseProxyString(proxyString) {
        try {
            // Handle URL format: http://user:pass@host:port
            if (proxyString.includes('://')) {
                const url = new URL(proxyString);
                let proxyType = url.protocol.replace(':', '').toLowerCase();
                
                if (proxyType === 'https') {
                    proxyType = 'http';
                }
                
                return {
                    host: url.hostname,
                    port: url.port || (proxyType === 'http' ? '8080' : '1080'),
                    username: url.username || '',
                    password: url.password || '',
                    type: proxyType
                };
            }
            
            // Handle simple format: host:port:username:password
            const parts = proxyString.split(':');
            if (parts.length >= 2) {
                return {
                    host: parts[0],
                    port: parts[1],
                    username: parts[2] || '',
                    password: parts[3] || '',
                    type: 'http' // Default
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error parsing proxy string:', error);
            return null;
        }
    }

    // Optimized load existing proxies with cache
    async loadExistingProxiesOptimized() {
        try {
            // Prevent multiple simultaneous loads
            if (this.proxiesCache.isLoading) {
                return;
            }
            
            const now = Date.now();
            
            // Check if cache is still valid
            if (this.proxiesCache.data && 
                (now - this.proxiesCache.lastUpdated) < this.proxiesCache.cacheTimeout) {
                // Use cached data - render immediately without lag
                this.proxies = this.proxiesCache.data;
                this.renderExistingProxyList();
                return;
            }
            
            // Set loading flag
            this.proxiesCache.isLoading = true;
            
            // Show loading indicator for network request
            const container = document.getElementById('existingProxyList');
            if (container) {
                container.innerHTML = `
                    <div class="proxy-list-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Đang tải danh sách proxy...</p>
                    </div>
                `;
            }
            
            // Cache expired or empty - load from backend
            const proxiesData = await window.electronAPI.getProxies();
            
            // Update cache
            this.proxiesCache.data = proxiesData;
            this.proxiesCache.lastUpdated = now;
            this.proxiesCache.isLoading = false;
            this.proxies = proxiesData;
            
            // Clear any existing selection
            this.clearProxySelection();
            
            this.renderExistingProxyList();
        } catch (error) {
            console.error('Error loading proxies:', error);
            this.proxiesCache.isLoading = false;
            this.showToast('Lỗi khi tải danh sách proxy', 'error');
            
            // Show error state
            const container = document.getElementById('existingProxyList');
            if (container) {
                container.innerHTML = `
                    <div class="proxy-list-error">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Lỗi khi tải proxy. Vui lòng thử lại.</p>
                        <button class="btn btn-sm btn-primary" onclick="chromeManager.loadExistingProxiesOptimized()">
                            <i class="fas fa-redo"></i> Thử lại
                        </button>
                    </div>
                `;
            }
        }
    }

    // Invalidate proxy cache when data changes
    invalidateProxyCache() {
        this.proxiesCache.data = null;
        this.proxiesCache.lastUpdated = 0;
        this.proxiesCache.isLoading = false;
    }

    // Force refresh proxy cache (for manual refresh button)
    forceRefreshProxyCache() {
        this.invalidateProxyCache();
        if (this.lastProxyTab === 'existing') {
            this.loadExistingProxiesOptimized();
        }
    }

    // Pre-load proxy data when modal opens for better UX
    async preloadProxyDataForModal() {
        try {
            // Only pre-load if cache is empty or stale
            const now = Date.now();
            if (!this.proxiesCache.data || 
                (now - this.proxiesCache.lastUpdated) >= this.proxiesCache.cacheTimeout) {
                
                // Load in background without showing UI loading state
                const proxiesData = await window.electronAPI.getProxies();
                
                // Update cache silently
                this.proxiesCache.data = proxiesData;
                this.proxiesCache.lastUpdated = now;
                this.proxies = proxiesData;
            }
        } catch (error) {
            // Silently fail pre-loading - user will see loading when they actually switch to tab
            console.warn('Pre-loading proxy data failed:', error);
        }
    }

    renderExistingProxyList(searchTerm = '') {
        const container = document.getElementById('existingProxyList');
        if (!container) return;

        let filteredProxies = this.proxies;
        if (searchTerm) {
            filteredProxies = this.proxies.filter(proxy => 
                proxy.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (proxy.username && proxy.username.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        if (filteredProxies.length === 0) {
            container.innerHTML = `
                <div class="proxy-list-empty">
                    <i class="fas fa-network-wired"></i>
                    <p>${searchTerm ? 'Không tìm thấy proxy phù hợp' : 'Chưa có proxy nào.<br>Hãy thêm proxy ở tab "Quản lý Proxy"'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredProxies.map(proxy => {
            const status = proxy.status || 'unknown';
            const statusIcon = status === 'working' ? 'fa-check-circle' : 
                              status === 'error' ? 'fa-times-circle' : 'fa-question-circle';
            
            // Get usage count for this proxy
            const usageCount = this.getProxyUsageCount(proxy.id);
            
            // Determine usage level class
            let usageClass = '';
            if (usageCount === 1) {
                usageClass = 'usage-low';
            } else if (usageCount >= 2 && usageCount <= 3) {
                usageClass = 'usage-medium';
            } else if (usageCount >= 4) {
                usageClass = 'usage-high';
            }
            
            return `
                <div class="proxy-item" data-proxy-id="${proxy.id}" onclick="chromeManager.selectProxy('${proxy.id}')">
                    <div class="proxy-item-info">
                        <div class="proxy-host">${proxy.host}:${proxy.port}</div>
                        <div class="proxy-details">
                            ${proxy.type.toUpperCase()} ${proxy.username ? `• ${proxy.username}` : '• Không auth'}
                        </div>
                    </div>
                    <div class="proxy-item-stats">
                        <div class="proxy-status ${status}">
                            <i class="fas ${statusIcon}"></i>
                            ${status === 'working' ? 'Hoạt động' : status === 'error' ? 'Lỗi' : 'Chưa kiểm tra'}
                        </div>
                        <div class="proxy-usage-indicator ${usageClass}" title="${usageCount} profile(s) đang sử dụng">
                            <i class="fas fa-users"></i>
                            <span class="usage-count">${usageCount}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    selectProxy(proxyId) {
        const proxyList = document.getElementById('existingProxyList');
        
        // Remove previous selection
        document.querySelectorAll('.proxy-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Add selection to clicked item
        const selectedItem = document.querySelector(`[data-proxy-id="${proxyId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            
            // Add selection mode to proxy list for visual effect
            if (proxyList) {
                proxyList.classList.add('selection-mode');
            }
        }

        // Store selected proxy ID
        const hiddenInput = document.getElementById('selectedProxyId');
        if (hiddenInput) {
            hiddenInput.value = proxyId;
        }

        // Show success message and proxy info
        const proxy = this.proxies.find(p => p.id === proxyId);
        if (proxy) {
            this.showToast(`✅ Đã chọn proxy ${proxy.host}:${proxy.port}`, 'success');
            
            // Update selection info
            this.updateProxySelectionInfo(proxy);
        }
    }

    updateProxySelectionInfo(proxy) {
        // Create or update selection info panel
        let infoPanel = document.getElementById('selectedProxyInfo');
        if (!infoPanel) {
            infoPanel = document.createElement('div');
            infoPanel.id = 'selectedProxyInfo';
            infoPanel.className = 'selected-proxy-info';
            
            const proxyContainer = document.querySelector('.proxy-list-container');
            if (proxyContainer) {
                proxyContainer.appendChild(infoPanel);
            }
        }
        
        infoPanel.innerHTML = `
            <div class="selection-header">
                <i class="fas fa-check-circle"></i>
                <span>Proxy đã chọn</span>
                <button type="button" class="clear-selection-btn" onclick="chromeManager.clearProxySelection()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="selection-details">
                <div class="proxy-display">
                    <strong>${proxy.host}:${proxy.port}</strong>
                    <span class="proxy-type-badge">${proxy.type.toUpperCase()}</span>
                </div>
                ${proxy.username ? `<div class="proxy-auth">👤 ${proxy.username}</div>` : '<div class="proxy-auth">🔓 Không xác thực</div>'}
            </div>
        `;
        
        infoPanel.style.display = 'block';
    }

    clearProxySelection() {
        // Remove selection from all items
        document.querySelectorAll('.proxy-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Remove selection mode
        const proxyList = document.getElementById('existingProxyList');
        if (proxyList) {
            proxyList.classList.remove('selection-mode');
        }
        
        // Clear hidden input
        const hiddenInput = document.getElementById('selectedProxyId');
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        
        // Hide selection info
        const infoPanel = document.getElementById('selectedProxyInfo');
        if (infoPanel) {
            infoPanel.style.display = 'none';
        }
        
        this.showToast('Đã bỏ chọn proxy', 'info');
    }

    filterProxyList(searchTerm) {
        this.renderExistingProxyList(searchTerm);
    }

    async testSelectedProxy() {
        const selectedProxyId = document.getElementById('selectedProxyId')?.value;
        if (!selectedProxyId) {
            this.showToast('Vui lòng chọn một proxy để kiểm tra', 'warning');
            return;
        }

        const proxy = this.proxies.find(p => p.id === selectedProxyId);
        if (!proxy) {
            this.showToast('Không tìm thấy proxy đã chọn', 'error');
            return;
        }

        try {
            const button = document.getElementById('testSelectedProxyBtn');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...';
            button.disabled = true;

            const result = await window.electronAPI.testProxy({
                host: proxy.host,
                port: proxy.port,
                username: proxy.username,
                password: proxy.password,
                type: proxy.type
            });

            if (result.success) {
                this.showToast(`✅ Proxy ${proxy.host}:${proxy.port} hoạt động tốt!`, 'success');
            } else {
                this.showToast(`❌ Proxy không hoạt động: ${result.error}`, 'error');
            }

        } catch (error) {
            this.showToast('Lỗi khi kiểm tra proxy: ' + error.message, 'error');
        } finally {
            const button = document.getElementById('testSelectedProxyBtn');
            button.innerHTML = '<i class="fas fa-flask"></i> Kiểm tra proxy đã chọn';
            button.disabled = false;
        }
    }

    // Extension Management
    renderExtensions() {
        const extensionsGrid = document.getElementById('extensionsGrid');
        if (!extensionsGrid) return;

        if (this.extensions.length === 0) {
            extensionsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-puzzle-piece"></i>
                    </div>
                    <h3>Chưa có Extension nào</h3>
                    <p>Thêm extensions để tự động cài vào tất cả Chrome profiles</p>
                    <button class="btn btn-primary" onclick="chromeManager.showAddExtensionModal()">
                        <i class="fas fa-plus"></i> Thêm Extension đầu tiên
                    </button>
                </div>
            `;
            return;
        }

        const extensionsHTML = this.extensions.map(ext => `
            <div class="extension-card" data-extension-id="${ext.id}">
                <div class="extension-header">
                    <div class="extension-icon">
                        ${ext.icon ? `<img src="${ext.icon}" alt="${ext.name}">` : '<i class="fas fa-puzzle-piece"></i>'}
                    </div>
                    <div class="extension-info">
                        <h4 class="extension-name">${ext.name}</h4>
                    </div>
                    <div class="extension-status">
                        <span class="status-badge ${ext.enabled ? 'status-enabled' : 'status-disabled'}">
                            ${ext.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                </div>
                <div class="extension-details">
                    <div class="extension-meta">
                        <span class="extension-version">v${ext.version}</span>
                        <span class="extension-category">${ext.category}</span>
                    </div>
                    <div class="extension-path">
                        <i class="fas fa-folder"></i>
                        <span>${ext.path || ext.crxPath || 'Chrome Web Store'}</span>
                    </div>
                </div>
                <div class="extension-actions">
                    <button class="btn btn-sm btn-info" onclick="chromeManager.editExtension('${ext.id}')" 
                            title="Chỉnh sửa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="chromeManager.deleteExtension('${ext.id}')" 
                            title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        extensionsGrid.innerHTML = extensionsHTML;
    }

    showAddExtensionModal() {
        // Tạo modal thêm extension
        const modal = document.createElement('div');
        modal.id = 'addExtensionModal';
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Thêm Extension</h3>
                    <button class="modal-close" onclick="chromeManager.hideExtensionModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="extension-add-options">
                        <div class="add-option-card" onclick="chromeManager.browseExtensionFolder()">
                            <div class="option-icon">
                                <i class="fas fa-folder-open"></i>
                            </div>
                            <h4>Từ thư mục</h4>
                            <p>Chọn thư mục chứa extension đã giải nén</p>
                        </div>
                        
                        <div class="add-option-card" onclick="chromeManager.showManualExtensionForm()">
                            <div class="option-icon">
                                <i class="fas fa-edit"></i>
                            </div>
                            <h4>Nhập thủ công</h4>
                            <p>Điền thông tin extension thủ công</p>
                        </div>
                        
                        <div class="add-option-card" onclick="chromeManager.showStoreExtensionForm()">
                            <div class="option-icon">
                                <i class="fab fa-chrome"></i>
                            </div>
                            <h4>Chrome Web Store</h4>
                            <p>Thêm extension từ Chrome Web Store ID</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    setupExtensionModal() {
        // Setup extension type tabs
        const typeTabs = document.querySelectorAll('.extension-type-tab');
        const typeContents = document.querySelectorAll('.extension-type-content');

        typeTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                typeTabs.forEach(t => t.classList.remove('active'));
                typeContents.forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                const type = tab.dataset.type;
                document.getElementById(`ext${type.charAt(0).toUpperCase() + type.slice(1)}Type`).classList.add('active');
            });
        });

        // Setup form submission
        document.getElementById('addExtensionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddExtension(e);
        });
    }

    async handleAddExtension(e) {
        try {
            const formData = new FormData(e.target);
            const extensionData = {
                name: formData.get('name'),
                description: formData.get('description'),
                version: formData.get('version') || '1.0.0',
                category: formData.get('category'),
                path: formData.get('path') || '',
                crxPath: formData.get('crxPath') || '',
                chromeWebStoreId: formData.get('chromeWebStoreId') || '',
                icon: formData.get('icon') || '',
                enabled: formData.has('enabled')
            };

            const result = await window.electronAPI.addExtension(extensionData);
            
            if (result.success) {
                this.extensions.push(result.extension);
                this.renderExtensions();
                this.hideExtensionModal();
                this.showToast('✅ Thêm extension thành công!', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.showToast('Lỗi khi thêm extension: ' + error.message, 'error');
        }
    }

    hideExtensionModal() {
        const modal = document.getElementById('addExtensionModal');
        if (modal) {
            modal.remove();
        }
    }

    async editExtension(extensionId) {
        const extension = this.extensions.find(e => e.id === extensionId);
        if (!extension) return;

        // Implement edit modal similar to add modal but with pre-filled data
        this.showToast('Chức năng chỉnh sửa extension đang được phát triển...', 'info');
    }

    async deleteExtension(extensionId) {
        if (!confirm('Bạn có chắc chắn muốn xóa extension này?')) return;

        try {
            const result = await window.electronAPI.deleteExtension(extensionId);
            
            if (result.success) {
                this.extensions = this.extensions.filter(e => e.id !== extensionId);
                this.renderExtensions();
                this.showToast('✅ Xóa extension thành công!', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.showToast('Lỗi khi xóa extension: ' + error.message, 'error');
        }
    }

    async browseExtensionFolder() {
        try {
            const result = await window.electronAPI.browseExtensionFolder();
            
            if (result.success) {
                // Automatically add extension without showing form
                const extensionData = result.extensionData;
                const addResult = await window.electronAPI.addExtension(extensionData);
                
                if (addResult.success) {
                    this.extensions.push(addResult.extension);
                    this.renderExtensions();
                    this.hideExtensionModal();
                    this.showToast(`✅ Đã thêm extension "${extensionData.name}" thành công!`, 'success');
                } else {
                    this.showToast('❌ ' + addResult.error, 'error');
                }
            } else {
                this.showToast('❌ ' + result.error, 'error');
            }
        } catch (error) {
            this.showToast('Lỗi khi chọn thư mục extension: ' + error.message, 'error');
        }
    }

    showManualExtensionForm() {
        this.hideExtensionModal();
        this.showDetailedExtensionForm('manual');
    }

    showStoreExtensionForm() {
        this.hideExtensionModal();
        this.showDetailedExtensionForm('store');
    }

    showDetailedExtensionForm(type = 'manual') {
        const modal = document.createElement('div');
        modal.id = 'detailedExtensionModal';
        modal.className = 'modal show';
        
        let formContent = '';
        if (type === 'store') {
            formContent = `
                <div class="form-group">
                    <label for="extStoreId">Chrome Web Store ID: <span class="required">*</span></label>
                    <input type="text" id="extStoreId" name="chromeWebStoreId" required placeholder="cjpalhdlnbpafiamejdnhcphjbkeiagm">
                    <small>Lấy ID từ URL extension trên Chrome Web Store</small>
                </div>
                <div class="form-group">
                    <label for="extName">Tên Extension: <span class="required">*</span></label>
                    <input type="text" id="extName" name="name" required placeholder="Tên extension...">
                </div>
            `;
        } else {
            formContent = `
                <div class="form-group">
                    <label for="extName">Tên Extension: <span class="required">*</span></label>
                    <input type="text" id="extName" name="name" required placeholder="Ví dụ: AdBlock Plus, uBlock Origin...">
                </div>
                <div class="form-group">
                    <label for="extPath">Đường dẫn:</label>
                    <input type="text" id="extPath" name="path" placeholder="C:\\Extensions\\AdBlock\\manifest.json">
                    <small>Đường dẫn đến file manifest.json hoặc thư mục extension</small>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${type === 'store' ? 'Thêm từ Chrome Web Store' : 'Thêm Extension thủ công'}</h3>
                    <button class="modal-close" onclick="chromeManager.hideDetailedExtensionModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="detailedExtensionForm">
                        ${formContent}
                        <div class="form-group">
                            <label for="extDescription">Mô tả:</label>
                            <textarea id="extDescription" name="description" placeholder="Mô tả chức năng của extension..." rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label for="extVersion">Phiên bản:</label>
                            <input type="text" id="extVersion" name="version" placeholder="1.0.0" value="1.0.0">
                        </div>
                        <div class="form-group">
                            <label for="extCategory">Danh mục:</label>
                            <select id="extCategory" name="category">
                                <option value="Ad Blocker">Ad Blocker</option>
                                <option value="Privacy">Privacy & Security</option>
                                <option value="Productivity">Productivity</option>
                                <option value="Developer">Developer Tools</option>
                                <option value="Social">Social Media</option>
                                <option value="Shopping">Shopping</option>
                                <option value="Entertainment">Entertainment</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="extEnabled" name="enabled" checked>
                                Kích hoạt extension
                            </label>
                        </div>
                    </form>
                </div>
                <div class="form-actions">
                    <button type="button" class="modal-btn modal-btn-secondary" onclick="chromeManager.hideDetailedExtensionModal()">
                        Hủy
                    </button>
                    <button type="submit" class="modal-btn modal-btn-primary" form="detailedExtensionForm">
                        <i class="fas fa-plus"></i> Thêm Extension
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupDetailedExtensionModal();
    }

    setupDetailedExtensionModal() {
        document.getElementById('detailedExtensionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleDetailedAddExtension(e);
        });
    }

    async handleDetailedAddExtension(e) {
        try {
            const formData = new FormData(e.target);
            const extensionData = {
                name: formData.get('name'),
                description: formData.get('description'),
                version: formData.get('version') || '1.0.0',
                category: formData.get('category'),
                path: formData.get('path') || '',
                chromeWebStoreId: formData.get('chromeWebStoreId') || '',
                enabled: formData.has('enabled')
            };

            const result = await window.electronAPI.addExtension(extensionData);
            
            if (result.success) {
                this.extensions.push(result.extension);
                this.renderExtensions();
                this.hideDetailedExtensionModal();
                this.showToast('✅ Thêm extension thành công!', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.showToast('Lỗi khi thêm extension: ' + error.message, 'error');
        }
    }

    hideDetailedExtensionModal() {
        const modal = document.getElementById('detailedExtensionModal');
        if (modal) {
            modal.remove();
        }
    }

    // Bookmark utility methods
    setupBookmarkPresets() {
        const presetButtons = document.querySelectorAll('.preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Toggle active state
                btn.classList.toggle('active');
                
                // Handle the preset logic here if needed
                const ids = btn.dataset.ids;
                const count = btn.dataset.count;
                
                if (ids) {
                    console.log('Selected IDs:', ids);
                } else if (count) {
                    console.log('Selected count:', count);
                }
            });
        });
    }

    setupBookmarkRowEvents() {
        // Add bookmark row button
        const addBtn = document.getElementById('addBookmarkRow');
        if (addBtn) {
            addBtn.replaceWith(addBtn.cloneNode(true)); // Remove existing listeners
            document.getElementById('addBookmarkRow').addEventListener('click', () => {
                this.addBookmarkRow();
            });
        }

        // Remove bookmark row buttons
        this.setupRemoveBookmarkButtons();
    }

    addBookmarkRow() {
        const container = document.getElementById('bookmarksContainer');
        const newRow = document.createElement('div');
        newRow.className = 'bookmark-row';
        newRow.innerHTML = `
            <div class="bookmark-input-group">
                <label>Tên</label>
                <input type="text" class="bookmark-name" placeholder="Nhập tên dấu trang">
            </div>
            <div class="bookmark-input-group">
                <label>URL</label>
                <input type="text" class="bookmark-url" placeholder="Nhập URL dấu trang">
            </div>
            <button class="btn btn-danger btn-sm remove-bookmark">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(newRow);
        this.setupRemoveBookmarkButtons();
    }

    setupRemoveBookmarkButtons() {
        const removeButtons = document.querySelectorAll('.remove-bookmark');
        removeButtons.forEach(btn => {
            btn.replaceWith(btn.cloneNode(true)); // Remove existing listeners
        });

        // Re-add event listeners
        document.querySelectorAll('.remove-bookmark').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = btn.closest('.bookmark-row');
                if (document.querySelectorAll('.bookmark-row').length > 1) {
                    row.remove();
                } else {
                    // Don't allow removing the last row, just clear it
                    row.querySelector('.bookmark-name').value = '';
                    row.querySelector('.bookmark-url').value = '';
                }
            });
        });
    }

    setupTabRowEvents() {
        // Add tab row button
        const addBtn = document.getElementById('addTabRow');
        if (addBtn) {
            addBtn.replaceWith(addBtn.cloneNode(true)); // Remove existing listeners
            document.getElementById('addTabRow').addEventListener('click', () => {
                this.addTabRow();
            });
        }

        // Remove tab row buttons
        this.setupRemoveTabButtons();

        // Tab action change handler
        const actionSelect = document.getElementById('tabActionType');
        if (actionSelect) {
            actionSelect.addEventListener('change', () => {
                this.handleTabActionChange();
            });
        }

        // Delete mode radio buttons
        const deleteRadios = document.querySelectorAll('input[name="deleteMode"]');
        deleteRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.handleDeleteModeChange();
            });
        });
    }

    addTabRow() {
        const container = document.getElementById('tabsContainer');
        const newRow = document.createElement('div');
        newRow.className = 'tab-row';
        newRow.innerHTML = `
            <div class="tab-input-group">
                <label>URL</label>
                <input type="text" class="tab-url" placeholder="Nhập URL tab">
            </div>
            <button class="btn btn-danger btn-sm remove-tab">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(newRow);
        this.setupRemoveTabButtons();
    }

    setupRemoveTabButtons() {
        const removeButtons = document.querySelectorAll('.remove-tab');
        removeButtons.forEach(btn => {
            btn.replaceWith(btn.cloneNode(true)); // Remove existing listeners
        });

        // Re-add event listeners
        document.querySelectorAll('.remove-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = btn.closest('.tab-row');
                if (document.querySelectorAll('.tab-row').length > 1) {
                    row.remove();
                } else {
                    // Don't allow removing the last row, just clear it
                    row.querySelector('.tab-url').value = '';
                }
            });
        });
    }

    handleTabActionChange() {
        const actionType = document.getElementById('tabActionType').value;
        const addSection = document.getElementById('addTabsSection');
        const manageSection = document.getElementById('manageTabsSection');

        if (actionType === 'add') {
            addSection.style.display = 'block';
            manageSection.style.display = 'none';
        } else {
            addSection.style.display = 'none';
            manageSection.style.display = 'block';
        }
    }

    handleDeleteModeChange() {
        const deleteMode = document.querySelector('input[name="deleteMode"]:checked').value;
        const contentSection = document.getElementById('deleteContentSection');
        const patternSection = document.getElementById('deletePatternSection');

        contentSection.style.display = deleteMode === 'content' ? 'block' : 'none';
        patternSection.style.display = deleteMode === 'pattern' ? 'block' : 'none';
    }

    async applyTabs() {
        console.log('🗂️ Starting applyTabs...');
        
        const selectedProfileIds = Array.from(this.selectedProfiles);
        const actionType = document.getElementById('tabActionType').value;

        try {
            if (actionType === 'add') {
                await this.addTabsToProfiles(selectedProfileIds);
            } else {
                await this.manageTabsInProfiles(selectedProfileIds);
            }
        } catch (error) {
            console.error('Error applying tabs:', error);
            this.showToast('Có lỗi xảy ra khi áp dụng tabs', 'error');
        }
    }

    async addTabsToProfiles(profileIds) {
        const tabRows = document.querySelectorAll('.tab-row');
        const tabs = [];

        tabRows.forEach(row => {
            const url = row.querySelector('.tab-url').value.trim();
            if (url) {
                tabs.push({ url });
            }
        });

        if (tabs.length === 0) {
            this.showToast('Vui lòng nhập ít nhất một URL tab', 'warning');
            return;
        }

        console.log('📝 Adding tabs to profiles:', { profileIds, tabs });

        let successCount = 0;
        const errors = [];

        for (const profileId of profileIds) {
            try {
                const result = await window.electronAPI.addTabsToProfile(profileId, tabs);
                if (result.success) {
                    successCount++;
                    console.log(`✅ Added ${tabs.length} tabs to profile ${profileId}`);
                } else {
                    errors.push(`Profile ${profileId}: ${result.error}`);
                }
            } catch (error) {
                console.error(`Error adding tabs to profile ${profileId}:`, error);
                errors.push(`Profile ${profileId}: ${error.message}`);
            }
        }

        // Show results
        if (successCount > 0) {
            this.showToast(`✅ Đã thêm tabs cho ${successCount}/${profileIds.length} hồ sơ`, 'success');
        }

        if (errors.length > 0) {
            console.warn('Tab addition errors:', errors);
            this.showToast(`⚠️ Có lỗi với ${errors.length} hồ sơ`, 'warning');
        }

        this.hideModal('editTabsModal');
    }

    async manageTabsInProfiles(profileIds) {
        const deleteMode = document.querySelector('input[name="deleteMode"]:checked').value;
        let deleteConfig = { mode: deleteMode };

        if (deleteMode === 'content') {
            const content = document.getElementById('deleteContent').value.trim();
            if (!content) {
                this.showToast('Vui lòng nhập nội dung URL cần xóa', 'warning');
                return;
            }
            deleteConfig.content = content;
        } else if (deleteMode === 'pattern') {
            const pattern = document.getElementById('deletePattern').value.trim();
            if (!pattern) {
                this.showToast('Vui lòng nhập mẫu URL cần xóa', 'warning');
                return;
            }
            deleteConfig.pattern = pattern;
        }

        console.log('🗑️ Deleting tabs from profiles:', { profileIds, deleteConfig });

        let successCount = 0;
        const errors = [];

        for (const profileId of profileIds) {
            try {
                const result = await window.electronAPI.deleteTabsFromProfile(profileId, deleteConfig);
                if (result.success) {
                    successCount++;
                    console.log(`✅ Deleted tabs from profile ${profileId}`);
                } else {
                    errors.push(`Profile ${profileId}: ${result.error}`);
                }
            } catch (error) {
                console.error(`Error deleting tabs from profile ${profileId}:`, error);
                errors.push(`Profile ${profileId}: ${error.message}`);
            }
        }

        // Show results
        if (successCount > 0) {
            this.showToast(`✅ Đã xóa tabs khỏi ${successCount}/${profileIds.length} hồ sơ`, 'success');
        }

        if (errors.length > 0) {
            console.warn('Tab deletion errors:', errors);
            this.showToast(`⚠️ Có lỗi với ${errors.length} hồ sơ`, 'warning');
        }

        this.hideModal('editTabsModal');
    }
}

// Global instance
let chromeManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    chromeManager = new ChromeManagerUI();
});

// Make it globally accessible for onclick handlers
window.chromeManager = chromeManager;

