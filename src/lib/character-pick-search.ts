import { normalizeSearchWord } from "@/class/SearchManager";

export const CHARACTER_PICK_RESULT_MAXCOUNT = 200;

export type CharacterPickSearchResult = {
  word: string;
  length: number;
};

export type CharacterPickSearchOutcome = {
  normalizedSources: string[];
  results: CharacterPickSearchResult[];
  limitReached: boolean;
};

type CharacterPickSearchOptions = {
  sourceWords: string[];
  dictionaryWords: string[];
  minPick: number;
  maxPick: number;
  resultLimit?: number;
};

type FlowEdge = {
  to: number;
  rev: number;
  cap: number;
};

type SourceProfile = {
  length: number;
  counts: Map<string, number>;
};

class Dinic {
  private graph: FlowEdge[][];

  constructor(nodeCount: number) {
    this.graph = Array.from({ length: nodeCount }, () => []);
  }

  addEdge(from: number, to: number, cap: number): void {
    const forward: FlowEdge = {
      to,
      rev: this.graph[to].length,
      cap,
    };
    const backward: FlowEdge = {
      to: from,
      rev: this.graph[from].length,
      cap: 0,
    };
    this.graph[from].push(forward);
    this.graph[to].push(backward);
  }

  maxFlow(source: number, sink: number): number {
    let flow = 0;
    const level = new Array<number>(this.graph.length).fill(0);
    const iter = new Array<number>(this.graph.length).fill(0);

    while (this.buildLevelGraph(source, sink, level)) {
      iter.fill(0);
      let pushed = this.sendFlow(source, sink, Number.MAX_SAFE_INTEGER, level, iter);
      while (pushed > 0) {
        flow += pushed;
        pushed = this.sendFlow(
          source,
          sink,
          Number.MAX_SAFE_INTEGER,
          level,
          iter,
        );
      }
    }

    return flow;
  }

  private buildLevelGraph(source: number, sink: number, level: number[]): boolean {
    level.fill(-1);
    const queue = [source];
    level[source] = 0;

    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head];
      for (const edge of this.graph[current]) {
        if (edge.cap > 0 && level[edge.to] < 0) {
          level[edge.to] = level[current] + 1;
          queue.push(edge.to);
        }
      }
    }

    return level[sink] >= 0;
  }

  private sendFlow(
    current: number,
    sink: number,
    flow: number,
    level: number[],
    iter: number[],
  ): number {
    if (current === sink) {
      return flow;
    }

    for (; iter[current] < this.graph[current].length; iter[current] += 1) {
      const edge = this.graph[current][iter[current]];
      if (edge.cap <= 0 || level[current] >= level[edge.to]) {
        continue;
      }

      const pushed = this.sendFlow(
        edge.to,
        sink,
        Math.min(flow, edge.cap),
        level,
        iter,
      );
      if (pushed <= 0) {
        continue;
      }

      edge.cap -= pushed;
      this.graph[edge.to][edge.rev].cap += pushed;
      return pushed;
    }

    return 0;
  }
}

const countCharacters = (word: string): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const char of Array.from(word)) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  return counts;
};

const buildSourceProfiles = (words: string[]): SourceProfile[] =>
  words.map((word) => ({
    length: Array.from(word).length,
    counts: countCharacters(word),
  }));

const hasEnoughCharacters = (
  demand: Map<string, number>,
  aggregateSupply: Map<string, number>,
): boolean => {
  for (const [char, count] of demand.entries()) {
    if ((aggregateSupply.get(char) ?? 0) < count) {
      return false;
    }
  }
  return true;
};

