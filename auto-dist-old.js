const { exec } = require('child_process');
const Client = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Interface cho input từ user
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

console.log('🚀 CHROME MANAGER - AUTO BUILD & RELEASE');
console.log('=========================================');
console.log('');

console.log('🔢 BƯỚC 0: VERSION MANAGEMENT');
console.log('=============================');

// Đọc version hiện tại
let packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const currentVersion = packageJson.version;

console.log(`📋 Current Version: ${currentVersion}`);

// Tự động tính toán version mới
const versionParts = currentVersion.split('.');
const suggestedPatch = versionParts.slice();
suggestedPatch[2] = (parseInt(suggestedPatch[2]) + 1).toString();

const suggestedMinor = versionParts.slice();
suggestedMinor[1] = (parseInt(suggestedMinor[1]) + 1).toString();
suggestedMinor[2] = '0';

const suggestedMajor = versionParts.slice();
suggestedMajor[0] = (parseInt(suggestedMajor[0]) + 1).toString();
suggestedMajor[1] = '0';
suggestedMajor[2] = '0';

console.log('');
console.log('🎯 Chọn loại version bump:');
console.log(`   1. Patch (${suggestedPatch.join('.')}) - Bug fixes`);
console.log(`   2. Minor (${suggestedMinor.join('.')}) - New features`);
console.log(`   3. Major (${suggestedMajor.join('.')}) - Breaking changes`);
console.log(`   4. Custom - Nhập version tùy chỉnh`);
console.log(`   5. Skip - Giữ nguyên version hiện tại`);

async function getNewVersion() {
    const choice = await askQuestion('\n🔢 Chọn (1-5): ');
    
    switch(choice.trim()) {
        case '1':
            return suggestedPatch.join('.');
        case '2':
            return suggestedMinor.join('.');
        case '3':
            return suggestedMajor.join('.');
        case '4':
            const customVersion = await askQuestion('📝 Nhập version (x.y.z): ');
            if (!/^\d+\.\d+\.\d+$/.test(customVersion.trim())) {
                console.log('❌ Version không hợp lệ! Sử dụng patch version.');
                return suggestedPatch.join('.');
            }
            return customVersion.trim();
        case '5':
            return currentVersion;
        default:
            console.log('🔄 Chọn mặc định: Patch version');
            return suggestedPatch.join('.');
    }
}

async function main() {
    const newVersion = await getNewVersion();
    const isVersionChanged = newVersion !== currentVersion;
    
    console.log(`\n🆙 ${isVersionChanged ? 'New' : 'Current'} Version: ${newVersion}`);
    
    if (isVersionChanged) {
        // Cập nhật package.json với version mới
        packageJson.version = newVersion;
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
        console.log('✅ Updated package.json version');

        // Cập nhật version.txt với version mới
        fs.writeFileSync('version.txt', newVersion);
        console.log('✅ Updated version.txt');
    }

    // Cập nhật release notes
    const currentDate = new Date().toLocaleDateString('vi-VN');
    const notesContent = `Chrome Manager - Quản lý Chrome Pro v${newVersion}

🎉 TÍNH NĂNG MỚI VÀ CẢI TIẾN:
========================================

✅ CẬP NHẬT PHIÊN BẢN ${newVersion}:
• Quản lý Chrome profiles một cách chuyên nghiệp
• Tích hợp proxy automation cho từng profile
• Auto-install và auto-pin Chrome extensions
• Giao diện tiếng Việt thân thiện, dễ sử dụng
• Bảng quản lý profile với đầy đủ thông tin

🔧 TÍNH NĂNG CHÍNH:
• ✅ Tạo và quản lý Chrome profiles không giới hạn
• 🌐 Cấu hình proxy cho từng profile riêng biệt
• 🧩 Quản lý extensions tự động
• 📊 Theo dõi trạng thái running profiles
• ⚙️ Settings và cấu hình linh hoạt

🚀 CÔNG NGHỆ:
• Electron Desktop Application
• Chrome DevTools Protocol integration
• Puppeteer automation
• Modern table-based UI design
• Vietnamese localization

📅 Ngày phát hành: ${currentDate}
🏷️ Phiên bản: ${newVersion}
👨‍💻 Phát triển bởi: Chrome Manager Team

🔗 GitHub: https://github.com/sondz20/QLCHOMRE
📧 Hỗ trợ: [Email hỗ trợ]`;

    fs.writeFileSync('release-notes.txt', notesContent);
    console.log('✅ Updated release-notes.txt');
    console.log('');

    if (isVersionChanged) {
        console.log('🔄 BƯỚC 1: GIT SYNCHRONIZATION');
        console.log('==============================');
        await gitSync(newVersion);
    }

    await autoBuildProcess();
}

