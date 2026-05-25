import { evaluate, parse, render } from "../../src/index.js";
import type { Diagnostic, WorkbookAst } from "../../src/index.js";

export interface PreviewResult {
  html: string;
  diagnostics: Diagnostic[];
  workbook: WorkbookAst;
}

export async function renderPreview(source: string): Promise<PreviewResult> {
  const parsed = parse(source, {
    readExternalSource(path) {
      throw new Error(`External file sources are not available in the browser playground: ${path}`);
    }
  });
  const evaluated = await evaluate(parsed);
  const html = await render(evaluated, {
    evaluate: false,
    interactive: true,
    title: "Cello"
  });

  return {
    html,
    diagnostics: evaluated.diagnostics,
    workbook: evaluated
  };
}
