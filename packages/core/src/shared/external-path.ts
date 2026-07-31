/**
 * Resolves an external-source path without depending on a host filesystem.
 *
 * The result is lexical and uses forward slashes. Node hosts must still perform
 * real-path containment checks before reading it.
 */
export function resolveExternalSourcePath(baseDir: string, requestedPath: string): string {
  const base = normalizeSeparators(baseDir);
  const requested = normalizeSeparators(requestedPath);
  const candidate = isAbsolutePath(requested) ? requested : `${base.replace(/\/$/, "")}/${requested}`;
  const drive = /^[A-Za-z]:/.exec(candidate)?.[0];
  const absolute = candidate.startsWith("/") || drive !== undefined;
  const body = drive === undefined ? candidate : candidate.slice(drive.length);
  const segments = normalizeSegments(body, absolute);
  const prefix = drive === undefined ? (absolute ? "/" : "") : `${drive}/`;
  const resolved = `${prefix}${segments.join("/")}`;
  return resolved || (absolute ? prefix : ".");
}

function normalizeSegments(path: string, absolute: boolean): string[] {
  const segments: string[] = [];

  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length > 0 && segments.at(-1) !== "..") {
        segments.pop();
      } else if (!absolute) {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }
  return segments;
}

function normalizeSeparators(value: string): string {
  return value.replace(/\\/g, "/");
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:\//.test(value);
}
