"use client";

import { useActionState, useState, useTransition } from "react";
import { FormStatus } from "@/components/form-status";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { createDevice, deleteDevice, renewPairing, revokeDevice, setDeviceCeremony, type PairingResult } from "./actions";
import { LastSeen } from "./live";

type Device = {
  id: string;
  label: string;
  ceremony_id: string | null;
  paired: boolean;
  revoked: boolean;
  pairingPending: boolean;
  last_seen_at: string | null;
};

export function DevicesPanel({ devices, ceremonies }: { devices: Device[]; ceremonies: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createDevice, undefined);
  const [pairing, setPairing] = useState<PairingResult | null>(null);
  const [renewing, startRenew] = useTransition();

  // Mostra o código de pareamento da urna recém-criada.
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.pairing) setPairing(state.pairing);
  }

  const active = devices.filter((d) => !d.revoked);
  const revoked = devices.filter((d) => d.revoked);

  return (
    <div className="space-y-5">
      {pairing?.ok && (
        <div className="rounded-md border border-gold bg-gold/10 p-4 text-center">
          <p className="text-sm">
            Código de pareamento da <strong>{pairing.label}</strong> (vale 10 minutos):
          </p>
          <p className="my-2 font-mono text-3xl tracking-[0.2em] text-gold">{pairing.code}</p>
          <p className="text-xs text-muted">
            No computador da urna, abra <strong>{typeof window !== "undefined" ? location.origin : ""}/urna</strong> e
            digite este código.
          </p>
          <button type="button" className="btn-ghost mt-3 px-3 py-1 text-xs" onClick={() => setPairing(null)}>
            Fechar
          </button>
        </div>
      )}
      {pairing && !pairing.ok && <p className="text-sm text-red-300">{pairing.error}</p>}

      {active.length > 0 && (
        <ul className="divide-y divide-gold/10">
          {active.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-32">
                <p className="font-medium">{d.label}</p>
                <p className="text-xs">
                  {d.paired ? (
                    <LastSeen deviceId={d.id} initial={d.last_seen_at} />
                  ) : (
                    <span className="text-amber-300">{d.pairingPending ? "aguardando pareamento" : "não pareada"}</span>
                  )}
                </p>
              </div>
              <form action={setDeviceCeremony} className="flex items-center gap-2">
                <input type="hidden" name="id" value={d.id} />
                <select
                  name="ceremony_id"
                  defaultValue={d.ceremony_id ?? ""}
                  className="input w-56 py-1"
                  aria-label={`Cerimônia da ${d.label}`}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                >
                  <option value="">— sem cerimônia —</option>
                  {ceremonies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </form>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  className="btn-ghost px-3 py-1 text-xs"
                  disabled={renewing}
                  onClick={() => startRenew(async () => setPairing(await renewPairing(d.id)))}
                >
                  {d.paired ? "Parear de novo" : "Novo código"}
                </button>
                <form action={revokeDevice}>
                  <input type="hidden" name="id" value={d.id} />
                  <ConfirmSubmit
                    className="btn-danger px-3 py-1 text-xs"
                    message={`Revogar a ${d.label}? Ela para de aceitar votos imediatamente.`}
                  >
                    Revogar
                  </ConfirmSubmit>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label" htmlFor="device-label">Nova urna</label>
          <input id="device-label" name="label" placeholder={`Urna ${active.length + 1}`} defaultValue={`Urna ${active.length + 1}`} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="device-ceremony">Cerimônia</label>
          <select id="device-ceremony" name="ceremony_id" className="input" defaultValue={ceremonies[0]?.id ?? ""}>
            {ceremonies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" disabled={pending}>
          {pending ? "Criando…" : "Criar urna"}
        </button>
      </form>
      <FormStatus state={state?.error ? state : undefined} />

      {revoked.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer">Urnas revogadas ({revoked.length})</summary>
          <ul className="mt-2 space-y-1">
            {revoked.map((d) => (
              <li key={d.id} className="flex items-center gap-3">
                {d.label}
                <form action={deleteDevice}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="text-xs underline hover:text-foreground">remover da lista</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
