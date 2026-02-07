export function renderTable(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return '(no rows)\n';
  }

  const columns = uniqueColumns(rows);
  const widths = columns.map((column) => {
    const maxValueWidth = rows.reduce((max, row) => {
      const value = formatCell(row[column]);
      return Math.max(max, value.length);
    }, 0);
    return Math.max(column.length, maxValueWidth);
  });

  const divider = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
  const header =
    `| ${columns.map((column, index) => column.padEnd(widths[index])).join(' | ')} |`;
  const body = rows
    .map(
      (row) =>
        `| ${columns
          .map((column, index) => formatCell(row[column]).padEnd(widths[index]))
          .join(' | ')} |`,
    )
    .join('\n');

  return `${divider}\n${header}\n${divider}\n${body}\n${divider}\n`;
}

function uniqueColumns(rows: Array<Record<string, unknown>>): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      seen.add(key);
    }
  }
  return [...seen];
}

function formatCell(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}
