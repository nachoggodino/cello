# Documentation

Cello documentation has a deliberate hierarchy:

1. [`BYLAWS.md`](../BYLAWS.md) is the canonical rulebook for the `.cel` format.
2. [`SPEC.md`](./SPEC.md) is the readable public specification and implementation guide. It must remain aligned with the bylaws.
3. [`COMPLIANCE.md`](./COMPLIANCE.md) records implementation and test evidence for each bylaw area.
4. [`ARCHITECTURE.md`](./ARCHITECTURE.md) describes package boundaries and data flow; [`PUBLIC_API.md`](./PUBLIC_API.md) defines supported package exports.
5. Focused guides cover the [CLI](./CLI.md), [editor packages](./EDITOR_PACKAGES.md), [error model](./ERROR_MODEL.md), [performance budgets](./PERFORMANCE.md), and [syntax highlighting](./SYNTAX_HIGHLIGHTING.md).

Contributor-only release procedure lives in [`RELEASE.md`](./RELEASE.md) and is intentionally excluded from published artifacts. Historical implementation plans are removed after their durable decisions reach the documents above and automated tests.

The installed `write-cel-code` skill contains a byte-for-byte copy of the canonical bylaws plus a curated authoring reference. `npm run docs:check` detects drift; after intentionally changing the bylaws and reviewing the curated reference, run `npm run docs:sync`.
