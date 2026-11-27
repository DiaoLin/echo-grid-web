export function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(rows) {
  const header = ['point_id', 'location', 'time', 'db', 'period'];
  const lines = [header.join(',')];

  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key])).join(','));
  }

  return `${lines.join('\r\n')}\r\n`;
}
