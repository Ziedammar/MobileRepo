import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  UserRole,
  type Prisma,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import Fastify, {
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { z } from "zod";

type AuthTokenPayload = {
  sub: string;
  role: UserRole;
  email: string | null;
  name: string;
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });
const app = Fastify({ logger: true });
const appAuth = app as any;

const PORT = Number(process.env.PORT ?? 3333);
const HOST = process.env.HOST ?? "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";
const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? "";

const orderFlow: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.DELIVERED,
];

const createGuestSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(64),
  phone: z.string().trim().min(7).max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(64),
});

const createOrderSchema = z.object({
  userId: z.string().cuid().optional(),
  customerName: z.string().trim().min(2).max(80).optional(),
  customerPhone: z.string().trim().min(7).max(20).optional(),
  storeId: z.string().cuid(),
  addressText: z.string().trim().min(5),
  addressLat: z.number().min(-90).max(90),
  addressLng: z.number().min(-180).max(180),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().min(1).max(12),
      }),
    )
    .min(1),
});

const payOrderSchema = z.object({
  provider: z.enum(["CARD", "APPLE_PAY", "GOOGLE_PAY"]).default("CARD"),
  cardLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

const paymentWebhookSchema = z.object({
  orderId: z.string().cuid(),
  status: z.enum(["paid", "failed", "refunded"]),
});

const courierStatusSchema = z.object({
  status: z.enum([
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.PICKED_UP,
    OrderStatus.ON_THE_WAY,
    OrderStatus.DELIVERED,
  ]),
});

const orderWithDetailsInclude = {
  store: true,
  courier: true,
  items: {
    include: {
      product: true,
    },
  },
  events: {
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{
  include: typeof orderWithDetailsInclude;
}>;

const orderWithTrackingInclude = {
  store: true,
  courier: true,
} satisfies Prisma.OrderInclude;

type OrderWithTracking = Prisma.OrderGetPayload<{
  include: typeof orderWithTrackingInclude;
}>;

type WsLike = {
  readyState: number;
  send: (payload: string) => void;
  close: () => void;
  on: (event: "close", listener: () => void) => void;
};

const orderSockets = new Map<string, Set<WsLike>>();

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING:
      return "Commande recue";
    case OrderStatus.ACCEPTED:
      return "Commande acceptee";
    case OrderStatus.PREPARING:
      return "Preparation en cours";
    case OrderStatus.PICKED_UP:
      return "Recuperee par le livreur";
    case OrderStatus.ON_THE_WAY:
      return "En route vers vous";
    case OrderStatus.DELIVERED:
      return "Commande livree";
    case OrderStatus.CANCELLED:
      return "Commande annulee";
    default:
      return "Statut inconnu";
  }
}

function statusFromElapsedMinutes(elapsedMinutes: number): OrderStatus {
  if (elapsedMinutes < 1) {
    return OrderStatus.PENDING;
  }

  if (elapsedMinutes < 3) {
    return OrderStatus.ACCEPTED;
  }

  if (elapsedMinutes < 8) {
    return OrderStatus.PREPARING;
  }

  if (elapsedMinutes < 12) {
    return OrderStatus.PICKED_UP;
  }

  if (elapsedMinutes < 22) {
    return OrderStatus.ON_THE_WAY;
  }

  return OrderStatus.DELIVERED;
}

function orderEtaMinutes(createdAt: Date, status: OrderStatus): number {
  if (status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED) {
    return 0;
  }

  const elapsedMinutes = (Date.now() - createdAt.getTime()) / 60000;
  return Math.max(1, Math.round(22 - elapsedMinutes));
}

function euclideanDistance(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number {
  const dLat = latA - latB;
  const dLng = lngA - lngB;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function extractBearerToken(
  authorization: string | undefined,
): string | undefined {
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function signUserToken(user: {
  id: string;
  role: UserRole;
  email: string | null;
  name: string;
}): string {
  return appAuth.jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    { expiresIn: "7d" },
  );
}

function sanitizeUser(user: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
}): {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
} {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

function canAccessOrder(
  order: {
    userId: string;
    courier: { userId: string | null } | null;
  },
  auth: AuthTokenPayload,
): boolean {
  if (auth.role === UserRole.ADMIN) {
    return true;
  }

  if (order.userId === auth.sub) {
    return true;
  }

  if (auth.role === UserRole.COURIER && order.courier?.userId === auth.sub) {
    return true;
  }

  return false;
}

function safeSocketSend(socket: WsLike, payload: unknown): void {
  if (socket.readyState !== 1) {
    return;
  }

  try {
    socket.send(JSON.stringify(payload));
  } catch (error) {
    app.log.warn({ error }, "Impossible d'envoyer un message websocket");
  }
}

function publishOrderRefresh(orderId: string, reason: string): void {
  const sockets = orderSockets.get(orderId);
  if (!sockets || sockets.size === 0) {
    return;
  }

  const payload = {
    type: "order:refresh",
    orderId,
    reason,
    at: new Date().toISOString(),
  };

  for (const socket of sockets) {
    safeSocketSend(socket, payload);
  }
}

async function getAuthFromRequest(
  request: FastifyRequest,
  required = false,
): Promise<AuthTokenPayload | null> {
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    if (required) {
      throw new Error("AUTH_REQUIRED");
    }
    return null;
  }

  try {
    const payload = await appAuth.jwt.verify<AuthTokenPayload>(token);
    return payload;
  } catch {
    throw new Error("AUTH_INVALID");
  }
}

async function syncOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      courierId: true,
      paymentStatus: true,
    },
  });

  if (!order) {
    return null;
  }

  if (
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.DELIVERED
  ) {
    return order.status;
  }

  if (order.paymentStatus !== PaymentStatus.PAID) {
    return order.status;
  }

  const elapsedMinutes = (Date.now() - order.createdAt.getTime()) / 60000;
  const nextStatus = statusFromElapsedMinutes(elapsedMinutes);
  const currentIndex = orderFlow.indexOf(order.status);
  const nextIndex = orderFlow.indexOf(nextStatus);

  if (currentIndex < 0 || nextIndex <= currentIndex) {
    return order.status;
  }

  const statusesToAppend = orderFlow.slice(currentIndex + 1, nextIndex + 1);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });

    await tx.orderStatusEvent.createMany({
      data: statusesToAppend.map((status) => ({
        orderId: order.id,
        status,
        label: statusLabel(status),
      })),
    });

    if (nextStatus === OrderStatus.DELIVERED && order.courierId) {
      await tx.courier.update({
        where: { id: order.courierId },
        data: { isAvailable: true },
      });
    }
  });

  publishOrderRefresh(order.id, "status_progressed");
  return nextStatus;
}

