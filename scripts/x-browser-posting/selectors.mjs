export const SELECTOR_PROFILE_VERSION = "x-browser-posting-v1";

export const BLOCKING_TEXT_PATTERNS = [
  /captcha|recaptcha/i,
  /unusual activity/i,
  /temporarily limited/i,
  /account.*locked/i,
  /verify your/i,
  /認証|確認してください|制限|ロック/,
];

export const SUBMIT_BUTTON_NAMES = [
  /^Post$/,
  /^Tweet$/,
  /^投稿$/,
  /^ポスト$/,
];
