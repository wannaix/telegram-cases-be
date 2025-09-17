import { PrismaClient } from '@prisma/client';

// Для production используем DATABASE_URL из переменных окружения
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Подключение к production базе данных...');
  console.log('📍 DATABASE_URL:', process.env.DATABASE_URL ? 'Установлен' : 'Не установлен');
  
  try {
    // Проверяем подключение
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Подключение успешно');
  } catch (error) {
    console.error('❌ Ошибка подключения:', error);
    process.exit(1);
  }
  
  console.log('🧹 Очистка production базы данных...');
  
  // Очистка только данных кейсов и предметов (сохраняем пользователей)
  await prisma.caseOpening.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.caseItem.deleteMany();
  await prisma.item.deleteMany();
  await prisma.case.deleteMany();
  // НЕ удаляем пользователей, транзакции и админские данные!
  
  console.log('✅ Кейсы и предметы очищены (пользователи сохранены)');
  
  // Сбрасываем тестовые балансы на 0
  const updatedUsers = await prisma.user.updateMany({
    where: {
      balance: 1000, // Только тестовые балансы
    },
    data: {
      balance: 0,
    }
  });
  
  console.log(`💰 Сброшено тестовых балансов: ${updatedUsers.count}`);
  
  console.log('✅ Production база готова!');
  console.log('📝 Теперь можно создавать кейсы и NFT предметы через админку');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });