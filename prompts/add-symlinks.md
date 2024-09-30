Below are the **incremental changes** to incorporate symlink handling effectively. We'll focus on updates to the following modules:

1. **`compareDirectories.ts`**
2. **`createDiff.ts`**
3. **`restoreDiff.ts`**

Additionally, we'll update the **`DiffOptions` interface** to allow optional symlink handling configurations.

---

## 1. Update `DiffOptions` Interface

First, we'll extend the `DiffOptions` interface to include options related to symlink comparison and handling.

**File:** `src/createDiff.ts`

**Add the following to the `DiffOptions` interface:**

```typescript
// src/createDiff.ts

export interface DiffOptions {
  compareSize?: boolean;
  compareContent?: boolean;
  compareSymlink?: boolean; // Add this line
  // Add more options from dir-compare as needed
}
```

This addition allows users of the library to specify whether they want to compare symlinks during the directory comparison.

---

## 2. Update `compareDirectories.ts` to Handle Symlinks

We'll modify the comparison options to include symlink comparison based on the `DiffOptions` provided.

**File:** `src/compareDirectories.ts`

**Changes:**

```typescript
// src/compareDirectories.ts

import { compare, Options, Result } from "dir-compare";

/**
 * Compares two directories using dir-compare.
 * @param path1 - Path to the first directory (Folder A).
 * @param path2 - Path to the second directory (Folder B).
 * @param options - Comparison options.
 * @returns A Promise that resolves to the comparison result.
 */
export async function compareDirectories(
  path1: string,
  path2: string,
  options: Options = {
    compareSize: true,
    compareContent: true,
    compareSymlink: true,
  } // Updated default options
): Promise<Result> {
  try {
    const res = await compare(path1, path2, options);
    return res;
  } catch (error) {
    throw new Error(`Error comparing directories: ${error}`);
  }
}
```

**Explanation:**

- **Default Option Update:** Added `compareSymlink: true` to the default `Options`. This ensures that, unless specified otherwise, symlinks are compared based on their target paths.

- **Flexibility:** Users can override this default by providing their own `compareSymlink` value in the `DiffOptions`.

---

## 3. Enhance `createDiff.ts` to Handle Symlinks

When generating the diff folder, we need to ensure that symlinks are copied as symlinks rather than copying the files they point to. We'll achieve this by checking if the source item is a symlink and replicating it accordingly.

**File:** `src/createDiff.ts`

**Changes:**

```typescript
// src/createDiff.ts

import * as fs from "fs-extra";
import * as path from "path";
import { Result, Entry } from "dir-compare";
import { compareDirectories } from "./compareDirectories";

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
  } // Updated default options
): Promise<void> {
  // Ensure the diff folder is clean
  await fs.remove(diffFolder);
  await fs.ensureDir(diffFolder);

  // Perform the comparison
  const comparisonResult: Result = await compareDirectories(
    folderA,
    folderB,
    options as Options
  ); // Type assertion

  const removedItems: string[] = [];

  // Process each difference
  for (const entry of comparisonResult.diffSet) {
    const { state, name1, name2, relativePath, type1, type2 } = entry;

    // Determine the relative file path
    const relativeFilePath = relativePath
      ? path.join(relativePath, name1 || name2)
      : name1 || name2;

    const sourcePathA = path.join(folderA, relativeFilePath);
    const sourcePathB = path.join(folderB, relativeFilePath);
    const targetPath = path.join(diffFolder, relativeFilePath);

    switch (state) {
      case "left": // Present only in Folder A (Removed)
        removedItems.push(relativeFilePath);
        break;
      case "right": // Present only in Folder B (Added)
        await fs.ensureDir(path.dirname(targetPath));
        if (type2 === "symbolicLink") {
          const symlinkTarget = await fs.readlink(sourcePathB);
          await fs.symlink(symlinkTarget, targetPath);
          console.log(`Added symlink: ${relativeFilePath} -> ${symlinkTarget}`);
        } else if (type2 === "directory") {
          await fs.copy(sourcePathB, targetPath, { dereference: false }); // Preserve symlinks within
          console.log(`Added directory: ${relativeFilePath}`);
        } else if (type2 === "file") {
          await fs.copy(sourcePathB, targetPath, { dereference: false }); // Copy file as is
          console.log(`Added file: ${relativeFilePath}`);
        }
        break;
      case "distinct": // Present in both but different (Modified)
        await fs.ensureDir(path.dirname(targetPath));
        if (type2 === "symbolicLink") {
          const symlinkTarget = await fs.readlink(sourcePathB);
          await fs.symlink(symlinkTarget, targetPath);
          console.log(
            `Modified symlink: ${relativeFilePath} -> ${symlinkTarget}`
          );
        } else if (type2 === "directory") {
          await fs.copy(sourcePathB, targetPath, { dereference: false }); // Preserve symlinks within
          console.log(`Modified directory: ${relativeFilePath}`);
        } else if (type2 === "file") {
          await fs.copy(sourcePathB, targetPath, { dereference: false }); // Copy file as is
          console.log(`Modified file: ${relativeFilePath}`);
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
    console.log(`Metadata about removed items saved to ${metadataPath}`);
  }
}
```

