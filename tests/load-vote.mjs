// Teste de concorrência e carga do voto contra o banco REAL (não roda no npm test).
// Cria dados temporários na cerimônia JT e apaga tudo ao final.
// Uso: node --env-file=.env.local tests/load-vote.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const tag = `loadtest-${Date.now()}`;
const ok = (cond, msg) => console.log(`${cond ? "✔" : "✖"} ${msg}`);

const { data: cer } = await db
  .from("ceremonies")
  .select("id, voting_status, voting_opened_at, voting_closed_at, editions!inner(is_active)")
  .eq("code_prefix", "JT")
  .eq("editions.is_active", true)
  .single();
if (cer.voting_status !== "not_started") {
  console.error("JT não está em 'not_started' — teste abortado para não mexer numa votação real.");
  process.exit(1);
}

const created = { films: [], devices: [] };
try {
  await db.from("ceremonies").update({ voting_status: "open" }).eq("id", cer.id);
  const { data: films } = await db
    .from("films")
    .insert([1, 2, 3].map((i) => ({ ceremony_id: cer.id, title: `${tag} F${i}` })))
    .select("id");
  created.films = films.map((f) => f.id);
  const { data: devices } = await db
    .from("devices")
    .insert([1, 2, 3].map((i) => ({ label: `${tag} U${i}`, ceremony_id: cer.id, token_hash: `${tag}-tok${i}` })))
    .select("id, token_hash");
  created.devices = devices.map((d) => d.id);
  const codes = Array.from({ length: 81 }, (_, i) => `${tag}-code${i}`);
  await db.from("vote_codes").insert(codes.map((h) => ({ ceremony_id: cer.id, batch: "A", code_hash: h })));

  // 1) Mesmo código, 20 chamadas simultâneas vindas das 3 urnas: só 1 pode vencer.
  const same = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      db.rpc("cast_vote", { p_token_hash: devices[i % 3].token_hash, p_code_hash: codes[80], p_film: created.films[0] }),
    ),
  );
  const okCount = same.filter((r) => r.data === "ok").length;
  ok(okCount === 1, `mesmo código em 20 chamadas simultâneas: ${okCount} voto aceito, ${same.filter((r) => r.data === "used").length} "used"`);

  // 2) 80 votos em 8 rajadas de 10 (3 urnas), medindo o tempo de cada chamada.
  const times = [];
  for (let b = 0; b < 8; b++) {
    await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const n = b * 10 + i;
        const t0 = performance.now();
        const r = await db.rpc("cast_vote", {
          p_token_hash: devices[n % 3].token_hash,
          p_code_hash: codes[n],
          p_film: created.films[n % 3],
        });
        times.push(performance.now() - t0);
        if (r.data !== "ok") console.log("  falha:", r.data, r.error?.message);
      }),
    );
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95) - 1];
  ok(p95 < 1000, `80 votos: mediana ${Math.round(times[times.length / 2])} ms, p95 ${Math.round(p95)} ms (meta < 1000 ms)`);

  const { count } = await db.from("votes").select("id", { count: "exact", head: true }).in("film_id", created.films);
  ok(count === 81, `votos gravados: ${count} (esperado 81 = 80 + 1)`);
  const { count: used } = await db
    .from("vote_codes")
    .select("id", { count: "exact", head: true })
    .like("code_hash", `${tag}%`)
    .not("used_at", "is", null);
  ok(used === 81, `códigos queimados: ${used} (esperado 81)`);
} finally {
  // Limpeza: votos e códigos caem em cascata com filmes/cerimônia? votos sim (film), códigos não → apaga explícito.
  await db.from("vote_codes").delete().like("code_hash", `${tag}%`);
  if (created.films.length) await db.from("films").delete().in("id", created.films);
  if (created.devices.length) await db.from("devices").delete().in("id", created.devices);
  await db
    .from("ceremonies")
    .update({ voting_status: cer.voting_status, voting_opened_at: cer.voting_opened_at, voting_closed_at: cer.voting_closed_at })
    .eq("id", cer.id);
  const { count: left } = await db.from("films").select("id", { count: "exact", head: true }).like("title", `${tag}%`);
  console.log(`limpeza: ${left === 0 ? "ok" : `restaram ${left} filmes`}, JT voltou para '${cer.voting_status}'`);
}
