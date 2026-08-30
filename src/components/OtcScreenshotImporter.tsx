import { useMemo, useState } from 'react';
import { CheckCircle2, Eye, FileImage, LockKeyhole, Plus, ScanText, Send, ShieldCheck, Trash2 } from 'lucide-react';
import type { OtcTradeSide } from '../otc';

type DraftTrade = {
  id: string;
  timestamp: string;
  side: OtcTradeSide;
  zkasAmount: string;
  priceKas: string;
  totalKas: string;
  warning: boolean;
};

function blankTrade(): DraftTrade {
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return { id: crypto.randomUUID(), timestamp: local, side: 'unknown', zkasAmount: '', priceKas: '', totalKas: '', warning: false };
}

function numberText(value: string | undefined) {
  if (!value) return '';
  const match = value.match(/[\d,.]+/);
  return match ? match[0].replace(/,/g, '') : '';
}

function findValue(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return numberText(match[1]);
  }
  return '';
}

function parseTimestamp(text: string) {
  const dateTime = text.match(/(?:completed|filled|time|date)?\s*[:#-]?\s*((?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})[^\n]{0,18}(?:\d{1,2}:\d{2}(?:\s*[ap]m)?))/i)?.[1];
  if (!dateTime) return '';
  const parsed = new Date(dateTime);
  if (!Number.isFinite(parsed.getTime())) return '';
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function relativeTimestamp(text: string, order: number) {
  const match = text.match(/(\d+)\s*(m|min|minute|h|hr|hour|d|day)s?\s*ago/i);
  if (!match) return '';
  const count = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith('d') ? 86_400_000 : unit.startsWith('h') ? 3_600_000 : 60_000;
  const date = new Date(Date.now() - count * multiplier - order * 60_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function parseCandidates(raw: string, detectedSides: OtcTradeSide[] = [], orderOffset = 0): DraftTrade[] {
  // The Discord desk uses: "300000 ZKAS · 12500.001 KAS". Dollar values
  // follow later and must not be mistaken for the KAS-per-ZKAS price.
  const tradePattern = /([\d,.]+(?:e[-+]?\d+)?)\s*ZKAS\s*[·•|.:=—-]*\s*([\d,.]+(?:e[-+]?\d+)?)\s*KAS\b/gi;
  const matches = [...raw.matchAll(tradePattern)];
  if (matches.length) return matches.map((match, index) => {
    const text = raw.slice(match.index, matches[index + 1]?.index ?? raw.length);
    const zkasAmount = numberText(match[1]);
    const totalKas = numberText(match[2]);
    const amount = Number(zkasAmount);
    const total = Number(totalKas);
    return {
      id: crypto.randomUUID(),
      timestamp: relativeTimestamp(text, orderOffset + index) || blankTrade().timestamp,
      side: detectedSides[index] || 'unknown',
      zkasAmount,
      priceKas: amount > 0 && Number.isFinite(total) ? String(total / amount) : '',
      totalKas,
      warning: amount > 0 && amount < 10,
    } satisfies DraftTrade;
  });

  // Fallback for a differently formatted log. These rows remain review-only.
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => /\bZKAS\b/i.test(line));
  return lines.map((text, index) => {
    const lower = text.toLowerCase();
    const zkasAmount = findValue(text, [/([\d,.]+)\s*ZKAS\b/i]);
    const totalKas = findValue(text, [/ZKAS\D{0,10}([\d,.]+)\s*KAS\b/i]);
    const amount = Number(zkasAmount);
    const total = Number(totalKas);
    return {
      id: crypto.randomUUID(),
      timestamp: parseTimestamp(text) || relativeTimestamp(text, orderOffset + index) || blankTrade().timestamp,
      side: /\b(?:sell|sold|seller)\b/.test(lower) ? 'sell' : /\b(?:buy|bought|buyer)\b/.test(lower) ? 'buy' : 'unknown',
      zkasAmount,
      priceKas: amount > 0 && Number.isFinite(total) ? String(total / amount) : '',
      totalKas,
      warning: amount > 0 && amount < 10,
    } satisfies DraftTrade;
  });
}

async function detectTradeSides(file: File): Promise<OtcTradeSide[]> {
  const bitmap = await createImageBitmap(file);
  const width = Math.min(480, bitmap.width);
  const height = Math.round(bitmap.height * (width / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height).data;
  const scores = Array.from({ length: height }, () => ({ red: 0, green: 0 }));
  for (let y = Math.floor(height * 0.15); y < Math.floor(height * 0.84); y += 1) {
    for (let x = Math.floor(width * 0.15); x < Math.floor(width * 0.36); x += 1) {
      const offset = (y * width + x) * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      if (red > 145 && red > green * 1.45 && red > blue * 1.3) scores[y].red += 1;
      if (green > 105 && green > red * 1.35 && green > blue * 1.2) scores[y].green += 1;
    }
  }
  const groups: Array<{ start: number; end: number; red: number; green: number }> = [];
  let current: { start: number; end: number; red: number; green: number } | null = null;
  for (let y = 0; y < height; y += 1) {
    if (scores[y].red + scores[y].green >= 4) {
      if (!current || y - current.end > 3) {
        if (current) groups.push(current);
        current = { start: y, end: y, red: 0, green: 0 };
      }
      current.end = y;
      current.red += scores[y].red;
      current.green += scores[y].green;
    }
  }
  if (current) groups.push(current);
  return groups.filter((group) => group.end - group.start >= 5 && group.red + group.green >= 45)
    .map((group) => group.green > group.red ? 'buy' : 'sell');
}

export function OtcScreenshotImporter() {
  const [secret, setSecret] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<DraftTrade[]>([]);
  const [ocrText, setOcrText] = useState('');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const validRows = useMemo(() => rows.filter((row) => {
    const timestamp = new Date(row.timestamp).getTime();
    const amount = Number(row.zkasAmount);
    const price = Number(row.priceKas);
    const total = Number(row.totalKas);
    return Number.isFinite(timestamp) && amount > 0 && price > 0 && total > 0;
  }), [rows]);

  function update(id: string, field: keyof DraftTrade, value: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, [field]: value };
      if ((field === 'zkasAmount' || field === 'priceKas') && Number(next.zkasAmount) > 0 && Number(next.priceKas) > 0) {
        next.totalKas = String(Number(next.zkasAmount) * Number(next.priceKas));
      }
      next.warning = Number(next.zkasAmount) > 0 && Number(next.zkasAmount) < 10;
      return next;
    }));
  }

  async function scan() {
    if (!files.length) return;
    setBusy(true);
    setMessage(null);
    setOcrText('');
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (event) => {
          const percent = typeof event.progress === 'number' ? ` ${Math.round(event.progress * 100)}%` : '';
          setProgress(`${event.status || 'Reading screenshot'}${percent}`);
        },
      });
      let combined = '';
      const candidates: DraftTrade[] = [];
      try {
        for (let index = 0; index < files.length; index += 1) {
          setProgress(`Reading screenshot ${index + 1} of ${files.length}`);
          const result = await worker.recognize(files[index]);
          const text = result.data.text;
          const sides = await detectTradeSides(files[index]);
          candidates.push(...parseCandidates(text, sides, candidates.length));
          combined += `${text}\n`;
        }
      } finally {
        await worker.terminate();
      }
      setOcrText(combined.trim());
      setRows(candidates.length ? candidates : [blankTrade()]);
      const warnings = candidates.filter((candidate) => candidate.warning).length;
      setMessage(candidates.length
        ? { tone: 'success', text: `Found ${candidates.length} possible trade${candidates.length === 1 ? '' : 's'}. Review every field before publishing.${warnings ? ` ${warnings} tiny trade${warnings === 1 ? ' is' : 's are'} highlighted as possible tests.` : ''}` }
        : { tone: 'error', text: 'No complete row was detected automatically. The OCR text is available below; enter the trade facts manually.' });
    } catch (reason) {
      setMessage({ tone: 'error', text: reason instanceof Error ? reason.message : 'The screenshots could not be read.' });
    } finally {
      setProgress('');
      setBusy(false);
    }
  }

  async function publish() {
    if (!secret || !validRows.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/otc-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ trades: validRows.map((row) => ({
          timestamp: new Date(row.timestamp).getTime(),
          side: row.side,
          zkasAmount: Number(row.zkasAmount),
          priceKas: Number(row.priceKas),
          totalKas: Number(row.totalKas),
        })) }),
      });
      const result = await response.json() as { added?: number; duplicates?: number; total?: number; error?: string };
      if (!response.ok) throw new Error(result.error === 'storage_not_configured' ? 'Cloudflare storage still needs to be connected.' : result.error || 'Import failed.');
      setMessage({ tone: 'success', text: `Published ${result.added ?? 0} new trade${result.added === 1 ? '' : 's'}${result.duplicates ? `; ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} skipped` : ''}. ${result.total ?? 0} total trades are now stored.` });
      setRows([]);
      setFiles([]);
      setOcrText('');
    } catch (reason) {
      setMessage({ tone: 'error', text: reason instanceof Error ? reason.message : 'Import failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack importer-page">
      <div className="privacy-callout"><ShieldCheck size={20} /><div><b>Private, trade-facts-only importer</b><span>OCR runs in this browser. Screenshots, Discord names, message text and order IDs are never uploaded or stored. Publishing sends only the five reviewed trade facts.</span></div></div>

      <section className="panel importer-step">
        <div className="importer-step-head"><span>1</span><div><h2>Unlock publishing</h2><p>The password stays in this tab and is sent only when you publish reviewed rows.</p></div></div>
        <label className="importer-secret"><LockKeyhole size={17} /><input type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="OTC importer password" /></label>
      </section>

      <section className="panel importer-step">
        <div className="importer-step-head"><span>2</span><div><h2>Choose trade-log screenshots</h2><p>PNG, JPEG or WebP. Select several screenshots to process them together.</p></div></div>
        <label className="importer-drop"><FileImage size={28} /><b>{files.length ? `${files.length} screenshot${files.length === 1 ? '' : 's'} selected` : 'Choose screenshots'}</b><span>Images stay on this device</span><input type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 10))} /></label>
        <button className="importer-primary" disabled={!files.length || busy} onClick={() => void scan()}><ScanText size={17} />{busy && progress ? progress : 'Read screenshots'}</button>
      </section>

      <section className="panel importer-step">
        <div className="importer-step-head"><span>3</span><div><h2>Review every detected trade</h2><p>OCR can make mistakes. A row will publish only when all numeric fields and the date are valid.</p></div></div>
        <div className="importer-table-wrap"><table className="importer-table"><thead><tr><th>Date & time</th><th>Side</th><th>ZKAS amount</th><th>Price (KAS)</th><th>Total (KAS)</th><th /></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id} className={row.warning ? 'review-warning' : ''}>
            <td><input type="datetime-local" value={row.timestamp} onChange={(event) => update(row.id, 'timestamp', event.target.value)} /></td>
            <td><select value={row.side} onChange={(event) => update(row.id, 'side', event.target.value)}><option value="unknown">Trade</option><option value="buy">Buy</option><option value="sell">Sell</option></select></td>
            <td><input inputMode="decimal" value={row.zkasAmount} onChange={(event) => update(row.id, 'zkasAmount', event.target.value)} placeholder="0" /></td>
            <td><input inputMode="decimal" value={row.priceKas} onChange={(event) => update(row.id, 'priceKas', event.target.value)} placeholder="0" /></td>
            <td><input inputMode="decimal" value={row.totalKas} onChange={(event) => update(row.id, 'totalKas', event.target.value)} placeholder="0" />{row.warning && <small className="trade-warning">Possible test trade</small>}</td>
            <td><button className="icon-btn" aria-label="Remove row" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 size={16} /></button></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={6} className="empty-cell">Read screenshots or add a blank row to begin.</td></tr>}
        </tbody></table></div>
        <div className="importer-actions"><button className="text-btn" onClick={() => setRows((current) => [...current, blankTrade()])}><Plus size={16} /> Add row</button><span>{validRows.length} of {rows.length} rows ready</span><button className="importer-primary" disabled={!secret || !validRows.length || busy} onClick={() => void publish()}><Send size={16} /> Publish reviewed trades</button></div>
      </section>

      {message && <div className={`importer-message ${message.tone}`}>{message.tone === 'success' ? <CheckCircle2 size={18} /> : <Eye size={18} />}<span>{message.text}</span></div>}
      {ocrText && <details className="panel importer-ocr"><summary>View OCR text (not uploaded)</summary><pre>{ocrText}</pre></details>}
    </div>
  );
}
