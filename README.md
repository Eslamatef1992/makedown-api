# Make Down API

Node.js + Express + MySQL backend for the Make Down platform (quiz-game
website, e-commerce, packages, schools, admin panel).

## Stack
- Node.js + Express
- MySQL (raw SQL via `mysql2/promise`, no ORM — see `sql/schema.sql`)
- JWT auth (access + refresh tokens) with email OTP verification
- Swagger / OpenAPI docs at `/swagger`
- Socket.io wired up for the live game engine and chat (namespaces land as those modules are built)

## Local setup
```bash
npm install
cp .env.example .env   # fill in DB + SMTP credentials
mysql -u root -p makedown < sql/schema.sql
npm run dev
```

API: http://localhost:4000/api/v1
Swagger UI: http://localhost:4000/swagger

## Project structure
```
src/
  config/       # env, db pool, mailer, swagger
  middlewares/  # auth guard, validation, error handling
  modules/      # one folder per domain: routes -> controller -> service -> repository
  utils/        # ApiError, response helpers, tokens, otp
  routes/       # mounts every module under /api/v1
sql/schema.sql  # full DDL — run this once against a fresh database
```

New modules (products, cart, orders, packages, schools, games, social, chat,
cms, admin) follow the same four-layer pattern as `src/modules/auth`.

## Status
Auth module (register, OTP verification, login, refresh, forgot/reset
password, profile) is implemented end-to-end. See `docs/PROJECT_PLAN.md` in
the project root for the full roadmap and schema reference.
