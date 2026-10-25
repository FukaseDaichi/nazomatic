import { normalizeKana } from "@/lib/utils";

// 探索の打ち切り時間（ミリ秒）。超えたらその時点で見つかった最長のしりとりを返す
const SEARCH_TIME_BUDGET_MS = 1000;

export type ShiritoriSearchResult = {
  chain: string[]; // 最長のしりとり
  unusedWords: string[]; // しりとりに使われなかった単語（入力順）
  isOptimal: boolean; // 打ち切られず、最長であると確定したか
};

// 頭文字と尾文字の組が同じ単語をまとめた辺
type WordEdge = { from: number; to: number; wordIndexes: number[] };

/**
 * 文字を頂点、単語を「頭文字→尾文字」の辺とみなし、同じ単語を2度使わない最長の道（トレイル）を探す。
 * - 頭尾が同じ単語は区別せず個数だけを数える
 * - 頭尾が同じ文字の単語（自己ループ）は、その文字に初めて着いたときにまとめて使う
 * - 強連結成分ごとの次数上限で枝刈りし、残りが一筆書きできるならその場で完成させる
 */
class LongestTrailSearch {
  private readonly edges: WordEdge[] = [];
  private readonly outEdges: number[][] = [];
  private readonly loopWords: number[][] = [];
  private readonly remaining: Int32Array;
  private readonly absorbed: Uint8Array; // 自己ループを使用済みの頂点
  private readonly path: number[] = []; // 辺の番号、または ~頂点（自己ループの一括使用）
  private bestLength = 0;
  private bestPath: number[] = [];
  private steps = 0;
  private deadline = 0;
  private timedOut = false;

  // analyze() の作業領域
  private readonly reachable: number[] = [];
  private readonly seen: Uint8Array;
  private readonly outDegree: Int32Array;
  private readonly inDegree: Int32Array;
  private readonly sccOf: Int32Array;
  private readonly sccBest: number[] = [];
  private readonly tarjanIndex: Int32Array;
  private readonly tarjanLow: Int32Array;
  private readonly tarjanOnStack: Uint8Array;
  private readonly tarjanStack: number[] = [];
  private tarjanCounter = 0;

  constructor(private readonly words: string[]) {
    const vertexIds = new Map<string, number>();
    const vertexOf = (char: string) => {
      let id = vertexIds.get(char);
      if (id === undefined) {
        id = vertexIds.size;
        vertexIds.set(char, id);
        this.outEdges.push([]);
        this.loopWords.push([]);
      }
      return id;
    };
    const edgeIds = new Map<string, number>();

    words.forEach((word, wordIndex) => {
      const chars = Array.from(word);
      // ひらがな・カタカナを統一して比較
      const from = vertexOf(normalizeKana(chars[0]));
      const to = vertexOf(normalizeKana(chars[chars.length - 1]));
      if (from === to) {
        this.loopWords[from].push(wordIndex);
        return;
      }
      const key = `${from}:${to}`;
      let edgeId = edgeIds.get(key);
      if (edgeId === undefined) {
        edgeId = this.edges.length;
        edgeIds.set(key, edgeId);
        this.edges.push({ from, to, wordIndexes: [] });
        this.outEdges[from].push(edgeId);
      }
      this.edges[edgeId].wordIndexes.push(wordIndex);
    });

    const vertexCount = vertexIds.size;
    this.remaining = Int32Array.from(this.edges, (e) => e.wordIndexes.length);
    this.absorbed = new Uint8Array(vertexCount);
    this.seen = new Uint8Array(vertexCount);
    this.outDegree = new Int32Array(vertexCount);
    this.inDegree = new Int32Array(vertexCount);
    this.sccOf = new Int32Array(vertexCount);
    this.tarjanIndex = new Int32Array(vertexCount);
    this.tarjanLow = new Int32Array(vertexCount);
    this.tarjanOnStack = new Uint8Array(vertexCount);
  }

