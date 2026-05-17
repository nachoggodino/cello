export function readFileSync(path: string): never {
  throw new Error(`External file sources are not available in the browser playground: ${path}`);
}
