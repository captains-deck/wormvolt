# Documentation

WormVolt keeps knowledge in folders you can read, and moves a permitted subset
from one volt to another. A **volt** is the folder plus the boundary around it.
A **worm** is the worker that copies along a declared route.

Two places hold the writing:

- This `guides/` folder is the reading order for setting up volts, worms, and
  the rules that decide what may leave a folder.
- [`docs/`](../docs/concepts.md) is the design of the core library: vocabulary,
  architecture, the security model, extension points, the roadmap, and
  decisions.

The desktop panel and CLI live beside this repository in `WormVoltDesktop`.
They share one local registry, crawl on a schedule, and enforce the
[release interface](release-interfaces.md). Copying a record still goes through
core, which checks read, transform, share, and write, then copies the
allowlisted fields whole.

## Read this first

1. [Release interfaces](release-interfaces.md). What may leave a folder, how a
   worm's own rules combine with that gate, where copies land, and how to set
   both in the panel or the CLI.
2. [Transformers](transformers.md). A node that receives a worm's copy, shapes
   it, and writes another folder a later worm can read.
3. [Desktop panel](../../WormVoltDesktop/README.md). Run the panel, switch
   projects, and use the CLI.
4. [Concepts](../docs/concepts.md). Volt, worm connection, worm agent,
   connector, integrator, and sidecar.

The [security model](../docs/security-model.md) still applies. An allowlisted
field is copied whole. A folder rule, a file type, a block phrase, and a brief
are additional gates in the desktop crawl. A brief is saved text. The crawl
does not send it to a model.

## Library design

| Document | Read it for |
| --- | --- |
| [Concepts](../docs/concepts.md) | Shared vocabulary |
| [Architecture](../docs/architecture.md) | Package boundaries, records, and the transfer sequence |
| [Security model](../docs/security-model.md) | What the local prototype enforces, and the limits of a field allowlist |
| [Extension guide](../docs/extension-guide.md) | Where a connector, workflow, or transform belongs |
| [Roadmap](../docs/roadmap.md) | Direction for the library |
| [Contributing](../CONTRIBUTING.md) | Checks, tests, and the local example |
| [Security reporting](../SECURITY.md) | How to report a vulnerability |

## Decisions

Core:

- [ADR 0001: TypeScript workspaces](../docs/decisions/0001-typescript-workspaces.md)
- [ADR 0002: Local policy and events](../docs/decisions/0002-local-policy-and-events.md)
- [ADR 0003: Licensing pending](../docs/decisions/0003-licensing-pending.md)

Desktop panel:

- [ADR 0001: Desktop control panel](../../WormVoltDesktop/docs/decisions/0001-desktop-control-panel.md)
- [ADR 0002: Projects](../../WormVoltDesktop/docs/decisions/0002-projects.md)
- [ADR 0003: Release interfaces](../../WormVoltDesktop/docs/decisions/0003-release-interfaces.md)

The release-interface decision records why the names and the order exist. The
[guide](release-interfaces.md) is the description of the behaviour the panel
enforces.
