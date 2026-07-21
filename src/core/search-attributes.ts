import proto from '@temporalio/proto';

export type IndexedValueTypeName = 'Keyword' | 'Int' | 'Datetime' | 'Bool' | 'Double' | 'Text';

export type SearchAttributeMap = Record<string, IndexedValueTypeName>;

interface OperatorServiceLike {
  addSearchAttributes(req: {
    namespace: string;
    searchAttributes: Record<string, number>;
  }): Promise<unknown>;
}

const IVT = proto.temporal.api.enums.v1.IndexedValueType;

const INDEXED_VALUE_TYPE: Record<IndexedValueTypeName, number> = {
  Keyword: IVT.INDEXED_VALUE_TYPE_KEYWORD,
  Int: IVT.INDEXED_VALUE_TYPE_INT,
  Datetime: IVT.INDEXED_VALUE_TYPE_DATETIME,
  Bool: IVT.INDEXED_VALUE_TYPE_BOOL,
  Double: IVT.INDEXED_VALUE_TYPE_DOUBLE,
  Text: IVT.INDEXED_VALUE_TYPE_TEXT,
};

// gRPC status code 6 = ALREADY_EXISTS (stable per gRPC spec). Match by code,
// not message string — Temporal can change wording without notice.
const GRPC_STATUS_ALREADY_EXISTS = 6;

/**
 * Registers custom search attributes against a Temporal namespace via the
 * operator service. Swallows ALREADY_EXISTS so re-running at startup is safe.
 *
 * Pass any connection's operatorService — works with both real connections
 * (Connection.operatorService from @temporalio/client) and test environments
 * (TestWorkflowEnvironment.connection.operatorService).
 *
 * Production registration is also possible out-of-band via:
 *   temporal operator search-attribute create --name Foo --type Keyword
 *
 * Usage:
 *   await registerSearchAttributes(connection.operatorService, {
 *     LeadId: 'Keyword',
 *     LeadStartedAt: 'Datetime',
 *     ReassignAttempts: 'Int',
 *   }, namespace);
 *
 * `namespace` is required (no 'default' fallback) — this call mutates server state,
 * and silently defaulting risks registering attributes against the wrong namespace
 * if the caller forgets to pass one.
 */
export async function registerSearchAttributes(
  operatorService: OperatorServiceLike,
  attributes: SearchAttributeMap,
  namespace: string
): Promise<void> {
  const searchAttributes: Record<string, number> = {};
  for (const [name, type] of Object.entries(attributes)) {
    searchAttributes[name] = INDEXED_VALUE_TYPE[type];
  }
  try {
    await operatorService.addSearchAttributes({ namespace, searchAttributes });
  } catch (err) {
    const code = (err as { code?: number } | null)?.code;
    if (code !== GRPC_STATUS_ALREADY_EXISTS) {
      throw err;
    }
  }
}
