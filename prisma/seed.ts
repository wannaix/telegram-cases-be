import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Очистка базы данных...');
  
  // Очистка в правильном порядке (удаляем только данные кейсов и предметов)
  await prisma.caseOpening.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.caseItem.deleteMany();
  await prisma.item.deleteMany();
  await prisma.case.deleteMany();
  // НЕ удаляем пользователей и транзакции
  
  console.log('✅ Кейсы и предметы очищены');
  
  // Сбрасываем тестовые балансы на 0
  await prisma.user.updateMany({
    where: {
      balance: 1000, // Только тестовые балансы
    },
    data: {
      balance: 0,
    }
  });
  
  console.log('💰 Тестовые балансы сброшены на 0');
  
  console.log('✅ Seed завершен! База готова для создания кейсов через админку');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });