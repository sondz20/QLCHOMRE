# PROJECT MEMORY - Chrome Management Tool

## Thông tin dự án
- **Tên dự án**: Chrome Management Tool
- **Công nghệ**: Electron + Node.js + Puppeteer
- **Ngôn ngữ giao diện**: Tiếng Việt (UTF-8)
- **Mục đích**: Quản lý Chrome profiles, proxies, extensions

## Kinh nghiệm làm việc với User

### 1. Yêu cầu về mã hóa (Encoding)
- **Quan trọng**: User luôn yêu cầu giao diện tiếng Việt
- **Vấn đề thường gặp**: Lỗi encoding UTF-8 với ký tự Việt Nam
- **Giải pháp đã áp dụng**: 
  - Sử dụng multiple fix scripts
  - PowerShell có hạn chế với UTF-8
  - Node.js script hiệu quả hơn cho việc sửa encoding

### 2. Phong cách làm việc của User
- **Ngôn ngữ**: Tiếng Việt ngắn gọn
- **Yêu cầu**: Rõ ràng, cụ thể
- **Không thích**: File rác, code dư thừa
- **Thích**: Workspace sạch sẽ, có tổ chức

### 2a. Phong cách Giao diện (UI/UX)
- **Ngôn ngữ giao diện**: 100% Tiếng Việt
- **Layout**: Table-based design, modern và clean
- **Màu sắc**: Tông màu professional, không quá rực rỡ
- **Responsive**: Phải responsive và user-friendly
- **Navigation**: Tab-based navigation (Profiles, Proxies, Extensions, Running, Settings)
- **Modal**: Sử dụng modal cho confirmations và forms
- **Icons**: Sử dụng emoji/icons để làm UI sinh động (✅, ❌, 🔄, etc.)
- **Typography**: Clear, readable fonts với proper spacing

### 2b. Phong cách Coding của User
- **Architecture**: Clean, modular structure
- **File organization**: Tách biệt rõ ràng (src/renderer/, data/, assets/)
- **Code style**: 
  - Prefer functional approach
  - Clear variable names (Vietnamese comments OK)
  - Consistent indentation
  - Remove unused code immediately
- **Error handling**: Robust error handling với user-friendly messages
- **Performance**: Efficient, không để memory leaks
- **Comments**: Tiếng Việt cho business logic, English cho technical
- **Dependencies**: Chỉ dùng những gì cần thiết
- **Testing**: Prefer manual testing với clear test scenarios

### 3. Các tính năng đã loại bỏ
- **Workflow Builder**: Đã xóa hoàn toàn theo yêu cầu user
- **Lý do**: User không cần tính năng này
- **Files đã xóa**: 
  - Workflow tab trong index.html
  - Workflow styles trong styles.css
  - Workflow logic trong renderer.js

### 4. Bugs đã sửa
- **Class name mismatch**: `ChromeManager` vs `ChromeManagerUI`
- **Vietnamese encoding**: Multiple character corruption patterns
- **UI failure**: Complete breakdown after workflow removal

### 5. File structure hiện tại
```
QLCHROME/
├── .github/
├── assets/
├── data/
│   ├── extensions.json
│   ├── profiles.json
│   ├── proxies.json
│   └── profiles/ (Chrome profile folders)
├── src/
│   ├── main.js
│   ├── preload.js
│   └── renderer/
├── package.json
├── README.md
└── PROJECT_MEMORY.md (this file)
```

### 6. Lệnh thường dùng
- `npm start` - Khởi động ứng dụng
- `taskkill /F /IM electron.exe` - Dừng Electron
- `taskkill /F /IM chrome.exe` - Dừng Chrome

### 7. Lưu ý quan trọng
- **KHÔNG XÓA FILE NÀY** - User muốn giữ lại để AI học hỏi
- Luôn kiểm tra encoding khi sửa file tiếng Việt
- User thích workspace sạch sẽ nhưng giữ lại những gì cần thiết
- Khi cleanup, hỏi trước khi xóa file quan trọng

### 8. QUY TẮC XÓA FILE - QUAN TRỌNG!
**Khi user nói "xóa file dư thừa" KHÔNG BAO GIỜ XÓA:**
- `PROJECT_MEMORY.md` (file này - bộ nhớ AI)
- `package.json` 
- `README.md`
- Thư mục `src/` và nội dung
- Thư mục `data/` và nội dung
- File `.gitignore` nếu có

**CHỈ XÓA các file:**
- `fix-*.js` (scripts tạm thời)
- `test-*.js` (scripts test)
- `*.backup*` (file backup)
- `*.ps1` (PowerShell scripts tạm thời)
- File có tên chứa "temp", "tmp", "manual"
- File không có extension rõ ràng (như "UTF8")

**QUY TRÌNH THÔNG MINH:**
1. Luôn list files trước khi xóa
2. Kiểm tra từng file với danh sách KHÔNG XÓA
3. Chỉ xóa file rõ ràng là tạm thời/test
4. Báo cáo những file đã xóa và những file đã giữ lại

### 8. Patterns thường gặp
- User nói "xóa hết" thường có nghĩa là xóa file tạm thời/test
- "Sửa encoding" là yêu cầu thường xuyên
- User đánh giá cao việc làm việc nhanh gọn
- **"xóa file dư thừa"** = chỉ xóa file temp/test, KHÔNG xóa file core
- User thích UI tiếng Việt 100%, không pha trộn English
- Code phải clean và well-organized
- Luôn test manual trước khi hoàn thành feature

### 8a. UI Patterns của User
- **Consistency**: Tất cả text phải tiếng Việt
- **Table design**: Prefer table layout cho data display
- **Modal confirmations**: Luôn confirm trước khi delete/modify
- **Status indicators**: Visual feedback cho user actions
- **Navigation**: Tab-based, easy switching between features
- **Form design**: Simple, clear labels, proper validation
- **Loading states**: Show progress cho long operations

### 8b. Code Patterns của User  
- **Error handling**: Try-catch với meaningful error messages
- **File structure**: Logical separation of concerns
- **Event handling**: Clean event listeners, avoid memory leaks
- **Data management**: JSON files cho configuration
- **API calls**: Proper async/await patterns
- **Code reuse**: Extract common functions to utilities
- **Documentation**: README và comments đầy đủ

### 9. AUTO-LEARNING SYSTEM
**File này tự động cập nhật để AI thông minh hơn:**
- Mỗi lần làm việc, ghi lại patterns mới
- Lưu solutions cho các vấn đề đã giải quyết
- Tracking user preferences và habits
- Cải thiện decision making cho lần sau

### 10. Công cụ hiệu quả
- Node.js scripts cho encoding fixes
- PowerShell cho file operations đơn giản  
- grep_search cho tìm patterns
- file_search cho locate files

### 11. SMART FILE MANAGEMENT
**Tạo script tự động xóa file an toàn:**
```javascript
// auto-cleanup.js - Script thông minh để xóa file
const protectedFiles = [
    'PROJECT_MEMORY.md',
    'package.json', 
    'README.md',
    'src/', 'data/', '.github/'
];
```

## Cập nhật lần cuối: 14/08/2025
**Lesson learned**: Không xóa PROJECT_MEMORY.md khi user nói "xóa file dư thừa"
**Style preferences**: UI 100% tiếng Việt, table-based design, clean code architecture
**Coding standards**: Modular structure, proper error handling, clear documentation
