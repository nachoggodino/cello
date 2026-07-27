import { watch, type FSWatcher } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { basename, dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { render } from "../../core/src/renderer/render.js";

const LIVE_VERSION_PATH = "/__cello/version";

export interface ServeOptions {
  host?: string;
  port?: number;
  open?: boolean;
  evaluate?: boolean;
}

export interface ServeHandle {
  url: string;
  server: Server;
  watcher: FSWatcher;
  close: () => Promise<void>;
}

export async function startServe(filePath: string, options: ServeOptions = {}): Promise<ServeHandle> {
  const inputPath = resolve(filePath);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4321;
  const servedPath = `/${encodeURIComponent(basename(inputPath))}`;
  const renderer = createCachedRenderer(inputPath, options.evaluate !== false);
  await renderer.refresh();

  const server = createServer((request, response) => {
    void handleRequest(request, response, renderer, servedPath);
  });
  const watcher = watch(inputPath, () => {
    renderer.markDirty();
  });

  try {
    await listen(server, port, host);
    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
    const url = `http://${host}:${boundPort}${servedPath}`;

    if (options.open) {
      openBrowser(url);
    }

    return {
      url,
      server,
      watcher,
      close: async () => {
        watcher.close();
        await closeServer(server);
      }
    };
  } catch (err) {
    if (server.listening) {
      await closeServer(server);
    }
    throw err;
  } finally {
    if (!server.listening) {
      watcher.close();
    }
  }
}

function createCachedRenderer(inputPath: string, evaluateFormulas: boolean): {
  markDirty: () => void;
  refresh: () => Promise<string>;
  version: () => Promise<number>;
} {
  let dirty = true;
  let cached = "";
  let version = 0;
  let lastMtimeMs: number | undefined;

  return {
    markDirty: () => {
      markDirty();
    },
    refresh: async () => {
      await detectFileChange();
      if (!dirty) {
        return cached;
      }
      const text = await readFile(inputPath, "utf8");
      cached = await render(text, {
        baseDir: dirname(inputPath),
        evaluate: evaluateFormulas,
        title: inputPath
      });
      cached = injectLiveReload(cached);
      lastMtimeMs = (await stat(inputPath)).mtimeMs;
      dirty = false;
      return cached;
    },
    version: async () => {
      await detectFileChange();
      return version;
    }
  };

  function markDirty(): void {
    if (!dirty) {
      version += 1;
    }
    dirty = true;
  }

  async function detectFileChange(): Promise<void> {
    const currentMtimeMs = (await stat(inputPath)).mtimeMs;
    if (lastMtimeMs !== undefined && currentMtimeMs !== lastMtimeMs) {
      markDirty();
    }
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  renderer: { refresh: () => Promise<string>; version: () => Promise<number> },
  servedPath: string
): Promise<void> {
  const pathname = getPathname(request.url ?? "/");
  if (request.method !== "GET" || !isKnownRoute(pathname, servedPath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
    return;
  }

  if (pathname === LIVE_VERSION_PATH) {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(`${JSON.stringify({ version: await renderer.version() })}\n`);
    return;
  }

  try {
    const html = await renderer.refresh();
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(html);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(`${message}\n`);
  }
}

function getPathname(url: string): string {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function isKnownRoute(pathname: string, servedPath: string): boolean {
  return pathname === "/" || pathname === servedPath || pathname === LIVE_VERSION_PATH;
}

function injectLiveReload(html: string): string {
  const script = `<script>
    (() => {
      let currentVersion;
      async function checkForCelloChanges() {
        try {
          const response = await fetch("${LIVE_VERSION_PATH}", { cache: "no-store" });
          const data = await response.json();
          if (currentVersion === undefined) {
            currentVersion = data.version;
            return;
          }
          if (data.version !== currentVersion) {
            window.location.reload();
          }
        } catch {
          // Keep the last rendered workbook visible if the dev server is stopped.
        }
      }
      window.setInterval(checkForCelloChanges, 500);
      void checkForCelloChanges();
    })();
  </script>`;
  return html.replace("</body>", `${script}\n</body>`);
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolveListen, rejectListen) => {
    const onError = (err: Error): void => {
      server.off("listening", onListening);
      rejectListen(err);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolveListen();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((err) => {
      if (err) {
        rejectClose(err);
        return;
      }
      resolveClose();
    });
  });
}

function openBrowser(url: string): void {
  const commands = getOpenBrowserCommands(url);
  let index = 0;

  const tryOpen = (): void => {
    const next = commands[index];
    if (!next) {
      return;
    }
    index += 1;
    const child = spawn(next.command, next.args, {
      detached: true,
      stdio: "ignore"
    });
    child.once("error", tryOpen);
    child.once("exit", (code) => {
      if (code && code !== 0) {
        tryOpen();
      }
    });
    child.unref();
  };

  tryOpen();
}

function getOpenBrowserCommands(url: string): Array<{ command: string; args: string[] }> {
  if (process.platform === "win32") {
    return [{ command: "cmd.exe", args: ["/c", "start", "", url] }];
  }
  if (process.platform === "darwin") {
    return [{ command: "open", args: [url] }];
  }
  if (isWsl()) {
    return [
      { command: "cmd.exe", args: ["/c", "start", "", url] },
      { command: "wslview", args: [url] },
      { command: "xdg-open", args: [url] }
    ];
  }
  return [{ command: "xdg-open", args: [url] }];
}

function isWsl(): boolean {
  return Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);
}
