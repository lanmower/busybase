// @bun
// src/sdk.ts
var BB = (url, key) => {
  const req = (path, opts = {}) => globalThis.fetch(`${url}/${path}`, { ...opts, headers: { apikey: key, Authorization: `Bearer ${BB.token || key}`, ...opts.headers } }).then((r) => r.json());
  const Q = (table) => {
    const q = { filters: [], order: "", limit: 10, offset: 0, select: "*" };
    const builder = {
      select: (cols = "*") => (q.select = cols, builder),
      eq: (col, val) => (q.filters.push(`eq.${col}=${val}`), builder),
      neq: (col, val) => (q.filters.push(`neq.${col}=${val}`), builder),
      gt: (col, val) => (q.filters.push(`gt.${col}=${val}`), builder),
      gte: (col, val) => (q.filters.push(`gte.${col}=${val}`), builder),
      lt: (col, val) => (q.filters.push(`lt.${col}=${val}`), builder),
      lte: (col, val) => (q.filters.push(`lte.${col}=${val}`), builder),
      like: (col, val) => (q.filters.push(`like.${col}=${val}`), builder),
      ilike: (col, val) => (q.filters.push(`ilike.${col}=${val}`), builder),
      order: (col, { ascending = true } = {}) => (q.order = `${col}.${ascending ? "asc" : "desc"}`, builder),
      limit: (n) => (q.limit = n, builder),
      offset: (n) => (q.offset = n, builder),
      range: (from, to) => (q.range = `${from},${to}`, builder),
      then: (resolve, reject) => req(`rest/v1/${table}?select=${q.select}&${q.filters.join("&")}&order=${q.order}&limit=${q.limit}&offset=${q.offset}${q.range ? `&range=${q.range}` : ""}`).then(resolve, reject)
    };
    return builder;
  };
  const C = (table) => ({
    select: (...cols) => Q(table).select(cols.join(",")),
    insert: (data) => req("rest/v1/" + table, { method: "POST", body: JSON.stringify(Array.isArray(data) ? data : [data]), headers: { "Content-Type": "application/json" } }),
    upsert: (data) => req("rest/v1/" + table, { method: "PUT", body: JSON.stringify(Array.isArray(data) ? data : [data]), headers: { "Content-Type": "application/json" } }),
    update: (data) => ({ eq: (col, val) => req(`rest/v1/${table}?eq.${col}=${val}`, { method: "PATCH", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } }) }),
    delete: () => ({ eq: (col, val) => req(`rest/v1/${table}?eq.${col}=${val}`, { method: "DELETE" }) })
  });
  return {
    from: (table) => C(table),
    auth: {
      signUp: (email, password) => req("auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }), headers: { "Content-Type": "application/json" } }),
      signIn: (email, password) => req("auth/v1/token", { method: "POST", body: JSON.stringify({ email, password }), headers: { "Content-Type": "application/json" } }).then((r) => {
        if (r.access_token)
          BB.token = r.access_token;
        return r;
      }),
      signOut: () => req("auth/v1/logout", { method: "POST" }).then(() => {
        BB.token = null;
        return {};
      }),
      getUser: () => req("auth/v1/user", { method: "GET" })
    }
  };
};
BB.token = null;
var sdk_default = BB;
export {
  sdk_default as default,
  BB as createClient
};
