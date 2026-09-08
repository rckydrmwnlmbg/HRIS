'use client';

/**
 * Beams Background (Kokonut UI inspired)
 * High-performance hardware-accelerated animated light beams on canvas
 * Automatically adapts hues and contrast for Dark Mode and Light Mode
 */

import React, { useEffect, useRef } from 'react';

interface Beam {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
  hue: number;
  pulse: number;
  pulseSpeed: number;
}

function createBeam(width: number, height: number, isDark: boolean): Beam {
  const angle = -35 + Math.random() * 10;
  const hueBase = isDark ? 190 : 205;
  const hueRange = isDark ? 75 : 35;

  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: 40 + Math.random() * 80,
    length: height * 2.6,
    angle,
    speed: 0.45 + Math.random() * 0.75,
    opacity: isDark ? (0.16 + Math.random() * 0.16) : (0.12 + Math.random() * 0.12),
    hue: hueBase + Math.random() * hueRange,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.015 + Math.random() * 0.025,
  };
}

export default function BeamsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamsRef = useRef<Beam[]>([]);
  const animationFrameRef = useRef<number>(0);
  const isDarkModeRef = useRef<boolean>(false);
  const MINIMUM_BEAMS = 24;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check theme from data-theme attribute or dark class
    const updateDarkMode = () => {
      const isDark =
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark');
      
      const themeChanged = isDarkModeRef.current !== isDark;
      isDarkModeRef.current = isDark;

      // Re-tint existing beams if theme changed
      if (themeChanged && beamsRef.current.length > 0) {
        const hueBase = isDark ? 190 : 205;
        const hueRange = isDark ? 75 : 35;
        const total = beamsRef.current.length;
        beamsRef.current.forEach((beam, index) => {
          beam.hue = hueBase + (index * hueRange) / total;
          beam.opacity = isDark ? (0.16 + Math.random() * 0.16) : (0.12 + Math.random() * 0.12);
        });
      }
    };

    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });

    updateDarkMode();

    const updateCanvasSize = () => {
      if (!canvas || !ctx) return;
      // Cap devicePixelRatio at 2 to balance ultra-sharp rendering with battery efficiency
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale
      ctx.scale(dpr, dpr);

      const totalBeams = Math.floor(MINIMUM_BEAMS * (width > 1400 ? 1.4 : 1.1));
      beamsRef.current = Array.from({ length: totalBeams }, () =>
        createBeam(width, height, isDarkModeRef.current)
      );
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    function resetBeam(beam: Beam, index: number, totalBeams: number, width: number, height: number) {
      const column = index % 3;
      const spacing = width / 3;

      const isDark = isDarkModeRef.current;
      const hueBase = isDark ? 190 : 205;
      const hueRange = isDark ? 75 : 35;

      beam.y = height + 120;
      beam.x = column * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.6;
      beam.width = 50 + Math.random() * 90;
      beam.speed = 0.4 + Math.random() * 0.5;
      beam.hue = hueBase + (index * hueRange) / totalBeams;
      beam.opacity = isDark ? (0.16 + Math.random() * 0.16) : (0.12 + Math.random() * 0.12);
      return beam;
    }

    function drawBeam(c: CanvasRenderingContext2D, beam: Beam) {
      c.save();
      c.translate(beam.x, beam.y);
      c.rotate((beam.angle * Math.PI) / 180);

      const isDark = isDarkModeRef.current;
      const pulsingOpacity = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.25);

      const gradient = c.createLinearGradient(0, 0, 0, beam.length);

      // Saturated luminous neon in dark mode; deep rich cerulean/azure in light mode
      const saturation = isDark ? '88%' : '76%';
      const lightness = isDark ? '66%' : '44%';

      gradient.addColorStop(0, `hsla(${beam.hue}, ${saturation}, ${lightness}, 0)`);
      gradient.addColorStop(0.1, `hsla(${beam.hue}, ${saturation}, ${lightness}, ${pulsingOpacity * 0.45})`);
      gradient.addColorStop(0.4, `hsla(${beam.hue}, ${saturation}, ${lightness}, ${pulsingOpacity})`);
      gradient.addColorStop(0.6, `hsla(${beam.hue}, ${saturation}, ${lightness}, ${pulsingOpacity})`);
      gradient.addColorStop(0.9, `hsla(${beam.hue}, ${saturation}, ${lightness}, ${pulsingOpacity * 0.45})`);
      gradient.addColorStop(1, `hsla(${beam.hue}, ${saturation}, ${lightness}, 0)`);

      c.fillStyle = gradient;
      c.fillRect(-beam.width / 2, 0, beam.width, beam.length);
      c.restore();
    }

    let isRunning = true;

    function animate() {
      if (!isRunning || !canvas || !ctx) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      ctx.clearRect(0, 0, width, height);

      // Hardware-accelerated glow blur
      try {
        ctx.filter = 'blur(32px)';
      } catch {
        // Fallback for browsers without CanvasFilter
      }

      const totalBeams = beamsRef.current.length;
      for (let i = 0; i < totalBeams; i++) {
        const beam = beamsRef.current[i];
        beam.y -= beam.speed;
        beam.pulse += beam.pulseSpeed;

        if (beam.y + beam.length < -100) {
          resetBeam(beam, i, totalBeams, width, height);
        }

        drawBeam(ctx, beam);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    animationFrameRef.current = requestAnimationFrame(animate);

    // Pause animation when tab is not active to save battery/CPU
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      } else {
        isRunning = true;
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isRunning = false;
      window.removeEventListener('resize', updateCanvasSize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <div 
      className="beams-background-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }} 
      aria-hidden="true"
    >
      {/* Dynamic Animated Canvas with CSS blur layer */}
      <canvas
        ref={canvasRef}
        className="beams-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />

      {/* Ambient subtle vignette overlay to ground the screen edges without blanket blur */}
      <div
        className="beams-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at 50% 0%, transparent 45%, rgba(0, 0, 0, 0.16) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
