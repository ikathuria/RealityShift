/**
 * A tiny stand-in for the supabase-js client: every query records what was
 * asked (table/rpc, filters, payload) and resolves to whatever `respond`
 * returns for it. Like supabase-js, errors are returned, never thrown.
 */
export interface QueryRecord {
  table?: string;
  rpc?: string;
  args?: unknown;
  select?: string;
  selectOptions?: unknown;
  filters: Record<string, unknown>;
  upsert?: unknown;
  upsertOptions?: unknown;
  single?: boolean;
}

export interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
}

export function makeSupabaseMock(respond: (q: QueryRecord) => QueryResult) {
  const calls: QueryRecord[] = [];

  function builder(rec: QueryRecord) {
    calls.push(rec);
    const b = {
      select(cols?: string, opts?: unknown) { rec.select = cols; rec.selectOptions = opts; return b; },
      eq(col: string, val: unknown) { rec.filters[col] = val; return b; },
      order() { return b; },
      limit() { return b; },
      single() { rec.single = true; return b; },
      maybeSingle() { rec.single = true; return b; },
      upsert(row: unknown, opts?: unknown) { rec.upsert = row; rec.upsertOptions = opts; return b; },
      then<T>(onFulfilled: (r: { data: unknown; error: unknown; count: number | null }) => T, onRejected?: (e: unknown) => T) {
        const r = respond(rec);
        return Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null })
          .then(onFulfilled, onRejected);
      },
    };
    return b;
  }

  const client = {
    from: (table: string) => builder({ table, filters: {} }),
    rpc: (name: string, args: unknown) => builder({ rpc: name, args, filters: {} }),
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
    },
  };
  return { client, calls };
}
