export interface ProviderInvocationResult<T = unknown> {
  raw: T;
  usage: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
}

export interface ProviderAdapter<TRequest = Record<string, unknown>, TResponse = unknown> {
  execute(request: TRequest): Promise<ProviderInvocationResult<TResponse>>;
}
