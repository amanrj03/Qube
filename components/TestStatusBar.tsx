'use client';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useBattery } from '../hooks/useBattery';

// ── WiFi bars SVG ─────────────────────────────────────────────────────────────
function WifiIcon({ signal }: { signal: number }) {
  // 4 bars, each lights up based on signal strength
  const bars = [
    { h: 4,  y: 12, minSignal: 1 },
    { h: 7,  y: 9,  minSignal: 2 },
    { h: 10, y: 6,  minSignal: 3 },
    { h: 13, y: 3,  minSignal: 4 },
  ];

  const color = signal === 0 ? '#ef4444'
    : signal === 1 ? '#ef4444'
    : signal === 2 ? '#f59e0b'
    : '#22c55e';

  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={i * 4 + 1}
          y={bar.y}
          width={3}
          height={bar.h}
          rx={1}
          fill={signal >= bar.minSignal ? color : '#d1d5db'}
        />
      ))}
    </svg>
  );
}

// ── Battery icon ──────────────────────────────────────────────────────────────
function BatteryIcon({ level, charging }: { level: number; charging: boolean }) {
  const fillColor = level <= 10 ? '#ef4444' : level <= 20 ? '#f59e0b' : '#22c55e';
  const fillWidth = Math.max(1, Math.round((level / 100) * 20));

  return (
    <div className="flex items-center gap-1">
      <svg width="26" height="14" viewBox="0 0 26 14" fill="none">
        {/* Battery body */}
        <rect x="0.5" y="0.5" width="22" height="13" rx="2.5" stroke="#9ca3af" strokeWidth="1" fill="none" />
        {/* Battery tip */}
        <rect x="23" y="4" width="2.5" height="6" rx="1" fill="#9ca3af" />
        {/* Fill */}
        <rect x="2" y="2" width={fillWidth} height="10" rx="1.5" fill={fillColor} />
      </svg>
      <span className="text-xs font-medium" style={{ color: fillColor }}>
        {charging ? '⚡' : ''}{level}%
      </span>
    </div>
  );
}

// ── Offline modal ─────────────────────────────────────────────────────────────
function OfflineModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
        <div className="text-5xl mb-3">📡</div>
        <h2 className="text-lg font-bold text-red-600 mb-2">No Internet Connection</h2>
        <p className="text-sm text-gray-600 mb-4">
          Your answers are <strong>not being saved</strong> right now. Please reconnect to the internet immediately.
          Do not close this window.
        </p>
        <button
          onClick={onDismiss}
          className="w-full bg-red-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition"
        >
          I understand, I'll reconnect
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function TestStatusBar() {
  const { signal, showOfflineModal, dismissOfflineModal } = useNetworkStatus();
  const battery = useBattery();

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
        {/* WiFi — shows server connectivity, not device WiFi */}
        <div className="flex items-center gap-1.5" title="Server connectivity (checks every 5s)">
          <WifiIcon signal={signal} />
          <span className="text-xs text-gray-500">
            {signal === 0 ? 'Offline' : signal === 1 ? 'Poor' : signal === 2 ? 'Fair' : signal === 3 ? 'Good' : 'Strong'}
          </span>
        </div>

        {/* Battery — only meaningful on mobile; desktop Chrome always returns 100% */}
        {battery.supported && battery.level < 100 && (
          <BatteryIcon level={battery.level} charging={battery.charging} />
        )}
      </div>

      {showOfflineModal && <OfflineModal onDismiss={dismissOfflineModal} />}
    </>
  );
}
