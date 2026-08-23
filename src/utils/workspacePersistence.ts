const databaseName = "streamdeck-editor-workspace";
const storeName = "workspace";
const workspaceKey = "current";

export type SavedWorkspace = {
    archive: ArrayBuffer;
    editedPages: Record<string, any>;
    addedAssets: Record<string, Record<string, Uint8Array>>;
    activePageId?: string;
    historyIds: string[];
    selectedKey: string | null;
    preview: string;
    customSize: { rows: number; columns: number };
};

function openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function loadSavedWorkspace(): Promise<SavedWorkspace | null> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = database
            .transaction(storeName, "readonly")
            .objectStore(storeName)
            .get(workspaceKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function saveWorkspace(workspace: SavedWorkspace) {
    const database = await openDatabase();
    return new Promise<void>((resolve, reject) => {
        const request = database
            .transaction(storeName, "readwrite")
            .objectStore(storeName)
            .put(workspace, workspaceKey);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
