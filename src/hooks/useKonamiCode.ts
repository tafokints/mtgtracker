'use client';

import { useEffect, useState, useCallback } from 'react';

const konamiCode = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a'
];

export const useKonamiCode = (callback: () => void) => {
  const [keys, setKeys] = useState<string[]>([]);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    setKeys((currentKeys) => {
      const newKeys = [...currentKeys, event.key].slice(-konamiCode.length);
      if (JSON.stringify(newKeys) === JSON.stringify(konamiCode)) {
        callback();
      }
      return newKeys;
    });
  }, [callback]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);
}; 