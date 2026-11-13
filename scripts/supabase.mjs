// Roda o Supabase CLI com o token deste projeto (SUPABASE_ACCESS_TOKEN do .env.local),
// sem depender do login global nem da variável de ambiente do sistema,
// que podem ser de outra conta.
//
// Uso: npm run sb -- db push --linked
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let token;
try {
  const env = readFileSync(path.join(root, ".env.local"), "utf8");
  const match = env.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*["']?([^"'\r\n]*)["']?\s*$/m);
  token = match?.[1]?.trim();
} catch {
  // sem .env.local
}

if (!token) {
  console.error(
    "SUPABASE_ACCESS_TOKEN não encontrado no .env.local.\n" +
      "Gere um token em https://supabase.com/dashboard/account/tokens (na conta do projeto)\n" +
      "e adicione a linha SUPABASE_ACCESS_TOKEN=sbp_... ao .env.local.",
  );
  process.exit(1);
}

// No Windows o npx é um .cmd e precisa de shell; aí cada argumento tem de ir entre aspas
// para não ser quebrado nos espaços (ex.: uma consulta SQL).
const isWin = process.platform === "win32";
const quote = (a) => (isWin && /[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a);

const result = spawnSync("npx", ["supabase", ...process.argv.slice(2)].map(quote), {
  cwd: root,
  stdio: "inherit",
  shell: isWin,
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
});
process.exit(result.status ?? 1);
