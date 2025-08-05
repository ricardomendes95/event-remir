import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../backend/utils/password";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...");

  // Dados do admin padrão
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@eventremir.com";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
  const adminName = process.env.DEFAULT_ADMIN_NAME || "Administrador";

  // Verificar se admin já existe
  const existingAdmin = await prisma.admin.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`✅ Admin já existe: ${adminEmail}`);
  } else {
    // Criar usuário admin
    const hashedPassword = await hashPassword(adminPassword);

    const admin = await prisma.admin.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
      },
    });

    console.log(`✅ Admin criado: ${admin.email}`);
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Senha: ${adminPassword}`);
  }

  console.log("🎉 Seed concluído!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
