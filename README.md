# ChatFlow (nome provisório) – v0.2

Plataforma estilo ManyChat, multi-cliente, com IA (chave do próprio usuário) e WhatsApp via Evolution API.

## Rodar
1. `cp .env.example .env` e gere `MASTER_KEY` (`openssl rand -base64 32`), `JWT_SECRET` e `WEBHOOK_SECRET`
2. Em `apps/api`: `npx prisma migrate dev --name init` e commite `prisma/migrations`
3. `docker compose up -d --build`
4. Crie o admin: `npm run create-admin -- email "senha-12+-caracteres"`; faça login e ative o 2FA (`/auth/totp/setup` e `/auth/totp/enable`)
5. Admin cadastra a Evolution em `POST /admin/integrations` e cria gestores em `POST /admin/managers`
6. Na Evolution, webhook para `/webhooks/evolution` (evento `MESSAGES_UPSERT`) com header `x-webhook-secret`

## Perfis
- **PLATFORM_ADMIN**: conexões, gestores e métricas agregadas. Não acessa clientes nem chats.
- **MANAGER**: cria clientes e vê chats de um cliente por vez (auditado).
- **CLIENT**: vê só o próprio workspace.
- 2FA obrigatório para admin e gestores.

## Segurança já implementada
AES-256-GCM para chaves/segredos no banco · Argon2id · JWT 15 min · rate limit por IP com Redis + banimento automático
progressivo · webhook com segredo · limites mensais por workspace · auditoria de acessos · Helmet e CORS restrito.

## Falta (próximas etapas)
- [ ] Refresh token rotativo e recuperação de senha
- [ ] Convite por email (hoje o cliente recebe senha temporária na resposta da API)
- [ ] Chatbot sem IA (fluxos), Instagram (API oficial da Meta), envio manual/handoff
- [ ] RLS no Postgres (hoje o isolamento é na aplicação)
- [ ] Painel web, cobrança (R$ 50), termos/LGPD, testes automatizados
