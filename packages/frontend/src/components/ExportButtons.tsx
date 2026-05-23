import React from 'react';
import { Download, FileText } from 'lucide-react';

interface Props {
  data: any[];
  filename: string;
  title: string;
  dateRange?: { from: string; to: string };
  columns?: { key: string; label: string }[];
}

export default function ExportButtons({ data, filename, title, dateRange, columns }: Props) {

  const exportCSV = () => {
    if (!data || data.length === 0) return;

    const keys = columns ? columns.map(c => c.key) : Object.keys(data[0] || {});
    const headers = columns ? columns.map(c => c.label) : keys;

    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        keys.map(key => {
          const val = row[key];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!data || data.length === 0) return;

    const keys = columns ? columns.map(c => c.key) : Object.keys(data[0] || {});
    const headers = columns ? columns.map(c => c.label) : keys;

    const tableRows = data.map(row =>
      `<tr>${keys.map(key => `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;">${row[key] ?? ''}</td>`).join('')}</tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f5f5f5; padding: 8px 10px; text-align: left; font-size: 12px; border-bottom: 2px solid #ddd; }
        tr:hover { background: #fafafa; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>${title}</h1>
      ${dateRange ? `<p class="meta">Period: ${dateRange.from} to ${dateRange.to} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-KE')}</p>` : ''}
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <script>window.onload = function() { window.print(); }</script>
      </body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="flex gap-2">
      <button onClick={exportCSV}
        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
        <Download size={14} /> CSV
      </button>
      <button onClick={exportPDF}
        className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
        <FileText size={14} /> PDF
      </button>
    </div>
  );
}