async function gitSync(version) {
    try {
        console.log('📥 Git: Adding all changes...');
        await runCommand('git add .');
        
        console.log(`📝 Git: Committing version ${version}...`);
        await runCommand(`git commit -m "🚀 Release v${version} - Auto version bump"`);
        
        console.log('🏷️  Git: Creating tag...');
        await runCommand(`git tag -a v${version} -m "Release v${version}"`);
        
        console.log('⬆️  Git: Pushing to GitHub...');
        await runCommand('git push origin master');
        
        console.log('🏷️  Git: Pushing tags...');
        await runCommand('git push origin --tags');
        
        console.log('✅ Git synchronization completed!');
        console.log(`🔗 GitHub: https://github.com/sondz20/QLCHOMRE/releases/tag/v${version}`);
    } catch (error) {
        console.warn('⚠️  Git sync failed (continuing with build):', error.message);
    }
    console.log('');
}

async function autoBuildProcess() {
    try {
        console.log('🏗️  BƯỚC 2: BUILD APPLICATION');
        console.log('============================');
        
        // Xóa thư mục dist cũ
        if (fs.existsSync('dist')) {
            console.log('🗑️  Xóa thư mục dist cũ...');
            fs.rmSync('dist', { recursive: true, force: true });
        }
        
        // Build ứng dụng
        console.log('🔨 Building Electron application...');
        await runCommand('npm run build-only');
        
        console.log('');
        console.log('📋 BƯỚC 3: KIỂM TRA BUILD OUTPUT');
        console.log('================================');
        
        // Kiểm tra file build
        const expectedFiles = [
            'dist/Chrome-Manager-Setup.exe',
            'dist/win-unpacked/Chrome Manager - Quản lý Chrome Pro.exe'
        ];
        
        let allFilesExist = true;
        for (const file of expectedFiles) {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`✅ ${path.basename(file)} (${sizeInMB} MB)`);
            } else {
                console.log(`❌ Thiếu: ${file}`);
                allFilesExist = false;
            }
        }
        
        if (!allFilesExist) {
            throw new Error('Một số files build bị thiếu');
        }
        
        console.log('');
        console.log('🎊 BUILD HOÀN THÀNH!');
        console.log('====================');
        console.log('✨ Chrome Manager đã được build thành công!');
        console.log('📁 Files output trong thư mục dist/');
        
        // Hỏi user có muốn upload không
        const shouldUpload = await askQuestion('\n🚀 Bạn có muốn upload lên server không? (y/n): ');
        
        if (shouldUpload.toLowerCase() === 'y' || shouldUpload.toLowerCase() === 'yes') {
            console.log('');
            console.log('� BƯỚC 4: UPLOAD TO SERVER');
            console.log('============================');
            
            // Upload lên server  
            await uploadToServer(packageJson.version);
        } else {
            console.log('⏭️  Bỏ qua upload - Files có sẵn trong thư mục dist/');
        }
        
        console.log('');
        console.log('🎉 QUÁ TRÌNH HOÀN TẤT!');
        console.log('======================');
        console.log('🚀 Chrome Manager sẵn sàng cho distribution!');
        
        // Hiển thị thông tin chi tiết
        console.log('');
        console.log('📦 CÁC FILE ĐƯỢC TẠO:');
        console.log('=====================');
        console.log('• Chrome-Manager-Setup.exe - File cài đặt cho end users');
        console.log('• win-unpacked/ - Portable version');
        console.log('• release-notes.txt - Ghi chú phiên bản');
        console.log('• version.txt - File version để auto-update');
        
    } catch (error) {
        console.error('');
        console.error('❌ BUILD THẤT BẠI!');
        console.error('==================');
        console.error('Lỗi:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

function runCommand(command) {
    return new Promise((resolve, reject) => {
        console.log(`🔄 Executing: ${command}`);
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

// ============== SFTP UPLOAD CONFIGURATION ==============
// TODO: Cập nhật thông tin server của bạn
const serverConfig = {
    host: 'YOUR_SERVER_IP',           // VD: '103.90.224.225'
    username: 'YOUR_USERNAME',        // VD: 'root' 
    password: 'YOUR_PASSWORD',        // VD: 'your_password'
    port: 22
};

const remoteDir = '/path/to/your/releases/';  // VD: '/www/wwwroot/yoursite.com/public/releases/'

// Files sẽ được upload
const uploadFiles = [
    {
        local: 'dist/Chrome-Manager-Setup.exe',
        remote: remoteDir + 'Chrome-Manager-Setup.exe'
    },
    {
        local: 'release-notes.txt', 
        remote: remoteDir + 'release-notes.txt'
    },
    {
        local: 'version.txt',
        remote: remoteDir + 'version.txt'
    }
];

async function uploadToServer(version) {
    // Kiểm tra cấu hình server
    if (serverConfig.host === 'YOUR_SERVER_IP') {
        console.log('⚠️  CẢNH BÁO: Server chưa được cấu hình!');
        console.log('📝 Hãy cập nhật thông tin server trong auto-dist.js:');
        console.log('   - serverConfig.host');
        console.log('   - serverConfig.username'); 
        console.log('   - serverConfig.password');
        console.log('   - remoteDir');
        console.log('');
        console.log('🏠 Files đã sẵn sàng trong thư mục dist/ để upload thủ công');
        return;
    }

    const sftp = new Client();
    
    try {
        console.log('🔐 Kết nối đến server...');
        await sftp.connect(serverConfig);
        console.log('✅ Kết nối thành công!');
        console.log('');
        
        // Đảm bảo thư mục remote tồn tại
        try {
            await sftp.mkdir(remoteDir, true);
        } catch (error) {
            // Thư mục có thể đã tồn tại
        }
        
        for (const file of uploadFiles) {
            if (!fs.existsSync(file.local)) {
                console.log(`❌ File không tồn tại: ${file.local}`);
                continue;
            }
            
            const stats = fs.statSync(file.local);
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
            
            console.log(`📤 Uploading: ${path.basename(file.local)} (${sizeInMB} MB)`);
            
            await sftp.put(file.local, file.remote);
            console.log(`✅ Uploaded: ${path.basename(file.remote)}`);
        }
        
        console.log('');
        console.log('🎉 UPLOAD HOÀN TẤT!');
        console.log('===================');
        console.log('✅ Tất cả files đã được upload thành công');
        console.log(`📋 Version ${version} đã sẵn sàng cho người dùng`);
        console.log('');
        console.log('🔗 Download URLs:');
        console.log(`   • https://yoursite.com/releases/Chrome-Manager-Setup.exe`);
        console.log(`   • https://yoursite.com/releases/release-notes.txt`);
        console.log(`   • https://yoursite.com/releases/version.txt`);
        
    } catch (error) {
        console.error('❌ Lỗi upload:', error.message);
        console.log('💡 Tip: Kiểm tra lại thông tin server config');
        throw error;
    } finally {
        await sftp.end();
    }
}

// Bắt đầu quá trình
main().catch(console.error);
