export type IconName = "book" | "check" | "chevron" | "copy" | "download" | "external" | "format" | "reset" | "x";

const paths: Record<IconName, string> = {
  book: "M4 6.5h7a3 3 0 0 1 3 3v9a3 3 0 0 0-3-3H4zM20 6.5h-7a3 3 0 0 0-3 3v9a3 3 0 0 1 3-3h7z",
  check: "M5 13l4 4L19 7",
  chevron: "M7 10l5 5 5-5",
  copy: "M9 9h9v11H9zM6 15H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1",
  download: "M12 4v9m0 0 4-4m-4 4-4-4M5 18h14",
  external: "M14 4h6v6M20 4l-9 9M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5",
  format: "M8 7h8M8 12h6M8 17h10M5 7h.01M5 12h.01M5 17h.01",
  reset: "M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z",
  x: "M6 6l12 12M18 6 6 18"
};

export function ToolbarIcon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function LogoMark() {
  return (
    <svg viewBox="0 0 48 48" focusable="false">
      <path className="logoBody" d="M30.5 5.5c-8.8 2.4-15.2 9.2-15.2 18.6 0 9.1 6.1 15.8 14.9 18.2 1.5.4 2.9-.7 2.9-2.2v-3.4c0-1.1-.7-2-1.8-2.4-4.7-1.5-8-5.1-8-10.2 0-5.2 3.4-8.9 8.2-10.4 1-.3 1.6-1.2 1.6-2.3V7.7c0-1.5-1.2-2.6-2.6-2.2Z" />
      <path className="logoString" d="M26 10.5v27M31.5 13.5v21" />
      <path className="logoF" d="M19.8 18.2c4.6.2 7.8 2.2 9.7 6M19.8 29.8c4.6-.2 7.8-2.2 9.7-6" />
    </svg>
  );
}
