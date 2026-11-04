'use client';

/* eslint-disable @next/next/no-img-element -- pré-visualização local controlada pelo formulário */
import { useMemo, useRef, useState, type CSSProperties } from 'react';

type FileUploadProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  endpoint: string;
  accept: string;
  maxBytes: number;
  helperText: string;
  kind: 'image' | 'video';
  onBusyChange?: (busy: boolean) => void;
};

type SelectedFile = {
  name: string;
  size: number;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function fileNameFromUrl(url: string) {
  if (!url) return '';
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    return decodeURIComponent(pathname.split('/').pop() || '');
  } catch {
    return url;
  }
}

function isAcceptedFile(file: File, accept: string) {
  const rules = accept
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);

  if (!rules.length) return true;

  const fileType = (file.type || '').toLowerCase();
  const fileName = file.name.toLowerCase();

  return rules.some(rule => {
    if (rule.endsWith('/*')) {
      const prefix = rule.slice(0, -1);
      return fileType.startsWith(prefix);
    }

    if (rule.startsWith('.')) {
      return fileName.endsWith(rule);
    }

    return fileType === rule;
  });
}

export function FileUpload({
  label,
  value,
  onChange,
  endpoint,
  accept,
  maxBytes,
  helperText,
  kind,
  onBusyChange,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploading = useRef(false);

  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  const currentName = useMemo(
    () => selectedFile?.name || fileNameFromUrl(value),
    [selectedFile, value],
  );

  const currentSize = useMemo(
    () => (selectedFile ? formatBytes(selectedFile.size) : ''),
    [selectedFile],
  );

  function openPicker() {
    inputRef.current?.click();
  }

  function resetFileInput() {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  async function uploadFile(file: File) {
    if (uploading.current) return;
    setError('');

    if (!isAcceptedFile(file, accept)) {
      setError(
        kind === 'video'
          ? 'Use um arquivo MP4 ou WebM válido.'
          : 'Use um arquivo JPEG, PNG ou WebP válido.',
      );
      resetFileInput();
      return;
    }

    if (file.size > maxBytes) {
      setError(`O limite é ${formatBytes(maxBytes)}.`);
      resetFileInput();
      return;
    }

    setBusy(true);
    uploading.current = true;
    onBusyChange?.(true);
    setSelectedFile({ name: file.name, size: file.size });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
        },
        body: file,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result?.error === 'string'
            ? result.error
            : kind === 'video'
              ? 'Não foi possível enviar o vídeo.'
              : 'Não foi possível enviar a imagem.',
        );
      }

      if (!result?.url || typeof result.url !== 'string') {
        throw new Error('Resposta inválida do servidor.');
      }

      onChange(result.url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : kind === 'video'
            ? 'Não foi possível enviar o vídeo.'
            : 'Não foi possível enviar a imagem.',
      );
    } finally {
      setBusy(false);
      uploading.current = false;
      onBusyChange?.(false);
      resetFileInput();
    }
  }

  async function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  }

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>{label}</label>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={handleInputChange}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label={`${label} — clique ou arraste o arquivo`}
        onClick={openPicker}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={event => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragOver={event => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={event => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        style={{
          ...styles.dropzone,
          ...(dragActive ? styles.dropzoneActive : {}),
          ...(busy ? styles.dropzoneBusy : {}),
        }}
      >
        <div style={styles.dropzoneContent}>
          <div style={styles.iconCircle}>
            <span style={styles.icon}>
              {kind === 'video' ? '▶' : '↑'}
            </span>
          </div>

          <div style={styles.textBlock}>
            <strong style={styles.title}>
              Arraste e solte aqui ou clique para selecionar
            </strong>

            <span style={styles.subtitle}>
              {kind === 'video'
                ? 'Envie um vídeo do seu computador'
                : 'Envie uma imagem do seu computador'}
            </span>

            <span style={styles.meta}>
              {helperText}
              {busy ? ' · Enviando…' : ''}
            </span>
          </div>

          <button
            type="button"
            style={styles.actionButton}
            onClick={event => {
              event.stopPropagation();
              openPicker();
            }}
          >
            Selecionar arquivo
          </button>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert" style={styles.error}>
          {error}
        </p>
      )}

      {value && (
        <div style={styles.previewCard}>
          <div style={styles.previewMedia}>
            {kind === 'image' ? (
              <img
                src={value}
                alt="Pré-visualização do arquivo enviado"
                style={styles.imagePreview}
              />
            ) : (
              <video
                src={value}
                controls
                preload="metadata"
                style={styles.videoPreview}
              />
            )}
          </div>

          <div style={styles.previewInfo}>
            <strong style={styles.previewName}>
              {currentName || 'Arquivo enviado'}
            </strong>

            {currentSize ? (
              <small style={styles.previewMeta}>{currentSize}</small>
            ) : (
              <small style={styles.previewMeta}>
                Arquivo pronto para uso no formulário.
              </small>
            )}

            <div style={styles.previewActions}>
              <button
                type="button"
                className="button secondary"
                onClick={openPicker}
              >
                Trocar arquivo
              </button>

              <button
                type="button"
                className="button danger"
                onClick={() => {
                  setError('');
                  setSelectedFile(null);
                  onChange('');
                  resetFileInput();
                }}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'grid',
    gap: '0.75rem',
  },
  label: {
    fontWeight: 700,
    color: 'var(--foreground, #0b2247)',
  },
  dropzone: {
    border: '1.5px dashed rgba(0, 115, 255, 0.25)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(244,248,255,0.9))',
    borderRadius: '1rem',
    padding: '1rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  dropzoneActive: {
    borderColor: 'rgba(0, 115, 255, 0.7)',
    boxShadow: '0 0 0 4px rgba(0, 115, 255, 0.12)',
    transform: 'translateY(-1px)',
  },
  dropzoneBusy: {
    opacity: 0.85,
  },
  dropzoneContent: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: '1rem',
    alignItems: 'center',
  },
  iconCircle: {
    width: '3.25rem',
    height: '3.25rem',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, rgba(0,191,255,0.18), rgba(0,90,255,0.18))',
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(0, 115, 255, 0.16)',
    flexShrink: 0,
  },
  icon: {
    fontSize: '1.2rem',
    color: '#0b57d0',
    lineHeight: 1,
  },
  textBlock: {
    display: 'grid',
    gap: '0.2rem',
    minWidth: 0,
  },
  title: {
    color: '#0b2247',
    fontSize: '1rem',
  },
  subtitle: {
    color: '#47627f',
    fontSize: '0.95rem',
  },
  meta: {
    color: '#64748b',
    fontSize: '0.85rem',
  },
  actionButton: {
    border: 'none',
    borderRadius: '0.8rem',
    background: 'linear-gradient(135deg, #22d3ee, #2563eb)',
    color: '#ffffff',
    padding: '0.8rem 1rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  error: {
    margin: 0,
  },
  previewCard: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 240px) 1fr',
    gap: '1rem',
    padding: '1rem',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    borderRadius: '1rem',
    background: '#ffffff',
  },
  previewMedia: {
    minHeight: '150px',
    display: 'grid',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    maxHeight: '220px',
    objectFit: 'cover',
    borderRadius: '0.85rem',
    border: '1px solid rgba(15, 23, 42, 0.08)',
  },
  videoPreview: {
    width: '100%',
    maxHeight: '220px',
    borderRadius: '0.85rem',
    background: '#091f43',
    border: '1px solid rgba(15, 23, 42, 0.08)',
  },
  previewInfo: {
    display: 'grid',
    alignContent: 'center',
    gap: '0.4rem',
  },
  previewName: {
    color: '#0b2247',
    fontSize: '1rem',
    wordBreak: 'break-word',
  },
  previewMeta: {
    color: '#64748b',
  },
  previewActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginTop: '0.4rem',
  },
};
