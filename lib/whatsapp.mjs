export function whatsappNumber(value = '') {
  const digits = String(value).replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}
