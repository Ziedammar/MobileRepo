import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  NotificationType,
  OrderStatus,
  PaymentMethodType,
  PaymentStatus,
  PaymentTransactionStatus,
  PrismaClient,
  RideServiceType,
  RideStatus,
  SavedPlaceKind,
  type Prisma,
  SupportTicketStatus,
  UserAccessStatus,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";

type AuthTokenPayload = {
  sub: string;
  role: UserRole;
  accessStatus: UserAccessStatus;
  email: string | null;
  name: string;
};

type WsLike = {
  readyState: number;
  send: (payload: string) => void;
  close: () => void;
  on: (event: "close", listener: () => void) => void;
};

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const app = Fastify({ logger: true });
const appAny = app as any;

const PORT = Number(process.env.PORT ?? 3333);
const HOST = process.env.HOST ?? "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";
const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? "";

const orderProgressFlow = [
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.PICKED_UP,
  OrderStatus.ON_THE_WAY,
  OrderStatus.DELIVERED,
] as const;

const createGuestSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).max(64),
    phone: z.string().trim().min(7).max(20).optional(),
    role: z.nativeEnum(UserRole).default(UserRole.CLIENT),
    requestedStoreName: z.string().trim().min(3).max(100).optional(),
    requestedVehicle: z.string().trim().min(2).max(50).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === UserRole.SUPER_ADMIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le role SUPER_ADMIN ne peut pas etre cree depuis register",
        path: ["role"],
      });
    }

    if (data.role === UserRole.ADMIN && !data.requestedStoreName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le nom du restaurant est obligatoire pour un compte Admin",
        path: ["requestedStoreName"],
      });
    }

    if (data.role === UserRole.LIVREUR && !data.requestedVehicle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le type de vehicule est obligatoire pour un compte Livreur",
        path: ["requestedVehicle"],
      });
    }
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(64),
});

const createOrderSchema = z.object({
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

const adminDecisionSchema = z.object({
  decision: z.enum(["accept", "refuse"]),
  courierId: z.string().cuid().optional(),
  note: z.string().trim().max(200).optional(),
});

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(300),
  category: z.string().trim().min(2).max(60),
  price: z.number().positive(),
  stock: z.number().int().min(0).max(9999),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().url(),
  isPopular: z.boolean().optional(),
});

const patchProductSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().min(2).max(300).optional(),
    category: z.string().trim().min(2).max(60).optional(),
    price: z.number().positive().optional(),
    stock: z.number().int().min(0).max(9999).optional(),
    isAvailable: z.boolean().optional(),
    imageUrl: z.string().url().optional(),
    isPopular: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Au moins un champ doit etre modifie",
  });

const associateCourierSchema = z.object({
  livreurUserId: z.string().cuid(),
  vehicle: z.string().trim().min(2).max(50).optional(),
});

const courierAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

const superAdminApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  storeId: z.string().cuid().optional(),
  storeName: z.string().trim().min(2).max(100).optional(),
  vehicle: z.string().trim().min(2).max(50).optional(),
});

const createStoreSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(300),
  etaMinutes: z.number().int().min(10).max(90),
  deliveryFee: z.number().min(0),
  imageUrl: z.string().url(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const livreurStatusSchema = z.object({
  status: z.enum([
    OrderStatus.PICKED_UP,
    OrderStatus.ON_THE_WAY,
    OrderStatus.DELIVERED,
  ]),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});

const oauthSchema = z.object({
  providerToken: z.string().min(8),
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(80),
});

const savedPlaceSchema = z.object({
  label: z.string().trim().min(2).max(60),
  kind: z.nativeEnum(SavedPlaceKind),
  address: z.string().trim().min(3).max(160),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const rideSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(120),
});

const rideOptionsQuerySchema = z.object({
  pickupLat: z.coerce.number().min(-90).max(90),
  pickupLng: z.coerce.number().min(-180).max(180),
  destinationLat: z.coerce.number().min(-90).max(90),
  destinationLng: z.coerce.number().min(-180).max(180),
});

const createRideSchema = z.object({
  pickupAddress: z.string().trim().min(3).max(160),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  destinationAddress: z.string().trim().min(3).max(160),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  serviceType: z.nativeEnum(RideServiceType),
  paymentMethodType: z.nativeEnum(PaymentMethodType),
  seats: z.number().int().min(1).max(8).default(4),
  promoCode: z.string().trim().min(3).max(20).optional(),
});

const rideStatusPatchSchema = z.object({
  status: z.enum([RideStatus.ACCEPTED, RideStatus.ONGOING, RideStatus.COMPLETED]),
});

const rideCancelSchema = z.object({
  reason: z.string().trim().min(3).max(160).optional(),
});

const createPaymentMethodSchema = z.object({
  type: z.nativeEnum(PaymentMethodType),
  label: z.string().trim().min(2).max(80),
  last4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  isDefault: z.boolean().optional(),
});

const payRideSchema = z.object({
  methodType: z.nativeEnum(PaymentMethodType),
  couponCode: z.string().trim().min(3).max(20).optional(),
});

const createSupportTicketSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(500),
});

const supportMessageSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

const adminUserStatusSchema = z.object({
  accessStatus: z.nativeEnum(UserAccessStatus),
});

const orderDetailsInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  store: true,
  courier: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
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
  include: typeof orderDetailsInclude;
}>;

const trackingInclude = {
  store: true,
  courier: true,
} satisfies Prisma.OrderInclude;

type OrderWithTracking = Prisma.OrderGetPayload<{
  include: typeof trackingInclude;
}>;

const orderSockets = new Map<string, Set<WsLike>>();
const dashboardSockets = new Map<string, Set<WsLike>>();
const rideSockets = new Map<string, Set<WsLike>>();

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING:
      return "En attente de validation restaurant";
    case OrderStatus.ACCEPTED:
      return "Commande acceptee";
    case OrderStatus.REFUSED:
      return "Commande refusee par le restaurant";
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

function startOfDay(date = new Date()): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function sendSocket(socket: WsLike, payload: unknown): void {
  if (socket.readyState !== 1) {
    return;
  }

  try {
    socket.send(JSON.stringify(payload));
  } catch (error) {
    app.log.warn({ error }, "Erreur websocket");
  }
}

function publishOrderRefresh(orderId: string, reason: string): void {
  const sockets = orderSockets.get(orderId);
  if (!sockets) {
    return;
  }

  for (const socket of sockets) {
    sendSocket(socket, {
      type: "order:refresh",
      orderId,
      reason,
      at: new Date().toISOString(),
    });
  }
}

function publishDashboardRefresh(storeId: string, reason: string): void {
  const sockets = dashboardSockets.get(storeId);
  if (!sockets) {
    return;
  }

  for (const socket of sockets) {
    sendSocket(socket, {
      type: "dashboard:refresh",
      storeId,
      reason,
      at: new Date().toISOString(),
    });
  }
}

function publishRideRefresh(rideId: string, reason: string): void {
  const sockets = rideSockets.get(rideId);
  if (!sockets) {
    return;
  }

  for (const socket of sockets) {
    sendSocket(socket, {
      type: "ride:refresh",
      rideId,
      reason,
      at: new Date().toISOString(),
    });
  }
}

function publishRealtime(orderId: string, storeId: string, reason: string): void {
  publishOrderRefresh(orderId, reason);
  publishDashboardRefresh(storeId, reason);
}

function statusFromAcceptedElapsedMinutes(
  elapsedMinutes: number,
): (typeof orderProgressFlow)[number] {
  if (elapsedMinutes < 3) {
    return OrderStatus.ACCEPTED;
  }

  if (elapsedMinutes < 8) {
    return OrderStatus.PREPARING;
  }

  if (elapsedMinutes < 14) {
    return OrderStatus.PICKED_UP;
  }

  if (elapsedMinutes < 24) {
    return OrderStatus.ON_THE_WAY;
  }

  return OrderStatus.DELIVERED;
}

function computeEtaMinutes(order: {
  status: OrderStatus;
  acceptedAt: Date | null;
}): number {
  if (
    order.status === OrderStatus.DELIVERED ||
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.REFUSED
  ) {
    return 0;
  }

  if (!order.acceptedAt) {
    return 20;
  }

  const elapsed = (Date.now() - order.acceptedAt.getTime()) / 60000;
  return Math.max(1, Math.round(24 - elapsed));
}

function sanitizeUser(user: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  accessStatus: UserAccessStatus;
  requestedStoreName: string | null;
  requestedVehicle: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    accessStatus: user.accessStatus,
    requestedStoreName: user.requestedStoreName,
    requestedVehicle: user.requestedVehicle,
  };
}

function signUserToken(user: {
  id: string;
  role: UserRole;
  accessStatus: UserAccessStatus;
  email: string | null;
  name: string;
}): string {
  return appAny.jwt.sign(
    {
      sub: user.id,
      role: user.role,
      accessStatus: user.accessStatus,
      email: user.email,
      name: user.name,
    },
    { expiresIn: "7d" },
  );
}

async function verifyTokenString(token: string): Promise<AuthTokenPayload> {
  const decoded = (await appAny.jwt.verify(token)) as AuthTokenPayload;

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: {
      id: true,
      role: true,
      accessStatus: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new Error("AUTH_INVALID");
  }

  return {
    sub: user.id,
    role: user.role,
    accessStatus: user.accessStatus,
    email: user.email,
    name: user.name,
  };
}

async function getAuthFromRequest(
  request: FastifyRequest,
  options?: { required?: boolean; activeOnly?: boolean },
): Promise<AuthTokenPayload | null> {
  const required = options?.required ?? false;
  const activeOnly = options?.activeOnly ?? false;
  const token = extractBearerToken(request.headers.authorization);

  if (!token) {
    if (required) {
      throw new Error("AUTH_REQUIRED");
    }
    return null;
  }

  let auth: AuthTokenPayload;
  try {
    auth = await verifyTokenString(token);
  } catch {
    throw new Error("AUTH_INVALID");
  }

  if (activeOnly && auth.accessStatus !== UserAccessStatus.ACTIVE) {
    throw new Error("AUTH_NOT_ACTIVE");
  }

  return auth;
}

