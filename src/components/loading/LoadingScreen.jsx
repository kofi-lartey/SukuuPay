import React, { useEffect, useState, useCallback } from 'react';
import './LoadingScreen.css';

export const ANIMATION_VARIANTS = {
  pulse: 'loading-pulse',
  rotate: 'loading-rotate',
  morph: 'loading-morph',
  breathe: 'loading-breathe',
  orbit: 'loading-orbit',
  wave: 'loading-wave',
};

const TRANSITION_DURATION = 600;
const MIN_DISPLAY_TIME = 800;

export function LoadingScreen({
  variant = 'pulse',
  logoSrc = '/sukuupay-logo.png',
  logoAlt = 'SukuuPay',
  size = 120,
  backgroundColor = 'var(--loading-bg, #ffffff)',
  onComplete,
  minDisplayTime = MIN_DISPLAY_TIME,
  className = '',
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [startTime] = useState(Date.now());

  const animationClass = ANIMATION_VARIANTS[variant] || ANIMATION_VARIANTS.pulse;

  const handleTransitionEnd = useCallback(() => {
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, minDisplayTime - elapsed);

    const timer = setTimeout(() => {
      setIsTransitioning(true);
      setTimeout(handleTransitionEnd, TRANSITION_DURATION);
    }, remaining);

    return () => clearTimeout(timer);
  }, [startTime, minDisplayTime, handleTransitionEnd]);

  if (!isVisible) return null;

  return (
    <div
      className={`loading-screen ${animationClass} ${isTransitioning ? 'loading-exit' : ''} ${className}`}
      style={{
        '--loading-bg': backgroundColor,
        '--logo-size': `${size}px`,
      }}
      role="status"
      aria-label="Loading application"
      aria-busy="true"
    >
      <div className="loading-container">
        <div className="loading-logo-wrapper">
          <img
            src={logoSrc}
            alt={logoAlt}
            className="loading-logo"
            style={{ width: size, height: size }}
            loading="eager"
            fetchPriority="high"
          />
          {variant === 'orbit' && (
            <div className="loading-orbit-ring" aria-hidden="true">
              <span className="loading-orbit-dot" />
              <span className="loading-orbit-dot" />
              <span className="loading-orbit-dot" />
            </div>
          )}
          {variant === 'wave' && (
            <div className="loading-wave-bars" aria-hidden="true">
              <span className="loading-wave-bar" />
              <span className="loading-wave-bar" />
              <span className="loading-wave-bar" />
              <span className="loading-wave-bar" />
              <span className="loading-wave-bar" />
            </div>
          )}
        </div>
        <div className="loading-text" aria-hidden="true">Loading...</div>
      </div>
    </div>
  );
}

export function LoadingScreenProvider({ children, ...loadingProps }) {
  const [showLoading, setShowLoading] = useState(true);

  const handleComplete = useCallback(() => {
    setShowLoading(false);
  }, []);

  return (
    <>
      {showLoading && <LoadingScreen {...loadingProps} onComplete={handleComplete} />}
      {!showLoading && children}
    </>
  );
}

export default LoadingScreen;