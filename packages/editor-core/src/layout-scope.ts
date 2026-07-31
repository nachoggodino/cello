import { formatSource } from "../../core/src/internal.js";
import type { CelloSourceLayout, CelloSourceSpan } from "../../core/src/internal.js";

export function formatChangedSource(previousSource: string, patchedSource: string, layout: CelloSourceLayout | undefined): string {
  if (!layout || previousSource === patchedSource) {
    return patchedSource;
  }
  try {
    return formatSource(patchedSource, { layout, range: getChangedRange(previousSource, patchedSource) });
  } catch {
    // Layout is best-effort and must never invalidate an otherwise safe command.
    return patchedSource;
  }
}

function getChangedRange(previousSource: string, nextSource: string): CelloSourceSpan {
  let start = 0;
  while (start < previousSource.length && start < nextSource.length && previousSource[start] === nextSource[start]) {
    start += 1;
  }
  let previousEnd = previousSource.length;
  let nextEnd = nextSource.length;
  while (previousEnd > start && nextEnd > start && previousSource[previousEnd - 1] === nextSource[nextEnd - 1]) {
    previousEnd -= 1;
    nextEnd -= 1;
  }
  return { start, end: nextEnd };
}
