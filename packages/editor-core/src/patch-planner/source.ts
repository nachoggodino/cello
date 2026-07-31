import type { EditorRowSourceLocation, EditorSourceSpan } from "../model.js";
import type { SourcePatch } from "./types.js";

export function getSourceLineEnding(source: string): "\n" | "\r\n" {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

export function toLineEndings(source: string, lineEnding: string): string {
  return lineEnding === "\n" ? source : source.replaceAll("\n", lineEnding);
}

export function applySourcePatches(source: string, patches: SourcePatch[]): string {
  const sorted = [...patches].sort((left, right) => right.span.start - left.span.start);
  let next = source;
  for (const patch of sorted) {
    next = `${next.slice(0, patch.span.start)}${patch.text}${next.slice(patch.span.end)}`;
  }
  return next;
}

export function expandCellPatchSpan(source: string, sourceRow: EditorRowSourceLocation, span: EditorSourceSpan): EditorSourceSpan {
  const line = source.slice(sourceRow.lineSpan.start, sourceRow.lineSpan.end);
  const spanEndInLine = span.end - sourceRow.lineSpan.start;
  const nextPipe = line.indexOf("|", spanEndInLine);
  if (nextPipe < 0) {
    return span;
  }
  const trailing = line.slice(spanEndInLine, nextPipe);
  if (!/^\s+$/.test(trailing) || trailing.length <= 1) {
    return span;
  }
  return { start: span.start, end: span.end + trailing.length - 1 };
}

export function expandRemovedSheetSpan(source: string, span: EditorSourceSpan): EditorSourceSpan {
  let start = span.start;
  let end = span.end;
  while (start > 0 && source[start - 1] === "\n") {
    start -= 1;
  }
  while (end < source.length && source[end] === "\n") {
    end += 1;
    if (end < source.length && source[end] === "\n") {
      end += 1;
      break;
    }
  }
  return { start, end };
}
