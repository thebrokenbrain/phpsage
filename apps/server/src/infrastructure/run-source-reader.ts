// This file reads source files for a run while enforcing target path boundaries.
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

export class RunSourceReader {
  public async read(targetPath: string, filePath: string): Promise<string | null> {
    const resolvedTargetPath = resolve(targetPath);
    const resolvedFilePath = resolve(filePath);

    const pathRelativeToTarget = relative(resolvedTargetPath, resolvedFilePath);
    if (pathRelativeToTarget.startsWith("..") || isAbsolute(pathRelativeToTarget)) {
      return null;
    }

    try {
      return await readFile(resolvedFilePath, "utf-8");
    } catch {
      return null;
    }
  }

  public async listFiles(targetPath: string): Promise<string[]> {
    const resolvedTargetPath = resolve(targetPath);
    return this.listFilesRecursive(resolvedTargetPath, resolvedTargetPath);
  }

  private async listFilesRecursive(rootPath: string, currentPath: string): Promise<string[]> {
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean; isSymbolicLink: () => boolean }>;

    try {
      entries = await readdir(currentPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const files: string[] = [];
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }

      const nextPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "vendor" || entry.name === "node_modules" || entry.name === ".git") {
          continue;
        }

        files.push(...(await this.listFilesRecursive(rootPath, nextPath)));
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".php")) {
        continue;
      }

      const relativePath = relative(rootPath, nextPath);
      if (!relativePath.startsWith("..") && !isAbsolute(relativePath)) {
        files.push(relativePath.replace(/\\/g, "/"));
      }
    }

    files.sort((left, right) => left.localeCompare(right));
    return files;
  }
}
