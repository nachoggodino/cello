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
        configuration: "./syntaxes/cel.language-configuration.json",
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
        path: "./syntaxes/cel.tmLanguage.json"
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

  it("keeps packaged syntax assets synced with the root grammar assets", () => {
    const packagedGrammar = readFileSync(join(extensionRoot, "syntaxes/cel.tmLanguage.json"), "utf8");
    const rootGrammar = readFileSync(join(extensionRoot, "../syntaxes/cel.tmLanguage.json"), "utf8");
    const packagedConfiguration = readFileSync(join(extensionRoot, "syntaxes/cel.language-configuration.json"), "utf8");
    const rootConfiguration = readFileSync(join(extensionRoot, "../syntaxes/cel.language-configuration.json"), "utf8");

    expect(packagedGrammar).toBe(rootGrammar);
    expect(packagedConfiguration).toBe(rootConfiguration);
  });
});
