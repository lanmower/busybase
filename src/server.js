// @bun
// src/server.ts
import { Database } from "bun:sqlite";
var [DB, PORT, AUTH] = [process.env.BUSYBASE_DB || "busybase.db", process.env.BUSYBASE_PORT || 54321, "_bb_"];
var db = new Database(DB);
db.run(`CREATE TABLE IF NOT EXISTS ${AUTH}users (id TEXT PRIMARY KEY, email TEXT UNIQUE, pw TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP)`);
db.run(`CREATE TABLE IF NOT EXISTS ${AUTH}sessions (token TEXT PRIMARY KEY, uid TEXT, exp TEXT)`);
var R = (s, v = []) => db.run(s, v);
var G = (s, v = []) => db.query(s).get(...v);
var [getUserByEmail, getSession] = [
  (e) => G(`SELECT * FROM ${AUTH}users WHERE email = ?`, [e]),
  (t) => G(`SELECT * FROM ${AUTH}sessions WHERE token = ? AND exp > datetime('now')`, [t])
];
var auth = (r) => {
  const s = getSession(r.headers.get("Authorization")?.split(" ")[1]);
  return s ? G(`SELECT id,email FROM ${AUTH}users WHERE id = ?`, [s.uid]) : null;
};
Bun.serve({ port: PORT, fetch: async (req) => {
  const { pathname, searchParams } = new URL(req.url);
  const P = Object.fromEntries(searchParams), B = await req.json().catch(() => ({}));
  const user = auth(req);
  if (pathname.startsWith("/rest/v1/")) {
    const table = pathname.slice(10).split("/").map(decodeURIComponent)[0];
    if (!table)
      return Response.json({ error: "Table required" }, { status: 400 });
    const cols = () => db.query(`PRAGMA table_info(${table})`).all();
    const sql = (s, v = []) => db.query(s).all(...v), run = (s, v = []) => (db.run(s, v), sql(`SELECT * FROM ${table} WHERE rowid = last_insert_rowid()`));
    const where = (p) => {
      const w = [], v = [];
      for (const [k, val] of Object.entries(p)) {
        const c = k.replace(/^(eq|neq|gt|gte|lt|lte|like|ilike|is)\./, "");
        const o = k.match(/^(eq|is)\./) ? "=" : k.match(/^neq\./) ? "!=" : k.match(/^gt\./) ? ">" : k.match(/^gte\./) ? ">=" : k.match(/^lt\./) ? "<" : k.match(/^lte\./) ? "<=" : k.match(/^like/) ? "LIKE" : "=";
        w.push(`${c} ${o} ?`);
        v.push(k.includes("like") ? `%${val}%` : val);
      }
      return [w.join(" AND "), v];
    };
    if (req.method === "GET") {
      const [w, v] = where(P);
      return Response.json(cols().length ? sql(`SELECT * FROM ${table}${w ? ` WHERE ${w}` : ""}`, v) : []);
    }
    if (req.method === "POST") {
      if (!cols().length && Object.keys(B).length)
        db.run(`CREATE TABLE IF NOT EXISTS ${table} (${Object.keys(B).map((k) => `"${k}" TEXT`).join(",")})`);
      return Response.json(Object.keys(B).length ? run(`INSERT INTO ${table} (${Object.keys(B).map((k) => `"${k}"`).join(",")}) VALUES (${Object.keys(B).map(() => "?").join(",")})`, Object.values(B)) : { error: "Empty body" }, { status: 201 });
    }
    if (req.method === "PUT" || req.method === "PATCH") {
      const [w, v] = where(P, [...Object.values(B)]);
      return Response.json(cols().length && w ? (R(`UPDATE ${table} SET ${Object.keys(B).map((k) => `"${k}"=?`).join(",")} WHERE ${w}`, v), sql(`SELECT * FROM ${table} WHERE ${w}`, v.slice(Object.values(B).length))) : { error: "No filter" });
    }
    if (req.method === "DELETE") {
      const [w, v] = where(P);
      return Response.json(cols().length && w ? (R(`DELETE FROM ${table} WHERE ${w}`, v), { deleted: true }) : { error: "No filter" });
    }
  }
  if (pathname.startsWith("/auth/v1/")) {
    const action = pathname.split("/")[3];
    if (action === "signup") {
      if (!B.email || !B.password)
        return Response.json({ error: "Email & password required" }, { status: 400 });
      const id = crypto.randomUUID(), hash = await Bun.password.hash(B.password);
      R(`INSERT INTO ${AUTH}users (id,email,pw) VALUES (?,?,?)`, [id, B.email, hash]);
      return Response.json({ id, email: B.email }, { status: 201 });
    }
    if (action === "token") {
      const u = B.email && getUserByEmail(B.email);
      if (!u)
        return Response.json({ error: "Invalid credentials" }, { status: 401 });
      const ok = await Bun.password.verify(B.password, u.pw);
      if (!ok)
        return Response.json({ error: "Invalid credentials" }, { status: 401 });
      return Response.json({ access_token: crypto.randomUUID(), token_type: "bearer", expires_in: 604800, user: { id: u.id, email: u.email } });
    }
    if (action === "user")
      return Response.json(user ? { id: user.id, email: user.email } : { error: "Unauthorized" }, { status: user ? 200 : 401 });
    if (action === "logout")
      return Response.json({});
  }
  return Response.json({ error: "Not found" }, { status: 404 });
} });
console.log(`\uD83D\uDE80 BusyBase: http://localhost:${PORT}`);
