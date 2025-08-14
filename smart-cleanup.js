// SMART CLEANUP SCRIPT - Xóa file an toàn
const fs = require('fs');
const path = require('path');

// Danh sách file ĐƯỢC PHÉP xóa (whitelist)
const allowedToDelete = [
    /^fix-.*\.js$/,           // fix-*.js
    /^test-.*\.js$/,          // test-*.js  
    /^manual-.*\.js$/,        // manual-*.js
    /^temp-.*\.js$/,          // temp-*.js
    /^cleanup-.*\.js$/,       // cleanup-*.js
    /^remove-.*\.js$/,        // remove-*.js
    /^ultimate-.*\.js$/,      // ultimate-*.js
    /.*\.backup.*/,           // *.backup*
    /.*\.ps1$/,               // *.ps1
    /^UTF8$/,                 // File UTF8
    /^temp$/,                 // temp files
    /^tmp$/,                  // tmp files
];

// Danh sách file TUYỆT ĐỐI KHÔNG XÓA (blacklist)
const neverDelete = [
    'PROJECT_MEMORY.md',
    'package.json',
    'package-lock.json', 
    'README.md',
    '.gitignore',
    'smart-cleanup.js',      // Chính script này
    /^src\//,                // Thư mục src
    /^data\//,               // Thư mục data
    /^\.github\//,           // Thư mục .github
    /^node_modules\//,       // node_modules
    /^assets\//,             // assets
];

function isAllowedToDelete(filename) {
    // Kiểm tra blacklist trước
    for (let pattern of neverDelete) {
        if (typeof pattern === 'string') {
            if (filename === pattern) return false;
        } else if (pattern instanceof RegExp) {
            if (pattern.test(filename)) return false;
        }
    }
    
    // Kiểm tra whitelist
    for (let pattern of allowedToDelete) {
        if (pattern.test(filename)) return true;
    }
    
    return false; // Mặc định không xóa
}

function smartCleanup() {
    console.log('🧠 SMART CLEANUP - Bắt đầu dọn dẹp thông minh...\n');
    
    const files = fs.readdirSync('.');
    let deletedFiles = [];
    let protectedFiles = [];
    
    for (let file of files) {
        if (fs.statSync(file).isFile()) {
            if (isAllowedToDelete(file)) {
                try {
                    fs.unlinkSync(file);
                    deletedFiles.push(file);
                    console.log(`✅ Đã xóa: ${file}`);
                } catch (err) {
                    console.log(`❌ Lỗi xóa ${file}: ${err.message}`);
                }
            } else {
                protectedFiles.push(file);
                console.log(`🛡️ Được bảo vệ: ${file}`);
            }
        }
    }
    
    console.log(`\n📊 KẾT QUẢ:`);
    console.log(`   🗑️ Đã xóa ${deletedFiles.length} file`);
    console.log(`   🛡️ Đã bảo vệ ${protectedFiles.length} file`);
    
    if (deletedFiles.length > 0) {
        console.log(`\n🗑️ Files đã xóa: ${deletedFiles.join(', ')}`);
    }
    
    console.log('\n✨ Dọn dẹp hoàn tất!');
}

if (require.main === module) {
    smartCleanup();
}

module.exports = { smartCleanup, isAllowedToDelete };
