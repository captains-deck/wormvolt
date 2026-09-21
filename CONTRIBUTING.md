# Contributing to WormVolt

WormVolt welcomes careful, small changes that make knowledge portable and
boundaries clear. The licence is pending selection; do not assume an open-source
reuse grant or an established contribution-rights policy. The owner must settle
this before broader external contribution and distribution.

Use Node.js 24 and pnpm 11.19.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm format
pnpm check
pnpm build
pnpm example
```

`format` applies Prettier. `lint` checks formatting; `typecheck` uses strict
TypeScript including unused-code checks. `test` builds then runs Node's
behavioural tests against compiled packages. `check` runs lint, typecheck and
tests. The example creates one ignored output file and is safe to repeat without
changing its input. No environment variables, API keys or services are required.
Linux and macOS are the intended local platforms; CI checks Linux with Node 24.

Preserve dependency direction: integrators depend on workers, connectors and
core; workers and connectors depend on core; core never imports them or a
provider SDK. Extend runtime schemas and inferred contracts together. Reject
unsupported options rather than silently ignoring them. Keep connection
configuration canonical in one registry, and route application operations
through core policy.

See the [extension guide](docs/extension-guide.md). Tests should cover
observable behaviour and meaningful failure cases, especially denials, unsafe
paths, replay, propagation and sensitive-field removal. Use synthetic fixtures
and temporary folders. Do not commit generated outputs, secrets, customer
records or private logs. Avoid dependencies or services unless a working
requirement justifies them.

For a proposed change, explain the problem, resulting behaviour, verification
and any change to the threat model. Keep documentation honest about what runs.
Significant policy, format or persistence changes should include a brief
decision record under `docs/decisions`. There is no release automation or
maintainer roster yet.

For possible vulnerabilities, follow [SECURITY.md](SECURITY.md) before sharing
details.
