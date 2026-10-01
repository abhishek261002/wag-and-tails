import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle } from './Card.js';
import { Badge } from './Badge.js';
import { Banner } from './Chrome.js';
import { Modal } from './Modal.js';

interface ToolItem { id: string; url: string; kind: 'image' | 'video'; mimeType: string; sizeBytes: number; createdAt: string }
export interface ToolsData {
  items: ToolItem[];
  counts: { photos: number; videos: number };
  rules: { minPhotos: number; maxPhotos: number; maxVideos: number };
  required: boolean;
  complete: boolean;
}

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * The photos and videos a groomer uploaded of their tools, for staff and admins to review before approving.
 * Images open in a viewer; videos play in place. `onLoaded` lets the page react to whether the partner has
 * shown enough (e.g. to explain why Approve is unavailable).
 */
export function ToolMediaGallery({
  api, path, resolveUrl, onLoaded,
}: {
  api: { get<T>(url: string): Promise<T> };
  /** e.g. /staff/partners/<id>/tools */
  path: string;
  resolveUrl: (url: string) => string | undefined;
  onLoaded?: (d: ToolsData) => void;
}) {
  const [data, setData] = useState<ToolsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewing, setViewing] = useState<ToolItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setFailed(false);
    api.get<ToolsData>(path)
      .then((d) => { if (!cancelled) { setData(d); onLoaded?.(d); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, path]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tools</CardTitle>
        {data && (
          <Badge variant={data.complete ? 'ok' : 'warn'}>
            {data.required ? `${data.counts.photos} / ${data.rules.minPhotos} photos needed` : 'Optional for walkers'}
          </Badge>
        )}
      </CardHeader>

      {failed && <p className="text-sm text-[#9A8878]">Could not load the tools.</p>}
      {!data && !failed && <p className="text-sm text-[#9A8878]">Loading…</p>}

      {data && data.required && !data.complete && (
        <div className="mb-3">
          <Banner
            tone="warn"
            title="Not enough tool photos yet"
            body={`This groomer needs at least ${data.rules.minPhotos} photos of their tools before they can be approved (they have ${data.counts.photos}).`}
          />
        </div>
      )}

      {data && data.items.length === 0 && <p className="text-sm text-[#9A8878]">Nothing uploaded yet.</p>}

      {data && data.items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {data.items.map((m) => (
            <div key={m.id} className="rounded-xl overflow-hidden border border-[#EDE4D9] bg-[#FBF7F2]">
              {m.kind === 'image' ? (
                <button type="button" className="block w-full aspect-square" onClick={() => setViewing(m)} aria-label="View photo">
                  <img src={resolveUrl(m.url)} alt="Tool" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ) : (
                <div>
                  <video src={resolveUrl(m.url)} controls preload="metadata" className="w-full aspect-square object-cover bg-black" />
                  <div className="px-2 py-1 text-[11px] text-[#9A8878]">Video · {size(m.sizeBytes)}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Tool photo" size="lg">
        {viewing && <img src={resolveUrl(viewing.url)} alt="Tool" className="w-full max-h-[70vh] object-contain rounded-lg" />}
      </Modal>
    </Card>
  );
}