  run(timeBudgetMs: number): ShiritoriSearchResult {
    this.deadline = performance.now() + timeBudgetMs;

    // 出る単語が多い文字から始めると、早く長い解が見つかりやすい
    const starts = this.loopWords
      .map((_, vertex) => vertex)
      .filter((v) => this.outEdges[v].length > 0 || this.loopWords[v].length)
      .sort((a, b) => this.startScore(b) - this.startScore(a));
    try {
      for (const start of starts) {
        if (this.timedOut || this.bestLength === this.words.length) break;
        this.dfs(start, 0);
      }
    } catch (error) {
      // 数千語規模で再帰が深くなりすぎた場合も、その時点の最長を返す（bestPath は複製済み）
      if (!(error instanceof RangeError)) throw error;
      this.timedOut = true;
    }

    const chain = this.materialize(this.bestPath);
    const used = new Set(chain.indexes);
    return {
      chain: chain.words,
      unusedWords: this.words.filter((_, index) => !used.has(index)),
      isOptimal: !this.timedOut,
    };
  }

  private startScore(vertex: number): number {
    let score = this.loopWords[vertex].length;
    for (const edgeId of this.outEdges[vertex]) {
      score += this.remaining[edgeId];
    }
    return score;
  }

  private dfs(current: number, length: number): void {
    if ((++this.steps & 1023) === 0 && performance.now() > this.deadline) {
      this.timedOut = true;
    }
    if (this.timedOut) return;

    // この文字の自己ループは、着いた時点でまとめて使うのが常に最善
    const absorbsLoops =
      !this.absorbed[current] && this.loopWords[current].length > 0;
    if (absorbsLoops) {
      this.absorbed[current] = 1;
      this.path.push(~current);
      length += this.loopWords[current].length;
    }
    if (length > this.bestLength) {
      this.bestLength = length;
      this.bestPath = [...this.path];
    }

    const { bound, eulerian } = this.analyze(current);
    if (length + bound > this.bestLength) {
      if (eulerian) {
        // 残りを一筆書きで使い切れるので、これ以上の分岐は不要
        const tail = this.eulerTrail(current);
        this.bestLength = length + bound;
        this.bestPath = [...this.path, ...tail];
      } else {
        for (const edgeId of this.branchOrder(current)) {
          this.remaining[edgeId]--;
          this.path.push(edgeId);
          this.dfs(this.edges[edgeId].to, length + 1);
          this.path.pop();
          this.remaining[edgeId]++;
          if (this.timedOut) break;
        }
      }
    }

    if (absorbsLoops) {
      this.absorbed[current] = 0;
      this.path.pop();
    }
  }

