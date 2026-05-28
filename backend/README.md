# Backend Livraison V2 Pro

API Fastify + Prisma (SQLite) avec :

- auth JWT (Super Admin, Admin, Client, Livreur),
- roles et routes protegees,
- catalogue stores/produits,
- commandes et progression de statut,
- paiement mock (ready pour integration provider),
- websocket temps reel pour tracking et dashboard admin.

## Demarrage

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev
```

Serveur par defaut : `http://localhost:3333`.

## Comptes seed

- Super Admin : `superadmin@livraisonpro.app` / `SuperAdmin123!`
- Admin restaurant : `admin.*@livraisonpro.app` / `Admin123!`
- Client : `client@livraisonpro.app` / `Client123!`
- Livreur : `*.livreur@livraisonpro.app` / `Livreur123!`

## Endpoints principaux (V2)

- `GET /health`
- `POST /auth/guest`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /home`
- `GET /stores`
- `GET /stores/:storeId`
- `POST /orders`
- `POST /orders/:orderId/pay`
- `GET /orders/:orderId`
- `GET /orders/:orderId/tracking`
- `POST /orders/:orderId/cancel`
- `POST /payments/webhook`
- `GET /admin/dashboard`
- `GET /admin/orders` (admin)
- `PATCH /admin/orders/:orderId/decision` (admin accepte/refuse)
- `GET /admin/products`
- `POST /admin/products`
- `GET /admin/couriers`
- `POST /admin/couriers/associate`
- `GET /super-admin/dashboard`
- `GET /super-admin/pending-users`
- `PATCH /super-admin/users/:userId/approval`
- `GET /super-admin/stores`
- `GET /livreur/orders/me` (livreur)
- `PATCH /livreur/orders/:orderId/status` (livreur)
- `WS /ws/orders/:orderId?token=<JWT>`
- `WS /ws/admin/dashboard?token=<JWT>`
