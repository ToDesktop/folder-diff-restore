// src/createDiff.ts

import * as fs from "fs-extra";
import * as path from "path";
import { Result } from "dir-compare";
import debug from "debug";
import { compareDirectories } from "./compareDirectories";

const log = debug("folder-diff-restore:createDiff");

/**
 * Interface for Diff Options.
 */
export interface DiffOptions {
  compareSize?: boolean;
  compareContent?: boolean;
  compareSymlink?: boolean; // Added for symlink handling
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
  options: DiffOptions = {
    compareSize: true,
    compareContent: true,
    compareSymlink: true,
  }
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

  if (!comparisonResult.diffSet) {
    throw new Error("Comparison result is empty");
  }

  // Process each difference
  for (const entry of comparisonResult.diffSet) {
    const { state, name1, name2, relativePath, type1, type2 } = entry;

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
        log(`Removed: ${relativeFilePath}`);
        break;
      case "right": // Present only in Folder B (Added)
        await fs.ensureDir(path.dirname(targetPath));
        if (await isSymlink(sourcePathB)) {
          const symlinkTarget = await fs.readlink(sourcePathB);
          await fs.symlink(symlinkTarget, targetPath);
          log(`Added symlink: ${relativeFilePath} -> ${symlinkTarget}`);
        } else if (type2 === "directory") {
          await fs.copy(sourcePathB, targetPath, { dereference: false }); // Preserve symlinks within
          log(`Added directory: ${relativeFilePath}`);
        } else if (type2 === "file") {
          await fs.copy(sourcePathB, targetPath, { dereference: false }); // Copy file as is
          log(`Added file: ${relativeFilePath}`);
        }
        break;
      case "distinct": // Present in both but different (Modified)
        await fs.ensureDir(path.dirname(targetPath));
        if (await isSymlink(sourcePathB)) {
          const symlinkTarget = await fs.readlink(sourcePathB);
          await fs.symlink(symlinkTarget, targetPath);
          log(`Modified symlink: ${relativeFilePath} -> ${symlinkTarget}`);
        } else if (type2 === "directory") {
          await fs.copy(sourcePathB, targetPath, { dereference: false }); // Preserve symlinks within
          log(`Modified directory: ${relativeFilePath}`);
        } else if (type2 === "file") {
          await fs.copy(sourcePathB, targetPath, { dereference: false }); // Copy file as is
          log(`Modified file: ${relativeFilePath}`);
        }
        break;
      // 'equal' state requires no action
      default:
        break;
    }
  }

  // Save removed items metadata
  if (removedItems.length > 0) {
    const metadataPath = path.join(diffFolder, "__folder-diff-metadata.json");
    await fs.writeJson(metadataPath, { removed: removedItems }, { spaces: 2 });
    log(`Metadata about removed items saved to ${metadataPath}`);
  }
}

/**
 * Checks if the given path is a symbolic link.
 * @param filePath - Path to the file or directory.
 * @returns A Promise that resolves to true if it's a symlink, false otherwise.
 */
async function isSymlink(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(filePath);
    return stats.isSymbolicLink();
  } catch (error) {
    console.error(`Error checking if path is a symlink: ${filePath}`, error);
    return false;
  }
}
