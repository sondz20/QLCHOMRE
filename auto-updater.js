const { app, dialog, shell, BrowserWindow } = require('electron')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { exec, execSync } = require('child_process')
const os = require('os')

class AutoUpdater {
    constructor() {
        this.currentVersion = app.getVersion()
        this.updateUrl = 'https://toolfb.vn/CHROME/version.txt'
        this.notesUrl = 'https://toolfb.vn/CHROME/notes.txt'
        this.checkInterval = 60 * 60 * 1000 // Check mỗi 1 giờ
        this.isChecking = false
        this.progressWindow = null
        this.closeTimer = null
    }

    // Khởi động auto-updater
    start() {
        console.log('🔄 Chrome Manager Auto-updater started')
        
        // Check ngay khi khởi động (sau 3s để app window ready)
        setTimeout(() => {
            this.checkForUpdates()
        }, 3000)

        // Check định kỳ mỗi 1 giờ
        setInterval(() => {
            this.checkForUpdates()
        }, this.checkInterval)
    }

    // Check có update không
    async checkForUpdates(showNoUpdateDialog = false) {
        if (this.isChecking) return
        
        this.isChecking = true
        console.log('🔍 Checking for Chrome Manager updates...')

        try {
            const updateInfo = await this.fetchUpdateInfo()
            
            if (this.compareVersions(updateInfo.version, this.currentVersion) > 0) {
                console.log(`🎉 Found new version: ${updateInfo.version}`)
                
                // Hiển thị dialog ngay lập tức khi có main window
                this.showUpdateDialog(updateInfo)
                
            } else {
                console.log('✅ Chrome Manager is up to date')
                if (showNoUpdateDialog) {
                    dialog.showMessageBox(null, {
                        type: 'info',
                        title: 'Cập nhật Chrome Manager',
                        message: 'Bạn đang sử dụng phiên bản mới nhất!',
                        detail: `Phiên bản hiện tại: ${this.currentVersion}`,
                        buttons: ['OK']
                    })
                }
            }
        } catch (error) {
            console.error('❌ Update check failed:', error.message)
            if (showNoUpdateDialog) {
                dialog.showMessageBox({
                    type: 'error',
                    title: 'Lỗi kiểm tra cập nhật',
                    message: 'Không thể kết nối đến server cập nhật',
                    detail: error.message,
                    buttons: ['OK']
                })
            }
        } finally {
            this.isChecking = false
        }
    }

    // Fetch thông tin update từ server
    fetchUpdateInfo() {
        return new Promise((resolve, reject) => {
            https.get(this.updateUrl, (res) => {
                let data = ''
                
                res.on('data', (chunk) => {
                    data += chunk
                })
                
                res.on('end', () => {
                    try {
                        // Parse simple text format (version only)
                        const version = data.trim()
                        
                        if (version && /^\d+\.\d+\.\d+/.test(version)) {
                            const updateInfo = {
                                version: version,
                                downloadUrl: 'https://toolfb.vn/CHROME/Chrome-Manager-Setup.exe',
                                fileName: 'Chrome-Manager-Setup.exe'
                            }
                            resolve(updateInfo)
                        } else {
                            reject(new Error('Invalid version format'))
                        }
                    } catch (error) {
                        reject(new Error('Invalid response format'))
                    }
                })
            }).on('error', (error) => {
                reject(error)
            })
        })
    }

    // Fetch release notes
    fetchReleaseNotes() {
        return new Promise((resolve, reject) => {
            https.get(this.notesUrl, (res) => {
                let data = ''
                
                res.on('data', (chunk) => {
                    data += chunk
                })
                
                res.on('end', () => {
                    resolve(data)
                })
            }).on('error', (error) => {
                reject(error)
            })
        })
    }

