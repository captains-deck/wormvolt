import { test } from "node:test";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  mkdtemp,
  cp,
  rm,
  readFile,
  writeFile,
  symlink,
  mkdir,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  LocalFilesystemStore,
  parseVolt,
  parseConnections,
  VoltService,
} from "@wormvolt/core";
import { LocalExecutor } from "@wormvolt/worm-agents";

const principal = { id: "test-runner", groups: ["team", "publisher"] };
const event = {
  id: "test-event-1",
  type: "knowledge.changed",
  source: "team-project",
  recordId: "launch-plan",
  trace: { hops: 0, visited: [] },
};
const fixture = new URL("../examples/local-volt-sync/", import.meta.url);
async function setup(t, mutate = () => {}) {
  const root = await mkdtemp(join(tmpdir(), "wormvolt-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixture, root, { recursive: true });
  for (const file of await readdir(join(root, "public/knowledge")))
    if (file !== ".gitkeep") await rm(join(root, "public/knowledge", file));
  const source = JSON.parse(
    await readFile(join(root, "private/volt.json"), "utf8"),
  );
  const destination = JSON.parse(
    await readFile(join(root, "public/volt.json"), "utf8"),
  );
  const registry = JSON.parse(
    await readFile(join(root, "connections.json"), "utf8"),
  );
  mutate(source, destination, registry);
  const sourceStore = await LocalFilesystemStore.open(
    root,
    source.knowledge.location,
  );
  const destinationStore = await LocalFilesystemStore.open(
    root,
    destination.knowledge.location,
  );
  const service = new VoltService(
    [
      { definition: source, store: sourceStore },
      { definition: destination, store: destinationStore },
    ],
    parseConnections(registry),
  );
  return {
    root,
    source,
    destination,
    registry,
    service,
    sourceStore,
    destinationStore,
    executor: new LocalExecutor(service, principal),
  };
}

test("versioned definitions and connection transformations fail closed", async (t) => {
  const { source, registry } = await setup(t);
  for (const mutate of [
    (v) => (v.schemaVersion = 2),
    (v) => delete v.policy.read,
    (v) => (v.policy.read = ["unknown"]),
    (v) => (v.knowledge.location = "../escape"),
    (v) => v.autonomy.actions.push("execute"),
    (v) => v.structure.requiredFields.push("missing"),
    (v) => (v.unknown = true),
  ]) {
    const input = structuredClone(source);
    mutate(input);
    assert.throws(() => parseVolt(input));
  }
  registry.connections[0].transform.kind = "prompt";
  assert.throws(() => parseConnections(registry));
});

test("read policy denies callers without a trusted matching group", async (t) => {
  const { service } = await setup(t);
  await assert.rejects(
    service.read({ id: "outsider", groups: [] }, "team-project", "launch-plan"),
    /DENIED_READ/,
  );
});

for (const [side, action] of [
  ["source", "read"],
  ["source", "transform"],
  ["source", "share"],
  ["destination", "write"],
  ["destination", "publish"],
]) {
  test(`missing ${side} ${action} permission prevents all output`, async (t) => {
    const { executor, destinationStore } = await setup(t, (s, d) => {
      (side === "source" ? s : d).policy[action] = [];
    });
    const [result] = await executor.handle(event);
    assert.equal(result.status, "denied");
    assert.equal(result.attempts, 1);
    assert.equal(result.code, `DENIED_${action.toUpperCase()}`);
    assert.deepEqual(await destinationStore.list(), []);
  });
}

test("manual autonomy denies background jobs", async (t) => {
  const { executor } = await setup(t, (s) => (s.autonomy.mode = "manual"));
  assert.equal((await executor.handle(event))[0].code, "DENIED_AUTONOMY");
});

test("publication strips private fields, records provenance, preserves source and survives executor restart", async (t) => {
  const { root, executor, service, destinationStore } = await setup(t);
  const file = join(root, "private/knowledge/launch-plan.md");
  const before = await readFile(file, "utf8");
  const [result] = await executor.handle(event);
  assert.equal(result.status, "written");
  const record = await destinationStore.read(result.jobId);
  assert.deepEqual(Object.keys(record.fields).sort(), [
    "publicSummary",
    "title",
  ]);
  assert.equal(record.provenance.eventId, event.id);
  assert.equal(record.provenance.hops, 1);
  assert.ok(!JSON.stringify(record).includes("SYNTHETIC_PRIVATE"));
  assert.ok(!JSON.stringify(result).includes("Synthetic garden"));
  assert.equal(await readFile(file, "utf8"), before);
  const restarted = new LocalExecutor(service, principal);
  assert.equal((await restarted.handle(event))[0].status, "duplicate");
  assert.equal((await destinationStore.list()).length, 1);
  assert.deepEqual(
    (await readdir(join(root, "public/knowledge"))).filter((f) =>
      f.endsWith(".tmp"),
    ),
    [],
  );
});

test("reusing an event identity with changed publishable data fails without overwriting", async (t) => {
  const { root, executor, destinationStore } = await setup(t);
  const [first] = await executor.handle(event);
  const before = await destinationStore.read(first.jobId);
  const file = join(root, "private/knowledge/launch-plan.md");
  await writeFile(
    file,
    (await readFile(file, "utf8")).replace(
      "Synthetic garden sensor project",
      "Changed project",
    ),
  );
  assert.equal((await executor.handle(event))[0].code, "IDEMPOTENCY_CONFLICT");
  assert.deepEqual(await destinationStore.read(first.jobId), before);
});

test("agent task-start events use the same policy pipeline", async (t) => {
  const { executor } = await setup(t);
  assert.equal(
    (await executor.handle({ ...event, type: "agent.task.started" }))[0].status,
    "written",
  );
});

test("hop bounds and previously visited destinations stop propagation", async (t) => {
  const { executor, destinationStore } = await setup(t);
  for (const trace of [
    { hops: 2, visited: [] },
    { hops: 1, visited: ["public-summary"] },
  ]) {
    assert.equal(
      (await executor.handle({ ...event, trace }))[0].code,
      "PROPAGATION_LIMIT",
    );
  }
  assert.deepEqual(await destinationStore.list(), []);
});

test("stored provenance cannot be bypassed by resetting event trace", async (t) => {
  const { root, executor } = await setup(t);
  const file = join(root, "private/knowledge/launch-plan.md");
  const record = JSON.parse(
    (await readFile(file, "utf8")).split("```json\n")[1].split("\n```")[0],
  );
  record.provenance = {
    jobId: "a".repeat(64),
    eventId: "prior-event",
    connectionId: "prior-route",
    source: "public-summary",
    sourceRecordId: "previous",
    destination: "team-project",
    transform: "allowlist",
    hops: 1,
    visited: ["public-summary", "team-project"],
  };
  await writeFile(
    file,
    `# WormVolt record\n\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\`\n`,
  );
  assert.equal((await executor.handle(event))[0].code, "PROPAGATION_LIMIT");
});

test("path traversal and file or directory symlink escapes are rejected", async (t) => {
  const { root, sourceStore, destinationStore } = await setup(t);
  for (const path of [
    "../escape",
    "/etc",
    "private/../public",
    "private\\knowledge",
  ])
    await assert.rejects(LocalFilesystemStore.open(root, path));
  await assert.rejects(sourceStore.read("../volt"));
  await symlink(join(root, "public/knowledge"), join(root, "linked"));
  await assert.rejects(
    LocalFilesystemStore.open(root, "linked"),
    /UNSAFE_PATH/,
  );
  await symlink(
    join(root, "private/knowledge/launch-plan.md"),
    join(root, "private/knowledge/escape.md"),
  );
  await assert.rejects(sourceStore.read("escape"));
  await rm(join(root, "public/knowledge"), { recursive: true });
  await mkdir(join(root, "outside"));
  await symlink(join(root, "outside"), join(root, "public/knowledge"));
  await assert.rejects(
    destinationStore.create({ id: "blocked", fields: { title: "safe" } }),
    /UNSAFE_PATH/,
  );
  assert.deepEqual(await readdir(join(root, "outside")), []);
});

test("destination validation rejects unapproved transform fields before any writes", async (t) => {
  await assert.rejects(
    setup(t, (_s, _d, r) =>
      r.connections[0].transform.fields.push("privateNotes"),
    ),
    /INVALID_TRANSFORM_FIELDS/,
  );
});

test("invalid knowledge yields safe metadata-only failure", async (t) => {
  const { root, executor } = await setup(t);
  await writeFile(
    join(root, "private/knowledge/launch-plan.md"),
    "PRIVATE_SECRET $(touch escaped)",
  );
  const [result] = await executor.handle(event);
  assert.equal(result.status, "failed");
  assert.ok(!JSON.stringify(result).includes("PRIVATE_SECRET"));
});

test("transient I/O retries are bounded; permissions never retry", async () => {
  let calls = 0;
  const executor = new LocalExecutor(
    {
      transfer: async () => {
        calls++;
        return {
          jobId: "job",
          status: "failed",
          code: "STORAGE_OR_RECORD_FAILURE",
          retryable: true,
        };
      },
    },
    principal,
    3,
  );
  assert.equal(
    (await executor.execute({ event, connectionId: "publish-summary" }))
      .attempts,
    3,
  );
  assert.equal(calls, 3);
});

test("documented local example runs end-to-end twice", async (t) => {
  const { root } = await setup(t);
  const run = () =>
    promisify(execFile)(
      process.execPath,
      [fileURLToPath(new URL("run.mjs", fixture)), root],
      { cwd: process.cwd() },
    );
  const first = JSON.parse((await run()).stdout);
  const second = JSON.parse((await run()).stdout);
  assert.equal(first.first[0].status, "written");
  assert.equal(second.first[0].status, "duplicate");
  assert.equal(first.sourceUnchanged, true);
});

test("template definitions validate and deny sharing by default", async () => {
  for (const name of ["personal-knowledge", "team-project"]) {
    const definition = parseVolt(
      JSON.parse(
        await readFile(
          new URL(`../templates/${name}/volt.json`, import.meta.url),
          "utf8",
        ),
      ),
    );
    assert.equal(definition.autonomy.mode, "manual");
    assert.deepEqual(definition.policy.share, []);
    assert.deepEqual(definition.connections, []);
  }
});

test("existing output symlinks cannot redirect writes", async (t) => {
  const { root, executor, destinationStore } = await setup(t);
  const [first] = await executor.handle(event);
  const source = join(root, "private/knowledge/launch-plan.md");
  const before = await readFile(source, "utf8");
  const output = join(root, "public/knowledge", `${first.jobId}.md`);
  await rm(output);
  await symlink(source, output);
  assert.equal((await executor.handle(event))[0].status, "failed");
  assert.equal(await readFile(source, "utf8"), before);
  await assert.rejects(
    destinationStore.create({ id: "../escape", fields: {} }),
  );
  assert.deepEqual(
    (await readdir(join(root, "public/knowledge"))).filter((f) =>
      f.endsWith(".tmp"),
    ),
    [],
  );
});

test("unselected records and dangling connections do not execute", async (t) => {
  const { executor } = await setup(t);
  assert.deepEqual(
    await executor.handle({ ...event, recordId: "unselected" }),
    [],
  );
  await assert.rejects(
    setup(t, (s) => s.connections.push("missing-route")),
    /INVALID_CONNECTION_REFERENCE/,
  );
});
