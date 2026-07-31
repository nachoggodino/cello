import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { injectPreviewFavicon, injectPreviewHostStyles, renderDocumentPreview, renderErrorDocument } from "../src/previewHtml.js";

const tempRoot = join(tmpdir(), `cello-vscode-preview-${process.pid}`);

beforeEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
  mkdirSync(tempRoot, { recursive: true });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("preview html helpers", () => {
  it("injects VS Code host styles before the document head closes", () => {
    const html = injectPreviewHostStyles("<html><head></head><body><table><td>A</td></table></body></html>");

    expect(html).toContain("var(--vscode-editor-background");
    expect(html).toContain(".cello-workbook td:not([class]):not([style])");
    expect(html).toContain(".cello-workbook th:not([class]):not([style])");
    expect(html).toContain(".cello-workbook .cello-tone-ok { color: var(--cello-tone-ok-color) !important;");
    expect(html.indexOf("var(--vscode-editor-background")).toBeLessThan(html.indexOf("</head>"));
  });

  it("keeps tone cells and headers visible after VS Code host styles are injected", async () => {
    const html = await renderDocumentPreview(
      {
        fileName: join(tempRoot, "report.cel"),
        uri: { scheme: "file", fsPath: join(tempRoot, "report.cel") },
        getText: () => "@sheet S\n@header | State[tone:accent] |\n| ok[tone:ok] |"
      },
      [{ uri: { fsPath: tempRoot } }]
    );

    expect(html).toContain('<th class="cello-wrap cello-tone-accent"><span class="cello-cell-content">State</span></th>');
    expect(html).toContain("cello-tone-ok");
  });

  it("injects the preview favicon before the document head closes", () => {
    const html = injectPreviewFavicon("<html><head></head><body></body></html>", "vscode-resource:/media/icon-circle.svg");

    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="vscode-resource:/media/icon-circle.svg" />');
    expect(html.indexOf("icon-circle.svg")).toBeLessThan(html.indexOf("</head>"));
  });

  it("renders a workbook through the published Cello package", async () => {
    const html = await renderDocumentPreview(
      {
        fileName: join(tempRoot, "report.cel"),
        uri: { scheme: "file", fsPath: join(tempRoot, "report.cel") },
        getText: () => "@sheet S\n| Name | Amount |\n| Ada | 10 |"
      },
      [{ uri: { fsPath: tempRoot } }]
    );

    expect(html).toContain("Cello Preview");
    expect(html).toContain("Ada");
  });

  it("renders workspace-relative external sources", async () => {
    mkdirSync(join(tempRoot, "data"), { recursive: true });
    writeFileSync(join(tempRoot, "data", "sales.csv"), "Name,Amount\nAda,10\n", "utf8");

    const html = await renderDocumentPreview(
      {
        fileName: join(tempRoot, "report.cel"),
        uri: { scheme: "file", fsPath: join(tempRoot, "report.cel") },
        getText: () => "@sheet Sales [csv]\n-> ./data/sales.csv"
      },
      [{ uri: { fsPath: tempRoot } }]
    );

    expect(html).toContain("Ada");
    expect(html).toContain("Amount");
  });

  it("escapes preview errors before injecting them into fallback html", () => {
    const html = renderErrorDocument(new Error("<script>alert('x')</script>"));

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });
});
