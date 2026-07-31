import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { ParseOptions } from "./shared/types.js";

export interface NodeExternalSourceOptions {
  /** Maximum UTF-8 bytes read from one external source. */
  maxBytes?: number;
}

/**
 * Creates a filesystem-backed external-source capability rooted at a directory.
 *
 * Real paths are checked before reads, so traversal and symlink escapes fail closed.
 * Import this adapter from `@nachoggodino/cello/node`; browser entry points never
 * import Node built-ins.
 */
export function createNodeExternalSourceOptions(rootDirectory: string, options: NodeExternalSourceOptions = {}): Pick<ParseOptions, "baseDir" | "readExternalSource"> {
  const baseDir = realpathSync(resolve(rootDirectory));
  return {
    baseDir,
    readExternalSource(_path, context) {
      const candidate = realpathSync(resolve(context.resolvedPath));
      const pathToCandidate = relative(baseDir, candidate);
      const outsideRoot = pathToCandidate === ".." || pathToCandidate.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(pathToCandidate);
      if (outsideRoot) {
        throw new Error(`External source is outside the configured root: ${candidate}`);
      }
      const source = readFileSync(candidate, "utf8");
      if (options.maxBytes !== undefined && Buffer.byteLength(source, "utf8") > options.maxBytes) {
        throw new Error(`External source exceeds the configured ${options.maxBytes}-byte limit: ${candidate}`);
      }
      return source;
    }
  };
}
