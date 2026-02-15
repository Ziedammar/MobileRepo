# Backend Livraison V2 Pro

API Fastify + Prisma (SQLite) avec :

- auth JWT (client, coursier, admin),
- roles et routes protegees,
- catalogue stores/produits,
- commandes et progression de statut,
- paiement mock (ready pour integration provider),
- websocket temps reel pour tracking.

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

- Admin : `admin@livraisonpro.app` / `Admin123!`
- Client : `client@livraisonpro.app` / `Client123!`
- Coursier : `<prenom>.courier@livraisonpro.app` / `Courier123!`

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
- `GET /admin/orders` (admin)
- `GET /courier/orders/me` (coursier)
- `PATCH /courier/orders/:orderId/status` (coursier)
- `WS /ws/orders/:orderId?token=<JWT>`
