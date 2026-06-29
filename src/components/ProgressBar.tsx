'use client';

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-base font-medium text-ring-gold tabular-nums">
          {current} / {total} Located
        </span>
        <span className="text-sm font-medium text-ring-gold tabular-nums">
          {percentage.toFixed(2)}%
        </span>
      </div>
      <div className="w-full bg-ring-light rounded-full h-5 border border-ring-gold shadow-[inset_0_0_4px_rgba(0,0,0,0.5)]">
        <div
          className="bg-ring-gold h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
} 
