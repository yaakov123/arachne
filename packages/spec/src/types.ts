import { OpenAPIV3 } from "openapi-types"

/** Branded type for API spec IDs */
type ApiSpecId = string & { readonly __brand: "ApiSpecId" };

/** Branded type for endpoint IDs */
type EndpointId = string & { readonly __brand: "EndpointId" };

/** Branded type for source IDs */
type ApiSourceId = string & { readonly __brand: "ApiSourceId" };

/** Branded type for project IDs */
type ProjectId = string & { readonly __brand: "ProjectId" };

/** Branded type for confidence scores (0.0 - 1.0) */
type ConfidenceScore = number & { readonly __brand: "ConfidenceScore" };

/** Branded type for priority values (1-100) */
type Priority = number & { readonly __brand: "Priority" };

/** Semantic version string type */
type SemVer = string & { readonly __brand: "SemVer" };

// ============================================================================
// HTTP METHOD TYPES
// ============================================================================

/** Supported HTTP methods as const assertion */
const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

// ============================================================================
// API SOURCE TYPES
// ============================================================================

/** API source types with discriminated unions */
type ApiSourceType = "openapi" | "postman" | "har" | "proxy" | "manual";

/** Base interface for all API sources */
interface BaseApiSource {
  readonly id: ApiSourceId;
  readonly apiSpecId: ApiSpecId;
  readonly name: string;
  readonly importedAt: Date;
  readonly priority: Priority;
}

/** OpenAPI source with typed spec data */
interface OpenApiSource extends BaseApiSource {
  readonly type: "openapi";
  readonly sourceData: OpenAPIV3.Document;
}

// /** Postman collection source */
// interface PostmanSource extends BaseApiSource {
//   readonly type: "postman";
//   readonly sourceData: PostmanCollection;
// }

// /** HAR file source */
// interface HarSource extends BaseApiSource {
//   readonly type: "har";
//   readonly sourceData: HarFile;
// }

/** Proxy traffic source */
interface ProxySource extends BaseApiSource {
  readonly type: "proxy";
  readonly sourceData: null; // No original data for proxy traffic
}

/** Manual input source */
// interface ManualSource extends BaseApiSource {
//   readonly type: "manual";
//   readonly sourceData: ManualSchemaInput;
// }

/** Union type for all API sources */
type ApiSource = ProxySource | OpenApiSource

// ============================================================================
// JSON SCHEMA TYPES
// ============================================================================

/** Type-safe JSON Schema representation */
interface TypedJSONSchema {
  readonly type?:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "array"
    | "object"
    | "null";
  readonly format?: string;
  readonly properties?: Record<string, TypedJSONSchema>;
  readonly items?: TypedJSONSchema;
  readonly required?: readonly string[];
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly allOf?: readonly TypedJSONSchema[];
  readonly anyOf?: readonly TypedJSONSchema[];
  readonly oneOf?: readonly TypedJSONSchema[];
  readonly not?: TypedJSONSchema;
  readonly title?: string;
  readonly description?: string;
  readonly examples?: readonly unknown[];
}

// ============================================================================
// PARAMETER TYPES
// ============================================================================

/** Path parameter definition */
interface PathParameter {
  readonly name: string;
  readonly type: "string" | "number" | "integer" | "boolean";
  readonly format?: string;
  readonly pattern?: string;
  readonly required: boolean;
  readonly examples: readonly string[];
  readonly schema: TypedJSONSchema;
}

/** Query parameter definition */
interface QueryParameter {
  readonly name: string;
  readonly type: "string" | "number" | "integer" | "boolean" | "array";
  readonly required: boolean;
  readonly allowEmptyValue?: boolean;
  readonly style?: "form" | "spaceDelimited" | "pipeDelimited" | "deepObject";
  readonly explode?: boolean;
  readonly schema: TypedJSONSchema;
}

/** Header parameter definition */
interface HeaderParameter {
  readonly name: string;
  readonly required: boolean;
  readonly schema: TypedJSONSchema;
}

/** Complete parameter set for an endpoint */
interface EndpointParameters {
  readonly path: ReadonlyMap<string, PathParameter>;
  readonly query: ReadonlyMap<string, QueryParameter>;
  readonly header: ReadonlyMap<string, HeaderParameter>;
}

// ============================================================================
// ENDPOINT TYPES
// ============================================================================

