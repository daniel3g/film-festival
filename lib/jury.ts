import "server-only";
import type { SupabaseServer } from "@/lib/admin";

export type Category = {
  id: string;
  code: string;
  name_pt: string;
  name_en: string;
  kind: "film" | "acting" | "public";
  acting_category: "actress" | "actor" | null;
  award_order: number;
};

export type CastLite = {
  id: string;
  student_name: string;
  role_name: string | null;
  is_evaluated: boolean;
  acting_category: "actress" | "actor" | null;
};

export type ScoreItem = {
  key: string;
  categoryId: string;
  castMemberId: string | null;
  label: string;
  sublabel: string;
  group: "film" | "acting";
};

/** Chave única de uma nota (categoria + integrante). */
export function scoreKey(categoryId: string, castMemberId: string | null) {
  return `${categoryId}:${castMemberId ?? "-"}`;
}

/** Categorias do júri da edição ativa, na ordem de premiação. */
export async function getJuryCategories(supabase: SupabaseServer): Promise<Category[]> {
  const { data } = await supabase
    .from("categories")
    .select("id, code, name_pt, name_en, kind, acting_category, award_order, editions!inner(is_active)")
    .eq("editions.is_active", true)
    .neq("kind", "public")
    .order("award_order");
  return (data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    name_pt: c.name_pt,
    name_en: c.name_en,
    kind: c.kind,
    acting_category: c.acting_category,
    award_order: c.award_order,
  }));
}

/** Lista o que o jurado precisa avaliar num filme. */
export function scoreItemsFor(categories: Category[], cast: CastLite[]): ScoreItem[] {
  const items: ScoreItem[] = [];
  for (const c of categories.filter((c) => c.kind === "film")) {
    items.push({
      key: scoreKey(c.id, null),
      categoryId: c.id,
      castMemberId: null,
      label: c.name_pt,
      sublabel: c.name_en,
      group: "film",
    });
  }
  for (const m of cast.filter((m) => m.is_evaluated && m.acting_category)) {
    const cat = categories.find((c) => c.kind === "acting" && c.acting_category === m.acting_category);
    if (!cat) continue;
    items.push({
      key: scoreKey(cat.id, m.id),
      categoryId: cat.id,
      castMemberId: m.id,
      label: m.student_name,
      sublabel: `${m.role_name ? `${m.role_name} · ` : ""}${cat.name_pt}`,
      group: "acting",
    });
  }
  return items;
}
