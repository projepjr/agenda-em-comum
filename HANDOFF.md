# Agenda em comum — handoff

Aplicação mobile para cadastrar disponibilidades e cruzar horários entre hunters, closers e gerentes.

## Links

- Repositório GitHub: será preenchido após a publicação.
- Produção Cloudflare: será preenchido após a publicação.
- Supabase: projeto `gestaoprojep.com`, tabelas `agenda_users`, `agenda_availability` e `agenda_meetings`.

## Stack

- Next.js 16 + React 19, compilado com Vinext para Cloudflare Workers.
- Supabase Postgres acessado pela API REST.
- Cloudflare Workers para hospedagem e rotas de API.

## Desenvolvimento local

1. Rode `npm install`.
2. Copie `.env.example` para `.env.local`.
3. Preencha `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` pelo painel do Supabase.
4. Rode `npm run dev`.

## Banco

- A migração versionada está em `supabase/migrations`.
- As tabelas têm RLS habilitado.
- Como esta é uma versão de demonstração sem autenticação real, as políticas permitem leitura e gravação anônimas somente nas tabelas prefixadas com `agenda_`.
- Antes de uso real, substitua os logins demonstrativos por Supabase Auth e políticas ligadas a `auth.uid()`.

## Deploy

- Build: `npm run build`.
- Deploy: `npm run deploy` depois de autenticar o Wrangler.
- Configure no Cloudflare as variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.

## Logins de demonstração

- `hunter@demo.com`
- `closer@demo.com`
- `gerente@demo.com`
- Senha comum: `demo123`

Esses logins são apenas para testes e não devem ser usados como autenticação de produção.
