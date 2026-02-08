export function generateOutputPath(
  command: string,
  dataset: string,
  format: 'csv' | 'json',
  tokens?: string,
): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    String(now.getMilliseconds()).padStart(3, '0'),
  ].join('');

  const parts = [command, dataset];
  if (tokens) {
    const sanitized = tokens
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .join('-');
    if (sanitized) {
      parts.push(sanitized);
    }
  }
  parts.push(`${date}-${time}`);

  const ext = format === 'json' ? 'jsonl' : format;
  return `${parts.join('-')}.${ext}`;
}