**Explanation of Changes:**

1. **Type Handling:**

   - Added `type1` and `type2` destructuring from each `entry` in `diffSet`. These indicate the type of the items (`file`, `directory`, `symbolicLink`, etc.).

2. **Symlink Detection and Copying:**

   - **Added Items (`state === 'right'`):**

     - If the added item is a symlink (`type2 === 'symbolicLink'`), read the symlink target using `fs.readlink` and recreate the symlink in the diff folder using `fs.symlink`.
     - For directories and files, use `fs.copy` with `dereference: false` to ensure that symlinks within directories are preserved and not dereferenced (i.e., the link is copied, not the target).

   - **Modified Items (`state === 'distinct'`):**
     - Similarly handle modified symlinks by recreating them in the diff folder.
     - For directories and files, copy them as in the added case.

3. **Logging Enhancements:**

   - Added console logs to indicate the type of changes being processed, including symlinks.

4. **Preserving Symlinks in Directories:**
   - When copying directories, using `{ dereference: false }` ensures that any symlinks within those directories are preserved as symlinks in the diff folder.

**Note:** The `dir-compare` library identifies symbolic links and marks their type appropriately in `type1` and `type2`.

---

## 4. Enhance `restoreDiff.ts` to Handle Symlinks

When restoring from the diff folder, we need to ensure that symlinks are recreated correctly in the target directory.

**File:** `src/restoreDiff.ts`

**Changes:**

```typescript
// src/restoreDiff.ts

import * as fs from "fs-extra";
import * as path from "path";

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
      console.log(`Removed: ${itemPath}`);
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
        await fs.symlink(symlinkTarget, destPath);
        console.log(`Restored symlink: ${relativePath} -> ${symlinkTarget}`);
      } else if (stats.isDirectory()) {
        await fs.ensureDir(destPath);
        await walk(srcPath); // Recurse into subdirectories
      } else if (stats.isFile()) {
        await fs.ensureDir(path.dirname(destPath));
        await fs.copyFile(srcPath, destPath);
        console.log(`Restored file: ${relativePath}`);
      }
      // Handle other types if necessary (e.g., sockets, FIFOs)
    }
  };

  await walk(diffFolder);

  console.log("Restoration complete.");
}
```

**Explanation of Changes:**

1. **Symlink Restoration:**

   - **Detection:** Use `fs.lstat` instead of `fs.stat` to accurately detect symlinks without following them.
   - **Recreation:**
     - If the item is a symlink (`stats.isSymbolicLink()`), read its target using `fs.readlink`.
     - Recreate the symlink in the target directory using `fs.symlink`, pointing to the same target as in the diff folder.
   - **Logging:** Added console logs to indicate when a symlink is restored.

2. **Recursive Walking:**

   - Implemented a `walk` function to traverse the `diffFolder` recursively, ensuring that nested symlinks and directories are handled appropriately.
   - **Directories:** Ensure directories exist before processing their contents.
   - **Files:** Copy files using `fs.copyFile` to maintain file attributes and contents.

3. **Preservation of Symlink Structure:**

   - By handling symlinks explicitly, the restoration process preserves the original symlink structure from the diff folder.

4. **Exclusion of `__folder-diff-metadata.json`:**
   - Ensured that `__folder-diff-metadata.json` is not copied over to the target folder.

**Note:** This approach ensures that symlinks are accurately replicated in the target directory, maintaining the integrity of the original directory structure.

---

## 5. Update `index.ts` to Export the New Functionality

Ensure that the `restoreDiff` function is exported for external usage.

**File:** `src/index.ts`

**Changes:**

```typescript
// src/index.ts

export { compareDirectories } from "./compareDirectories";
export { createDiff, DiffOptions } from "./createDiff";
export { restoreDiff } from "./restoreDiff"; // Ensure this line exists
```

---

## 6. Example Usage with Symlink Handling

