# Backend Livraison (type Glovo)

API Fastify + Prisma pour gerer :

- catalogue de stores et produits,
- creation de commandes,
- suivi de statut de commande,
- tracking livreur simule.

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

## Endpoints principaux

- `GET /health`
- `POST /auth/guest`
- `GET /home`
- `GET /stores`
- `GET /stores/:storeId`
- `POST /orders`
- `GET /orders/:orderId`
- `GET /orders/:orderId/tracking`
- `POST /orders/:orderId/cancel`
