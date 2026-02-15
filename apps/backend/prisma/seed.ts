import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, UserAccessStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const superAdminPassword =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin123!";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
const clientPassword = process.env.SEED_CUSTOMER_PASSWORD ?? "Client123!";
const livreurPassword = process.env.SEED_LIVREUR_PASSWORD ?? "Livreur123!";

const storesSeed = [
  {
    key: "burger-studio",
    name: "Burger Studio",
    adminName: "Admin Burger Studio",
    adminEmail: "admin.burger@livraisonpro.app",
    category: "Burgers",
    description: "Smash burgers premium, sauces maison et sides croustillants.",
    rating: 4.8,
    etaMinutes: 28,
    deliveryFee: 2.5,
    imageUrl:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80",
    lat: 36.8065,
    lng: 10.1815,
    products: [
      {
        name: "Double Smash Classic",
        description: "Pain brioché, double steak, cheddar, pickles.",
        price: 13.9,
        imageUrl:
          "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80",
        isPopular: true,
      },
      {
        name: "Truffle Burger",
        description: "Crème truffe, roquette, parmesan.",
        price: 15.5,
        imageUrl:
          "https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=1200&q=80",
        isPopular: true,
      },
      {
        name: "Loaded Fries",
        description: "Frites cheddar, bacon croustillant et sauce smoky.",
        price: 6.2,
        imageUrl:
          "https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=1200&q=80",
        isPopular: false,
      },
    ],
  },
  {
    key: "sushi-lab",
    name: "Sushi Lab",
    adminName: "Admin Sushi Lab",
    adminEmail: "admin.sushi@livraisonpro.app",
    category: "Sushi",
    description: "Maki signatures, bowls et sashimi ultra frais.",
    rating: 4.7,
    etaMinutes: 32,
    deliveryFee: 3.1,
    imageUrl:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80",
    lat: 36.81,
    lng: 10.176,
    products: [
      {
        name: "Dragon Roll",
        description: "Crevette tempura, avocat, sauce teriyaki.",
        price: 14.8,
        imageUrl:
          "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?auto=format&fit=crop&w=1200&q=80",
        isPopular: true,
      },
      {
        name: "Salmon Bowl",
        description: "Riz vinaigré, saumon, edamame, wakame.",
        price: 12.4,
        imageUrl:
          "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=1200&q=80",
        isPopular: true,
      },
      {
        name: "Miso Soup",
        description: "Bouillon miso, tofu soyeux, ciboule.",
        price: 4.5,
        imageUrl:
          "https://images.unsplash.com/photo-1601315488950-3b5047998b38?auto=format&fit=crop&w=1200&q=80",
        isPopular: false,
      },
    ],
  },
  {
    key: "daily-market",
    name: "Daily Market",
    adminName: "Admin Daily Market",
    adminEmail: "admin.market@livraisonpro.app",
    category: "Courses",
    description: "Courses express, fruits frais et essentials maison.",
    rating: 4.6,
    etaMinutes: 22,
    deliveryFee: 1.9,
    imageUrl:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80",
    lat: 36.8,
    lng: 10.17,
    products: [
      {
        name: "Panier Fruits Mix",
        description: "Fraises, bananes, pommes et kiwi.",
        price: 9.9,
        imageUrl:
          "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1200&q=80",
        isPopular: true,
      },
      {
        name: "Pack Petit Déj",
        description: "Lait, céréales, jus d'orange et pain complet.",
        price: 11.2,
        imageUrl:
          "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
        isPopular: false,
      },
      {
        name: "Snack Box",
        description: "Noix, crackers et barres énergétiques.",
        price: 7.6,
        imageUrl:
          "https://images.unsplash.com/photo-1505253716362-afaea6f8f34f?auto=format&fit=crop&w=1200&q=80",
        isPopular: true,
      },
    ],
  },
] as const;

const livreursSeed = [
  {
    name: "Amir",
    email: "amir.livreur@livraisonpro.app",
    rating: 4.9,
    vehicle: "Scooter",
    storeKey: "burger-studio",
    lat: 36.809,
    lng: 10.179,
  },
  {
    name: "Nour",
    email: "nour.livreur@livraisonpro.app",
    rating: 4.8,
    vehicle: "Velo",
    storeKey: "sushi-lab",
    lat: 36.802,
    lng: 10.168,
  },
  {
    name: "Youssef",
    email: "youssef.livreur@livraisonpro.app",
    rating: 4.7,
    vehicle: "Moto",
    storeKey: "daily-market",
    lat: 36.813,
    lng: 10.173,
  },
] as const;