async function getOrderDetailsPayload(
  orderId: string,
): Promise<OrderWithDetails | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: orderWithDetailsInclude,
  });
}

async function getOrderTrackingPayload(
  orderId: string,
): Promise<OrderWithTracking | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: orderWithTrackingInclude,
  });
}

function serializeOrderDetails(order: OrderWithDetails) {
  return {
    id: order.id,
    status: order.status,
    statusLabel: statusLabel(order.status),
    paymentStatus: order.paymentStatus,
    paymentIntentId: order.paymentIntentId,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    store: {
      id: order.store.id,
      name: order.store.name,
      imageUrl: order.store.imageUrl,
    },
    courier: order.courier
      ? {
          id: order.courier.id,
          name: order.courier.name,
          vehicle: order.courier.vehicle,
          rating: order.courier.rating,
        }
      : null,
    address: {
      text: order.addressText,
      lat: order.addressLat,
      lng: order.addressLng,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.nameSnapshot,
      unitPrice: item.priceSnapshot,
      quantity: item.quantity,
      lineTotal: Number((item.priceSnapshot * item.quantity).toFixed(2)),
      imageUrl: item.product.imageUrl,
    })),
    totals: {
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
    },
    etaMinutes: orderEtaMinutes(order.createdAt, order.status),
    timeline: order.events.map((event) => ({
      id: event.id,
      status: event.status,
      label: event.label,
      timestamp: event.createdAt,
    })),
  };
}

