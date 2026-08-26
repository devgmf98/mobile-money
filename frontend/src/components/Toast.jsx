import { useEffect } from 'react';

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onClose && onClose(), duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  const bg = type === 'success' ? '#16a34a' : type === 'error' ? '#DC2626' : '#00A86B';

  const style = {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: 9999,
    background: bg,
    color: 'white',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    minWidth: '220px',
    maxWidth: '360px'
  };

  return (
    <div style={style} role="status" aria-live="polite">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}</div>
      <div style={{ fontSize: 12.5 }}>{message}</div>
    </div>
  );
}
