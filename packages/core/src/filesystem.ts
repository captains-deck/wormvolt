import { lstat, realpath, open, readdir, link, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, relative, sep, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  BoundaryError,
  identifier,
  recordSchema,
  type KnowledgeRecord,
  type KnowledgeStore,
} from "./model.js";

/** Trusted host provisions directories. No symlinks are permitted below the trusted root. */
export class LocalFilesystemStore implements KnowledgeStore {
  private constructor(
    private readonly root: string,
    private readonly directory: string,
  ) {}
  static async open(
    root: string,
    location: string,
  ): Promise<LocalFilesystemStore> {
    const canonicalRoot = await realpath(root);
    if (
      !location ||
      location.includes("\\") ||
      location
        .split("/")
        .some((p) => !p || p === "." || p === ".." || p.includes(":"))
    )
      throw new BoundaryError("UNSAFE_PATH");
    const store = new LocalFilesystemStore(
      canonicalRoot,
      resolve(canonicalRoot, location),
    );
    await store.checkDirectory();
    return store;
  }
  private async checkDirectory(): Promise<void> {
    const rel = relative(this.root, this.directory);
    if (
      !rel ||
      rel.startsWith(`..${sep}`) ||
      rel === ".." ||
      rel.startsWith(sep)
    )
      throw new BoundaryError("UNSAFE_PATH");
    let current = this.root;
    const rootInfo = await lstat(current);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
      throw new BoundaryError("UNSAFE_PATH");
    for (const segment of rel.split(sep)) {
      current = join(current, segment);
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory())
        throw new BoundaryError("UNSAFE_PATH");
    }
  }
  private path(id: string): string {
    return join(this.directory, `${identifier.parse(id)}.md`);
  }
  async read(id: string): Promise<KnowledgeRecord> {
    const path = this.path(id);
    await this.checkDirectory();
    const handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.nlink !== 1 || info.size > 1024 * 1024)
        throw new BoundaryError("UNSAFE_RECORD");
      const text = await handle.readFile("utf8");
      const match = /^# WormVolt record\n\n```json\n([\s\S]+)\n```\n?$/.exec(
        text,
      );
      if (!match?.[1]) throw new BoundaryError("INVALID_RECORD_FORMAT");
      const record = recordSchema.parse(JSON.parse(match[1]));
      if (record.id !== id) throw new BoundaryError("RECORD_ID_MISMATCH");
      return record;
    } finally {
      await handle.close();
    }
  }
  async list(): Promise<string[]> {
    await this.checkDirectory();
    const entries = await readdir(this.directory, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name.endsWith(".md") &&
          identifier.safeParse(e.name.slice(0, -3)).success,
      )
      .map((e) => e.name.slice(0, -3))
      .sort();
  }
  async create(input: KnowledgeRecord): Promise<"written" | "duplicate"> {
    const record = recordSchema.parse(input);
    const target = this.path(record.id);
    await this.checkDirectory();
    const temporary = join(this.directory, `.wormvolt-${randomUUID()}.tmp`);
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(
        `# WormVolt record\n\n\`\`\`json\n${JSON.stringify(record, null, 2)}\n\`\`\`\n`,
        "utf8",
      );
      await handle.sync();
    } catch (error) {
      await handle.close();
      await unlink(temporary);
      throw error;
    }
    await handle.close();
    try {
      await this.checkDirectory();
      try {
        await link(temporary, target);
        return "written";
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const existing = await this.read(record.id);
        if (JSON.stringify(existing) !== JSON.stringify(record))
          throw new BoundaryError("IDEMPOTENCY_CONFLICT");
        return "duplicate";
      }
    } finally {
      await unlink(temporary);
    }
  }
}
