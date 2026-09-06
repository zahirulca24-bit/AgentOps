export interface StructuredQAContext {
  taskCommand: string;
  targetUrl?: string | null;
  promptOverride?: string;
  analysisContext?: any;
}

export interface AIProvider {
  generateStructuredQA<T>(context: StructuredQAContext, responseSchema: any): Promise<T>;
  isAvailable?(): boolean;
  isDegraded?(): boolean;
}
