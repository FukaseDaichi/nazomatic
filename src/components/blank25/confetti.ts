import confetti from "canvas-confetti";

const Z_INDEX = 60;
const PETAL_COLORS = [
  "#faf5ff",
  "#f5d0fe",
  "#e9d5ff",
  "#d8b4fe",
  "#c084fc",
] as const;

export type ConfettiCleanup = () => void;
export type Blank25ConfettiVariant = "celebration" | "petals";

export const fireBlank25Confetti = ({
  variant = "celebration",
}: {
  variant?: Blank25ConfettiVariant;
} = {}): ConfettiCleanup => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  )?.matches;
  if (reduceMotion) {
    return () => {};
  }

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = String(Z_INDEX);
  canvas.style.opacity = "1";
  canvas.style.transition = "opacity 1.2s ease-out";

  document.body.appendChild(canvas);

  const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });
  let rafId = 0;
  let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let removeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const isPetalVariant = variant === "petals";
  const durationMs = isPetalVariant ? 4400 : 4000;
  const end = Date.now() + durationMs;

  if (isPetalVariant) {
    myConfetti({
      particleCount: 80,
      angle: 270,
      spread: 58,
      startVelocity: 14,
      gravity: 0.48,
      ticks: 340,
      scalar: 1.1,
      shapes: ["circle"],
      colors: [...PETAL_COLORS],
      origin: { x: 0.5, y: 0.08 },
    });
  } else {
    myConfetti({
      particleCount: 120,
      spread: 70,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.65 },
    });
  }

  const frame = () => {
    const timeLeft = end - Date.now();
    if (timeLeft <= 0) {
      return;
    }

    if (isPetalVariant) {
      const particleCount = Math.max(
        2,
        Math.floor(12 * (timeLeft / durationMs)),
      );
      myConfetti({
        particleCount,
        angle: 300,
        spread: 26,
        startVelocity: 16,
        gravity: 0.52,
        drift: 0.2,
        ticks: 340,
        scalar: 1.05,
        shapes: ["circle"],
        colors: [...PETAL_COLORS],
        origin: { x: 0.14, y: -0.04 },
      });
      myConfetti({
        particleCount,
        angle: 240,
        spread: 26,
        startVelocity: 16,
        gravity: 0.52,
        drift: -0.2,
        ticks: 340,
        scalar: 1.05,
        shapes: ["circle"],
        colors: [...PETAL_COLORS],
        origin: { x: 0.86, y: -0.04 },
      });
      myConfetti({
        particleCount: Math.max(1, Math.floor(particleCount / 2)),
        angle: 270,
        spread: 34,
        startVelocity: 10,
        gravity: 0.46,
        ticks: 320,
        scalar: 0.92,
        shapes: ["circle"],
        colors: [...PETAL_COLORS],
        origin: { x: 0.5, y: -0.08 },
      });
    } else {
      const particleCount = Math.max(
        2,
        Math.floor(10 * (timeLeft / durationMs)),
      );
      myConfetti({
        particleCount,
        spread: 65,
        startVelocity: 30,
        ticks: 260,
        origin: { x: 0.08, y: 0.7 },
      });
      myConfetti({
        particleCount,
        spread: 65,
        startVelocity: 30,
        ticks: 260,
        origin: { x: 0.92, y: 0.7 },
      });
    }

    rafId = window.requestAnimationFrame(frame);
  };

  rafId = window.requestAnimationFrame(frame);

  fadeTimeoutId = setTimeout(() => {
    canvas.style.opacity = "0";
    removeTimeoutId = setTimeout(() => {
      try {
        myConfetti.reset();
      } catch {
        // ignore
      }
      canvas.remove();
    }, 1200);
  }, durationMs);

  return () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    if (fadeTimeoutId) {
      clearTimeout(fadeTimeoutId);
    }
    if (removeTimeoutId) {
      clearTimeout(removeTimeoutId);
    }
    try {
      myConfetti.reset();
    } catch {
      // ignore
    }
    canvas.remove();
  };
};
