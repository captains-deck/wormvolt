import {
  eventSchema,
  type KnowledgeEvent,
  type KnowledgeRecord,
  type OperationResult,
  type Principal,
  type VoltService,
} from "@wormvolt/core";

export interface Job {
  event: KnowledgeEvent;
  connectionId: string;
}
export interface JobOutcome extends OperationResult {
  attempts: number;
}
export interface Worker {
  execute(job: Job): Promise<JobOutcome>;
}
/** Proposed enrichment extension. No LLM implementation is shipped or enabled. */
export interface Enricher {
  enrich(record: Readonly<KnowledgeRecord>): Promise<KnowledgeRecord>;
}
/** Explicit local dispatch only; no watcher, daemon, persisted queue or scheduler. */
export class LocalExecutor implements Worker {
  constructor(
    private readonly service: VoltService,
    private readonly principal: Principal,
    private readonly maxAttempts = 2,
  ) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3)
      throw new Error("maxAttempts must be 1..3");
  }
  async execute(job: Job): Promise<JobOutcome> {
    for (let attempts = 1; ; attempts++) {
      const result = await this.service.transfer(
        this.principal,
        job.event,
        job.connectionId,
      );
      if (!result.retryable || attempts >= this.maxAttempts)
        return { ...result, attempts };
    }
  }
  async handle(input: KnowledgeEvent): Promise<JobOutcome[]> {
    const event = eventSchema.parse(input);
    const results: JobOutcome[] = [];
    for (const connectionId of this.service.routes(event))
      results.push(await this.execute({ event, connectionId }));
    return results;
  }
}
