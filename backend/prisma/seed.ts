import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, UserAccessStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

const superAdminPassword =
  process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin123!";

async function main() {
  await prisma.supportMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.userNotification.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.rideEvent.deleteMany();
  await prisma.ride.deleteMany();
  await prisma.savedPlace.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.orderStatusEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();

  const superAdminHash = await bcrypt.hash(superAdminPassword, 12);

  await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "superadmin@livraisonpro.app",
      passwordHash: superAdminHash,
      role: UserRole.SUPER_ADMIN,
      accessStatus: UserAccessStatus.ACTIVE,
      phone: "+216 99 900 900",
    },
  });

  console.log("Seed real-mode:");
  console.log("Super Admin: superadmin@livraisonpro.app /", superAdminPassword);
  console.log("Aucun autre compte n'est pre-cree.");
  console.log("Cree tes comptes via Sign Up (Client/Admin/Livreur).");
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
