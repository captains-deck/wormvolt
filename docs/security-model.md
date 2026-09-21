# Security model

## What this prototype enforces

Application services deny missing permissions and unsupported configuration.
Source read, transform and share are distinct from destination write and public
publish. Both volts must permit event autonomy. A connector's I/O capabilities
do not grant these permissions. Synthetic demo groups are supplied explicitly by
the local entry point; group names in JSON are not authentication.

A production host must authenticate a human or workload first, map verified
claims to managed groups and bind that identity to jobs. It must never trust
request-body group names or identity claims embedded in knowledge. The local
example has no login, tenant isolation or authenticated event transport. Anyone
able to run arbitrary code as the same OS user can bypass its application
checks.

The local store validates relative directories and record IDs, rejects `..`,
absolute and backslash paths, checks directory components for symlinks, opens
records with `O_NOFOLLOW`, and accepts regular single-link files up to 1 MiB.
Existing destination files are not overwritten. Source and destination paths are
validated even when calling the raw reference store. A symlink occupying an
output name cannot redirect a write. Knowledge is parsed only as data, with a
strict record schema; embedded shell commands, prompts and markup are never
executed.

Temporary destination files have mode 0600. Atomic create prevents partial
records from appearing at the final filename. No secrets or record payloads are
logged by shipped code. Provenance contains event/connection/volt/record IDs and
traversal metadata only. Those IDs can still disclose relationships: use
non-sensitive opaque IDs if exposing the generated files. The demo names are
synthetic. Returned outcomes omit raw exceptions, paths and content; a host
should also sanitize its own errors.

## Selective sharing is not automatic declassification

The allowlist projects entire approved string fields. It does not inspect or
prove the safety of their contents. Humans must review `title` and
`publicSummary` before using real private data. A secret put in either field
would be copied. Neither regex replacement nor an AI prompt guarantees
sanitization of arbitrary text. Selection, field structure and matching policy
do not substitute for content review.

The source share grant authorizes use of the configured connection. Public
publication additionally requires destination publish permission. All connection
configuration is trusted administrator input. This prototype has no
per-destination source grants beyond administrator-controlled connection
references, field lists and the source share policy.

## Threat-model limits

This is a single trusted local process using administrator-owned configuration
and storage directories. The root and configuration files are trusted,
pre-provisioned inputs. Do not load configuration supplied by an untrusted user.
Root paths are canonicalized; directories beneath the root may not be symlinks.
File permissions, backups and access to the root remain the operator's
responsibility.

The checks defend against static traversal and symlink escapes. They do not
eliminate filesystem races if another process can rename or replace parent
directories between validation and access. Hard-link rejection helps with
existing records but is not a substitute for exclusive ownership of directories.
Concurrent calls can safely avoid overwriting files, but acknowledgment may fail
during another writer's temporary hard-link lifetime. Use the sequential
executor in this slice. Stronger concurrent and hostile-filesystem guarantees
require descriptor-relative operations, isolation and additional testing.
Linux/macOS filesystem assumptions apply; Windows is not a supported runtime for
this prototype.

No OS sandbox, encryption, malware scanner, network egress control, secure
deletion, resource accounting, signed provenance, revocation of previously
shared data or durable audit service is implemented. The parser's file-size
limit is not a complete denial-of-service defense. Trusted code can call
low-level storage directly.

Sidecars are a proposed extension. Merely moving a helper into another process
does not create a boundary. A deployment must specify OS identities, filesystem
mounts, network permissions, credential scope and independent enforcement before
claiming isolation. Treat remote connectors and LLM enrichment as new trust
boundaries.

See [SECURITY.md](../SECURITY.md) for reporting guidance.
