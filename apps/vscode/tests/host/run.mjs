import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const extensionDevelopmentPath = resolve(currentDirectory, "../..");
const extensionTestsPath = resolve(extensionDevelopmentPath, "dist/test/suite/index.cjs");
const workspacePath = resolve(currentDirectory, "fixtures/workspace");
const version = process.env.CELLO_VSCODE_TEST_VERSION ?? "1.125.0";

try {
  await runTests({
    version,
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspacePath, "--disable-extensions", "--disable-workspace-trust", "--skip-welcome", "--skip-release-notes"]
  });
} catch (error) {
  console.error("VS Code extension-host tests failed.", error);
  process.exitCode = 1;
}
