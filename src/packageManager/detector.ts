import * as fs from "fs";
import * as path from "path";
import {
  EnumPackageManager,
  LOCK_FILE_MAP,
  LOCK_FILE_PRIORITY,
} from "../types";

/**
 * Detect package manager dựa trên lock file trong folder
 * @param folderPath - Đường dẫn đến folder cần check
 * @returns Package manager được detect hoặc npm nếu không tìm thấy
 */
export const detectPackageManager = (
  folderPath: string,
): EnumPackageManager => {
  for (const lockFile of LOCK_FILE_PRIORITY) {
    const lockFilePath = path.join(folderPath, lockFile);
    if (fs.existsSync(lockFilePath)) {
      return LOCK_FILE_MAP[lockFile];
    }
  }
  // Fallback to npm
  return EnumPackageManager.Npm;
};

/**
 * Lấy command để chạy script theo package manager
 * @param manager - Package manager
 * @param scriptName - Tên script cần chạy
 * @returns Command string
 */
export const getRunCommand = (
  manager: EnumPackageManager,
  scriptName: string,
): string => {
  switch (manager) {
    case EnumPackageManager.Yarn:
      // yarn không cần "run" cho scripts
      return `yarn ${scriptName}`;
    case EnumPackageManager.Pnpm:
      return `pnpm run ${scriptName}`;
    case EnumPackageManager.Bun:
      return `bun run ${scriptName}`;
    case EnumPackageManager.Npm:
    default:
      return `npm run ${scriptName}`;
  }
};
