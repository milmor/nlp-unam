'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Jupyter notebook cell (minimal type for viewing) */
type NbCell = {
  cell_type: string;
  source?: string[] | string;
};

type NotebookDoc = {
  cells?: NbCell[];
  [key: string]: unknown;
};

function getSource(cell: NbCell): string {
  const s = cell.source;
  if (Array.isArray(s)) return s.join('');
  return typeof s === 'string' ? s : '';
}

interface Props {
  notebook: NotebookDoc;
  className?: string;
}

export default function NotebookViewer({ notebook, className = '' }: Props) {
  const cells = notebook?.cells ?? [];

  return (
    <div className={`notebook-viewer ${className}`}>
      {cells.map((cell, idx) => {
        const source = getSource(cell);
        if (cell.cell_type === 'markdown') {
          return (
            <div key={idx} className="notebook-viewer-cell notebook-viewer-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
            </div>
          );
        }
        if (cell.cell_type === 'code') {
          return (
            <div key={idx} className="notebook-viewer-cell notebook-viewer-code">
              <pre><code>{source}</code></pre>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