function serializeTracking(order: OrderWithTracking) {
  const elapsedMinutes = (Date.now() - order.createdAt.getTime()) / 60000;
  const progress = Math.max(0, Math.min(1, elapsedMinutes / 22));

  let courierLat = order.store.lat;
  let courierLng = order.store.lng;

  if (
    order.status === OrderStatus.PICKED_UP ||
    order.status === OrderStatus.ON_THE_WAY
  ) {
    const routeProgress = Math.max(0.05, progress);
    courierLat =
      order.store.lat + (order.addressLat - order.store.lat) * routeProgress;
    courierLng =
      order.store.lng + (order.addressLng - order.store.lng) * routeProgress;
  } else if (order.status === OrderStatus.DELIVERED) {
    courierLat = order.addressLat;
    courierLng = order.addressLng;
  }

  return {
    orderId: order.id,
    status: order.status,
    statusLabel: statusLabel(order.status),
    paymentStatus: order.paymentStatus,
    etaMinutes: orderEtaMinutes(order.createdAt, order.status),
    courier: order.courier
      ? {
          id: order.courier.id,
          name: order.courier.name,
          vehicle: order.courier.vehicle,
          rating: order.courier.rating,
        }
      : null,
    pickup: {
      lat: order.store.lat,
      lng: order.store.lng,
      name: order.store.name,
    },
    destination: {
      lat: order.addressLat,
      lng: order.addressLng,
      text: order.addressText,
    },
    position: {
      lat: courierLat,
      lng: courierLng,
    },
  };
}

async function getOrderAccessMeta(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
      courierId: true,
      paymentStatus: true,
      courier: {
        select: { userId: true },
      },
    },
  });
}

const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await (request as FastifyRequest & { jwtVerify: () => Promise<void> }).jwtVerify();
  } catch {
    return reply.status(401).send({ message: "Unauthorized" });
  }
};

const authorizeRoles =
  (roles: UserRole[]) => async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) {
      return;
    }

    const authUser = (request as FastifyRequest & { user: AuthTokenPayload }).user;
    if (!roles.includes(authUser.role)) {
      return reply.status(403).send({ message: "Forbidden" });
    }
  };

app.register(cors, { origin: true });
app.register(jwt, { secret: JWT_SECRET });
app.register(websocket);

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      message: "Validation error",
      issues: error.issues,
    });
  }

  app.log.error(error);
  return reply.status(500).send({ message: "Internal server error" });
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "livraison-api-v2-pro",
    realtime: true,
    auth: true,
    payments: "mock-ready",
    timestamp: new Date().toISOString(),
  };
});

app.post("/auth/guest", async (request) => {
  const body = createGuestSchema.parse(request.body ?? {});

  const user = await prisma.user.create({
    data: {
      name: body.name ?? `Client ${Math.floor(Math.random() * 900 + 100)}`,
      phone: body.phone,
      role: UserRole.CUSTOMER,
    },
  });

  const token = signUserToken({
    id: user.id,
    name: user.name,
    role: user.role,
    email: user.email,
  });

  return {
    token,
    user: sanitizeUser(user),
  };
});

app.post("/auth/register", async (request, reply) => {
  const body = registerSchema.parse(request.body);
  const email = body.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return reply.status(409).send({ message: "Email already used" });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email,
      passwordHash,
      phone: body.phone,
      role: UserRole.CUSTOMER,
    },
  });

  return reply.status(201).send({
    token: signUserToken({
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
    }),
    user: sanitizeUser(user),
  });
});

app.post("/auth/login", async (request, reply) => {
  const body = loginSchema.parse(request.body);
  const email = body.email.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return reply.status(401).send({ message: "Invalid credentials" });
  }

  const validPassword = await bcrypt.compare(body.password, user.passwordHash);
  if (!validPassword) {
    return reply.status(401).send({ message: "Invalid credentials" });
  }

  return {
    token: signUserToken({
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
    }),
    user: sanitizeUser(user),
  };
});

app.get("/auth/me", { preHandler: authenticate }, async (request, reply) => {
  const authUser = (request as FastifyRequest & { user: AuthTokenPayload }).user;
  const user = await prisma.user.findUnique({
    where: { id: authUser.sub },
    include: {
      courierProfile: true,
    },
  });

  if (!user) {
    return reply.status(404).send({ message: "User not found" });
  }

  return {
    user: sanitizeUser(user),
    courierProfile: user.courierProfile,
  };
});

app.get("/stores", async () => {
  const stores = await prisma.store.findMany({
    include: {
      products: {
        where: { isPopular: true },
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
        },
        take: 3,
      },
    },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
  });

  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    category: store.category,
    description: store.description,
    rating: store.rating,
    etaMinutes: store.etaMinutes,
    deliveryFee: store.deliveryFee,
    imageUrl: store.imageUrl,
    productsPreview: store.products,
  }));
});

