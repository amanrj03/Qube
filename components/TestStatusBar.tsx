'use client';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

function WifiIcon({ signal }: { signal: number }) {
  const bars = [
    { h: 4,  y: 12, minSignal: 1 },
    { h: 7,  y: 9,  minSignal: 2 },
    { h: 10, y: 6,  minSignal: 3 },
    { h: 13, y: 3,  minSignal: 4 },
  ];
  const color = signal <= 1 ? '#ef4444' : signal === 2 ? '#f59e0b' : '#22c55e';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {bars.map((bar, i) => (
        <rect key={i} x={i * 4 + 1} y={bar.y} width={3} height={bar.h} rx={1}
          fill={signal >= bar.minSignal ? color : '#d1d5db'} />
      ))}
    </svg>
  );
}

function OfflineModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
        <div className="text-5xl mb-3">📡</div>
        <h2 className="text-lg font-bold text-red-600 mb-2">No Internet Connection</h2>
        <p className="text-sm text-gray-600 mb-4">
          Your answers are <strong>not being saved</strong> right now. Please reconnect immediately. Do not close this window.
        </p>
        <button onClick={onDismiss} className="w-full bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition">
          I understand, I'll reconnect
        </button>
      </div>
    </div>
  );
}

export default function TestStatusBar() {
  const { signal, showOfflineModal, dismissOfflineModal } = useNetworkStatus();
  return (
    <>
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-gray-200 bg-gray-50" title="Server connectivity (checks every 5s)">
        <WifiIcon signal={signal} />
        <span className="text-xs text-gray-500">
          {signal === 0 ? 'Offline' : signal === 1 ? 'Poor' : signal === 2 ? 'Fair' : signal === 3 ? 'Good' : 'Strong'}
        </span>
      </div>
      {showOfflineModal && <OfflineModal onDismiss={dismissOfflineModal} />}
    </>
  );
}
