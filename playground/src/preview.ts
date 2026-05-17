import { evaluate, parse, render } from "@cello/core";
import type { Diagnostic, WorkbookAst } from "@cello/core";

export interface PreviewResult {
  html: string;
  diagnostics: Diagnostic[];
  workbook: WorkbookAst;
}

export async function renderPreview(source: string): Promise<PreviewResult> {
  const parsed = parse(source);
  const evaluated = await evaluate(parsed);
  const html = await render(evaluated, {
    evaluate: false,
    title: "Cello Playground Preview"
  });

  return {
    html,
    diagnostics: evaluated.diagnostics,
    workbook: evaluated
  };
}

export async function warmPreviewEngine(): Promise<void> {
  await renderPreview("@sheet Warmup\n-A-B-C-\n| 1 | 2 | =A+B |");
}
