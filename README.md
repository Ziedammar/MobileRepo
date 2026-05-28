# Application Super App Uber + Glovo (template style Gojek)

Ce depot contient une super-app mobile avec backend complet:
- **Uber-like**: course, ETA, tracking live, paiements, historique, support
- **Glovo-like**: stores, produits, panier, commande, suivi livreur
- **Template style Gojek**: home super-app avec quick services

## 1) Architecture (demandee: frontend + backend)

```text
backend/    -> API Fastify + Prisma + SQLite
frontend/   -> Mobile React Native Expo + TypeScript
```

## 2) Prerequis
- Node.js 20+
- npm 10+

## 3) Lancer le backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run db:push
npm run db:seed
npm run dev
```

API par defaut: `http://localhost:3333`

## 4) Lancer le frontend mobile

```bash
cd frontend
npm install
npm run start
```

Option `.env` dans `frontend/`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3333
```

(Android emulator: `http://10.0.2.2:3333`)

## 5) Modules backend principaux

### Auth & sessions
- `/auth/register`, `/auth/login`, `/auth/me`
- `/auth/refresh`, `/auth/logout`
- `/auth/oauth/google`, `/auth/oauth/apple` (mode simulation)

### Glovo (orders)
- `/home`, `/stores`, `/stores/:storeId`
- `/orders`, `/orders/:orderId/pay`, `/orders/:orderId/tracking`, `/orders/:orderId/cancel`
- WS `/ws/orders/:orderId`

### Uber (rides)
- `/rides/home`, `/rides/search`, `/rides/options`
- `/rides`, `/rides/:rideId`, `/rides/:rideId/tracking`, `/rides/:rideId/cancel`
- `/rides/history`, `/rides/:rideId/pay`, `/rides/:rideId/invoice`
- WS `/ws/rides/:rideId`

### Paiement / notifications / support
- `/payments/methods`, `/payments/history`
- `/notifications`, `/notifications/:notificationId/read`
- `/support/faqs`, `/support/tickets`, `/support/tickets/me`, `/support/tickets/:ticketId/messages`

### Admin / Super Admin
- Dashboard/Orders/Products/Couriers (restaurant admin)
- Rides live admin: `/admin/rides/live`
- Super admin users/stores/analytics/logs
- Broadcast notification simulation PUSH/SMS/EMAIL

## 6) Seed real mode

Le seed cree seulement le Super Admin:
- `superadmin@livraisonpro.app`
- password: `SuperAdmin123!` (ou `SEED_SUPER_ADMIN_PASSWORD`)

Les comptes Admin/Livreur passent en `PENDING_APPROVAL` jusqu'a validation Super Admin.

## 7) Scripts racine

```bash
npm run dev:backend
npm run dev:mobile
npm run build:backend
npm run typecheck
```
