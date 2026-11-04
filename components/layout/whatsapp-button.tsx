import { whatsappNumber } from '@/lib/whatsapp.mjs';
import styles from './whatsapp-button.module.css';

export function WhatsAppButton({ number }: { number: string }) {
  const digits = whatsappNumber(number);
  if (!digits) return null;

  return <a className={styles.button} href={`https://wa.me/${digits}`}
    target="_blank" rel="noopener noreferrer"
    aria-label="Conversar com a Biosfera pelo WhatsApp (abre em nova aba)"
    title="Conversar pelo WhatsApp">
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.47 0 .12 5.35.12 11.93c0 2.1.55 4.16 1.6 5.97L.02 24l6.25-1.64a11.95 11.95 0 0 0 5.77 1.47h.01C18.62 23.83 24 18.48 24 11.9c0-3.19-1.25-6.18-3.48-8.42ZM12.05 21.8a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.71.97.99-3.62-.23-.37a9.89 9.89 0 0 1-1.52-5.26c0-5.47 4.45-9.92 9.93-9.92a9.85 9.85 0 0 1 7.02 2.91 9.85 9.85 0 0 1 2.91 7.02c0 5.47-4.47 9.86-9.98 9.86Zm5.44-7.41c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17c-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.67-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.21 5.09 4.5.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  </a>;
}