  /**
   * current から先で追加できる単語数の上限を求める。
   * 道は強連結成分を一度出ると戻れないので、成分ごとの上限を成分 DAG 上の最長経路で合計する。
   * 成分内では各頂点の「出る数 ≦ 入る数」（始点だけ +1）が成り立つ。
   * 残りの単語を current から一筆書きで使い切れるときは eulerian を返す。
   */
  private analyze(current: number): { bound: number; eulerian: boolean } {
    const reachable = this.reachable;
    reachable.length = 0;
    this.seen[current] = 1;
    reachable.push(current);
    let edgeTotal = 0;
    let loopTotal = 0;
    for (let i = 0; i < reachable.length; i++) {
      const vertex = reachable[i];
      if (!this.absorbed[vertex]) loopTotal += this.loopWords[vertex].length;
      for (const edgeId of this.outEdges[vertex]) {
        const count = this.remaining[edgeId];
        if (!count) continue;
        const to = this.edges[edgeId].to;
        edgeTotal += count;
        this.outDegree[vertex] += count;
        this.inDegree[to] += count;
        if (!this.seen[to]) {
          this.seen[to] = 1;
          reachable.push(to);
        }
      }
    }

    // 一筆書きの条件: current だけ出る数が 1 多いか、全頂点で出入りが等しい（終点だけ入る数が 1 多いのは許す）
    let eulerian = true;
    for (const vertex of reachable) {
      const balance = this.outDegree[vertex] - this.inDegree[vertex];
      if (vertex === current ? balance < 0 || balance > 1 : balance < -1 || balance > 0) {
        eulerian = false;
      }
      this.outDegree[vertex] = 0;
      this.inDegree[vertex] = 0;
    }
    if (eulerian) {
      for (const vertex of reachable) this.seen[vertex] = 0;
      return { bound: edgeTotal + loopTotal, eulerian: true };
    }

    // 強連結成分を求める（Tarjan 法。成分は出口側から順に確定する）
    this.sccBest.length = 0;
    this.tarjanCounter = 0;
    for (const vertex of reachable) this.tarjanIndex[vertex] = -1;
    this.strongConnect(current);

    const sccCount = this.sccBest.length;
    const inner = new Array<number>(sccCount).fill(0);
    const hasInnerEdge = new Array<boolean>(sccCount).fill(false);
    for (const vertex of reachable) {
      const scc = this.sccOf[vertex];
      if (!this.absorbed[vertex]) inner[scc] += this.loopWords[vertex].length;
      for (const edgeId of this.outEdges[vertex]) {
        const count = this.remaining[edgeId];
        if (!count) continue;
        const to = this.edges[edgeId].to;
        if (this.sccOf[to] === scc) {
          this.outDegree[vertex] += count;
          this.inDegree[to] += count;
          hasInnerEdge[scc] = true;
        }
      }
    }
    for (const vertex of reachable) {
      const scc = this.sccOf[vertex];
      const extra = vertex === current ? 1 : 0;
      inner[scc] += Math.min(this.outDegree[vertex], this.inDegree[vertex] + extra);
      this.outDegree[vertex] = 0;
      this.inDegree[vertex] = 0;
    }
    // 成分の途中から入って別の頂点で出る分の +1（current の成分は上で加算済み）
    const currentScc = this.sccOf[current];
    for (let scc = 0; scc < sccCount; scc++) {
      if (scc !== currentScc && hasInnerEdge[scc]) inner[scc]++;
    }
    // 成分間の辺は番号の大きい成分から小さい成分へ向かうので、番号順に最長経路が確定する
    const members: number[][] = Array.from({ length: sccCount }, () => []);
    for (const vertex of reachable) members[this.sccOf[vertex]].push(vertex);
    for (let scc = 0; scc < sccCount; scc++) {
      let exitBest = 0;
      for (const vertex of members[scc]) {
        for (const edgeId of this.outEdges[vertex]) {
          if (!this.remaining[edgeId]) continue;
          const toScc = this.sccOf[this.edges[edgeId].to];
          if (toScc !== scc) exitBest = Math.max(exitBest, 1 + this.sccBest[toScc]);
        }
      }
      this.sccBest[scc] = inner[scc] + exitBest;
    }

    for (const vertex of reachable) this.seen[vertex] = 0;
    return { bound: this.sccBest[currentScc], eulerian: false };
  }

  private strongConnect(vertex: number): void {
    this.tarjanIndex[vertex] = this.tarjanLow[vertex] = this.tarjanCounter++;
    this.tarjanStack.push(vertex);
    this.tarjanOnStack[vertex] = 1;
    for (const edgeId of this.outEdges[vertex]) {
      if (!this.remaining[edgeId]) continue;
      const to = this.edges[edgeId].to;
      if (this.tarjanIndex[to] < 0) {
        this.strongConnect(to);
        this.tarjanLow[vertex] = Math.min(this.tarjanLow[vertex], this.tarjanLow[to]);
      } else if (this.tarjanOnStack[to]) {
        this.tarjanLow[vertex] = Math.min(this.tarjanLow[vertex], this.tarjanIndex[to]);
      }
    }
    if (this.tarjanLow[vertex] === this.tarjanIndex[vertex]) {
      const scc = this.sccBest.length;
      this.sccBest.push(0);
      let member: number;
      do {
        member = this.tarjanStack.pop()!;
        this.tarjanOnStack[member] = 0;
        this.sccOf[member] = scc;
      } while (member !== vertex);
    }
  }

