export function downloadCSV(filename: string, rows: Array<Record<string, any>>) {
  if (!rows || rows.length === 0) {
    alert('Nada para exportar.');
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // se tem ; ," ou quebras, envolve em aspas
    if (/[;"\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.join(';'),
    ...rows.map(r => headers.map(h => escape(r[h])).join(';')),
  ].join('\r\n');

  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
