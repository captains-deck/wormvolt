# ADR 0002: One policy path, explicit events and immutable local outputs

Status: accepted for the initial foundation.

Expose typed in-process services. All worker transfers use those services. Keep
provider adapters outside core and declare connections once in a host registry.
Endpoint volt definitions own authorization, so selecting a connection does not
itself grant access. Sharing and publication are separate from reading and
writing.

Use a deterministic field allowlist on structured Markdown for the first
example. It is testable and requires no model, but selected text still needs
review.

Use explicit events and a sequential executor instead of shipping a watcher or
fake queue. SHA-256 job IDs identify immutable output snapshots. Atomic
hard-link creation and record equality give replay detection without a separate
database transaction. A conflicting replay fails; deleting output removes its
receipt. Provenance and hop limits bound propagation. These choices prioritize
an inspectable example over production durability or distributed coordination.

A future HTTP interface is an adapter over the same services after
authentication, request limits and identity mapping are designed. Strong
isolation is a deployment concern; a helper process alone does not supply it.
