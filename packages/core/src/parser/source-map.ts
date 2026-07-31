import type { CelloCellSourceLocation, CelloRowSourceLocation, CelloSheetSourceLocation, CelloSourceMap, SheetFormat } from "../shared/types.js";

interface NativeRowSourceOptions {
  cellCount: number;
  defaultColumns: readonly boolean[];
}

export interface CelloSourceLine {
  text: string;
  start: number;
  end: number;
  line: number;
}

export class CelloSourceMapBuilder {
  readonly #sheets: CelloSheetSourceLocation[] = [];

  startSheet(sheetIndex: number, line: CelloSourceLine | undefined, format: SheetFormat): void {
    const location = line ? createDeclaredSheet(line, format) : createUnmappedSheet(format);
    this.#sheets[sheetIndex] = location;
  }

  ensureSheet(sheetIndex: number, format: SheetFormat): CelloSheetSourceLocation {
    const current = this.#sheets[sheetIndex];
    if (current) {
      return current;
    }
    const location = createImplicitSheet(format);
    this.#sheets[sheetIndex] = location;
    return location;
  }

  touchSheet(sheetIndex: number, format: SheetFormat, line: CelloSourceLine | undefined): void {
    const sheet = this.ensureSheet(sheetIndex, format);
    if (line) {
      sheet.sheetSpan.end = Math.max(sheet.sheetSpan.end, line.end);
    }
  }

  markReadonly(sheetIndex: number, format: SheetFormat): void {
    this.ensureSheet(sheetIndex, format).editable = false;
  }

  addExternalSource(sheetIndex: number, format: SheetFormat, line: CelloSourceLine | undefined, path: string): void {
    const sheet = this.ensureSheet(sheetIndex, format);
    sheet.editable = false;
    if (!line) {
      return;
    }
    this.touchSheet(sheetIndex, format, line);
    sheet.externalSources.push({
      path,
      line: line.line,
      lineSpan: { start: line.start, end: line.end }
    });
  }

  addNativeRow(
    sheetIndex: number,
    format: SheetFormat,
    line: CelloSourceLine | undefined,
    sourceKind: CelloRowSourceLocation["sourceKind"],
    options: NativeRowSourceOptions = { cellCount: 0, defaultColumns: [] }
  ): void {
    if (!line) {
      return;
    }
    const sheet = this.ensureSheet(sheetIndex, format);
    this.touchSheet(sheetIndex, format, line);
    const row = createNativeRow(line, sourceKind, options, sheet.defaults);
    if (sourceKind === "defaults") {
      sheet.defaults = row;
    } else {
      sheet.rows.push(row);
    }
  }

