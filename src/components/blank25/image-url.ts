const STORAGE_RAW_BASE =
  process.env.NEXT_PUBLIC_BLANK25_STORAGE_RAW_BASE ??
  "https://raw.githubusercontent.com/FukaseDaichi/nazomatic-storage/main";

export const getBlank25ImageUrl = (imageFile: string): string =>
  `${STORAGE_RAW_BASE}/img/${imageFile}`;