/** HTTP status code type */
type HttpStatusCode = number & { readonly __brand: "HttpStatusCode" };

/** Response schema mapping by status code */
type ResponseSchemas = ReadonlyMap<HttpStatusCode, TypedJSONSchema>;

/** Endpoint tags for categorization */
type EndpointTag = string & { readonly __brand: "EndpointTag" };

/** Core endpoint definition */
interface Endpoint {
  readonly id: EndpointId;
  readonly apiSpecId: ApiSpecId;
  readonly path: string;
  readonly normalizedPath: string;
  readonly method: HttpMethod;
  readonly operationId?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly deprecated: boolean;
  readonly tags: readonly EndpointTag[];

  // Schema information
  readonly requestSchema?: TypedJSONSchema;
  readonly responseSchemas: ResponseSchemas;
  readonly parameters: EndpointParameters;

  // Discovery metadata
  readonly discoveredAt: Date;
  readonly lastSeenAt: Date;
  readonly lastEnhanced: Date;
  readonly confidence: ConfidenceScore;
  readonly observationCount: number;
}

// ============================================================================
// ENHANCEMENT TRACKING
// ============================================================================

/** What a source contributed to an endpoint */
interface SourceContribution {
  readonly requestSchema?: TypedJSONSchema;
  readonly responseSchemas?: Partial<Record<HttpStatusCode, TypedJSONSchema>>;
  readonly parameters?: Partial<EndpointParameters>;
  readonly metadata?: {
    readonly summary?: string;
    readonly description?: string;
    readonly operationId?: string;
    readonly tags?: readonly EndpointTag[];
    readonly deprecated?: boolean;
  };
}

/** Enhancement record tracking what each source contributed */
export interface EndpointEnhancement {
  readonly id: string;
  readonly endpointId: EndpointId;
  readonly sourceId: ApiSourceId;
  readonly sourceType: ApiSourceType;
  readonly contribution: SourceContribution;
  readonly enhancedAt: Date;
  readonly confidence: ConfidenceScore;
}

// ============================================================================
// SERVER AND AUTH TYPES
// ============================================================================

/** Server variable definition */
interface ServerVariable {
  readonly enum?: readonly string[];
  readonly default: string;
  readonly description?: string;
}

/** Server definition */
interface Server {
  readonly id: string;
  readonly apiSpecId: ApiSpecId;
  readonly url: string;
  readonly description?: string;
  readonly variables: ReadonlyMap<string, ServerVariable>;
}

/** Authentication scheme types */
export type AuthSchemeType = "apiKey" | "http" | "oauth2" | "openIdConnect";

/** Base auth scheme */
interface BaseAuthScheme {
  readonly id: string;
  readonly apiSpecId: ApiSpecId;
  readonly name: string;
}

/** API Key authentication */
interface ApiKeyAuth extends BaseAuthScheme {
  readonly type: "apiKey";
  readonly config: {
    readonly name: string;
    readonly in: "query" | "header" | "cookie";
  };
}

/** HTTP authentication */
interface HttpAuth extends BaseAuthScheme {
  readonly type: "http";
  readonly config: {
    readonly scheme: "basic" | "bearer" | "digest";
    readonly bearerFormat?: string;
  };
}

/** OAuth2 authentication */
interface OAuth2Auth extends BaseAuthScheme {
  readonly type: "oauth2";
  readonly config: {
    readonly flows: Record<string, unknown>; // OpenAPI OAuth2 flows
  };
}

/** OpenID Connect authentication */
interface OpenIdConnectAuth extends BaseAuthScheme {
  readonly type: "openIdConnect";
  readonly config: {
    readonly openIdConnectUrl: string;
  };
}

/** Union type for all auth schemes */
type AuthScheme = ApiKeyAuth | HttpAuth | OAuth2Auth | OpenIdConnectAuth;




// ============================================================================
// MAIN API SPEC TYPE
// ============================================================================

/** Complete API specification */
export interface ApiSpec {
  readonly id: ApiSpecId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly description?: string;
  readonly version?: SemVer;
  readonly baseUrl?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // Related entities (loaded separately for performance)
  readonly endpoints?: readonly Endpoint[];
  readonly servers?: readonly Server[];
  readonly auth?: readonly AuthScheme[];
  readonly sources?: readonly ApiSource[];
}