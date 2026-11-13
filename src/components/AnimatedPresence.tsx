import React, { useEffect, useState } from 'react';

interface AnimatedPresenceProps {
  show: boolean;
  durationMs?: number;
  children: React.ReactNode;
}

/**
 * Menjaga komponen modal tetap ter-mount selama durasi animasi keluar
 * agar proses penutupan (close) selalu memiliki transisi fade & scale yang mulus.
 */
export const AnimatedPresence: React.FC<AnimatedPresenceProps> = ({
  show,
  durationMs = 190,
  children,
}) => {
  const [shouldRender, setShouldRender] = useState<boolean>(show);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (!shouldRender) return;
    setIsClosing(true);
    const timer = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, durationMs);

    return () => clearTimeout(timer);
  }, [show, durationMs, shouldRender]);

  if (!shouldRender) return null;

  return <div className={isClosing ? 'ui-modal-closing' : undefined}>{children}</div>;
};
