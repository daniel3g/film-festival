import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin";

/**
 * Contador ao vivo (admin): votos por cerimônia = códigos usados.
 * Não revela a parcial por filme (oculta até encerrar).
 */
export async function GET() {
  const supabase = await adminClient();
  if (!supabase) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [{ data: ceremonies }, { data: codes }, { data: devices }] = await Promise.all([
    supabase
      .from("ceremonies")
      .select("id, voting_status, editions!inner(is_active)")
      .eq("editions.is_active", true),
    supabase.from("vote_codes").select("ceremony_id, used_at"),
    supabase.from("devices").select("id, last_seen_at").is("revoked_at", null),
  ]);

  const stats = Object.fromEntries(
    (ceremonies ?? []).map((c) => {
      const mine = (codes ?? []).filter((k) => k.ceremony_id === c.id);
      return [c.id, { status: c.voting_status, votes: mine.filter((k) => k.used_at).length, codes: mine.length }];
    }),
  );
  const seen = Object.fromEntries((devices ?? []).map((d) => [d.id, d.last_seen_at]));

  return NextResponse.json({ stats, seen, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
