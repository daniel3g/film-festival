"use server";

import { createClient } from "@/lib/supabase/server";

export type SaveScoreInput = {
  filmId: string;
  categoryId: string;
  castMemberId: string | null;
  /** null apaga a nota */
  value: number | null;
};

export type SaveScoreResult = { ok: true } | { ok: false; error: string };

/**
 * Salva (ou apaga) uma nota do jurado logado. O banco confere o resto:
 * RLS (só as próprias notas) e trigger (escala, categoria, elenco, júri encerrado).
 */
export async function saveScore(input: SaveScoreInput): Promise<SaveScoreResult> {
  const supabase = await createClient();
  const { data: jurorId } = await supabase.rpc("current_juror_id");
  if (!jurorId) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const { filmId, categoryId, castMemberId, value } = input;

  if (value === null) {
    let q = supabase
      .from("scores")
      .delete()
      .eq("juror_id", jurorId)
      .eq("category_id", categoryId)
      .eq("film_id", filmId);
    q = castMemberId ? q.eq("cast_member_id", castMemberId) : q.is("cast_member_id", null);
    const { error } = await q;
    return error ? { ok: false, error: message(error) } : { ok: true };
  }

  if (!(value >= 0 && value <= 10 && Number.isInteger(value * 2))) {
    return { ok: false, error: "Nota inválida: use de 0 a 10, com meio ponto." };
  }

  const { error } = await supabase.from("scores").upsert(
    { juror_id: jurorId, category_id: categoryId, film_id: filmId, cast_member_id: castMemberId, value },
    { onConflict: "juror_id,category_id,film_id,cast_member_id" },
  );
  return error ? { ok: false, error: message(error) } : { ok: true };
}

function message(error: { code?: string; message: string }) {
  if (error.code === "P0001") return error.message; // ex.: avaliação encerrada
  if (error.code === "42501") return "Sem permissão para salvar esta nota.";
  return "Não foi possível salvar. Verifique a internet e tente de novo.";
}
