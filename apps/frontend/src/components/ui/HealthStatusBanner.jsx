import { X, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

export default function HealthStatusBanner({ onClose, health }) {
  if (!health || health.backend.isLoading) return null;

  const isUnhealthy = !health.backend.isHealthy || !health.radar.isHealthy;

  if (!isUnhealthy) return null;

  const messages = [];

  if (!health.backend.isHealthy) {
    messages.push('Backend services unavailable');
  }

  if (!health.radar.isHealthy) {
    messages.push('Maps services unavailable');
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white px-4 py-3 shadow-lg z-50 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <WifiOff className="w-5 h-5" />
        <div>
          <div className="font-semibold">Service Alert</div>
          <div className="text-sm opacity-90">{messages.join('. ')}. Some features may not work properly.</div>
        </div>
      </div>
      <button
        onClick={onClose}
        className="hover:bg-yellow-600 rounded p-1 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
