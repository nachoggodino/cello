export function resolve(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}
