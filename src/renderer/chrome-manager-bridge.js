// 🔌 Integration Bridge - Kết nối Modern UI với Chrome Manager Logic

class ChromeManagerBridge {
    constructor() {
        this.profiles = [];
        this.proxies = [];
        this.runningInstances = new Map();
        this.currentTab = 'profiles';
        this.selectedProfiles = new Set();
        this.filteredProfiles = [];
        this.monitoringInterval = null;
        
        this.init();
    }

    async init() {
        console.log('🌉 Initializing Chrome Manager Bridge...');
        
        // Setup UI event listeners
        this.setupEventListeners();
        this.setupTabNavigation();
        
        // Load real data from backend
        await this.loadData();
        this.updateStats();
        
        // Start monitoring system
        this.startInstanceMonitoring();
        
        console.log('✅ Chrome Manager Bridge initialized successfully!');
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('profileSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterProfiles(e.target.value);
            });
        }

        // Filter functionality
        const filterSelect = document.getElementById('proxyFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                this.filterByProxy(e.target.value);
            });
        }

        // Action buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn[onclick]')) {
                e.preventDefault(); // Prevent default onclick
                
                const button = e.target.closest('.btn');
                const onclick = button.getAttribute('onclick');
                
                if (onclick && onclick.includes('launchProfile')) {
                    const profileId = this.extractProfileId(onclick);
                    this.launchProfile(profileId, button);
                } else if (onclick && onclick.includes('stopProfileInstance')) {
                    const profileId = this.extractProfileId(onclick);
                    this.stopProfileInstance(profileId, button);
                }
            }
        });
    }

    extractProfileId(onclick) {
        const match = onclick.match(/'([^']+)'/);
        return match ? match[1] : null;
    }

    setupTabNavigation() {
        this.switchTab('profiles');
    }

    switchTab(tabName) {
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeTab = document.getElementById(`${tabName}-tab`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.classList.add('fade-in');
        }

        this.currentTab = tabName;
        console.log(`📱 Switched to ${tabName} tab`);
    }

    async loadData() {
        try {
            // Load profiles from backend
            if (window.electronAPI && window.electronAPI.getProfiles) {
                this.profiles = await window.electronAPI.getProfiles();
            }
            
            // Load proxies from backend
            if (window.electronAPI && window.electronAPI.getProxies) {
                this.proxies = await window.electronAPI.getProxies();
            }
            
            // Render data
            this.renderProfiles();
            this.renderProxies();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Lỗi khi tải dữ liệu!', 'error');
        }
    }

    renderProfiles() {
        const tbody = document.getElementById('profilesTableBody');
        if (!tbody) return;
        
        if (this.profiles.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-user-plus"></i>
                        <h3>Chưa có profile nào</h3>
                        <p>Tạo profile đầu tiên để bắt đầu quản lý Chrome</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.profiles.map((profile, index) => {
            const isRunning = Array.from(this.runningInstances.values())
                .some(instance => instance.profile.id === profile.id && instance.isActive);
            
            const proxyInfo = profile.proxy ? 
                this.proxies.find(p => p.id === profile.proxy) : null;

            const cardNumber = this.generateCardNumber();
            const createdDate = new Date(profile.created).toLocaleDateString('vi-VN');

            return `
                <tr data-profile-id="${profile.id}">
                    <td>
                        <input type="checkbox" class="profile-checkbox" 
                               data-profile-id="${profile.id}">
                    </td>
                    <td>${index + 1}</td>
                    <td>
                        <div class="profile-name">${profile.name}</div>
                    </td>
                    <td>
                        <div class="profile-card-info">
                            <span class="profile-card-number">${cardNumber}</span>
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
                                    onclick="chromeManagerBridge.${isRunning ? 'stopProfileInstance' : 'launchProfile'}('${profile.id}')">
                                <i class="fas ${isRunning ? 'fa-stop' : 'fa-play'}"></i>
                                ${isRunning ? 'Tắt' : 'Mở'}
                            </button>
                            <button class="btn btn-warning btn-sm" onclick="chromeManagerBridge.editProfile('${profile.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="chromeManagerBridge.deleteProfile('${profile.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async launchProfile(profileId, button = null) {
        try {
            console.log(`🚀 Launching profile ${profileId}...`);
            
            // Set button loading state
            if (button) {
                this.setButtonLoading(button, true);
            }
            
            // Call backend API
            if (window.electronAPI && window.electronAPI.launchChrome) {
                const result = await window.electronAPI.launchChrome(profileId);
                
                if (result.success) {
                    this.showToast(`Profile "${result.profileName}" đã được khởi chạy thành công!`, 'success');
                    
                    // Update UI
                    this.syncChromeInstances();
                    this.renderProfiles();
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            } else {
                // Fallback for demo
                await this.delay(2000);
                this.showToast(`Profile ${profileId} đã được khởi chạy (Demo)!`, 'success');
            }
            
        } catch (error) {
            console.error('Error launching profile:', error);
            this.showToast('Lỗi khi khởi chạy Chrome: ' + error.message, 'error');
        } finally {
            if (button) {
                this.setButtonLoading(button, false);
            }
        }
    }

    async stopProfileInstance(profileId, button = null) {
        try {
            console.log(`⏹️ Stopping profile ${profileId}...`);
            
            // Call backend API
            if (window.electronAPI && window.electronAPI.stopChrome) {
                const result = await window.electronAPI.stopChrome(profileId);
                
                if (result.success) {
                    this.showToast(`Profile đã được dừng!`, 'info');
                    
                    // Update UI
                    this.syncChromeInstances();
                    this.renderProfiles();
                } else {
                    throw new Error(result.error || 'Unknown error');
                }
            } else {
                // Fallback for demo
                await this.delay(500);
                this.showToast(`Profile ${profileId} đã được dừng (Demo)!`, 'info');
            }
            
        } catch (error) {
            console.error('Error stopping profile:', error);
            this.showToast('Lỗi khi dừng Chrome: ' + error.message, 'error');
        }
    }

    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang mở...';
            button.classList.add('btn-loading');
        } else {
            button.disabled = false;
            button.classList.remove('btn-loading');
        }
    }

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
            if (!window.electronAPI || !window.electronAPI.getChromeInstances) return;
            
            const backendInstances = await window.electronAPI.getChromeInstances();
            
            // Update local running instances
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
            
            // Update UI if changed
            if (this.hasInstancesChanged(previousInstances, this.runningInstances)) {
                this.renderProfiles();
                this.renderRunningInstances();
                this.updateStats();
            }
            
        } catch (error) {
            console.error('Error syncing Chrome instances:', error);
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

    renderRunningInstances() {
        const container = document.querySelector('.running-instances');
        if (!container) return;
        
        if (this.runningInstances.size === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-play-circle"></i>
                    <h3>Không có Chrome instance nào đang chạy</h3>
                    <p>Khởi chạy profile từ tab Profiles để thấy ở đây</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = Array.from(this.runningInstances.values()).map(instance => `
            <div class="instance-card ${instance.isActive ? 'active' : 'inactive'}">
                <div class="instance-header">
                    <div class="instance-info">
                        <h3>${instance.profile.name}</h3>
                        <span class="status-badge ${instance.isActive ? 'active' : 'inactive'}">
                            ${instance.isActive ? 'Đang chạy' : 'Đã đóng'}
                        </span>
                    </div>
                    <div class="instance-actions">
                        ${instance.isActive ? `
                            <button class="btn btn-danger btn-sm" onclick="chromeManagerBridge.stopInstance('${instance.id}')">
                                <i class="fas fa-stop"></i> Tắt
                            </button>
                        ` : `
                            <button class="btn btn-secondary btn-sm" onclick="chromeManagerBridge.removeInstance('${instance.id}')">
                                <i class="fas fa-times"></i> Xóa
                            </button>
                        `}
                    </div>
                </div>
                
                <div class="instance-details">
                    <div class="detail-item">
                        <i class="fas fa-server"></i>
                        <span>Proxy: ${instance.proxy ? `${instance.proxy.host}:${instance.proxy.port}` : 'Không có'}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>Chạy từ: ${instance.startTime.toLocaleTimeString('vi-VN')}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-expand-arrows-alt"></i>
                        <span>${instance.windowSize || '1600x1000'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        const profileCount = document.getElementById('profileCount');
        const proxyCount = document.getElementById('proxyCount');
        const runningCount = document.getElementById('runningCount');
        
        if (profileCount) profileCount.textContent = this.profiles.length;
        if (proxyCount) proxyCount.textContent = this.proxies.length;
        if (runningCount) runningCount.textContent = Array.from(this.runningInstances.values()).filter(i => i.isActive).length;
    }

    generateCardNumber() {
        const prefixes = ['VN', 'US', 'EU', 'AS'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const number = Math.floor(Math.random() * 900) + 100;
        return `${prefix} ${number}`;
    }

    filterProfiles(searchTerm) {
        const rows = document.querySelectorAll('#profilesTableBody tr');
        
        rows.forEach(row => {
            const profileName = row.querySelector('.profile-name');
            if (profileName) {
                const name = profileName.textContent.toLowerCase();
                const shouldShow = name.includes(searchTerm.toLowerCase());
                row.style.display = shouldShow ? '' : 'none';
            }
        });
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.className = 'toast';
        if (type !== 'info') {
            toast.classList.add(type);
        }
        
        const content = toast.querySelector('p');
        if (content) {
            content.textContent = message;
        }
        
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chromeManagerBridge = new ChromeManagerBridge();
});

console.log('🌉 Chrome Manager Bridge loaded successfully!');
