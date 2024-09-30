import * as path from "path";
import * as fs from "fs-extra";
import { createDiff, restoreDiff } from "../src";

const testDir = path.join(__dirname, "test-data");
const folderA = path.join(testDir, "folderA");
const folderB = path.join(testDir, "folderB");
const diffFolder = path.join(testDir, "diff");

describe("Folder Diff and Restore", () => {
  beforeAll(async () => {
    await fs.ensureDir(folderA);
    await fs.ensureDir(folderB);

    // Create test files
    await fs.writeFile(path.join(folderA, "file1.txt"), "Original content");
    await fs.writeFile(path.join(folderA, "file2.txt"), "To be deleted");
    await fs.writeFile(path.join(folderB, "file1.txt"), "Modified content");
    await fs.writeFile(path.join(folderB, "file3.txt"), "New file");
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  it("should create diff and restore correctly", async () => {
    // Create diff
    await createDiff(folderA, folderB, diffFolder);

    // Verify diff
    expect(await fs.pathExists(path.join(diffFolder, "file1.txt"))).toBe(true);
    expect(await fs.pathExists(path.join(diffFolder, "file3.txt"))).toBe(true);
    expect(await fs.pathExists(path.join(diffFolder, "removed.json"))).toBe(
      true
    );

    // Restore diff
    await restoreDiff(folderA, diffFolder);

    // Verify restoration
    expect(await fs.readFile(path.join(folderA, "file1.txt"), "utf8")).toBe(
      "Modified content"
    );
    expect(await fs.pathExists(path.join(folderA, "file2.txt"))).toBe(false);
    expect(await fs.pathExists(path.join(folderA, "file3.txt"))).toBe(true);
  });
});