app.get("/stores/:storeId", async (request, reply) => {
  const params = z.object({ storeId: z.string().cuid() }).parse(request.params);

  const store = await prisma.store.findUnique({
    where: { id: params.storeId },
    include: {
      products: {
        orderBy: [{ isPopular: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!store) {
    return reply.status(404).send({ message: "Store not found" });
  }

  return store;
});

app.get("/home", async () => {
  const stores = await prisma.store.findMany({
    include: {
      products: {
        where: { isPopular: true },
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
        },
        take: 2,
      },
    },
    orderBy: [{ rating: "desc" }, { etaMinutes: "asc" }],
  });

  const categories = Array.from(new Set(stores.map((store) => store.category)));

  return {
    hero: {
      title: "Livraison ultra-rapide",
      subtitle: "Restaurants, courses et essentials en quelques minutes",
    },
    categories,
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      category: store.category,
      description: store.description,
      rating: store.rating,
      etaMinutes: store.etaMinutes,
      deliveryFee: store.deliveryFee,
      imageUrl: store.imageUrl,
      highlightProducts: store.products,
    })),
  };
});

app.post("/orders", async (request, reply) => {
  const body = createOrderSchema.parse(request.body);

  let authUser: AuthTokenPayload | null = null;
  try {
    authUser = await getAuthFromRequest(request, false);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_INVALID") {
      return reply.status(401).send({ message: "Invalid auth token" });
    }
    throw error;
  }

  try {
    const createdOrder = await prisma.$transaction(async (tx) => {
      let userId = authUser?.sub ?? body.userId;

      if (userId) {
        const existingUser = await tx.user.findUnique({ where: { id: userId } });
        if (!existingUser) {
          throw new Error("USER_NOT_FOUND");
        }
      } else {
        const guest = await tx.user.create({
          data: {
            name:
              body.customerName ??
              `Client ${Math.floor(Math.random() * 900 + 100)}`,
            phone: body.customerPhone,
            role: UserRole.CUSTOMER,
          },
        });

        userId = guest.id;
      }

      const store = await tx.store.findUnique({ where: { id: body.storeId } });
      if (!store) {
        throw new Error("STORE_NOT_FOUND");
      }

      const uniqueProductIds = [
        ...new Set(body.items.map((item) => item.productId)),
      ];
      const products = await tx.product.findMany({
        where: {
          id: { in: uniqueProductIds },
          storeId: store.id,
        },
      });

      if (products.length !== uniqueProductIds.length) {
        throw new Error("INVALID_PRODUCTS");
      }

      const productsById = new Map(products.map((product) => [product.id, product]));
      const subtotal = body.items.reduce((runningTotal, item) => {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new Error("INVALID_PRODUCTS");
        }

        return runningTotal + product.price * item.quantity;
      }, 0);

      const availableCouriers = await tx.courier.findMany({
        where: { isAvailable: true },
      });

      const selectedCourier =
        availableCouriers.length > 0
          ? availableCouriers.reduce((closestCourier, candidateCourier) => {
              const currentDistance = euclideanDistance(
                candidateCourier.lat,
                candidateCourier.lng,
                store.lat,
                store.lng,
              );
              const bestDistance = euclideanDistance(
                closestCourier.lat,
                closestCourier.lng,
                store.lat,
                store.lng,
              );

              return currentDistance < bestDistance
                ? candidateCourier
                : closestCourier;
            })
          : null;

      const deliveryFee = store.deliveryFee;
      const total = Number((subtotal + deliveryFee).toFixed(2));

      const order = await tx.order.create({
        data: {
          userId,
          storeId: store.id,
          courierId: selectedCourier?.id ?? null,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          subtotal: Number(subtotal.toFixed(2)),
          deliveryFee,
          total,
          addressText: body.addressText,
          addressLat: body.addressLat,
          addressLng: body.addressLng,
          items: {
            create: body.items.map((item) => {
              const product = productsById.get(item.productId)!;
              return {
                productId: product.id,
                nameSnapshot: product.name,
                priceSnapshot: product.price,
                quantity: item.quantity,
              };
            }),
          },
          events: {
            create: {
              status: OrderStatus.PENDING,
              label: statusLabel(OrderStatus.PENDING),
            },
          },
        },
        include: {
          store: true,
          courier: true,
        },
      });

      if (selectedCourier) {
        await tx.courier.update({
          where: { id: selectedCourier.id },
          data: { isAvailable: false },
        });
      }

      return order;
    });

    publishOrderRefresh(createdOrder.id, "created");

    return reply.status(201).send({
      id: createdOrder.id,
      status: createdOrder.status,
      statusLabel: statusLabel(createdOrder.status),
      paymentStatus: createdOrder.paymentStatus,
      paymentRequired: true,
      etaMinutes: orderEtaMinutes(createdOrder.createdAt, createdOrder.status),
      store: {
        id: createdOrder.store.id,
        name: createdOrder.store.name,
      },
      courier: createdOrder.courier
        ? {
            id: createdOrder.courier.id,
            name: createdOrder.courier.name,
            vehicle: createdOrder.courier.vehicle,
            rating: createdOrder.courier.rating,
          }
        : null,
      totals: {
        subtotal: createdOrder.subtotal,
        deliveryFee: createdOrder.deliveryFee,
        total: createdOrder.total,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND") {
        return reply.status(404).send({ message: "User not found" });
      }

      if (error.message === "STORE_NOT_FOUND") {
        return reply.status(404).send({ message: "Store not found" });
      }

      if (error.message === "INVALID_PRODUCTS") {
        return reply.status(400).send({ message: "Invalid products for store" });
      }
    }

    throw error;
  }
});

