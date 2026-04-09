import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const SIZE_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export default function Modal({ open, onClose, title, icon, size = 'md', children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const input = dialogRef.current?.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
      input?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
          role="presentation"
          tabIndex={-1}
        />
        <div
          ref={dialogRef}
          className={`modal-panel relative w-full ${SIZE_MAP[size]}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
            <h3 id="modal-title" className="text-base font-semibold text-gray-900 flex items-center gap-2">
              {icon}
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-500 rounded cursor-pointer"
              aria-label="סגור"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5">
            {children}
          </div>

          {footer && (
            <div className="flex justify-end gap-2 border-t border-slate-200/70 bg-white/50 px-6 py-4 rounded-b-[20px]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
