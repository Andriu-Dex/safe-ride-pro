'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from './button';
import styles from './styles/file-preview-modal.module.css';

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
      return 'Pasa el puntero sobre la imagen para ampliar los detalles del documento.';
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
      className={styles.modalOverlay}
      onClick={onClose}
      role="dialog"
    >
      <div
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.headerContent}>
            <p className={styles.kicker}>Previsualizaci&oacute;n</p>
            <h2 className={styles.title} id="file-preview-modal-title">
              {title}
            </h2>
            <p className={styles.description}>
              {description ?? previewHint}
            </p>
          </div>
          <button
            aria-label="Cerrar previsualizaci&oacute;n"
            className={styles.modalClose}
            onClick={onClose}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.metaRow}>
            <span className={styles.statusPill}>
              {getFileTypeLabel(mimeType)}
            </span>
            {fileName ? <span className={styles.fileName}>{fileName}</span> : null}
          </div>

          <div className={styles.previewSurface}>
            {isLoading ? (
              <div className={styles.emptyState}>
                <p>Preparando la previsualizaci&oacute;n del documento...</p>
              </div>
            ) : errorMessage ? (
              <div className={styles.errorText}>{errorMessage}</div>
            ) : isImage && fileUrl ? (
              <div
                className={styles.previewImageShell}
              onMouseMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                setZoomOrigin(`${x}% ${y}%`);
              }}
            >
              <img
                alt={title}
                  className={styles.previewImage}
                src={fileUrl}
                style={{ transformOrigin: zoomOrigin }}
              />
            </div>
          ) : isPdf && fileUrl ? (
            <iframe
                className={styles.previewFrame}
              src={fileUrl}
              title={title}
            />
          ) : (
              <div className={styles.emptyState}>
                <p>
                  No fue posible generar una previsualizaci&oacute;n directa para este archivo.
              </p>
            </div>
          )}
        </div>
        </div>

        <div className={styles.buttonRow}>
          {onDownload ? (
            <Button disabled={isDownloading || isLoading} onClick={onDownload} variant="secondary">
              <span className={styles.btnIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </span>
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
