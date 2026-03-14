import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AlertTriangle, Clock } from 'lucide-react';
import DangerBadge from '../transactions/DangerBadge';
import { formatDistanceToNow } from 'date-fns';

export default function AlertsPanel({ limit = 6 }) {
  const { data: flags, isLoading } = useQuery({
    queryKey: ['flags'],
    queryFn: api.getFlags,
  });

  const recentFlags = flags?.slice(0, limit) || [];

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Recent Alerts</h3>
        </div>
        <span className="badge-critical">{flags?.length || 0} active</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />
          ))
        ) : recentFlags.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            No active alerts
          </div>
        ) : (
          recentFlags.map(flag => (
            <div
              key={flag.id}
              className={`p-3 rounded-lg border transition-all duration-200 hover:border-white/10 cursor-default ${
                flag.flagLevel === 'CRITICAL' ? 'bg-red-500/5 border-red-500/20' :
                flag.flagLevel === 'HIGH' ? 'bg-orange-500/5 border-orange-500/20' :
                'bg-white/3 border-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{flag.entityName}</p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{flag.reason}</p>
                </div>
                <DangerBadge level={flag.flagLevel} />
              </div>
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-600">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(flag.createdAt), { addSuffix: true })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
