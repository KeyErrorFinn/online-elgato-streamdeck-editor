import { useState } from 'react'
import { readProfileManifestFromBlob, decodeFirstPageIdFromBlob, buildLinkedProfileGraphFromBlob, extractImageUrlsFromBlob } from '../utils/profileInformationDecoder';

export default function ProfileTester() {
    const [manifest, setManifest] = useState<object | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const demoFileName = 'Main Profile.streamDeckProfile';
    const [decodedId, setDecodedId] = useState<string | null>(null);
    const [graph, setGraph] = useState<any | null>(null);
    const [imageUrls, setImageUrls] = useState<Record<string,string> | null>(null);

    // revoke previous blob urls when component unmounts or new urls set
    const revokeUrls = (map: Record<string,string> | null) => {
        if (!map) return;
        for (const v of Object.values(map)) URL.revokeObjectURL(v);
    }

    async function loadDemo() {
        setError(null);
        setLoading(true);
            try {
            const res = await fetch('/' + demoFileName);
            if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
            const ab = await res.arrayBuffer();
                const m = await readProfileManifestFromBlob(ab);
                setManifest(m);
                try {
                    const decoded = await decodeFirstPageIdFromBlob(ab);
                    setDecodedId(decoded);
                } catch (e: any) {
                    setDecodedId(null);
                    // ignore decode errors here; they will show in manifest if needed
                }

                try {
                    const g = await buildLinkedProfileGraphFromBlob(ab);
                    setGraph(g);
                } catch (e:any) {
                    setGraph(null);
                }

                try {
                    const imgs = await extractImageUrlsFromBlob(ab);
                    revokeUrls(imageUrls);
                    setImageUrls(imgs);
                } catch (e:any) {
                    revokeUrls(imageUrls);
                    setImageUrls(null);
                }
        } catch (err: any) {
            setError(err.message || String(err));
            setManifest(null);
                setDecodedId(null);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-4">
            <div className="mb-2">
                <button className="px-3 py-1 bg-indigo-600 rounded" onClick={loadDemo} disabled={loading}>
                    {loading ? 'Loading…' : 'Load demo profile from public/'}
                </button>
            </div>
            {error && <div className="text-red-400">Error: {error}</div>}
            {manifest && (
                <pre className="max-h-64 overflow-auto bg-[#111] p-3 rounded text-sm">
                    {JSON.stringify(manifest, null, 2)}
                </pre>
            )}
            {decodedId && (
                <div className="mt-2">Decoded first Page ID: <code className="bg-[#111] px-2 py-1 rounded">{decodedId}</code></div>
            )}
            {graph && (
                <div className="mt-4">
                    <h3 className="font-bold">Linked profile graph</h3>
                    <pre className="max-h-96 overflow-auto bg-[#111] p-3 rounded text-sm">{JSON.stringify(graph, null, 2)}</pre>
                </div>
            )}
            {/* 5x3 grid based on top-most list of actions for the first decoded page */}
            {graph && decodedId && (
                <div className="mt-6">
                    <h3 className="font-bold mb-2">5x3 Action Grid (positions are "x,y")</h3>
                    <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: 3 }).map((_, row) => (
                            <div key={`row-${row}`} className="contents">
                                {Array.from({ length: 5 }).map((__, col) => {
                                    const key = `${col},${row}`;
                                    // find the manifest by the encoded UUID key stored in graph.Pages.Pages
                                    const pagesObj = graph?.Pages?.Pages || {};
                                    // try to find current page UUID from the root Pages.Current if present,
                                    // otherwise use the first key in the Pages mapping
                                    const encodedKey = graph?.Pages?.Current || Object.keys(pagesObj)[0];
                                    const pageManifest = pagesObj[encodedKey];
                                    const controllers = pageManifest?.Controllers;
                                    let action = undefined;
                                    if (Array.isArray(controllers) && controllers.length > 0) {
                                        const actionsObj = controllers[0]?.Actions;
                                        if (actionsObj && typeof actionsObj === 'object') action = actionsObj[key];
                                    }
                                    
                                    
                                    const imgPath = action?.States?.[0]?.Image;
                                    // prefer blob URL if image path points inside the zip
                                    const findBlobUrl = (p: string | undefined) => {
                                        if (!p || !imageUrls) return undefined;
                                        // exact match
                                        if (imageUrls[p]) return imageUrls[p];
                                        // basename match
                                        const parts = p.split('/');
                                        const base = parts[parts.length - 1];
                                        if (base && imageUrls[base]) return imageUrls[base];
                                        // endsWith match
                                        for (const k of Object.keys(imageUrls)) {
                                            if (k.endsWith(p)) return imageUrls[k];
                                        }
                                        // contains match
                                        for (const k of Object.keys(imageUrls)) {
                                            if (k.includes(p)) return imageUrls[k];
                                        }
                                        return undefined;
                                    };

                                    const blobUrl = findBlobUrl(imgPath);
                                    const isImgUrl = !!blobUrl || (typeof imgPath === 'string' && (imgPath.startsWith('http') || imgPath.startsWith('/') || imgPath.startsWith('data:')));

                                    return (
                                        <div key={key} className="w-24 h-16 bg-[#1a1a1a] rounded border border-gray-700 flex flex-col items-center justify-center text-xs">
                                            <div className="w-full h-10 flex items-center justify-center">
                                                {isImgUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={blobUrl ?? imgPath} alt={key} className="max-h-10 max-w-full object-contain" />
                                                ) : (
                                                    <div className="px-1 text-[10px] text-gray-300">{imgPath ?? '—'}</div>
                                                )}
                                            </div>
                                            <div className="w-full text-center text-[10px] text-gray-400 py-1">{key}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {!manifest && !error && <div className="text-sm text-gray-400">No manifest loaded.</div>}
        </div>
    );
}
