import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const items = [
  {
    name: "Toncoin",
    rarity: 'RARE',
    type: 'STICKER',
    price: 5.0,
    imageUrl: "/uploads/cases/ton-case.png", 
  },
  {
    name: "Bitcoin",
    rarity: 'EPIC',
    type: 'STICKER',
    price: 60.0,
    imageUrl: "/uploads/cases/btc-case.png", 
  },
  {
    name: "Ethereum",
    rarity: 'EPIC',
    type: 'STICKER',
    price: 30.0,
    imageUrl: "/uploads/cases/eth-case.png", 
  },
  {
    name: "Dogecoin",
    rarity: 'UNCOMMON',
    type: 'STICKER',
    price: 2.0,
    imageUrl: "/uploads/cases/doge-case.png", 
  },
  {
    name: "Shiba Inu",
    rarity: 'UNCOMMON',
    type: 'STICKER',
    price: 1.0,
    imageUrl: "/uploads/cases/shib-case.png", 
  },
  {
    name: "Not Coin",
    rarity: 'LEGENDARY',
    type: 'MUSIC_KIT',
    price: 8.0,
    imageUrl: "/uploads/cases/not-case.png", 
  },
  {
    name: "Pepe",
    rarity: 'CONTRABAND',
    type: 'MUSIC_KIT',
    price: 15.0,
    imageUrl: "/uploads/cases/pepe-case.png", 
  },
  {
    name: "USDT Sticker",
    rarity: 'RARE',
    type: 'MUSIC_KIT',
    price: 1.0,
    imageUrl: "/uploads/cases/usdt-case.png", 
  },
  {
    name: "Solana",
    rarity: 'UNCOMMON',
    type: 'STICKER',
    price: 12.0,
    imageUrl: "/uploads/cases/sol-case.png", 
  },
  {
    name: "Cardano",
    rarity: 'RARE',
    type: 'STICKER',
    price: 7.0,
    imageUrl: "/uploads/cases/ada-case.png", 
  },
  {
    name: "Chainlink",
    rarity: 'ANCIENT',
    type: 'MUSIC_KIT',
    price: 25.0,
    imageUrl: "/uploads/cases/link-case.png", 
  },
  {
    name: "Mystery Box",
    rarity: 'RARE',
    type: 'CASE',
    price: 50.0,
    imageUrl: "/uploads/cases/mystery-box.png", 
  },
  {
    name: "Avalanche",
    rarity: 'LEGENDARY',
    type: 'MUSIC_KIT',
    price: 18.0,
    imageUrl: "/uploads/cases/avax-case.png", 
  },
  {
    name: "Polkadot",
    rarity: 'RARE',
    type: 'STICKER',
    price: 9.0,
    imageUrl: "/uploads/cases/dot-case.png", 
  },
  {
    name: "Litecoin",
    rarity: 'UNCOMMON',
    type: 'STICKER',
    price: 3.0,
    imageUrl: "/uploads/cases/ltc-case.png", 
  },
];
async function main() {
  console.log("🧹 Очистка базы данных...");
  await prisma.caseOpening.deleteMany();
  await prisma.caseItem.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.case.deleteMany();
  await prisma.item.deleteMany();
  console.log("✅ Кейсы и предметы очищены");
  await prisma.user.updateMany({
    data: {
      balance: 0,
      totalSpent: 0,
      totalWon: 0,
    },
  });
  console.log("💰 Тестовые балансы сброшены на 0");
  console.log("✅ Seed завершен! База готова для создания кейсов через админку");
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });