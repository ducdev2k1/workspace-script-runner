<p align="center">
  <img src="resources/icon.png" alt="Workspace Script Runner" width="128" height="128">
</p>

<h1 align="center">Workspace Script Runner</h1>

<p align="center">
  <strong>Run npm scripts with intuitive UI in VS Code! 🚀</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=ducdev2k1.workspace-script-runner">
    <img src="https://img.shields.io/visual-studio-marketplace/v/ducdev2k1.workspace-script-runner?style=flat-square" alt="Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=ducdev2k1.workspace-script-runner">
    <img src="https://img.shields.io/visual-studio-marketplace/i/ducdev2k1.workspace-script-runner?style=flat-square" alt="Installs">
  </a>
  <a href="https://github.com/ducdev2k1/workspace-script-runner/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ducdev2k1/workspace-script-runner?style=flat-square" alt="License">
  </a>
</p>

---

## ✨ Features

- 📦 **Multi-root workspace support** - Works with multiple projects simultaneously
- 🔍 **Auto-detect package manager** - npm, yarn, pnpm, bun
- ⚡ **One-click run** - Click to run any script instantly
- 🎨 **Beautiful TreeView** - See all projects and scripts at a glance
- 🔄 **Running state indicator** - Know which scripts are currently running
- 🛑 **Easy stop/restart** - Stop or restart scripts with one click

## 📸 Screenshot

> TreeView showing projects with package manager icons and scripts

## 🚀 Usage

1. Open a folder/workspace with `package.json`
2. Look for **"Scripts Runner"** in Explorer sidebar
3. Click on any script to run it!

## ⚙️ Settings

```json
{
  "scriptsRunner.defaultPackageManager": "auto",
  "scriptsRunner.workspacePackageManager": {
    "project-a": "pnpm",
    "project-b": "yarn"
  }
}
```

| Setting                   | Description                          | Default |
| ------------------------- | ------------------------------------ | ------- |
| `defaultPackageManager`   | Default PM when auto-detection fails | `auto`  |
| `workspacePackageManager` | Override PM for specific projects    | `{}`    |

## 🎯 Commands

| Command                                  | Description              |
| ---------------------------------------- | ------------------------ |
| `Scripts Runner: Run Script`             | Run selected script      |
| `Scripts Runner: Stop Script`            | Stop running script      |
| `Scripts Runner: Restart Script`         | Restart script           |
| `Scripts Runner: Change Package Manager` | Override package manager |
| `Scripts Runner: Refresh`                | Refresh scripts list     |

## 🛠️ Development

```bash
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

## 📄 License

MIT © [ducdev2k1](https://github.com/ducdev2k1)
