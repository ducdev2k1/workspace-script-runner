/** Enum cho các package manager được hỗ trợ */
export enum EnumPackageManager {
  Npm = "npm",
  Yarn = "yarn",
  Pnpm = "pnpm",
  Bun = "bun",
}

/** Interface cho thông tin một project trong workspace */
export interface IWorkspaceProject {
  /** Tên của project (folder name) */
  name: string;
  /** Đường dẫn tuyệt đối đến folder */
  path: string;
  /** Đường dẫn đến file package.json */
  packageJsonPath: string;
  /** Package manager được sử dụng */
  packageManager: EnumPackageManager;
  /** Danh sách scripts trong package.json */
  scripts: IScriptItem[];
}

/** Interface cho một script item */
export interface IScriptItem {
  /** Tên của script */
  name: string;
  /** Command của script */
  command: string;
  /** Project chứa script này */
  project: IWorkspaceProject;
}

/** Map lock file với package manager tương ứng */
export const LOCK_FILE_MAP: Record<string, EnumPackageManager> = {
  "pnpm-lock.yaml": EnumPackageManager.Pnpm,
  "yarn.lock": EnumPackageManager.Yarn,
  "bun.lockb": EnumPackageManager.Bun,
  "package-lock.json": EnumPackageManager.Npm,
};

/** Thứ tự ưu tiên khi detect lock file */
export const LOCK_FILE_PRIORITY: string[] = [
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "package-lock.json",
];
