export interface StructuredQAContext {
  taskCommand: string;
  targetUrl?: string | null;
}

export interface AIProvider {
  generateStructuredQA<T>(context: StructuredQAContext, responseSchema: any): Promise<T>;
}
