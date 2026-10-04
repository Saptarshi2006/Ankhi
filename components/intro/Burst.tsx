"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  life: number;
  decay: number;
  color: string;
  confetti: boolean;
};

const GRAVITY = 0.22;
const DRAG = 0.985;
const COUNT = 90;

/**
 * The blast.
 *
 * A single fixed canvas rather than 90 animated divs: one composited layer,
 * one rAF loop, and the loop stops itself once the last particle dies.
 *
 * Driven by `runKey` — increment it to fire. The effect body reads it but does
 * not depend on anything else, so a remount mid-flight can't strand particles.
 */
export default function Burst({ runKey }: { runKey: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (runKey === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Canvas has no cascade, so the OKLCH custom properties have to be
    // resolved to concrete strings before they can be used as fill styles.
    const styles = getComputedStyle(document.documentElement);
    const read = (token: string) => styles.getPropertyValue(token).trim();
    const palette = [read("--rose-deep"), read("--rose"), read("--rose-soft"), read("--gold")]
      .filter(Boolean);
    const ringColor = read("--rose") || "#c9486e";

    const particles: Particle[] = Array.from({ length: COUNT }, (_, i) => {
      const angle = (Math.PI * 2 * i) / COUNT + (Math.random() - 0.5) * 0.5;
      const speed = 6 + Math.random() * 13;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2.5 + Math.random() * 5,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.32,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        color: palette[Math.floor(Math.random() * palette.length)] || ringColor,
        confetti: Math.random() > 0.45,
      };
    });

    let ring = 1;
    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (ring > 0) {
        ring -= 0.045;
        const radius =
          (1 - ring) * Math.min(window.innerWidth, window.innerHeight) * 0.42;
        ctx.globalAlpha = Math.max(0, ring) * 0.5;
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2 + ring * 5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;

        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        p.life -= p.decay;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        if (p.confetti) {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.globalAlpha = 1;

      if (alive || ring > 0) {
        frame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [runKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 h-full w-full"
    />
  );
}
