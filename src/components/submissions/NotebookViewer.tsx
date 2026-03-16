'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

  const darkTheme = {
    ...oneDark,
    'code[class*="language-"]': {
      ...oneDark['code[class*="language-"]'],
      background: 'transparent',
    },
    'pre[class*="language-"]': {
      ...oneDark['pre[class*="language-"]'],
      background: 'transparent',
    },
  } as typeof oneDark;

  const lightTheme = {
    ...vs,
    'code[class*="language-"]': {
      ...vs['code[class*="language-"]'],
      background: 'transparent',
      color: 'var(--text-primary)',
    },
    'pre[class*="language-"]': {
      ...vs['pre[class*="language-"]'],
      background: 'transparent',
    },
  } as typeof vs;

  const isDark =
    typeof window !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark';

  const codeTheme = isDark ? darkTheme : lightTheme;

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
              <SyntaxHighlighter
                language="python"
                style={codeTheme}
                customStyle={{ margin: 0, background: 'transparent' }}
                wrapLongLines
              >
                {source}
              </SyntaxHighlighter>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