Here's an updated example demonstrating how to use the library with symlink handling.

**File:** `example.ts`

```typescript
// example.ts

import path from "path";
import { createDiff, restoreDiff, DiffOptions } from "folder-diff-library";

async function main() {
  // Define paths
  const folderA = path.resolve(__dirname, "FolderA"); // Original folder
  const folderB = path.resolve(__dirname, "FolderB"); // New folder
  const diffFolder = path.resolve(__dirname, "DiffFolder"); // Where the diff will be stored

  // Define comparison options, including symlink handling
  const options: DiffOptions = {
    compareSize: true,
    compareContent: true,
    compareSymlink: true, // Enable symlink comparison
    // Add more options as needed
  };

  // Create Diff
  console.log("Creating diff...");
  await createDiff(folderA, folderB, diffFolder, options);
  console.log("Diff created successfully.");

  // To restore Folder A to match Folder B using the diff
  console.log("Restoring Folder A using the diff...");
  await restoreDiff(folderA, diffFolder);
  console.log("Folder A restored successfully.");
}

main().catch((error) => {
  console.error("Error:", error);
});
```

**Usage Notes:**

- **Creating Symlinks in Test Folders:**

  - To test symlink handling, ensure that `FolderB` contains symlinks. For example, you can create a symlink in `FolderB` pointing to a file or directory.

- **Restoration:**
  - When restoring, symlinks from the diff folder will be recreated in `FolderA`, maintaining the same target paths as in `FolderB`.

---

## 7. Testing Symlink Handling

It's essential to ensure that symlink handling works as expected. Here's an example test case using Jest.

**File:** `tests/createDiffSymlinks.test.ts`

```typescript
// tests/createDiffSymlinks.test.ts

import path from "path";
import fs from "fs-extra";
import { createDiff, restoreDiff, DiffOptions } from "../src/createDiff";

describe("createDiff with Symlinks", () => {
  const folderA = path.resolve(__dirname, "testData", "FolderA");
  const folderB = path.resolve(__dirname, "testData", "FolderB");
  const diffFolder = path.resolve(__dirname, "testData", "DiffFolder");

  beforeAll(async () => {
    // Setup test data
    await fs.remove(folderA);
    await fs.remove(folderB);
    await fs.remove(diffFolder);

    await fs.ensureDir(folderA);
    await fs.ensureDir(folderB);

    // Populate FolderA
    await fs.writeFile(path.join(folderA, "common.txt"), "This is common.");
    await fs.writeFile(
      path.join(folderA, "removed.txt"),
      "This file will be removed."
    );

    // Populate FolderB
    await fs.writeFile(path.join(folderB, "common.txt"), "This is common.");
    await fs.writeFile(path.join(folderB, "added.txt"), "This file was added.");
    await fs.writeFile(
      path.join(folderB, "modified.txt"),
      "This file was modified."
    );

    // Create symlinks in FolderB
    await fs.symlink("common.txt", path.join(folderB, "symlink_to_common.txt"));
    await fs.symlink("added.txt", path.join(folderB, "symlink_to_added.txt"));
  });

  afterAll(async () => {
    // Clean up test data
    await fs.remove(folderA);
    await fs.remove(folderB);
    await fs.remove(diffFolder);
  });

  it("should handle symlinks correctly in diff creation", async () => {
    const options: DiffOptions = {
      compareSize: true,
      compareContent: true,
      compareSymlink: true, // Enable symlink comparison
    };

    await createDiff(folderA, folderB, diffFolder, options);

    // Check added file
    const addedFile = path.join(diffFolder, "added.txt");
    expect(await fs.pathExists(addedFile)).toBe(true);

    // Check added symlink
    const addedSymlink = path.join(diffFolder, "symlink_to_added.txt");
    expect(await fs.pathExists(addedSymlink)).toBe(true);
    const symlinkTarget = await fs.readlink(addedSymlink);
    expect(symlinkTarget).toBe("added.txt");

    // Check modified file
    const modifiedFile = path.join(diffFolder, "modified.txt");
    expect(await fs.pathExists(modifiedFile)).toBe(true);

    // Check removed metadata
    const metadataPath = path.join(diffFolder, "__folder-diff-metadata.json");
    expect(await fs.pathExists(metadataPath)).toBe(true);
    const metadata = await fs.readJson(metadataPath);
    expect(metadata.removed).toContain("removed.txt");
  });

  it("should restore FolderA correctly, including symlinks", async () => {
    // First, create the diff
    const options: DiffOptions = {
      compareSize: true,
      compareContent: true,
      compareSymlink: true,
    };

    await createDiff(folderA, folderB, diffFolder, options);

    // Restore FolderA using the diff
    await restoreDiff(folderA, diffFolder);

    // Check added file
    const addedFile = path.join(folderA, "added.txt");
    expect(await fs.pathExists(addedFile)).toBe(true);
    const addedContent = await fs.readFile(addedFile, "utf-8");
    expect(addedContent).toBe("This file was added.");

    // Check added symlink
    const addedSymlink = path.join(folderA, "symlink_to_added.txt");
    expect(await fs.pathExists(addedSymlink)).toBe(true);
    const symlinkTarget = await fs.readlink(addedSymlink);
    expect(symlinkTarget).toBe("added.txt");

    // Check modified file
    const modifiedFile = path.join(folderA, "modified.txt");
    expect(await fs.pathExists(modifiedFile)).toBe(true);
    const modifiedContent = await fs.readFile(modifiedFile, "utf-8");
    expect(modifiedContent).toBe("This file was modified.");

    // Check removed file
    const removedFile = path.join(folderA, "removed.txt");
    expect(await fs.pathExists(removedFile)).toBe(false);
  });
});
```