function handleAuthError(error: unknown, reply: FastifyReply): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message === "AUTH_REQUIRED" || error.message === "AUTH_INVALID") {
    reply.status(401).send({ message: "Unauthorized" });
    return true;
  }

  if (error.message === "AUTH_NOT_ACTIVE") {
    reply.status(403).send({
      message:
        "Compte en attente d'activation Super Admin ou access bloque",
    });
    return true;
  }

  if (error.message === "FORBIDDEN_ROLE") {
    reply.status(403).send({ message: "Forbidden" });
    return true;
  }

  return false;
}

function ensureRole(auth: AuthTokenPayload, roles: UserRole[]): void {
  if (!roles.includes(auth.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
}

async function getAdminStoreByUser(userId: string) {
  return prisma.store.findUnique({
    where: { adminUserId: userId },
  });
}

async function computeStoreDashboard(storeId: string) {
  const today = startOfDay();
  const halfDayAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

  const [
    totalOrders,
    pendingOrders,
    acceptedOrders,
    preparingOrders,
    onWayOrders,
    deliveredToday,
    refusedToday,
    revenueToday,
    productsCount,
    availableCouriers,
    busyCouriers,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { storeId } }),
    prisma.order.count({
      where: {
        storeId,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PAID,
      },
    }),
    prisma.order.count({ where: { storeId, status: OrderStatus.ACCEPTED } }),
    prisma.order.count({ where: { storeId, status: OrderStatus.PREPARING } }),
    prisma.order.count({ where: { storeId, status: OrderStatus.ON_THE_WAY } }),
    prisma.order.count({
      where: {
        storeId,
        status: OrderStatus.DELIVERED,
        createdAt: { gte: today },
      },
    }),
    prisma.order.count({
      where: {
        storeId,
        status: OrderStatus.REFUSED,
        createdAt: { gte: today },
      },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: {
        storeId,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
        createdAt: { gte: today },
      },
    }),
    prisma.product.count({ where: { storeId } }),
    prisma.courier.count({ where: { storeId, isAvailable: true } }),
    prisma.courier.count({ where: { storeId, isAvailable: false } }),
    prisma.order.findMany({
      where: {
        storeId,
        createdAt: { gte: halfDayAgo },
      },
      select: {
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const buckets = Array.from({ length: 6 }, (_, idx) => {
    const bucketStart = new Date(Date.now() - (6 - idx) * 2 * 60 * 60 * 1000);
    const label = bucketStart.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { label, orders: 0 };
  });

  for (const order of recentOrders) {
    const diffHours = (Date.now() - order.createdAt.getTime()) / (60 * 60 * 1000);
    const bucketIndex = Math.floor((12 - diffHours) / 2);
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex]!.orders += 1;
    }
  }

  return {
    totalOrders,
    pendingOrders,
    acceptedOrders,
    preparingOrders,
    onWayOrders,
    deliveredToday,
    refusedToday,
    revenueToday: Number((revenueToday._sum.total ?? 0).toFixed(2)),
    productsCount,
    availableCouriers,
    busyCouriers,
    chart: buckets,
  };
}

async function computeSuperAdminDashboard() {
  const today = startOfDay();
  const [usersCount, storesCount, pendingApprovals, ordersToday, deliveredToday] =
    await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.user.count({
        where: {
          accessStatus: UserAccessStatus.PENDING_APPROVAL,
          role: { in: [UserRole.ADMIN, UserRole.LIVREUR] },
        },
      }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({
        where: {
          status: OrderStatus.DELIVERED,
          createdAt: { gte: today },
        },
      }),
    ]);

  const usersByRoleRaw = await prisma.user.groupBy({
    by: ["role"],
    _count: {
      _all: true,
    },
  });

  const usersByRole = usersByRoleRaw.map((entry) => ({
    role: entry.role,
    count: entry._count._all,
  }));

  return {
    usersCount,
    storesCount,
    pendingApprovals,
    ordersToday,
    deliveredToday,
    usersByRole,
  };
}

function createRefreshTokenValue(): string {
  return crypto.randomBytes(40).toString("hex");
}

function hashRefreshToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function createSessionForUser(
  userId: string,
  request: FastifyRequest,
): Promise<string> {
  const refreshToken = createRefreshTokenValue();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const userAgent = request.headers["user-agent"] ?? null;
  const ipAddress = request.ip ?? null;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: {
      userId,
      refreshTokenHash,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  return refreshToken;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function rideServiceSnapshot(
  serviceType: RideServiceType,
  distanceKm: number,
): {
  serviceType: RideServiceType;
  label: string;
  etaMinutes: number;
  seats: number;
  estimatedPrice: number;
} {
  const configs: Record<
    RideServiceType,
    { label: string; baseFare: number; perKm: number; seats: number; eta: number }
  > = {
    [RideServiceType.UBER_X]: {
      label: "UberX",
      baseFare: 3.2,
      perKm: 1.05,
      seats: 4,
      eta: 5,
    },
    [RideServiceType.COMFORT]: {
      label: "Comfort",
      baseFare: 4.3,
      perKm: 1.3,
      seats: 4,
      eta: 6,
    },
    [RideServiceType.BLACK]: {
      label: "Black",
      baseFare: 8.5,
      perKm: 2.1,
      seats: 4,
      eta: 8,
    },
    [RideServiceType.XL]: {
      label: "XL",
      baseFare: 6.3,
      perKm: 1.6,
      seats: 6,
      eta: 7,
    },
  };

  const selected = configs[serviceType];
  const estimatedPrice = Number((selected.baseFare + distanceKm * selected.perKm).toFixed(2));
  const etaMinutes = Math.max(3, Math.round(selected.eta + distanceKm * 0.9));

  return {
    serviceType,
    label: selected.label,
    etaMinutes,
    seats: selected.seats,
    estimatedPrice,
  };
}

async function createUserNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payloadJson?: string;
}): Promise<void> {
  await prisma.userNotification.create({
    data: input,
  });
}

function canAccessRide(
  ride: {
    passengerUserId: string;
    driverUserId: string | null;
  },
  auth: AuthTokenPayload,
): boolean {
  if (auth.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  if (auth.role === UserRole.CLIENT) {
    return ride.passengerUserId === auth.sub;
  }

  if (auth.role === UserRole.LIVREUR) {
    return ride.driverUserId === auth.sub;
  }

  if (auth.role === UserRole.ADMIN) {
    return true;
  }

  return false;
}

function serializeRideTracking(ride: {
  id: string;
  status: RideStatus;
  pickupLat: number;
  pickupLng: number;
  destinationLat: number;
  destinationLng: number;
  pickupAddress: string;
  destinationAddress: string;
  etaMinutes: number;
  driverName: string | null;
  vehicleLabel: string | null;
  createdAt: Date;
  acceptedAt: Date | null;
  startedAt: Date | null;
}): {
  rideId: string;
  status: RideStatus;
  etaMinutes: number;
  pickup: { lat: number; lng: number; text: string };
  destination: { lat: number; lng: number; text: string };
  position: { lat: number; lng: number };
  driver: { name: string; vehicle: string } | null;
} {
  let position = {
    lat: ride.pickupLat,
    lng: ride.pickupLng,
  };

  if (ride.status === RideStatus.ACCEPTED) {
    const elapsed = ride.acceptedAt
      ? (Date.now() - ride.acceptedAt.getTime()) / 60000
      : (Date.now() - ride.createdAt.getTime()) / 60000;
    const t = Math.min(1, Math.max(0, elapsed / Math.max(1, ride.etaMinutes)));
    position = {
      lat: ride.pickupLat + (ride.destinationLat - ride.pickupLat) * t * 0.35,
      lng: ride.pickupLng + (ride.destinationLng - ride.pickupLng) * t * 0.35,
    };
  } else if (ride.status === RideStatus.ONGOING) {
    const elapsed = ride.startedAt
      ? (Date.now() - ride.startedAt.getTime()) / 60000
      : 0;
    const t = Math.min(1, Math.max(0, elapsed / Math.max(1, ride.etaMinutes)));
    position = {
      lat: ride.pickupLat + (ride.destinationLat - ride.pickupLat) * t,
      lng: ride.pickupLng + (ride.destinationLng - ride.pickupLng) * t,
    };
  } else if (ride.status === RideStatus.COMPLETED) {
    position = {
      lat: ride.destinationLat,
      lng: ride.destinationLng,
    };
  }

  return {
    rideId: ride.id,
    status: ride.status,
    etaMinutes:
      ride.status === RideStatus.COMPLETED || ride.status === RideStatus.CANCELLED
        ? 0
        : ride.etaMinutes,
    pickup: {
      lat: ride.pickupLat,
      lng: ride.pickupLng,
      text: ride.pickupAddress,
    },
    destination: {
      lat: ride.destinationLat,
      lng: ride.destinationLng,
      text: ride.destinationAddress,
    },
    position,
    driver:
      ride.driverName && ride.vehicleLabel
        ? {
            name: ride.driverName,
            vehicle: ride.vehicleLabel,
          }
        : null,
  };
}

async function getOrderAccessMeta(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      storeId: true,
      courierId: true,
      status: true,
      paymentStatus: true,
      store: {
        select: {
          adminUserId: true,
        },
      },
      courier: {
        select: {
          userId: true,
        },
      },
    },
  });
}

function canAccessOrder(
  order: {
    userId: string;
    store: { adminUserId: string | null };
    courier: { userId: string | null } | null;
  },
  auth: AuthTokenPayload,
): boolean {
  if (auth.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  if (auth.role === UserRole.CLIENT) {
    return order.userId === auth.sub;
  }

  if (auth.role === UserRole.ADMIN) {
    return order.store.adminUserId === auth.sub;
  }

  if (auth.role === UserRole.LIVREUR) {
    return order.courier?.userId === auth.sub;
  }

  return false;
}

async function restockOrderItems(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: {
      productId: true,
      quantity: true,
    },
  });

  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: {
        stock: { increment: item.quantity },
        isAvailable: true,
      },
    });
  }
}

