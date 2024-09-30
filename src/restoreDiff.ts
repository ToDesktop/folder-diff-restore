// src/restoreDiff.ts

import * as fs from "fs-extra";
import * as path from "path";
import debug from "debug";

const log = debug("folder-diff-restore:restoreDiff");
/**
 * Restores a directory by applying the diff folder.
 * @param targetFolder - Path to the target directory to restore (Folder A).
 * @param diffFolder - Path to the diff folder containing additions and modifications.
 * @param metadataPath - Path to the __folder-diff-metadata.json metadata file within the diff folder.
 */
export async function restoreDiff(
  targetFolder: string,
  diffFolder: string,
  metadataPath: string = path.join(diffFolder, "__folder-diff-metadata.json")
): Promise<void> {
  // Read removed items metadata
  let removedItems: string[] = [];
  if (await fs.pathExists(metadataPath)) {
    const metadata = await fs.readJson(metadataPath);
    removedItems = metadata.removed || [];
  }

  // Handle Removals
  for (const itemPath of removedItems) {
    const targetPath = path.join(targetFolder, itemPath);
    if (await fs.pathExists(targetPath)) {
      await fs.remove(targetPath);
      log(`Removed: ${itemPath}`);
    }
  }

  // Apply Additions and Modifications
  // Exclude '__folder-diff-metadata.json' from being copied
  const filter = (src: string, dest: string): boolean => {
    const relative = path.relative(diffFolder, src);
    if (relative === "__folder-diff-metadata.json") return false;
    return true;
  };

  // Recursively walk through diffFolder to handle symlinks
  const walk = async (currentPath: string) => {
    const items = await fs.readdir(currentPath);
    for (const item of items) {
      const srcPath = path.join(currentPath, item);
      const relativePath = path.relative(diffFolder, srcPath);
      const destPath = path.join(targetFolder, relativePath);
      const stats = await fs.lstat(srcPath);

      if (stats.isSymbolicLink()) {
        const symlinkTarget = await fs.readlink(srcPath);
        await fs.ensureDir(path.dirname(destPath));
        // Remove existing file or symlink if it exists
        if (await fs.pathExists(destPath)) {
          await fs.remove(destPath);
        }
        await fs.symlink(symlinkTarget, destPath);
        log(`Restored symlink: ${relativePath} -> ${symlinkTarget}`);
      } else if (stats.isDirectory()) {
        await fs.ensureDir(destPath);
        await walk(srcPath); // Recurse into subdirectories
      } else if (stats.isFile()) {
        await fs.ensureDir(path.dirname(destPath));
        await fs.copyFile(srcPath, destPath);
        log(`Restored file: ${relativePath}`);
      }
      // Handle other types if necessary (e.g., sockets, FIFOs)
    }
  };

  await walk(diffFolder);

  log("Restoration complete.");
}
