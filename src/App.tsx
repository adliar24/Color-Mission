import React, { useState } from 'react';
import { GameShell } from './components/GameShell';

export default function App() {
  const [autostart] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('autostart') === '1';
    }
    return false;
  });

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <GameShell autostart={autostart} />
    </div>
  );
}
