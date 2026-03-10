declare module '@huggingface/transformers' {
  export function pipeline(
    task: string,
    model: string,
    options?: Record<string, unknown>
  ): Promise<(input: string, options?: Record<string, unknown>) => Promise<Array<{ label: string; score: number }>>>;

  export const env: {
    localModelPath: string;
    allowRemoteModels: boolean;
  };
}
