import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Vídeos dos filmes no Cloudflare R2 (sem custo de tráfego de saída).
 * O bucket é privado: o navegador recebe links assinados e temporários.
 */

let client: S3Client | null = null;

export function r2Configured() {
  const e = process.env;
  return Boolean(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET);
}

function r2() {
  if (!r2Configured()) throw new Error("R2 não configurado (variáveis R2_* no ambiente).");
  client ??= new S3Client({
    region: "auto",
    // Sem checksum automático: senão o SDK põe no link assinado o CRC de um corpo vazio.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

const bucket = () => process.env.R2_BUCKET!;

/** Caminho novo para o vídeo de um filme (nome único: trocar o vídeo não reaproveita cache). */
export function newVideoKey(filmId: string, fileName: string) {
  const ext = (fileName.match(/\.([A-Za-z0-9]{2,5})$/)?.[1] ?? "mp4").toLowerCase();
  return `films/${filmId}/${crypto.randomUUID().slice(0, 8)}.${ext}`;
}

/** Link de leitura. O player pede o vídeo em pedaços (Range) durante esse tempo. */
export function signedVideoUrl(key: string, seconds: number) {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: seconds });
}

/** Link para o navegador do admin enviar o arquivo direto ao R2 (sem passar pela Vercel). */
export function signedUploadUrl(key: string, contentType: string) {
  return getSignedUrl(r2(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), {
    expiresIn: 3 * 3600,
    signableHeaders: new Set(["content-type"]),
  });
}

export async function deleteVideo(key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