async function syncOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      storeId: true,
      status: true,
      paymentStatus: true,
      acceptedAt: true,
      courierId: true,
    },
  });

  if (!order) {
    return null;
  }

  if (
    order.status === OrderStatus.DELIVERED ||
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.REFUSED
  ) {
    return order.status;
  }

  if (order.paymentStatus !== PaymentStatus.PAID || !order.acceptedAt) {
    return order.status;
  }

  const currentStatus = order.status as (typeof orderProgressFlow)[number];
  const currentIndex = orderProgressFlow.indexOf(currentStatus);
  if (currentIndex < 0) {
    return order.status;
  }

  const elapsed = (Date.now() - order.acceptedAt.getTime()) / 60000;
  const targetStatus = statusFromAcceptedElapsedMinutes(elapsed);
  const targetIndex = orderProgressFlow.indexOf(targetStatus);

  if (targetIndex <= currentIndex) {
    return order.status;
  }

  const statusesToAppend = orderProgressFlow.slice(currentIndex + 1, targetIndex + 1);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: targetStatus,
      },
    });

    await tx.orderStatusEvent.createMany({
      data: statusesToAppend.map((status) => ({
        orderId: order.id,
        status,
        label: statusLabel(status),
      })),
    });

    if (targetStatus === OrderStatus.DELIVERED && order.courierId) {
      await tx.courier.update({
        where: { id: order.courierId },
        data: { isAvailable: true },
      });
    }
  });

  publishRealtime(order.id, order.storeId, "auto_progress");
  return targetStatus;
}

function serializeOrderDetails(order: OrderWithDetails) {
  return {
    id: order.id,
    status: order.status,
    statusLabel: statusLabel(order.status),
    paymentStatus: order.paymentStatus,
    paymentIntentId: order.paymentIntentId,
    paidAt: order.paidAt,
    acceptedAt: order.acceptedAt,
    refusedAt: order.refusedAt,
    adminNote: order.adminNote,
    createdAt: order.createdAt,
    etaMinutes: computeEtaMinutes(order),
    user: order.user,
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
          user: order.courier.user
            ? {
                id: order.courier.user.id,
                name: order.courier.user.name,
                email: order.courier.user.email,
              }
            : null,
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
    timeline: order.events.map((event) => ({
      id: event.id,
      status: event.status,
      label: event.label,
      timestamp: event.createdAt,
    })),
  };
}

function serializeTracking(order: OrderWithTracking) {
  const elapsedFromAccepted =
    order.acceptedAt !== null
      ? (Date.now() - order.acceptedAt.getTime()) / 60000
      : 0;
  const routeProgress =
    order.acceptedAt !== null
      ? Math.max(0.05, Math.min(1, elapsedFromAccepted / 24))
      : 0;

  let courierLat = order.store.lat;
  let courierLng = order.store.lng;

  if (
    order.status === OrderStatus.PICKED_UP ||
    order.status === OrderStatus.ON_THE_WAY
  ) {
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
    etaMinutes: computeEtaMinutes(order),
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
    version: "v2-pro-roles-approval",
    timestamp: new Date().toISOString(),
  };
});

app.post("/auth/guest", async (request, reply) => {
  const body = createGuestSchema.parse(request.body ?? {});

  const user = await prisma.user.create({
    data: {
      name: body.name ?? `Client ${Math.floor(Math.random() * 900 + 100)}`,
      phone: body.phone,
      role: UserRole.CLIENT,
      accessStatus: UserAccessStatus.ACTIVE,
    },
  });

  const refreshToken = await createSessionForUser(user.id, request);

  return reply.status(201).send({
    token: signUserToken({
      id: user.id,
      role: user.role,
      accessStatus: user.accessStatus,
      email: user.email,
      name: user.name,
    }),
    refreshToken,
    requiresApproval: false,
    message: "Session invite creee",
    user: sanitizeUser(user),
  });
});

app.post("/auth/register", async (request, reply) => {
  const body = registerSchema.parse(request.body);
  const email = body.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return reply.status(409).send({ message: "Email deja utilise" });
  }

  const role = body.role;
  const accessStatus =
    role === UserRole.CLIENT
      ? UserAccessStatus.ACTIVE
      : UserAccessStatus.PENDING_APPROVAL;

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email,
      passwordHash,
      phone: body.phone,
      role,
      accessStatus,
      requestedStoreName: body.requestedStoreName,
      requestedVehicle: body.requestedVehicle,
    },
  });

  const token =
    accessStatus === UserAccessStatus.ACTIVE
      ? signUserToken({
          id: user.id,
          role: user.role,
          accessStatus: user.accessStatus,
          email: user.email,
          name: user.name,
        })
      : null;
  const refreshToken =
    accessStatus === UserAccessStatus.ACTIVE
      ? await createSessionForUser(user.id, request)
      : null;

  return reply.status(201).send({
    token,
    refreshToken,
    requiresApproval: accessStatus !== UserAccessStatus.ACTIVE,
    message:
      accessStatus === UserAccessStatus.ACTIVE
        ? "Compte cree avec succes"
        : "Demande envoyee au Super Admin. Validation en attente.",
    user: sanitizeUser(user),
  });
});

app.post("/auth/login", async (request, reply) => {
  const body = loginSchema.parse(request.body);
  const email = body.email.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return reply.status(401).send({ message: "Identifiants invalides" });
  }

  const validPassword = await bcrypt.compare(body.password, user.passwordHash);
  if (!validPassword) {
    return reply.status(401).send({ message: "Identifiants invalides" });
  }

  if (user.accessStatus === UserAccessStatus.PENDING_APPROVAL) {
    return reply.status(403).send({
      message:
        "Votre compte est en attente de validation par le Super Admin",
      requiresApproval: true,
      user: sanitizeUser(user),
    });
  }

  if (user.accessStatus !== UserAccessStatus.ACTIVE) {
    return reply.status(403).send({
      message: "Votre acces est bloque. Contactez le Super Admin.",
      user: sanitizeUser(user),
    });
  }

  const refreshToken = await createSessionForUser(user.id, request);

  return {
    token: signUserToken({
      id: user.id,
      role: user.role,
      accessStatus: user.accessStatus,
      email: user.email,
      name: user.name,
    }),
    refreshToken,
    requiresApproval: false,
    message: "Connexion reussie",
    user: sanitizeUser(user),
  };
});

app.post("/auth/refresh", async (request, reply) => {
  const body = refreshTokenSchema.parse(request.body);
  const refreshTokenHash = hashRefreshToken(body.refreshToken);

  const session = await prisma.authSession.findFirst({
    where: {
      refreshTokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return reply.status(401).send({ message: "Invalid refresh token" });
  }

  if (session.user.accessStatus !== UserAccessStatus.ACTIVE) {
    return reply.status(403).send({
      message: "Votre acces est bloque. Contactez le Super Admin.",
      user: sanitizeUser(session.user),
    });
  }

  const newRefreshToken = createRefreshTokenValue();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
  const userAgent = request.headers["user-agent"] ?? null;
  const ipAddress = request.ip ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.authSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    await tx.authSession.create({
      data: {
        userId: session.user.id,
        refreshTokenHash: newRefreshTokenHash,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  });

  return {
    token: signUserToken({
      id: session.user.id,
      role: session.user.role,
      accessStatus: session.user.accessStatus,
      email: session.user.email,
      name: session.user.name,
    }),
    refreshToken: newRefreshToken,
    requiresApproval: false,
    message: "Token renouvele",
    user: sanitizeUser(session.user),
  };
});

app.post("/auth/logout", async (request, reply) => {
  const body = refreshTokenSchema.parse(request.body);
  const refreshTokenHash = hashRefreshToken(body.refreshToken);

  await prisma.authSession.updateMany({
    where: {
      refreshTokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });

  return { success: true };
});

app.post("/auth/oauth/google", async (request, reply) => {
  const body = oauthSchema.parse(request.body);

  const user = await prisma.user.upsert({
    where: { email: body.email },
    update: {
      name: body.name,
      accessStatus: UserAccessStatus.ACTIVE,
    },
    create: {
      name: body.name,
      email: body.email,
      role: UserRole.CLIENT,
      accessStatus: UserAccessStatus.ACTIVE,
    },
  });

  const refreshToken = await createSessionForUser(user.id, request);

  return reply.send({
    token: signUserToken({
      id: user.id,
      role: user.role,
      accessStatus: user.accessStatus,
      email: user.email,
      name: user.name,
    }),
    refreshToken,
    requiresApproval: false,
    message: "Connexion Google simulee reussie",
    user: sanitizeUser(user),
  });
});

app.post("/auth/oauth/apple", async (request, reply) => {
  const body = oauthSchema.parse(request.body);

  const user = await prisma.user.upsert({
    where: { email: body.email },
    update: {
      name: body.name,
      accessStatus: UserAccessStatus.ACTIVE,
    },
    create: {
      name: body.name,
      email: body.email,
      role: UserRole.CLIENT,
      accessStatus: UserAccessStatus.ACTIVE,
    },
  });

  const refreshToken = await createSessionForUser(user.id, request);

  return reply.send({
    token: signUserToken({
      id: user.id,
      role: user.role,
      accessStatus: user.accessStatus,
      email: user.email,
      name: user.name,
    }),
    refreshToken,
    requiresApproval: false,
    message: "Connexion Apple simulee reussie",
    user: sanitizeUser(user),
  });
});

app.get("/auth/me", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, { required: true }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    include: {
      managedStore: true,
      courierProfile: true,
    },
  });

  if (!user) {
    return reply.status(404).send({ message: "User not found" });
  }

  return {
    user: sanitizeUser(user),
    managedStore: user.managedStore,
    courierProfile: user.courierProfile,
  };
});

app.get("/rides/home", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.CLIENT]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const [savedPlaces, recentRides] = await Promise.all([
    prisma.savedPlace.findMany({
      where: { userId: auth.sub },
      orderBy: [{ kind: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.ride.findMany({
      where: { passengerUserId: auth.sub },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        destinationAddress: true,
        finalPrice: true,
        estimatedPrice: true,
        status: true,
        createdAt: true,
        serviceType: true,
      },
    }),
  ]);

  const homePlace = savedPlaces.find((place) => place.kind === SavedPlaceKind.HOME) ?? null;
  const workPlace = savedPlaces.find((place) => place.kind === SavedPlaceKind.WORK) ?? null;
  const saved = savedPlaces.filter((place) => place.kind === SavedPlaceKind.SAVED);

  return {
    whereToLabel: "Where to?",
    userLocation: {
      lat: homePlace?.lat ?? 36.8065,
      lng: homePlace?.lng ?? 10.1815,
      address: homePlace?.address ?? "Position actuelle",
    },
    quickSuggestions: [
      "Aeroport Tunis-Carthage",
      "Centre Ville",
      "Lac 2",
      "La Marsa",
    ],
    recent: recentRides.map((ride) => ({
      id: ride.id,
      destination: ride.destinationAddress,
      status: ride.status,
      serviceType: ride.serviceType,
      amount: ride.finalPrice ?? ride.estimatedPrice,
      createdAt: ride.createdAt,
    })),
    shortcuts: {
      home: homePlace,
      work: workPlace,
      saved,
    },
  };
});

app.get("/rides/search", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const query = rideSearchQuerySchema.parse(request.query).query.toLowerCase();

  const staticPlaces = [
    { title: "Aeroport Tunis-Carthage", address: "Aeroport Tunis-Carthage", lat: 36.851, lng: 10.227 },
    { title: "Avenue Habib Bourguiba", address: "Centre Ville, Tunis", lat: 36.8015, lng: 10.1795 },
    { title: "La Marsa Plage", address: "La Marsa, Tunis", lat: 36.877, lng: 10.334 },
    { title: "Sidi Bou Said", address: "Sidi Bou Said", lat: 36.871, lng: 10.341 },
    { title: "Lac 2", address: "Berges du Lac 2", lat: 36.845, lng: 10.269 },
  ];

  const [savedPlaces, recentRides] = await Promise.all([
    prisma.savedPlace.findMany({
      where: { userId: auth.sub },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.ride.findMany({
      where: { passengerUserId: auth.sub },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        destinationAddress: true,
        destinationLat: true,
        destinationLng: true,
      },
    }),
  ]);

  const matches = [
    ...staticPlaces,
    ...savedPlaces.map((place) => ({
      title: place.label,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    })),
    ...recentRides.map((ride) => ({
      title: "Recent",
      address: ride.destinationAddress,
      lat: ride.destinationLat,
      lng: ride.destinationLng,
    })),
  ].filter((entry) => {
    const hay = `${entry.title} ${entry.address}`.toLowerCase();
    return hay.includes(query);
  });

  return {
    query,
    results: matches.slice(0, 15),
    favorites: savedPlaces.map((place) => ({
      id: place.id,
      label: place.label,
      kind: place.kind,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    })),
    recent: recentRides,
  };
});

app.get("/rides/options", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.CLIENT]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const query = rideOptionsQuerySchema.parse(request.query);
  const distanceKm = Number(
    calculateDistanceKm(
      query.pickupLat,
      query.pickupLng,
      query.destinationLat,
      query.destinationLng,
    ).toFixed(2),
  );

  const options = [
    rideServiceSnapshot(RideServiceType.UBER_X, distanceKm),
    rideServiceSnapshot(RideServiceType.COMFORT, distanceKm),
    rideServiceSnapshot(RideServiceType.BLACK, distanceKm),
    rideServiceSnapshot(RideServiceType.XL, distanceKm),
  ];

  return {
    distanceKm,
    options,
    paymentMethods: Object.values(PaymentMethodType),
  };
});

