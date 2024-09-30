import * as fs from "fs-extra";
import * as path from "path";
import { Result } from "dir-compare";
import { compareDirectories } from "./compareDirectories";

/**
 * Interface for Diff Options.
 */
export interface DiffOptions {
  compareSize?: boolean;
  compareContent?: boolean;
  // Add more options from dir-compare as needed
}

/**
 * Generates a diff folder based on the comparison of two directories.
 * @param folderA - Path to Folder A (original).
 * @param folderB - Path to Folder B (new).
 * @param diffFolder - Path where the diff folder will be created.
 * @param options - Comparison options.
 */
export async function createDiff(
  folderA: string,
  folderB: string,
  diffFolder: string,
  options: DiffOptions = { compareSize: true, compareContent: true }
): Promise<void> {
  // Ensure the diff folder is clean
  await fs.remove(diffFolder);
  await fs.ensureDir(diffFolder);

  // Perform the comparison
  const comparisonResult: Result = await compareDirectories(
    folderA,
    folderB,
    options
  );

  const removedItems: string[] = [];

  // Process each difference
  if (comparisonResult.diffSet) {
    for (const entry of comparisonResult.diffSet) {
      const { state, name1, name2, relativePath } = entry;

      const eitherName = name1 || name2;

      if (!relativePath || !eitherName) {
        throw new Error(
          `Invalid entry in comparison result: ${JSON.stringify(entry)}`
        );
      }

      // Determine the relative file path
      const relativeFilePath = relativePath
        ? path.join(relativePath, eitherName)
        : name1 || name2;

      if (!relativeFilePath) {
        throw new Error(`Invalid relative file path: ${relativeFilePath}`);
      }

      const sourcePathB = path.join(folderB, relativeFilePath);
      const targetPath = path.join(diffFolder, relativeFilePath);

      switch (state) {
        case "left": // Present only in Folder A (Removed)
          removedItems.push(relativeFilePath);
          break;
        case "right": // Present only in Folder B (Added)
          await fs.ensureDir(path.dirname(targetPath));
          await fs.copy(sourcePathB, targetPath);
          break;
        case "distinct": // Present in both but different (Modified)
          await fs.ensureDir(path.dirname(targetPath));
          await fs.copy(sourcePathB, targetPath);
          break;
        // 'equal' state requires no action
        default:
          break;
      }
    }
  }

  // Save removed items metadata
  if (removedItems.length > 0) {
    const metadataPath = path.join(diffFolder, "removed.json");
    await fs.writeJson(metadataPath, { removed: removedItems }, { spaces: 2 });
  }
}
