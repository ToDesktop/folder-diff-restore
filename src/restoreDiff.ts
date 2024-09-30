import * as fs from "fs-extra";
import * as path from "path";

/**
 * Restores a directory by applying the diff folder.
 * @param targetFolder - Path to the target directory to restore (Folder A).
 * @param diffFolder - Path to the diff folder containing additions and modifications.
 * @param metadataPath - Path to the removed.json metadata file within the diff folder.
 */
export async function restoreDiff(
  targetFolder: string,
  diffFolder: string,
  metadataPath: string = path.join(diffFolder, "removed.json")
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
    }
  }

  // Apply Additions and Modifications
  // Exclude 'removed.json' from being copied
  const filter = (src: string, dest: string): boolean => {
    const relative = path.relative(diffFolder, src);
    if (relative === "removed.json") return false;
    return true;
  };

  await fs.copy(diffFolder, targetFolder, { overwrite: true, filter });
}
