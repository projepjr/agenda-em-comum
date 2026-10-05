# Agenda em comum — handoff

Aplicação mobile para cadastrar disponibilidades e cruzar horários entre hunters, closers e gerentes.

## Links

- Repositório GitHub: https://github.com/projepjr/agenda-em-comum
- Produção Cloudflare: https://agenda-em-comum-projep.presidencia-1d5.workers.dev
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
- `agenda_meetings.title` guarda o nome da reunião e `agenda_meetings.meeting_group_id` agrupa as linhas de um agendamento com vários participantes.
- `agenda_meetings.meeting_type` aceita `AP`/`DIAG`; `agenda_meetings.status` aceita `scheduled`, `happened`, `no_show` e `rescheduling`.
- A API suporta `updateAvailability`, `deleteAvailability`, `book` e `cancelMeeting`.

## Fluxos da interface

- O toque em uma disponibilidade abre a edição; a exclusão só existe dentro dessa janela.
- A busca de pessoas permite múltipla seleção e filtros por Closer, Hunter e Gerente.
- O agendamento solicita apenas o nome da reunião.
- A aba Reuniões alterna entre semana/mês e Minhas/Todas; somente participantes podem desmarcar um encontro.
- A visualização semanal usa cinco colunas; a mensal empilha as semanas do mês no mesmo formato.
- Tocar no card abre a edição. Os três pontos alteram o status e a cor do card; a lixeira fica apenas nessa janela.
- A agenda principal ocupa a altura livre acima do CTA e da navegacao inferior; o CTA de disponibilidade e compacto.
- A busca de participantes sempre inicia vazia e o seletor usa controles compactos com espacamento proprio.
- Os icones de exclusao sao SVG pretos; nao reintroduzir emoji de lixeira.
- O cruzamento de disponibilidade remove slots ocupados tanto pelo usuario atual quanto por qualquer pessoa selecionada.
- A criacao usa o RPC transacional `agenda_book_meeting`; nao substituir por insert direto, pois os locks por pessoa evitam agendamento simultaneo no mesmo intervalo.
- Status disponiveis: `happened`, `no_show`, `interest_future`, `rescheduling` (rotulo Remarcando) e `discarded`.

## Deploy

- Build: `npm run build`.
- Deploy: `npm run deploy` depois de autenticar o Wrangler.
- Configure no Cloudflare as variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
- O `vite.config.ts` só inclui essas variáveis no artefato quando elas existem no ambiente de build; isso evita sobrescrever bindings de produção com strings vazias. No Worker, mantenha ambas como secrets.

## Logins de demonstração

- `hunter@demo.com`
- `closer@demo.com`
- `gerente@demo.com`
- Senha comum: `demo123`

Esses logins são apenas para testes e não devem ser usados como autenticação de produção.
