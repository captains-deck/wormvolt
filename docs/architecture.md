# Architecture

## Package boundaries

Dependency direction is `integrators → worm-agents / connectors / core`, with
`worm-agents → core` and `connectors → core`. Core imports neither the other
packages nor provider SDKs. All packages are private workspace packages for now.

Core exports typed in-process application services (`VoltService.read`,
`routes`, `transfer`), parsers, policy evaluation, event and result contracts
and the `KnowledgeStore` port. `LocalFilesystemStore` is a small reference
implementation; `LocalMarkdownConnector` delegates to it and declares adapter
capabilities. Raw stores/connectors are trusted host APIs and do not authorize
user requests. Clients should go through core services. Arbitrary direct user
writes are not yet an application service; they are not exposed by the example.

`LocalExecutor` handles both `knowledge.changed` and `agent.task.started` using
the same transfer service. `openLocalSummary` loads fixed configuration files,
constructs connectors and binds a caller-provided identity. It does not
reimplement policy, transforms or retry logic. The demonstration entry point
prints safe outcomes.

## Contracts and configuration

`packages/core/src/model.ts` is the executable source of truth for version-1
runtime schemas and inferred TypeScript types. Unknown keys, versions, actions,
groups, transformation kinds and invalid field references are rejected. The
service checks registry referential integrity when constructed. Definitions are
parsed into owned copies; editing the input objects afterward does not alter
service configuration.

Each host loads one `connections.json` registry. Each route is declared once
there; source and destination volt definitions reference its ID. Definitions own
access policy, and connections own selection and transformation, so neither
overrides the other. This example uses exact record IDs and a deterministic
field allowlist.

Records are Markdown with a heading and one JSON fence containing `id`, string
`fields` and optional `provenance`. The filename must match `id`. This narrow
format keeps knowledge readable while making field boundaries explicit. No
Markdown, frontmatter or embedded commands are evaluated. Templates name
expected structures; there is no template engine.

The host supplies `Principal`. Policy requires both a permitted action in
autonomy and a matching group for that action. Empty group lists deny. Event
execution also requires event autonomy on both volts. Transfers check source
read, transform and share; destination write; and destination publish for public
audiences. This release supports group-based grants only, not a general
deny/allow policy language.

## Execution and reliability

The sequence is event validation → connection selection → policy gates → read →
record validation → provenance bounds → allowlist projection → destination
structure validation → atomic create → metadata-only outcome. Policy gates run
before I/O; configuration is static for the lifetime of the service. A future
mutable policy store must reauthorize at commit time.

Job IDs are SHA-256 over event type, event ID, source volt, record ID and
connection ID. The output filename uses that ID. Replays compare the complete
projected record with the existing output: equal means duplicate; a different
projection or provenance means `IDEMPOTENCY_CONFLICT`. Event IDs must identify
immutable events. Issue a new ID for a new source revision. Each new event
creates a new snapshot, not an update to a stable document. A crash after write
but before acknowledgment can be retried without another output; the output
itself is the idempotency receipt. There is no independent durable job ledger,
and deleting the output deletes that receipt. Failed/denied/skipped results are
returned to the caller, not persisted.

The local store writes and fsyncs a private temporary file in the destination,
then uses a hard link for atomic create-if-absent and removes the temporary
name. It never overwrites a destination or changes a source. Filesystems must
support local POSIX-style hard links and no-follow opens. Local verification
uses macOS; the supplied CI workflow targets Linux and has not yet run on
GitHub. Power-loss durability and directory fsync are not guaranteed. A process
crash can leave a hidden temporary file for operator cleanup.

The executor retries only `EBUSY`, `EAGAIN`, `EMFILE`, `ENFILE`, immediately, up
to two attempts by default (configurable 1–3). Other errors, invalid records,
policy denials and conflicts do not retry. A durable queue, backoff and
multiworker coordination are future work. The local executor is sequential; do
not treat this as a production concurrent scheduler.

Events carry a bounded hop count and visited volt IDs. The service also reads
stored provenance, takes the greater hop count and unions visited IDs, so a
reset event trace alone cannot bypass prior propagation. Returning to a visited
destination or exceeding a route's maximum stops the job. The executor does not
automatically emit follow-on events. Provenance integrity relies on trusted
local files and callers; cryptographic attestation is not implemented.

## Future interfaces

A CLI can call the existing typed service directly. An HTTP adapter could later
validate requests, authenticate identities, resolve groups from trusted claims,
invoke the same services and map results to responses. It would also need
request limits, authentication lifecycle, transport security and audit storage.
No server or endpoint is needed for this foundation.

`Enricher` is a proposed extension contract only. It is not registered or
executed by core; unknown transforms are rejected. Enabling a provider would
require explicit policy for sending data to that provider, validation of
returned fields and tests for failure and disclosure cases.
