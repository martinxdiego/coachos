export function triggerConfetti(origin?: { x?: number; y?: number }) {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) { canvas.remove(); return; }
  const c = ctx;

  const ox = (origin?.x ?? 0.5) * canvas.width;
  const oy = (origin?.y ?? 0.35) * canvas.height;
  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#f97316"];

  type Shape = "rect" | "circle";
  const particles = Array.from({ length: 90 }, () => ({
    x: ox, y: oy,
    vx: (Math.random() - 0.5) * 14,
    vy: -(Math.random() * 12 + 3),
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 7 + 4,
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 12,
    shape: (Math.random() > 0.45 ? "rect" : "circle") as Shape,
  }));

  const FRAMES = 100;
  let f = 0;

  function tick() {
    c.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.32; p.vx *= 0.985; p.rot += p.rotV;
      const alpha = Math.max(0, 1 - f / FRAMES);
      c.save();
      c.translate(p.x, p.y);
      c.rotate((p.rot * Math.PI) / 180);
      c.globalAlpha = alpha;
      c.fillStyle = p.color;
      if (p.shape === "circle") {
        c.beginPath(); c.arc(0, 0, p.size / 2, 0, Math.PI * 2); c.fill();
      } else {
        c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      c.restore();
    }
    f++;
    if (f < FRAMES) requestAnimationFrame(tick);
    else canvas.remove();
  }

  requestAnimationFrame(tick);
}
