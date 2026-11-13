"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { adminClient, dbError, field, type ActionState } from "@/lib/admin";
import { fetchDriveMetadata, parseDriveLink } from "@/lib/drive";

const NO_ACCESS: ActionState = { error: "Sem permissão. Entre de novo como admin." };

// ---------------------------------------------------------------- filmes

export async function saveFilm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await adminClient();
  if (!supabase) return NO_ACCESS;

  const id = field(fd, "id");
  const title = field(fd, "title");
  const ceremonyId = field(fd, "ceremony_id");
  if (!title) return { error: "Informe o título do filme." };
  if (!ceremonyId) return { error: "Escolha a cerimônia." };

  const order = Number(field(fd, "screening_order") ?? 0);
  const row = {
    title,
    ceremony_id: ceremonyId,
    class_name: field(fd, "class_name"),
    synopsis: field(fd, "synopsis"),
    screening_order: Number.isFinite(order) ? order : 0,
    drive_file_id: null as string | null,
    size_bytes: null as number | null,
    duration_ms: null as number | null,
    md5: null as string | null,
  };

  // Link do Drive (opcional no cadastro; obrigatório antes do júri).
  let driveNote = "";
  const link = field(fd, "drive_link");
  if (link) {
    const parsed = parseDriveLink(link);
    if (!parsed.ok) return { error: parsed.error };
    row.drive_file_id = parsed.fileId;

    const meta = await fetchDriveMetadata(parsed.fileId);
    if (meta.status === "ok") {
      if (!meta.mimeType.startsWith("video/")) {
        return { error: `O arquivo "${meta.name}" não é um vídeo (${meta.mimeType}).` };
      }
      row.size_bytes = meta.sizeBytes;
      row.duration_ms = meta.durationMs;
      row.md5 = meta.md5;
      driveNote = ` Vídeo encontrado: ${meta.name}.`;
    } else if (meta.status === "not_found") {
      driveNote =
        " Atenção: o Drive não liberou o vídeo. Confira se ele está como \"Qualquer pessoa com o link\".";
    } else if (meta.status === "error") {
      driveNote = ` Não consegui conferir o vídeo agora (${meta.message}).`;
    }
  }

  if (id) {
    const { error } = await supabase.from("films").update(row).eq("id", id);
    if (error) return { error: dbError(error) };
    refresh();
    return { message: `Filme salvo.${driveNote}` };
  }

  const { data, error } = await supabase.from("films").insert(row).select("id").single();
  if (error) return { error: dbError(error) };
  redirect(`/admin/filmes/${data.id}?novo=1`);
}

export async function deleteFilm(fd: FormData) {
  const supabase = await adminClient();
  const id = field(fd, "id");
  if (!supabase || !id) return;

  const { data: film } = await supabase.from("films").select("title, poster_path").eq("id", id).single();
  const { error } = await supabase.from("films").delete().eq("id", id);
  if (error) throw new Error(dbError(error, "Não foi possível excluir."));

  if (film?.poster_path) await supabase.storage.from("posters").remove([film.poster_path]);
  await supabase.rpc("log_action", {
    p_action: "film.delete",
    p_entity: "films",
    p_entity_id: id,
    p_details: { title: film?.title ?? null },
  });
  redirect("/admin/filmes");
}

// ---------------------------------------------------------------- pôster

/** Chamado depois que o navegador enviou a imagem ao Storage. */
export async function setFilmPoster(filmId: string, path: string): Promise<ActionState> {
  const supabase = await adminClient();
  if (!supabase) return NO_ACCESS;
  if (!path.startsWith(`${filmId}/`)) return { error: "Caminho de arquivo inválido." };

  const { data: film } = await supabase.from("films").select("poster_path").eq("id", filmId).single();
  const { error } = await supabase.from("films").update({ poster_path: path }).eq("id", filmId);
  if (error) return { error: dbError(error) };

  if (film?.poster_path && film.poster_path !== path) {
    await supabase.storage.from("posters").remove([film.poster_path]);
  }
  refresh();
  return { message: "Pôster atualizado." };
}

export async function removeFilmPoster(filmId: string): Promise<ActionState> {
  const supabase = await adminClient();
  if (!supabase) return NO_ACCESS;

  const { data: film } = await supabase.from("films").select("poster_path").eq("id", filmId).single();
  const { error } = await supabase.from("films").update({ poster_path: null }).eq("id", filmId);
  if (error) return { error: dbError(error) };
  if (film?.poster_path) await supabase.storage.from("posters").remove([film.poster_path]);
  refresh();
  return { message: "Pôster removido." };
}

// ---------------------------------------------------------------- elenco

export async function saveCastMember(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await adminClient();
  if (!supabase) return NO_ACCESS;

  const id = field(fd, "id");
  const filmId = field(fd, "film_id");
  const studentName = field(fd, "student_name");
  if (!filmId) return { error: "Filme não informado." };
  if (!studentName) return { error: "Informe o nome do aluno." };

  const isEvaluated = fd.get("is_evaluated") === "on";
  const category = field(fd, "acting_category");
  if (isEvaluated && category !== "actress" && category !== "actor") {
    return { error: "Escolha se concorre a Melhor Atriz ou Melhor Ator." };
  }

  const row = {
    film_id: filmId,
    student_name: studentName,
    role_name: field(fd, "role_name"),
    is_evaluated: isEvaluated,
    acting_category: isEvaluated ? (category as "actress" | "actor") : null,
  };

  const { error } = id
    ? await supabase.from("cast_members").update(row).eq("id", id)
    : await supabase.from("cast_members").insert({
        ...row,
        sort_order: Number(field(fd, "sort_order") ?? 0),
      });
  if (error) return { error: dbError(error) };

  refresh();
  return { message: id ? "Salvo." : "Integrante adicionado." };
}

export async function deleteCastMember(fd: FormData) {
  const supabase = await adminClient();
  const id = field(fd, "id");
  if (!supabase || !id) return;
  const { error } = await supabase.from("cast_members").delete().eq("id", id);
  if (error) throw new Error(dbError(error, "Não foi possível remover."));
  refresh();
}
