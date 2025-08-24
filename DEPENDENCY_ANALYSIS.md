# Dependency Analysis System

## Overview

The Arachne dependency analysis system performs **reverse lookup analysis** to automatically detect relationships between HTTP requests and responses. When a new request arrives, the system extracts all interesting values from that request and searches backwards through previous responses to find where those values originated.

This approach captures real data flow patterns in web applications, enabling powerful insights into authentication flows, resource lifecycles, and API dependencies.

## Core Concept: Reverse Lookup

### Traditional Approach (❌ Complex)
- Try to predict what values might be used in future requests
- Pattern match URL structures and guess relationships
- Maintain complex state machines for different API styles

### Our Approach (✅ Simple & Accurate)
- Extract all interesting values from incoming requests
- Search backwards through indexed response data
- Find exact matches where values appeared in previous responses
- Create dependency links with confidence scores

## Architecture Components

### 1. Request Value Extractor (`RequestValueExtractor`)

**Purpose**: Extract all potentially interesting values from incoming HTTP requests.

**Extraction Sources**:
- **Headers**: Authorization tokens, cookies, custom headers
- **Query Parameters**: All URL parameters
- **URL Path Segments**: IDs and identifiers in the path
- **Request Body**: JSON fields, form data, extracted tokens

**Value Classification**:
```typescript
interface ExtractedRequestValue {
    value: string              // The actual value found
    location: 'header' | 'query_param' | 'url_path' | 'body_field'
    field: string             // Where exactly it was found
    confidence: number        // How interesting this value seems
}
```

**Filtering Logic**:
- ✅ Include: Tokens (JWTs, UUIDs), IDs, long strings (>8 chars)
- ❌ Skip: Common HTTP values (`GET`, `POST`, `application/json`)
- ❌ Skip: Standard headers (`user-agent`, `accept`, etc.)

### 2. Response Data Index (`ResponseDataIndex`)

**Purpose**: Efficiently index response data for fast reverse lookups.

**Indexing Strategy**:
```typescript
Map<string, ResponseDataEntry[]>  // value -> [where it appeared]

interface ResponseDataEntry {
    value: string
    sourceTransactionId: string
    location: 'header' | 'body_field'
    field: string                   // exact field name
    timestamp: number               // when this response occurred
}
```

**Data Sources Indexed**:
- **Response Headers**: All header values
- **Set-Cookie Headers**: Individual cookie values parsed out
- **Response Bodies**: 
  - JSON: Deep traversal of all fields
  - Form Data: Key-value pairs
  - Text: Regex extraction of tokens/IDs

**Performance Optimizations**:
- **Time-based cleanup**: Remove entries older than 10 minutes
- **Size limits**: Cap at 10,000 entries maximum
- **Smart filtering**: Only index "interesting" values
- **Memory management**: Automatic cleanup of old transaction data

### 3. Reverse Lookup Dependency Detector (`ReverseLookupDependencyDetector`)

**Purpose**: Main orchestrator that performs the reverse lookup analysis.

**Analysis Flow**:
1. **Extract** all values from incoming request
2. **Search** index for each value to find previous occurrences
3. **Create** dependency objects for each match found
4. **Calculate** confidence scores for each dependency
5. **Classify** dependency types (auth, cookie, data flow, etc.)

**Dependency Types**:
- `auth_token`: Authorization headers, bearer tokens, API keys
- `cookie`: Set-Cookie → Cookie header relationships
- `csrf`: CSRF token flows from forms/responses to requests
- `referrer`: Referrer header relationships
- `data_flow`: General data flowing from response to request

**Confidence Calculation**:
```typescript
Base confidence: 0.5

Adjustments:
+0.3  Field names match (e.g., "token" -> "authorization")
+0.2  Value looks like a token (JWT, UUID, long hex)
+0.2  Auth-related fields involved
+0.4  Exact cookie name match (set-cookie:session -> cookie:session)
-0.3  Very common values (numbers, short strings)
-0.1  Very short values (<8 chars)
+0.1  Very long values (>32 chars, likely unique)

Final range: 0.1 to 1.0
```

## Real-World Examples

### Example 1: Login Flow
```
1. POST /api/login
   Request: {"username": "alice", "password": "secret123"}
   Response: {"token": "eyJhbGc...", "userId": 12345}

2. GET /api/users/12345
   Headers: Authorization: Bearer eyJhbGc...
   
   DETECTED DEPENDENCIES:
   - auth_token: Response field "token" -> Request header "Authorization" (confidence: 0.9)
   - data_flow: Response field "userId" -> Request URL path "12345" (confidence: 0.8)
```

### Example 2: Cookie Session
```
1. POST /login
   Response Headers: Set-Cookie: sessionId=abc123def; HttpOnly

2. GET /dashboard  
   Request Headers: Cookie: sessionId=abc123def
   
   DETECTED DEPENDENCY:
   - cookie: Response header "set-cookie:sessionId" -> Request header "cookie:sessionId" (confidence: 1.0)
```

