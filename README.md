````markdown
# Folder Diff Restore

**Folder Diff Restore**: Node.js library for comparing directories, generating diffs, and restoring directories based on those diffs.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Creating a Diff](#creating-a-diff)
  - [Restoring from a Diff](#restoring-from-a-diff)
- [API Reference](#api-reference)
  - [compareDirectories](#comparedirectories)
  - [createDiff](#creatediff)
  - [restoreDiff](#restorediff)
- [Handling Symbolic Links](#handling-symbolic-links)
- [Testing](#testing)

## Features

- **Directory Comparison:** Efficiently compares two directories to identify added, removed, and modified files and directories.
- **Diff Generation:** Creates a diff folder containing only the differences (added and modified items) and records removed items in a metadata file.
- **Restoration:** Applies the diff to restore a directory to match another, handling symlinks accurately.
- **Symlink Support:** Detects and preserves symbolic links during comparison, diff generation, and restoration.
- **TypeScript Support:** Provides type safety and improved developer experience with TypeScript.
- **Comprehensive Testing:** Ensures reliability through unit and integration tests.

## Installation

Install the library via npm:

```bash
npm install folder-diff-library
```
````

## Usage

### Creating a Diff

To compare two directories and generate a diff folder:

```typescript
import path from "path";
import { createDiff, DiffOptions } from "folder-diff-library";

async function createDirectoryDiff() {
  // Define paths
  const folderA = path.resolve(__dirname, "FolderA"); // Original directory
  const folderB = path.resolve(__dirname, "FolderB"); // New directory
  const diffFolder = path.resolve(__dirname, "DiffFolder"); // Destination for diff

  // Define comparison options
  const options: DiffOptions = {
    compareSize: true,
    compareContent: true,
    compareSymlink: true, // Enable symlink comparison
  };

  try {
    await createDiff(folderA, folderB, diffFolder, options);
    console.log("Diff folder created successfully.");
  } catch (error) {
    console.error("Error creating diff:", error);
  }
}

createDirectoryDiff();
```

### Restoring from a Diff

To apply the diff folder and restore the original directory to match the new state:

```typescript
import path from "path";
import { restoreDiff } from "folder-diff-library";

async function restoreDirectory() {
  // Define paths
  const targetFolder = path.resolve(__dirname, "FolderA"); // Directory to restore
  const diffFolder = path.resolve(__dirname, "DiffFolder"); // Source of differences

  try {
    await restoreDiff(targetFolder, diffFolder);
    console.log("Directory restored successfully.");
  } catch (error) {
    console.error("Error restoring directory:", error);
  }
}

restoreDirectory();
```

## API Reference

### compareDirectories

**Description:**  
Compares two directories using `dir-compare` and returns the comparison result.

**Signature:**

```typescript
compareDirectories(
  path1: string,
  path2: string,
  options?: dirCompare.Options
): Promise<dirCompare.Result>
```

**Parameters:**

- `path1` _(string)_: Path to the first directory (e.g., Folder A).
- `path2` _(string)_: Path to the second directory (e.g., Folder B).
- `options` _(dirCompare.Options, optional)_: Configuration options for comparison.

**Returns:**  
A `Promise` that resolves to a `Result` object containing comparison details.

### createDiff

**Description:**  
Generates a diff folder based on the comparison of two directories. The diff folder contains added and modified files/directories from Folder B and a `__folder-diff-metadata.json` metadata file listing removed items from Folder A.

**Signature:**

```typescript
createDiff(
  folderA: string,
  folderB: string,
  diffFolder: string,
  options?: DiffOptions
): Promise<void>
```

**Parameters:**

- `folderA` _(string)_: Path to Folder A (original directory).
- `folderB` _(string)_: Path to Folder B (new directory).
- `diffFolder` _(string)_: Path where the diff folder will be created.
- `options` _(DiffOptions, optional)_: Comparison options, including symlink handling.

**Returns:**  
A `Promise` that resolves when the diff folder has been successfully created.

### restoreDiff

**Description:**  
Applies the diff folder to a target directory, adding and modifying files/directories and removing items as specified in the `__folder-diff-metadata.json` metadata.

**Signature:**

```typescript
restoreDiff(
  targetFolder: string,
  diffFolder: string,
  metadataPath?: string
): Promise<void>
```

**Parameters:**

- `targetFolder` _(string)_: Path to the target directory to restore (e.g., Folder A).
- `diffFolder` _(string)_: Path to the diff folder containing additions and modifications.
- `metadataPath` _(string, optional)_: Path to the `__folder-diff-metadata.json` metadata file within the diff folder. Defaults to `path.join(diffFolder, '__folder-diff-metadata.json')`.

**Returns:**  
A `Promise` that resolves when the restoration process is complete.

## Handling Symbolic Links

Symbolic links (symlinks) are special types of files that point to other files or directories. Proper handling of symlinks is crucial to maintain the integrity of directory structures.

### Symlink Comparison

- **Enable Symlink Comparison:**  
  To compare symlinks, set the `compareSymlink` option to `true` in `DiffOptions`.

  ```typescript
  const options: DiffOptions = {
    compareSize: true,
    compareContent: true,
    compareSymlink: true, // Enable symlink comparison
  };
  ```

- **Default Behavior:**  
  By default, `compareSymlink` is set to `true`, ensuring that symlinks are compared based on their targets.

### Symlink Preservation

- **Diff Generation:**  
  When creating a diff, symlinks that are added or modified are recreated in the diff folder as symlinks, preserving their original targets.

- **Restoration:**  
  During restoration, symlinks from the diff folder are accurately recreated in the target directory, pointing to the same targets as in the original setup.

### Important Notes

- **Circular Symlinks:**  
  The library does not specifically handle circular symlinks. It's recommended to avoid creating circular symlinks to prevent potential infinite loops during directory traversal.

- **Permissions:**  
  Ensure that the application has the necessary permissions to read, create, and modify symlinks, especially on operating systems with strict symlink policies.

## Testing

Comprehensive tests ensure that the library functions as expected, including the handling of symlinks.

### Running Tests

The library uses Jest for testing. To run the tests:

1. **Ensure Dependencies are Installed:**

   ```bash
   npm install
   ```

2. **Run Tests:**

   ```bash
   npm run test
   ```

## Examples

### Example 1: Simple Directory Comparison and Diff Creation

```typescript
import path from "path";
import { createDiff } from "folder-diff-library";

async function createSimpleDiff() {
  const folderA = path.resolve(__dirname, "OriginalFolder");
  const folderB = path.resolve(__dirname, "UpdatedFolder");
  const diffFolder = path.resolve(__dirname, "Diff");

  const options: DiffOptions = {
    compareSize: true,
    compareContent: true,
    compareSymlink: true,
  };

  await createDiff(folderA, folderB, diffFolder, options);
  console.log("Diff created successfully.");
}

createSimpleDiff();
```

### Example 2: Restoring a Directory from a Diff

```typescript
import path from "path";
import { restoreDiff } from "folder-diff-library";

async function restoreFromDiff() {
  const targetFolder = path.resolve(__dirname, "OriginalFolder");
  const diffFolder = path.resolve(__dirname, "Diff");

  await restoreDiff(targetFolder, diffFolder);
  console.log("Directory restored successfully.");
}

restoreFromDiff();
```

This project is licensed under the [MIT License](LICENSE).

---

NOTE: This library was created with OpenAI o1-mini and Claude 3.5 Sonnet. You can find some of the original prompts in the `prompts` folder.

---

## Acknowledgements

- [dir-compare](https://github.com/gliviu/dir-compare) - Directory comparison library.
