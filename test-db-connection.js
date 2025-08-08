import { PrismaClient } from "@prisma/client";

async function testConnection() {
  const prisma = new PrismaClient();

  try {
    console.log("🔄 Testando conexão com o banco de dados Supabase...");

    // Testa a conexão básica
    await prisma.$connect();
    console.log("✅ Conexão estabelecida com sucesso!");

    // Testa uma query simples
    const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
    console.log("✅ Query de teste executada:", result);

    // Verifica se as tabelas existem
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log("✅ Tabelas encontradas:", tables);

    // Testa se consegue contar registros nas tabelas principais
    try {
      const eventCount = await prisma.event.count();
      console.log(`✅ Eventos na base: ${eventCount}`);

      const registrationCount = await prisma.registration.count();
      console.log(`✅ Inscrições na base: ${registrationCount}`);
    } catch (tableError) {
      console.log(
        "⚠️  Tabelas podem não existir ainda. Execute as migrações:",
        tableError.message
      );
    }
  } catch (error) {
    console.error("❌ Erro na conexão:", error.message);
    console.error("Detalhes do erro:", error);
  } finally {
    await prisma.$disconnect();
    console.log("🔌 Conexão fechada");
  }
}

testConnection();
