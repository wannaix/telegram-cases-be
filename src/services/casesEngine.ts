import crypto from 'crypto';
function randomFloat(min: number, max: number, base: number = 1000000000): number {
  const minInt = Math.floor(min * base);
  const maxInt = Math.floor(max * base);
  const randomBytes = crypto.randomBytes(4);
  const randomInt = randomBytes.readUInt32BE(0);
  const scaledRandom = (randomInt / 0xFFFFFFFF) * (maxInt - minInt) + minInt;
  return scaledRandom / base;
}
function randomFloatExclusive(min: number, max: number, base: number = 1000000000): number {
  const minInt = Math.floor(min * base);
  const maxInt = Math.floor(max * base);
  const randomBytes = crypto.randomBytes(4);
  const randomInt = randomBytes.readUInt32BE(0);
  const scaledRandom = (randomInt / 0xFFFFFFFF) * (maxInt - minInt - 1) + minInt + 1;
  return scaledRandom / base;
}
enum Dispersion {
  Small = 'Small',
  Medium = 'Medium',
  High = 'High'
}
interface ItemDistribution {
  value: number;
  'lower_bound(>)': number;
  'upper_bound(<=)': number;
  segment: number;
  probability: number;
}
interface SegmentRules {
  cheap_part: {
    min_deviation: number;
    max_deviation: number;
  };
  expensive_part: {
    min_deviation: {
      max_coefficient_splitter: number;
      above: { fixed: number; part: number };
      less: { fixed: number; part: number };
    };
    max_deviation: {
      max_coefficient_splitter: number;
      above: { fixed: number; part: number };
      less: { fixed: number; part: number };
    };
  };
  percentage: {
    small_dispersion: number;
    medium_dispersion: number;
    high_dispersion: number;
  };
}
interface Segment {
  cheap_part: {
    min_deviation: number;
    max_deviation: number;
  };
  expensive_part: {
    min_deviation: number;
    max_deviation: number;
  };
  percentage: number;
}
export class CasesEngine {
  private static readonly ACCURACY = 1e-10;
  private static readonly RTP = 0.9; 
  private static readonly ITEMS_PRICE_SEGMENTS_RULES: Record<number, SegmentRules> = {
    0: {
      cheap_part: { min_deviation: 0, max_deviation: 0.2 },
      expensive_part: {
        min_deviation: {
          max_coefficient_splitter: 0,
          above: { fixed: 0, part: 0 },
          less: { fixed: 0, part: 0 }
        },
        max_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 0.2, part: 0 },
          less: { fixed: 0, part: 0.15 }
        }
      },
      percentage: { small_dispersion: 0.25, medium_dispersion: 0.1, high_dispersion: 0.05 }
    },
    1: {
      cheap_part: { min_deviation: 0.2, max_deviation: 0.35 },
      expensive_part: {
        min_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 0.2, part: 0 },
          less: { fixed: 0, part: 0.15 }
        },
        max_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 0.35, part: 0 },
          less: { fixed: 0, part: 0.3 }
        }
      },
      percentage: { small_dispersion: 0.3, medium_dispersion: 0.2, high_dispersion: 0.15 }
    },
    2: {
      cheap_part: { min_deviation: 0.35, max_deviation: 0.45 },
      expensive_part: {
        min_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 0.35, part: 0 },
          less: { fixed: 0, part: 0.3 }
        },
        max_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 0.5, part: 0 },
          less: { fixed: 0, part: 0.45 }
        }
      },
      percentage: { small_dispersion: 0.2, medium_dispersion: 0.25, high_dispersion: 0.15 }
    },
    3: {
      cheap_part: { min_deviation: 0.45, max_deviation: 0.5 },
      expensive_part: {
        min_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 0.5, part: 0 },
          less: { fixed: 0, part: 0.45 }
        },
        max_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 1.0, part: 0 },
          less: { fixed: 0, part: 0.6 }
        }
      },
      percentage: { small_dispersion: 0.05, medium_dispersion: 0.15, high_dispersion: 0.2 }
    },
    4: {
      cheap_part: { min_deviation: 0.5, max_deviation: 0.55 },
      expensive_part: {
        min_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 1.0, part: 0 },
          less: { fixed: 0, part: 0.6 }
        },
        max_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 1.0, part: 0.25 },
          less: { fixed: 0, part: 0.75 }
        }
      },
      percentage: { small_dispersion: 0.05, medium_dispersion: 0.1, high_dispersion: 0.15 }
    },
    5: {
      cheap_part: { min_deviation: 0.55, max_deviation: 0.6 },
      expensive_part: {
        min_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 1.0, part: 0.25 },
          less: { fixed: 0, part: 0.75 }
        },
        max_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 1.0, part: 0.5 },
          less: { fixed: 0, part: 0.85 }
        }
      },
      percentage: { small_dispersion: 0.05, medium_dispersion: 0.1, high_dispersion: 0.1 }
    },
    6: {
      cheap_part: { min_deviation: 0.6, max_deviation: 0.65 }, 
      expensive_part: {
        min_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 1.0, part: 0.5 },
          less: { fixed: 0, part: 0.85 }
        },
        max_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 1.0, part: 0.75 },
          less: { fixed: 0, part: 0.95 }
        }
      },
      percentage: { small_dispersion: 0.05, medium_dispersion: 0.05, high_dispersion: 0.1 }
    },
    7: {
      cheap_part: { min_deviation: 0.65, max_deviation: 0.7 },
      expensive_part: {
        min_deviation: {
          max_coefficient_splitter: 3,
          above: { fixed: 1.0, part: 0.97 },
          less: { fixed: 0, part: 0.97 }
        },
        max_deviation: {
          max_coefficient_splitter: 0,
          above: { fixed: 0, part: 1.0 },
          less: { fixed: 0, part: 1.0 }
        }
      },
      percentage: { small_dispersion: 0.05, medium_dispersion: 0.05, high_dispersion: 0.1 }
    }
  };
  public getCase(casePrice: number, maxCoefficient: number, itemsCount: number): [ItemDistribution[], ItemDistribution[], ItemDistribution[]] {
    const smallDispersionSegments = this.getItemsPriceSegments(maxCoefficient, itemsCount, Dispersion.Small);
    const smallDispersionItemsDistribution = this.getItemsDistribution(casePrice, smallDispersionSegments, itemsCount);
    const mediumDispersionSegments = this.getItemsPriceSegments(maxCoefficient, itemsCount, Dispersion.Medium);
    const mediumDispersionItemsDistribution = this.getItemsDistribution(casePrice, mediumDispersionSegments, itemsCount);
    const highDispersionSegments = this.getItemsPriceSegments(maxCoefficient, itemsCount, Dispersion.High);
    const highDispersionItemsDistribution = this.getItemsDistribution(casePrice, highDispersionSegments, itemsCount);
    return [smallDispersionItemsDistribution, mediumDispersionItemsDistribution, highDispersionItemsDistribution];
  }
  public recalculateCase(
    casePrice: number,
    maxCoefficient: number,
    dispersion: Dispersion,
    itemsDistribution: ItemDistribution[]
  ): [boolean, ItemDistribution[]] {
    const itemsCount = itemsDistribution.length;
    const segments = this.getItemsPriceSegments(maxCoefficient, itemsCount, dispersion);
    const newItemsDistribution = [...itemsDistribution];
    const tempItemsDistribution = [...itemsDistribution];
    const recalculated = this.recalculateItemsProbabilities(casePrice, segments, tempItemsDistribution);
    for (let i = 0; i < newItemsDistribution.length; i++) {
      newItemsDistribution[i].probability = recalculated ? tempItemsDistribution[i].probability : 0;
    }
    return [recalculated, newItemsDistribution];
  }
  public openCase(itemsDistribution: ItemDistribution[]): number {
    return this.getRandomValue(itemsDistribution);
  }
  private getRandomValue(itemsDistribution: ItemDistribution[]): number {
    const p = randomFloat(0, 1);
    let pSum = 0.0;
    let value = 0.0;
    for (let i = 0; i < itemsDistribution.length; i++) {
      pSum += itemsDistribution[i].probability;
      if (p <= pSum) {
        value = itemsDistribution[i].value;
        break;
      }
    }
    return value;
  }
  private getItemsPriceSegments(maxCoefficient: number, itemsCount: number, dispersion: Dispersion): Segment[] {
    const segments: Segment[] = [];
    const segmentsRules = CasesEngine.ITEMS_PRICE_SEGMENTS_RULES;
    let segmentsCount = Object.keys(segmentsRules).length;
    for (let i = 0; i < segmentsCount; i++) {
      segments[i] = {
        cheap_part: {
          min_deviation: segmentsRules[i].cheap_part.min_deviation,
          max_deviation: segmentsRules[i].cheap_part.max_deviation
        },
        expensive_part: {
          min_deviation: 0,
          max_deviation: 0
        },
        percentage: 0
      };
      let rules = maxCoefficient >= segmentsRules[i].expensive_part.min_deviation.max_coefficient_splitter
        ? segmentsRules[i].expensive_part.min_deviation.above
        : segmentsRules[i].expensive_part.min_deviation.less;
      segments[i].expensive_part.min_deviation = 
        rules.fixed + rules.part * (maxCoefficient / CasesEngine.RTP - 1.0 - rules.fixed);
      rules = maxCoefficient >= segmentsRules[i].expensive_part.max_deviation.max_coefficient_splitter
        ? segmentsRules[i].expensive_part.max_deviation.above
        : segmentsRules[i].expensive_part.max_deviation.less;
      segments[i].expensive_part.max_deviation = 
        rules.fixed + rules.part * (maxCoefficient / CasesEngine.RTP - 1.0 - rules.fixed);
      switch (dispersion) {
        case Dispersion.Small:
          segments[i].percentage = segmentsRules[i].percentage.small_dispersion;
          break;
        case Dispersion.Medium:
          segments[i].percentage = segmentsRules[i].percentage.medium_dispersion;
          break;
        case Dispersion.High:
          segments[i].percentage = segmentsRules[i].percentage.high_dispersion;
          break;
      }
    }
    while (2 * segmentsCount > itemsCount) {
      if (segmentsCount > 2) {
        segments[segmentsCount - 3].percentage += segments[segmentsCount - 2].percentage;
        if (Math.abs(segments[segmentsCount - 2].expensive_part.min_deviation - 
            segments[segmentsCount - 3].expensive_part.max_deviation) < CasesEngine.ACCURACY) {
          segments[segmentsCount - 3].cheap_part.max_deviation = segments[segmentsCount - 2].cheap_part.max_deviation;
          segments[segmentsCount - 3].expensive_part.max_deviation = segments[segmentsCount - 2].expensive_part.max_deviation;
        }
      } else if (segmentsCount === 2) {
        segments[segmentsCount - 2].cheap_part.max_deviation = segments[segmentsCount - 1].cheap_part.max_deviation;
        segments[segmentsCount - 2].expensive_part.max_deviation = segments[segmentsCount - 1].expensive_part.max_deviation;
        segments[segmentsCount - 2].percentage += segments[segmentsCount - 1].percentage;
      }
      segmentsCount--;
      segments.splice(segmentsCount, 1);
    }
    return segments;
  }
  private getItemsDistribution(casePrice: number, segments: Segment[], itemsCount: number): ItemDistribution[] {
    const itemsDistribution: ItemDistribution[] = [];
    const segmentsCount = segments.length;
    const targetPrice = CasesEngine.RTP * casePrice;
    for (let i = 0; i < segmentsCount; i++) {
      const cheapValue = targetPrice * (1 - randomFloatExclusive(
        segments[i].cheap_part.min_deviation,
        segments[i].cheap_part.max_deviation,
        100000
      ));
      itemsDistribution[2 * i] = {
        value: cheapValue,
        'lower_bound(>)': targetPrice * (1 - segments[i].cheap_part.max_deviation),
        'upper_bound(<=)': targetPrice * (1 - segments[i].cheap_part.min_deviation),
        segment: i,
        probability: 0
      };
      let expensiveValue = targetPrice * (1 + randomFloatExclusive(
        segments[i].expensive_part.min_deviation,
        segments[i].expensive_part.max_deviation,
        100000
      ));
      while (cheapValue === expensiveValue) {
        expensiveValue = targetPrice * (1 + randomFloatExclusive(
          segments[i].expensive_part.min_deviation,
          segments[i].expensive_part.max_deviation,
          100000
        ));
      }
      itemsDistribution[2 * i + 1] = {
        value: expensiveValue,
        'lower_bound(>)': targetPrice * (1 + segments[i].expensive_part.min_deviation),
        'upper_bound(<=)': targetPrice * (1 + segments[i].expensive_part.max_deviation),
        segment: i,
        probability: 0
      };
      const cheapProb = (targetPrice - expensiveValue) / (cheapValue - expensiveValue);
      const expensiveProb = 1 - cheapProb;
      itemsDistribution[2 * i].probability = cheapProb * segments[i].percentage;
      itemsDistribution[2 * i + 1].probability = expensiveProb * segments[i].percentage;
    }
    for (let i = 2 * segmentsCount; i < itemsCount; i++) {
      let maxProb = 0.0;
      let maxProbSegment = -1;
      let maxProbIndex = -1;
      for (let k = 0; k < i; k++) {
        if (itemsDistribution[k].probability > maxProb) {
          maxProb = itemsDistribution[k].probability;
          maxProbSegment = itemsDistribution[k].segment;
          maxProbIndex = k;
        }
      }
      if (itemsDistribution[maxProbIndex].value <= targetPrice) {
        itemsDistribution[i] = {
          value: targetPrice * (1 - randomFloatExclusive(
            segments[maxProbSegment].cheap_part.min_deviation,
            segments[maxProbSegment].cheap_part.max_deviation,
            10000
          )),
          'lower_bound(>)': targetPrice * (1 - segments[maxProbSegment].cheap_part.max_deviation),
          'upper_bound(<=)': targetPrice * (1 - segments[maxProbSegment].cheap_part.min_deviation),
          segment: maxProbSegment,
          probability: 0
        };
      } else {
        itemsDistribution[i] = {
          value: targetPrice * (1 + randomFloatExclusive(
            segments[maxProbSegment].expensive_part.min_deviation,
            segments[maxProbSegment].expensive_part.max_deviation,
            10000
          )),
          'lower_bound(>)': targetPrice * (1 + segments[maxProbSegment].expensive_part.min_deviation),
          'upper_bound(<=)': targetPrice * (1 + segments[maxProbSegment].expensive_part.max_deviation),
          segment: maxProbSegment,
          probability: 0
        };
      }
      this.recalculateSegmentProbabilities(casePrice, maxProbSegment, segments, itemsDistribution);
    }
    return itemsDistribution;
  }
  private recalculateItemsProbabilities(
    casePrice: number,
    segments: Segment[],
    itemsDistribution: ItemDistribution[]
  ): boolean {
    let segmentsCount = segments.length;
    const itemsCount = itemsDistribution.length;
    for (let i = segmentsCount - 1; i > 0; i--) {
      const recalculated = this.recalculateSegmentProbabilities(casePrice, i, segments, itemsDistribution);
      if (!recalculated) {
        segments[i - 1].cheap_part.max_deviation = segments[i].cheap_part.max_deviation;
        segments[i - 1].expensive_part.max_deviation = segments[i].expensive_part.max_deviation;
        segments[i - 1].percentage += segments[i].percentage;
        segmentsCount--;
        for (let j = i; j < segmentsCount; j++) {
          segments[j] = segments[j + 1];
        }
        segments.splice(segmentsCount, 1);
        for (let k = 0; k < itemsCount; k++) {
          if (itemsDistribution[k].segment >= i) {
            itemsDistribution[k].segment--;
          }
        }
      }
    }
    let recalculated = this.recalculateSegmentProbabilities(casePrice, 0, segments, itemsDistribution);
    if (!recalculated) {
      if (segmentsCount === 1) {
        return false;
      }
      segments[0].cheap_part.max_deviation = segments[1].cheap_part.max_deviation;
      segments[0].expensive_part.max_deviation = segments[1].expensive_part.max_deviation;
      segments[0].percentage += segments[1].percentage;
      segmentsCount--;
      for (let j = 1; j < segmentsCount; j++) {
        segments[j] = segments[j + 1];
      }
      segments.splice(segmentsCount, 1);
      for (let k = 0; k < itemsCount; k++) {
        if (itemsDistribution[k].segment >= 1) {
          itemsDistribution[k].segment--;
        }
      }
      recalculated = this.recalculateSegmentProbabilities(casePrice, 0, segments, itemsDistribution);
    }
    return recalculated;
  }
  private recalculateSegmentProbabilities(
    casePrice: number,
    segment: number,
    segments: Segment[],
    itemsDistribution: ItemDistribution[]
  ): boolean {
    const targetPrice = CasesEngine.RTP * casePrice;
    let aeSum = 0.0;
    let eSum = 0.0;
    let bfSum = 0.0;
    let fSum = 0.0;
    let cheapCount = 0;
    let itemsCount = 0;
    for (let k = 0; k < itemsDistribution.length; k++) {
      if (itemsDistribution[k].segment === segment) {
        itemsCount++;
        if (itemsDistribution[k].value <= targetPrice) {
          cheapCount++;
          aeSum += itemsDistribution[k].value * itemsDistribution[k].value / targetPrice;
          eSum += itemsDistribution[k].value / targetPrice;
        } else {
          bfSum += targetPrice;
          fSum += targetPrice / itemsDistribution[k].value;
        }
      }
    }
    if (cheapCount === 0 || cheapCount === itemsCount) {
      return false;
    }
    const x = (targetPrice - bfSum / fSum) / (aeSum - bfSum * eSum / fSum);
    for (let k = 0; k < itemsDistribution.length; k++) {
      if (itemsDistribution[k].segment === segment) {
        if (itemsDistribution[k].value <= targetPrice) {
          itemsDistribution[k]['lower_bound(>)'] = targetPrice * (1 - segments[segment].cheap_part.max_deviation);
          itemsDistribution[k]['upper_bound(<=)'] = targetPrice * (1 - segments[segment].cheap_part.min_deviation);
          itemsDistribution[k].probability = segments[segment].percentage * x * itemsDistribution[k].value / targetPrice;
        } else {
          itemsDistribution[k]['lower_bound(>)'] = targetPrice * (1 + segments[segment].expensive_part.min_deviation);
          itemsDistribution[k]['upper_bound(<=)'] = targetPrice * (1 + segments[segment].expensive_part.max_deviation);
          itemsDistribution[k].probability = segments[segment].percentage * ((1 - eSum * x) / fSum) * targetPrice / itemsDistribution[k].value;
        }
      }
    }
    return true;
  }
}
export type { ItemDistribution };
export { Dispersion };