async function main() {
  await prisma.orderStatusEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.user.deleteMany();

  const [superAdminHash, adminHash, clientHash, livreurHash] = await Promise.all([
    bcrypt.hash(superAdminPassword, 12),
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash(clientPassword, 12),
    bcrypt.hash(livreurPassword, 12),
  ]);

  await prisma.user.create({
    data: {
      name: "Super Admin Global",
      email: "superadmin@livraisonpro.app",
      passwordHash: superAdminHash,
      role: UserRole.SUPER_ADMIN,
      accessStatus: UserAccessStatus.ACTIVE,
      phone: "+216 99 900 900",
    },
  });

  await prisma.user.create({
    data: {
      name: "Client Demo",
      email: "client@livraisonpro.app",
      passwordHash: clientHash,
      role: UserRole.CLIENT,
      accessStatus: UserAccessStatus.ACTIVE,
      phone: "+216 99 000 000",
    },
  });

  const storesByKey = new Map<string, { id: string; lat: number; lng: number }>();

  for (const storeSeed of storesSeed) {
    const adminUser = await prisma.user.create({
      data: {
        name: storeSeed.adminName,
        email: storeSeed.adminEmail,
        passwordHash: adminHash,
        role: UserRole.ADMIN,
        accessStatus: UserAccessStatus.ACTIVE,
        requestedStoreName: storeSeed.name,
      },
    });

    const store = await prisma.store.create({
      data: {
        adminUserId: adminUser.id,
        name: storeSeed.name,
        category: storeSeed.category,
        description: storeSeed.description,
        rating: storeSeed.rating,
        etaMinutes: storeSeed.etaMinutes,
        deliveryFee: storeSeed.deliveryFee,
        imageUrl: storeSeed.imageUrl,
        lat: storeSeed.lat,
        lng: storeSeed.lng,
      },
    });

    await prisma.product.createMany({
      data: storeSeed.products.map((product) => ({
        storeId: store.id,
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.imageUrl,
        isPopular: product.isPopular,
      })),
    });

    storesByKey.set(storeSeed.key, {
      id: store.id,
      lat: storeSeed.lat,
      lng: storeSeed.lng,
    });
  }

  for (const livreurSeed of livreursSeed) {
    const store = storesByKey.get(livreurSeed.storeKey);
    if (!store) {
      throw new Error(`Store introuvable: ${livreurSeed.storeKey}`);
    }

    const livreurUser = await prisma.user.create({
      data: {
        name: livreurSeed.name,
        email: livreurSeed.email,
        passwordHash: livreurHash,
        role: UserRole.LIVREUR,
        accessStatus: UserAccessStatus.ACTIVE,
        requestedVehicle: livreurSeed.vehicle,
      },
    });

    await prisma.courier.create({
      data: {
        userId: livreurUser.id,
        storeId: store.id,
        name: livreurSeed.name,
        rating: livreurSeed.rating,
        vehicle: livreurSeed.vehicle,
        lat: livreurSeed.lat,
        lng: livreurSeed.lng,
        isAvailable: true,
      },
    });
  }

  await prisma.user.create({
    data: {
      name: "Candidat Admin Pasta House",
      email: "request.admin@livraisonpro.app",
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      accessStatus: UserAccessStatus.PENDING_APPROVAL,
      requestedStoreName: "Pasta House",
    },
  });

  await prisma.user.create({
    data: {
      name: "Candidat Livreur Sami",
      email: "request.livreur@livraisonpro.app",
      passwordHash: livreurHash,
      role: UserRole.LIVREUR,
      accessStatus: UserAccessStatus.PENDING_APPROVAL,
      requestedVehicle: "Moto",
    },
  });

  console.log("Comptes seed V2 Pro:");
  console.log("Super Admin: superadmin@livraisonpro.app /", superAdminPassword);
  console.log("Admins restaurants: admin.*@livraisonpro.app /", adminPassword);
  console.log("Client: client@livraisonpro.app /", clientPassword);
  console.log("Livreurs: *.livreur@livraisonpro.app /", livreurPassword);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed backend termine avec succes.");
  })
  .catch(async (error) => {
    console.error("Erreur seed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
