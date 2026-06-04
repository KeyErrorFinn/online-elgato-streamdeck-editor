import { unzipSync } from 'fflate';

export const profileIDtoFolderDecoder = (profileId: string) => {
	return (
		(
			(profileId.replace(/-/g, "") + "000") // remove hyphens and pad length to be divisible by 5 bits
				.match(/.{5}/g) || []
		) // split into groups of 5 digits, since JS can't represent integers larger than 53 bits
			.map((s) => parseInt(s, 16).toString(32).padStart(4, "0")) // convert to base32
			.join("")
			.substring(0, 26) // remove padding we added earlier
			.toUpperCase()
			.replace(/V/g, "W")
			.replace(/U/g, "V") + "Z"
	); // all folder ids end in this suffix
};

console.log(profileIDtoFolderDecoder("a286a655-37ff-40bf-9301-6f1cf99c7e73"));

/**
 * Read manifest.json from a .sdProfile provided as a Blob/File/ArrayBuffer in the browser.
 * Returns parsed JSON or throws on failure.
 */
export async function readProfileManifestFromBlob(input: Blob | ArrayBuffer) {
    let buffer: ArrayBuffer;
    if (input instanceof Blob) {
        buffer = await input.arrayBuffer();
    } else {
        buffer = input;
    }

    const uint8 = new Uint8Array(buffer);
    const entries = unzipSync(uint8);

    // entries keys are file paths inside the zip
    const topLevelFolders = Object.keys(entries).filter((p) => {
        const parts = p.split('/');
        return parts.length === 2 && p.endsWith('/'); // e.g. "folder/"
    });

    let manifestPath: string | undefined;
    if (topLevelFolders.length > 0) {
        const firstFolder = topLevelFolders[0];
        manifestPath = `${firstFolder}manifest.json`;
    } else if (entries['manifest.json']) {
        manifestPath = 'manifest.json';
    }

    if (!manifestPath) throw new Error('manifest.json not found in provided profile');

    const entry = entries[manifestPath];
    if (!entry) throw new Error(`manifest.json not found at ${manifestPath}`);

    const text = new TextDecoder().decode(entry);
    return JSON.parse(text);
}

/**
 * Extract the first UUID from manifest.Pages.Pages, decode it with profileIDtoFolderDecoder,
 * and return the decoded folder id. Throws on missing data.
 */
export async function decodeFirstPageIdFromBlob(input: Blob | ArrayBuffer) {
    const manifest: any = await readProfileManifestFromBlob(input);

    // Defensive navigation based on expected structure: manifest.Pages.Pages
    const pagesSection = manifest?.Pages;
    const pagesArray = pagesSection?.Pages;

    if (!Array.isArray(pagesArray) || pagesArray.length === 0) {
        throw new Error('No Pages.Pages array found in manifest');
    }

    const firstUuid = pagesArray[0];
    if (typeof firstUuid !== 'string') {
        throw new Error('First page id is not a string UUID');
    }

    const decoded = profileIDtoFolderDecoder(firstUuid);
    return decoded;
}

/**
 * Build a linked graph of profile manifests starting from the first page ID in the root manifest.
 * Returns a structure with the root manifest, the starting UUID/decoded folder, and a map of
 * visited profile folders with their manifest content and outgoing profile links.
 */
/**
 * Build the nested Pages->UUID->{decoded manifest} structure, and for each decoded manifest
 * replace Settings.ProfileUUID (when it points to a valid decoded folder) with a mapping
 * { <uuid>: <resolved decoded manifest> } recursively.
 */
export async function buildLinkedProfileGraphFromBlob(input: Blob | ArrayBuffer) {
    // unzip and collect entries
    let buffer: ArrayBuffer;
    if (input instanceof Blob) buffer = await input.arrayBuffer(); else buffer = input;
    const uint8 = new Uint8Array(buffer);
    const entries = unzipSync(uint8);

    // find a top-level folder (some .sdProfile wrap contents in a folder)
    const topLevelFolders = Object.keys(entries).filter(p => p.endsWith('/') && p.split('/').length === 2);
    const baseFolder = topLevelFolders.length > 0 ? topLevelFolders[0] : '';

    const readManifestAt = (path: string) => {
        const e = entries[path];
        if (!e) return null;
        const text = new TextDecoder().decode(e);
        try { return JSON.parse(text); } catch { return null; }
    };

    const rootManifest = readManifestAt(baseFolder ? `${baseFolder}manifest.json` : 'manifest.json');
    if (!rootManifest) throw new Error('Root manifest not found');

    const findProfileManifestPath = (folderName: string) => {
        const candidates = [
            `${baseFolder}Profiles/${folderName}/manifest.json`,
            `${baseFolder}${folderName}/manifest.json`,
            `Profiles/${folderName}/manifest.json`,
            `${folderName}/manifest.json`
        ];
        for (const c of candidates) if (entries[c]) return c;
        return null;
    };

    const visited = new Map<string, any>();

    const resolveFolder = (folderName: string): any => {
        if (visited.has(folderName)) return visited.get(folderName);
        const manifestPath = findProfileManifestPath(folderName);
        if (!manifestPath) {
            visited.set(folderName, null);
            return null;
        }
        const manifest = readManifestAt(manifestPath);
        if (!manifest) {
            visited.set(folderName, null);
            return null;
        }
        const cloned = JSON.parse(JSON.stringify(manifest));
        visited.set(folderName, cloned);

        const controllers = cloned?.Controllers;
        if (Array.isArray(controllers)) {
            for (const ctrl of controllers) {
                const actions = ctrl?.Actions;
                if (actions && typeof actions === 'object') {
                    for (const key of Object.keys(actions)) {
                        const action = actions[key];
                        const profileUuid = action?.Settings?.ProfileUUID;
                        if (profileUuid && typeof profileUuid === 'string') {
                            const decoded = profileIDtoFolderDecoder(profileUuid);
                            const resolved = resolveFolder(decoded);
                            if (resolved !== null) {
                                action.Settings.ProfileUUID = { [profileUuid]: resolved };
                            }
                        }
                    }
                }
            }
        }

        return cloned;
    };

    const pagesArray = rootManifest?.Pages?.Pages || [];
    const pagesMap: Record<string, any> = {};
    for (const uuid of pagesArray) {
        if (typeof uuid !== 'string') continue;
        const decoded = profileIDtoFolderDecoder(uuid);
        const resolved = resolveFolder(decoded);
        pagesMap[uuid] = resolved;
    }

    if (!rootManifest.Pages) rootManifest.Pages = {};
    rootManifest.Pages.Pages = pagesMap;

    return rootManifest;
}

/**
 * Extract image entries from the sdProfile blob/arraybuffer and return a map of
 * zip-path -> object URL (created with URL.createObjectURL). Caller is responsible
 * for revoking the URLs when no longer needed.
 */
export async function extractImageUrlsFromBlob(input: Blob | ArrayBuffer) {
    let buffer: ArrayBuffer;
    if (input instanceof Blob) buffer = await input.arrayBuffer(); else buffer = input;
    const uint8 = new Uint8Array(buffer);
    const entries = unzipSync(uint8);

    const urls: Record<string, string> = {};
    for (const path of Object.keys(entries)) {
        const lower = path.toLowerCase();
        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
            const bytes = entries[path];
            try {
                const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as any);
                const blob = new Blob([u8], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                urls[path] = url;
                // also index by basename to help matching manifest image paths that omit folder prefix
                const parts = path.split('/');
                const base = parts[parts.length - 1];
                if (base && !urls[base]) urls[base] = url;
            } catch (e) {
                // skip on error
            }
        }
    }

    return urls;
}

