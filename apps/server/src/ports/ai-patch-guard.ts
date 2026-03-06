export interface AiPatchGuardInput {
  readonly filePath?: string;
  readonly proposedDiff: string;
}

export interface AiPatchGuardResult {
  readonly accepted: boolean;
  readonly rejectedReason: string | null;
}

export interface AiPatchGuard {
  validate(input: AiPatchGuardInput): Promise<AiPatchGuardResult>;
}
