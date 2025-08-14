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

console.log('🚀 CHROME MANAGER - AUTO BUILD & UPLOAD');
console.log('=======================================');
console.log('');

console.log('🔢 BƯỚC 0: VERSION BUMP & GIT SYNC');
console.log('==================================');

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

    // Cập nhật notes.txt với version mới
    const currentDate = new Date().toLocaleDateString('vi-VN');
    const notesContent = `Chrome Manager v${newVersion} - ${currentDate}

🎉 TÍNH NĂNG VÀ CẢI TIẾN MỚI:
========================================

✅ CẬP NHẬT PHIÊN BẢN ${newVersion}:
• Cải thiện hiệu suất và ổn định quản lý Chrome
• Sửa lỗi nhỏ từ phiên bản trước
• Tối ưu hóa trải nghiệm người dùng
• Cập nhật thư viện bảo mật

🔧 CẢI THIỆN HỆ THỐNG CHROME:
• Tự động backup Chrome profiles
• Cải thiện khả năng xử lý proxy errors
• Tối ưu memory usage cho nhiều profiles
• Nâng cao tốc độ khởi động Chrome instances

🚀 NÂNG CẤP EXTENSION MANAGEMENT:
• Auto-install extensions improvements  
• Better extension pinning system
• Enhanced toolbar management
• Performance optimizations

📅 Ngày phát hành: ${currentDate}
🏷️ Phiên bản: ${newVersion}
👨‍💻 Phát triển bởi: Chrome Manager Team

🔗 Tải xuống tại: https://toolfb.vn/CHROME/
📧 Hỗ trợ: support@chrome-manager.vn`;

    fs.writeFileSync('notes.txt', notesContent);
    console.log('✅ Updated notes.txt');
    console.log('');

    if (isVersionChanged) {
        console.log('🔄 BƯỚC 1: GIT SYNCHRONIZATION');
        console.log('==============================');
        await gitSync(newVersion);
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

    async function autoBuildAndUpload() {
        try {
            console.log('🏗️  BƯỚC 2: BUILD APPLICATION');
            console.log('============================');
            
            // Đóng các Chrome Manager processes đang chạy
            console.log('🔄 Đóng Chrome Manager processes...');
            try {
                await runCommand('taskkill /f /im "Chrome Manager - Quản lý Chrome Pro.exe" 2>nul || echo "No process found"');
            } catch (e) {
                // Ignore error
            }
            
            // Xóa thư mục dist cũ với retry
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
            
            // Build ứng dụng
            console.log('🔨 Building Chrome Manager...');
            await runCommand('npm run build-only');
            
            console.log('');
            console.log('📋 BƯỚC 3: KIỂM TRA FILES');
            console.log('=========================');
            
            // Kiểm tra files
            let allFilesExist = true;
            for (const file of files) {
                if (fs.existsSync(file.local)) {
                    const stats = fs.statSync(file.local);
                    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
                    console.log(`✅ ${path.basename(file.local)} (${sizeInMB} MB)`);
                } else {
                    console.log(`❌ Thiếu: ${file.local}`);
                    allFilesExist = false;
                }
            }
            
            if (!allFilesExist) {
                throw new Error('Thiếu files cần thiết sau khi build');
            }
            
            console.log('');
            console.log('📤 BƯỚC 4: UPLOAD TO SERVER');
            console.log('============================');
            
            // Upload lên server tự động
            await uploadToServer(newVersion);
            
            console.log('');
            console.log('🎊 HOÀN THÀNH TẤT CẢ!');
            console.log('=====================');
            console.log('✨ Build và upload thành công!');
            console.log(`🎯 Version ${newVersion} đã sẵn sàng cho người dùng`);
            
        } catch (error) {
            console.error('');
            console.error('❌ QUÁ TRÌNH THẤT BẠI!');
            console.error('======================');
            console.error('Lỗi:', error.message);
            process.exit(1);
        } finally {
            rl.close();
        }
    }

    // Chạy quá trình build và upload
    await autoBuildAndUpload();
}

// Bắt đầu quá trình
main().catch(console.error);

// Cấu hình SFTP
const config = {
    host: '103.90.224.225',
    username: 'root',
    password: '4k9Ym61ZIhiAWx796YVn0mVK',
    port: 22
};

const remoteDir = '/www/wwwroot/toolfb.vn/public/CHROME/';

// Files cần upload
const files = [
    {
        local: 'dist/Chrome-Manager-Setup.exe',
        remote: remoteDir + 'Chrome-Manager-Setup.exe'
    },
    {
        local: 'notes.txt', 
        remote: remoteDir + 'notes.txt'
    },
    {
        local: 'version.txt',
        remote: remoteDir + 'version.txt'
    }
];

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

async function uploadToServer(version) {
    const sftp = new Client();
    
    try {
        console.log('🔐 Kết nối đến server Chrome Manager...');
        await sftp.connect(config);
        console.log('✅ Kết nối thành công!');
        console.log('');
        
        // Đảm bảo thư mục remote tồn tại
        try {
            await sftp.mkdir(remoteDir, true);
        } catch (error) {
            // Thư mục có thể đã tồn tại
        }
        
        for (const file of files) {
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
        console.log(`   • https://toolfb.vn/CHROME/Chrome-Manager-Setup.exe`);
        console.log(`   • https://toolfb.vn/CHROME/notes.txt`);
        console.log(`   • https://toolfb.vn/CHROME/version.txt`);
        
    } catch (error) {
        console.error('❌ Lỗi upload:', error.message);
        throw error;
    } finally {
        await sftp.end();
    }
}
