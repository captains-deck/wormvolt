# ADR 0001: TypeScript and pnpm workspaces

Status: accepted for the initial foundation.

The repository was empty when inspected. Use Node.js 24, strict TypeScript and
pnpm 11.19.0 workspaces, with one lockfile and project references. This keeps
contracts shared without a service deployment or separate repository for each
concern. pnpm is pinned and available in the development environment; workspace
dependencies cannot accidentally resolve to external packages.

Zod provides strict runtime validation and matching inferred types. Node
built-ins provide filesystem I/O, hashing, tests and assertions. Prettier checks
formatting; strict compiler checks include unused variables and parameters.
There is no separate ESLint dependency. Packages are private and there is no
release/install-from-registry claim. Tests use Node's built-in runner against
compiled workspace exports.

The trade-off is a build step and a small runtime schema dependency. Separate
services and provider SDKs add no value to the initial offline workflow.
