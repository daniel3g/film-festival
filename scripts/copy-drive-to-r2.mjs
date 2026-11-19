// Copia do Drive para o R2 os vídeos dos filmes da edição ativa que ainda não estão lá.
// Os filmes que o Drive bloquear (cota de downloads, arquivo não público) são pulados:
// rode de novo mais tarde ou envie o arquivo pela página do filme no admin.
//
// Uso: npm run videos:copiar            (copia)
//      npm run videos:copiar -- --listar (só mostra a situação)
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const e = process.env;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_GOOGLE_API_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
  if (!e[k]) {
    console.error(`Falta ${k} no .env.local.`);
    process.exit(1);
  }
}
const onlyList = process.argv.includes("--listar");

const db = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const EXT = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;

const { data: films, error } = await db
  .from("films")
  .select("id, title, drive_file_id, video_key, size_bytes, ceremonies!inner(name, editions!inner(is_active))")
  .eq("ceremonies.editions.is_active", true)
  .order("title");
if (error) {
  console.error("Erro ao ler os filmes:", error.message);
  process.exit(1);
}

const pending = films.filter((f) => !f.video_key && f.drive_file_id);
console.log(`${films.length} filmes · ${films.filter((f) => f.video_key).length} já no R2 · ${pending.length} para copiar · ${films.filter((f) => !f.video_key && !f.drive_file_id).length} sem vídeo`);
if (onlyList) {
  for (const f of films) console.log(`  ${f.video_key ? "✓ R2   " : f.drive_file_id ? "• Drive" : "✖ nada "}  ${f.title}`);
}

const failed = [];
for (const f of onlyList ? [] : pending) {
  process.stdout.write(`→ ${f.title}: `);
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.drive_file_id)}?alt=media&key=${e.NEXT_PUBLIC_GOOGLE_API_KEY}`, {
      headers: e.NEXT_PUBLIC_SITE_URL ? { Referer: e.NEXT_PUBLIC_SITE_URL } : {},
    });
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      const why = body.includes("downloadQuotaExceeded") ? "cota de downloads do Drive estourada" : res.status === 404 ? "não encontrado (o arquivo está público?)" : `Drive respondeu ${res.status}`;
      throw new Error(why);
    }
    const size = Number(res.headers.get("content-length"));
    const type = (res.headers.get("content-type") ?? "video/mp4").split(";")[0];
    const key = `films/${f.id}/${randomUUID().slice(0, 8)}.${EXT[type] ?? "mp4"}`;

    let got = 0;
    let last = 0;
    const body = Readable.fromWeb(res.body).on("data", (chunk) => {
      got += chunk.length;
      if (Date.now() - last > 2000) {
        last = Date.now();
        process.stdout.write(`${Math.floor((got / size) * 100)}% `);
      }
    });
    await s3.send(new PutObjectCommand({ Bucket: e.R2_BUCKET, Key: key, Body: body, ContentLength: size, ContentType: type }));

    const head = await s3.send(new HeadObjectCommand({ Bucket: e.R2_BUCKET, Key: key }));
    if (head.ContentLength !== size) throw new Error(`tamanho no R2 (${head.ContentLength}) diferente do Drive (${size})`);

    const { error: upErr } = await db.from("films").update({ video_key: key, size_bytes: size }).eq("id", f.id);
    if (upErr) throw new Error(`banco: ${upErr.message}`);
    console.log(`✓ ${mb(size)}`);
  } catch (err) {
    console.log(`✖ ${err.message}`);
    failed.push(f.title);
  }
}

// process.exitCode em vez de process.exit: no Windows, sair com conexões abertas derruba o Node.
if (onlyList) {
  // só a listagem
} else if (failed.length) {
  console.log(`\nNão copiados (${failed.length}): ${failed.join(", ")}`);
  console.log("Rode de novo mais tarde (a cota do Drive libera em até 24h) ou envie pela página do filme no admin.");
  process.exitCode = 2;
} else {
  console.log("\nPronto: todos os vídeos estão no R2.");
}
