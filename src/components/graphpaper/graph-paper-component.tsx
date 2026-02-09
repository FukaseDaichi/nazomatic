"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

const patterns = [
  "bg-white text-gray-900",
  "bg-red-500 text-white",
  "bg-green-500 text-white",
  "bg-blue-500 text white",
  "bg-yellow-500 text white",
];

const getPattern = (num: any) => {
  if (typeof num !== "number") {
    return patterns[0];
  }
  return patterns[num % patterns.length];
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
      .map(() => Array(cols).fill(""))
  );
  const [tmpGrid, setTmpGrid] = useState(
    Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(""))
  );
  const [gridPattern, setGridPattern] = useState(
    Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(0))
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
    [gridPattern]
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
            })
        );
      return newGrid;
    });
    setTmpGrid(
      Array(rows)
        .fill(null)
        .map(() => Array(cols).fill(""))
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
            })
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
    event: React.ChangeEvent<HTMLInputElement>
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
    e: React.CompositionEvent<HTMLInputElement>
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
    e: React.KeyboardEvent<HTMLInputElement>
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
      prevGrid.map((row) => row.map((cell) => cell || "＃"))
    );
  };

  const removeHash = () => {
    setGrid((prevGrid) =>
      prevGrid.map((row) =>
        row.map((cell) => (cell === "＃" || cell === "#" ? "" : cell))
      )
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
    e: React.TouchEvent<HTMLInputElement>
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
    e: React.TouchEvent<HTMLInputElement>
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

  return (
    <main className="flex items-center justify-center">
      <div className="p-8 bg-gray-800 rounded-lg shadow-xl relative">
        <h1 className="text-3xl font-bold mb-3 text-center text-purple-400">
          方眼紙
        </h1>
        {showHelp && (
          <div className="absolute top-[100px] left-0 w-full bg-gray-800 bg-opacity-70 z-10">
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
              <li>・行数と列数は最大20まで設定できます。</li>
            </ul>
          </div>
        )}
        <p className="text-gray-400 text-xs mb-2 justify-center flex items-center">
          <span>＃でマスが黒塗り。色変更も可能。</span>
          <button
            className="text-purple-400 hover:text-purple-600 focus:outline-none"
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

        <div className="mb-3 flex justify-between gap-1 text-xs">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoFill"
              checked={isAutoFill}
              onChange={(e) => setIsAutoFill(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 text-xs text-base"
            />
            <label htmlFor="autoFill" className="text-gray-400 text-xs mr-1">
              黒埋め
            </label>
          </div>
          <div className="flex items-center md:hidden">
            <input
              type="checkbox"
              id="rock"
              checked={isColorMode}
              onChange={(e) => setColorMode(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 text-xs text-base"
            />
            <label htmlFor="rock" className="text-gray-400 text-xs mr-1">
              色モード
            </label>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center">
              <label className="text-gray-400 mr-1">行数:</label>
              <input
                id="rows"
                type="number"
                min="1"
                max="20"
                value={rows}
                onChange={(e) =>
                  setRows(
                    Math.min(20, Math.max(1, parseInt(e.target.value) || 1))
                  )
                }
                className="w-10 px-1 py-0.5 text-black rounded text-xs text-base"
              />
            </div>
            <div className="flex items-center">
              <label className="text-gray-400 mr-1">列数:</label>
              <input
                id="cols"
                type="number"
                min="1"
                max="20"
                value={cols}
                onChange={(e) =>
                  setCols(
                    Math.min(20, Math.max(1, parseInt(e.target.value) || 1))
                  )
                }
                className="w-10 px-1 py-0.5 text-black rounded text-xs text-base"
              />
            </div>
            <span className="hidden sm:inline text-gray-500 text-xs self-center ml-1">
              (最大20)
            </span>
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
            ))
          )}
        </div>
      </div>
    </main>
  );
}
