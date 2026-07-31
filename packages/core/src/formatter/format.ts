import { formatSource } from "./source-layout.js";

/** Pretty-prints recognized native Cello table blocks. */
export function format(text: string): string {
  return formatSource(text, { layout: "pretty" });
}
