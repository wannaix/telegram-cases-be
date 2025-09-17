import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateImages() {
  console.log('🚀 Начинаем миграцию изображений...');
  
  const oldDir = path.join(process.cwd(), 'public', 'images', 'cases');
  const newDir = path.join(process.cwd(), 'uploads', 'cases');
  
  try {
    // Создаем новую директорию если её нет
    await fs.mkdir(newDir, { recursive: true });
    
    // Получаем список файлов из старой директории
    const files = await fs.readdir(oldDir);
    console.log(`📁 Найдено ${files.length} файлов для миграции`);
    
    // Копируем файлы
    for (const file of files) {
      if (file.startsWith('.')) continue; // Пропускаем системные файлы
      
      const oldPath = path.join(oldDir, file);
      const newPath = path.join(newDir, file);
      
      try {
        await fs.copyFile(oldPath, newPath);
        console.log(`✅ Скопирован: ${file}`);
      } catch (error) {
        console.error(`❌ Ошибка копирования ${file}:`, error);
      }
    }
    
    // Обновляем пути в базе данных
    console.log('\n📊 Обновляем пути в базе данных...');
    
    // Обновляем пути для кейсов
    const cases = await prisma.case.findMany({
      where: {
        imageUrl: {
          contains: '/images/cases/'
        }
      }
    });
    
    for (const caseItem of cases) {
      if (caseItem.imageUrl) {
        const filename = path.basename(caseItem.imageUrl);
        const newUrl = `/uploads/cases/${filename}`;
        
        await prisma.case.update({
          where: { id: caseItem.id },
          data: { imageUrl: newUrl }
        });
        
        console.log(`📝 Обновлен путь для кейса "${caseItem.name}": ${newUrl}`);
      }
    }
    
    // Обновляем пути для предметов
    const items = await prisma.item.findMany({
      where: {
        imageUrl: {
          contains: '/images/'
        }
      }
    });
    
    console.log(`\n📦 Найдено ${items.length} предметов для обновления путей`);
    
    console.log('\n✨ Миграция завершена успешно!');
    console.log('📌 Файлы скопированы из /public/images/cases/ в /uploads/cases/');
    console.log('📌 Пути в базе данных обновлены');
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем миграцию
migrateImages();