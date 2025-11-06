export interface ConfidenceInput {
  hasDate: boolean;
  hasTime: boolean;
  hasPrice: boolean;
  hasQuantity: boolean;
  hasLocation: boolean;
  hasCategory: boolean;
}

const DATE_WEIGHT = 0.35;
const TIME_WEIGHT = 0.1;
const PRICE_WEIGHT = 0.2;
const QUANTITY_WEIGHT = 0.15;
const LOCATION_WEIGHT = 0.1;
const CATEGORY_WEIGHT = 0.1;

export function computeConfidence(input: ConfidenceInput): number {
  const score =
    (input.hasDate ? DATE_WEIGHT : 0) +
    (input.hasTime ? TIME_WEIGHT : 0) +
    (input.hasPrice ? PRICE_WEIGHT : 0) +
    (input.hasQuantity ? QUANTITY_WEIGHT : 0) +
    (input.hasLocation ? LOCATION_WEIGHT : 0) +
    (input.hasCategory ? CATEGORY_WEIGHT : 0);

  return Math.min(1, Math.round(score * 100) / 100);
}
