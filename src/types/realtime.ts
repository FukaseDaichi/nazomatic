export interface RealtimeApiResponse {
  posts: RealtimePost[];
  meta: RealtimeMeta;
}

export interface RealtimePost {
  id: string;
  url: string;
  detailUrl: string | null;
  quoteDetailUrl: string | null;
  text: string;
  textPlain: string;
  hashtags: string[];
  createdAt: string;
  createdAtUnix: number;
  metrics: RealtimePostMetrics;
  author: RealtimePostAuthor;
  urls: RealtimePostUrl[];
  media: RealtimePostMedia[];
  possiblySensitive: boolean;
}

export interface RealtimePostMetrics {
  replies: number;
  retweets: number;
  quotes: number;
  likes: number;
}

export interface RealtimePostAuthor {
  id: string;
  name: string;
  screenName: string;
  profileImageUrl: string | null;
  url: string | null;
}

export interface RealtimePostUrl {
  url: string;
  displayUrl: string | null;
  mediaUrl: string | null;
}

export interface RealtimePostMedia {
  type: string;
  url: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

export interface RealtimeMeta {
  query: string;
  page: number;
  limit: number | null;
  offset: number;
  totalResultsAvailable: number | null;
  totalResultsReturned: number | null;
  retrievedAt: string;
  sourceUrl: string;
  sourceTimestamp: number | null;
}

export interface RealtimeApiErrorResponse {
  error: string;
  details?: string;
}
