// Minimal chainable stand-in for the supabase-js query builder, for tests.
// Every query is recorded; `handler` decides each query's result.

export interface FakeQuery {
  table: string;
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  columns?: string;
  filters: Array<[string, ...unknown[]]>;
  payload?: unknown;
  options?: unknown;
  range?: [number, number];
  single?: boolean;
}

export interface FakeResult {
  data?: unknown;
  error?: { message: string } | null;
}

export type FakeHandler = (q: FakeQuery) => FakeResult | undefined;

class Builder implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private q: FakeQuery;
  constructor(table: string, private handler: FakeHandler, private log: FakeQuery[]) {
    this.q = { table, op: 'select', filters: [] };
  }
  select(columns?: string) {
    if (this.q.op === 'select') this.q.columns = columns;
    return this;
  }
  insert(payload: unknown, options?: unknown) { this.q.op = 'insert'; this.q.payload = payload; this.q.options = options; return this; }
  upsert(payload: unknown, options?: unknown) { this.q.op = 'upsert'; this.q.payload = payload; this.q.options = options; return this; }
  update(payload: unknown) { this.q.op = 'update'; this.q.payload = payload; return this; }
  delete() { this.q.op = 'delete'; return this; }
  range(from: number, to: number) { this.q.range = [from, to]; return this; }
  maybeSingle() { this.q.single = true; return this; }
  single() { this.q.single = true; return this; }
  then<A = { data: unknown; error: { message: string } | null }, B = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    this.log.push(this.q);
    const r = this.handler(this.q) ?? {};
    let data = r.data ?? null;
    if (this.q.single && Array.isArray(data)) data = data[0] ?? null;
    return Promise.resolve({ data, error: r.error ?? null }).then(onfulfilled, onrejected);
  }
}
for (const m of ['eq', 'neq', 'in', 'gte', 'gt', 'lte', 'lt', 'or', 'is', 'order', 'limit']) {
  (Builder.prototype as unknown as Record<string, unknown>)[m] = function (this: { q: FakeQuery }, ...args: unknown[]) {
    this.q.filters.push([m, ...args]);
    return this;
  };
}

export function fakeSupabase(handler: FakeHandler) {
  const log: FakeQuery[] = [];
  const client = {
    from: (table: string) => new Builder(table, handler, log),
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  };
  return { client, log };
}

/** Value of the first `eq` filter on `column`, if any. */
export function eqValue(q: FakeQuery, column: string): unknown {
  return q.filters.find(f => f[0] === 'eq' && f[1] === column)?.[2];
}