app.post("/rides/saved-places", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const body = savedPlaceSchema.parse(request.body);
  const place = await prisma.savedPlace.create({
    data: {
      userId: auth.sub,
      ...body,
    },
  });

  return reply.status(201).send(place);
});

app.get("/rides/history", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const rides = await prisma.ride.findMany({
    where:
      auth.role === UserRole.CLIENT
        ? { passengerUserId: auth.sub }
        : auth.role === UserRole.LIVREUR
          ? { driverUserId: auth.sub }
          : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rides;
});

app.post("/rides", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.CLIENT]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const body = createRideSchema.parse(request.body);
  const distanceKm = Number(
    calculateDistanceKm(
      body.pickupLat,
      body.pickupLng,
      body.destinationLat,
      body.destinationLng,
    ).toFixed(2),
  );
  const serviceSnapshot = rideServiceSnapshot(body.serviceType, distanceKm);

  const candidateCouriers = await prisma.courier.findMany({
    where: {
      isAvailable: true,
      user: {
        role: UserRole.LIVREUR,
        accessStatus: UserAccessStatus.ACTIVE,
      },
    },
    include: {
      user: true,
    },
    take: 30,
  });

  const selectedCourier =
    candidateCouriers
      .map((courier) => ({
        courier,
        distance: calculateDistanceKm(
          body.pickupLat,
          body.pickupLng,
          courier.lat,
          courier.lng,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.courier ?? null;

  const ride = await prisma.$transaction(async (tx) => {
    const created = await tx.ride.create({
      data: {
        passengerUserId: auth.sub,
        driverUserId: selectedCourier?.userId ?? null,
        status: selectedCourier ? RideStatus.ACCEPTED : RideStatus.PENDING,
        serviceType: body.serviceType,
        paymentMethodType: body.paymentMethodType,
        pickupAddress: body.pickupAddress,
        pickupLat: body.pickupLat,
        pickupLng: body.pickupLng,
        destinationAddress: body.destinationAddress,
        destinationLat: body.destinationLat,
        destinationLng: body.destinationLng,
        seats: body.seats,
        etaMinutes: serviceSnapshot.etaMinutes,
        distanceKm,
        estimatedPrice: serviceSnapshot.estimatedPrice,
        promoCode: body.promoCode,
        driverName: selectedCourier?.name ?? null,
        driverPhotoUrl:
          selectedCourier?.user?.email
            ? `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(
                selectedCourier.user.email,
              )}`
            : null,
        vehicleLabel: selectedCourier?.vehicle ?? null,
        vehiclePlate: selectedCourier ? `TN-${Math.floor(Math.random() * 9000 + 1000)}` : null,
        acceptedAt: selectedCourier ? new Date() : null,
        events: {
          create: [
            {
              status: RideStatus.PENDING,
              label: "Demande de course envoyee",
              lat: body.pickupLat,
              lng: body.pickupLng,
            },
            ...(selectedCourier
              ? [
                  {
                    status: RideStatus.ACCEPTED,
                    label: "Chauffeur assigne",
                    lat: selectedCourier.lat,
                    lng: selectedCourier.lng,
                  },
                ]
              : []),
          ],
        },
      },
      include: {
        passengerUser: {
          select: { id: true, name: true, email: true },
        },
        driverUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (selectedCourier) {
      await tx.courier.update({
        where: { id: selectedCourier.id },
        data: { isAvailable: false },
      });
    }

    return created;
  });

  await createUserNotification({
    userId: auth.sub,
    type: NotificationType.RIDE_STATUS,
    title: selectedCourier ? "Chauffeur assigne" : "Recherche chauffeur",
    body: selectedCourier
      ? `${ride.driverName ?? "Votre chauffeur"} arrive dans ${ride.etaMinutes} min`
      : "Nous recherchons un chauffeur disponible",
    payloadJson: JSON.stringify({ rideId: ride.id }),
  });

  if (ride.driverUserId) {
    await createUserNotification({
      userId: ride.driverUserId,
      type: NotificationType.RIDE_STATUS,
      title: "Nouvelle course",
      body: `Nouveau trajet vers ${ride.destinationAddress}`,
      payloadJson: JSON.stringify({ rideId: ride.id }),
    });
  }

  publishRideRefresh(ride.id, "ride_created");
  return reply.status(201).send(ride);
});

app.get("/rides/:rideId", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ rideId: z.string().cuid() }).parse(request.params);
  const ride = await prisma.ride.findUnique({
    where: { id: params.rideId },
    include: {
      events: {
        orderBy: { createdAt: "asc" },
      },
      passengerUser: {
        select: { id: true, name: true, email: true },
      },
      driverUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!ride) {
    return reply.status(404).send({ message: "Ride not found" });
  }

  if (!canAccessRide(ride, auth)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  return ride;
});

app.get("/rides/:rideId/tracking", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ rideId: z.string().cuid() }).parse(request.params);
  const ride = await prisma.ride.findUnique({
    where: { id: params.rideId },
    select: {
      id: true,
      status: true,
      pickupLat: true,
      pickupLng: true,
      pickupAddress: true,
      destinationLat: true,
      destinationLng: true,
      destinationAddress: true,
      etaMinutes: true,
      driverName: true,
      vehicleLabel: true,
      createdAt: true,
      acceptedAt: true,
      startedAt: true,
      passengerUserId: true,
      driverUserId: true,
    },
  });

  if (!ride) {
    return reply.status(404).send({ message: "Ride not found" });
  }

  if (!canAccessRide(ride, auth)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  return serializeRideTracking(ride);
});

app.patch("/rides/:rideId/cancel", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ rideId: z.string().cuid() }).parse(request.params);
  const body = rideCancelSchema.parse(request.body ?? {});
  const ride = await prisma.ride.findUnique({
    where: { id: params.rideId },
    select: {
      id: true,
      status: true,
      passengerUserId: true,
      driverUserId: true,
    },
  });

  if (!ride) {
    return reply.status(404).send({ message: "Ride not found" });
  }

  if (!canAccessRide(ride, auth)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  if (
    ride.status === RideStatus.COMPLETED ||
    ride.status === RideStatus.CANCELLED
  ) {
    return reply.status(400).send({ message: "Ride already finished" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.ride.update({
      where: { id: ride.id },
      data: {
        status: RideStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
    await tx.rideEvent.create({
      data: {
        rideId: ride.id,
        status: RideStatus.CANCELLED,
        label: body.reason ?? "Course annulee",
      },
    });

    if (ride.driverUserId) {
      await tx.courier.updateMany({
        where: { userId: ride.driverUserId },
        data: { isAvailable: true },
      });
    }
  });

  publishRideRefresh(ride.id, "ride_cancelled");
  return { id: ride.id, status: RideStatus.CANCELLED };
});

app.patch("/rides/:rideId/driver/status", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.LIVREUR]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ rideId: z.string().cuid() }).parse(request.params);
  const body = rideStatusPatchSchema.parse(request.body);

  const ride = await prisma.ride.findUnique({
    where: { id: params.rideId },
  });
  if (!ride) {
    return reply.status(404).send({ message: "Ride not found" });
  }

  if (ride.driverUserId !== auth.sub) {
    return reply.status(403).send({ message: "Ride not assigned to this driver" });
  }

  const validTransition =
    (ride.status === RideStatus.PENDING && body.status === RideStatus.ACCEPTED) ||
    (ride.status === RideStatus.ACCEPTED && body.status === RideStatus.ONGOING) ||
    (ride.status === RideStatus.ONGOING && body.status === RideStatus.COMPLETED);

  if (!validTransition) {
    return reply.status(400).send({ message: "Invalid ride status transition" });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.ride.update({
      where: { id: ride.id },
      data: {
        status: body.status,
        acceptedAt: body.status === RideStatus.ACCEPTED ? now : ride.acceptedAt,
        startedAt: body.status === RideStatus.ONGOING ? now : ride.startedAt,
        completedAt: body.status === RideStatus.COMPLETED ? now : ride.completedAt,
        finalPrice:
          body.status === RideStatus.COMPLETED
            ? Number((ride.finalPrice ?? ride.estimatedPrice).toFixed(2))
            : ride.finalPrice,
      },
    });

    await tx.rideEvent.create({
      data: {
        rideId: ride.id,
        status: body.status,
        label:
          body.status === RideStatus.ACCEPTED
            ? "Chauffeur en route"
            : body.status === RideStatus.ONGOING
              ? "Trajet en cours"
              : "Trajet termine",
      },
    });

    if (body.status === RideStatus.COMPLETED) {
      await tx.courier.updateMany({
        where: { userId: auth.sub },
        data: { isAvailable: true },
      });
    }
  });

  await createUserNotification({
    userId: ride.passengerUserId,
    type: NotificationType.RIDE_STATUS,
    title:
      body.status === RideStatus.ACCEPTED
        ? "Chauffeur arrive bientot"
        : body.status === RideStatus.ONGOING
          ? "Trajet demarre"
          : "Trajet termine",
    body:
      body.status === RideStatus.ACCEPTED
        ? "Votre chauffeur est en route."
        : body.status === RideStatus.ONGOING
          ? "Votre course est en cours."
          : "Merci d'avoir voyage avec nous.",
    payloadJson: JSON.stringify({ rideId: ride.id }),
  });

  publishRideRefresh(ride.id, "driver_status_update");
  return { id: ride.id, status: body.status };
});

app.get("/payments/methods", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const methods = await prisma.paymentMethod.findMany({
    where: { userId: auth.sub },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return methods;
});

app.post("/payments/methods", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const body = createPaymentMethodSchema.parse(request.body);
  const method = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.paymentMethod.updateMany({
        where: { userId: auth.sub, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.paymentMethod.create({
      data: {
        userId: auth.sub,
        type: body.type,
        label: body.label,
        last4: body.last4,
        isDefault: body.isDefault ?? false,
      },
    });
  });

  return reply.status(201).send(method);
});

app.post("/rides/:rideId/pay", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ rideId: z.string().cuid() }).parse(request.params);
  const body = payRideSchema.parse(request.body);

  const ride = await prisma.ride.findUnique({
    where: { id: params.rideId },
  });
  if (!ride) {
    return reply.status(404).send({ message: "Ride not found" });
  }
  if (ride.passengerUserId !== auth.sub && auth.role !== UserRole.SUPER_ADMIN) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  const existing = await prisma.paymentTransaction.findFirst({
    where: { rideId: ride.id, status: PaymentTransactionStatus.PAID },
  });
  if (existing) {
    return {
      paymentId: existing.id,
      rideId: ride.id,
      amount: existing.amount,
      status: existing.status,
      invoiceUrl: existing.invoiceUrl,
    };
  }

  const couponDiscounts: Record<string, number> = {
    SAVE10: 0.1,
    FIRST20: 0.2,
  };
  const rawPrice = ride.finalPrice ?? ride.estimatedPrice;
  const discountRate = body.couponCode
    ? couponDiscounts[body.couponCode.toUpperCase()] ?? 0
    : 0;
  const amount = Number((rawPrice * (1 - discountRate)).toFixed(2));
  const providerRef = `pay_${Math.random().toString(36).slice(2, 12)}`;
  const invoiceUrl = `https://example.com/invoices/${ride.id}.pdf`;

  const payment = await prisma.paymentTransaction.create({
    data: {
      userId: auth.sub,
      rideId: ride.id,
      amount,
      currency: ride.currency,
      provider: body.methodType,
      status: PaymentTransactionStatus.PAID,
      providerRef,
      paidAt: new Date(),
      invoiceUrl,
    },
  });

  await prisma.ride.update({
    where: { id: ride.id },
    data: {
      finalPrice: amount,
      paymentMethodType: body.methodType,
      promoCode: body.couponCode ?? ride.promoCode,
    },
  });

  return {
    paymentId: payment.id,
    rideId: ride.id,
    amount: payment.amount,
    status: payment.status,
    invoiceUrl: payment.invoiceUrl,
  };
});

