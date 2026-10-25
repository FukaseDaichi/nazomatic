"use client";

import React, { useEffect, useRef, useState } from "react";
import GraphPaperToolbar from "./graph-paper-toolbar";
import {
  CELL_COLORS,
  EMPTY_CELL,
  type Grid,
  type Pos,
  type Range,
  clampGridSize,
  clampPos,
  columnLabel,
  createGrid,
  inRange,
  isBlack,
  jumpToEdge,
  mapRange,
  nextPos,
  parseClipboardText,
  pasteBlock,
  prevPos,
  rangeLabel,
  sameClipboardText,
  sliceRange,
  toClipboardText,
  toRange,
  writeChars,
} from "./grid-model";

const CELL = 32;
const HEADER = 24;
const HISTORY_LIMIT = 100;

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

type Selection = { anchor: Pos; focus: Pos };
type Clip = { text: string; block: Grid; cutRange: Range | null };

// グリッド外枠1px + 見出し列 + セル間1px の位置
const cellX = (col: number) => 1 + HEADER + 1 + col * (CELL + 1);
const cellY = (row: number) => 1 + HEADER + 1 + row * (CELL + 1);

const rangeStyle = (range: Range): React.CSSProperties => ({
  left: cellX(range.left) - 1,
  top: cellY(range.top) - 1,
  width: (range.right - range.left + 1) * (CELL + 1) + 1,
  height: (range.bottom - range.top + 1) * (CELL + 1) + 1,
});

const posFromPoint = (x: number, y: number): Pos | null => {
  const el = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-row][data-col]");
  if (!el) return null;
  return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
};

