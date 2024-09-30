Understood! We'll create a TypeScript-based Node.js library that utilizes the `dir-compare` npm package to compare two directories, generate a diff folder containing added and modified files/directories, and record metadata for removed items. Additionally, we'll implement functionality to restore a directory based on the generated diff.

This library will **not** handle zipping/unzipping or provide a CLI interface. Instead, it will offer a straightforward API that can be integrated into other projects or used as a standalone module.

---

## **Table of Contents**

1. [Project Structure](#1-project-structure)
2. [Library Structure](#2-library-structure)
3. [Implementation](#3-implementation)
   - [Types and Interfaces](#types-and-interfaces)
   - [Comparison Module](#comparison-module)
   - [Diff Generation Module](#diff-generation-module)
   - [Restoration Module](#restoration-module)
4. [Building the Library](#4-building-the-library)
5. [Usage Example](#5-usage-example)
6. [Publishing to npm](#6-publishing-to-npm)
7. [Conclusion](#7-conclusion)

---

## 1. Project Structure

Organize your project as follows:

```
folder-diff-library/
├── src/
│   ├── index.ts
│   ├── compareDirectories.ts
│   ├── createDiff.ts
│   └── restoreDiff.ts
├── tests/
│   └── ... (test files)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 2. Library Structure

We'll implement the following core modules:

1. **`compareDirectories.ts`:** Compares two directories using `dir-compare` and returns the comparison result.
2. **`createDiff.ts`:** Processes the comparison result to generate a diff folder containing added and modified files/directories and records removed items in metadata.
3. **`restoreDiff.ts`:** Applies the diff to a target directory by copying additions/modifications and removing deleted items.
4. **`index.ts`:** Exports the library's functions.

---

## 3. Implementation

### **3.1 Types and Interfaces**

Create a `types.ts` file (optional) or define interfaces within each module as needed. For clarity, we'll define relevant interfaces within each module.

### **3.2 Comparison Module**

**File:** `src/compareDirectories.ts`

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
  options: Options = { compareSize: true, compareContent: true }
): Promise<Result> {
  try {
    const res = await compare(path1, path2, options);
    return res;
  } catch (error) {
    throw new Error(`Error comparing directories: ${error}`);
  }
}
```

### **3.3 Diff Generation Module**

**File:** `src/createDiff.ts`

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
  for (const entry of comparisonResult.diffSet) {
    const { state, name1, name2, relativePath } = entry;

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

  // Save removed items metadata
  if (removedItems.length > 0) {
    const metadataPath = path.join(diffFolder, "__folder-diff-metadata.json");
    await fs.writeJson(metadataPath, { removed: removedItems }, { spaces: 2 });
  }
}
```

### **3.4 Restoration Module**

**File:** `src/restoreDiff.ts`

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
    }
  }

  // Apply Additions and Modifications
  // Exclude '__folder-diff-metadata.json' from being copied
  const filter = (src: string, dest: string): boolean => {
    const relative = path.relative(diffFolder, src);
    if (relative === "__folder-diff-metadata.json") return false;
    return true;
  };

  await fs.copy(diffFolder, targetFolder, { overwrite: true, filter });
}
```

### **3.5 Exporting the Library**

**File:** `src/index.ts`

```typescript
// src/index.ts

export { compareDirectories } from "./compareDirectories";
export { createDiff, DiffOptions } from "./createDiff";
export { restoreDiff } from "./restoreDiff";
```

---

## 4. Building the Library

To compile the TypeScript code into JavaScript, run:

```bash
npx tsc
```

This will generate the `dist` directory containing the compiled JavaScript files and type declarations.

Ensure your `package.json` has the following fields to point to the compiled code:

```json
{
  "name": "folder-diff-library",
  "version": "1.0.0",
  "description": "A TypeScript library to compare two directories, generate diffs, and restore directories based on diffs.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "dir-compare": "^4.0.0", // Use the latest version
    "fs-extra": "^10.0.0"
  },
  "devDependencies": {
    "@types/fs-extra": "^9.0.13",
    "@types/jest": "^29.2.3",
    "@types/node": "^18.11.9",
    "jest": "^29.3.1",
    "ts-jest": "^29.0.3",
    "ts-node": "^10.9.1",
    "typescript": "^4.8.4"
  },
  "keywords": ["folder", "diff", "compare", "typescript", "dir-compare"],
  "author": "Your Name",
  "license": "MIT"
}
```

---

## 5. Usage Example

Here's how to use the library in a TypeScript project.

### **5.1 Installation**

Assuming you've published your library to npm (see [Publishing to npm](#6-publishing-to-npm) below), install it in your project:

```bash
npm install folder-diff-library
```

### **5.2 Example Usage**

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

  // Define comparison options
  const options: DiffOptions = {
    compareSize: true,
    compareContent: true,
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

### **5.3 Running the Example**

Compile the TypeScript code if necessary or run it directly using `ts-node`:

```bash
npx ts-node example.ts
```

This script will:

1. **Create a Diff:**

   - Compare `FolderA` and `FolderB`.
   - Copy added and modified files/directories from `FolderB` to `DiffFolder`.
   - Record removed items in `DiffFolder/__folder-diff-metadata.json`.

2. **Restore Folder A:**
   - Apply the diff by copying additions/modifications from `DiffFolder` to `FolderA`.
   - Remove items listed in `DiffFolder/__folder-diff-metadata.json` from `FolderA`.

---

## 6. Publishing to npm

To make your library available on npm, follow these steps:

### **6.1 Login to npm**

If you haven't already, create an npm account and log in:

```bash
npm login
```

### **6.2 Update `package.json`**

Ensure your `package.json` has all the necessary fields filled out, especially:

- `"name"`: Unique name for your package.
- `"version"`: Start with `1.0.0` and increment as you make changes.
- `"main"`: Points to `dist/index.js`.
- `"types"`: Points to `dist/index.d.ts`.
- `"files"`: Specify which files to include in the npm package.

Example `package.json`:

```json
{
  "name": "folder-diff-library",
  "version": "1.0.0",
  "description": "A TypeScript library to compare two directories, generate diffs, and restore directories based on diffs.",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "keywords": ["folder", "diff", "compare", "typescript", "dir-compare"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "dir-compare": "^4.0.0",
    "fs-extra": "^10.0.0"
  },
  "devDependencies": {
    "@types/fs-extra": "^9.0.13",
    "@types/jest": "^29.2.3",
    "@types/node": "^18.11.9",
    "jest": "^29.3.1",
    "ts-jest": "^29.0.3",
    "ts-node": "^10.9.1",
    "typescript": "^4.8.4"
  }
}
```

### **6.3 Build the Library**

Compile the TypeScript code:

```bash
npm run build
```

### **6.4 Publish to npm**

Publish your package to npm:

```bash
npm publish
```

**Note:** Ensure that the package name is unique on npm. If the name is already taken, consider using a scoped package (e.g., `@your-username/folder-diff-library`).

---

## 7. Complete Project Structure

Your project should look like this:

```
folder-diff-library/
├── dist/
│   ├── compareDirectories.js
│   ├── compareDirectories.d.ts
│   ├── createDiff.js
│   ├── createDiff.d.ts
│   ├── restoreDiff.js
│   ├── restoreDiff.d.ts
│   └── index.js
├── src/
│   ├── compareDirectories.ts
│   ├── createDiff.ts
│   ├── restoreDiff.ts
│   └── index.ts
├── tests/
│   ├── compareDirectories.test.ts
│   ├── createDiff.test.ts
│   └── restoreDiff.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── node_modules/
```

---

## 8. Additional Considerations

### **8.1 Error Handling**

Ensure robust error handling throughout the library to manage scenarios like:

- **Permission Issues:** Handle cases where the application lacks permissions to read/write/delete files.
- **Invalid Paths:** Validate input paths to ensure they exist and are accessible.
- **Concurrent Operations:** Manage potential race conditions when dealing with large directories.

### **8.2 Logging**

For debugging and transparency, consider adding logging. You can use logging libraries like `winston` or `debug` for more advanced logging capabilities.

### **8.3 Testing**

Implement unit and integration tests to ensure the reliability of your library.

**Example Test File:** `tests/createDiff.test.ts`

```typescript
// tests/createDiff.test.ts

import path from "path";
import fs from "fs-extra";
import { createDiff } from "../src/createDiff";

describe("createDiff", () => {
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
  });

  afterAll(async () => {
    // Clean up test data
    await fs.remove(folderA);
    await fs.remove(folderB);
    await fs.remove(diffFolder);
  });

  it("should create a diff folder with added and modified files and record removed files", async () => {
    const options = {
      compareSize: true,
      compareContent: true,
    };

    await createDiff(folderA, folderB, diffFolder, options);

    // Check added file
    const addedFile = path.join(diffFolder, "added.txt");
    expect(await fs.pathExists(addedFile)).toBe(true);
    const addedContent = await fs.readFile(addedFile, "utf-8");
    expect(addedContent).toBe("This file was added.");

    // Check modified file
    const modifiedFile = path.join(diffFolder, "modified.txt");
    expect(await fs.pathExists(modifiedFile)).toBe(true);
    const modifiedContent = await fs.readFile(modifiedFile, "utf-8");
    expect(modifiedContent).toBe("This file was modified.");

    // Check removed metadata
    const metadataPath = path.join(diffFolder, "__folder-diff-metadata.json");
    expect(await fs.pathExists(metadataPath)).toBe(true);
    const metadata = await fs.readJson(metadataPath);
    expect(metadata.removed).toContain("removed.txt");
  });
});
```

**Configure Jest for TypeScript:**

Create a `jest.config.js` file in the project root:

```javascript
// jest.config.js

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
};
```

Run the tests:

```bash
npm run test
```

### **8.4 Extending Functionality**

Depending on your requirements, you can extend the library to include features like:

- **Excluding Specific Files/Directories:** Incorporate glob patterns to exclude/include certain files or directories during comparison.
- **Handling Symbolic Links:** Decide how to handle symlinks (copy as links, resolve, etc.).
- **Custom Comparison Options:** Allow users to customize comparison behaviors (e.g., ignore case, compare dates).

---

## 9. Conclusion

We've successfully implemented a TypeScript-based Node.js library that:

- **Compares Two Directories:** Utilizing the `dir-compare` library to identify differences.
- **Generates a Diff Folder:** Copies added and modified files/directories and records removed items in metadata.
- **Restores Directories Based on Diff:** Applies the diff to restore a directory to match another.

This library is modular, easy to integrate, and can be extended further based on specific needs. By leveraging TypeScript, we ensure type safety and better developer experience.

### **Next Steps**

- **Add Comprehensive Tests:** Ensure all edge cases are handled.
- **Implement Advanced Features:** Such as exclusion filters, logging, and more.
- **Documentation:** Enhance the `README.md` with detailed usage instructions, examples, and API references.
- **Publishing:** Share the library on npm for broader usage.

Feel free to customize and extend this foundation to best suit your project's requirements. If you have any further questions or need assistance with specific parts of the implementation, don't hesitate to ask!
