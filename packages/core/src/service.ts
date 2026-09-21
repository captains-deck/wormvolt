import { createHash } from "node:crypto";
import {
  BoundaryError,
  parseVolt,
  connectionSchema,
  eventSchema,
  recordSchema,
  requirePermission,
  type Connection,
  type KnowledgeEvent,
  type KnowledgeRecord,
  type KnowledgeStore,
  type OperationResult,
  type Principal,
  type VoltDefinition,
} from "./model.js";

export interface VoltBinding {
  definition: VoltDefinition;
  store: KnowledgeStore;
}
export function jobId(event: KnowledgeEvent, connection: Connection): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        event.type,
        event.id,
        event.source,
        event.recordId,
        connection.id,
      ]),
    )
    .digest("hex");
}
/** All clients, including workers, enter here for policy-controlled operations. */
export class VoltService {
  private readonly volts = new Map<string, VoltBinding>();
  private readonly connections = new Map<string, Connection>();
  constructor(bindings: VoltBinding[], connections: Connection[]) {
    for (const binding of bindings) {
      const definition = parseVolt(binding.definition);
      if (this.volts.has(definition.id))
        throw new BoundaryError("DUPLICATE_VOLT");
      this.volts.set(definition.id, { definition, store: binding.store });
    }
    for (const raw of connections) {
      const c = connectionSchema.parse(raw);
      if (this.connections.has(c.id))
        throw new BoundaryError("DUPLICATE_CONNECTION");
      const source = this.volt(c.source).definition;
      const destination = this.volt(c.destination).definition;
      if (
        c.source === c.destination ||
        !source.connections.includes(c.id) ||
        !destination.connections.includes(c.id)
      )
        throw new BoundaryError("INVALID_CONNECTION_REFERENCE");
      if (
        c.transform.fields.some(
          (f) =>
            !source.structure.allowedFields.includes(f) ||
            !destination.structure.allowedFields.includes(f),
        ) ||
        destination.structure.requiredFields.some(
          (f) => !c.transform.fields.includes(f),
        )
      )
        throw new BoundaryError("INVALID_TRANSFORM_FIELDS");
      this.connections.set(c.id, c);
    }
    for (const { definition } of this.volts.values())
      for (const id of definition.connections) {
        const c = this.connections.get(id);
        if (
          !c ||
          (c.source !== definition.id && c.destination !== definition.id)
        )
          throw new BoundaryError("INVALID_CONNECTION_REFERENCE");
      }
  }
  private volt(id: string): VoltBinding {
    const binding = this.volts.get(id);
    if (!binding) throw new BoundaryError("UNKNOWN_VOLT");
    return binding;
  }
  private validateRecord(
    record: KnowledgeRecord,
    volt: VoltDefinition,
  ): KnowledgeRecord {
    const parsed = recordSchema.parse(record);
    if (
      Object.keys(parsed.fields).some(
        (f) => !volt.structure.allowedFields.includes(f),
      ) ||
      volt.structure.requiredFields.some((f) => !(f in parsed.fields))
    )
      throw new BoundaryError("INVALID_RECORD_STRUCTURE");
    return parsed;
  }
  async read(
    principal: Principal,
    voltId: string,
    recordId: string,
  ): Promise<KnowledgeRecord> {
    const binding = this.volt(voltId);
    requirePermission(binding.definition, principal, "read");
    return this.validateRecord(
      await binding.store.read(recordId),
      binding.definition,
    );
  }
  routes(event: KnowledgeEvent): string[] {
    const parsed = eventSchema.parse(event);
    return [...this.connections.values()]
      .filter(
        (c) =>
          c.source === parsed.source &&
          c.selection.recordIds.includes(parsed.recordId),
      )
      .map((c) => c.id);
  }
  async transfer(
    principal: Principal,
    input: KnowledgeEvent,
    connectionId: string,
  ): Promise<OperationResult> {
    const event = eventSchema.parse(input);
    const c = this.connections.get(connectionId);
    if (!c) throw new BoundaryError("UNKNOWN_CONNECTION");
    const id = jobId(event, c);
    const outcome = (
      status: OperationResult["status"],
      code: string,
      retryable = false,
    ): OperationResult => ({ jobId: id, status, code, retryable });
    try {
      if (
        event.source !== c.source ||
        !c.selection.recordIds.includes(event.recordId)
      )
        return outcome("skipped", "NOT_SELECTED");
      const source = this.volt(c.source),
        destination = this.volt(c.destination);
      if (
        source.definition.autonomy.mode !== "event" ||
        destination.definition.autonomy.mode !== "event"
      )
        throw new BoundaryError("DENIED_AUTONOMY");
      if (
        event.trace.hops >= c.maxHops ||
        event.trace.visited.includes(c.destination)
      )
        return outcome("skipped", "PROPAGATION_LIMIT");
      // Authorize every stage before touching storage; sharing is required even for private destinations.
      requirePermission(source.definition, principal, "read");
      requirePermission(source.definition, principal, "transform");
      requirePermission(source.definition, principal, "share");
      requirePermission(destination.definition, principal, "write");
      if (destination.definition.audience === "public")
        requirePermission(destination.definition, principal, "publish");
      const record = await this.read(principal, c.source, event.recordId);
      const hops = Math.max(event.trace.hops, record.provenance?.hops ?? 0);
      const visited = [
        ...new Set([
          ...event.trace.visited,
          ...(record.provenance?.visited ?? []),
          c.source,
        ]),
      ];
      if (
        hops >= c.maxHops ||
        visited.includes(c.destination) ||
        visited.length >= 9
      )
        return outcome("skipped", "PROPAGATION_LIMIT");
      const output = this.validateRecord(
        {
          id,
          fields: Object.fromEntries(
            c.transform.fields
              .filter((f) => Object.hasOwn(record.fields, f))
              .map((f) => [f, record.fields[f]!]),
          ),
          provenance: {
            jobId: id,
            eventId: event.id,
            connectionId: c.id,
            source: c.source,
            sourceRecordId: record.id,
            destination: c.destination,
            transform: "allowlist",
            hops: hops + 1,
            visited: [...visited, c.destination],
          },
        },
        destination.definition,
      );
      const status = await destination.store.create(output);
      return outcome(
        status,
        status === "written" ? "CREATED" : "ALREADY_APPLIED",
      );
    } catch (error) {
      if (error instanceof BoundaryError)
        return outcome(
          error.code.startsWith("DENIED") ? "denied" : "failed",
          error.code,
        );
      // Never return raw storage errors, file contents, or validation inputs to a log sink.
      const code = (error as NodeJS.ErrnoException).code;
      return outcome(
        "failed",
        "STORAGE_OR_RECORD_FAILURE",
        ["EBUSY", "EAGAIN", "EMFILE", "ENFILE"].includes(code ?? ""),
      );
    }
  }
}
