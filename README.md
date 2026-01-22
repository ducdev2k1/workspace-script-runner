# Workspace Script Runner

Run npm scripts with intuitive UI in VS Code - like WebStorm! 🚀

## Features

- 📦 **Multi-root workspace support** - Works with multiple projects
- 🔍 **Auto-detect package manager** - npm, yarn, pnpm, bun
- ⚡ **One-click run** - Click to run any script
- 🎨 **Beautiful TreeView** - See all projects and scripts

## Usage

1. Open a folder/workspace with `package.json`
2. Look for **"Scripts Runner"** in Explorer sidebar
3. Click on any script to run it!

## Settings

```json
{
  "scriptsRunner.defaultPackageManager": "auto",
  "scriptsRunner.workspacePackageManager": {
    "project-a": "pnpm",
    "project-b": "yarn"
  }
}
```

## Commands

- `Scripts Runner: Run Script` - Run selected script
- `Scripts Runner: Stop Script` - Stop running script
- `Scripts Runner: Restart Script` - Restart script
- `Scripts Runner: Change Package Manager` - Override package manager
- `Scripts Runner: Refresh` - Refresh scripts list

## Development

```bash
npm install
npm run compile
# Press F5 to launch Extension Development Host
```

## License

MIT