app.post("/orders/:orderId/pay", async (request, reply) => {
  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);
  const body = payOrderSchema.parse(request.body ?? {});

  let authUser: AuthTokenPayload;
  try {
    authUser = (await getAuthFromRequest(request, true))!;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "AUTH_REQUIRED" || error.message === "AUTH_INVALID")
    ) {
      return reply.status(401).send({ message: "Unauthorized" });
    }
    throw error;
  }

  const accessMeta = await getOrderAccessMeta(params.orderId);
  if (!accessMeta) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (authUser.role !== UserRole.ADMIN && accessMeta.userId !== authUser.sub) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  if (accessMeta.status === OrderStatus.CANCELLED) {
    return reply.status(400).send({ message: "Cancelled order cannot be paid" });
  }

  const paidOrder = await prisma.$transaction(async (tx) => {
    const freshOrder = await tx.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        paymentIntentId: true,
      },
    });

    if (!freshOrder) {
      throw new Error("ORDER_NOT_FOUND");
    }

    if (freshOrder.paymentStatus === PaymentStatus.PAID) {
      return freshOrder;
    }

    const paymentIntentId =
      freshOrder.paymentIntentId ?? `pi_${Math.random().toString(36).slice(2, 12)}`;

    await tx.order.update({
      where: { id: params.orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
        paymentIntentId,
        status:
          freshOrder.status === OrderStatus.PENDING
            ? OrderStatus.ACCEPTED
            : undefined,
      },
    });

    if (freshOrder.status === OrderStatus.PENDING) {
      await tx.orderStatusEvent.create({
        data: {
          orderId: params.orderId,
          status: OrderStatus.ACCEPTED,
          label: "Paiement confirme, commande acceptee",
        },
      });
    }

    return {
      ...freshOrder,
      paymentStatus: PaymentStatus.PAID,
      paymentIntentId,
      status:
        freshOrder.status === OrderStatus.PENDING
          ? OrderStatus.ACCEPTED
          : freshOrder.status,
    };
  });

  publishOrderRefresh(params.orderId, "paid");

  return {
    orderId: params.orderId,
    paymentStatus: paidOrder.paymentStatus,
    paymentIntentId: paidOrder.paymentIntentId,
    provider: body.provider,
    cardLast4: body.cardLast4 ?? null,
    status: paidOrder.status,
  };
});

app.post("/payments/webhook", async (request, reply) => {
  if (
    PAYMENT_WEBHOOK_SECRET &&
    request.headers["x-webhook-key"] !== PAYMENT_WEBHOOK_SECRET
  ) {
    return reply.status(401).send({ message: "Invalid webhook key" });
  }

  const body = paymentWebhookSchema.parse(request.body);

  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    select: { id: true, status: true },
  });

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (body.status === "paid") {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: body.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: new Date(),
          paymentIntentId: `pi_webhook_${Math.random().toString(36).slice(2, 10)}`,
          status:
            order.status === OrderStatus.PENDING ? OrderStatus.ACCEPTED : undefined,
        },
      });

      if (order.status === OrderStatus.PENDING) {
        await tx.orderStatusEvent.create({
          data: {
            orderId: body.orderId,
            status: OrderStatus.ACCEPTED,
            label: "Paiement confirme via webhook",
          },
        });
      }
    });
  } else if (body.status === "failed") {
    await prisma.order.update({
      where: { id: body.orderId },
      data: {
        paymentStatus: PaymentStatus.FAILED,
      },
    });
  } else {
    await prisma.order.update({
      where: { id: body.orderId },
      data: {
        paymentStatus: PaymentStatus.REFUNDED,
      },
    });
  }

  publishOrderRefresh(body.orderId, `webhook_${body.status}`);
  return { received: true };
});

