"use client";

import { useEffect, useRef, useState } from "react";

type SceneProps = { variant: "hero" | "background" };
type Point = { x: number; y: number };

function curve(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  return { x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x, y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y };
}

export default function Scene({ variant }: SceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const contextElement = canvasElement.getContext("2d");
    if (!contextElement) return;
    const canvas = canvasElement;
    const context = contextElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let stopped = false;
    const particles = Array.from({ length: variant === "hero" ? 72 : 110 }, (_, index) => ({
      side: index % 2 === 0 ? -1 : 1,
      t: Math.random(),
      speed: 0.0007 + Math.random() * 0.0015,
      offset: (Math.random() - 0.5) * 1.4,
    }));
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.25, a: Math.random() * 0.55 + 0.15 }));

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function render(time: number) {
      if (stopped) return;
      const ink = dark ? "255,255,255" : "15,39,64";
      context.clearRect(0, 0, width, height);
      if (variant === "background") {
        const glow = context.createRadialGradient(width * 0.5, height * 0.35, 0, width * 0.5, height * 0.35, Math.max(width, height) * 0.7);
        glow.addColorStop(0, dark ? "rgba(25,104,145,.12)" : "rgba(51,130,170,.10)");
        glow.addColorStop(1, "transparent");
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
        stars.forEach((star) => { context.beginPath(); context.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2); context.fillStyle = `rgba(${ink},${star.a})`; context.fill(); });
        if (!reduced) {
          context.strokeStyle = `rgba(${ink},${dark ? 0.035 : 0.06})`;
          context.lineWidth = 1;
          const gap = 72;
          for (let x = (time * 0.008) % gap; x < width; x += gap) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x - height * 0.35, height); context.stroke(); }
        }
      } else {
        const centerX = width / 2;
        const centerY = height * 0.54;
        particles.forEach((particle) => {
          const startY = ((particle.t * 1.4) - 0.2) * height;
          const p0 = { x: particle.side < 0 ? -20 : width + 20, y: startY };
          const p1 = { x: particle.side < 0 ? centerX * 0.48 : width - centerX * 0.48, y: startY };
          const p2 = { x: particle.side < 0 ? centerX * 0.82 : width - centerX * 0.82, y: centerY + particle.offset * height * 0.1 };
          const p3 = { x: centerX + particle.offset * width * 0.08, y: centerY + particle.offset * height * 0.12 };
          context.beginPath();
          context.moveTo(p0.x, p0.y);
          context.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
          context.strokeStyle = `rgba(${ink},${dark ? 0.13 : 0.16})`;
          context.setLineDash([1, 7]);
          context.stroke();
          context.setLineDash([]);
          const point = curve(particle.t, p0, p1, p2, p3);
          context.fillStyle = `rgba(${dark ? "110,224,255" : "24,117,155"},${dark ? 0.72 : 0.58})`;
          context.fillRect(point.x - 1.3, point.y - 1.3, 2.6, 2.6);
          if (!reduced) particle.t = (particle.t + particle.speed) % 1;
        });
        context.beginPath();
        context.arc(centerX, centerY, Math.min(width, height) * 0.08, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${dark ? "110,224,255" : "24,117,155"},${dark ? 0.25 : 0.2})`;
        context.stroke();
      }
      if (!reduced) frame = requestAnimationFrame(render);
    }

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(render);
    return () => { stopped = true; cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [dark, variant]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
