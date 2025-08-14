const { exec } = require('child_process');
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
        console.log('🚀 Sẵn sàng để phân phối');
        
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

// Bắt đầu quá trình
main().catch(console.error);