app.get("/orders/:orderId", async (request, reply) => {
  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);

  let authUser: AuthTokenPayload;
  try {
    authUser = (await getAuthFromRequest(request, true))!;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "AUTH_REQUIRED" || error.message === "AUTH_INVALID")
    ) {
      return reply.status(401).send({ message: "Unauthorized" });
    }
    throw error;
  }

  const accessMeta = await getOrderAccessMeta(params.orderId);
  if (!accessMeta) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (!canAccessOrder(accessMeta, authUser)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  await syncOrderStatus(params.orderId);
  const order = await getOrderDetailsPayload(params.orderId);

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  return serializeOrderDetails(order);
});

app.get("/orders/:orderId/tracking", async (request, reply) => {
  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);

  let authUser: AuthTokenPayload;
  try {
    authUser = (await getAuthFromRequest(request, true))!;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "AUTH_REQUIRED" || error.message === "AUTH_INVALID")
    ) {
      return reply.status(401).send({ message: "Unauthorized" });
    }
    throw error;
  }

  const accessMeta = await getOrderAccessMeta(params.orderId);
  if (!accessMeta) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (!canAccessOrder(accessMeta, authUser)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  await syncOrderStatus(params.orderId);
  const order = await getOrderTrackingPayload(params.orderId);

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  return serializeTracking(order);
});

app.post("/orders/:orderId/cancel", async (request, reply) => {
  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);

  let authUser: AuthTokenPayload;
  try {
    authUser = (await getAuthFromRequest(request, true))!;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "AUTH_REQUIRED" || error.message === "AUTH_INVALID")
    ) {
      return reply.status(401).send({ message: "Unauthorized" });
    }
    throw error;
  }

  const accessMeta = await getOrderAccessMeta(params.orderId);
  if (!accessMeta) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (!canAccessOrder(accessMeta, authUser)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  if (accessMeta.status === OrderStatus.CANCELLED) {
    return reply.status(400).send({ message: "Order already cancelled" });
  }

  if (accessMeta.status === OrderStatus.DELIVERED) {
    return reply.status(400).send({ message: "Delivered order cannot be cancelled" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: accessMeta.id },
      data: {
        status: OrderStatus.CANCELLED,
        paymentStatus:
          accessMeta.paymentStatus === PaymentStatus.PAID
            ? PaymentStatus.REFUNDED
            : undefined,
      },
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId: accessMeta.id,
        status: OrderStatus.CANCELLED,
        label: statusLabel(OrderStatus.CANCELLED),
      },
    });

    if (accessMeta.courierId) {
      await tx.courier.update({
        where: { id: accessMeta.courierId },
        data: { isAvailable: true },
      });
    }
  });

  publishOrderRefresh(accessMeta.id, "cancelled");

  return {
    id: accessMeta.id,
    status: OrderStatus.CANCELLED,
    paymentStatus:
      accessMeta.paymentStatus === PaymentStatus.PAID
        ? PaymentStatus.REFUNDED
        : accessMeta.paymentStatus,
    statusLabel: statusLabel(OrderStatus.CANCELLED),
  };
});

app.get(
  "/admin/orders",
  { preHandler: authorizeRoles([UserRole.ADMIN]) },
  async () => {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        store: {
          select: { id: true, name: true },
        },
        courier: {
          select: { id: true, name: true, vehicle: true, userId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      user: order.user,
      store: order.store,
      courier: order.courier,
    }));
  },
);

app.get(
  "/courier/orders/me",
  { preHandler: authorizeRoles([UserRole.COURIER]) },
  async (request, reply) => {
    const authUser = (request as FastifyRequest & { user: AuthTokenPayload }).user;
    const courier = await prisma.courier.findUnique({
      where: { userId: authUser.sub },
    });

    if (!courier) {
      return reply.status(404).send({ message: "Courier profile not found" });
    }

    const orders = await prisma.order.findMany({
      where: {
        courierId: courier.id,
      },
      include: {
        store: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return {
      courier: {
        id: courier.id,
        name: courier.name,
        vehicle: courier.vehicle,
        isAvailable: courier.isAvailable,
      },
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        destination: order.addressText,
        store: order.store,
        createdAt: order.createdAt,
      })),
    };
  },
);

