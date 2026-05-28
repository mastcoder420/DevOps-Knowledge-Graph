export interface Incident {
  incident_id: string;
  impacted_service: string;
  dependencies: string[];
  root_cause_summary: string;
  error_stack_trace: string;
  resolution_steps: string[];
  severity: "CRITICAL" | "WARNING" | "INFO";
  timestamp: string;
}

export const microservices = [
  { id: "api-gateway", name: "API Gateway", status: "healthy", host: "10.0.1.10", role: "Load Balancing & Routing" },
  { id: "auth-service", name: "Authentication Service", status: "healthy", host: "10.0.1.12", role: "Session & Token Manager" },
  { id: "payment-service", name: "Payment Service", status: "healthy", host: "10.0.1.15", role: "Checkout & Bank Ingestion" },
  { id: "redis-cache", name: "Redis Session Cache", status: "healthy", host: "10.0.2.3", role: "InMemory Fast Lookup" },
  { id: "user-db", name: "User DB (PostgreSQL)", status: "healthy", host: "10.0.3.50", role: "Primary Auth & User Store" },
  { id: "payment-db", name: "Payment DB (PostgreSQL)", status: "healthy", host: "10.0.3.60", role: "Ledger Transaction Storage" },
];

export const serviceDependencies = [
  { from: "api-gateway", to: "auth-service" },
  { from: "api-gateway", to: "payment-service" },
  { from: "auth-service", to: "redis-cache" },
  { from: "auth-service", to: "user-db" },
  { from: "payment-service", to: "redis-cache" },
  { from: "payment-service", to: "payment-db" },
];

export const mockIncidents: Incident[] = [
  {
    incident_id: "INC-8021",
    impacted_service: "user-db",
    dependencies: ["auth-service", "api-gateway"],
    severity: "CRITICAL",
    timestamp: "2026-05-27T18:42:00Z",
    root_cause_summary: "High traffic surge during marketing campaign led to a spike in parallel login request processing. The max connection limit in user-db (PostgreSQL) connection pool was capped at 50, causing subsequent connection requests to block and time out with 504 Gateway Timeout at the API Gateway level.",
    error_stack_trace: `FATAL: remaining connection slots are reserved for non-replication superuser connections
at Pool.connect (/app/node_modules/pg/lib/pool.js:203:11)
at ConnectionPool.acquire (/app/src/db.ts:42:24)
TimeoutError: ResourceRequest timed out after 15000ms`,
    resolution_steps: [
      "Scale up connection pool limit MAX_CONNECTIONS from 50 to 250 in user-db (Postgres) environment config.",
      "Implement aggressive write-behind caching on redis-cache to alleviate redundant db queries.",
      "Restart auth-service instances to flush orphaned socket allocations."
    ]
  },
  {
    incident_id: "INC-3392",
    impacted_service: "redis-cache",
    dependencies: ["auth-service", "payment-service", "api-gateway"],
    severity: "WARNING",
    timestamp: "2026-05-27T17:15:00Z",
    root_cause_summary: "Redis cache memory policy was set to noeviction instead of volatile-lru. High session data volume caused cache to exhaust memory, rejecting writes. Downstream auth-service fell back to querying user-db synchronously for every session validation, triggering a db bottleneck and slow response times.",
    error_stack_trace: `RedisError: OOM command not allowed when used memory > 'maxmemory'.
at RedisClient.sendCommand (/app/node_modules/redis/lib/client.js:104:19)
at SessionStore.setSession (/app/src/session.ts:89:12)
[WARNING] Fallback connection to Postgres Database triggered due to cache unavailability.`,
    resolution_steps: [
      "Update Redis configuration to set maxmemory-policy volatile-lru or allkeys-lru.",
      "Increase cluster memory allocation from 2GB to 8GB.",
      "Flush expired sessions using a background garbage collection job."
    ]
  },
  {
    incident_id: "INC-4029",
    impacted_service: "api-gateway",
    dependencies: ["payment-service"],
    severity: "CRITICAL",
    timestamp: "2026-05-27T16:02:00Z",
    root_cause_summary: "A third-party webhook payment provider experienced latency degradation (averaging 12.5s). The payment-service did not have an active circuit breaker, causing the main Event Loop to block waiting for third-party promises. This backpressure timed out the api-gateway's 5-second HTTP socket threshold.",
    error_stack_trace: `[gateway-proxy] ERROR: Downstream connection timeout [payment-service]
HTTP/1.1 504 Gateway Timeout
upstream_connect_time: -
upstream_response_time: 5.003
upstream_status: 504`,
    resolution_steps: [
      "Inject a circuit breaker configuration (opossum/resilience4j) on payment-service calls to downstream providers with a 2-second timeout and 10% error threshold.",
      "Route degraded payment verification requests to an asynchronous dead-letter queue (DLQ) for retries.",
      "Return a user-friendly 202 Accepted pending status instead of blocking HTTP calls."
    ]
  },
  {
    incident_id: "INC-5512",
    impacted_service: "user-db",
    dependencies: ["auth-service", "api-gateway"],
    severity: "CRITICAL",
    timestamp: "2026-05-27T15:30:00Z",
    root_cause_summary: "A parallel update of user profiles and authentication tokens was executed without consistent row indexing order. Transaction A locked row 105 (profile) and waited for row 106 (token), while Transaction B locked row 106 and waited for row 105. PostgreSQL aborted both transactions after a 10s deadlock threshold.",
    error_stack_trace: `ERROR: deadlock detected
DETAIL: Process 19448 waits for ShareLock on transaction 820128; blocked by process 19521.
Process 19521 waits for ShareLock on transaction 820119; blocked by process 19448.
HINT: See server log for query details.`,
    resolution_steps: [
      "Enforce uniform lock ordering across profiles and tokens queries in database transaction logic.",
      "Lower PostgreSQL deadlock_timeout from 10s to 1s to fail-fast.",
      "Implement automatic exponential backoff retry interceptors in the auth-service database client."
    ]
  },
  {
    incident_id: "INC-1104",
    impacted_service: "payment-service",
    dependencies: ["api-gateway"],
    severity: "WARNING",
    timestamp: "2026-05-27T14:10:00Z",
    root_cause_summary: "A malfunctioning client-side infinite loop sent thousands of duplicate checkout requests in a 1-minute window, exceeding the external payment processor's rate limits. The processor blocked the service API key, leading to cascading checkout failures across the entire storefront.",
    error_stack_trace: `HTTP/1.1 429 Too Many Requests
Retry-After: 3600
[payment-service] ERROR: Stripe API Key rate-limited. External request rejected.
at StripeAPI.charge (/app/src/stripe.ts:54:12)`,
    resolution_steps: [
      "Implement Redis-based distributed rate limiting at the api-gateway level (Token Bucket, 60 requests/min per IP).",
      "Update client app to reject duplicate checkout submissions using form idempotency tokens.",
      "Request immediate rate limit reset and whitelist from the payment processor support."
    ]
  }
];
