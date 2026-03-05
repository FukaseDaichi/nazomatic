"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

const patterns = [
  "bg-white text-gray-900",
  "bg-red-500 text-white",
  "bg-green-500 text-white",
  "bg-blue-500 text-white",
  "bg-yellow-500 text-white",
];

const MIN_GRID_SIZE = 1;
const MAX_GRID_SIZE = 20;

const getPattern = (num: number) => {
  if (typeof num !== "number") {
    return patterns[0];
  }
  return patterns[num % patterns.length];
};

const clampGridSize = (value: number) =>
  Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, value));

const parseGridSize = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return MIN_GRID_SIZE;
  }
  return clampGridSize(parsed);
};

export default function GraphPaperComponent() {
  //ヘルプテキスト表示メソッド
  const [showHelp, setShowHelp] = useState(false);
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const [lastClickedCell, setLastClickedCell] = useState<{
    row: number;
    col: number;
    time: number;
  } | null>(null);
  const [grid, setGrid] = useState(
    Array(rows)
      .fill(null)
      .map(() => Array(cols).fill("")),
  );
  const [tmpGrid, setTmpGrid] = useState(
    Array(rows)
      .fill(null)
      .map(() => Array(cols).fill("")),
  );
  const [gridPattern, setGridPattern] = useState(
    Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(0)),
  );
  const [currentCell, setCurrentCell] = useState({ row: 0, col: 0 });
  const [isComposing, setIsComposing] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isAutoFill, setIsAutoFill] = useState(false);
  const [isColorMode, setColorMode] = useState(false);

  const [disableScroll, setDisableScroll] = useState(false);

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (disableScroll) {
        e.preventDefault();
      }
    };
    // passive: false で touchmove イベントを登録
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      // クリーンアップ時に解除
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, [disableScroll]); // disableScroll の変更を監視

  const changePattern = useCallback(
    (row: number, col: number, val: number, isReverse: boolean) => {
      const newGridPattern = [...gridPattern];
      if (isReverse) {
        newGridPattern[row][col] =
          newGridPattern[row][col] % patterns.length === val % patterns.length
            ? 0
            : val;
      } else {
        //変更がない場合は処理なし
        if (newGridPattern[row][col] === val) {
          return;
        }
        newGridPattern[row][col] = val;
      }
      setGridPattern(newGridPattern);
    },
    [gridPattern],
  );

  //スマートフォンタッチ操作用
  const [touchStartPos, setTouchStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setGrid((prevGrid) => {
      const newGrid = Array(rows)
        .fill(null)
        .map((_, rowIndex) =>
          Array(cols)
            .fill(null)
            .map((_, colIndex) => {
              return prevGrid[rowIndex]?.[colIndex] || "";
            }),
        );
      return newGrid;
    });
    setTmpGrid(
      Array(rows)
        .fill(null)
        .map(() => Array(cols).fill("")),
    );

    //パターンの保持
    setGridPattern((prevGridPattern) => {
      const newGridPattern = Array(rows)
        .fill(null)
        .map((_, rowIndex) =>
          Array(cols)
            .fill(null)
            .map((_, colIndex) => {
              return prevGridPattern[rowIndex]?.[colIndex] || 0;
            }),
        );
      return newGridPattern;
    });
  }, [rows, cols]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 行列がフォーカスされている場合は、十字キーイベントを無視
      if (
        document.activeElement?.id === "rows" ||
        document.activeElement?.id === "cols"
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          if (e.shiftKey) {
            changePattern(currentCell.row, currentCell.col, 1, true);
            return;
          }
          setCurrentCell((prev) => ({
            ...prev,
            row: Math.max(0, prev.row - 1),
          }));
          break;
        case "ArrowDown":
          if (e.shiftKey) {
            changePattern(currentCell.row, currentCell.col, 2, true);
            return;
          }
          setCurrentCell((prev) => ({
            ...prev,
            row: Math.min(rows - 1, prev.row + 1),
          }));
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            changePattern(currentCell.row, currentCell.col, 3, true);
            return;
          }
          setCurrentCell((prev) => ({
            ...prev,
            col: Math.max(0, prev.col - 1),
          }));
          break;
        case "ArrowRight":
          if (e.shiftKey) {
            changePattern(currentCell.row, currentCell.col, 4, true);
            return;
          }
          setCurrentCell((prev) => ({
            ...prev,
            col: Math.min(cols - 1, prev.col + 1),
          }));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, cols, currentCell, changePattern]);

  useEffect(() => {
    const currentInput =
      inputRefs.current[`${currentCell.row}-${currentCell.col}`];
    if (currentInput) {
      currentInput.focus();
      requestAnimationFrame(() => {
        const length = currentInput.value.length;
        currentInput.setSelectionRange(length, length);
      });
    }
  }, [currentCell]);

  useEffect(() => {
    if (isAutoFill) {
      fillCellsWithHash();
    } else {
      removeHash();
    }
  }, [isAutoFill]);

  const nextCell = () => {
    setCurrentCell((prev) => {
      if (prev.col === cols - 1) {
        return {
          row: Math.min(rows - 1, prev.row + 1),
          col: 0,
        };
      }
      return {
        ...prev,
        col: prev.col + 1,
      };
    });
  };

  const nextCellDown = () => {
    setCurrentCell((prev) => ({
      ...prev,
      row: Math.min(rows - 1, prev.row + 1),
    }));
  };

  const handleChange = (
    row: number,
    col: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (isComposing) {
      setTmpGrid((prevGrid) => {
        const newGrid = [...prevGrid];
        newGrid[row][col] = event.target.value;
        return newGrid;
      });
      return;
    }
    setGrid((prevGrid) => {
      const newGrid = [...prevGrid];
      newGrid[row][col] = event.target.value.slice(-1);
      return newGrid;
    });
    nextCell();
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };
  const handleCompositionEnd = (
    row: number,
    col: number,
    e: React.CompositionEvent<HTMLInputElement>,
  ) => {
    const value = tmpGrid[row][col];
    setGrid((prevGrid) => {
      const newGrid = [...prevGrid];
      newGrid[row][col] = value.slice(-1);
      return newGrid;
    });

    setTmpGrid((prevGrid) => {
      const newGrid = [...prevGrid];
      newGrid[row][col] = "";
      return newGrid;
    });
    setIsComposing(false);
    nextCell();
  };

  const handleKeyDown = (
    row: number,
    col: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (e.ctrlKey) {
          // Ctrl + Enter の場合
          nextCellDown();
          break;
        }
        nextCell();
        break;
      case "Backspace":
        if (grid[row][col]) {
          setGrid((prevGrid) => {
            const newGrid = [...prevGrid];
            newGrid[row][col] = "";
            return newGrid;
          });
          return;
        }
        e.preventDefault();
        setCurrentCell((prev) => {
          if (prev.col === 0) {
            return {
              row: Math.max(0, prev.row - 1),
              col: cols - 1,
            };
          }
          return {
            ...prev,
            col: prev.col - 1,
          };
        });
        break;
    }
  };

  const fillCellsWithHash = () => {
    setGrid((prevGrid) =>
      prevGrid.map((row) => row.map((cell) => cell || "＃")),
    );
  };

  const removeHash = () => {
    setGrid((prevGrid) =>
      prevGrid.map((row) =>
        row.map((cell) => (cell === "＃" || cell === "#" ? "" : cell)),
      ),
    );
  };

  const handleClickCapture = (row: number, col: number) => {
    const currentTime = Date.now(); // 現在の時刻をミリ秒単位で取得
    if (
      lastClickedCell &&
      lastClickedCell.row === row &&
      lastClickedCell.col === col &&
      currentTime - lastClickedCell.time < 1000
    ) {
      // 通常処理
      setGridPattern((prevGridPattern) => {
        const newGridPattern = [...prevGridPattern];
        newGridPattern[row][col]++;
        return newGridPattern;
      });
      setLastClickedCell({ row, col, time: currentTime });
    } else {
      // 上記の条件を満たさない場合(ダブルクリックでない場合)
      setLastClickedCell({ row, col, time: currentTime }); // 最後にクリックされたセル情報を現在の情報で更新
    }
  };

  // ホバー時にヘルプテキストを表示
  const handleMouseEnter = () => {
    setShowHelp(true);
  };

  // ホバーが外れたらヘルプテキストを非表示
  const handleMouseLeave = () => {
    setShowHelp(false);
  };

  // タッチ開始時にヘルプテキストを表示
  const handleTouchStart = () => {
    setShowHelp(true);
  };

  // タッチ終了時にヘルプテキストを非表示
  const handleTouchEnd = () => {
    setShowHelp(false);
  };

  const handleInputTouchStart = (
    row: number,
    col: number,
    e: React.TouchEvent<HTMLInputElement>,
  ) => {
    document.body.style.overflow = "hidden"; // ページのスクロールを無効化
    setDisableScroll(true);
    setTouchStartPos({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  };

  const handleInputTouchMove = (
    row: number,
    col: number,
    e: React.TouchEvent<HTMLInputElement>,
  ) => {
    if (!touchStartPos) return;
    const touchEndPos = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };

    const diffX = touchEndPos.x - touchStartPos.x;
    const diffY = touchEndPos.y - touchStartPos.y;

    // スワイプ距離が短い場合は無視
    if (Math.abs(diffX) < 50 && Math.abs(diffY) < 50) return;

    // 上下左右のスワイプ方向を判定
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // 左右スワイプ
      if (diffX > 0) {
        // 右スワイプ
        changePattern(row, col, 4, false);
      } else {
        // 左スワイプ
        changePattern(row, col, 3, false);
      }
    } else {
      // 上下スワイプ
      if (diffY > 0) {
        // 下スワイプ
        changePattern(row, col, 2, false);
      } else {
        // 上スワイプ
        changePattern(row, col, 1, false);
      }
    }
  };

  const handleInputTouchEnd = () => {
    //スクロールを有効化
    document.body.style.overflow = "";
    setDisableScroll(false);
    setTouchStartPos(null);
  };

  const adjustRows = (delta: number) => {
    setRows((prev) => clampGridSize(prev + delta));
  };

  const adjustCols = (delta: number) => {
    setCols((prev) => clampGridSize(prev + delta));
  };

  return (
    <main className="flex items-center justify-center px-3 py-4 sm:px-4">
      <div className="relative max-w-3xl rounded-2xl border border-purple-500/20 bg-gradient-to-b from-gray-900 to-gray-800 p-4 shadow-xl sm:p-6">
        <h1 className="text-3xl font-bold mb-3 text-center text-purple-400">
          方眼紙
        </h1>
        {showHelp && (
          <div className="absolute left-3 right-3 top-[94px] z-20 rounded-xl border border-gray-700 bg-gray-900/95 p-3 text-xs leading-relaxed text-gray-100 shadow-2xl sm:left-6 sm:right-6">
            {/* ここにヘルプテキストの内容を記述 */}
            <ul>
              <li>・＃でマスが黒塗りになります。</li>
              <li className="md:hidden">
                ・マス連続タップで色変更ができます。
              </li>
              <li className="md:hidden">
                ・色モードでスワイプで色変更ができます。
              </li>
              <li className="hidden md:block">
                ・ダブルクリックで色変更ができます。
              </li>
              <li className="hidden md:block">
                ・Shift + ↑ 赤色に変更できます。
              </li>
              <li className="md:hidden">・↑スワイプ 赤色</li>
              <li className="hidden md:block">
                ・Shift + ↓ で緑色に変更できます。
              </li>
              <li className="md:hidden">・↓スワイプ 緑色</li>
              <li className="hidden md:block">
                ・Shift + ← で青色に変更できます。
              </li>
              <li className="md:hidden">・←スワイプ 青色</li>
              <li className="hidden md:block">
                ・Shift + → で黄色に変更できます。
              </li>
              <li className="md:hidden">・→スワイプ 黄色</li>
              <li>・「黒(＃)埋め」で＃埋め/解除ができます。</li>
              <li>・行数と列数は1〜20で設定できます。</li>
            </ul>
          </div>
        )}
        <p className="mb-3 flex items-center justify-center text-xs text-gray-400">
          <span>＃でマスが黒塗り。色変更も可能。</span>
          <button
            className="text-purple-400 hover:text-purple-300 focus:outline-none"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </p>

        <div className="mb-3 mx-auto w-[320px] sm:w-[410px]">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <label
              htmlFor="autoFill"
              className={`flex h-12 cursor-pointer items-center justify-between rounded-xl border px-2.5 transition focus-within:ring-2 focus-within:ring-purple-400/60 ${
                isAutoFill
                  ? "border-purple-400 bg-gradient-to-r from-purple-500/25 to-purple-400/10 shadow-[0_0_18px_rgba(168,85,247,0.22)]"
                  : "border-gray-700 bg-gray-900/75 hover:border-purple-500/60"
              }`}
            >
              <span className="text-sm font-semibold text-gray-100">
                黒埋め
              </span>
              <span
                className={`relative h-6 w-11 rounded-full border transition ${
                  isAutoFill
                    ? "border-purple-300/80 bg-purple-500/70"
                    : "border-gray-600 bg-gray-700"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out will-change-transform ${
                    isAutoFill ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
              <input
                id="autoFill"
                type="checkbox"
                checked={isAutoFill}
                onChange={(e) => setIsAutoFill(e.target.checked)}
                className="sr-only"
              />
            </label>

            <label
              htmlFor="rock"
              className={`flex h-12 cursor-pointer items-center justify-between rounded-xl border px-2.5 transition focus-within:ring-2 focus-within:ring-purple-400/60 md:hidden ${
                isColorMode
                  ? "border-purple-400 bg-gradient-to-r from-purple-500/25 to-purple-400/10 shadow-[0_0_18px_rgba(168,85,247,0.22)]"
                  : "border-gray-700 bg-gray-900/75 hover:border-purple-500/60"
              }`}
            >
              <span className="text-sm font-semibold text-gray-100">
                色モード
              </span>
              <span
                className={`relative h-6 w-11 rounded-full border transition ${
                  isColorMode
                    ? "border-purple-300/80 bg-purple-500/70"
                    : "border-gray-600 bg-gray-700"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out will-change-transform ${
                    isColorMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
              <input
                id="rock"
                type="checkbox"
                checked={isColorMode}
                onChange={(e) => setColorMode(e.target.checked)}
                className="sr-only"
              />
            </label>

            <div className="flex h-12 items-center justify-between rounded-xl border border-gray-700 bg-gray-900/75 px-2.5">
              <label
                htmlFor="rows"
                className="text-sm font-medium text-gray-200"
              >
                行数
              </label>
              <div className="flex items-center overflow-hidden rounded-md border border-gray-600 bg-gray-950/80">
                <input
                  id="rows"
                  type="number"
                  inputMode="numeric"
                  min={MIN_GRID_SIZE}
                  max={MAX_GRID_SIZE}
                  value={rows}
                  onChange={(e) => setRows(parseGridSize(e.target.value))}
                  className="h-9 w-11 bg-transparent px-1 text-center text-sm font-semibold text-white [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <div className="flex flex-col border-l border-gray-600">
                  <button
                    type="button"
                    aria-label="行数を増やす"
                    onClick={() => adjustRows(1)}
                    disabled={rows >= MAX_GRID_SIZE}
                    className="flex h-[18px] w-8 items-center justify-center text-[10px] text-gray-300 transition hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="行数を減らす"
                    onClick={() => adjustRows(-1)}
                    disabled={rows <= MIN_GRID_SIZE}
                    className="flex h-[18px] w-8 items-center justify-center border-t border-gray-600 text-[10px] text-gray-300 transition hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>

            <div className="flex h-12 items-center justify-between rounded-xl border border-gray-700 bg-gray-900/75 px-2.5">
              <label
                htmlFor="cols"
                className="text-sm font-medium text-gray-200"
              >
                列数
              </label>
              <div className="flex items-center overflow-hidden rounded-md border border-gray-600 bg-gray-950/80">
                <input
                  id="cols"
                  type="number"
                  inputMode="numeric"
                  min={MIN_GRID_SIZE}
                  max={MAX_GRID_SIZE}
                  value={cols}
                  onChange={(e) => setCols(parseGridSize(e.target.value))}
                  className="h-9 w-11 bg-transparent px-1 text-center text-sm font-semibold text-white [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <div className="flex flex-col border-l border-gray-600">
                  <button
                    type="button"
                    aria-label="列数を増やす"
                    onClick={() => adjustCols(1)}
                    disabled={cols >= MAX_GRID_SIZE}
                    className="flex h-[18px] w-8 items-center justify-center text-[10px] text-gray-300 transition hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="列数を減らす"
                    onClick={() => adjustCols(-1)}
                    disabled={cols <= MIN_GRID_SIZE}
                    className="flex h-[18px] w-8 items-center justify-center border-t border-gray-600 text-[10px] text-gray-300 transition hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
                  >
                    ▼
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          className="grid gap-1 mx-auto select-none"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            maxWidth: `${cols * 2.25}rem`, // 8px(セル幅) + 1px(gap) × 列数
          }}
        >
          {grid.map((row, i) =>
            row.map((cell: string, j: number) => (
              <input
                onClick={() => setCurrentCell({ row: i, col: j })}
                key={`${i}-${j}`}
                ref={(el: HTMLInputElement | null) => {
                  if (el) {
                    inputRefs.current[`${i}-${j}`] = el;
                  }
                }}
                className={`w-8 h-8 text-center ${
                  cell === "#" || cell === "＃"
                    ? "bg-black text-gray-800"
                    : getPattern(gridPattern[i][j])
                } border ${
                  i === currentCell.row && j === currentCell.col
                    ? "border-purple-400"
                    : "border-gray-300"
                } rounded focus:outline-none focus:border-purple-400`}
                maxLength={1}
                value={tmpGrid[i][j] || cell}
                onChange={(e) => handleChange(i, j, e)}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={(e) => handleCompositionEnd(i, j, e)}
                onKeyDown={(e) => handleKeyDown(i, j, e)}
                onClickCapture={(e) => handleClickCapture(i, j)}
                //スマートフォン色変え
                onTouchStart={(e) =>
                  isColorMode && handleInputTouchStart(i, j, e)
                }
                onTouchMove={(e) =>
                  isColorMode && handleInputTouchMove(i, j, e)
                }
                onTouchEnd={(e) => isColorMode && handleInputTouchEnd()}
                readOnly={isColorMode}
              />
            )),
          )}
        </div>
      </div>
    </main>
  );
}
