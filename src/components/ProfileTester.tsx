import { useState } from 'react';
import { extractImageUrlsFromBlob } from '../utils/profileInformationDecoder';
import unknownAction from '../assets/unknownAction.png';
import folderIcon from '../assets/folderIcon.png'

export default function ProfileTester() {
    // manifest removed per UI simplification - we only show normalized output
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const demoFileName = 'Main Profile.streamDeckProfile';
    const [imageUrls, setImageUrls] = useState<Record<string,string> | null>(null);
    const [normalized, setNormalized] = useState<any | null>(null);

    // revoke previous blob urls when component unmounts or new urls set
    const revokeUrls = (map: Record<string,string> | null) => {
        if (!map) return;
        for (const v of Object.values(map)) URL.revokeObjectURL(v);
    };

    // loadDemo removed — Load button now normalizes directly

    function findBlobUrl(p: string | undefined) {
        if (!p || !imageUrls) return undefined;
        if (imageUrls[p]) return imageUrls[p];
        const parts = p.split('/');
        const base = parts[parts.length - 1];
        if (base && imageUrls[base]) return imageUrls[base];
        for (const k of Object.keys(imageUrls)) {
            if (k.endsWith(p)) return imageUrls[k];
        }
        for (const k of Object.keys(imageUrls)) {
            if (k.includes(p)) return imageUrls[k];
        }
        return undefined;
    }

    function ActionGrid({ normalized }: { normalized: any }) {
        const pagesArr = normalized?.rootManifest?.Pages?.Pages || [];
        const firstPage = pagesArr[0];
        const pageFolderId = firstPage?.ID;
        const pageManifest = pageFolderId ? normalized?.folders?.[pageFolderId] : null;
        const controllers = pageManifest?.Controllers;
        const actionsObj = (Array.isArray(controllers) && controllers.length > 0) ? controllers[0]?.Actions : undefined;

        // produce 15 boxes, keys are 'col,row' where col 0..4 and row 0..2
        const boxes = Array.from({ length: 15 }).map((_, idx) => {
            const col = idx % 5;
            const row = Math.floor(idx / 5);
            const key = `${col},${row}`;
                const action = actionsObj ? actionsObj[key] : undefined;
                const title = action?.States?.[0]?.Title;
            const states = action?.States?.[0];
            const imgPath = states?.Image;
            const blobUrl = findBlobUrl(imgPath);
            const isImgUrl = !!blobUrl || (typeof imgPath === 'string' && (imgPath.startsWith('http') || imgPath.startsWith('/') || imgPath.startsWith('data:')));
            return (
                <div key={key} className="relative size-26 rounded-2xl overflow-hidden bg-[#1a1a1a] border border-gray-700 flex flex-col items-center justify-center text-xs">
                    {isImgUrl ? (
                        <img src={blobUrl ?? imgPath} data-path={imgPath} alt={key} className="max-w-full object-contain" />
                    )
                    : 
                    action && (
                        action?.Name == "Create Folder" ?
                        <img src={folderIcon} className="w-full max-w-full object-contain" />
                        :
                        <img src={unknownAction} className="opacity-30" />
                    )}
                    {states?.Title && (
                        <div className='absolute size-full flex items-center justify-center'>
                            <div className='text-[15px] whitespace-pre-wrap text-center' data-text={title}>{title ?? key}</div>
                        </div>
                    )}
                    {/* <div className="w-full text-center text-[10px] text-gray-400 py-1">{key}</div> */}
                </div>
            );
        });

        return (
            <div className="mt-6">
                <h3 className="font-bold mb-2">5x3 Action Grid</h3>
                <div className="grid grid-cols-5 gap-2 w-fit">
                    {boxes}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="mb-2">
                <button className="px-3 py-1 bg-indigo-600 rounded" onClick={async () => {
                    setError(null);
                    setLoading(true);
                    try {
                        const res = await fetch('/' + demoFileName);
                        if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
                        const ab = await res.arrayBuffer();
                        // normalize directly from the fetched ArrayBuffer
                        const n = await (await import('../utils/profileInformationDecoder')).normalizeProfileFromBlob(ab);
                        setNormalized(n);
                        // also extract images (optional helper for UI extensions)
                        try {
                            const imgs = await extractImageUrlsFromBlob(ab);
                            revokeUrls(imageUrls);
                            setImageUrls(imgs);
                        } catch (e:any) {
                            revokeUrls(imageUrls);
                            setImageUrls(null);
                        }
                    } catch (e:any) {
                        setError(String(e));
                    } finally {
                        setLoading(false);
                    }
                }} disabled={loading}>
                    {loading ? 'Loading…' : 'Load & Normalize demo profile'}
                </button>
            </div>
            {error && <div className="text-red-400">Error: {error}</div>}
            {normalized && (
                <div className="mt-4">
                    <h3 className="font-bold">Normalized profile</h3>
                    <div className="mb-2">
                        <button className="px-2 py-1 bg-blue-600 rounded" onClick={() => {
                            const data = JSON.stringify(normalized, null, 2);
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'normalized-profile.json';
                            a.click();
                            URL.revokeObjectURL(url);
                        }}>Download JSON</button>
                    </div>
                    <pre className="max-h-96 overflow-auto bg-[#111] p-3 rounded text-sm">{JSON.stringify(normalized, null, 2)}</pre>
                </div>
            )}
            {/* 5x3 grid based on first page actions' images */}
            {normalized && <ActionGrid normalized={normalized} />}
            
            {/* Only normalized profile is shown per user request */}
        </div>
    );
}
