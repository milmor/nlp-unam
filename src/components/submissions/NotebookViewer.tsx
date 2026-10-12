'use client';

import { useMemo, useRef } from 'react';
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

const TABLE_THEME = {
  light: { bg: '#ffffff', text: '#1a1a1a', border: '#e0dcd4', header: '#f0ebe3', index: '#faf8f5' },
  dark: { bg: '#1f2544', text: '#e8e8e8', border: '#2d3a5a', header: '#252d4a', index: '#1c2340' },
} as const;

function tableThemeCss(dark: boolean): string {
  const t = dark ? TABLE_THEME.dark : TABLE_THEME.light;
  const force = dark ? ' !important' : '';
  return `
    html, body { margin: 0; padding: 8px 10px; background: ${t.bg}${force}; color: ${t.text}${force};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; }
    table { border-collapse: collapse; font-size: 12px; color: ${t.text}; background: transparent; }
    th, td { border: 1px solid ${t.border}; padding: 4px 8px; vertical-align: top; color: inherit; }
    thead th { background: ${t.header}${force}; font-weight: 600; color: ${t.text}${force}; }
    tbody th { background: ${t.index}${force}; font-weight: 500; color: ${t.text}${force}; }
  `;
}

/** Pandas HTML often ships a scoped <style> browsers ignore, so the table looks unstyled. */
function wrapNotebookHtml(fragment: string, dark: boolean): string {
  const body = fragment.replace(/<style\b[^>]*\bscoped\b[^>]*>/gi, '<style>');
  const css = tableThemeCss(dark);
  const trimmed = body.trim();
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return `${trimmed}<style>${css}</style>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}<style>${css}</style></body></html>`;
}

function HtmlOutput({ html, title, dark }: { html: string; title: string; dark: boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const srcDoc = useMemo(() => wrapNotebookHtml(html, dark), [html, dark]);

  function fit() {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    const height = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    frame.style.height = `${Math.min(Math.max(height, 36), 480)}px`;
  }

  return (
    <iframe
      ref={frameRef}
      title={title}
      className="notebook-viewer-output-iframe"
      sandbox="allow-same-origin"
      srcDoc={srcDoc}
      onLoad={fit}
    />
  );
}

function renderSingleOutput(out: NbOutput, idx: number, dark: boolean): React.ReactNode {
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
          <HtmlOutput html={html} title={`Notebook output ${idx}`} dark={dark} />
        </div>
      );
    }
    if (plain && parts.length === 0) {
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

function CellOutputs({ outputs, dark }: { outputs: NbOutput[]; dark: boolean }) {
  const nodes = outputs.map((o, i) => renderSingleOutput(o, i, dark)).filter(Boolean);
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
              <CellOutputs outputs={outputs} dark={isDark} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
