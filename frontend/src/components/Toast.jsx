import { useEffect } from 'react';
import { CircleCheck, CircleX, Info, X } from 'lucide-react';

/* The result of an action, in the corner.

   Moved from the bottom-right to the top-right: on a phone the bottom of the
   screen is where the keyboard and the browser's own bar live, so a toast
   raised by submitting a form landed underneath one or both and was gone
   before it could be read. The top-right is clear on every screen the app
   runs on.

   Deliberately still a single toast rather than a stack -- these are raised
   one action at a time, and the second of two would only ever be pushing the
   first out of the way. */
export default function Toast({ message, type = 'info', duration = 4000, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(() => onClose && onClose(), duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  const Icon = type === 'success' ? CircleCheck : type === 'error' ? CircleX : Info;
  const title = type === 'success' ? 'Success' : type === 'error' ? 'Failed' : 'Info';

  return (
    <div className={`app-toast is-${type}`} role="status" aria-live="polite">
      <span className="app-toast-icon"><Icon size={18} /></span>
      <span className="app-toast-body">
        <strong className="app-toast-title">{title}</strong>
        <span className="app-toast-message">{message}</span>
      </span>
      {onClose && (
        <button type="button" className="app-toast-close" onClick={onClose} aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