### Example 3: CSRF Protection
```
1. GET /form
   Response: <input name="_token" value="xyz789token">

2. POST /submit
   Request Body: name=John&_token=xyz789token
   
   DETECTED DEPENDENCY:
   - csrf: Response body field "_token" -> Request body field "_token" (confidence: 0.9)
```

### Example 4: Resource Creation Flow
```
1. POST /api/orders
   Response: {"orderId": "ord_999", "status": "created"}

2. GET /api/orders/ord_999
   
   DETECTED DEPENDENCY:
   - data_flow: Response body field "orderId" -> Request URL path "ord_999" (confidence: 0.9)
```

## Integration Points

### Backend Integration
The dependency detector is integrated into the broadcast plugin:

```typescript
function completeTransaction(id: string) {
    // Build transaction data...
    
    // STEP 1: Analyze current request for dependencies
    const dependencies = dependencyDetector.analyzeRequest(transactionData, id)
    
    // STEP 2: Index current response for future lookups  
    dependencyDetector.indexResponse(transactionData, id)
    
    // STEP 3: Broadcast with dependencies
    hub.broadcast({
        type: 'transactionComplete',
        transaction: transactionData,
        dependencies: dependencies.length > 0 ? dependencies : undefined
    })
}
```

### Frontend Integration
The transaction store handles dependency data:

```typescript
// Store dependencies with transactions
const transactionWithMeta = {
    ...transactionEvent.transaction,
    id: transactionEvent.id,
    timestamp: new Date(transactionEvent.ts).getTime(),
    dependencies: transactionEvent.dependencies  // New!
}

// Helper functions for dependency analysis
getTransactionDependencies(transactionId): TransactionDependency[]
getDependentTransactions(transactionId): TransactionWithMeta[]
getDependencyChain(transactionId): TransactionWithMeta[]
hasAuthDependencies(transactionId): boolean
```

## Data Flow Diagram

```
Incoming Request
       ↓
RequestValueExtractor
       ↓
[tokens, IDs, values] ──────┐
       ↓                    │
ResponseDataIndex.search()   │
       ↓                    │
[matching origins found]     │
       ↓                    │
Create Dependencies ←────────┘
       ↓
Broadcast to Frontend
       ↓
Update Transaction Store
       ↓
Available for Waterfall UI

Parallel Flow:
Response Data ──→ ResponseDataIndex.index() ──→ [stored for future lookups]
```

## Performance Characteristics

### Memory Usage
- **Index size**: ~10KB per domain for typical web traffic
- **Cleanup**: Automatic removal of data older than 10 minutes
- **Limits**: Maximum 10,000 indexed values to prevent memory leaks

### CPU Impact
- **Per request**: ~1-5ms overhead for dependency analysis
- **Operations**: Map lookups (O(1)) + string comparisons
- **Scalability**: Linear with number of unique values in responses

### Network Impact
- **None**: All analysis happens server-side
- **Bandwidth**: Minimal increase in WebSocket messages (dependencies array)

## Configuration Options

### Tunable Parameters
```typescript
// In ResponseDataIndex
maxEntries: 10000        // Maximum indexed values
maxAge: 10 * 60 * 1000   // 10 minutes retention

// In value filtering
minValueLength: 4        // Skip very short values
maxValueLength: none     // No upper limit
tokenMinLength: 16       // Minimum for token detection
```

### Extension Points
- **Custom value extractors**: Add new extraction patterns
- **Additional dependency types**: Extend the classification system
- **Custom confidence scoring**: Adjust weights for different patterns
- **Domain-specific logic**: Add special handling for known API patterns

## Security Considerations

### Data Exposure
- **Values logged**: Potentially sensitive tokens and IDs are logged
- **Log levels**: Use debug level for detailed dependency information
- **Retention**: Automatic cleanup prevents long-term storage of sensitive data

### Performance Protection
- **Rate limiting**: Built-in limits prevent memory exhaustion
- **Value filtering**: Skip processing of very large response bodies
- **Cleanup**: Automatic removal of old data prevents unbounded growth

## Future Enhancements

### Planned Features
1. **Cross-session correlation**: Link requests across different user sessions
2. **Bulk operation detection**: Identify batch/bulk API operations
3. **Resource lifecycle tracking**: Full CRUD operation chains
4. **Machine learning**: Improve confidence scoring with usage patterns
5. **Export capabilities**: Generate dependency graphs for documentation

### Waterfall View Integration
The dependency data enables powerful waterfall visualizations:
- **Dependency lines**: Visual connections between related requests
- **Grouped flows**: Cluster related requests together
- **Timeline analysis**: Show how long between dependency creation and use
- **Flow filtering**: Filter waterfall by dependency chains
- **Business logic insights**: Understand application workflows

This dependency analysis system provides the foundation for understanding complex web application behavior through automatic detection of real data relationships.
