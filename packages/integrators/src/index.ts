import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseConnections,
  parseVolt,
  VoltService,
  type KnowledgeEvent,
  type Principal,
} from "@wormvolt/core";
import { LocalMarkdownConnector } from "@wormvolt/connectors";
import { LocalExecutor } from "@wormvolt/worm-agents";

/** Fixed local publication workflow. Paths and principal come from a trusted host. */
export async function openLocalSummary(root: string, principal: Principal) {
  const readJson = async (file: string): Promise<unknown> =>
    JSON.parse(await readFile(join(root, file), "utf8"));
  const source = parseVolt(await readJson("private/volt.json"));
  const destination = parseVolt(await readJson("public/volt.json"));
  const connections = parseConnections(await readJson("connections.json"));
  const service = new VoltService(
    [
      {
        definition: source,
        store: await LocalMarkdownConnector.open(
          root,
          source.knowledge.location,
        ),
      },
      {
        definition: destination,
        store: await LocalMarkdownConnector.open(
          root,
          destination.knowledge.location,
        ),
      },
    ],
    connections,
  );
  const executor = new LocalExecutor(service, principal);
  return {
    source,
    destination,
    service,
    run: (event: KnowledgeEvent) => executor.handle(event),
  };
}