    // So sánh version (trả về: 1 nếu v1 > v2, -1 nếu v1 < v2, 0 nếu bằng nhau)
    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number)
        const parts2 = v2.split('.').map(Number)
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || 0
            const part2 = parts2[i] || 0
            
            if (part1 > part2) return 1
            if (part1 < part2) return -1
        }
        
        return 0
    }

    // Hiển thị dialog update
    async showUpdateDialog(updateInfo) {
        try {
            const releaseNotes = await this.fetchReleaseNotes()
            
            console.log('🎯 Showing update dialog for version:', updateInfo.version)
            
            // Lấy main window từ Electron app với fallback
            const { BrowserWindow } = require('electron')
            const allWindows = BrowserWindow.getAllWindows()
            const mainWindow = allWindows.length > 0 ? allWindows[0] : null
            
            const dialogOptions = {
                type: 'info',
                title: 'Có bản cập nhật mới!',
                message: `Chrome Manager - Quản lý Chrome Pro v${updateInfo.version}`,
                detail: `Phiên bản hiện tại: ${this.currentVersion}\nPhiên bản mới: ${updateInfo.version}\n\nBạn có muốn tải và cài đặt ngay không?`,
                buttons: ['Cập nhật tự động', 'Cập nhật thủ công', 'Xem chi tiết', 'Để sau'],
                defaultId: 0,
                cancelId: 3,
                noLink: true
            }
            
            const result = mainWindow 
                ? await dialog.showMessageBox(mainWindow, dialogOptions)
                : await dialog.showMessageBox(dialogOptions)

            console.log('👤 User choice:', result.response)

            switch (result.response) {
                case 0: // Cập nhật tự động
                    console.log('🚀 Starting auto update...')
                    this.downloadAndInstall(updateInfo)
                    break
                case 1: // Cập nhật thủ công
                    console.log('📂 Opening manual download...')
                    this.showManualUpdateInstructions(updateInfo)
                    break
                case 2: // Xem chi tiết
                    console.log('📄 Showing release notes...')
                    this.showReleaseNotes(releaseNotes, updateInfo)
                    break
                case 3: // Để sau
                    console.log('📅 User postponed update')
                    break
            }
        } catch (error) {
            console.error('❌ Failed to show update dialog:', error)
            // Fallback: auto update
            console.log('🔄 Fallback: Auto-updating...')
            this.downloadAndInstall(updateInfo)
        }
    }

    // Tải và cài đặt tự động
    async downloadAndInstall(updateInfo) {
        try {
            console.log('📥 Starting download and install process...')
            
            // Tạo progress window
            this.createProgressWindow()
            
            // Tải file
            const downloadPath = await this.downloadUpdate(updateInfo)
            
            // Thông báo hoàn thành download
            this.updateProgress('Download hoàn thành! Đang chuẩn bị cài đặt...', 90)
            
            // Delay ngắn trước khi cài đặt
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            console.log('🚀 Starting installation...')
            this.updateProgress('Đang khởi động installer...', 95)
            
            // Khởi động installer và đóng ứng dụng hiện tại
            this.runInstaller(downloadPath)
            
        } catch (error) {
            console.error('❌ Auto update failed:', error)
            
            if (this.progressWindow && !this.progressWindow.isDestroyed()) {
                this.progressWindow.close()
            }
            
            dialog.showErrorBox(
                'Lỗi cập nhật tự động',
                `Không thể tự động cập nhật: ${error.message}\n\nVui lòng thử cập nhật thủ công.`
            )
        }
    }

    // Tạo window hiển thị progress
    createProgressWindow() {
        const { BrowserWindow } = require('electron')
        
        this.progressWindow = new BrowserWindow({
            width: 400,
            height: 200,
            resizable: false,
            maximizable: false,
            minimizable: false,
            modal: true,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        })

        const progressHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Đang cập nhật Chrome Manager</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-align: center;
                }
                .progress-container {
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                    padding: 20px;
                    margin: 20px 0;
                }
                .progress-bar {
                    width: 100%;
                    height: 20px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 10px;
                    overflow: hidden;
                    margin: 10px 0;
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #00d4aa, #00a8ff);
                    width: 0%;
                    transition: width 0.3s ease;
                }
                #status { margin: 10px 0; font-size: 14px; }
                #percent { font-size: 18px; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>🔄 Đang cập nhật Chrome Manager</h2>
            <div class="progress-container">
                <div id="status">Đang chuẩn bị tải xuống...</div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <div id="percent">0%</div>
            </div>
            <div>Vui lòng không đóng cửa sổ này...</div>
        </body>
        </html>
        `

        this.progressWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(progressHTML))
        this.progressWindow.once('ready-to-show', () => {
            this.progressWindow.show()
        })
    }

    // Cập nhật progress
    updateProgress(status, percent) {
        if (this.progressWindow && !this.progressWindow.isDestroyed()) {
            this.progressWindow.webContents.executeJavaScript(`
                document.getElementById('status').textContent = '${status}';
                document.getElementById('percent').textContent = '${percent}%';
                document.getElementById('progressFill').style.width = '${percent}%';
            `)
        }
    }

    // Tải update
    downloadUpdate(updateInfo) {
        return new Promise((resolve, reject) => {
            const downloadDir = path.join(os.tmpdir(), 'chrome-manager-update')
            
            // Tạo thư mục download nếu chưa có
            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true })
            }
            
            const filePath = path.join(downloadDir, updateInfo.fileName)
            
            console.log(`📥 Downloading to: ${filePath}`)
            this.updateProgress('Đang tải xuống...', 10)
            
            const file = fs.createWriteStream(filePath)
            
            https.get(updateInfo.downloadUrl, (response) => {
                const totalSize = parseInt(response.headers['content-length'], 10)
                let downloadedSize = 0
                
                response.pipe(file)
                
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length
                    if (totalSize > 0) {
                        const percent = Math.round((downloadedSize / totalSize) * 80) + 10 // 10-90%
                        this.updateProgress(`Đang tải xuống... ${Math.round(downloadedSize / 1024 / 1024)}MB / ${Math.round(totalSize / 1024 / 1024)}MB`, percent)
                    }
                })
                
                file.on('finish', () => {
                    file.close()
                    console.log('✅ Download completed')
                    resolve(filePath)
                })
            }).on('error', (error) => {
                fs.unlink(filePath, () => {}) // Xóa file lỗi
                reject(error)
            })
        })
    }

    // Chạy installer
    runInstaller(installerPath) {
        console.log(`🚀 Running installer: ${installerPath}`)
        
        this.updateProgress('Đang khởi động installer...', 100)
        
        // Delay ngắn để user thấy completion
        setTimeout(() => {
            if (this.progressWindow && !this.progressWindow.isDestroyed()) {
                this.progressWindow.close()
            }
            
            // Khởi động installer với elevated permissions
            const command = process.platform === 'win32' 
                ? `start "" "${installerPath}"` 
                : `open "${installerPath}"`
            
            exec(command, (error) => {
                if (error) {
                    console.error('❌ Failed to start installer:', error)
                    dialog.showErrorBox(
                        'Lỗi khởi động installer',
                        `Không thể khởi động installer: ${error.message}`
                    )
                } else {
                    console.log('✅ Installer started, closing current app...')
                    // Đóng ứng dụng hiện tại để installer có thể cập nhật
                    app.quit()
                }
            })
        }, 1000)
    }

    // Hiển thị hướng dẫn cập nhật thủ công
    showManualUpdateInstructions(updateInfo) {
        const options = {
            type: 'info',
            title: 'Cập nhật thủ công',
            message: 'Hướng dẫn cập nhật thủ công',
            detail: `1. Tải xuống phiên bản mới từ:\n   ${updateInfo.downloadUrl}\n\n2. Đóng Chrome Manager hiện tại\n\n3. Chạy file installer vừa tải\n\n4. Khởi động lại Chrome Manager`,
            buttons: ['Tải xuống', 'Hủy']
        }

        dialog.showMessageBox(options).then((result) => {
            if (result.response === 0) {
                shell.openExternal(updateInfo.downloadUrl)
            }
        })
    }

    // Hiển thị release notes
    showReleaseNotes(notes, updateInfo) {
        const options = {
            type: 'info',
            title: `Chi tiết phiên bản ${updateInfo.version}`,
            message: `Chrome Manager v${updateInfo.version}`,
            detail: notes || 'Không có thông tin chi tiết.',
            buttons: ['Cập nhật ngay', 'Tải thủ công', 'Đóng']
        }

        dialog.showMessageBox(options).then((result) => {
            switch (result.response) {
                case 0: // Cập nhật ngay
                    this.downloadAndInstall(updateInfo)
                    break
                case 1: // Tải thủ công
                    this.showManualUpdateInstructions(updateInfo)
                    break
                case 2: // Đóng
                    break
            }
        })
    }

    // Method để manually trigger update check (có thể gọi từ menu)
    manualCheckForUpdates() {
        this.checkForUpdates(true)
    }

    // Cleanup khi app đóng
    cleanup() {
        if (this.progressWindow && !this.progressWindow.isDestroyed()) {
            this.progressWindow.close()
        }
        if (this.closeTimer) {
            clearTimeout(this.closeTimer)
        }
    }
}

module.exports = AutoUpdater
