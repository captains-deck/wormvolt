# Roadmap

This is a direction, not a release schedule or service commitment.

1. **Harden the local foundation:** review the record format, improve safe
   validation diagnostics, define concurrent writer behaviour, crash cleanup and
   a durable outcome journal. Select a licence before encouraging third-party
   reuse.
2. **Build useful local workflows:** reviewed task-result capture, context
   selection into working volts, explicit CLI operations and an optional change
   observer. Preserve policy parity with direct service calls.
3. **Add real adapters:** Git and document-system connectors only when their
   credentials, capabilities, event and atomicity semantics are designed and
   tested.
4. **Introduce enrichment carefully:** provider-neutral jobs, disclosure policy,
   review gates and validated output. Keep deterministic operations useful
   alone.
5. **Support trusted deployment:** identity integration, authenticated event
   delivery, durable scheduling and audit, optional HTTP transport and
   independently enforced sidecars. Validate the threat model before making
   isolation claims.

Owner decisions include the open-source licence, a private vulnerability
reporting channel, supported platforms beyond this Linux/macOS slice and
priorities for the first real workflow. No partner certification, maintainer
roster or commercial support contract is defined here.