/**
 * Create a normalized representation: root manifest, pagesIndex (uuid -> folderName),
 * and manifestsByFolder (folderName -> manifest object). Useful as a canonical flat store.
 */
export async function normalizeProfileFromBlob(input: Blob | ArrayBuffer) {
    let buffer: ArrayBuffer;
    if (input instanceof Blob) buffer = await input.arrayBuffer(); else buffer = input;
    const uint8 = new Uint8Array(buffer);
    const entries = unzipSync(uint8);

    // find base folder if present
    const topLevelFolders = Object.keys(entries).filter(p => p.endsWith('/') && p.split('/').length === 2);
    const baseFolder = topLevelFolders.length > 0 ? topLevelFolders[0] : '';

    const readManifestAt = (path: string) => {
        const e = entries[path];
        if (!e) return null;
        const text = new TextDecoder().decode(e);
        try { return JSON.parse(text); } catch { return null; }
    };

    const rootManifest = readManifestAt(baseFolder ? `${baseFolder}manifest.json` : 'manifest.json');
    if (!rootManifest) throw new Error('Root manifest not found');

    // collect all manifest.json entries and map to folder name
    const folders: Record<string, any> = {};
    for (const p of Object.keys(entries)) {
        if (!p.toLowerCase().endsWith('/manifest.json') && !p.toLowerCase().endsWith('manifest.json')) continue;
        // try to extract folder name from path
        // patterns: "<base>/<folder>/manifest.json" or "Profiles/<folder>/manifest.json" or "<folder>/manifest.json"
        const parts = p.split('/').filter(Boolean);
        let folderName = '';
        if (parts.length >= 2 && parts[parts.length - 1].toLowerCase() === 'manifest.json') {
            folderName = parts[parts.length - 2];
        }
        if (folderName) {
            // exclude the specific demo file name from folders as requested
            if (folderName === '11C1D084-BDF0-4498-8E0B-E95071470DEB.sdProfile') continue;
            const m = readManifestAt(p);
            if (m) {
                // ensure action Settings.ProfileUUID entries also carry a ProfileID
                try {
                    const cloned = JSON.parse(JSON.stringify(m));
                    const controllers = cloned?.Controllers;
                    if (Array.isArray(controllers)) {
                        for (const ctrl of controllers) {
                            const actions = ctrl?.Actions;
                            if (actions && typeof actions === 'object') {
                                for (const key of Object.keys(actions)) {
                                    const action = actions[key];
                                    const profileUuid = action?.Settings?.ProfileUUID;
                                    if (profileUuid && typeof profileUuid === 'string') {
                                        try {
                                            action.Settings.ProfileID = profileIDtoFolderDecoder(profileUuid);
                                        } catch (e) {
                                            // ignore decode errors
                                        }
                                    }
                                }
                            }
                        }
                    }
                    folders[folderName] = cloned;
                } catch {
                    folders[folderName] = m;
                }
            }
        }
    }
    // add ProfileID into root manifest if it has a Settings.ProfileUUID
    try {
        if (rootManifest?.Settings && typeof rootManifest.Settings.ProfileUUID === 'string') {
            rootManifest.Settings.ProfileID = profileIDtoFolderDecoder(rootManifest.Settings.ProfileUUID);
        }
    } catch {
        // ignore
    }

    // transform Pages.Pages entries into objects { UUID, ID }
    try {
        const pagesArr = rootManifest?.Pages?.Pages;
        if (Array.isArray(pagesArr)) {
            const mapped = pagesArr.map((uuid: any) => {
                const out: any = { UUID: uuid };
                if (typeof uuid === 'string') {
                    try {
                        out.ID = profileIDtoFolderDecoder(uuid);
                    } catch {
                        // ignore decode failures
                    }
                }
                return out;
            });
            if (!rootManifest.Pages) rootManifest.Pages = {};
            rootManifest.Pages.Pages = mapped;
        }
    } catch {
        // ignore
    }

    return {
        rootManifest,
        folders,
    };
}