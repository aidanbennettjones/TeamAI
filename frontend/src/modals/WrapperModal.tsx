import React, { useEffect, useRef } from 'react';

import Exit from '../assets/exit.svg';

interface WrapperModalPropsType {
  children: React.ReactNode;
  close: () => void;
  isPerformingTask?: boolean;
  className?: string;
  contentClassName?: string;
}

export default function WrapperModal({
  children,
  close,
  isPerformingTask = false,
  className = '', // Default width, but can be overridden
  contentClassName = '', // Default padding, but can be overridden
}: WrapperModalPropsType) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPerformingTask) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };

    const handleEscapePress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapePress);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapePress);
    };
  }, [close]);

  return (
    <div className="fixed top-0 left-0 z-30 flex h-screen w-screen items-center justify-center bg-gray-alpha bg-opacity-50">
      <div
        ref={modalRef}
        className={`relative w-11/12 sm:w-[512px] p-8 rounded-2xl bg-white dark:bg-[#26272E] ${className}`}
      >
        {!isPerformingTask && (
          <button
            className="absolute top-3 right-4 m-2 w-3 z-50"
            onClick={close}
          >
            <img className="filter dark:invert" src={Exit} alt="Close" />
          </button>
        )}
        <div className={`${contentClassName}`}>{children}</div>
      </div>
    </div>
  );
}
