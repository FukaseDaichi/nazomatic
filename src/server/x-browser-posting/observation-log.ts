import { baseURL } from "@/app/config";
import { firestore } from "@/server/firebase/admin";
import { isRealtimeEventVisible } from "@/server/realtime/syndication/visibility";
import {
  buildHashtagVariants,
  BrowserPostConfigError,
} from "@/server/x-browser-posting/candidate";
import {
  readDate,
  readString,
  zonedStartOfDayToUtc,
} from "@/server/x-browser-posting/weekend-ticket-summary";
import { weightedTextLength } from "@/server/x-browser-posting/trend-joke-post";

const EVENTS_COLLECTION = "realtimeEvents";
const DEFAULT_TIMEZONE = "Asia/Tokyo";
const DEFAULT_HASHTAG = "#謎チケ売ります";
const MAX_EVENTS_PER_WINDOW = 300;
const MAX_SAMPLE_TITLES = 3;
const MAX_LINE_LENGTH = 100;
const CALENDAR_URL = `${baseURL.replace(
  /\/+$/,
  ""
)}/calendar?utm_source=x&utm_medium=social&utm_campaign=observation_log`;

const OBSERVATION_LOG_SCENES = [
  {
    prompt: "スマホを胸元に抱え、頬を少し赤らめてこちらを見る。照れた、やわらかい表情。",
    line: "スマホでこつこつ観測。ちょっとだけ褒められる準備中です。",
    zeroLine: "今週の記録は静か。スマホを抱えて、次の観測を待っています。",
  },
  {
    prompt: "文字のない集計ノートを胸元に抱え、小さく胸を張る。少し得意げで可愛い表情。",
    line: "観測ノート、まとめました。表紙を閉じて、ちょっと得意げ。",
    zeroLine: "今週の記録は静か。観測ノートの余白に、小さな花を描きました。",
  },
  {
    prompt: "無地のマグカップを両手で持ってひと休み。少し眠そうな目元と控えめな微笑み。",
    line: "集計、おしまい。マグを両手で持ったら、少し眠くなりました。",
    zeroLine: "今週の記録は静か。あたたかいマグと、のんびり観測を続けています。",
  },
  {
    prompt: "数字も文字もない小さな卓上カレンダーをそっと指さす。やり切った満足げな微笑み。",
    line: "カレンダーを眺めて観測完了。小さくうなずいて、次の週へ。",
    zeroLine: "今週の記録は静か。カレンダーをめくって、次の週にもごあいさつ。",
  },
];

export type PrepareObservationLogParams = {
  hashtag?: string | null;
  timezone?: string | null;
  runDate?: string | null;
  line?: string | null;
};

export type ObservationLogWindow = {
  startDate: string;
  endDate: string;
  count: number;
};

