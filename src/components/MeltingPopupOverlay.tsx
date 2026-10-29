import React, { useEffect, useRef, useState } from 'react';
import { ALIGNED_MELTING_SLIDES } from '../shared/agarwoodMotivation';

const SLIDE_LIFECYCLE_MS = 11200;
const MELT_START_MS = 7200;

interface MeltingPopupOverlayProps {
  replayNonce: number;
  dismissed: boolean;
  onAllSlidesMelted: () => void;
}

export const MeltingPopupOverlay: React.FC<MeltingPopupOverlayProps> = ({
  replayNonce,
  dismissed,
  onAllSlidesMelted,
}) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const displacementRef = useRef<SVGFEDisplacementMapElement | null>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement | null>(null);
  const turbulenceRef = useRef<SVGFETurbulenceElement | null>(null);

  useEffect(() => {
    setSlideIndex(0);
    setCompleted(false);
  }, [replayNonce]);

  useEffect(() => {
    if (dismissed || completed || ALIGNED_MELTING_SLIDES.length === 0) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reset SVG filter attributes cleanly at the start of each slide
    displacementRef.current?.setAttribute('scale', '0');
    blurRef.current?.setAttribute('stdDeviation', '0 0');
    turbulenceRef.current?.setAttribute('baseFrequency', '0.012 0.036');

    let rafId = 0;
    const startTime = performance.now();

    const stepMelt = (now: number) => {
      const elapsed = now - startTime;

      if (elapsed >= SLIDE_LIFECYCLE_MS + 120) {
        if (slideIndex + 1 < ALIGNED_MELTING_SLIDES.length) {
          setSlideIndex((prev) => prev + 1);
        } else {
          setCompleted(true);
          onAllSlidesMelted();
        }
        return;
      }

      if (!prefersReducedMotion && elapsed >= MELT_START_MS) {
        const rawT = Math.min(
          1,
          (elapsed - MELT_START_MS) / (SLIDE_LIFECYCLE_MS - MELT_START_MS)
        );
        const eased = rawT * rawT * (3 - 2 * rawT);
        const meltCurve = rawT * eased;

        const dispScale = (meltCurve * 115).toFixed(2);
        const blurX = (meltCurve * 3.8).toFixed(2);
        const blurY = (meltCurve * 14.0).toFixed(2);
        const freqX = (0.012 + meltCurve * 0.008).toFixed(4);
        const freqY = Math.max(0.006, 0.036 - meltCurve * 0.022).toFixed(4);

        displacementRef.current?.setAttribute('scale', dispScale);
        blurRef.current?.setAttribute('stdDeviation', `${blurX} ${blurY}`);
        turbulenceRef.current?.setAttribute(
          'baseFrequency',
          `${freqX} ${freqY}`
        );
      }

      rafId = window.requestAnimationFrame(stepMelt);
    };

    rafId = window.requestAnimationFrame(stepMelt);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [slideIndex, dismissed, completed, replayNonce, onAllSlidesMelted]);

  if (dismissed || completed || ALIGNED_MELTING_SLIDES.length === 0) {
    return null;
  }

  const activeSlide =
    ALIGNED_MELTING_SLIDES[slideIndex] ?? ALIGNED_MELTING_SLIDES[0];

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none select-none flex items-center justify-center px-6 pt-16 pb-44 sm:px-10 sm:pt-20 sm:pb-48"
      role="status"
      aria-live="polite"
    >
      {/* Zero-footprint SVG Liquid-Canopy Melt Filter */}
      <svg
        className="absolute w-0 h-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <filter
            id="canopy-liquid-melt"
            x="-20%"
            y="-20%"
            width="140%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              ref={turbulenceRef}
              type="fractalNoise"
              baseFrequency="0.012 0.036"
              numOctaves={3}
              seed={11}
              result="canopyNoise"
            />
            <feDisplacementMap
              ref={displacementRef}
              in="SourceGraphic"
              in2="canopyNoise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
              result="meltedShape"
            />
            <feGaussianBlur
              ref={blurRef}
              in="meltedShape"
              stdDeviation="0 0"
              result="softMelted"
            />
          </filter>
        </defs>
      </svg>

      {/* Large-Font On-Screen Pop-Up Frame (100% pointer-events-none so 3D Agarwood controls stay clickable) */}
      <div
        key={`${replayNonce}-${activeSlide.id}`}
        className="melting-popup-card relative max-w-4xl w-full rounded-2xl border px-7 py-8 sm:px-12 sm:py-10 text-center"
      >
        <p className="melting-popup-title font-mono tabular-nums text-sm sm:text-base lg:text-lg tracking-wide opacity-90">
          {activeSlide.kicker} · Notice {slideIndex + 1} of{' '}
          {ALIGNED_MELTING_SLIDES.length}
        </p>

        <h1 className="melting-popup-title mt-3 font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.06] text-balance">
          {activeSlide.headline}
        </h1>

        <p className="melting-popup-accent mt-4 font-display text-xl sm:text-3xl lg:text-4xl font-semibold tracking-tight leading-[1.18] text-balance">
          {activeSlide.highlight}
        </p>

        <p className="melting-popup-title mt-4 text-base sm:text-xl lg:text-2xl font-medium leading-relaxed opacity-90 text-balance">
          {activeSlide.detail}
        </p>
      </div>
    </div>
  );
};
