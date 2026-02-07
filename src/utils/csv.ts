export function toCsvLine(values: Array<string | number | boolean | null | undefined>): string {
  return values
    .map((value) => {
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    })
    .join(',');
}
