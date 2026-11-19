import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { r2Configured, signedVideoUrl } from "@/lib/r2";

const TTL = 6 * 3600; // cobre uma sessão longa de avaliação ou a cerimônia inteira

/**
 * Vídeo de um filme: redireciona para um link assinado e temporário do R2.
 * Quem pode ver o filme é decidido pelas políticas do banco (RLS): jurado da
 * edição ativa ou admin. Sem permissão, o filme "não existe" (404).
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/video/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("not found", { status: 404 });
  if (!r2Configured()) return new Response("R2 não configurado", { status: 503 });

  const supabase = await createClient();
  const { data: film } = await supabase.from("films").select("video_key").eq("id", id).maybeSingle();
  if (!film?.video_key) return new Response("not found", { status: 404 });

  const url = await signedVideoUrl(film.video_key, TTL);
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, no-store" },
  });
}
