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
59 endpoints across 17 modules, all documented in Swagger:
- **Auth** (customer): register+OTP, verify/resend OTP, login, refresh, logout, forgot/reset password, profile
- **Admin auth + RBAC**: admin login, admins CRUD, roles + permissions
- **Users**: list/view, toggle active/special
- **Education**: schools CRUD (+ public code verification), game categories, quizzes + nested questions, game sessions (games history, read-only)
- **Ecommerce**: product categories, products + variants (admin + public catalog)
- **Orders**: list/detail/status update (including guest-order filter)
- **Packages**: CRUD (admin + public listing)
- **CMS**: pages (about/privacy/terms/return-policy/how-it-works), FAQs, social links, contact messages (admin + public contact form)
- **Chat**: read-only thread/message viewer for admin

Run `sql/schema.sql` then `sql/seed.sql` on a fresh database — seed creates
default roles/permissions, a first Super Admin login
(`admin@makedown.online` / `ChangeMe123!` — change it after first login),
and empty CMS page rows.

**Not built yet** (see `docs/PROJECT_PLAN.md`): cart/checkout + MyFatoorah
payment integration, the live multiplayer game engine (Socket.io session
play), and real-time chat sending. These need dedicated design passes
rather than being bolted on quickly.
