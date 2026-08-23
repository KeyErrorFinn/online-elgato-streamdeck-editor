import { unzipSync } from "fflate";
import {
    type ImportedPlugin,
    type PluginSourceFile,
} from "./pluginDirectoryDecoder";

const databaseName = "streamdeck-editor-plugins";
const storeName = "archives";
const recordKey = "imported-plugin-archives";

type PluginArchiveRecord = {
    archives?: ArrayBuffer[];
    plugins?: ImportedPlugin[];
    savedAt: number;
    optimized?: boolean;
    version?: number;
};

function openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function copyBuffer(contents: Uint8Array) {
    const copy = new Uint8Array(contents.byteLength);
    copy.set(contents);
    return copy.buffer;
}

function mimeForPath(path: string) {
    const extension = path.split(".").at(-1)?.toLowerCase();
    return ({
        png: "image/png",
        svg: "image/svg+xml",
        gif: "image/gif",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        json: "application/json",
        html: "text/html",
        htm: "text/html",
        css: "text/css",
        js: "text/javascript",
    } as Record<string, string | undefined>)[extension || ""];
}

function sourceFile(contents: Uint8Array, path: string): PluginSourceFile {
    const file = new File([copyBuffer(contents)], path.split("/").at(-1) || path, {
        type: mimeForPath(path),
    }) as PluginSourceFile;
    Object.defineProperty(file, "streamdeckRelativePath", { value: path });
    return file;
}

function cachePlugins(plugins: ImportedPlugin[]): ImportedPlugin[] {
    return plugins.map((plugin) => ({
        ...plugin,
        iconUrl: undefined,
        actions: plugin.actions.map((action) => ({
            ...action,
            iconUrl: undefined,
            states: action.states.map((state) => ({
                ...state,
                imageUrl: undefined,
            })),
        })),
    }));
}

function hydratePlugins(plugins: ImportedPlugin[]): ImportedPlugin[] {
    return plugins.map((plugin) => ({
        ...plugin,
        iconUrl: plugin.iconFile ? URL.createObjectURL(plugin.iconFile) : undefined,
        actions: plugin.actions.map((action) => ({
            ...action,
            iconUrl: action.iconFile ? URL.createObjectURL(action.iconFile) : undefined,
            states: action.states.map((state) => ({
                ...state,
                imageUrl: state.imageFile ? URL.createObjectURL(state.imageFile) : undefined,
            })),
        })),
    }));
}

async function loadRecord() {
    const database = await openDatabase();
    return new Promise<PluginArchiveRecord | null>((resolve, reject) => {
        const request = database
            .transaction(storeName, "readonly")
            .objectStore(storeName)
            .get(recordKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/** Restores the exact decoded plugin objects saved after a successful import. */
export async function loadCachedPlugins(): Promise<ImportedPlugin[] | null> {
    const saved = await loadRecord();
    return saved?.plugins?.length ? hydratePlugins(saved.plugins) : null;
}

/**
 * Saves the already-decoded browser representation. This is both much smaller
 * and more reliable than re-zipping whole plugin folders: protected manifests
 * such as FXCommands do not need to be decoded a second time after refresh.
 */
export async function savePluginArchives(plugins: ImportedPlugin[]) {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.put(
            {
                plugins: cachePlugins(plugins),
                savedAt: Date.now(),
                optimized: true,
                version: 2,
            } satisfies PluginArchiveRecord,
            recordKey,
        );
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error || new Error("Plugin storage was aborted."));
        transaction.onerror = () => reject(transaction.error);
    });
}

/** Restores all previously stored plugin archives as virtual directory files. */
export async function loadPluginArchives(): Promise<PluginSourceFile[]> {
    const saved = await loadRecord();
    if (!saved?.archives?.length) return [];

    const files: PluginSourceFile[] = [];
    for (const archive of saved.archives) {
        const entries = unzipSync(new Uint8Array(archive));
        for (const [path, contents] of Object.entries(entries)) {
            if (!path.endsWith("/")) files.push(sourceFile(contents, path));
        }
    }
    // Older archives contained every file in the selected Plugins folder. Compact
    // them after this one restore so later reloads only process editor-relevant data.
    if (!saved.optimized) {
        // Legacy archive records have no verified decoded cache. They remain
        // readable and will be replaced on the next explicit folder import.
    }
    return files;
}