export type PrepareObservationLogResult = {
  hashtag: string;
  timezone: string;
  runDate: string;
  pastWindow: ObservationLogWindow;
  upcomingWindow: ObservationLogWindow;
  sampleTicketTitles: string[];
  calendarUrl: string;
  suggestedLine: string;
  composedText: string;
  imagePrompt: string;
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

type ObservationEvent = {
  id: string;
  eventDateKey: string;
  ticketTitle: string | null;
};

export async function prepareObservationLog(
  params: PrepareObservationLogParams
): Promise<PrepareObservationLogResult> {
  const normalized = normalizeParams(params);
  const runDateParts = normalized.runDate
    ? parseLocalDate(normalized.runDate, "runDate")
    : getZonedDateParts(new Date(), normalized.timezone);

  const pastStart = addLocalDays(runDateParts, -6);
  const pastEnd = runDateParts;
  const upcomingStart = addLocalDays(runDateParts, 1);
  const upcomingEnd = addLocalDays(runDateParts, 7);

  const [pastEvents, upcomingEvents] = await Promise.all([
    fetchObservationEvents({
      hashtag: normalized.hashtag,
      timezone: normalized.timezone,
      startDate: pastStart,
      endDateExclusive: addLocalDays(runDateParts, 1),
    }),
    fetchObservationEvents({
      hashtag: normalized.hashtag,
      timezone: normalized.timezone,
      startDate: upcomingStart,
      endDateExclusive: addLocalDays(runDateParts, 8),
    }),
  ]);

  const pastWindow = {
    startDate: formatLocalDate(pastStart),
    endDate: formatLocalDate(pastEnd),
    count: pastEvents.length,
  };
  const upcomingWindow = {
    startDate: formatLocalDate(upcomingStart),
    endDate: formatLocalDate(upcomingEnd),
    count: upcomingEvents.length,
  };
  const sampleTicketTitles = collectSampleTicketTitles(upcomingEvents);
  const scene = chooseObservationLogScene(runDateParts);
  const suggestedLine = chooseObservationLogLine({
    scene,
    line: normalized.line,
    pastCount: pastWindow.count,
    upcomingCount: upcomingWindow.count,
  });
  const rangeLabel = formatRangeLabel(pastStart, pastEnd);
  const composedText = buildObservationLogText({
    rangeLabel,
    pastCount: pastWindow.count,
    upcomingCount: upcomingWindow.count,
    sampleTicketTitles,
    line: suggestedLine,
  });

  const finalText = ensureTextFits({
    rangeLabel,
    pastCount: pastWindow.count,
    upcomingCount: upcomingWindow.count,
    sampleTicketTitles,
    line: suggestedLine,
    composedText,
  });
  assertObservationLogText(finalText);

  const imagePrompt = [
    "渡された参照画像の観測担当を主役に、横長16:9の可愛い週報イラストを1枚生成してください。",
    "参照画像の顔立ち、元絵に近い等身、繊細な描き込みとやわらかなアニメイラストの画風を保つ。ちびキャラにはしない。",
    "紫がかった黒髪のお団子、紫の瞳、パズルとロボットの髪飾り、大きめのパーカーを固定し、同じキャラクターとして描く。",
    "キャラクターと小物は画面の右側55%に大きく配置する。顔や髪飾りを切らず、上半身と手元を見せる。",
    "左側45%には後で文字を合成するため、人物・小物・模様を置かず、明るい無地の余白にする。枠やカードも描かない。",
    "背景は白・淡いラベンダー・淡いピンクのやわらかなグラデーション。右側だけに控えめな光や小さな花のアクセント。",
    scene.prompt,
    "文字・数字・日付・ロゴ・透かし・吹き出しは一切描かない。ノートやスマホ、カレンダーにも読める文字や数字を入れない。",
  ].join("\n");

  return {
    hashtag: normalized.hashtag,
    timezone: normalized.timezone,
    runDate: formatLocalDate(runDateParts),
    pastWindow,
    upcomingWindow,
    sampleTicketTitles,
    calendarUrl: CALENDAR_URL,
    suggestedLine,
    composedText: finalText,
    imagePrompt,
  };
}

export function validateObservationLogLine(line: string): string {
  const trimmed = String(line ?? "").trim();
  if (!trimmed) {
    throw new BrowserPostConfigError("observation log line must not be empty");
  }
  if (Array.from(trimmed).length >= MAX_LINE_LENGTH) {
    throw new BrowserPostConfigError(
      "observation log line must be fewer than 100 Japanese characters"
    );
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new BrowserPostConfigError("observation log line must be one line");
  }
  if (/https?:\/\//i.test(trimmed)) {
    throw new BrowserPostConfigError("observation log line must not contain URLs");
  }
  if (/[#＃@＠]/.test(trimmed)) {
    throw new BrowserPostConfigError(
      "observation log line must not contain hashtags or mentions"
    );
  }
  if (/\p{Extended_Pictographic}/u.test(trimmed)) {
    throw new BrowserPostConfigError(
      "observation log line must not contain emoji"
    );
  }
  if (/(必ず|保証|安全|まだ買える|お得|空いている|空いてます)/.test(trimmed)) {
    throw new BrowserPostConfigError(
      "observation log line must not make availability or safety claims"
    );
  }
  return trimmed;
}

function normalizeParams(params: PrepareObservationLogParams) {
  const rawHashtag = params.hashtag?.trim() || DEFAULT_HASHTAG;
  const hashtag = rawHashtag.startsWith("#") ? rawHashtag : `#${rawHashtag}`;
  const timezone = params.timezone?.trim() || DEFAULT_TIMEZONE;
  if (timezone !== DEFAULT_TIMEZONE) {
    throw new BrowserPostConfigError(
      `timezone must be ${DEFAULT_TIMEZONE} for observation logs`
    );
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new BrowserPostConfigError("timezone must be a valid IANA time zone");
  }

  return {
    hashtag,
    timezone,
    runDate: params.runDate?.trim() || null,
    line: params.line?.trim() || null,
  };
}

async function fetchObservationEvents({
  hashtag,
  timezone,
  startDate,
  endDateExclusive,
}: {
  hashtag: string;
  timezone: string;
  startDate: LocalDateParts;
  endDateExclusive: LocalDateParts;
}) {
  const start = zonedStartOfDayToUtc(startDate, timezone);
  const end = zonedStartOfDayToUtc(endDateExclusive, timezone);
  const snapshots = await Promise.all(
    buildHashtagVariants(hashtag).map((variant) =>
      firestore
        .collection(EVENTS_COLLECTION)
        .where("eventTime", ">=", start)
        .where("eventTime", "<", end)
        .where("sourceQuery", "==", variant)
        .orderBy("eventTime", "asc")
        .limit(MAX_EVENTS_PER_WINDOW)
        .get()
    )
  );

  const byPost = new Map<string, ObservationEvent>();
  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!isRealtimeEventVisible(data)) {
        continue;
      }
      const eventTime = readDate(data, "eventTime");
      if (!eventTime) {
        continue;
      }
      const key = readString(data, "postId") ?? doc.id;
      if (byPost.has(key)) {
        continue;
      }
      byPost.set(key, {
        id: doc.id,
        eventDateKey: formatLocalDate(
          getZonedDateParts(eventTime, timezone)
        ),
        ticketTitle: readString(data, "ticketTitle"),
      });
    }
  }
  return Array.from(byPost.values());
}

