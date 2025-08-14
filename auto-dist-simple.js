const { exec } = require('child_process');
const fs = require('fs');

console.log('⚡ CHROME MANAGER - AUTO DIST (NO UPLOAD)');
console.log('==========================================');

async function quickDist() {
    try {
        // Đóng các process Chrome Manager đang chạy
        console.log('🔄 Checking for running processes...');
        try {
            await runCommand('taskkill /f /im "Chrome Manager - Quản lý Chrome Pro.exe" 2>nul || echo "No process found"');
        } catch (e) {
            // Ignore error
        }
        
        // Đọc version hiện tại
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const currentVersion = packageJson.version;
        
        console.log(`📋 Current Version: ${currentVersion}`);
        console.log('');
        
        // Update version (patch)
        const versionParts = currentVersion.split('.');
        versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
        const newVersion = versionParts.join('.');
        
        console.log(`🆙 New Version: ${newVersion}`);
        
        // Cập nhật package.json
        packageJson.version = newVersion;
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
        console.log('✅ Updated package.json');
        
        // Cập nhật version.txt
        fs.writeFileSync('version.txt', newVersion);
        console.log('✅ Updated version.txt');
        
        // Tạo release notes
        const currentDate = new Date().toLocaleDateString('vi-VN');
        const notesContent = `Chrome Manager v${newVersion} - ${currentDate}

✅ PHIÊN BẢN MỚI:
• Cập nhật version ${newVersion}
• Cải thiện hiệu suất và ổn định
• Sửa lỗi từ phiên bản trước
• Tối ưu hóa trải nghiệm người dùng

🚀 TÍNH NĂNG:
• Quản lý Chrome profiles chuyên nghiệp
• Tích hợp proxy automation
• Auto-install Chrome extensions
• Giao diện tiếng Việt thân thiện

📦 FILES:
• Chrome-Manager-Setup.exe - Installer
• Portable version trong win-unpacked/
• Auto-update system ready`;

        fs.writeFileSync('release-notes.txt', notesContent);
        console.log('✅ Created release-notes.txt');
        
        console.log('');
        console.log('🏗️  BUILDING...');
        console.log('================');
        
        // Xóa dist cũ với retry
        console.log('🧹 Cleaning old build...');
        for (let i = 0; i < 3; i++) {
            try {
                if (fs.existsSync('dist')) {
                    fs.rmSync('dist', { recursive: true, force: true });
                }
                break;
            } catch (error) {
                if (i === 2) throw error;
                console.log(`⏳ Retry ${i + 1}/3...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Build
        await runCommand('npm run build-only');
        
        console.log('');
        console.log('🎉 AUTO DIST HOÀN THÀNH!');
        console.log('========================');
        console.log(`✨ Version ${newVersion} đã được build thành công`);
        console.log('📁 Files sẵn sàng trong thư mục dist/');
        console.log('');
        console.log('🔄 Để upload lên server, chạy: npm run dist');
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
}

function runCommand(command) {
    return new Promise((resolve, reject) => {
        console.log(`🔄 ${command}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            if (stdout) console.log(stdout);
            if (stderr) console.log(stderr);
            resolve();
        });
    });
}

quickDist();
