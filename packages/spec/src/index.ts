// Core APISpec domain entrypoint
// Export types and factories here as the package grows

export interface APISpec {
  name: string
  version: string
  // TODO: add endpoints, models, security schemes, etc.
}

export function createAPISpec(init: Partial<APISpec> = {}): APISpec {
  return {
    name: init.name ?? "",
    version: init.version ?? "0.1.0",
  }
}
