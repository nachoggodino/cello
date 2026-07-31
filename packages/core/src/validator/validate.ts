import { evaluate } from "../evaluator/evaluate.js";
import { parse } from "../parser/parse.js";
import type { Diagnostic, EvaluateOptions, ParseOptions } from "../shared/types.js";

export interface ValidateOptions extends ParseOptions, EvaluateOptions {
  structuralOnly?: boolean;
  warningsAsErrors?: boolean;
}

export interface ValidateResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}

/** Parses and optionally evaluates source, returning validity and stable diagnostics. */
export async function validate(text: string, options: ValidateOptions = {}): Promise<ValidateResult> {
  const ast = parse(text, options);
  const evaluated = options.structuralOnly ? ast : await evaluate(ast, options);
  const hasFailure = evaluated.diagnostics.some((diagnostic) => diagnostic.severity === "error" || options.warningsAsErrors === true);
  return {
    valid: !hasFailure,
    diagnostics: evaluated.diagnostics
  };
}
