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