app.patch(
  "/courier/orders/:orderId/status",
  { preHandler: authorizeRoles([UserRole.COURIER]) },
  async (request, reply) => {
    const params = z.object({ orderId: z.string().cuid() }).parse(request.params);
    const body = courierStatusSchema.parse(request.body);
    const authUser = (request as FastifyRequest & { user: AuthTokenPayload }).user;

    const courier = await prisma.courier.findUnique({
      where: { userId: authUser.sub },
    });

    if (!courier) {
      return reply.status(404).send({ message: "Courier profile not found" });
    }

    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        courierId: true,
      },
    });

    if (!order || order.courierId !== courier.id) {
      return reply.status(404).send({ message: "Order not assigned to courier" });
    }

    if (order.status === OrderStatus.CANCELLED) {
      return reply.status(400).send({ message: "Cancelled order cannot be updated" });
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      return reply.status(400).send({ message: "Order must be paid first" });
    }

    const currentIndex = orderFlow.indexOf(order.status);
    const nextIndex = orderFlow.indexOf(body.status);

    if (nextIndex < 0 || nextIndex <= currentIndex) {
      return reply.status(400).send({ message: "Invalid status transition" });
    }

    if (nextIndex - currentIndex > 1) {
      return reply.status(400).send({ message: "Status jump is not allowed" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: body.status },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: body.status,
          label: statusLabel(body.status),
        },
      });

      if (body.status === OrderStatus.DELIVERED) {
        await tx.courier.update({
          where: { id: courier.id },
          data: { isAvailable: true },
        });
      }
    });

    publishOrderRefresh(order.id, "courier_status_update");
    return {
      id: order.id,
      status: body.status,
      statusLabel: statusLabel(body.status),
    };
  },
);

appAuth.get(
  "/ws/orders/:orderId",
  { websocket: true },
  async (socket: WsLike, request: FastifyRequest) => {
    const paramsResult = z
      .object({ orderId: z.string().cuid() })
      .safeParse((request as FastifyRequest & { params: unknown }).params);
    if (!paramsResult.success) {
      safeSocketSend(socket, { type: "error", message: "Invalid order id" });
      socket.close();
      return;
    }

    const queryResult = z
      .object({ token: z.string().min(20) })
      .safeParse((request as FastifyRequest & { query: unknown }).query);
    if (!queryResult.success) {
      safeSocketSend(socket, { type: "error", message: "Missing token" });
      socket.close();
      return;
    }

    let authUser: AuthTokenPayload;
    try {
      authUser = await appAuth.jwt.verify<AuthTokenPayload>(queryResult.data.token);
    } catch {
      safeSocketSend(socket, { type: "error", message: "Invalid token" });
      socket.close();
      return;
    }

    const accessMeta = await getOrderAccessMeta(paramsResult.data.orderId);
    if (!accessMeta || !canAccessOrder(accessMeta, authUser)) {
      safeSocketSend(socket, { type: "error", message: "Forbidden" });
      socket.close();
      return;
    }

    const orderId = paramsResult.data.orderId;
    const sockets = orderSockets.get(orderId) ?? new Set<WsLike>();
    sockets.add(socket);
    orderSockets.set(orderId, sockets);

    safeSocketSend(socket, {
      type: "connected",
      orderId,
      message: "Realtime tracking connected",
    });
    publishOrderRefresh(orderId, "ws_connected");

    const heartbeat = setInterval(async () => {
      const status = await syncOrderStatus(orderId);
      if (!status) {
        safeSocketSend(socket, { type: "error", message: "Order not found" });
        socket.close();
        return;
      }

      safeSocketSend(socket, {
        type: "order:refresh",
        orderId,
        reason: "heartbeat",
        at: new Date().toISOString(),
      });
    }, 6000);

    socket.on("close", () => {
      clearInterval(heartbeat);
      const currentSockets = orderSockets.get(orderId);
      if (!currentSockets) {
        return;
      }

      currentSockets.delete(socket);
      if (currentSockets.size === 0) {
        orderSockets.delete(orderId);
      }
    });
  },
);

app.listen({ port: PORT, host: HOST }).then(() => {
  app.log.info(`API v2 pro en ligne sur http://${HOST}:${PORT}`);
});
