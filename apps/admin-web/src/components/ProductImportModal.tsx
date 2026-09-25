import React, { useRef, useState } from 'react';
import { Modal, Button, Badge, Icon, useToast } from '@wag/ui-web';
import { wagApi } from '../lib/api';

type Mode = 'upsert' | 'create_only' | 'update_only';

interface PreviewRow {
  line: number;
  action: 'create' | 'update' | 'unchanged' | 'error' | 'skipped';
  sku: string | null;
  name: string;
  changes?: { field: string; from: unknown; to: unknown }[];
  errors: string[];
  warnings: string[];
  price?: number;
}
interface Preview {
  importId: string;
  summary: { total: number; create: number; update: number; unchanged: number; errors: number; warnings: number; unknownColumns: string[] };
  rows: PreviewRow[];
  truncated: boolean;
}

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'upsert', label: 'Add new and update existing', hint: 'Rows with a known SKU update that product; the rest are added' },
  { value: 'create_only', label: 'Only add new products', hint: 'Rows that match an existing product are flagged as errors' },
  { value: 'update_only', label: 'Only update existing products', hint: 'Every row needs a SKU that already exists' },
];

const ACTION_BADGE: Record<PreviewRow['action'], { v: any; l: string }> = {
  create: { v: 'ok', l: 'New' },
  update: { v: 'info', l: 'Update' },
  unchanged: { v: 'muted', l: 'No change' },
  error: { v: 'danger', l: 'Error' },
  skipped: { v: 'muted', l: 'Skipped' },
};

const FIELD_LABEL: Record<string, string> = {
  name: 'Name', sku: 'SKU', categoryId: 'Category', description: 'Description', mrp: 'MRP', retailPrice: 'Retail', tradePrice: 'Trade',
  tags: 'Tags', allergyWarnings: 'Allergy warnings', imageUrls: 'Images', isActive: 'Active',
};

const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') || '—' : v === null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));
const msg = (e: any) => e?.response?.data?.message ?? e?.message ?? 'Something went wrong';

