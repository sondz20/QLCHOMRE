const { exec } = require('child_process');
const fs = require('fs');

console.log('⚡ CHROME MANAGER - QUICK BUILD');
console.log('===============================');
console.log('');

async function quickBuild() {
    try {
        console.log('🗑️  Xóa thư mục dist cũ...');
        if (fs.existsSync('dist')) {
            fs.rmSync('dist', { recursive: true, force: true });
        }
        
        console.log('🔨 Quick building...');
        await runCommand('npm run build-only');
        
        console.log('');
        console.log('✅ QUICK BUILD HOÀN THÀNH!');
        console.log('===========================');
        console.log('📁 Check thư mục dist/ để lấy files');
        
    } catch (error) {
        console.error('❌ Quick build thất bại:', error.message);
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

quickBuild();
