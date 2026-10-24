"use client";

import React from "react";
import {
  ClipboardPaste,
  Copy,
  Eraser,
  Redo2,
  Scissors,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { CELL_COLORS, MAX_GRID_SIZE, MIN_GRID_SIZE } from "./grid-model";

// ボタン押下でグリッドの入力フォーカスを奪わない
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

function ToolButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={`${label}（${shortcut}）`}
      aria-label={label}
      onMouseDown={keepFocus}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-gray-200 transition hover:bg-purple-500/25 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:bg-transparent"
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="hidden text-xs lg:inline">{label}</span>
    </button>
  );
}

function SizeStepper({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex h-10 items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-gray-200">
        {label}
      </label>
      <div className="flex items-center overflow-hidden rounded-md border border-gray-600 bg-gray-950/80">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={MIN_GRID_SIZE}
          max={MAX_GRID_SIZE}
          value={value}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10);
            onChange(Number.isNaN(parsed) ? MIN_GRID_SIZE : parsed);
          }}
          className="h-9 w-11 bg-transparent px-1 text-center text-base font-semibold text-white [appearance:textfield] focus:outline-hidden sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <div className="flex flex-col border-l border-gray-600">
          <button
            type="button"
            aria-label={`${label}を増やす`}
            onClick={() => onChange(value + 1)}
            disabled={value >= MAX_GRID_SIZE}
            className="flex h-[18px] w-8 items-center justify-center text-[10px] text-gray-300 transition hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={`${label}を減らす`}
            onClick={() => onChange(value - 1)}
            disabled={value <= MIN_GRID_SIZE}
            className="flex h-[18px] w-8 items-center justify-center border-t border-gray-600 text-[10px] text-gray-300 transition hover:bg-purple-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
  className = "",
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex h-10 cursor-pointer items-center gap-2 rounded-md px-2 focus-within:ring-2 focus-within:ring-purple-400/60 ${className}`}
    >
      <span className="text-sm font-medium text-gray-200">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full border transition ${
          checked
            ? "border-purple-300/80 bg-purple-500/70"
            : "border-gray-600 bg-gray-700"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out will-change-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
    </label>
  );
}

export type GraphPaperToolbarProps = {
  selectionLabel: string;
  activeColor: number;
  canUndo: boolean;
  canRedo: boolean;
  rows: number;
  cols: number;
  isHashFilled: boolean;
  isRangeMode: boolean;
  onColor: (color: number) => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onResize: (rows: number, cols: number) => void;
  onHashFill: (checked: boolean) => void;
  onRangeMode: (checked: boolean) => void;
};

export default function GraphPaperToolbar(props: GraphPaperToolbarProps) {
  return (
    <div className="mb-3 rounded-xl border border-gray-700 bg-gray-900/75 p-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <output
          aria-label="選択範囲"
          className="flex h-10 min-w-20 items-center justify-center rounded-md border border-gray-600 bg-gray-950/80 px-2 font-mono text-sm text-purple-300"
        >
          {props.selectionLabel}
        </output>
        <div
          role="group"
          aria-label="塗りつぶし"
          className="flex items-center gap-1 border-l border-gray-700 pl-2"
        >
          {CELL_COLORS.map((color, i) => (
            <button
              key={color.label}
              type="button"
              title={`${color.label}（Alt/Option + ${i}）`}
              aria-label={`塗りつぶし: ${color.label}`}
              aria-pressed={props.activeColor === i}
              onMouseDown={keepFocus}
              onClick={() => props.onColor(i)}
              className={`flex h-8 w-8 items-center justify-center rounded-md border-2 text-xs font-bold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 ${color.className} ${
                props.activeColor === i
                  ? "border-purple-400 ring-2 ring-purple-400/40"
                  : "border-gray-600 hover:border-purple-300"
              }`}
            >
              {i === 0 ? "✕" : ""}
            </button>
          ))}
        </div>
        <div className="flex items-center border-l border-gray-700 pl-1">
          <ToolButton
            icon={Copy}
            label="コピー"
            shortcut="Ctrl/⌘ + C"
            onClick={props.onCopy}
          />
          <ToolButton
            icon={Scissors}
            label="切り取り"
            shortcut="Ctrl/⌘ + X"
            onClick={props.onCut}
          />
          <ToolButton
            icon={ClipboardPaste}
            label="貼り付け"
            shortcut="Ctrl/⌘ + V"
            onClick={props.onPaste}
          />
          <ToolButton
            icon={Eraser}
            label="消去"
            shortcut="Delete"
            onClick={props.onClear}
          />
        </div>
        <div className="flex items-center border-l border-gray-700 pl-1">
          <ToolButton
            icon={Undo2}
            label="元に戻す"
            shortcut="Ctrl/⌘ + Z"
            onClick={props.onUndo}
            disabled={!props.canUndo}
          />
          <ToolButton
            icon={Redo2}
            label="やり直し"
            shortcut="Ctrl/⌘ + Shift + Z"
            onClick={props.onRedo}
            disabled={!props.canRedo}
          />
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-700 pt-1">
        <SizeStepper
          id="rows"
          label="行数"
          value={props.rows}
          onChange={(rows) => props.onResize(rows, props.cols)}
        />
        <SizeStepper
          id="cols"
          label="列数"
          value={props.cols}
          onChange={(cols) => props.onResize(props.rows, cols)}
        />
        <Toggle
          id="hashFill"
          label="空白を＃埋め"
          checked={props.isHashFilled}
          onChange={props.onHashFill}
        />
        <Toggle
          id="rangeMode"
          label="範囲選択"
          checked={props.isRangeMode}
          onChange={props.onRangeMode}
          className="md:hidden"
        />
      </div>
    </div>
  );
}