app.get("/rides/:rideId/invoice", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ rideId: z.string().cuid() }).parse(request.params);
  const ride = await prisma.ride.findUnique({
    where: { id: params.rideId },
    select: {
      id: true,
      passengerUserId: true,
    },
  });
  if (!ride) {
    return reply.status(404).send({ message: "Ride not found" });
  }
  if (ride.passengerUserId !== auth.sub && auth.role !== UserRole.SUPER_ADMIN) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  const payment = await prisma.paymentTransaction.findFirst({
    where: { rideId: ride.id },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) {
    return reply.status(404).send({ message: "Invoice not found" });
  }

  return {
    rideId: ride.id,
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    invoiceUrl: payment.invoiceUrl,
    paidAt: payment.paidAt,
  };
});

app.get("/payments/history", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  return prisma.paymentTransaction.findMany({
    where:
      auth.role === UserRole.SUPER_ADMIN ? undefined : { userId: auth.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
});

app.get("/notifications", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const notifications = await prisma.userNotification.findMany({
    where: { userId: auth.sub },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unread = notifications.filter((item) => !item.readAt).length;
  return { unread, items: notifications };
});

app.patch("/notifications/:notificationId/read", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z
    .object({ notificationId: z.string().cuid() })
    .parse(request.params);
  const updated = await prisma.userNotification.updateMany({
    where: {
      id: params.notificationId,
      userId: auth.sub,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return { success: updated.count > 0 };
});

app.get("/support/faqs", async () => {
  return [
    {
      question: "Comment annuler une course ?",
      answer: "Ouvrez votre trajet en cours puis cliquez sur Annuler course.",
    },
    {
      question: "Comment payer en cash ?",
      answer: "Choisissez CASH dans l'ecran de paiement avant de confirmer.",
    },
    {
      question: "Comment signaler un probleme ?",
      answer: "Utilisez Support > Signaler un probleme pour ouvrir un ticket.",
    },
  ];
});

app.post("/support/tickets", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const body = createSupportTicketSchema.parse(request.body);
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: auth.sub,
      subject: body.subject,
      status: SupportTicketStatus.OPEN,
      messages: {
        create: {
          senderRole: auth.role,
          message: body.message,
        },
      },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return reply.status(201).send(ticket);
});

app.get("/support/tickets/me", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const tickets = await prisma.supportTicket.findMany({
    where: auth.role === UserRole.SUPER_ADMIN ? undefined : { userId: auth.sub },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return tickets;
});

app.post("/support/tickets/:ticketId/messages", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ ticketId: z.string().cuid() }).parse(request.params);
  const body = supportMessageSchema.parse(request.body);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.ticketId },
  });
  if (!ticket) {
    return reply.status(404).send({ message: "Ticket not found" });
  }
  if (ticket.userId !== auth.sub && auth.role !== UserRole.SUPER_ADMIN) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  const message = await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderRole: auth.role,
      message: body.message,
    },
  });

  if (auth.role !== UserRole.SUPER_ADMIN) {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: SupportTicketStatus.IN_PROGRESS },
    });
  }

  return reply.status(201).send(message);
});

app.get("/super-admin/users", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.SUPER_ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
});

app.patch("/super-admin/users/:userId/access-status", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.SUPER_ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ userId: z.string().cuid() }).parse(request.params);
  const body = adminUserStatusSchema.parse(request.body);

  const user = await prisma.user.update({
    where: { id: params.userId },
    data: { accessStatus: body.accessStatus },
  });

  return sanitizeUser(user);
});

app.get("/super-admin/analytics", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.SUPER_ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const today = startOfDay();
  const [ridesToday, ridesCompleted, ridesCancelled, usersActive, paymentsToday] =
    await Promise.all([
      prisma.ride.count({ where: { createdAt: { gte: today } } }),
      prisma.ride.count({ where: { status: RideStatus.COMPLETED, createdAt: { gte: today } } }),
      prisma.ride.count({ where: { status: RideStatus.CANCELLED, createdAt: { gte: today } } }),
      prisma.user.count({ where: { accessStatus: UserAccessStatus.ACTIVE } }),
      prisma.paymentTransaction.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: today }, status: PaymentTransactionStatus.PAID },
      }),
    ]);

  return {
    ridesToday,
    ridesCompleted,
    ridesCancelled,
    usersActive,
    paymentsToday: Number((paymentsToday._sum.amount ?? 0).toFixed(2)),
  };
});

app.get("/super-admin/logs", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.SUPER_ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const [latestRideEvents, latestOrderEvents] = await Promise.all([
    prisma.rideEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        ride: {
          select: {
            id: true,
            passengerUserId: true,
            driverUserId: true,
          },
        },
      },
    }),
    prisma.orderStatusEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            courierId: true,
          },
        },
      },
    }),
  ]);

  return {
    latestRideEvents,
    latestOrderEvents,
  };
});