**Explanation:**

1. **Setup:**

   - **FolderA:** Contains a common file and a file to be removed.
   - **FolderB:** Contains the same common file, an added file, a modified file, and two symlinks pointing to `common.txt` and `added.txt`.

2. **Test Cases:**

   - **Diff Creation:**

     - Ensures that added files and symlinks are copied to the diff folder.
     - Checks that the `__folder-diff-metadata.json` correctly lists the removed file.

   - **Restoration:**
     - Applies the diff to `FolderA`.
     - Verifies that added files and symlinks are correctly restored.
     - Confirms that the removed file is deleted from `FolderA`.

3. **Assertions:**
   - Use `fs.pathExists` to verify the existence of files and symlinks.
   - Use `fs.readlink` to verify that symlinks point to the correct targets.
   - Use `fs.readFile` to verify the contents of added and modified files.

**Running the Tests:**

Ensure your `jest.config.js` is correctly set up for TypeScript, then execute:

```bash
npm run test
```

This will run the test cases and confirm that symlink handling is functioning as intended.

---

## 8. Additional Enhancements (Optional)

While the above changes handle symlinks effectively, you might consider the following enhancements for improved functionality and robustness:

### **8.1. Handling Circular Symlinks**

Circular symlinks can cause infinite loops during directory traversal. Ensure that your library can detect and handle such scenarios gracefully.

**Implementation Tip:**

- Maintain a set of visited paths during traversal.
- If a symlink points to a directory that has already been visited, skip or handle it accordingly.

### **8.2. Configurable Symlink Handling**

Allow users to specify how symlinks should be handled—whether to copy them as links, dereference and copy the target, or skip them.

**Update `DiffOptions`:**

```typescript
export interface DiffOptions {
  compareSize?: boolean;
  compareContent?: boolean;
  compareSymlink?: boolean;
  symlinkMode?: "copy" | "dereference" | "skip"; // Add this line
  // Add more options from dir-compare as needed
}
```

**Adjust `createDiff.ts` and `restoreDiff.ts` accordingly based on `symlinkMode`.**

### **8.3. Logging and Verbosity Levels**

Implement configurable logging to provide users with detailed information about the comparison and restoration processes.

**Implementation Tip:**

- Introduce a `verbose` flag in `DiffOptions`.
- Use a logging library like `winston` for advanced logging features.

---

## 9. Conclusion

By incorporating these changes, your TypeScript-based Node.js library now effectively handles symbolic links during directory comparisons and restorations. This ensures that symlink structures are preserved accurately, maintaining the integrity of the original directory layouts.

**Recap of Enhancements:**

- **Comparison Module (`compareDirectories.ts`):**
  - Enabled symlink comparison via `compareSymlink: true`.
- **Diff Generation Module (`createDiff.ts`):**
  - Detects symlinks and recreates them in the diff folder.
  - Preserves symlink targets accurately.
- **Restoration Module (`restoreDiff.ts`):**
  - Recreates symlinks in the target directory based on the diff folder.
- **Testing:**
  - Added comprehensive test cases to ensure symlink handling works as expected.

These enhancements make your library more robust and versatile, catering to scenarios where symlinks play a crucial role in the directory structures being managed.

Feel free to further customize and extend the library based on your specific requirements. If you have any more questions or need additional assistance, don't hesitate to ask!
