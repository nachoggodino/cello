import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const extensionRoot = fileURLToPath(new URL("..", import.meta.url));

describe("extension manifest", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

  it("registers the Cello language, grammar, and editor configuration", () => {
    expect(manifest.contributes.languages).toContainEqual(
      expect.objectContaining({
        id: "cel",
        extensions: [".cel"],
        configuration: "./dist/syntaxes/cel.language-configuration.json",
        icon: {
          light: "./media/cello-file.svg",
          dark: "./media/cello-file.svg"
        }
      })
    );
    expect(manifest.contributes.grammars).toContainEqual(
      expect.objectContaining({
        language: "cel",
        scopeName: "source.cel",
        path: "./dist/syntaxes/cel.tmLanguage.json"
      })
    );
  });

  it("contributes preview commands for editor and side-by-side use", () => {
    expect(manifest.contributes.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "cello.openPreview" }),
        expect.objectContaining({ command: "cello.openPreviewToSide" }),
        expect.objectContaining({ command: "cello.formatDocument" })
      ])
    );
  });

  it("keeps syntax source in the shared language-support package", () => {
    const grammar = readFileSync(join(extensionRoot, "../../packages/language-support/syntaxes/cel.tmLanguage.json"), "utf8");
    const configuration = readFileSync(join(extensionRoot, "../../packages/language-support/syntaxes/cel.language-configuration.json"), "utf8");

    expect(grammar.length).toBeGreaterThan(0);
    expect(configuration.length).toBeGreaterThan(0);
  });
});
