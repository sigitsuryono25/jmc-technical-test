import { useEffect } from 'react';

export default function Modal({ open, title = 'Form', onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <div
        className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${
          size === 'lg' ? 'modal-lg' : ''
        }`}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fs-6">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Tutup" />
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
