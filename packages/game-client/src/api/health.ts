export type HealthResponse = {
  ok: boolean;
  version: string;
};

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health");

  if (!response.ok) {
    throw new Error(`Health request failed with ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
