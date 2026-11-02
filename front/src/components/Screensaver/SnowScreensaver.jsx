import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const COLUMN_WIDTH = 4; // px per pile column
const MAX_FLAKES = 350;
const MAX_SLOPE = 3; // max height difference between neighbouring columns
const SWEEP_RADIUS = 40; // at rest; grows with pointer speed
const MAX_SWEEP_RADIUS = 250;
const SWEEP_RADIUS_PER_SPEED = 80; // extra px of radius per px/ms
const MAX_PILE_RATIO = 0.2; // pile stops growing at 20% of the viewport
// TODO(testing): restore to 0.
const INITIAL_PILE_RATIO = 0.1; // pile height the screensaver starts with
const AVG_FALL_SPEED = 42; // px/s, mean of the spawn velocities
// Plank colour with a faint horizontal grain.
const WOOD_STYLE = {
  backgroundColor: "#8b5a2b",
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 5px), linear-gradient(180deg, #9c6a38, #7a4a22)",
  textShadow: "0 1px 1px rgba(0,0,0,0.5)",
};
const HINT_KEYS = ["hint_sweep", "hint_stop", "hint_disable"];
const IDLE_EVENTS = ["mousemove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"];

// Snow falls over the whole interface after `idleMs` without input and piles
// up along the bottom. Pointer movement sweeps the pile aside, over a wider
// radius the faster it moves; a click blows all of it away and ends the
// screensaver.
// The canvas never takes pointer events, so the UI underneath stays usable.
export default function SnowScreensaver({ idleMs }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const [clearing, setClearing] = useState(false);
  const canvasRef = useRef(null);

  // Idle detection while inactive.
  useEffect(() => {
    if (active) return;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") setActive(true);
        else reset();
      }, idleMs);
    };
    reset();
    IDLE_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true, capture: true }));
    return () => {
      clearTimeout(timer);
      IDLE_EVENTS.forEach((e) => window.removeEventListener(e, reset, { capture: true }));
    };
  }, [active, idleMs]);

  // Simulation while active.
  useEffect(() => {
    if (!active) return;
    setClearing(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let width = 0;
    let height = 0;
    let pile = new Float32Array(0);
    let flakes = [];
    let clearing = false;
    let frame;
    let last = performance.now();
    let spawnDebt = 0;
    let pointer = null; // { x, y, t }

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const next = new Float32Array(Math.ceil(width / COLUMN_WIDTH) + 1);
      next.set(pile.subarray(0, next.length));
      pile = next;
    };

    const spawn = (y = -10) => ({
      x: Math.random() * width,
      y,
      r: 1 + Math.random() * 2.5,
      vx: 0,
      vy: 25 + Math.random() * 35,
      phase: Math.random() * Math.PI * 2,
      loose: false, // swept/blown flakes don't settle
    });

    // Let snow slide off steep spots so the pile forms soft drifts.
    const settle = (i) => {
      for (const j of [i - 1, i + 1]) {
        if (j < 0 || j >= pile.length) continue;
        const diff = pile[i] - pile[j];
        if (diff > MAX_SLOPE) {
          const move = (diff - MAX_SLOPE) / 2;
          pile[i] -= move;
          pile[j] += move;
        }
      }
    };

    const clearAll = () => {
      if (clearing) return;
      clearing = true;
      setClearing(true);
      const cx = pointer?.x ?? width / 2;
      // Turn the pile into flakes and blow everything away from the pointer.
      for (let i = 0; i < pile.length; i += 2) {
        if (pile[i] < 1) continue;
        const f = spawn(height - Math.random() * pile[i]);
        f.x = i * COLUMN_WIDTH;
        flakes.push(f);
      }
      pile.fill(0);
      for (const f of flakes) {
        const dir = Math.sign(f.x - cx) || 1;
        f.vx = dir * (300 + Math.random() * 500);
        f.vy = -(100 + Math.random() * 300);
        f.loose = true;
      }
    };

    const sweep = (x, y, dx, radius) => {
      const bottomDist = height - y;
      const from = Math.max(0, Math.floor((x - radius) / COLUMN_WIDTH));
      const to = Math.min(pile.length - 1, Math.ceil((x + radius) / COLUMN_WIDTH));
      for (let i = from; i <= to; i++) {
        // Only snow the cursor actually touches.
        if (pile[i] < bottomDist - radius / 2) continue;
        const removed = pile[i] * 0.5;
        if (removed < 0.5) continue;
        pile[i] -= removed;
        if (flakes.length < MAX_FLAKES * 2 && Math.random() < 0.5) {
          const f = spawn(height - pile[i] - Math.random() * removed);
          f.x = i * COLUMN_WIDTH;
          f.vx = dx * (40 + Math.random() * 80);
          f.vy = -(40 + Math.random() * 120);
          f.loose = true;
          flakes.push(f);
        }
      }
      for (const f of flakes) {
        const ddx = f.x - x;
        const ddy = f.y - y;
        if (ddx * ddx + ddy * ddy < radius * radius) {
          f.vx += dx * 60;
          f.loose = true;
        }
      }
    };

    const onMove = (e) => {
      const now = performance.now();
      if (pointer) {
        const dt = Math.max(1, now - pointer.t);
        const dist = Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
        const radius = Math.min(
          MAX_SWEEP_RADIUS,
          SWEEP_RADIUS + (dist / dt) * SWEEP_RADIUS_PER_SPEED,
        );
        if (!clearing) sweep(e.clientX, e.clientY, Math.sign(e.clientX - pointer.x), radius);
      }
      pointer = { x: e.clientX, y: e.clientY, t: now };
    };
    const onClear = () => clearAll();

    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Spawn at the rate flakes leave the screen, so the snowfall is steady
      // from the start instead of one dense wave followed by a gap.
      if (!clearing) {
        spawnDebt += (MAX_FLAKES * AVG_FALL_SPEED * dt) / height;
        while (spawnDebt >= 1 && flakes.length < MAX_FLAKES) {
          flakes.push(spawn());
          spawnDebt -= 1;
        }
        spawnDebt = Math.min(spawnDebt, 1);
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(214, 232, 255, 0.95)";
      ctx.strokeStyle = "rgba(70, 120, 200, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const alive = [];
      for (const f of flakes) {
        f.phase += dt;
        if (f.loose) {
          f.vy += 400 * dt;
          f.vx *= 1 - 1.5 * dt;
        }
        f.x += (f.vx + Math.sin(f.phase) * 15) * dt;
        f.y += f.vy * dt;

        const col = Math.round(f.x / COLUMN_WIDTH);
        const inside = col >= 0 && col < pile.length;
        if (!clearing && inside && f.y >= height - pile[col]) {
          // Settle unless it was swept hard: then just fall back down.
          // A full pile absorbs the flake without growing.
          if (!f.loose || Math.abs(f.vx) < 50) {
            if (pile[col] < height * MAX_PILE_RATIO) {
              pile[col] += f.r * 0.6;
              settle(col);
            }
            continue;
          }
        }
        if (f.y > height + 10 || f.x < -50 || f.x > width + 50) continue;
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        alive.push(f);
      }
      flakes = alive;
      ctx.fill();
      ctx.stroke();

      // The pile is a filled silhouette along the bottom edge.
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < pile.length; i++) {
        ctx.lineTo(i * COLUMN_WIDTH, height - Math.min(pile[i], height * MAX_PILE_RATIO));
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (clearing && flakes.length === 0) {
        setActive(false);
        return;
      }
      frame = requestAnimationFrame(step);
    };

    resize();
    // Start with gently rolling drifts rather than a flat slab.
    for (let i = 0; i < pile.length; i++) {
      const x = i * COLUMN_WIDTH;
      pile[i] =
        height * INITIAL_PILE_RATIO * (1 + 0.15 * Math.sin(x / 90) + 0.08 * Math.sin(x / 37));
    }
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onClear);
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onClear);
    };
  }, [active]);

  if (!active) return null;
  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[9999] h-full w-full"
      />
      {!clearing && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-0 left-1/2 z-[10000] flex -translate-x-1/2 flex-col items-center"
        >
          <div
            className="max-w-[90vw] rounded-md border-2 border-[#4a2c14] whitespace-pre-line px-4 py-2 text-center text-xs leading-snug font-semibold text-[#fdf3e1] shadow-lg"
            style={WOOD_STYLE}
          >
            {HINT_KEYS.map((key, i) => (
              <p
                key={key}
                className={i > 0 ? "mt-1 border-t border-[#fdf3e1]/70 pt-1" : ""}
              >
                {t(`user_settings.chat_preferences.screensavers.${key}`)}
              </p>
            ))}
          </div>
          <div className="h-10 w-3 bg-[#5a3519]" />
        </div>
      )}
    </>
  );
}
