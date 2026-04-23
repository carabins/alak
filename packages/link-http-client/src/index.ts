export interface HttpClientOptions {
  baseUrl: string;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
}

export class AlaqHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AlaqHttpError';
  }
}

export async function callAction<I, O>(
  options: HttpClientOptions,
  actionName: string,
  input: I,
): Promise<O> {
  const url = `${options.baseUrl.replace(/\/$/, '')}/${actionName}`;
  const customHeaders = options.headers ? await options.headers() : {};

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...customHeaders,
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      throw new AlaqHttpError(response.status, 'UNKNOWN', response.statusText);
    }
    throw new AlaqHttpError(
      response.status,
      errorData.code || 'INTERNAL_ERROR',
      errorData.message || errorData.error || response.statusText,
    );
  }

  if (response.status === 202) {
    return undefined as unknown as O;
  }

  return response.json() as Promise<O>;
}
