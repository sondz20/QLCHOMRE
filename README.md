# Chrome Manager - Công cụ Quản lý Chrome Desktop

Ứng dụng desktop được xây dựng bằng Electron và Node.js để quản lý Chrome browser instances, profiles, proxies và extensions với tính năng auto-install và visual extension toolbar.

## ✨ Tính năng chính

- 🖥️ **Giao diện Desktop**: Ứng dụng Windows desktop thân thiện
- 👤 **Quản lý Profiles**: Tạo và quản lý nhiều Chrome profiles
- 🌐 **Quản lý Proxy**: Thêm, kiểm tra và gán proxy cho profiles
- 🧩 **Auto-Install Extensions**: Tự động cài đặt extensions cho tất cả profiles
- 📌 **Visual Extension Toolbar**: Floating toolbar hiển thị extensions
- 🚀 **Khởi chạy Chrome**: Chạy Chrome với profile và proxy cụ thể
- 📊 **Theo dõi Instances**: Quản lý các Chrome instances đang chạy
- ⚡ **Auto-Pin Extensions**: Extensions tự động được pin và hiển thị

## 🛠️ Công nghệ sử dụng

- **Node.js** - Runtime JavaScript
- **Electron** - Framework để tạo desktop app
- **Puppeteer** - Chrome automation
- **HTML/CSS/JavaScript** - Giao diện người dùng
- **Chrome DevTools Protocol** - Tương tác với Chrome
- **Font Awesome** - Icons

## 📦 Cài đặt

### Yêu cầu hệ thống
- Node.js 16+ 
- Windows 10/11
- Google Chrome browser

### Cách cài đặt

1. **Clone hoặc tải project**
   ```bash
   cd chrome-manager
   ```

2. **Cài đặt dependencies**
   ```bash
   npm install
   ```

3. **Chạy ứng dụng**
   ```bash
   npm start
   ```

4. **Chạy trong chế độ development**
   ```bash
   npm run dev
   ```

## 🚀 Hướng dẫn sử dụng

### 1. Tạo Profile mới
- Click nút "Tạo Profile" 
- Nhập tên profile
- Chọn proxy (tùy chọn)
- Click "Tạo Profile"

### 2. Thêm Proxy
- Chuyển sang tab "Proxies"
- Click "Thêm Proxy"
- Nhập thông tin proxy (host, port, username, password)
- Chọn loại proxy (HTTP/SOCKS4/SOCKS5)

### 3. Import Proxies từ file
- Tab "Proxies" → Click "Import"
- Chọn file text (.txt) 
- Format: `host:port:username:password` (mỗi dòng một proxy)

### 4. Khởi chạy Chrome
- Tab "Profiles" → Click "Khởi chạy" trên profile muốn chạy
- Chrome sẽ mở với profile và proxy đã cấu hình

### 5. Quản lý Instances đang chạy
- Tab "Running" để xem các Chrome instances
- Click "Dừng" để đóng instance cụ thể

## 📁 Cấu trúc dự án

```
chrome-manager/
├── src/
│   ├── main.js              # Main process (Electron)
│   └── renderer/
│       ├── index.html       # Giao diện chính
│       ├── styles.css       # CSS styles
│       └── renderer.js      # Renderer process logic
├── data/                    # Data storage
│   ├── profiles/           # Chrome profiles data
│   ├── profiles.json       # Profiles config
│   └── proxies.json        # Proxies config
├── assets/                 # Assets (icons, images)
├── package.json            # Project config
└── README.md              # Documentation
```

## 🔧 Cấu hình nâng cao

### Chrome Arguments
Ứng dụng sử dụng các Chrome arguments sau:
- `--user-data-dir`: Đặt thư mục profile
- `--proxy-server`: Cấu hình proxy
- `--no-first-run`: Bỏ qua setup ban đầu
- `--disable-default-apps`: Tắt apps mặc định

### Định dạng Proxy
Hỗ trợ các loại proxy:
- **HTTP**: `http://host:port`
- **SOCKS4**: `socks4://host:port` 
- **SOCKS5**: `socks5://host:port`

Với authentication: `username:password@host:port`

## 🐛 Troubleshooting

### Chrome không khởi chạy
- Kiểm tra Chrome đã được cài đặt
- Thử chạy với quyền Administrator
- Kiểm tra đường dẫn Chrome trong code

### Proxy không hoạt động
- Kiểm tra thông tin proxy đúng
- Test proxy trước khi sử dụng
- Kiểm tra firewall/antivirus

### Lỗi permission
- Chạy ứng dụng với quyền Administrator
- Kiểm tra quyền ghi vào thư mục data/

## 📝 Phát triển thêm

### Thêm tính năng mới
1. Extensions management
2. Profile templates
3. Proxy rotation
4. Chrome automation scripts
5. Profile backup/restore

### Build thành executable
```bash
npm run build
```

## 🤝 Đóng góp

1. Fork project
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Liên hệ

- **Email**: your-email@example.com
- **GitHub**: https://github.com/yourusername/chrome-manager

## 🙏 Cảm ơn

- [Electron](https://electronjs.org/) - Framework tuyệt vời
- [Font Awesome](https://fontawesome.com/) - Icons đẹp
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) - Documentation

---

**Made with ❤️ for Chrome power users**
