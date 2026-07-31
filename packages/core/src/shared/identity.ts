import type { AliasDeclaration, Diagnostic, DiagnosticCode, WorkbookAst } from "./types.js";

export interface WorkbookIdentityLocations {
  sheetLines?: Array<number | undefined>;
  aliasLines?: Array<number | undefined>;
}

export interface WorkbookIdentity {
  ambiguous: boolean;
  diagnostics: Diagnostic[];
  sheetsByName: ReadonlyMap<string, WorkbookAst["sheets"][number]>;
  aliasesByNamespace: ReadonlyMap<string, AliasDeclaration>;
}

/** Resolves every workbook identity using the same collision rules. */
export function resolveWorkbookIdentity(workbook: Pick<WorkbookAst, "sheets" | "aliases">, locations: WorkbookIdentityLocations = {}): WorkbookIdentity {
  const diagnostics: Diagnostic[] = [];
  const sheetsByName = new Map<string, WorkbookAst["sheets"][number]>();
  const sheetIndexes = groupIndexes(workbook.sheets.map((sheet) => normalizeIdentity(sheet.name)));

  for (const indexes of sheetIndexes.values()) {
    const first = indexes[0];
    if (first === undefined) continue;
    const sheet = workbook.sheets[first];
    if (!sheet) continue;
    if (indexes.length === 1) {
      sheetsByName.set(sheet.name, sheet);
      continue;
    }
    for (const index of indexes) {
      const conflict = workbook.sheets[index];
      if (!conflict) continue;
      diagnostics.push(
        createIdentityDiagnostic("duplicate-sheet-identity", `Sheet name "${conflict.name}" is declared more than once.`, locations.sheetLines?.[index], conflict.name)
      );
    }
  }

  const aliasesByNamespace = new Map<string, AliasDeclaration>();
  const aliasKeys = workbook.aliases.map((alias) => `${alias.namespace}:${normalizeIdentity(alias.name)}`);
  const aliasIndexes = groupIndexes(aliasKeys);
  for (const [key, indexes] of aliasIndexes) {
    const first = indexes[0];
    if (first === undefined) continue;
    const alias = workbook.aliases[first];
    if (!alias) continue;
    if (indexes.length === 1) {
      aliasesByNamespace.set(key, alias);
      continue;
    }
    for (const index of indexes) {
      const conflict = workbook.aliases[index];
      if (!conflict) continue;
      diagnostics.push(
        createIdentityDiagnostic("duplicate-alias-identity", `@${conflict.namespace} alias "${conflict.name}" is declared more than once.`, locations.aliasLines?.[index])
      );
    }
  }

  return { ambiguous: diagnostics.length > 0, diagnostics, sheetsByName, aliasesByNamespace };
}

function createIdentityDiagnostic(code: DiagnosticCode, message: string, line: number | undefined, sheet?: string): Diagnostic {
  return {
    level: "error",
    severity: "error",
    code,
    stage: "parse",
    category: "identity",
    message,
    ...(sheet === undefined ? {} : { sheet }),
    ...lineField(line)
  };
}

function normalizeIdentity(value: string): string {
  return value.normalize("NFC");
}

function groupIndexes(keys: string[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const [index, key] of keys.entries()) {
    const indexes = groups.get(key) ?? [];
    indexes.push(index);
    groups.set(key, indexes);
  }
  return groups;
}

function lineField(line: number | undefined): { line?: number } {
  return line === undefined ? {} : { line };
}
