import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const caseImageMapping = {
  'Clown Case': '/images/cases/ClownCaseGiftomus.png',
  'Gold Case': '/images/cases/GoldCaseGiftomus.png',
  'Leonardo Case': '/images/cases/LeonardoCaseGiftomus.png',
  'Giftomus Cigara': '/images/cases/GiftomusCigara.png',
  'Giftomus Electro Skull': '/images/cases/GiftomusElectroSkull.png',
  'Giftomus Eyes': '/images/cases/GiftomusEyes.png',
  'Giftomus Peach Beer': '/images/cases/GiftomusPeachBeer.png',
  'Giftomus Telegram Hearts': '/images/cases/GiftomusTelegramHearts.png',
  'Giftomus Tort': '/images/cases/GiftomusTort.png',
  'Giftomus White Cap': '/images/cases/GiftomusWhiteCap.png',
};
async function updateCaseImages() {
  console.log("🖼️ Начинаем обновление изображений кейсов...");
  try {
    for (const [caseName, imageUrl] of Object.entries(caseImageMapping)) {
      const result = await prisma.case.updateMany({
        where: {
          name: caseName,
        },
        data: {
          imageUrl: imageUrl,
        },
      });
      if (result.count > 0) {
        console.log(`✅ Обновлен кейс: ${caseName} -> ${imageUrl}`);
      } else {
        console.log(`⚠️ Кейс не найден: ${caseName}`);
      }
    }
    console.log("🎉 Изображения кейсов успешно обновлены!");
  } catch (error) {
    console.error("❌ Ошибка при обновлении изображений:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
updateCaseImages();