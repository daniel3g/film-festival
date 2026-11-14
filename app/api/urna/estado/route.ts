import { NextResponse } from "next/server";
import { getUrnaDevice } from "@/lib/urna";
import { createAdminClient } from "@/lib/supabase/server";

/** Estado da urna para a tela consultar a cada poucos segundos (também serve de "sinal de vida"). */
export async function GET() {
  const device = await getUrnaDevice();
  if (device) {
    await createAdminClient().from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
  }
  const body = !device
    ? { paired: false }
    : {
        paired: true,
        label: device.label,
        ceremony: device.ceremony
          ? {
              id: device.ceremony.id,
              name: device.ceremony.name,
              prefix: device.ceremony.code_prefix,
              status: device.ceremony.voting_status,
            }
          : null,
      };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
