const { spawn } = require('child_process');

console.log('🚀 DEMO AUTO-DIST - LIKE TOOLFB.VN');
console.log('==================================');
console.log('');

// Input tự động: Chọn patch version (1), auto upload
const input = `1
`;

console.log('📝 Demo sẽ chọn:');
console.log('   - Version bump: 1 (Patch - 1.0.4 → 1.0.5)');
console.log('   - Upload: Tự động upload lên server');
console.log('');
console.log('⚠️  Chú ý: Script sẽ upload thật lên server!');
console.log('');

const process = spawn('node', ['auto-dist.js'], {
    stdio: ['pipe', 'inherit', 'inherit']
});

// Gửi input
process.stdin.write(input);
process.stdin.end();

process.on('close', (code) => {
    console.log('');
    console.log('✅ Auto-dist demo hoàn thành!');
    console.log(`Exit code: ${code}`);
    if (code === 0) {
        console.log('🎉 Version mới đã được build và upload thành công!');
        console.log('🔗 Khách hàng có thể tải tại: https://toolfb.vn/CHROME/Chrome-Manager-Setup.exe');
    }
});