app.get("/home", async () => {
  const stores = await prisma.store.findMany({
    include: {
      products: {
        where: {
          isPopular: true,
          isAvailable: true,
          stock: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          imageUrl: true,
        },
        take: 2,
      },
      adminUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ rating: "desc" }, { etaMinutes: "asc" }],
  });

  const categories = Array.from(new Set(stores.map((store) => store.category)));

  return {
    hero: {
      title: "Livraison ultra-rapide",
      subtitle: "Restaurants et courses en temps reel",
    },
    categories,
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      category: store.category,
      description: store.description,
      lat: store.lat,
      lng: store.lng,
      rating: store.rating,
      etaMinutes: store.etaMinutes,
      deliveryFee: store.deliveryFee,
      imageUrl: store.imageUrl,
      adminName: store.adminUser?.name ?? null,
      highlightProducts: store.products,
    })),
  };
});

app.get("/stores", async () => {
  const stores = await prisma.store.findMany({
    include: {
      products: {
        where: {
          isPopular: true,
          isAvailable: true,
          stock: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          imageUrl: true,
        },
        take: 3,
      },
      adminUser: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
  });

  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    category: store.category,
    description: store.description,
    lat: store.lat,
    lng: store.lng,
    rating: store.rating,
    etaMinutes: store.etaMinutes,
    deliveryFee: store.deliveryFee,
    imageUrl: store.imageUrl,
    adminName: store.adminUser?.name ?? null,
    productsPreview: store.products,
  }));
});

app.get("/stores/:storeId", async (request, reply) => {
  const params = z.object({ storeId: z.string().cuid() }).parse(request.params);

  const store = await prisma.store.findUnique({
    where: { id: params.storeId },
    include: {
      products: {
        where: {
          isAvailable: true,
          stock: { gt: 0 },
        },
        orderBy: [{ isPopular: "desc" }, { createdAt: "asc" }],
      },
      adminUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      couriers: {
        select: {
          id: true,
          name: true,
          vehicle: true,
          rating: true,
          isAvailable: true,
        },
      },
    },
  });

  if (!store) {
    return reply.status(404).send({ message: "Store not found" });
  }

  return store;
});

app.post("/orders", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.CLIENT]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const body = createOrderSchema.parse(request.body);
  let order: Prisma.OrderGetPayload<{ include: { store: true } }> | null = null;
  try {
    order = await prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({ where: { id: body.storeId } });
      if (!store) {
        throw new Error("STORE_NOT_FOUND");
      }

      const uniqueProductIds = [...new Set(body.items.map((item) => item.productId))];
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
          return runningTotal;
        }
        return runningTotal + product.price * item.quantity;
      }, 0);

      const requestedByProductId = body.items.reduce((accumulator, item) => {
        accumulator.set(
          item.productId,
          (accumulator.get(item.productId) ?? 0) + item.quantity,
        );
        return accumulator;
      }, new Map<string, number>());

      for (const [productId, requestedQuantity] of requestedByProductId.entries()) {
        const product = productsById.get(productId);
        if (!product) {
          throw new Error("INVALID_PRODUCTS");
        }

        if (!product.isAvailable || product.stock <= 0) {
          throw new Error(`PRODUCT_UNAVAILABLE:${product.name}`);
        }

        if (requestedQuantity > product.stock) {
          throw new Error(`PRODUCT_STOCK_LOW:${product.name}`);
        }
      }

      const deliveryFee = store.deliveryFee;
      const total = Number((subtotal + deliveryFee).toFixed(2));

      const createdOrder = await tx.order.create({
        data: {
          userId: auth.sub,
          storeId: store.id,
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
        },
      });

      for (const [productId, requestedQuantity] of requestedByProductId.entries()) {
        const product = productsById.get(productId)!;
        const remainingStock = product.stock - requestedQuantity;

        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: { decrement: requestedQuantity },
            isAvailable: remainingStock > 0 ? undefined : false,
          },
        });
      }

      return createdOrder;
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "STORE_NOT_FOUND") {
        return reply.status(404).send({ message: "Store not found" });
      }
      if (error.message === "INVALID_PRODUCTS") {
        return reply.status(400).send({ message: "Invalid products for store" });
      }
      if (error.message.startsWith("PRODUCT_UNAVAILABLE:")) {
        return reply
          .status(400)
          .send({
            message: `Produit indisponible: ${error.message.split(":")[1]}`,
          });
      }
      if (error.message.startsWith("PRODUCT_STOCK_LOW:")) {
        return reply
          .status(400)
          .send({
            message: `Stock insuffisant pour: ${error.message.split(":")[1]}`,
          });
      }
    }
    throw error;
  }

  if (!order) {
    return reply.status(500).send({ message: "Order creation failed" });
  }

  publishRealtime(order.id, order.storeId, "created");

  return reply.status(201).send({
    id: order.id,
    status: order.status,
    statusLabel: statusLabel(order.status),
    paymentStatus: order.paymentStatus,
    paymentRequired: true,
    etaMinutes: computeEtaMinutes(order),
    store: {
      id: order.store.id,
      name: order.store.name,
    },
    courier: null,
    totals: {
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
    },
  });
});

app.post("/orders/:orderId/pay", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);
  const body = payOrderSchema.parse(request.body ?? {});

  const orderMeta = await getOrderAccessMeta(params.orderId);
  if (!orderMeta) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (!canAccessOrder(orderMeta, auth)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  if (
    orderMeta.status === OrderStatus.CANCELLED ||
    orderMeta.status === OrderStatus.REFUSED
  ) {
    return reply.status(400).send({ message: "Order cannot be paid" });
  }

  if (orderMeta.paymentStatus === PaymentStatus.PAID) {
    return {
      orderId: orderMeta.id,
      paymentStatus: PaymentStatus.PAID,
      paymentIntentId: null,
      provider: body.provider,
      cardLast4: body.cardLast4 ?? null,
      status: orderMeta.status,
    };
  }

  const paymentIntentId = `pi_${Math.random().toString(36).slice(2, 12)}`;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderMeta.id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
        paymentIntentId,
      },
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId: orderMeta.id,
        status: orderMeta.status,
        label: "Paiement confirme - en attente de validation restaurant",
      },
    });
  });

  publishRealtime(orderMeta.id, orderMeta.storeId, "paid");

  return {
    orderId: orderMeta.id,
    paymentStatus: PaymentStatus.PAID,
    paymentIntentId,
    provider: body.provider,
    cardLast4: body.cardLast4 ?? null,
    status: orderMeta.status,
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
    select: {
      id: true,
      storeId: true,
      status: true,
    },
  });

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (body.status === "paid") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date(),
      },
    });
  } else if (body.status === "failed") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.FAILED,
      },
    });
  } else {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.REFUNDED,
      },
    });
  }

  publishRealtime(order.id, order.storeId, `webhook_${body.status}`);
  return { received: true };
});

app.get("/orders/:orderId", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);
  const orderMeta = await getOrderAccessMeta(params.orderId);

  if (!orderMeta) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (!canAccessOrder(orderMeta, auth)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  await syncOrderStatus(orderMeta.id);
  const order = await prisma.order.findUnique({
    where: { id: orderMeta.id },
    include: orderDetailsInclude,
  });

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  return serializeOrderDetails(order);
});

app.get("/orders/:orderId/tracking", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);
  const orderMeta = await getOrderAccessMeta(params.orderId);
  if (!orderMeta) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (!canAccessOrder(orderMeta, auth)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  await syncOrderStatus(orderMeta.id);
  const order = await prisma.order.findUnique({
    where: { id: orderMeta.id },
    include: trackingInclude,
  });

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  return serializeTracking(order);
});

app.post("/orders/:orderId/cancel", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);
  const orderMeta = await getOrderAccessMeta(params.orderId);
  if (!orderMeta) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (!canAccessOrder(orderMeta, auth)) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  if (
    orderMeta.status === OrderStatus.DELIVERED ||
    orderMeta.status === OrderStatus.CANCELLED ||
    orderMeta.status === OrderStatus.REFUSED
  ) {
    return reply.status(400).send({ message: "Order cannot be cancelled" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderMeta.id },
      data: {
        status: OrderStatus.CANCELLED,
        paymentStatus:
          orderMeta.paymentStatus === PaymentStatus.PAID
            ? PaymentStatus.REFUNDED
            : undefined,
      },
    });

    await restockOrderItems(tx, orderMeta.id);

    await tx.orderStatusEvent.create({
      data: {
        orderId: orderMeta.id,
        status: OrderStatus.CANCELLED,
        label: statusLabel(OrderStatus.CANCELLED),
      },
    });

    if (orderMeta.courierId) {
      await tx.courier.update({
        where: { id: orderMeta.courierId },
        data: { isAvailable: true },
      });
    }
  });

  publishRealtime(orderMeta.id, orderMeta.storeId, "cancelled");

  return {
    id: orderMeta.id,
    status: OrderStatus.CANCELLED,
    paymentStatus:
      orderMeta.paymentStatus === PaymentStatus.PAID
        ? PaymentStatus.REFUNDED
        : orderMeta.paymentStatus,
    statusLabel: statusLabel(OrderStatus.CANCELLED),
  };
});

app.get("/admin/dashboard", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  const stats = await computeStoreDashboard(store.id);

  return {
    store: {
      id: store.id,
      name: store.name,
      category: store.category,
    },
    stats,
  };
});

app.get("/admin/store", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await prisma.store.findUnique({
    where: { adminUserId: auth.sub },
    include: {
      products: {
        orderBy: [{ isAvailable: "desc" }, { isPopular: "desc" }, { createdAt: "asc" }],
      },
      couriers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ isAvailable: "desc" }, { rating: "desc" }],
      },
    },
  });

  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  return store;
});

