/**
 * Lightweight mock of the `vscode` module used by vitest.
 * Only the APIs actually consumed by the extension are stubbed here.
 */

/* ---------- Enums / constants ---------- */

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

/* ---------- Uri ---------- */

export class Uri {
  readonly scheme: string;
  readonly fsPath: string;
  readonly path: string;

  private constructor(fsPath: string) {
    this.scheme = "file";
    this.fsPath = fsPath;
    this.path = fsPath;
  }

  static file(p: string): Uri {
    return new Uri(p);
  }

  toString(): string {
    return this.fsPath;
  }
}

/* ---------- EventEmitter ---------- */

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => this.listeners.splice(this.listeners.indexOf(listener), 1) };
  };

  fire(data: T): void {
    for (const fn of this.listeners) fn(data);
  }

  dispose(): void {
    this.listeners = [];
  }
}

/* ---------- TreeItem ---------- */

export class TreeItem {
  label: string;
  collapsibleState: TreeItemCollapsibleState;
  description?: string;
  tooltip?: string;
  iconPath?: unknown;
  contextValue?: string;
  command?: unknown;

  constructor(label: string, collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

/* ---------- ThemeIcon / ThemeColor ---------- */

export class ThemeIcon {
  constructor(public readonly id: string, public readonly color?: ThemeColor) {}
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

/* ---------- TaskScope / TaskGroup / Task ---------- */

export const TaskScope = { Global: 1, Workspace: 2 } as const;

export const TaskGroup = {
  Clean: { id: "clean" },
  Build: { id: "build" },
  Rebuild: { id: "rebuild" },
  Test: { id: "test" },
} as const;

export class Task {
  definition: unknown;
  scope: unknown;
  name: string;
  source: string;
  execution: unknown;
  group: unknown;

  constructor(def: unknown, scope: unknown, name: string, source: string, execution: unknown) {
    this.definition = def;
    this.scope = scope;
    this.name = name;
    this.source = source;
    this.execution = execution;
  }
}

export class CustomExecution {
  constructor(public readonly callback: () => Promise<unknown>) {}
}

/* ---------- workspace ---------- */

/** Configurable mock store — tests can mutate this before importing modules */
export const __mockConfig: Record<string, unknown> = {
  "scriptsRunner.defaultPackageManager": "auto",
  "scriptsRunner.workspacePackageManager": {},
};

const createConfigProxy = () => ({
  get: <T>(key: string, defaultValue?: T): T => {
    const fullKey = `scriptsRunner.${key}`;
    return (fullKey in __mockConfig ? __mockConfig[fullKey] : defaultValue) as T;
  },
  update: async (_key: string, _value: unknown, _target?: unknown) => {},
});

export const workspace = {
  getConfiguration: (_section?: string) => createConfigProxy(),
  workspaceFolders: undefined as { uri: Uri; name: string; index: number }[] | undefined,
  createFileSystemWatcher: () => ({
    onDidChange: () => ({ dispose: () => {} }),
    onDidCreate: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
  getWorkspaceFolder: (_uri: Uri) => undefined,
};

/* ---------- window ---------- */

const createMockTerminal = (name: string) => ({
  name,
  sendText: () => {},
  show: () => {},
  dispose: () => {},
});

export const window = {
  createTerminal: (options: { name?: string; cwd?: string }) =>
    createMockTerminal(options.name ?? "terminal"),
  showInformationMessage: () => {},
  showWarningMessage: () => {},
  showErrorMessage: () => {},
  showQuickPick: async () => undefined,
  onDidCloseTerminal: () => ({ dispose: () => {} }),
  createTreeView: () => ({ dispose: () => {} }),
};

/* ---------- commands ---------- */

export const commands = {
  registerCommand: (_command: string, _callback: (...args: unknown[]) => unknown) => ({
    dispose: () => {},
  }),
};

/* ---------- debug ---------- */

export const debug = {
  startDebugging: async () => true,
  stopDebugging: async () => {},
  onDidStartDebugSession: () => ({ dispose: () => {} }),
  onDidTerminateDebugSession: () => ({ dispose: () => {} }),
};

/* ---------- env ---------- */

export const env = {
  clipboard: {
    writeText: async () => {},
    readText: async () => "",
  },
};

/* ---------- tasks ---------- */

export const tasks = {
  registerTaskProvider: () => ({ dispose: () => {} }),
};

/* ---------- FileSystemWatcher (type helper) ---------- */

export type FileSystemWatcher = ReturnType<typeof workspace.createFileSystemWatcher>;

/* ---------- Memento (for workspaceState) ---------- */

export class MockMemento {
  private store = new Map<string, unknown>();

  get<T>(key: string, defaultValue?: T): T {
    return (this.store.has(key) ? this.store.get(key) : defaultValue) as T;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }
}

/* ---------- DebugConfiguration (type) ---------- */

export interface DebugConfiguration {
  type: string;
  request: string;
  name: string;
  [key: string]: unknown;
}
