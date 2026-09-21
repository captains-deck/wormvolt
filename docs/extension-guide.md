# Extension guide

Start by deciding which package owns the change. Add working behaviour and
tests, not a placeholder integration advertised as supported.

## Connectors

Implement `Connector` from `@wormvolt/connectors`, using core's `KnowledgeStore`
record contract. Declare read/write/list/observe support explicitly. The current
store port requires read/list/create; a future read-only connector needs a
narrowed port and service capability checks before binding, not methods that
pretend success. Observation is optional and absent locally. It should emit
bounded, validated events for workers, never perform a policy-free transfer.

Define record identity, size limits, atomicity and create-if-absent semantics
before adding remote I/O. Raw adapters are trusted host components; route user
operations through core services. Resolve credentials in the adapter host
through a `SecretReference`; do not put credential values in volt definitions or
committed files. There is no secret resolver implementation yet. No `.env` file
is needed for the current example.

## Workflows and workers

An integrator selects a use case and assembles services. Follow
`openLocalSummary`: parse trusted definitions, bind adapters, supply a trusted
identity and invoke a worker. Do not copy policy checks into an integrator.
`agent.task.started` already uses the same explicit selection route, but does
not implement semantic retrieval or special context preparation.

Use a stable event ID for a retry; use a new ID for a new revision. Keep
provenance and the trace when moving records onwards. Propagation is bounded,
and the local executor does not recursively dispatch output events. Durable
scheduling, queue ownership and event authentication need separate designs.

## Transformations

Only `allowlist` is supported. To add another transform, first change the strict
core schema, define disclosure rules and add tests for denied transformation,
unsupported configuration, malformed output and leakage. Preserve destination
validation. `Enricher` sketches future model-independent enrichment; no runtime
registration or LLM implementation exists. Sending content to an external
provider requires a policy design for that disclosure before adding the provider
code outside core.

## Template usage

Copy a definition from `templates`, create its configured `knowledge` directory
and edit its purpose and expected fields. Templates start with manual autonomy,
no connections and no share/publish permissions. They are configuration seeds,
not a CLI import/install workflow. Change event autonomy and grants deliberately
when binding a route. Define each connection once in a host registry, then
reference its ID from both endpoint definitions.

## Verification

Run `pnpm check` and `pnpm example`. Add behaviour tests in `tests` that
exercise policy, boundaries and observable results through the service,
including errors. Remote adapters should use deterministic local contract tests
plus separately configured integration tests; do not make normal checks depend
on real credentials.
