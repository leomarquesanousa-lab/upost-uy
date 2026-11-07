// Public endpoints confirmed from the supplied URL and Encuentro's official player.
export const additionalRadios = [
  { id: 'a49d2dd0-d52c-4acf-9a6a-b09833a08e01', name: 'Avenida Ciudadana', url: 'https://stm15.painelcast.com:7362/stream', stream_url: 'https://stm15.painelcast.com:7362/stream', description: 'Uruguay' },
  { id: 'a49d2dd0-d52c-4acf-9a6a-b09833a08e02', name: 'Radio Encuentro Minas', url: 'https://radioencuentrominas.com/', stream_url: 'https://servidor31-1.brlogic.com:7034/live?source=website', description: 'Minas, Uruguay' },
];
export function withAdditionalRadios(records) {
  const same = value => value.trim().replace(/\/$/, '').toLowerCase();
  return [...records, ...additionalRadios.filter(preset => !records.some(record => record.id === preset.id || same(record.name) === same(preset.name) || same(record.url) === same(preset.url))).map((preset, index) => ({
    ...preset, kind: 'radio', image_url: '', media_type: 'Radio en vivo', feed_url: '', category_slug: '', active: true, display_order: 100 + index,
  }))];
}
