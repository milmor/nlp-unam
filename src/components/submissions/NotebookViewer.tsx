'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

/** Jupyter nbformat v4 output item */
type NbOutput = {
  output_type: string;
  name?: string;
  text?: string | string[];
  data?: Record<string, unknown>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
};

/** Jupyter notebook cell (minimal type for viewing) */
type NbCell = {
  cell_type: string;
  source?: string[] | string;
  outputs?: NbOutput[];
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

function normalizeText(t: string | string[] | undefined): string {
  if (t == null) return '';
  return Array.isArray(t) ? t.join('') : t;
}

function getMimeString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.join('');
  return null;
}

function getDataField(data: Record<string, unknown> | undefined, key: string): string | null {
  if (!data) return null;
  return getMimeString(data[key]);
}

function renderSingleOutput(out: NbOutput, idx: number): React.ReactNode {
  const { output_type } = out;

  if (output_type === 'stream') {
    const text = normalizeText(out.text);
    if (!text) return null;
    const isErr = out.name === 'stderr';
    return (
      <pre
        key={idx}
        className={`notebook-viewer-output notebook-viewer-output--stream${isErr ? ' notebook-viewer-output--stderr' : ''}`}
      >
        {text}
      </pre>
    );
  }

  if (output_type === 'execute_result' || output_type === 'display_data') {
    const data = out.data;
    const png = getDataField(data, 'image/png');
    const jpeg = getDataField(data, 'image/jpeg');
    const svg = getDataField(data, 'image/svg+xml');
    const plain = getDataField(data, 'text/plain');
    const html = getDataField(data, 'text/html');

    const parts: React.ReactNode[] = [];

    const imageMime = png ? 'image/png' : jpeg ? 'image/jpeg' : null;
    const imageB64 = png ?? jpeg;
    if (imageMime && imageB64) {
      parts.push(
        <div key={`${idx}-img`} className="notebook-viewer-output notebook-viewer-output--image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:${imageMime};base64,${imageB64.replace(/\s/g, '')}`} alt="" />
        </div>
      );
    }
    if (svg) {
      parts.push(
        <div
          key={`${idx}-svg`}
          className="notebook-viewer-output notebook-viewer-output--svg"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      );
    }
    if (html) {
      parts.push(
        <div key={`${idx}-html`} className="notebook-viewer-output notebook-viewer-output--html-wrap">
          <iframe
            title={`Notebook output ${idx}`}
            className="notebook-viewer-output-iframe"
            sandbox=""
            srcDoc={html}
          />
        </div>
      );
    }
    if (plain && (parts.length === 0 || png || jpeg || svg || html)) {
      parts.push(
        <pre key={`${idx}-plain`} className="notebook-viewer-output notebook-viewer-output--text">
          {plain}
        </pre>
      );
    }

    if (parts.length === 0) {
      const keys = data ? Object.keys(data).filter(k => !k.startsWith('application/vnd')) : [];
      if (keys.length === 0) return null;
      return (
        <div key={idx} className="notebook-viewer-output notebook-viewer-output--fallback">
          Output ({output_type}): {keys.join(', ')}
        </div>
      );
    }

    return <div key={idx} className="notebook-viewer-output-group">{parts}</div>;
  }

  if (output_type === 'error') {
    const tb = out.traceback?.length
      ? out.traceback.join('\n')
      : `${out.ename ?? 'Error'}: ${out.evalue ?? ''}`;
    return (
      <pre key={idx} className="notebook-viewer-output notebook-viewer-output--error">
        {tb}
      </pre>
    );
  }

  return (
    <div key={idx} className="notebook-viewer-output notebook-viewer-output--fallback">
      Unsupported output: {output_type}
    </div>
  );
}

function CellOutputs({ outputs }: { outputs: NbOutput[] }) {
  const nodes = outputs.map((o, i) => renderSingleOutput(o, i)).filter(Boolean);
  if (nodes.length === 0) return null;
  return <div className="notebook-viewer-outputs">{nodes}</div>;
}

interface Props {
  notebook: NotebookDoc;
  className?: string;
}

export default function NotebookViewer({ notebook, className = '' }: Props) {
  const cells = notebook?.cells ?? [];

  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark';

  const baseTheme = isDark ? oneDark : oneLight;

  const codeTheme = {
    ...baseTheme,
    'code[class*="language-"]': {
      ...baseTheme['code[class*="language-"]'],
      background: 'transparent',
    },
    'pre[class*="language-"]': {
      ...baseTheme['pre[class*="language-"]'],
      background: 'transparent',
    },
  } as typeof oneDark;

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
          const outputs = cell.outputs ?? [];
          return (
            <div key={idx} className="notebook-viewer-cell notebook-viewer-code-cell">
              <div className="notebook-viewer-code">
                <SyntaxHighlighter
                  language="python"
                  style={codeTheme}
                  customStyle={{ margin: 0, background: 'transparent' }}
                  wrapLongLines
                >
                  {source}
                </SyntaxHighlighter>
              </div>
              <CellOutputs outputs={outputs} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
