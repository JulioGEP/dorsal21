export const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

export const fmtDate = (value) => value?.toDate
  ? value.toDate().toLocaleString('ca-ES')
  : '';

export const initials = (name = '') => name
  .split(' ')
  .filter(Boolean)
  .map((part) => part[0])
  .slice(0, 2)
  .join('')
  .toUpperCase() || '?';

export const statusTone = (value = '') => {
  const normalized = String(value).toLowerCase();
  if (['verd', 'correcte', 'bé', 'be', 'ok', 'estable'].some((term) => normalized.includes(term))) return 'green';
  if (['vermell', 'alerta', 'risc', 'intervenció', 'intervencio'].some((term) => normalized.includes(term))) return 'red';
  if (['groc', 'atenció', 'atencio', 'pendent'].some((term) => normalized.includes(term))) return 'amber';
  return 'neutral';
};
