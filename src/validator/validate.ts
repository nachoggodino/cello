import { evaluate } from "../evaluator/evaluate.js";
import { parse } from "../parser/parse.js";
import type { Diagnostic, EvaluateOptions, ParseOptions } from "../shared/types.js";

export interface ValidateOptions extends ParseOptions, EvaluateOptions {}

export interface ValidateResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}

export async function validate(text: string, options: ValidateOptions = {}): Promise<ValidateResult> {
  const ast = parse(text, options);
  const evaluated = await evaluate(ast, options);
  return {
    valid: evaluated.diagnostics.length === 0,
    diagnostics: evaluated.diagnostics
  };
}