app.get("/admin/orders", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      courier: {
        select: {
          id: true,
          name: true,
          vehicle: true,
          isAvailable: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return orders;
});

app.patch("/admin/orders/:orderId/decision", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);
  const body = adminDecisionSchema.parse(request.body);

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      courier: true,
    },
  });

  if (!order || order.storeId !== store.id) {
    return reply.status(404).send({ message: "Order not found for your store" });
  }

  if (body.decision === "accept") {
    if (order.status !== OrderStatus.PENDING) {
      return reply
        .status(400)
        .send({ message: "Order already processed by restaurant" });
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      return reply
        .status(400)
        .send({ message: "Order must be paid before acceptance" });
    }

    let selectedCourier = null as {
      id: string;
      storeId: string | null;
      isAvailable: boolean;
    } | null;

    if (body.courierId) {
      selectedCourier = await prisma.courier.findUnique({
        where: { id: body.courierId },
        select: {
          id: true,
          storeId: true,
          isAvailable: true,
        },
      });

      if (
        !selectedCourier ||
        selectedCourier.storeId !== store.id ||
        !selectedCourier.isAvailable
      ) {
        return reply.status(400).send({
          message: "Livreur invalide ou non disponible pour ce restaurant",
        });
      }
    } else {
      selectedCourier = await prisma.courier.findFirst({
        where: {
          storeId: store.id,
          isAvailable: true,
        },
        select: {
          id: true,
          storeId: true,
          isAvailable: true,
        },
        orderBy: { rating: "desc" },
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.ACCEPTED,
          acceptedAt: new Date(),
          adminNote: body.note,
          courierId: selectedCourier?.id ?? null,
        },
      });

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          status: OrderStatus.ACCEPTED,
          label: "Commande acceptee par le restaurant",
        },
      });

      if (selectedCourier) {
        await tx.courier.update({
          where: { id: selectedCourier.id },
          data: { isAvailable: false },
        });
      }
    });

    publishRealtime(order.id, store.id, "admin_accepted");

    return {
      id: order.id,
      status: OrderStatus.ACCEPTED,
      statusLabel: statusLabel(OrderStatus.ACCEPTED),
      courierId: selectedCourier?.id ?? null,
    };
  }

  if (
    order.status === OrderStatus.DELIVERED ||
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.REFUSED
  ) {
    return reply.status(400).send({ message: "Order cannot be refused anymore" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.REFUSED,
        refusedAt: new Date(),
        adminNote: body.note,
        paymentStatus:
          order.paymentStatus === PaymentStatus.PAID
            ? PaymentStatus.REFUNDED
            : order.paymentStatus,
      },
    });

    await restockOrderItems(tx, order.id);

    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: OrderStatus.REFUSED,
        label: statusLabel(OrderStatus.REFUSED),
      },
    });

    if (order.courierId) {
      await tx.courier.update({
        where: { id: order.courierId },
        data: { isAvailable: true },
      });
    }
  });

  publishRealtime(order.id, store.id, "admin_refused");

  return {
    id: order.id,
    status: OrderStatus.REFUSED,
    statusLabel: statusLabel(OrderStatus.REFUSED),
  };
});

app.get("/admin/products", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  return prisma.product.findMany({
    where: { storeId: store.id },
    orderBy: [{ isPopular: "desc" }, { createdAt: "asc" }],
  });
});

app.post("/admin/products", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  const body = createProductSchema.parse(request.body);

  const product = await prisma.product.create({
    data: {
      storeId: store.id,
      name: body.name,
      description: body.description,
      category: body.category,
      price: body.price,
      stock: body.stock,
      isAvailable: body.isAvailable ?? body.stock > 0,
      imageUrl: body.imageUrl,
      isPopular: body.isPopular ?? false,
    },
  });

  publishDashboardRefresh(store.id, "product_created");
  return reply.status(201).send(product);
});

app.patch("/admin/products/:productId", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  const params = z.object({ productId: z.string().cuid() }).parse(request.params);
  const body = patchProductSchema.parse(request.body);

  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: { id: true, storeId: true },
  });

  if (!product || product.storeId !== store.id) {
    return reply.status(404).send({ message: "Product not found for your store" });
  }

  const data: Prisma.ProductUpdateInput = { ...body };
  if (typeof body.stock === "number" && body.isAvailable === undefined) {
    data.isAvailable = body.stock > 0;
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data,
  });

  publishDashboardRefresh(store.id, "product_updated");
  return updated;
});

app.delete("/admin/products/:productId", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  const params = z.object({ productId: z.string().cuid() }).parse(request.params);

  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: { id: true, storeId: true },
  });

  if (!product || product.storeId !== store.id) {
    return reply.status(404).send({ message: "Product not found for your store" });
  }

  await prisma.product.delete({ where: { id: product.id } });
  publishDashboardRefresh(store.id, "product_deleted");
  return reply.status(204).send();
});

app.get("/admin/couriers", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  return prisma.courier.findMany({
    where: { storeId: store.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ isAvailable: "desc" }, { rating: "desc" }],
  });
});

app.post("/admin/couriers/associate", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  const body = associateCourierSchema.parse(request.body);
  const livreurUser = await prisma.user.findUnique({
    where: { id: body.livreurUserId },
  });

  if (!livreurUser || livreurUser.role !== UserRole.LIVREUR) {
    return reply.status(404).send({ message: "Livreur user introuvable" });
  }

  if (livreurUser.accessStatus !== UserAccessStatus.ACTIVE) {
    return reply.status(400).send({ message: "Livreur non actif" });
  }

  const existingCourier = await prisma.courier.findUnique({
    where: { userId: livreurUser.id },
  });

  if (existingCourier && existingCourier.storeId && existingCourier.storeId !== store.id) {
    return reply.status(409).send({
      message: "Ce livreur est deja associe a un autre restaurant",
    });
  }

  const courier = existingCourier
    ? await prisma.courier.update({
        where: { id: existingCourier.id },
        data: {
          storeId: store.id,
          name: livreurUser.name,
          vehicle: body.vehicle ?? livreurUser.requestedVehicle ?? existingCourier.vehicle,
          isAvailable: true,
        },
      })
    : await prisma.courier.create({
        data: {
          userId: livreurUser.id,
          storeId: store.id,
          name: livreurUser.name,
          rating: 4.7,
          vehicle: body.vehicle ?? livreurUser.requestedVehicle ?? "Scooter",
          lat: store.lat + (Math.random() - 0.5) * 0.01,
          lng: store.lng + (Math.random() - 0.5) * 0.01,
          isAvailable: true,
        },
      });

  publishDashboardRefresh(store.id, "courier_associated");
  return reply.status(201).send(courier);
});

app.patch("/admin/couriers/:courierId/availability", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const store = await getAdminStoreByUser(auth.sub);
  if (!store) {
    return reply.status(404).send({ message: "Admin store not configured" });
  }

  const params = z.object({ courierId: z.string().cuid() }).parse(request.params);
  const body = courierAvailabilitySchema.parse(request.body);

  const courier = await prisma.courier.findUnique({
    where: { id: params.courierId },
  });

  if (!courier || courier.storeId !== store.id) {
    return reply.status(404).send({ message: "Courier not found for your store" });
  }

  const updated = await prisma.courier.update({
    where: { id: courier.id },
    data: { isAvailable: body.isAvailable },
  });

  publishDashboardRefresh(store.id, "courier_availability_updated");
  return updated;
});

app.get("/super-admin/dashboard", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.SUPER_ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  return computeSuperAdminDashboard();
});

app.get("/super-admin/stores", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.SUPER_ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const stores = await prisma.store.findMany({
    include: {
      adminUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          products: true,
          orders: true,
          couriers: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return stores;
});

app.post("/super-admin/stores", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.SUPER_ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const body = createStoreSchema.parse(request.body);

  const store = await prisma.store.create({
    data: {
      name: body.name,
      category: body.category,
      description: body.description,
      etaMinutes: body.etaMinutes,
      deliveryFee: body.deliveryFee,
      imageUrl: body.imageUrl,
      lat: body.lat,
      lng: body.lng,
      rating: 4.5,
    },
  });

  return reply.status(201).send(store);
});

app.get("/super-admin/pending-users", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.SUPER_ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const users = await prisma.user.findMany({
    where: {
      accessStatus: UserAccessStatus.PENDING_APPROVAL,
      role: { in: [UserRole.ADMIN, UserRole.LIVREUR] },
    },
    orderBy: { createdAt: "asc" },
  });

  return users.map((user) => sanitizeUser(user));
});

app.patch("/super-admin/users/:userId/approval", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.SUPER_ADMIN]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ userId: z.string().cuid() }).parse(request.params);
  const body = superAdminApprovalSchema.parse(request.body);

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
  });

  if (!user) {
    return reply.status(404).send({ message: "User not found" });
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.LIVREUR) {
    return reply.status(400).send({ message: "User role is not approvable" });
  }

  if (body.action === "reject") {
    const rejected = await prisma.user.update({
      where: { id: user.id },
      data: { accessStatus: UserAccessStatus.REJECTED },
    });

    return {
      action: "rejected",
      user: sanitizeUser(rejected),
    };
  }

  if (user.role === UserRole.ADMIN) {
    let store =
      body.storeId !== undefined
        ? await prisma.store.findUnique({ where: { id: body.storeId } })
        : null;

    if (!store) {
      const storeName =
        body.storeName ?? user.requestedStoreName ?? `Restaurant ${user.name}`;
      store = await prisma.store.create({
        data: {
          name: storeName,
          category: "Restaurant",
          description: `Restaurant cree depuis workflow Super Admin (${storeName})`,
          rating: 4.5,
          etaMinutes: 30,
          deliveryFee: 2.9,
          imageUrl:
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
          lat: 36.8065,
          lng: 10.1815,
        },
      });
    }

    if (store.adminUserId && store.adminUserId !== user.id) {
      return reply.status(400).send({
        message: "Le store choisi a deja un Admin associe",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const approvedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          accessStatus: UserAccessStatus.ACTIVE,
        },
      });

      const assignedStore = await tx.store.update({
        where: { id: store.id },
        data: { adminUserId: user.id },
      });

      return { approvedUser, assignedStore };
    });

    publishDashboardRefresh(result.assignedStore.id, "admin_approved");

    return {
      action: "approved",
      user: sanitizeUser(result.approvedUser),
      store: {
        id: result.assignedStore.id,
        name: result.assignedStore.name,
      },
    };
  }

  if (!body.storeId) {
    return reply.status(400).send({
      message: "storeId est obligatoire pour approuver un Livreur",
    });
  }

  const store = await prisma.store.findUnique({
    where: { id: body.storeId },
  });

  if (!store) {
    return reply.status(404).send({ message: "Store not found" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const approvedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        accessStatus: UserAccessStatus.ACTIVE,
      },
    });

    const courier = await tx.courier.upsert({
      where: { userId: user.id },
      update: {
        storeId: store.id,
        name: user.name,
        vehicle: body.vehicle ?? user.requestedVehicle ?? "Scooter",
        isAvailable: true,
      },
      create: {
        userId: user.id,
        storeId: store.id,
        name: user.name,
        rating: 4.7,
        vehicle: body.vehicle ?? user.requestedVehicle ?? "Scooter",
        lat: store.lat + (Math.random() - 0.5) * 0.01,
        lng: store.lng + (Math.random() - 0.5) * 0.01,
        isAvailable: true,
      },
    });

    return { approvedUser, courier };
  });

  publishDashboardRefresh(store.id, "livreur_approved");

  return {
    action: "approved",
    user: sanitizeUser(result.approvedUser),
    courier: result.courier,
  };
});