const canBuildWord = ({
  word,
  profiles,
  aggregateSupply,
  minPick,
  maxPick,
}: {
  word: string;
  profiles: SourceProfile[];
  aggregateSupply: Map<string, number>;
  minPick: number;
  maxPick: number;
}): boolean => {
  const wordLength = Array.from(word).length;
  const effectiveMaxes = profiles.map((profile) =>
    Math.min(maxPick, profile.length),
  );

  if (effectiveMaxes.some((max) => max < minPick)) {
    return false;
  }

  const minTotal = minPick * profiles.length;
  const maxTotal = effectiveMaxes.reduce((sum, max) => sum + max, 0);
  if (wordLength < minTotal || wordLength > maxTotal) {
    return false;
  }

  const demand = countCharacters(word);
  if (!hasEnoughCharacters(demand, aggregateSupply)) {
    return false;
  }

  const chars = Array.from(demand.keys());
  const start = 0;
  const sourceOffset = 1;
  const charOffset = sourceOffset + profiles.length;
  const sink = charOffset + chars.length;
  const superSource = sink + 1;
  const superSink = superSource + 1;
  const nodeCount = superSink + 1;
  const balances = new Array<number>(nodeCount).fill(0);
  const dinic = new Dinic(nodeCount);

  const addBoundedEdge = (
    from: number,
    to: number,
    lower: number,
    upper: number,
  ): boolean => {
    if (upper < lower) {
      return false;
    }
    balances[from] -= lower;
    balances[to] += lower;
    dinic.addEdge(from, to, upper - lower);
    return true;
  };

  for (let index = 0; index < profiles.length; index += 1) {
    if (
      !addBoundedEdge(
        start,
        sourceOffset + index,
        minPick,
        effectiveMaxes[index],
      )
    ) {
      return false;
    }

    for (let charIndex = 0; charIndex < chars.length; charIndex += 1) {
      const char = chars[charIndex];
      const capacity = profiles[index].counts.get(char) ?? 0;
      if (capacity > 0) {
        addBoundedEdge(
          sourceOffset + index,
          charOffset + charIndex,
          0,
          capacity,
        );
      }
    }
  }

  for (let charIndex = 0; charIndex < chars.length; charIndex += 1) {
    const demandCount = demand.get(chars[charIndex]) ?? 0;
    if (!addBoundedEdge(charOffset + charIndex, sink, demandCount, demandCount)) {
      return false;
    }
  }

  addBoundedEdge(sink, start, 0, Number.MAX_SAFE_INTEGER);

  let requiredFlow = 0;
  for (let node = 0; node < nodeCount; node += 1) {
    if (balances[node] > 0) {
      dinic.addEdge(superSource, node, balances[node]);
      requiredFlow += balances[node];
    } else if (balances[node] < 0) {
      dinic.addEdge(node, superSink, -balances[node]);
    }
  }

  return dinic.maxFlow(superSource, superSink) === requiredFlow;
};

export function runCharacterPickSearch({
  sourceWords,
  dictionaryWords,
  minPick,
  maxPick,
  resultLimit = CHARACTER_PICK_RESULT_MAXCOUNT,
}: CharacterPickSearchOptions): Promise<CharacterPickSearchOutcome> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        if (!Number.isInteger(minPick) || !Number.isInteger(maxPick)) {
          throw new Error("最小と最大は整数で指定してください。");
        }
        if (minPick < 0 || maxPick < 0) {
          throw new Error("最小と最大は0以上で指定してください。");
        }
        if (minPick > maxPick) {
          throw new Error("最小は最大以下にしてください。");
        }

        const normalizedSources = sourceWords.map((word) =>
          normalizeSearchWord(word.trim()),
        );
        if (normalizedSources.some((word) => word.length === 0)) {
          throw new Error("単語を入力してください。");
        }

        const profiles = buildSourceProfiles(normalizedSources);
        const aggregateSupply = new Map<string, number>();
        for (const profile of profiles) {
          for (const [char, count] of profile.counts.entries()) {
            aggregateSupply.set(char, (aggregateSupply.get(char) ?? 0) + count);
          }
        }

        const results: CharacterPickSearchResult[] = [];
        const seen = new Set<string>();
        let limitReached = false;

        for (const word of dictionaryWords) {
          if (seen.has(word)) {
            continue;
          }
          seen.add(word);

          if (
            canBuildWord({
              word,
              profiles,
              aggregateSupply,
              minPick,
              maxPick,
            })
          ) {
            results.push({ word, length: Array.from(word).length });
            if (results.length >= resultLimit) {
              limitReached = true;
              break;
            }
          }
        }

        resolve({
          normalizedSources,
          results,
          limitReached,
        });
      } catch (error) {
        reject(error);
      }
    }, 0);
  });
}
