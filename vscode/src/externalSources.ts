import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { Uri } from "vscode";

type WorkspaceFolderLike = {
  readonly uri: Pick<Uri, "fsPath">;
};

export interface ExternalSourceContext {
  readonly documentUri: Pick<Uri, "fsPath" | "scheme">;
  readonly workspaceFolders: readonly WorkspaceFolderLike[] | undefined;
}

export interface ExternalSourceResolver {
  readonly baseDir: string;
  readExternalSource(path: string, context: { baseDir: string; resolvedPath: string }): string;
}

export function createExternalSourceResolver(context: ExternalSourceContext): ExternalSourceResolver {
  const baseDir = getPreviewBaseDir(context);

  return {
    baseDir,
    readExternalSource(_path, readContext) {
      const resolvedPath = resolve(readContext.resolvedPath);
      if (!isPathInside(resolvedPath, baseDir)) {
        throw new Error(`External source is outside the Cello preview root: ${resolvedPath}`);
      }
      return readFileSync(resolvedPath, "utf8");
    }
  };
}

export function getPreviewBaseDir(context: ExternalSourceContext): string {
  if (context.documentUri.scheme === "file") {
    const workspaceFolder = findContainingWorkspaceFolder(context.documentUri.fsPath, context.workspaceFolders);
    if (workspaceFolder) {
      return workspaceFolder.uri.fsPath;
    }
    return dirname(context.documentUri.fsPath);
  }

  const firstWorkspaceFolder = context.workspaceFolders?.[0];
  if (firstWorkspaceFolder) {
    return firstWorkspaceFolder.uri.fsPath;
  }

  throw new Error("Cello preview needs a file-backed document or an open workspace to resolve external sources.");
}

export function isPathInside(candidatePath: string, rootPath: string): boolean {
  const normalizedCandidate = resolve(candidatePath);
  const normalizedRoot = resolve(rootPath);
  const pathToCandidate = relative(normalizedRoot, normalizedCandidate);

  return pathToCandidate === "" || (!pathToCandidate.startsWith("..") && pathToCandidate !== ".." && !isAbsoluteRelative(pathToCandidate));
}

function findContainingWorkspaceFolder(
  documentPath: string,
  workspaceFolders: readonly WorkspaceFolderLike[] | undefined
): WorkspaceFolderLike | undefined {
  return workspaceFolders
    ?.filter((folder) => isPathInside(documentPath, folder.uri.fsPath))
    .sort((left, right) => right.uri.fsPath.length - left.uri.fsPath.length)[0];
}

function isAbsoluteRelative(pathToCandidate: string): boolean {
  return pathToCandidate.startsWith("/") || /^[A-Za-z]:/.test(pathToCandidate);
}
