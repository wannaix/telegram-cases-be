import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { CasesEngine, Dispersion } from "../services/casesEngine.js";
import type { ItemDistribution } from "../services/casesEngine.js";
export interface CaseOpenResult {
  itemId: string;
  item: {
    id: string;
    name: string;
    rarity: string;
    type: string;
    price: number;
    imageUrl?: string;
  };
  profit: number;
}
export async function openCase(
  caseId: string,
  userId: string
): Promise<CaseOpenResult> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      items: {
        include: {
          item: true,
        },
      },
    },
  });
  if (!caseData || !caseData.isActive) {
    throw new Error("Case not found or inactive");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user || user.balance < caseData.price) {
    throw new Error("Insufficient balance");
  }
  const casesEngine = new CasesEngine();
  const selectedItem = await selectRandomItemAdvanced(casesEngine, caseData);
  if (!selectedItem) {
    throw new Error("No items in case");
  }
  const profit = selectedItem.item.price - caseData.price;
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: { decrement: caseData.price },
        totalSpent: { increment: caseData.price },
        totalWon: { increment: selectedItem.item.price },
      },
    });
    await tx.caseOpening.create({
      data: {
        userId,
        caseId,
        itemId: selectedItem.itemId,
        pricePaid: caseData.price,
        itemValue: selectedItem.item.price,
        profit,
      },
    });
    await tx.inventoryItem.upsert({
      where: {
        userId_itemId: {
          userId,
          itemId: selectedItem.itemId,
        },
      },
      update: {
        quantity: { increment: 1 },
      },
      create: {
        userId,
        itemId: selectedItem.itemId,
        quantity: 1,
      },
    });
    await tx.transaction.create({
      data: {
        userId,
        type: "CASE_OPENING",
        amount: -caseData.price,
        description: `Opened ${caseData.name}`,
      },
    });
    return {
      itemId: selectedItem.itemId,
      item: selectedItem.item,
      profit,
    };
  });
  return result;
}
async function selectRandomItemAdvanced(casesEngine: CasesEngine, caseData: any): Promise<any> {
  if (!caseData.items || caseData.items.length === 0) {
    throw new Error("Case has no items");
  }
  if (caseData.items.length < 6) {
    return selectRandomItemSimple(caseData.items);
  }
  try {
    const itemPrices = caseData.items.map((item: any) => item.item.price);
    const maxPrice = Math.max(...itemPrices);
    const maxCoefficient = maxPrice / caseData.price;
    const [smallDisp, mediumDisp, highDisp] = casesEngine.getCase(
      caseData.price, 
      maxCoefficient, 
      caseData.items.length
    );
    const dispersions = [smallDisp, mediumDisp, highDisp];
    const dispersionWeights = [0.6, 0.3, 0.1]; 
    const selectedDispersion = selectByWeight(dispersions, dispersionWeights);
    const realItemsDistribution = mapRealItemsToDistribution(caseData.items, selectedDispersion);
    const dispersionType = dispersions.indexOf(selectedDispersion) === 0 ? Dispersion.Small :
                          dispersions.indexOf(selectedDispersion) === 1 ? Dispersion.Medium : Dispersion.High;
    const [recalculated, finalDistribution] = casesEngine.recalculateCase(
      caseData.price,
      maxCoefficient,
      dispersionType,
      realItemsDistribution
    );
    if (!recalculated || finalDistribution.length === 0) {
      console.warn('Advanced case opening failed, falling back to simple logic');
      return selectRandomItemSimple(caseData.items);
    }
    const wonValue = casesEngine.openCase(finalDistribution);
    return findClosestItemByValue(caseData.items, wonValue);
  } catch (error) {
    console.error('Error in advanced case opening:', error);
    return selectRandomItemSimple(caseData.items);
  }
}
function selectRandomItemSimple(caseItems: any[]): any {
  let totalChance = 0;
  const chances = caseItems.map((caseItem) => {
    totalChance += caseItem.dropChance;
    return {
      ...caseItem,
      cumulativeChance: totalChance,
    };
  });
  const random = Math.random() * 100;
  return chances.find((item) => random <= item.cumulativeChance);
}
function selectByWeight<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const random = Math.random() * totalWeight;
  let currentWeight = 0;
  for (let i = 0; i < items.length; i++) {
    currentWeight += weights[i];
    if (random <= currentWeight) {
      return items[i];
    }
  }
  return items[items.length - 1];
}
function mapRealItemsToDistribution(caseItems: any[], engineDistribution: ItemDistribution[]): ItemDistribution[] {
  return engineDistribution.map((distItem, index) => {
    const realItem = caseItems[index % caseItems.length];
    return {
      ...distItem,
      value: realItem.item.price,
    };
  });
}
function findClosestItemByValue(caseItems: any[], targetValue: number): any {
  let closestItem = caseItems[0];
  let minDifference = Math.abs(closestItem.item.price - targetValue);
  for (const caseItem of caseItems) {
    const difference = Math.abs(caseItem.item.price - targetValue);
    if (difference < minDifference) {
      minDifference = difference;
      closestItem = caseItem;
    }
  }
  return closestItem;
}
export async function getUserStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      balance: true,
      totalSpent: true,
      totalWon: true,
    },
  });
  const openingsCount = await prisma.caseOpening.count({
    where: { userId },
  });
  const inventoryCount = await prisma.inventoryItem.aggregate({
    where: { userId },
    _sum: { quantity: true },
  });
  return {
    balance: user?.balance || 0,
    totalSpent: user?.totalSpent || 0,
    totalWon: user?.totalWon || 0,
    openingsCount,
    itemsCount: inventoryCount._sum.quantity || 0,
    profit: (user?.totalWon || 0) - (user?.totalSpent || 0),
  };
}
