"use client";

import React, { useState, useEffect, useRef } from "react";

export default function GraphPaperComponent() {
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
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
  const [currentCell, setCurrentCell] = useState({ row: 0, col: 0 });
  const [isComposing, setIsComposing] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isAutoFill, setIsAutoFill] = useState(false);

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
          setCurrentCell((prev) => ({
            ...prev,
            row: Math.max(0, prev.row - 1),
          }));
          break;
        case "ArrowDown":
          setCurrentCell((prev) => ({
            ...prev,
            row: Math.min(rows - 1, prev.row + 1),
          }));
          break;
        case "ArrowLeft":
          setCurrentCell((prev) => ({
            ...prev,
            col: Math.max(0, prev.col - 1),
          }));
          break;
        case "ArrowRight":
          setCurrentCell((prev) => ({
            ...prev,
            col: Math.min(cols - 1, prev.col + 1),
          }));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, cols]);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="p-8 bg-gray-800 rounded-lg shadow-xl relative">
        <h1 className="text-3xl font-bold mb-6 text-center text-purple-400">
          方眼紙
        </h1>
        <p className="text-gray-400 text-xs mb-2 text-center">
          ＃を入力すると、マスが黒く塗りつぶされます
        </p>

        <div className="mb-3 flex justify-between gap-1 text-xs">
          <div>
            <input
              type="checkbox"
              id="autoFill"
              checked={isAutoFill}
              onChange={(e) => setIsAutoFill(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 text-xs"
            />
            <label htmlFor="autoFill" className="text-gray-400 text-xs">
              黒(＃)埋め
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
                className="w-10 px-1 py-0.5 text-black rounded text-xs"
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
                className="w-10 px-1 py-0.5 text-black rounded text-xs"
              />
            </div>
            <span className="text-gray-500 text-xs self-center ml-1">
              (最大20)
            </span>
          </div>
        </div>
        <div
          className="grid gap-1 mx-auto"
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
                ref={(el) => (inputRefs.current[`${i}-${j}`] = el)}
                className={`w-8 h-8 text-center ${
                  cell === "#" || cell === "＃"
                    ? "bg-black"
                    : "bg-white text-black"
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
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
