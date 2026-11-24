type Row = Record<string, any>;
const DEFAULTS: Record<string, () => Row> = {
  otp_requests: () => ({ attempts: 0, max_attempts: 5, status: "pending", consumed_at: null, created_at: new Date().toISOString() }),
  delivery_logs: () => ({ created_at: new Date().toISOString() }),
};

class Q implements PromiseLike<any> {
  filters: ((r: Row) => boolean)[] = [];
  op: "select" | "insert" | "update" = "select";
  patch: Row = {}; head = false; wantCount = false;
  constructor(private db: FakeDb, private name: string) {}
  select(_c?: string, o?: any) { if (o?.count) this.wantCount = true; if (o?.head) this.head = true; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
  gte(c: string, v: any) { this.filters.push((r) => r[c] >= v); return this; }
  lte(c: string, v: any) { this.filters.push((r) => r[c] <= v); return this; }
  lt(c: string, v: any) { this.filters.push((r) => r[c] < v); return this; }
  in(c: string, a: any[]) { this.filters.push((r) => a.includes(r[c])); return this; }
  order() { return this; } range() { return this; } limit() { return this; }
  insert(row: Row) { this.op = "insert"; this.patch = row; return this; }
  upsert(row: Row) { return this.insert(row); }
  update(p: Row) { this.op = "update"; this.patch = p; return this; }
  maybeSingle() { return this.run().then((r) => ({ ...r, data: r.data?.[0] ?? null })); }
  single() { return this.maybeSingle(); }
  then(a?: any, b?: any) { return this.run().then(a, b); }
  run(): Promise<any> {
    const t = (this.db.tables[this.name] ??= []);
    if (this.op === "insert") {
      const row = { ...(DEFAULTS[this.name]?.() ?? {}), ...this.patch };
      t.push(row);
      return Promise.resolve({ data: [{ ...row }], error: null, count: null });
    }
    const m = t.filter((r) => this.filters.every((f) => f(r)));
    if (this.op === "update") m.forEach((r) => Object.assign(r, this.patch));
    return Promise.resolve({ data: this.head ? null : m.map((r) => ({ ...r })), error: null, count: this.wantCount ? m.length : null });
  }
}
export class FakeDb {
  tables: Record<string, Row[]> = {};
  reset() { this.tables = {}; }
  from(name: string) { return new Q(this, name); }
}
export const fake = new FakeDb();
