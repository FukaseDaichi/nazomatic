import confetti from "canvas-confetti";

const Z_INDEX = 60;

export type ConfettiCleanup = () => void;

export const fireBlank25Confetti = (): ConfettiCleanup => {
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

  const durationMs = 4000;
  const end = Date.now() + durationMs;

  myConfetti({
    particleCount: 120,
    spread: 70,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.65 },
  });

  const frame = () => {
    const timeLeft = end - Date.now();
    if (timeLeft <= 0) {
      return;
    }

    const particleCount = Math.max(2, Math.floor(10 * (timeLeft / durationMs)));
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
