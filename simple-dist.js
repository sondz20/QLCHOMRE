const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=================================');
console.log('CHROME MANAGER - SIMPLE AUTO DIST');
console.log('=================================');
console.log('');

async function simpleDist() {
    try {
        // Đọc version hiện tại
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const currentVersion = packageJson.version;
        
        console.log('Current Version:', currentVersion);
        
        // Tăng patch version
        const versionParts = currentVersion.split('.');
        versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
        const newVersion = versionParts.join('.');
        
        console.log('New Version:', newVersion);
        
        // Cập nhật package.json
        packageJson.version = newVersion;
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
        console.log('Updated package.json');
        
        // Cập nhật version.txt
        fs.writeFileSync('version.txt', newVersion);
        console.log('Updated version.txt');
        
        // Tạo notes.txt
        const currentDate = new Date().toLocaleDateString('vi-VN');
        const notesContent = `Chrome Manager v${newVersion} - ${currentDate}

✅ CẬP NHẬT PHIÊN BẢN ${newVersion}:
• Cải thiện hiệu suất và ổn định quản lý Chrome
• Sửa lỗi từ phiên bản trước
• Tối ưu hóa trải nghiệm người dùng
• Cập nhật thư viện bảo mật

🔧 CHROME MANAGEMENT:
• Auto-install Chrome extensions
• Better proxy handling
• Enhanced profile management
• Performance optimizations

📅 Ngày phát hành: ${currentDate}
🏷️ Phiên bản: ${newVersion}
👨‍💻 Phát triển bởi: Chrome Manager Team

🔗 Tải xuống: https://toolfb.vn/CHROME/`;

        fs.writeFileSync('notes.txt', notesContent);
        console.log('Updated notes.txt');
        
        console.log('');
        console.log('Building application...');
        
        // Đóng Chrome Manager processes
        try {
            await runCommand('taskkill /f /im "Chrome Manager - Quản lý Chrome Pro.exe" 2>nul');
        } catch (e) {
            // Ignore
        }
        
        // Xóa dist cũ
        if (fs.existsSync('dist')) {
            fs.rmSync('dist', { recursive: true, force: true });
        }
        
        // Build
        await runCommand('npm run build-only');
        
        console.log('');
        console.log('Build completed successfully!');
        console.log('Files ready in dist/ folder');
        console.log('');
        console.log('Available files:');
        if (fs.existsSync('dist/Chrome-Manager-Setup.exe')) {
            const stats = fs.statSync('dist/Chrome-Manager-Setup.exe');
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`- Chrome-Manager-Setup.exe (${sizeInMB} MB)`);
        }
        if (fs.existsSync('notes.txt')) {
            console.log('- notes.txt');
        }
        if (fs.existsSync('version.txt')) {
            console.log('- version.txt');
        }
        
        console.log('');
        console.log('🎉 Version', newVersion, 'ready for distribution!');
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

function runCommand(command) {
    return new Promise((resolve, reject) => {
        console.log('Running:', command);
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

simpleDist();
