import { z } from "zod";

export const identifier = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
export type VoltId = z.infer<typeof identifier>;
export const actions = [
  "read",
  "transform",
  "write",
  "share",
  "publish",
] as const;
export type Action = (typeof actions)[number];
const groups = z.array(identifier).max(32);
const field = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]{0,63}$/)
  .refine((v) => !["constructor", "prototype", "__proto__"].includes(v));
const fields = z
  .array(field)
  .min(1)
  .max(32)
  .refine((v) => new Set(v).size === v.length);
const relativePath = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (v) =>
      !v.includes("\\") &&
      v
        .split("/")
        .every(
          (p) =>
            p !== "" &&
            p !== "." &&
            p !== ".." &&
            !p.includes(":") &&
            !/[\x00-\x1f]/.test(p),
        ),
    "Expected a safe relative path",
  );
const policy = z.strictObject({
  read: groups,
  transform: groups,
  write: groups,
  share: groups,
  publish: groups,
});
export const voltSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: identifier,
    name: z.string().min(1),
    purpose: z.string().min(1),
    knowledge: z.strictObject({
      location: relativePath,
      format: z.literal("markdown-json-v1"),
    }),
    structure: z.strictObject({
      template: identifier,
      allowedFields: fields,
      requiredFields: fields,
    }),
    audience: z.enum(["private", "public"]),
    securityGroups: groups,
    policy,
    autonomy: z.strictObject({
      mode: z.enum(["manual", "event"]),
      actions: z.array(z.enum(actions)),
    }),
    connections: z.array(identifier),
  })
  .superRefine((v, ctx) => {
    for (const action of actions) {
      if (v.policy[action].some((g) => !v.securityGroups.includes(g)))
        ctx.addIssue({
          code: "custom",
          message: `Unknown security group in ${action} policy`,
        });
    }
    if (
      v.structure.requiredFields.some(
        (f) => !v.structure.allowedFields.includes(f),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Required fields must be allowed fields",
      });
  });
export type VoltDefinition = z.infer<typeof voltSchema>;
export const connectionSchema = z.strictObject({
  id: identifier,
  source: identifier,
  destination: identifier,
  selection: z.strictObject({ recordIds: z.array(identifier).min(1) }),
  transform: z.strictObject({ kind: z.literal("allowlist"), fields }),
  maxHops: z.number().int().min(1).max(8),
});
export type Connection = z.infer<typeof connectionSchema>;
export const registrySchema = z.strictObject({
  schemaVersion: z.literal(1),
  connections: z.array(connectionSchema),
});
export const eventSchema = z.strictObject({
  id: identifier,
  type: z.enum(["knowledge.changed", "agent.task.started"]),
  source: identifier,
  recordId: identifier,
  trace: z.strictObject({
    hops: z.number().int().min(0).max(8),
    visited: z.array(identifier).max(9),
  }),
});
export type KnowledgeEvent = z.infer<typeof eventSchema>;
export const provenanceSchema = z.strictObject({
  jobId: z.string().regex(/^[a-f0-9]{64}$/),
  eventId: identifier,
  connectionId: identifier,
  source: identifier,
  sourceRecordId: identifier,
  destination: identifier,
  transform: z.literal("allowlist"),
  hops: z.number().int().min(1).max(8),
  visited: z.array(identifier).max(9),
});
export type Provenance = z.infer<typeof provenanceSchema>;
export const recordSchema = z.strictObject({
  id: identifier,
  fields: z.record(field, z.string().max(16000)),
  provenance: provenanceSchema.optional(),
});
export type KnowledgeRecord = z.infer<typeof recordSchema>;
export interface RecordReference {
  voltId: VoltId;
  recordId: string;
}
/** Supplied by the trusted host; group names in a file do not authenticate anyone. */
export interface Principal {
  id: string;
  groups: readonly string[];
}
export type OperationResult = {
  jobId: string;
  status: "written" | "duplicate" | "skipped" | "denied" | "failed";
  code: string;
  retryable: boolean;
};
export interface KnowledgeStore {
  read(id: string): Promise<KnowledgeRecord>;
  list(): Promise<string[]>;
  /** Atomic create-if-absent. Existing records are never overwritten. */
  create(record: KnowledgeRecord): Promise<"written" | "duplicate">;
}
export class BoundaryError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "BoundaryError";
  }
}
export function parseVolt(value: unknown): VoltDefinition {
  return voltSchema.parse(value);
}
export function parseConnections(value: unknown): Connection[] {
  return registrySchema.parse(value).connections;
}
export function permitted(
  volt: VoltDefinition,
  principal: Principal,
  action: Action,
): boolean {
  return (
    volt.autonomy.actions.includes(action) &&
    volt.policy[action].some((g) => principal.groups.includes(g))
  );
}
export function requirePermission(
  volt: VoltDefinition,
  principal: Principal,
  action: Action,
): void {
  if (!permitted(volt, principal, action))
    throw new BoundaryError(`DENIED_${action.toUpperCase()}`);
}
