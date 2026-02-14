import cors from "@fastify/cors";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { OrderStatus, PrismaClient } from "@prisma/client";
import Fastify from "fastify";
import { z } from "zod";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });
const app = Fastify({ logger: true });

const PORT = Number(process.env.PORT ?? 3333);
const HOST = process.env.HOST ?? "0.0.0.0";

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

function orderDurationMinutes(status: OrderStatus): number {
  switch (status) {
    case OrderStatus.PENDING:
      return 1;
    case OrderStatus.ACCEPTED:
      return 3;
    case OrderStatus.PREPARING:
      return 8;
    case OrderStatus.PICKED_UP:
      return 12;
    case OrderStatus.ON_THE_WAY:
      return 22;
    case OrderStatus.DELIVERED:
      return 22;
    case OrderStatus.CANCELLED:
      return 0;
    default:
      return 22;
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

async function syncOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      courierId: true,
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

  return nextStatus;
}

app.register(cors, { origin: true });

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
    service: "livraison-api",
    timestamp: new Date().toISOString(),
  };
});

app.post("/auth/guest", async (request) => {
  const body = createGuestSchema.parse(request.body ?? {});

  const user = await prisma.user.create({
    data: {
      name: body.name ?? `Client ${Math.floor(Math.random() * 900 + 100)}`,
      phone: body.phone,
    },
  });

  return {
    token: `guest-${user.id}`,
    user,
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

  try {
    const createdOrder = await prisma.$transaction(async (tx) => {
      let userId = body.userId;

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
          items: {
            include: {
              product: true,
            },
          },
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

    return reply.status(201).send({
      id: createdOrder.id,
      status: createdOrder.status,
      statusLabel: statusLabel(createdOrder.status),
      etaMinutes: orderDurationMinutes(createdOrder.status),
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

app.get("/orders/:orderId", async (request, reply) => {
  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);

  const status = await syncOrderStatus(params.orderId);
  if (!status) {
    return reply.status(404).send({ message: "Order not found" });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
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
    },
  });

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  const elapsedMinutes = (Date.now() - order.createdAt.getTime()) / 60000;
  const etaMinutes =
    order.status === OrderStatus.DELIVERED
      ? 0
      : Math.max(1, Math.round(22 - elapsedMinutes));

  return {
    id: order.id,
    status: order.status,
    statusLabel: statusLabel(order.status),
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
    etaMinutes,
    timeline: order.events.map((event) => ({
      id: event.id,
      status: event.status,
      label: event.label,
      timestamp: event.createdAt,
    })),
  };
});

app.get("/orders/:orderId/tracking", async (request, reply) => {
  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);

  const status = await syncOrderStatus(params.orderId);
  if (!status) {
    return reply.status(404).send({ message: "Order not found" });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      store: true,
      courier: true,
    },
  });

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

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

  const etaMinutes =
    order.status === OrderStatus.DELIVERED
      ? 0
      : Math.max(1, Math.round(22 - elapsedMinutes));

  return {
    orderId: order.id,
    status: order.status,
    statusLabel: statusLabel(order.status),
    etaMinutes,
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
});

app.post("/orders/:orderId/cancel", async (request, reply) => {
  const params = z.object({ orderId: z.string().cuid() }).parse(request.params);

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      status: true,
      courierId: true,
    },
  });

  if (!order) {
    return reply.status(404).send({ message: "Order not found" });
  }

  if (order.status === OrderStatus.CANCELLED) {
    return reply.status(400).send({ message: "Order already cancelled" });
  }

  if (order.status === OrderStatus.DELIVERED) {
    return reply.status(400).send({ message: "Delivered order cannot be cancelled" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED },
    });

    await tx.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: OrderStatus.CANCELLED,
        label: statusLabel(OrderStatus.CANCELLED),
      },
    });

    if (order.courierId) {
      await tx.courier.update({
        where: { id: order.courierId },
        data: { isAvailable: true },
      });
    }
  });

  return {
    id: order.id,
    status: OrderStatus.CANCELLED,
    statusLabel: statusLabel(OrderStatus.CANCELLED),
  };
});

app.listen({ port: PORT, host: HOST }).then(() => {
  app.log.info(`API en ligne sur http://${HOST}:${PORT}`);
});
