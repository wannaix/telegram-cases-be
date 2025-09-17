import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addImageBase64Field() {
  try {
    console.log('Добавляем поле imageBase64 в таблицу cases...');
    
    await prisma.$executeRaw`ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "imageBase64" TEXT`;
    
    console.log('✓ Поле imageBase64 успешно добавлено');
  } catch (error) {
    console.error('Ошибка при добавлении поля:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addImageBase64Field();