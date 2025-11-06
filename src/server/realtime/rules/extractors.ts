import type { RealtimeEventCategory, RealtimeEventPrice } from "@/types/realtimeEvent";

export interface PriceExtractionResult {
  price: RealtimeEventPrice;
  matchedText: string;
}

export interface QuantityExtractionResult {
  quantity: number;
  matchedText: string;
}

export interface LocationExtractionResult {
  location: string;
  matchedText: string;
}

const SELL_KEYWORDS = ["譲ります", "お譲り", "譲渡", "放出", "お譲りします"];
const BUY_KEYWORDS = ["求む", "探してます", "譲ってください", "譲って頂けませんか", "求"];
const EXCHANGE_KEYWORDS = ["交換", "トレード"];

const DELIVERY_KEYWORDS: Record<string, string> = {
  現地手渡し: "現地手渡し",
  手渡し: "現地手渡し",
  電子チケット: "電子チケット",
  電チケ: "電子チケット",
  郵送: "郵送",
  メルカリ: "メルカリ受け渡し",
  クレカ分配: "クレカ分配",
  同行: "同行",
};

const LOCATION_REGEX = /([一-龥ぁ-んァ-ヶA-Za-z0-9]{2,12}(?:駅|ドーム|ホール|アリーナ|劇場|スタジアム|会館|会場))/g;

export function extractPrice(text: string): PriceExtractionResult | null {
  const normalized = text.replace(/[，．]/g, (match) => (match === "，" ? "," : "."));

  const yenPattern = /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*(?:円|えん|yen|ｙｅｎ|YEN)/gi;
  const kPattern = /([0-9]+(?:\.[0-9]+)?)\s*(?:k|Ｋ)/gi;

  const yenMatch = yenPattern.exec(normalized);
  if (yenMatch) {
    const amount = parseInt(yenMatch[1].replace(/,/g, ""), 10);
    if (Number.isFinite(amount)) {
      return {
        price: {
          amount,
          currency: "JPY",
          perUnit: "ticket",
        },
        matchedText: yenMatch[0],
      };
    }
  }

  const kMatch = kPattern.exec(normalized);
  if (kMatch) {
    const amount = Math.round(parseFloat(kMatch[1]) * 1000);
    if (Number.isFinite(amount)) {
      return {
        price: {
          amount,
          currency: "JPY",
          perUnit: "ticket",
        },
        matchedText: kMatch[0],
      };
    }
  }

  return null;
}

export function extractQuantity(text: string): QuantityExtractionResult | null {
  const numberPattern = /([0-9]{1,2})\s*枚/g;
  const pairPattern = /(ペア|２人分|二人分|2名|２名)/g;

  const numMatch = numberPattern.exec(text);
  if (numMatch) {
    const quantity = parseInt(numMatch[1], 10);
    if (quantity > 0) {
      return {
        quantity,
        matchedText: numMatch[0],
      };
    }
  }

  const pairMatch = pairPattern.exec(text);
  if (pairMatch) {
    return {
      quantity: 2,
      matchedText: pairMatch[0],
    };
  }

  return null;
}

export function inferCategory(text: string): { category: RealtimeEventCategory; matchedText: string | null } {
  const lower = text.toLowerCase();

  const exchangeHit = EXCHANGE_KEYWORDS.find((keyword) => lower.includes(keyword));
  if (exchangeHit) {
    return { category: "exchange", matchedText: exchangeHit };
  }
  const sellHit = SELL_KEYWORDS.find((keyword) => lower.includes(keyword));
  if (sellHit) {
    return { category: "sell", matchedText: sellHit };
  }
  const buyHit = BUY_KEYWORDS.find((keyword) => lower.includes(keyword));
  if (buyHit) {
    return { category: "buy", matchedText: buyHit };
  }

  return { category: "unknown", matchedText: null };
}

export function extractLocation(text: string): LocationExtractionResult | null {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = LOCATION_REGEX.exec(text)) !== null) {
    matches.push(match[1]);
  }

  if (!matches.length) {
    return null;
  }

  // Prioritise longer matches (e.g., 東京ドームシティホール)
  matches.sort((a, b) => b.length - a.length);

  return {
    location: matches[0],
    matchedText: matches[0],
  };
}

export function extractDeliveryMethod(text: string): string | null {
  const entries = Object.entries(DELIVERY_KEYWORDS);
  for (const [keyword, label] of entries) {
    if (text.includes(keyword)) {
      return label;
    }
  }
  return null;
}

export function inferTicketTitle(text: string, hashtags: string[]): string | null {
  const clippedHashtag = hashtags
    .map((tag) => tag.replace(/^#/, ""))
    .find((tag) => tag.length >= 2 && !/^(謎チケ|謎チケット|譲|求)$/i.test(tag));
  if (clippedHashtag) {
    return clippedHashtag;
  }

  const bracketMatch = text.match(/[『「《【](.{2,30}?)[』」》】]/);
  if (bracketMatch) {
    return bracketMatch[1];
  }

  const ticketLineMatch = text.match(/([^\n。！？]{2,30}?チケット)/);
  if (ticketLineMatch) {
    return ticketLineMatch[1];
  }

  return null;
}
