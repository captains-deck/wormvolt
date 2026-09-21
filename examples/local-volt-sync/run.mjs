import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { openLocalSummary } from "@wormvolt/integrators";

// This hard-coded principal is a trusted local demonstration identity, not login.
const root = process.argv[2] ?? fileURLToPath(new URL(".", import.meta.url));
const principal = { id: "local-demo", groups: ["team", "publisher"] };
const app = await openLocalSummary(root, principal);
const sourcePath = join(root, "private/knowledge/launch-plan.md");
const before = await readFile(sourcePath, "utf8");
const source = await app.service.read(principal, app.source.id, "launch-plan");
assert.equal(source.id, "launch-plan");
const event = {
  id: "demo-change-001",
  type: "knowledge.changed",
  source: app.source.id,
  recordId: source.id,
  trace: { hops: 0, visited: [] },
};
const first = await app.run(event);
assert.ok(["written", "duplicate"].includes(first[0]?.status));
const replay = await app.run(event);
assert.equal(replay[0]?.status, "duplicate");
const output = await app.service.read(
  { id: "reader", groups: ["public-reader"] },
  app.destination.id,
  first[0].jobId,
);
assert.deepEqual(Object.keys(output.fields).sort(), ["publicSummary", "title"]);
assert.ok(!JSON.stringify(output).includes("SYNTHETIC_PRIVATE"));
assert.equal(await readFile(sourcePath, "utf8"), before);
assert.equal(
  (await readdir(join(root, "public/knowledge"))).filter((f) =>
    f.endsWith(".md"),
  ).length,
  1,
);
console.log(
  JSON.stringify(
    {
      definitions: "valid",
      first,
      replay,
      approvedFields: Object.keys(output.fields),
      sourceUnchanged: true,
    },
    null,
    2,
  ),
);
