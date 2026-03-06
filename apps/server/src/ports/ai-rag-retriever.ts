// This file defines retrieval contracts for RAG context used by AI explain/suggest.

export interface AiRagRetrieveRequest {
  readonly issueMessage: string;
  readonly issueIdentifier?: string;
  readonly filePath?: string;
  readonly line?: number;
  readonly sourceSnippet?: string;
  readonly limit?: number;
}

export interface AiRagContextItem {
  readonly sourcePath: string;
  readonly identifier: string | null;
  readonly content: string;
  readonly score: number;
}

export interface AiRagRetriever {
  retrieve(request: AiRagRetrieveRequest): Promise<AiRagContextItem[]>;
}
