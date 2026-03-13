'use client';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <h5 className="confirm-title">{title}</h5>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="btn-secondary btn-small" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-danger btn-small" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
