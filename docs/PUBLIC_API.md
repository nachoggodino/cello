# Public API

Cello publishes four ESM JavaScript entry points and one stylesheet. Paths not
listed in the package `exports` map are implementation details and are not
supported deep imports.

## Core

`@nachoggodino/cello` exposes:

- `parse(source, options?)` — parse source into a workbook AST.
- `parseDocument(source, options?)` — parse the AST together with source
  locations and external dependency provenance.
- `evaluate(workbook, options?)` — return an evaluated workbook.
- `validate(source, options?)` — return `{ valid, diagnostics }`.
- `render(source, options?)` — return a document or fragment of HTML.
- `formatSource(source, { layout })` — explicitly select `compact` or
  `pretty` source layout.
- `DIAGNOSTIC_CODES` — the stable registry of machine-readable diagnostic
  identifiers.

The entry point also exports the AST, option, source-map, validation, and
diagnostic TypeScript types used by these functions. It does not export the
legacy `format(text)`, a whole-workbook serializer, renderer layout helpers,
CSS presentation helpers, or parser internals.

## Node adapter

`@nachoggodino/cello/node` exposes
`createNodeExternalSourceOptions(rootDirectory, options?)`. Pass its result to
`parse`, `validate`, or `render` when a Node process intentionally grants
filesystem access:

```ts
import { parse } from "@nachoggodino/cello";
import { createNodeExternalSourceOptions } from "@nachoggodino/cello/node";

const external = createNodeExternalSourceOptions("/srv/workbooks", {
  maxBytes: 1_000_000
});
const workbook = parse(source, external);
```

The adapter resolves real paths and rejects traversal and symlink escapes from
the configured root. Core and editor browser entry points do not import Node
built-ins or read files implicitly.

## Editor core

`@nachoggodino/cello/editor-core` exposes only the supported document/session
boundary:

- `createEditorDocument`
- `executeEditorCommand`
- `createEditorSession`
- `EDITOR_COMMAND_SCHEMA_VERSION`
- `createPersistedEditorCommand`
- `parsePersistedEditorCommand`

Its exported TypeScript types describe documents, sessions, commands, results,
history, ranges, and editor model values. Low-level reducers, source emitters,
selectors used by the bundled React implementation, blank-model builders, and
layout constants are internal.

An `EditorDocumentCommand` is an in-memory discriminated union.
`executeEditorCommand` validates it against the current document and either
returns a verified, reparsed success or a typed failure without changing source.
A `batch` is atomic: children validate against the evolving workbook, but one
failure prevents the entire batch from being committed.

Commands cross persistence or automation boundaries only inside:

```ts
interface PersistedEditorCommand {
  schemaVersion: 1;
  command: EditorDocumentCommand;
}
```

`parsePersistedEditorCommand(unknown)` rejects malformed objects, unknown
discriminators, cycles, extra fields, and unsupported schema versions. No
pre-1.0 migrations exist. Persisted commands are replayable only against a
document state for which their addresses and semantic preconditions remain
valid. Session callers should also pass `expectedRevision`; a stale revision
fails without mutating source or history.

## React editor

`@nachoggodino/cello/editor-react` exposes the intentionally supported views
and hook:

- `CelloSourceEditor`
- `CelloVisualEditor`
- `CelloHtmlPreview`
- `CelloWorkbench`
- `useEditorSession`

Component prop and status types are exported alongside those runtime values.
Styles are opt-in through
`@nachoggodino/cello/editor-react/styles.css`.

## Diagnostics

Every diagnostic has:

- stable `code`;
- canonical `severity` (`warning` or `error`);
- `stage` and `category`;
- human-readable `message`;
- optional `primary` source location, external provenance, structured
  `context`, and related locations.

`level` mirrors `severity` for 1.x compatibility and is deprecated. Message
wording may improve without changing the meaning of a code. Tolerant parsing
returns diagnostics and continues where safe. `strict: true` throws when a
parse or evaluation error prevents the requested result. Validation returns the
same structured diagnostics, and `warningsAsErrors` affects `valid` without
changing diagnostic severity.

The CLI's `parse`, `evaluate`, and `validate` commands emit JSON containing
this contract. Exit code `0` means success; `1` means invalid arguments,
validation failure, formatting changes required by `--check`, or runtime
failure.
