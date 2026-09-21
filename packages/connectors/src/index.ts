import {
  LocalFilesystemStore,
  type KnowledgeRecord,
  type KnowledgeStore,
} from "@wormvolt/core";

export interface Connector extends KnowledgeStore {
  readonly capabilities: {
    read: boolean;
    write: boolean;
    list: boolean;
    observe: boolean;
  };
  /** Optional observation must produce events for policy-controlled core services. */
  observe?: (onChange: (recordId: string) => void) => Promise<() => void>;
}
/** Adapters are trusted low-level I/O, not user-facing authorization APIs. */
export class LocalMarkdownConnector implements Connector {
  readonly capabilities = {
    read: true,
    write: true,
    list: true,
    observe: false,
  } as const;
  private constructor(private readonly storage: LocalFilesystemStore) {}
  static async open(
    root: string,
    location: string,
  ): Promise<LocalMarkdownConnector> {
    return new LocalMarkdownConnector(
      await LocalFilesystemStore.open(root, location),
    );
  }
  read(id: string): Promise<KnowledgeRecord> {
    return this.storage.read(id);
  }
  list(): Promise<string[]> {
    return this.storage.list();
  }
  create(record: KnowledgeRecord): Promise<"written" | "duplicate"> {
    return this.storage.create(record);
  }
}
/** Future remote adapters resolve this reference through their host, never volt files. */
export interface SecretReference {
  provider: string;
  key: string;
}