export default function GraphPaperComponent() {
  const [grid, setGrid] = useState<Grid>(() => createGrid(10, 10));
  const [past, setPast] = useState<Grid[]>([]);
  const [future, setFuture] = useState<Grid[]>([]);
  const [selection, setSelection] = useState<Selection>({
    anchor: { row: 0, col: 0 },
    focus: { row: 0, col: 0 },
  });
  const [copyRange, setCopyRange] = useState<Range | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isRangeMode, setIsRangeMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clipRef = useRef<Clip | null>(null);
  const composingRef = useRef(false);
  const draggingRef = useRef(false);

  const rows = grid.length;
  const cols = grid[0].length;
  // 元に戻す等でグリッドが縮んでも選択位置がはみ出さないようにする
  const anchor = clampPos(selection.anchor, rows, cols);
  const focus = clampPos(selection.focus, rows, cols);
  const range = toRange(anchor, focus);
  const isSingle = range.top === range.bottom && range.left === range.right;
  // 元に戻す・入力・サイズ変更と食い違わないよう、トグルの状態はグリッドから決める
  const cells = grid.flat();
  const hasEmpty = cells.some((cell) => cell.value === "");
  const hasBlack = cells.some((cell) => isBlack(cell.value));
  const isHashFilled = !hasEmpty && hasBlack;

  useEffect(() => {
    const stopDrag = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    return () => {
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, []);

  useEffect(() => {
    // PC では開いてすぐ入力できるようにする。スマホでキーボードを勝手に開かない
    if (window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const focusInput = () => inputRef.current?.focus({ preventScroll: true });

  // Excel と同じく、切り取り後に別の編集をしたら移動を取り消す
  const cancelCut = () => {
    if (!clipRef.current?.cutRange) return;
    clipRef.current = null;
    setCopyRange(null);
  };

  const commit = (next: Grid) => {
    cancelCut();
    setPast((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), grid]);
    setFuture([]);
    setGrid(next);
  };

  const undo = () => {
    if (past.length === 0) return;
    cancelCut();
    setFuture((prev) => [grid, ...prev]);
    setGrid(past[past.length - 1]);
    setPast((prev) => prev.slice(0, -1));
  };

  const redo = () => {
    if (future.length === 0) return;
    cancelCut();
    setPast((prev) => [...prev, grid]);
    setGrid(future[0]);
    setFuture((prev) => prev.slice(1));
  };

  const select = (pos: Pos) => setSelection({ anchor: pos, focus: pos });

  const selectRange = (target: Range) =>
    setSelection({
      anchor: { row: target.top, col: target.left },
      focus: { row: target.bottom, col: target.right },
    });

  const typeText = (text: string) => {
    if (!text) return;
    const result = writeChars(grid, anchor, text);
    commit(result.grid);
    select(result.end);
  };

  const clearValues = () =>
    commit(mapRange(grid, range, (cell) => ({ ...cell, value: "" })));

  const applyColor = (color: number) =>
    commit(mapRange(grid, range, (cell) => ({ ...cell, color })));

  const copy = (cut: boolean) => {
    const text = toClipboardText(sliceRange(grid, range));
    clipRef.current = {
      text,
      block: sliceRange(grid, range),
      cutRange: cut ? range : null,
    };
    setCopyRange(range);
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const pasteText = (text: string) => {
    const clip = clipRef.current;
    const internal = clip && sameClipboardText(clip.text, text) ? clip : null;
    // 切り取り後の貼り付けは移動として扱い、元の範囲を空にする
    const base = internal?.cutRange
      ? mapRange(grid, internal.cutRange, () => EMPTY_CELL)
      : grid;
    const result = pasteBlock(
      base,
      range,
      internal?.block ?? parseClipboardText(text),
    );
    // 切り取りの貼り付けは1回限りで、commit が切り取り状態を解除する
    commit(result.grid);
    selectRange(result.range);
  };

  const pasteFromClipboard = async () => {
    try {
      pasteText(await navigator.clipboard.readText());
    } catch {
      // 読み取り権限がない場合は画面内でコピーした内容を使う
      if (clipRef.current) pasteText(clipRef.current.text);
    }
  };

  const resize = (nextRows: number, nextCols: number) => {
    const r = clampGridSize(nextRows);
    const c = clampGridSize(nextCols);
    if (r === rows && c === cols) return;
    commit(createGrid(r, c, grid));
  };

  const toggleHashFill = (checked: boolean) => {
    // 空白も＃もない状態では変化がないので、空の履歴を積まない
    if (checked ? !hasEmpty : !hasBlack) return;
    commit(
      grid.map((row) =>
        row.map((cell) => {
          if (checked) return cell.value ? cell : { ...cell, value: "＃" };
          return isBlack(cell.value) ? { ...cell, value: "" } : cell;
        }),
      ),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const mod = e.metaKey || e.ctrlKey;
    const arrow = ARROWS[e.key];

    if (arrow) {
      e.preventDefault();
      const from = e.shiftKey ? focus : anchor;
      const to = mod
        ? jumpToEdge(grid, from, arrow[0], arrow[1])
        : clampPos(
            { row: from.row + arrow[0], col: from.col + arrow[1] },
            rows,
            cols,
          );
      if (e.shiftKey) setSelection({ anchor, focus: to });
      else select(to);
      return;
    }

    if (mod && !e.altKey) {
      switch (e.key.toLowerCase()) {
        case "a":
          selectRange({ top: 0, left: 0, bottom: rows - 1, right: cols - 1 });
          break;
        case "c":
          copy(false);
          break;
        case "x":
          copy(true);
          break;
        case "z":
          if (e.shiftKey) redo();
          else undo();
          break;
        case "y":
          redo();
          break;
        default:
          // Ctrl/⌘ + V は paste イベントで受け取る
          return;
      }
      e.preventDefault();
      return;
    }

    // Option + 数字は記号入力になるため、文字ではなく物理キーで判定する
    const digit = /^Digit([0-9])$/.exec(e.code);
    if (e.altKey && digit && Number(digit[1]) < CELL_COLORS.length) {
      e.preventDefault();
      applyColor(Number(digit[1]));
      return;
    }

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        select(
          clampPos(
            { row: anchor.row + (e.shiftKey ? -1 : 1), col: anchor.col },
            rows,
            cols,
          ),
        );
        break;
      case "Tab": {
        const to = e.shiftKey
          ? prevPos(anchor, cols)
          : nextPos(anchor, rows, cols);
        // 端ではフォーカスをページへ戻し、キーボード操作で閉じ込めない
        if (to === anchor) return;
        e.preventDefault();
        select(to);
        break;
      }
      case "Delete":
        e.preventDefault();
        clearValues();
        break;
      case "Backspace": {
        e.preventDefault();
        if (!isSingle || grid[anchor.row][anchor.col].value) {
          clearValues();
          break;
        }
        // 空セルでは直前のセルへ戻って消す（連続入力の打ち直し用）
        const back = prevPos(anchor, cols);
        commit(
          mapRange(grid, toRange(back, back), (cell) => ({
            ...cell,
            value: "",
          })),
        );
        select(back);
        break;
      }
      case "Escape":
        clipRef.current = null;
        setCopyRange(null);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (composingRef.current) return;
    const text = e.target.value;
    e.target.value = "";
    typeText(text);
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLInputElement>,
  ) => {
    composingRef.current = false;
    setIsComposing(false);
    const text = e.currentTarget.value;
    e.currentTarget.value = "";
    typeText(text);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-corner]")) {
      e.preventDefault();
      selectRange({ top: 0, left: 0, bottom: rows - 1, right: cols - 1 });
      focusInput();
      return;
    }
    const header = target.closest<HTMLElement>(
      "[data-header-row],[data-header-col]",
    );
    if (header) {
      e.preventDefault();
      const r = header.dataset.headerRow;
      const c = header.dataset.headerCol;
      const from = e.shiftKey ? range : null;
      if (r !== undefined) {
        const row = Number(r);
        selectRange({
          top: Math.min(row, from?.top ?? row),
          bottom: Math.max(row, from?.bottom ?? row),
          left: 0,
          right: cols - 1,
        });
      } else if (c !== undefined) {
        const col = Number(c);
        selectRange({
          top: 0,
          bottom: rows - 1,
          left: Math.min(col, from?.left ?? col),
          right: Math.max(col, from?.right ?? col),
        });
      }
      focusInput();
      return;
    }
    const pos = posFromPoint(e.clientX, e.clientY);
    // タッチは範囲選択モード以外ではスクロールを優先し、タップ確定時に選択する
    if (!pos || (e.pointerType !== "mouse" && !isRangeMode)) return;
    e.preventDefault();
    if (e.shiftKey) setSelection({ anchor, focus: pos });
    else select(pos);
    draggingRef.current = true;
    if (e.pointerType === "mouse") focusInput();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const pos = posFromPoint(e.clientX, e.clientY);
    if (pos) setSelection((prev) => ({ ...prev, focus: pos }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" || isRangeMode) return;
    const pos = posFromPoint(e.clientX, e.clientY);
    if (!pos) return;
    select(pos);
    focusInput();
  };

  const activeCell = grid[anchor.row][anchor.col];

  return (
    <main className="flex justify-center px-3 py-4 sm:px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-purple-500/20 bg-linear-to-b/srgb from-gray-900 to-gray-800 p-3 shadow-xl sm:p-6">
        <h1 className="mb-1 text-center text-3xl font-bold text-purple-400">
          方眼紙
        </h1>
        <p className="mb-3 text-center text-xs text-gray-400">
          1マス1文字。＃で黒塗り。範囲を選んでコピー・貼り付け・塗りつぶしができます。
        </p>

        <GraphPaperToolbar
          selectionLabel={rangeLabel(range)}
          activeColor={activeCell.color}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          rows={rows}
          cols={cols}
          isHashFilled={isHashFilled}
          isRangeMode={isRangeMode}
          onColor={(color) => {
            applyColor(color);
            if (!isRangeMode) focusInput();
          }}
          onCopy={() => copy(false)}
          onCut={() => copy(true)}
          onPaste={pasteFromClipboard}
          onClear={clearValues}
          onUndo={undo}
          onRedo={redo}
          onResize={resize}
          onHashFill={toggleHashFill}
          onRangeMode={(checked) => {
            setIsRangeMode(checked);
            if (checked) inputRef.current?.blur();
          }}
        />

        <div className="overflow-x-auto pb-2">
          <div
            className="relative mx-auto w-max select-none"
            style={{ touchAction: isRangeMode ? "none" : undefined }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div
              className="grid gap-px border border-gray-600 bg-gray-600"
              style={{
                gridTemplateColumns: `${HEADER}px repeat(${cols}, ${CELL}px)`,
                gridTemplateRows: `${HEADER}px repeat(${rows}, ${CELL}px)`,
              }}
            >
              <div
                data-corner
                className="cursor-pointer bg-gray-800"
                aria-hidden
              />
              {Array.from({ length: cols }, (_, c) => (
                <div
                  key={`h-${c}`}
                  data-header-col={c}
                  className={`flex cursor-pointer items-center justify-center text-xs ${
                    c >= range.left && c <= range.right
                      ? "bg-gray-700 font-semibold text-purple-300"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {columnLabel(c)}
                </div>
              ))}
              {grid.map((row, r) => (
                <React.Fragment key={`r-${r}`}>
                  <div
                    data-header-row={r}
                    className={`flex cursor-pointer items-center justify-center text-xs ${
                      r >= range.top && r <= range.bottom
                        ? "bg-gray-700 font-semibold text-purple-300"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {r + 1}
                  </div>
                  {row.map((cell, c) => (
                    <div
                      key={`${r}-${c}`}
                      data-row={r}
                      data-col={c}
                      className={`relative flex cursor-cell items-center justify-center text-base ${
                        isBlack(cell.value)
                          ? "bg-black text-gray-800"
                          : CELL_COLORS[cell.color].className
                      }`}
                    >
                      {cell.value}
                      {!isSingle &&
                        inRange(range, r, c) &&
                        !(r === anchor.row && c === anchor.col) && (
                          <span className="pointer-events-none absolute inset-0 bg-purple-500/30" />
                        )}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>

            {copyRange && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-purple-300"
                style={rangeStyle(copyRange)}
              />
            )}
            <div
              className="pointer-events-none absolute border-2 border-purple-400"
              style={rangeStyle(range)}
            />
            <input
              ref={inputRef}
              aria-label={`方眼紙 ${rangeLabel(toRange(anchor, anchor))} の入力`}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={`absolute h-8 text-center text-base text-gray-900 outline-hidden ${
                isComposing
                  ? "z-10 w-auto min-w-8 bg-white px-1 caret-purple-500 shadow-lg ring-2 ring-purple-400"
                  : "pointer-events-none w-8 bg-transparent caret-transparent opacity-0"
              }`}
              style={{ left: cellX(anchor.col), top: cellY(anchor.row) }}
              size={isComposing ? 6 : 1}
              onKeyDown={handleKeyDown}
              onChange={handleInputChange}
              onCompositionStart={() => {
                composingRef.current = true;
                setIsComposing(true);
              }}
              onCompositionEnd={handleCompositionEnd}
              onPaste={(e) => {
                e.preventDefault();
                pasteText(e.clipboardData.getData("text/plain"));
              }}
            />
          </div>
        </div>

        <details className="mt-3 rounded-xl border border-gray-700 bg-gray-900/75 p-3 text-xs leading-relaxed text-gray-300">
          <summary className="cursor-pointer text-sm font-semibold text-gray-100">
            操作方法
          </summary>
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 not-any-pointer-fine:hidden">
            <dt className="text-purple-300">矢印 / Enter / Tab</dt>
            <dd>セル移動（Shift で逆方向）</dd>
            <dt className="text-purple-300">
              Shift + 矢印・クリック・ドラッグ
            </dt>
            <dd>範囲選択。行番号・列記号のクリックで行・列全体</dd>
            <dt className="text-purple-300">Ctrl/⌘ + 矢印</dt>
            <dd>入力済みブロックの端へジャンプ（Shift 併用で範囲選択）</dd>
            <dt className="text-purple-300">Ctrl/⌘ + A / C / X / V</dt>
            <dd>
              全選択 / コピー / 切り取り / 貼り付け（切り取り→貼り付けで移動）
            </dd>
            <dt className="text-purple-300">Ctrl/⌘ + Z / Shift + Z</dt>
            <dd>元に戻す / やり直し</dd>
            <dt className="text-purple-300">Alt/Option + 0〜4</dt>
            <dd>塗りつぶし（0 なし・1 赤・2 緑・3 青・4 黄）</dd>
            <dt className="text-purple-300">Delete / Backspace</dt>
            <dd>選択範囲の文字を消去（色は残る）</dd>
            <dt className="text-purple-300">Esc</dt>
            <dd>コピー範囲の点線を解除</dd>
          </dl>
          <ul className="mt-2 list-disc space-y-1 pl-4 not-any-pointer-coarse:hidden">
            <li>マスをタップして入力。続けて打つと右のマスへ進みます。</li>
            <li>「範囲選択」をオンにすると、なぞって複数マスを選べます。</li>
            <li>選んだ範囲に上のボタンで色・コピー・貼り付けができます。</li>
          </ul>
          <p className="mt-2 text-gray-400">
            コピーはタブ区切りなので Excel
            やスプレッドシートとも貼り付け合えます。行数・列数は1〜20です。
          </p>
        </details>
      </div>
    </main>
  );
}