function collectSampleTicketTitles(events: ObservationEvent[]) {
  const counts = new Map<string, { count: number; firstIndex: number }>();
  for (const [index, event] of events.entries()) {
    const title = sanitizeObservationTitle(event.ticketTitle);
    if (!title) {
      continue;
    }
    const current = counts.get(title);
    counts.set(title, {
      count: (current?.count ?? 0) + 1,
      firstIndex: current?.firstIndex ?? index,
    });
  }
  return Array.from(counts.entries())
    .sort(
      ([, left], [, right]) =>
        right.count - left.count || left.firstIndex - right.firstIndex
    )
    .slice(0, MAX_SAMPLE_TITLES)
    .map(([title]) => title);
}

function sanitizeObservationTitle(value: string | null) {
  if (!value) {
    return null;
  }
  const sanitized = value
    .replace(/[\r\n#＃＠@]/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (Array.from(sanitized).length < 2) {
    return null;
  }
  const truncated = Array.from(sanitized).slice(0, 30).join("");
  return /\p{Extended_Pictographic}/u.test(truncated) ? null : truncated;
}

function chooseObservationLogScene(runDate: LocalDateParts) {
  // JST の月曜始まりの週で固定し、同じ週の再実行でも絵とコメントを揃える。
  const mondayEpoch = Date.UTC(2026, 0, 5);
  const week = Math.floor(
    (Date.UTC(runDate.year, runDate.month - 1, runDate.day) - mondayEpoch) /
      (7 * 24 * 60 * 60 * 1000)
  );
  const index = ((week % OBSERVATION_LOG_SCENES.length) +
    OBSERVATION_LOG_SCENES.length) % OBSERVATION_LOG_SCENES.length;
  return OBSERVATION_LOG_SCENES[index];
}

function chooseObservationLogLine({
  scene,
  line,
  pastCount,
  upcomingCount,
}: {
  scene: (typeof OBSERVATION_LOG_SCENES)[number];
  line: string | null;
  pastCount: number;
  upcomingCount: number;
}) {
  if (line) {
    return validateObservationLogLine(line);
  }
  if (pastCount === 0 && upcomingCount === 0) {
    return validateObservationLogLine(scene.zeroLine);
  }
  return validateObservationLogLine(scene.line);
}

function buildObservationLogText({
  rangeLabel,
  pastCount,
  upcomingCount,
  sampleTicketTitles,
  line,
}: {
  rangeLabel: string;
  pastCount: number;
  upcomingCount: number;
  sampleTicketTitles: string[];
  line: string;
}) {
  const titleLine = sampleTicketTitles.length
    ? `向こう7日の公演例: ${sampleTicketTitles
        .map((title) => `『${title}』`)
        .join("")}`
    : null;
  return [
    `【今週の観測だより】${rangeLabel}`,
    "",
    "謎チケ情報（日程基準）",
    `過去7日の日程: ${pastCount}件`,
    `向こう7日の日程: ${upcomingCount}件`,
    ...(titleLine ? [titleLine] : []),
    "",
    line,
    CALENDAR_URL,
  ].join("\n");
}

function ensureTextFits({
  rangeLabel,
  pastCount,
  upcomingCount,
  sampleTicketTitles,
  line,
  composedText,
}: {
  rangeLabel: string;
  pastCount: number;
  upcomingCount: number;
  sampleTicketTitles: string[];
  line: string;
  composedText: string;
}) {
  if (weightedTextLength(composedText) <= 280) {
    return composedText;
  }
  const withoutTitles = buildObservationLogText({
    rangeLabel,
    pastCount,
    upcomingCount,
    sampleTicketTitles: [],
    line,
  });
  if (weightedTextLength(withoutTitles) > 280) {
    throw new BrowserPostConfigError(
      "observation log text exceeds 280 weighted characters"
    );
  }
  return withoutTitles;
}

function assertObservationLogText(text: string) {
  const urls = text.match(/https?:\/\/[^\s]+/gi) ?? [];
  if (urls.length !== 1 || urls[0] !== CALENDAR_URL) {
    throw new BrowserPostConfigError(
      "observation log text must contain exactly its approved calendar URL"
    );
  }
  if (/[#＃@＠]/.test(text)) {
    throw new BrowserPostConfigError(
      "observation log text must not contain hashtags or mentions"
    );
  }
  if (/\p{Extended_Pictographic}/u.test(text)) {
    throw new BrowserPostConfigError("observation log text must not contain emoji");
  }
  if (/\n{3,}/.test(text)) {
    throw new BrowserPostConfigError(
      "observation log text must not contain more than one blank line"
    );
  }
  if (weightedTextLength(text) > 280) {
    throw new BrowserPostConfigError(
      "observation log text exceeds 280 weighted characters"
    );
  }
}

function parseLocalDate(value: string, fieldName: string): LocalDateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new BrowserPostConfigError(`${fieldName} must be YYYY-MM-DD`);
  }
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  if (formatLocalDate(parts) !== value.trim()) {
    throw new BrowserPostConfigError(`${fieldName} must be a valid date`);
  }
  return parts;
}

function getZonedDateParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: readDatePart(parts, "year"),
    month: readDatePart(parts, "month"),
    day: readDatePart(parts, "day"),
  };
}

function readDatePart(parts: Intl.DateTimeFormatPart[], type: string) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new BrowserPostConfigError(`Could not read date part: ${type}`);
  }
  return Number(value);
}

function addLocalDays(date: LocalDateParts, days: number): LocalDateParts {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function formatLocalDate(date: LocalDateParts) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(
    date.day
  ).padStart(2, "0")}`;
}

function formatRangeLabel(start: LocalDateParts, end: LocalDateParts) {
  return `${start.month}/${start.day}〜${end.month}/${end.day}`;
}