  // 同じ成分に留まる辺を先に、出ていく辺は行き先の上限が大きい順に試す
  private branchOrder(current: number): number[] {
    const currentScc = this.sccOf[current];
    const score = (edgeId: number) => {
      const toScc = this.sccOf[this.edges[edgeId].to];
      return toScc === currentScc ? Infinity : this.sccBest[toScc];
    };
    return this.outEdges[current]
      .filter((edgeId) => this.remaining[edgeId] > 0)
      .map((edgeId) => ({ edgeId, score: score(edgeId) }))
      .sort((a, b) => b.score - a.score)
      .map(({ edgeId }) => edgeId);
  }

  // current から到達できる残りの単語をすべて使う一筆書き（Hierholzer 法）
  private eulerTrail(current: number): number[] {
    const stack: Array<{ vertex: number; edgeId: number }> = [
      { vertex: current, edgeId: -1 },
    ];
    const trail: number[] = [];
    while (stack.length) {
      const { vertex } = stack[stack.length - 1];
      const next = this.outEdges[vertex].find((e) => this.remaining[e] > 0);
      if (next === undefined) {
        const { edgeId } = stack.pop()!;
        if (edgeId >= 0) trail.push(edgeId);
      } else {
        this.remaining[next]--;
        stack.push({ vertex: this.edges[next].to, edgeId: next });
      }
    }
    trail.reverse();
    for (const edgeId of trail) this.remaining[edgeId]++;

    // 途中で初めて着いた文字の自己ループも差し込む
    const result: number[] = [];
    const absorbedHere: number[] = [];
    for (const edgeId of trail) {
      result.push(edgeId);
      const to = this.edges[edgeId].to;
      if (!this.absorbed[to] && this.loopWords[to].length) {
        this.absorbed[to] = 1;
        absorbedHere.push(to);
        result.push(~to);
      }
    }
    for (const vertex of absorbedHere) this.absorbed[vertex] = 0;
    return result;
  }

  private materialize(path: number[]): { words: string[]; indexes: number[] } {
    const nextWord = this.edges.map(() => 0);
    const indexes: number[] = [];
    for (const step of path) {
      if (step < 0) {
        indexes.push(...this.loopWords[~step]);
      } else {
        indexes.push(this.edges[step].wordIndexes[nextWord[step]++]);
      }
    }
    return { words: indexes.map((index) => this.words[index]), indexes };
  }
}

export function searchLongestShiritori(
  words: string[],
  timeBudgetMs = SEARCH_TIME_BUDGET_MS,
): ShiritoriSearchResult {
  if (words.length === 0) {
    return { chain: [], unusedWords: [], isOptimal: true };
  }
  return new LongestTrailSearch(words).run(timeBudgetMs);
}

export class ShiritoriManager {
  private static longestShiritoris: string[] = []; // 最長のしりとりを保持する配列
  private static unusedWords: string[] = []; // 使用されなかった単語リスト
  private static optimal = true; // 最長と確定したか（打ち切り時は false）
  public static words: string[] = [];
  constructor() {}

  public static setWordsByText(inputText: string) {
    if (inputText && inputText.trim()) {
      ShiritoriManager.words = inputText
        .trim()
        .split(/\r\n|\r|\n/)
        .filter(Boolean);
    } else {
      ShiritoriManager.words = [];
    }
  }

  // 最長しりとりを取得するメソッド
  public static getLongestShiritoris(): string[] {
    const result = searchLongestShiritori(this.words);
    this.longestShiritoris = result.chain;
    this.unusedWords = result.unusedWords;
    this.optimal = result.isOptimal;
    return this.longestShiritoris;
  }

  // 未使用の単語リストを取得するメソッド
  public static getUnusedWords(): string[] {
    return this.unusedWords;
  }

  // 直前の探索で最長と確定したかを返すメソッド（打ち切り時は false）
  public static isOptimal(): boolean {
    return this.optimal;
  }
}
