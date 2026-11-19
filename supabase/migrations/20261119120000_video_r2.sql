-- Vídeos no Cloudflare R2. O Drive público tem cota de downloads por arquivo
-- (403 downloadQuotaExceeded), que estourou com o júri assistindo.
-- video_key = caminho do objeto no bucket; o site entrega o vídeo por link
-- assinado e temporário (/api/video/{id}). O drive_file_id fica como reserva.
alter table public.films
  add column video_key text
  check (video_key ~ '^films/[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