  build(sheetCount: number): CelloSourceMap {
    return { sheets: this.#sheets.slice(0, sheetCount) };
  }
}

export function splitCelloSourceLines(source: string): CelloSourceLine[] {
  const lines: CelloSourceLine[] = [];
  let start = 0;
  let line = 1;
  for (let index = 0; index <= source.length; index += 1) {
    if (index !== source.length && source[index] !== "\n") {
      continue;
    }
    const end = index > start && source[index - 1] === "\r" ? index - 1 : index;
    lines.push({ text: source.slice(start, end), start, end, line });
    start = index + 1;
    line += 1;
  }
  return lines;
}

function createDeclaredSheet(line: CelloSourceLine, format: SheetFormat): CelloSheetSourceLocation {
  const marker = line.text.match(/^(\s*)@sheet\s+/);
  const nameStartInLine = marker?.[0].length ?? line.text.length;
  const modifierStart = line.text.indexOf("[", nameStartInLine);
  const nameEndInLine = modifierStart >= 0 ? modifierStart : line.text.length;
  const rawName = line.text.slice(nameStartInLine, nameEndInLine);
  const leadingWhitespace = rawName.match(/^\s*/)?.[0].length ?? 0;
  const trimmedNameLength = rawName.trim().length;
  const nameStart = line.start + nameStartInLine + leadingWhitespace;
  return {
    declaration: {
      line: line.line,
      lineSpan: { start: line.start, end: line.end },
      nameSpan: { start: nameStart, end: nameStart + trimmedNameLength }
    },
    sheetSpan: { start: line.start, end: line.end },
    rows: [],
    externalSources: [],
    editable: true,
    format
  };
}

function createImplicitSheet(format: SheetFormat): CelloSheetSourceLocation {
  return {
    sheetSpan: { start: 0, end: 0 },
    rows: [],
    externalSources: [],
    editable: true,
    format
  };
}

function createUnmappedSheet(format: SheetFormat): CelloSheetSourceLocation {
  return { ...createImplicitSheet(format), editable: false };
}

function createNativeRow(
  line: CelloSourceLine,
  sourceKind: CelloRowSourceLocation["sourceKind"],
  options: NativeRowSourceOptions,
  defaults: CelloRowSourceLocation | undefined
): CelloRowSourceLocation {
  return {
    line: line.line,
    sourceKind,
    lineSpan: { start: line.start, end: line.end },
    cells: getCellLocations(line, options, defaults)
  };
}

function getCellLocations(line: CelloSourceLine, options: NativeRowSourceOptions, defaults: CelloRowSourceLocation | undefined): CelloRowSourceLocation["cells"] {
  const explicitCells = getExplicitCellLocations(line);
  const cellCount = Math.max(explicitCells.length, options.cellCount);
  const insertionPoint = getTrailingPipeOffset(line);
  return Array.from({ length: cellCount }, (_, index) => {
    const explicit = explicitCells[index];
    const hasDefault = options.defaultColumns[index] === true;
    const defaultSpan = hasDefault ? defaults?.cells[index]?.span : undefined;
    if (explicit) {
      const empty = explicit.span.start === explicit.span.end;
      return {
        ...explicit,
        sourceKind: empty ? "explicit-empty" : "explicit-value",
        valueOrigin: empty ? (hasDefault ? "default-derived" : "empty") : "explicit",
        ...(defaultSpan ? { defaultSpan } : {})
      };
    }
    return {
      span: { start: insertionPoint, end: insertionPoint },
      tokenSpan: { start: insertionPoint, end: insertionPoint },
      sourceKind: "omitted",
      valueOrigin: hasDefault ? "default-derived" : "absent",
      ...(defaultSpan ? { defaultSpan } : {})
    };
  });
}

function getExplicitCellLocations(line: CelloSourceLine): Array<Pick<CelloCellSourceLocation, "span" | "tokenSpan">> {
  const firstPipe = line.text.indexOf("|");
  const pipeIndexes: number[] = [];
  for (let index = firstPipe; index >= 0 && index < line.text.length; index += 1) {
    if (line.text[index] === "|") {
      pipeIndexes.push(index);
    }
  }
  const cells: Array<Pick<CelloCellSourceLocation, "span" | "tokenSpan">> = [];
  for (let index = 0; index < pipeIndexes.length - 1; index += 1) {
    const leftPipe = pipeIndexes[index];
    const rightPipe = pipeIndexes[index + 1];
    if (leftPipe === undefined || rightPipe === undefined) {
      continue;
    }
    const rawStart = leftPipe + 1;
    const token = line.text.slice(rawStart, rightPipe);
    const leading = token.match(/^\s*/)?.[0].length ?? 0;
    const trailing = token.match(/\s*$/)?.[0].length ?? 0;
    const start = line.start + rawStart + leading;
    const end = Math.max(start, line.start + rightPipe - trailing);
    cells.push({
      span: { start, end },
      tokenSpan: { start: line.start + rawStart, end: line.start + rightPipe }
    });
  }
  return cells;
}

function getTrailingPipeOffset(line: CelloSourceLine): number {
  const trailingPipe = line.text.lastIndexOf("|");
  return line.start + (trailingPipe >= 0 ? trailingPipe : line.text.length);
}
