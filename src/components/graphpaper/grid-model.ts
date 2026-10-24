// 方眼紙のセル・範囲・クリップボードを扱う純粋関数群。UI 状態は持たない。

export type Cell = { value: string; color: number };
export type Grid = Cell[][];
export type Pos = { row: number; col: number };
export type Range = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};
// 外部テキストの貼り付けは色を持たないので、貼り付け先の色を残す
export type PasteCell = { value: string; color?: number };

export const MIN_GRID_SIZE = 1;
export const MAX_GRID_SIZE = 20;

export const CELL_COLORS = [
  { label: "なし", className: "bg-white text-gray-900" },
  { label: "赤", className: "bg-red-500 text-white" },
  { label: "緑", className: "bg-green-500 text-white" },
  { label: "青", className: "bg-blue-500 text-white" },
  { label: "黄", className: "bg-yellow-400 text-gray-900" },
] as const;

export const EMPTY_CELL: Cell = { value: "", color: 0 };

export const isBlack = (value: string) => value === "#" || value === "＃";

export const clampGridSize = (value: number) =>
  Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, value));

export const createGrid = (rows: number, cols: number, prev?: Grid): Grid =>
  Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => prev?.[r]?.[c] ?? EMPTY_CELL),
  );

export const clampPos = (pos: Pos, rows: number, cols: number): Pos => ({
  row: Math.min(rows - 1, Math.max(0, pos.row)),
  col: Math.min(cols - 1, Math.max(0, pos.col)),
});

export const toRange = (a: Pos, b: Pos): Range => ({
  top: Math.min(a.row, b.row),
  left: Math.min(a.col, b.col),
  bottom: Math.max(a.row, b.row),
  right: Math.max(a.col, b.col),
});

export const inRange = (range: Range, row: number, col: number) =>
  row >= range.top &&
  row <= range.bottom &&
  col >= range.left &&
  col <= range.right;

export const columnLabel = (col: number) => String.fromCharCode(65 + col);

const cellLabel = (row: number, col: number) => `${columnLabel(col)}${row + 1}`;

export const rangeLabel = (range: Range) => {
  const start = cellLabel(range.top, range.left);
  if (range.top === range.bottom && range.left === range.right) {
    return start;
  }
  return `${start}:${cellLabel(range.bottom, range.right)}`;
};

export const mapRange = (
  grid: Grid,
  range: Range,
  fn: (cell: Cell) => Cell,
): Grid =>
  grid.map((row, r) =>
    r < range.top || r > range.bottom
      ? row
      : row.map((cell, c) =>
          c < range.left || c > range.right ? cell : fn(cell),
        ),
  );

export const nextPos = (pos: Pos, rows: number, cols: number): Pos => {
  if (pos.col < cols - 1) return { row: pos.row, col: pos.col + 1 };
  if (pos.row < rows - 1) return { row: pos.row + 1, col: 0 };
  return pos;
};

export const prevPos = (pos: Pos, cols: number): Pos => {
  if (pos.col > 0) return { row: pos.row, col: pos.col - 1 };
  if (pos.row > 0) return { row: pos.row - 1, col: cols - 1 };
  return pos;
};

// Excel の Ctrl+矢印 と同じく、入力済みブロックの端か次の入力済みセル・グリッド端まで移動する
export const jumpToEdge = (
  grid: Grid,
  pos: Pos,
  dRow: number,
  dCol: number,
): Pos => {
  const inside = (r: number, c: number) =>
    r >= 0 && r < grid.length && c >= 0 && c < grid[0].length;
  const filled = (r: number, c: number) => grid[r][c].value !== "";
  let { row, col } = pos;
  if (!inside(row + dRow, col + dCol)) return pos;
  if (filled(row, col) && filled(row + dRow, col + dCol)) {
    while (inside(row + dRow, col + dCol) && filled(row + dRow, col + dCol)) {
      row += dRow;
      col += dCol;
    }
    return { row, col };
  }
  row += dRow;
  col += dCol;
  while (!filled(row, col) && inside(row + dRow, col + dCol)) {
    row += dRow;
    col += dCol;
  }
  return { row, col };
};

// 1セル1文字で左から右へ書き込み、行末で次の行へ折り返す。空白は空セルとして扱う
export const writeChars = (
  grid: Grid,
  start: Pos,
  text: string,
): { grid: Grid; end: Pos } => {
  const rows = grid.length;
  const cols = grid[0].length;
  const next = grid.map((row) => [...row]);
  let pos = start;
  for (const ch of Array.from(text)) {
    if (ch === "\n" || ch === "\r") continue;
    next[pos.row][pos.col] = {
      ...next[pos.row][pos.col],
      value: ch.trim() === "" ? "" : ch,
    };
    const moved = nextPos(pos, rows, cols);
    // 最終セルに達したら残りの文字は捨てる
    if (moved === pos) break;
    pos = moved;
  }
  return { grid: next, end: pos };
};

export const sliceRange = (grid: Grid, range: Range): Grid =>
  grid
    .slice(range.top, range.bottom + 1)
    .map((row) => row.slice(range.left, range.right + 1));

const normalizeText = (text: string) =>
  text.replace(/\r\n?/g, "\n").replace(/\n$/, "");

export const sameClipboardText = (a: string, b: string) =>
  normalizeText(a) === normalizeText(b);

// Excel / スプレッドシートと相互に貼り付けられる TSV 形式
export const toClipboardText = (block: Grid) =>
  block.map((row) => row.map((cell) => cell.value).join("\t")).join("\n");

// タブ区切りなら1フィールド1セル、タブなしなら1文字1セルとして展開する
export const parseClipboardText = (text: string): PasteCell[][] => {
  const lines = normalizeText(text).split("\n");
  const hasTab = lines.some((line) => line.includes("\t"));
  return lines.map((line) =>
    (hasTab
      ? line.split("\t").map((field) => Array.from(field.trim())[0] ?? "")
      : Array.from(line)
    ).map((value) => ({ value: value.trim() === "" ? "" : value })),
  );
};

// 1セルだけをコピーした場合は選択範囲全体に複製する。はみ出す分は最大サイズまでグリッドを広げる
export const pasteBlock = (
  grid: Grid,
  target: Range,
  block: PasteCell[][],
): { grid: Grid; range: Range } => {
  const single = block.length === 1 && block[0].length === 1;
  const height = single ? target.bottom - target.top + 1 : block.length;
  const width = single
    ? target.right - target.left + 1
    : Math.max(1, ...block.map((row) => row.length));
  const rows = clampGridSize(Math.max(grid.length, target.top + height));
  const cols = clampGridSize(Math.max(grid[0].length, target.left + width));
  const range: Range = {
    top: target.top,
    left: target.left,
    bottom: Math.min(rows - 1, target.top + height - 1),
    right: Math.min(cols - 1, target.left + width - 1),
  };
  const next = createGrid(rows, cols, grid);
  for (let r = range.top; r <= range.bottom; r++) {
    for (let c = range.left; c <= range.right; c++) {
      const src = single ? block[0][0] : block[r - range.top][c - range.left];
      if (!src) continue;
      next[r][c] = {
        value: src.value,
        color: src.color ?? next[r][c].color,
      };
    }
  }
  return { grid: next, range };
};