app.get("/livreur/orders/me", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.LIVREUR]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const courier = await prisma.courier.findUnique({
    where: { userId: auth.sub },
    include: {
      store: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!courier) {
    return reply.status(404).send({ message: "Courier profile not found" });
  }

  const orders = await prisma.order.findMany({
    where: {
      courierId: courier.id,
      status: {
        in: [
          OrderStatus.ACCEPTED,
          OrderStatus.PREPARING,
          OrderStatus.PICKED_UP,
          OrderStatus.ON_THE_WAY,
          OrderStatus.DELIVERED,
        ],
      },
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    courier: {
      id: courier.id,
      name: courier.name,
      vehicle: courier.vehicle,
      isAvailable: courier.isAvailable,
      store: courier.store,
    },
    orders,
  };
});

app.patch("/livreur/orders/:orderId/status", async (request, reply) => {
  let auth: AuthTokenPayload;
  try {
    auth = (await getAuthFromRequest(request, {
      required: true,
      activeOnly: true,
    }))!;
    ensureRole(auth, [UserRole.LIVREUR]);
  } catch (error) {
    if (handleAuthError(error, reply)) {
      return;
    }
    throw error;
  }

  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);
  const body = livreurStatusSchema.parse(request.body);

  const courier = await prisma.courier.findUnique({
    where: { userId: auth.sub },
  });

  if (!courier) {
    return reply.status(404).send({ message: "Courier profile not found" });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      storeId: true,
      courierId: true,
      status: true,
      paymentStatus: true,
    },
  });

  if (!order || order.courierId !== courier.id) {
    return reply.status(404).send({ message: "Order not assigned to this courier" });
  }

  if (order.paymentStatus !== PaymentStatus.PAID) {
    return reply.status(400).send({ message: "Order must be paid first" });
  }

  const isValidTransition =
    ((order.status === OrderStatus.ACCEPTED ||
      order.status === OrderStatus.PREPARING) &&
      body.status === OrderStatus.PICKED_UP) ||
    (order.status === OrderStatus.PICKED_UP &&
      body.status === OrderStatus.ON_THE_WAY) ||
    (order.status === OrderStatus.ON_THE_WAY &&
      body.status === OrderStatus.DELIVERED);

  if (!isValidTransition) {
    return reply.status(400).send({ message: "Invalid status transition" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: body.status,
      },
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

  publishRealtime(order.id, order.storeId, "livreur_status_update");

  return {
    id: order.id,
    status: body.status,
    statusLabel: statusLabel(body.status),
  };
});

appAny.get(
  "/ws/rides/:rideId",
  { websocket: true },
  async (socket: WsLike, request: FastifyRequest) => {
    const paramsResult = z
      .object({ rideId: z.string().cuid() })
      .safeParse((request as FastifyRequest & { params: unknown }).params);

    if (!paramsResult.success) {
      sendSocket(socket, { type: "error", message: "Invalid rideId" });
      socket.close();
      return;
    }

    const queryResult = z
      .object({ token: z.string().min(20) })
      .safeParse((request as FastifyRequest & { query: unknown }).query);

    if (!queryResult.success) {
      sendSocket(socket, { type: "error", message: "Missing token" });
      socket.close();
      return;
    }

    let auth: AuthTokenPayload;
    try {
      auth = await verifyTokenString(queryResult.data.token);
      if (auth.accessStatus !== UserAccessStatus.ACTIVE) {
        throw new Error("inactive");
      }
    } catch {
      sendSocket(socket, { type: "error", message: "Invalid token" });
      socket.close();
      return;
    }

    const ride = await prisma.ride.findUnique({
      where: { id: paramsResult.data.rideId },
      select: {
        id: true,
        passengerUserId: true,
        driverUserId: true,
      },
    });

    if (!ride || !canAccessRide(ride, auth)) {
      sendSocket(socket, { type: "error", message: "Forbidden" });
      socket.close();
      return;
    }

    const rideId = paramsResult.data.rideId;
    const sockets = rideSockets.get(rideId) ?? new Set<WsLike>();
    sockets.add(socket);
    rideSockets.set(rideId, sockets);

    sendSocket(socket, {
      type: "connected",
      rideId,
      message: "Ride websocket connected",
    });

    const heartbeat = setInterval(() => {
      publishRideRefresh(rideId, "heartbeat");
    }, 5000);

    socket.on("close", () => {
      clearInterval(heartbeat);
      const current = rideSockets.get(rideId);
      if (!current) {
        return;
      }

      current.delete(socket);
      if (current.size === 0) {
        rideSockets.delete(rideId);
      }
    });
  },
);

appAny.get(
  "/ws/orders/:orderId",
  { websocket: true },
  async (socket: WsLike, request: FastifyRequest) => {
    const paramsResult = z
      .object({ orderId: z.string().cuid() })
      .safeParse((request as FastifyRequest & { params: unknown }).params);

    if (!paramsResult.success) {
      sendSocket(socket, { type: "error", message: "Invalid orderId" });
      socket.close();
      return;
    }

    const queryResult = z
      .object({ token: z.string().min(20) })
      .safeParse((request as FastifyRequest & { query: unknown }).query);

    if (!queryResult.success) {
      sendSocket(socket, { type: "error", message: "Missing token" });
      socket.close();
      return;
    }

    let auth: AuthTokenPayload;
    try {
      auth = await verifyTokenString(queryResult.data.token);
      if (auth.accessStatus !== UserAccessStatus.ACTIVE) {
        throw new Error("inactive");
      }
    } catch {
      sendSocket(socket, { type: "error", message: "Invalid token" });
      socket.close();
      return;
    }

    const orderMeta = await getOrderAccessMeta(paramsResult.data.orderId);
    if (!orderMeta || !canAccessOrder(orderMeta, auth)) {
      sendSocket(socket, { type: "error", message: "Forbidden" });
      socket.close();
      return;
    }

    const orderId = paramsResult.data.orderId;
    const sockets = orderSockets.get(orderId) ?? new Set<WsLike>();
    sockets.add(socket);
    orderSockets.set(orderId, sockets);

    sendSocket(socket, {
      type: "connected",
      orderId,
      message: "Order websocket connected",
    });

    const heartbeat = setInterval(async () => {
      await syncOrderStatus(orderId);
      publishOrderRefresh(orderId, "heartbeat");
    }, 7000);

    socket.on("close", () => {
      clearInterval(heartbeat);
      const current = orderSockets.get(orderId);
      if (!current) {
        return;
      }

      current.delete(socket);
      if (current.size === 0) {
        orderSockets.delete(orderId);
      }
    });
  },
);

appAny.get(
  "/ws/admin/dashboard",
  { websocket: true },
  async (socket: WsLike, request: FastifyRequest) => {
    const queryResult = z
      .object({
        token: z.string().min(20),
        storeId: z.string().cuid().optional(),
      })
      .safeParse((request as FastifyRequest & { query: unknown }).query);

    if (!queryResult.success) {
      sendSocket(socket, { type: "error", message: "Missing query token" });
      socket.close();
      return;
    }

    let auth: AuthTokenPayload;
    try {
      auth = await verifyTokenString(queryResult.data.token);
      if (auth.accessStatus !== UserAccessStatus.ACTIVE) {
        throw new Error("inactive");
      }
    } catch {
      sendSocket(socket, { type: "error", message: "Invalid token" });
      socket.close();
      return;
    }

    let storeId = queryResult.data.storeId ?? null;
    if (auth.role === UserRole.ADMIN) {
      const store = await getAdminStoreByUser(auth.sub);
      if (!store) {
        sendSocket(socket, { type: "error", message: "Admin store not configured" });
        socket.close();
        return;
      }
      storeId = store.id;
    } else if (auth.role !== UserRole.SUPER_ADMIN) {
      sendSocket(socket, { type: "error", message: "Forbidden" });
      socket.close();
      return;
    }

    if (!storeId) {
      sendSocket(socket, {
        type: "error",
        message: "storeId obligatoire pour websocket Super Admin",
      });
      socket.close();
      return;
    }

    const sockets = dashboardSockets.get(storeId) ?? new Set<WsLike>();
    sockets.add(socket);
    dashboardSockets.set(storeId, sockets);

    sendSocket(socket, {
      type: "connected",
      storeId,
      message: "Dashboard websocket connected",
    });

    const sendSnapshot = async () => {
      const stats = await computeStoreDashboard(storeId as string);
      sendSocket(socket, {
        type: "dashboard:snapshot",
        storeId,
        stats,
        at: new Date().toISOString(),
      });
    };

    await sendSnapshot();
    const heartbeat = setInterval(() => void sendSnapshot(), 10000);

    socket.on("close", () => {
      clearInterval(heartbeat);
      const current = dashboardSockets.get(storeId as string);
      if (!current) {
        return;
      }

      current.delete(socket);
      if (current.size === 0) {
        dashboardSockets.delete(storeId as string);
      }
    });
  },
);

app.listen({ port: PORT, host: HOST }).then(() => {
  app.log.info(`API v2 pro en ligne sur http://${HOST}:${PORT}`);
});
