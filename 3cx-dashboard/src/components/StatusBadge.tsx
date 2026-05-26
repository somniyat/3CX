const statusColors: Record<string, string> = {
  available: 'badge-green',
  online: 'badge-green',
  answered: 'badge-green',
  busy: 'badge-red',
  missed: 'badge-red',
  ringing: 'badge-yellow',
  away: 'badge-yellow',
  dnd: 'badge-red',
  offline: 'badge-gray',
};

export default function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const colorClass = statusColors[normalized] || 'badge-gray';
  return <span className={`badge ${colorClass}`}>{status}</span>;
}
