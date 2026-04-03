'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from './button';

type FilePreviewModalProps = {
  isOpen: boolean;
  title: string;
  description?: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  fileName?: string | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  isDownloading?: boolean;
  onClose: () => void;
  onDownload?: () => void;
};

function getFileTypeLabel(mimeType: string | null): string {
  if (!mimeType) {
    return 'Archivo';
  }

  if (mimeType.startsWith('image/')) {
    return 'Imagen';
  }

  if (mimeType === 'application/pdf') {
    return 'PDF';
  }

  return 'Archivo';
}

export function FilePreviewModal({
  isOpen,
  title,
  description,
  fileUrl,
  mimeType,
  fileName,
  isLoading = false,
  errorMessage,
  isDownloading = false,
  onClose,
  onDownload,
}: FilePreviewModalProps) {
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');
  const isImage = Boolean(fileUrl && mimeType?.startsWith('image/'));
  const isPdf = Boolean(fileUrl && mimeType === 'application/pdf');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const previewHint = useMemo(() => {
    if (isImage) {
      return 'Pasa el cursor sobre la imagen para inspeccionar mejor los detalles.';
    }

    if (isPdf) {
      return 'Usa el visor integrado para revisar el documento antes de descargarlo.';
    }

    return 'Puedes descargar el archivo para revisarlo localmente.';
  }, [isImage, isPdf]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-labelledby="file-preview-modal-title"
      aria-modal="true"
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="modal-card modal-card-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="section-label">Previsualizacion</p>
            <h2 className="panel-title" id="file-preview-modal-title">
              {title}
            </h2>
            <p className="panel-text">
              {description ?? previewHint}
            </p>
          </div>
          <Button onClick={onClose} variant="secondary">
            Cerrar
          </Button>
        </div>

        <div className="modal-meta-row">
          <span className="status-pill status-pill-neutral">
            {getFileTypeLabel(mimeType)}
          </span>
          {fileName ? <span className="modal-file-name">{fileName}</span> : null}
        </div>

        <div className="file-preview-surface">
          {isLoading ? (
            <div className="file-preview-empty-state">
              <p className="panel-text">Preparando la previsualizacion del documento...</p>
            </div>
          ) : errorMessage ? (
            <div className="form-error">{errorMessage}</div>
          ) : isImage && fileUrl ? (
            <div
              className="file-preview-image-shell"
              onMouseMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                setZoomOrigin(`${x}% ${y}%`);
              }}
            >
              <img
                alt={title}
                className="file-preview-image"
                src={fileUrl}
                style={{ transformOrigin: zoomOrigin }}
              />
            </div>
          ) : isPdf && fileUrl ? (
            <iframe
              className="file-preview-frame"
              src={fileUrl}
              title={title}
            />
          ) : (
            <div className="file-preview-empty-state">
              <p className="panel-text">
                No fue posible generar una previsualizacion directa para este archivo.
              </p>
            </div>
          )}
        </div>

        <div className="button-row">
          {onDownload ? (
            <Button disabled={isDownloading || isLoading} onClick={onDownload} variant="secondary">
              {isDownloading ? 'Descargando...' : 'Descargar archivo'}
            </Button>
          ) : null}
          <Button onClick={onClose} variant="ghost">
            Volver
          </Button>
        </div>
      </div>
    </div>
  );
}
