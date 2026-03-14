const FLAG_CONFIG = {
  CRITICAL: { label: 'CRITICAL', className: 'badge-critical' },
  HIGH: { label: 'HIGH', className: 'badge-high' },
  MEDIUM: { label: 'MEDIUM', className: 'badge-medium' },
  LOW: { label: 'LOW', className: 'badge-low' },
  NONE: { label: 'NONE', className: 'badge-none' },
};

export default function DangerBadge({ level, size = 'sm' }) {
  const config = FLAG_CONFIG[level] || FLAG_CONFIG.NONE;
  return (
    <span className={config.className}>
      {config.label}
    </span>
  );
}

export function rowClass(flagLevel) {
  switch (flagLevel) {
    case 'CRITICAL': return 'row-critical';
    case 'HIGH': return 'row-high';
    case 'MEDIUM': return 'row-medium';
    case 'LOW': return 'row-low';
    default: return 'row-none';
  }
}
