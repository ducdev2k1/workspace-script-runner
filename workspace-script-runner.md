# VS Code Extension Idea: Workspace Script Runner

## 1. Mục tiêu
Xây dựng một extension cho **Visual Studio Code** cho phép:R
- Click chạy nhanh `scripts` giống **WebStorm**
- Hoạt động tốt với **multi-root workspace** (mở nhiều project cùng lúc)
- Hỗ trợ **đa package manager**: npm, yarn, pnpm, bun
- Tự động phát hiện package manager thông qua **lock file**
- Cho phép người dùng **set default package manager**
- Tránh chạy nhầm project, nhầm thư mục

---

## 2. Vấn đề hiện tại
- VS Code không có UI npm scripts đủ trực quan
- Khi mở nhiều project dễ chạy nhầm thư mục
- Nhiều project hiện đại không dùng npm
- Các extension hiện có chưa tối ưu multi-root

---

## 3. Quét Workspace
- Duyệt qua tất cả `workspaceFolders`
- Với mỗi folder:
  - Tìm `package.json`
  - Parse `scripts`
  - Detect package manager
  - Gán terminal riêng

---

## 4. Phát hiện Package Manager

### 4.1 Lock file ưu tiên

| Lock file | Package Manager |
|---------|-----------------|
| pnpm-lock.yaml | pnpm |
| yarn.lock | yarn |
| bun.lockb | bun |
| package-lock.json | npm |

Không có lock file → fallback **npm**

---

## 5. Cấu hình người dùng

### 5.1 Global setting
```json
"smartScriptRunner.defaultPackageManager": "auto"
```

### 5.2 Workspace override
```json
"smartScriptRunner.workspacePackageManager": {
  "project-a": "pnpm",
  "project-b": "yarn"
}
```

### 5.3 Thứ tự ưu tiên
1. Workspace override
2. User default
3. Auto detect
4. npm

---

## 6. Command chạy script

| Manager | Command |
|-------|---------|
| npm | npm run <script> |
| yarn | yarn <script> |
| pnpm | pnpm run <script> |
| bun | bun run <script> |

---

## 7. UI đề xuất

```
📦 project-a (pnpm)
  ▶ dev
  ▶ build

📦 project-b (yarn)
  ▶ dev
```

---

## 8. Multi-root Workspace

- Terminal riêng cho từng project
- Tên terminal: `scripts: project-a (pnpm)`
- cwd đúng workspace folder

---

## 9. Tính năng nâng cao
- Favorite scripts ⭐
- Run with arguments
- Watch package.json
- Group scripts

---

## 10. Command Palette

```
Scripts Runner: Run Script
Scripts Runner: Stop Script
Scripts Runner: Restart Script
Scripts Runner: Change Package Manager
```

---

## 11. Kiến trúc đề xuất

```
src/
 ├─ extension.ts
 ├─ workspace/
 ├─ packageManager/
 ├─ ui/
 ├─ terminal/
 ├─ config/
```

---

## 12. Kết luận
Extension giúp VS Code:
- Ngang hoặc hơn WebStorm về chạy script
- Tối ưu cho monorepo & multi-project
- Phù hợp publish Marketplace