async function download(path: string, fallbackName: string) {
  const res = await wagApi.client.get<Blob>(path, { responseType: 'blob' } as any);
  const url = URL.createObjectURL(res as unknown as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProductImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('upsert');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'check' | 'import' | 'dl' | ''>('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(''); setSkipInvalid(false); if (fileRef.current) fileRef.current.value = ''; };
  const close = () => { reset(); onClose(); };

  const dl = async (path: string, name: string) => {
    setBusy('dl');
    try { await download(path, name); } catch (e) { toast({ type: 'error', title: 'Download failed', message: msg(e) }); } finally { setBusy(''); }
  };

  const check = async () => {
    if (!file) return;
    setBusy('check'); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      setPreview(await wagApi.client.post<Preview>(`/admin/catalog/imports?mode=${mode}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
    } catch (e) { setError(msg(e)); } finally { setBusy(''); }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy('import'); setError('');
    try {
      const r = await wagApi.client.post<{ created: number; updated: number }>(`/admin/catalog/imports/${preview.importId}/commit`, { skipInvalid });
      setResult(r);
      onDone();
    } catch (e) { setError(msg(e)); } finally { setBusy(''); }
  };

  const s = preview?.summary;
  const importable = s ? s.create + s.update : 0;
  const canApply = !!s && importable > 0 && (s.errors === 0 || skipInvalid);

  return (
    <Modal open={open} onClose={close} title="Import or update products" size="xl"
      footer={
        result ? <Button onClick={close}>Done</Button> : preview ? (
          <>
            <Button variant="ghost" onClick={reset}>Choose another file</Button>
            <Button onClick={apply} loading={busy === 'import'} disabled={!canApply}>
              {importable > 0 ? `Import ${importable} product${importable === 1 ? '' : 's'}` : 'Nothing to import'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={check} loading={busy === 'check'} disabled={!file}>Check file</Button>
          </>
        )
      }
    >
      {result ? (
        <div className="text-center py-8">
          <div className="text-[40px]">✅</div>
          <h3 className="text-lg font-bold mt-2">Import complete</h3>
          <p className="text-[#6E5B4B] mt-1">{result.created} added · {result.updated} updated</p>
        </div>
      ) : !preview ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl bg-[#F9F1E9] p-4 text-[13px] text-[#4A3A2A]">
            <b>How it works:</b> download the template, fill in one row per product, upload it here, and check the preview. Nothing is saved until you confirm.
            To change many products at once, export the catalogue, edit it, and upload it back.
            <div className="flex flex-wrap gap-2 mt-3">
              <Button compact variant="outline" loading={busy === 'dl'} onClick={() => dl('/admin/catalog/template', 'product-import-template.xlsx')} leftIcon={<Icon name="doc" size={14} />}>Template (.xlsx)</Button>
              <Button compact variant="outline" onClick={() => dl('/admin/catalog/template?format=csv', 'product-import-template.csv')}>Template (.csv)</Button>
              <Button compact variant="outline" onClick={() => dl('/admin/catalog/export', 'products.xlsx')}>Export all products</Button>
            </div>
          </div>

          <div>
            <div className="text-[13px] font-semibold mb-2">What should this upload do?</div>
            <div className="flex flex-col gap-2">
              {MODES.map((m) => (
                <label key={m.value} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${mode === m.value ? 'border-[#4A1E0B] bg-[#FBF6F0]' : 'border-[#E2D5C6]'}`}>
                  <input type="radio" name="mode" checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-1" />
                  <span><span className="font-semibold text-[13px]">{m.label}</span><br /><span className="text-[12px] text-[#6E5B4B]">{m.hint}</span></span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-semibold mb-2">File (.xlsx or .csv, up to 5 MB and 5,000 products)</div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); }}
              className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-[#4A1E0B] file:px-4 file:py-2 file:text-white" />
          </div>
          {error && <div className="rounded-xl bg-[#FCE9E7] text-[#B3261E] p-3 text-[13px]">{error}</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="ok">{s!.create} new</Badge>
            <Badge variant="info">{s!.update} updates</Badge>
            <Badge variant="muted">{s!.unchanged} unchanged</Badge>
            <Badge variant={s!.errors ? 'danger' : 'muted'}>{s!.errors} with errors</Badge>
            {s!.warnings > 0 && <Badge variant="warn">{s!.warnings} warnings</Badge>}
          </div>
          {s!.unknownColumns.length > 0 && (
            <div className="rounded-xl bg-[#FFF4DC] p-3 text-[13px]">Ignored columns: {s!.unknownColumns.join(', ')}</div>
          )}
          {s!.errors > 0 && (
            <label className="flex items-start gap-2 rounded-xl bg-[#FCE9E7] p-3 text-[13px] cursor-pointer">
              <input type="checkbox" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} className="mt-0.5" />
              <span>{s!.errors} row{s!.errors === 1 ? ' has' : 's have'} errors and won't be imported. Tick to import the {importable} valid row{importable === 1 ? '' : 's'} anyway, or fix the file and upload again.</span>
            </label>
          )}
          <div className="overflow-auto max-h-[360px] rounded-xl border border-[#E2D5C6]">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F9F1E9] text-left text-[11px] uppercase tracking-wide text-[#6E5B4B] sticky top-0">
                <tr><th className="p-2">Row</th><th className="p-2">Result</th><th className="p-2">Product</th><th className="p-2">Details</th></tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-t border-[#F0E8DC] align-top">
                    <td className="p-2 text-[#9A8878]">{r.line}</td>
                    <td className="p-2"><Badge variant={ACTION_BADGE[r.action].v}>{ACTION_BADGE[r.action].l}</Badge></td>
                    <td className="p-2"><div className="font-semibold">{r.name || '—'}</div>{r.sku && <div className="text-[11px] text-[#9A8878]">{r.sku}</div>}</td>
                    <td className="p-2">
                      {r.errors.map((e, i) => <div key={i} className="text-[#B3261E]">{e}</div>)}
                      {r.changes?.map((c, i) => <div key={i}>{FIELD_LABEL[c.field] ?? c.field}: <span className="line-through text-[#9A8878]">{show(c.from)}</span> → <b>{show(c.to)}</b></div>)}
                      {r.action === 'create' && r.price != null && <div>₹{r.price}</div>}
                      {r.warnings.map((w, i) => <div key={i} className="text-[#B4520F]">⚠ {w}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.truncated && <p className="text-[12px] text-[#6E5B4B]">Showing the first {preview.rows.length} rows (errors first). All rows are imported.</p>}
          {error && <div className="rounded-xl bg-[#FCE9E7] text-[#B3261E] p-3 text-[13px]">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
