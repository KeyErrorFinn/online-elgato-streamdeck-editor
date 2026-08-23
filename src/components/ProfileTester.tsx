import { useEffect, useState } from "react";
import {
    buildLinkedProfileGraphFromBlob,
    decodeFirstPageIdFromBlob,
    extractImageUrlsFromBlob,
    readProfileManifestFromBlob,
} from "../utils/profileInformationDecoder";
import { useRef } from "react";
import {
    readInstalledPlugins,
    type ImportedPlugin,
    type ImportedPluginAction,
} from "../utils/pluginDirectoryDecoder";
import { downloadEditedAction } from "../utils/actionArchive";
import PluginPropertyInspector from "./PluginPropertyInspector";
import PluginLivePreview from "./PluginLivePreview";
import {
    clearSavedWorkspace,
    loadSavedWorkspace,
    saveWorkspace,
} from "../utils/workspacePersistence";
import PluginLibrary from "./PluginLibrary";
import { readBuiltInPlugins } from "../utils/builtInPlugins";
import {
    loadCachedPlugins,
    loadPluginArchives,
    savePluginArchives,
} from "../utils/pluginPersistence";
import {
    devices,
    getGridBounds,
    getKeypadActions,
    getKeypadController,
    gridLabel,
    imageUrlFor,
    parentFolderActionId,
    type GridSize,
} from "../utils/editorModel";
import {
    EditorBootScreen,
    EditorStartScreen,
    EditorTopBar,
    StartFreshDialog,
} from "./EditorChrome";

declare const __PUBLIC_STREAMDECK_ACTION__: string | null;

export default function ProfileTester() {
    const [manifest, setManifest] = useState<object | null>(null);
    const [graph, setGraph] = useState<any | null>(null);
    const [images, setImages] = useState<Record<string, string> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [activePage, setActivePage] = useState<any | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [preview, setPreview] = useState("classic");
    const [customSize, setCustomSize] = useState<GridSize>({
        rows: 3,
        columns: 5,
    });
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [startFreshDialogOpen, setStartFreshDialogOpen] = useState(false);
    const [buttonClipboard, setButtonClipboard] = useState<any | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        key: string;
        x: number;
        y: number;
    } | null>(null);
    const [appearancePopoverOpen, setAppearancePopoverOpen] = useState(false);
    const [showData, setShowData] = useState(false);
    const [archiveData, setArchiveData] = useState<ArrayBuffer | null>(null);
    const [editedPages, setEditedPages] = useState<Record<string, any>>({});
    const [draggedKey, setDraggedKey] = useState<string | null>(null);
    const [plugins, setPlugins] = useState<ImportedPlugin[]>([]);
    const [builtInPlugins, setBuiltInPlugins] = useState<ImportedPlugin[]>([]);
    const [builtInPluginsLoading, setBuiltInPluginsLoading] = useState(true);
    const [savedPluginsLoading, setSavedPluginsLoading] = useState(true);
    const [pluginsSaving, setPluginsSaving] = useState(false);
    const [pluginSearch, setPluginSearch] = useState("");
    const [pluginsLoading, setPluginsLoading] = useState(false);
    const [draggedPluginAction, setDraggedPluginAction] =
        useState<ImportedPluginAction | null>(null);
    const [addedAssets, setAddedAssets] = useState<
        Record<string, Record<string, Uint8Array>>
    >({});
    const [workspaceReady, setWorkspaceReady] = useState(false);
    const [restoreStatus, setRestoreStatus] = useState("Restoring saved workspace…");
    const [pluginPreviewImages, setPluginPreviewImages] = useState<
        Record<string, string>
    >({});
    const [projectFilename, setProjectFilename] = useState<string | null>(null);
    const suppressWorkspaceSave = useRef(false);
    const sampleProjectName = __PUBLIC_STREAMDECK_ACTION__ || null;

    const pages = graph?.Pages?.Pages || {};
    const rootId = [
        graph?.Pages?.Current,
        graph?.Pages?.Default,
        ...Object.keys(pages),
    ].find((id) => typeof id === "string" && pages[id]);
    const rootPage = rootId ? pages[rootId] : undefined;
    const loadedPage = activePage ?? rootPage;
    const currentPage =
        loadedPage?.$uuid && editedPages[loadedPage.$uuid]
            ? editedPages[loadedPage.$uuid]
            : loadedPage;
    const projectName =
        projectFilename?.replace(/\.streamdeck(?:action|profile)$/i, "") ||
        currentPage?.Name ||
        (manifest as any)?.Name ||
        "Untitled Stream Deck project";
    const actions = getKeypadActions(currentPage);
    const imported = getGridBounds(actions);
    const autoDevice = devices.find(
        (device) =>
            device.rows >= imported.rows && device.columns >= imported.columns,
    );
    const requestedDevice = devices.find((device) => device.id === preview);
    const selectedDevice: GridSize =
        preview === "custom"
            ? customSize
            : (requestedDevice ?? autoDevice ?? imported);
    const visual = {
        rows: Math.max(selectedDevice.rows, imported.rows),
        columns: Math.max(selectedDevice.columns, imported.columns),
    };
    const selectedAction = selectedKey ? actions[selectedKey] : undefined;
    const selectedIsSystemTextAction =
        selectedAction?.UUID === "com.elgato.streamdeck.system.text";
    const actionKeys = Object.keys(actions);
    const isActionLandingPage =
        currentPage?.$uuid === rootPage?.$uuid && actionKeys.length === 1;
    const displayedKeys = isActionLandingPage
        ? actionKeys
        : Array.from({ length: visual.rows * visual.columns }, (_, index) => {
              const column = index % visual.columns;
              const row = Math.floor(index / visual.columns);
              return `${column},${row}`;
          });
    const availablePlugins = [...builtInPlugins, ...plugins];
    // Elgato's built-ins are separate on disk, but they form one library in
    // this editor. Keep the original actions intact so their plugin metadata
    // still resolves when a button is selected.
    const libraryPlugins: ImportedPlugin[] = [
        ...(builtInPlugins.length
            ? [
                  {
                      uuid: "streamdeck-editor-built-ins",
                      name: "Built-in",
                      actions: builtInPlugins.flatMap((plugin) => plugin.actions),
                  },
              ]
            : []),
        ...plugins,
    ];
    const normalizedPluginSearch = pluginSearch.trim().toLowerCase();
    const visiblePlugins = libraryPlugins
        .map((plugin) => ({
            ...plugin,
            actions: plugin.actions.filter(
                (action) =>
                    action.visibleInActionsList &&
                    (!normalizedPluginSearch ||
                        `${plugin.name} ${action.name} ${action.uuid}`
                            .toLowerCase()
                            .includes(normalizedPluginSearch)),
            ),
        }))
        .filter((plugin) => plugin.actions.length > 0);
    const pluginActionFor = (action: any) =>
        action?.UUID || action?.Plugin?.UUID
            ? availablePlugins.flatMap((plugin) => plugin.actions).find(
                  (candidate) =>
                      String(candidate.uuid).toLowerCase() ===
                          String(action.UUID).toLowerCase() ||
                      (String(candidate.pluginUuid).toLowerCase() ===
                          String(action.Plugin?.UUID).toLowerCase() &&
                          candidate.name.trim().toLowerCase() ===
                              String(action.Name || "").trim().toLowerCase()),
              )
            : undefined;
    const selectedPluginAction = pluginActionFor(selectedAction);
    const selectedActionState =
        selectedAction?.States?.[selectedAction?.State ?? 0] ??
        selectedAction?.States?.[0];
    const selectedPreviewImage =
        (selectedAction?.ActionID
            ? pluginPreviewImages[selectedAction.ActionID]
            : undefined) ||
        imageUrlFor(selectedActionState?.Image, images) ||
        selectedPluginAction?.states[selectedAction?.State ?? 0]?.imageUrl ||
        selectedPluginAction?.states[0]?.imageUrl ||
        selectedPluginAction?.iconUrl;
    const selectedIsParent =
        selectedAction?.UUID === parentFolderActionId ||
        selectedAction?.Plugin?.UUID === parentFolderActionId;
    const selectedIsFolder =
        !!selectedAction?.Settings?.ProfileUUID &&
        typeof selectedAction.Settings.ProfileUUID === "object";
    const selectedPluginNotImported =
        !selectedIsParent &&
        !selectedIsFolder &&
        !selectedIsSystemTextAction &&
        !!selectedAction?.Plugin?.UUID &&
        !selectedPluginAction;
    const selectedPluginSettingsUnsupported =
        !selectedIsParent &&
        !selectedIsFolder &&
        !selectedIsSystemTextAction &&
        !!selectedPluginAction &&
        !selectedPluginAction.propertyInspector;
    const selectedPluginPartiallySupported =
        !selectedIsParent &&
        !selectedIsFolder &&
        !!selectedPluginAction?.propertyInspector &&
        (/sdpi-wrapper[^>]*\bhidden\b/i.test(
            selectedPluginAction.propertyInspector.html,
        ) || /\bdata-target=/i.test(selectedPluginAction.propertyInspector.html));
    const selectedPreviewTitle =
        selectedActionState?.ShowTitle !== false || selectedIsParent
            ? selectedActionState?.Title ||
              (selectedIsParent ? selectedAction?.Name : "")
            : "";
    const selectedPreviewFontStyle = String(
        selectedActionState?.FontStyle || "",
    ).toLowerCase();
    const selectedPreviewTitleStyle = {
        fontFamily: selectedActionState?.FontFamily || "Arial, sans-serif",
        fontSize: `${selectedActionState?.FontSize || 12}px`,
        fontStyle: selectedPreviewFontStyle.includes("italic")
            ? "italic"
            : undefined,
        fontWeight: selectedPreviewFontStyle
            ? selectedPreviewFontStyle.includes("bold")
                ? 700
                : 400
            : 700,
        textDecoration: selectedActionState?.FontUnderline
            ? "underline"
            : undefined,
        color: selectedActionState?.TitleColor || "#ffffff",
        WebkitTextStroke: selectedActionState?.OutlineThickness
            ? `${Math.min(Number(selectedActionState.OutlineThickness), 2)}px #000000`
            : undefined,
        paintOrder: "stroke fill",
    };

    const updateCustomSize = (field: keyof GridSize, value: string) => {
        const number = Number(value);
        if (Number.isInteger(number) && number >= 1 && number <= 12)
            setCustomSize((size) => ({ ...size, [field]: number }));
    };
    const revokeUrls = (urls: Record<string, string> | null) =>
        new Set(Object.values(urls || {})).forEach((url) =>
            URL.revokeObjectURL(url),
        );

    useEffect(() => {
        let cancelled = false;

        async function restoreWorkspace() {
            try {
                const saved = await loadSavedWorkspace();
                if (!saved || cancelled) return;
                setRestoreStatus("Restoring your action…");
                const [nextManifest, nextGraph, nextImages] = await Promise.all([
                    readProfileManifestFromBlob(saved.archive),
                    buildLinkedProfileGraphFromBlob(saved.archive),
                    extractImageUrlsFromBlob(saved.archive),
                ]);
                if (cancelled) return;
                const savedPages = nextGraph?.Pages?.Pages || {};
                setManifest(nextManifest);
                setGraph(nextGraph);
                setArchiveData(saved.archive);
                setProjectFilename(
                    saved.sourceFilename ||
                        __PUBLIC_STREAMDECK_ACTION__ ||
                        "restored.streamDeckAction",
                );
                setImages(nextImages);
                setEditedPages(saved.editedPages || {});
                setAddedAssets(saved.addedAssets || {});
                setActivePage(saved.activePageId ? savedPages[saved.activePageId] : null);
                setHistory(
                    (saved.historyIds || [])
                        .map((pageId) => savedPages[pageId])
                        .filter(Boolean),
                );
                setSelectedKey(saved.selectedKey || null);
                setPreview(saved.preview || "classic");
                setCustomSize(saved.customSize || { rows: 3, columns: 5 });
            } catch {
                // A stale or oversized browser cache should never block the editor.
            } finally {
                if (!cancelled) {
                    setRestoreStatus("");
                    setWorkspaceReady(true);
                }
            }
        }

        void restoreWorkspace();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        // Restoring archives after the initial paint keeps the editor responsive.
        const timer = window.setTimeout(() => {
            void loadCachedPlugins()
                .then(async (cachedPlugins) => {
                    if (cachedPlugins?.length) {
                        setPlugins(cachedPlugins);
                        return;
                    }
                    const files = await loadPluginArchives();
                    if (files.length) setPlugins(await readInstalledPlugins(files));
                })
                .catch(() => {
                    // Corrupt or evicted browser storage should not block the editor.
                })
                .finally(() => setSavedPluginsLoading(false));
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Yield once so React can paint the editor before the bundled library is
        // read. Built-ins are intentionally a background enhancement.
        const timer = window.setTimeout(() => {
            void readBuiltInPlugins()
                .then(setBuiltInPlugins)
                .catch(() => {
                    // Built-ins are optional; user-imported plugins remain available.
                })
                .finally(() => {
                    setBuiltInPluginsLoading(false);
                });
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!workspaceReady || !archiveData || suppressWorkspaceSave.current) return;
        const timer = window.setTimeout(() => {
            if (suppressWorkspaceSave.current) return;
            void saveWorkspace({
                archive: archiveData,
                sourceFilename: projectFilename || undefined,
                editedPages,
                addedAssets,
                activePageId: currentPage?.$uuid,
                historyIds: history.map((page) => page?.$uuid).filter(Boolean),
                selectedKey,
                preview,
                customSize,
            }).catch(() => {
                // Browser storage may be unavailable or full; editing still works.
            });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [
        activePage,
        addedAssets,
        archiveData,
        currentPage?.$uuid,
        customSize,
        editedPages,
        history,
        preview,
        projectFilename,
        selectedKey,
        workspaceReady,
    ]);

    async function openArchive(archive: ArrayBuffer, filename: string) {
        const [nextManifest, nextGraph, nextImages] = await Promise.all([
            readProfileManifestFromBlob(archive),
            buildLinkedProfileGraphFromBlob(archive),
            extractImageUrlsFromBlob(archive),
        ]);
        suppressWorkspaceSave.current = false;
        setManifest(nextManifest);
        setGraph(nextGraph);
        setActivePage(null);
        setHistory([]);
        setSelectedKey(null);
        setEditedPages({});
        setAddedAssets({});
        setPluginPreviewImages({});
        setArchiveData(archive);
        setProjectFilename(filename);
        revokeUrls(images);
        setImages(nextImages);
        try {
            await decodeFirstPageIdFromBlob(archive);
        } catch {
            /* The graph remains usable without this diagnostic. */
        }
    }

    async function loadAction() {
        setError(null);
        setLoading(true);
        try {
            if (!__PUBLIC_STREAMDECK_ACTION__)
                throw new Error("No .streamDeckAction file found in public/.");
            const response = await fetch(
                `${import.meta.env.BASE_URL}${encodeURIComponent(__PUBLIC_STREAMDECK_ACTION__)}`,
            );
            if (!response.ok)
                throw new Error(`Could not load action (${response.status}).`);
            const archive = await response.arrayBuffer();
            await openArchive(archive, __PUBLIC_STREAMDECK_ACTION__);
        } catch (loadError: any) {
            setError(loadError.message || String(loadError));
            setManifest(null);
            setGraph(null);
        } finally {
            setLoading(false);
        }
    }

    async function loadImportedArchive(files: FileList | null) {
        const file = files?.[0];
        if (!file) return;
        setError(null);
        setLoading(true);
        try {
            if (!/\.streamdeck(?:action|profile)$/i.test(file.name)) {
                throw new Error(
                    "Choose a .streamDeckAction or .streamDeckProfile file.",
                );
            }
            await openArchive(await file.arrayBuffer(), file.name);
        } catch (loadError: any) {
            setError(
                loadError.message ||
                    "That archive could not be opened as a Stream Deck profile or action.",
            );
        } finally {
            setLoading(false);
        }
    }

    async function startFresh() {
        suppressWorkspaceSave.current = true;
        setStartFreshDialogOpen(false);
        setArchiveData(null);
        setManifest(null);
        setGraph(null);
        setActivePage(null);
        setHistory([]);
        setSelectedKey(null);
        setEditedPages({});
        setAddedAssets({});
        setPluginPreviewImages({});
        setProjectFilename(null);
        setShowData(false);
        setError(null);
        revokeUrls(images);
        setImages(null);
        try {
            await clearSavedWorkspace();
        } catch {
            setError(
                "The project was closed, but its saved browser copy could not be removed.",
            );
        }
    }

    const loadPluginDirectory = async (files: FileList | null) => {
        if (!files?.length) return;
        setPluginsLoading(true);
        setError(null);
        try {
            const selectedFiles = Array.from(files);
            const decodedPlugins = await readInstalledPlugins(selectedFiles);
            setPlugins(decodedPlugins);
            setPluginPreviewImages({});
            setPluginsSaving(true);
            try {
                await savePluginArchives(decodedPlugins);
                // Read the cache back immediately. The editor now uses the same
                // objects a refresh will restore, so storage problems cannot stay
                // hidden until the next page load.
                const restoredPlugins = await loadCachedPlugins();
                if (!restoredPlugins?.length) {
                    throw new Error("The saved plugin cache could not be read back.");
                }
                setPlugins(restoredPlugins);
            } catch {
                setError(
                    "Plugins were loaded, but the browser could not save and verify them for refresh.",
                );
            } finally {
                setPluginsSaving(false);
            }
        } catch (pluginError: any) {
            setError(
                pluginError.message || "Could not read the selected plugins folder.",
            );
        } finally {
            setPluginsLoading(false);
        }
    };


    const goBack = () => {
        if (!history.length) return;
        setActivePage(history.at(-1) ?? null);
        setHistory((items) => items.slice(0, -1));
        setSelectedKey(null);
    };
    const openAction = (action: any) => {
        const isParent =
            action?.UUID === parentFolderActionId ||
            action?.Plugin?.UUID === parentFolderActionId;
        if (isParent) return goBack();
        const page = action?.Settings?.ProfileUUID;
        const child =
            page && typeof page === "object" ? Object.values(page)[0] : null;
        if (child && typeof child === "object") {
            setHistory((items) => [...items, currentPage]);
            setActivePage(child);
            setSelectedKey(null);
        }
    };

    const moveAction = (from: string, to: string) => {
        if (!currentPage || from === to) return;
        const nextPage = structuredClone(currentPage);
        const keypad = getKeypadController(nextPage);
        if (!keypad) return;
        const nextActions = { ...(keypad.Actions || {}) };
        [nextActions[from], nextActions[to]] = [nextActions[to], nextActions[from]];
        if (!nextActions[from]) delete nextActions[from];
        if (!nextActions[to]) delete nextActions[to];
        keypad.Actions = nextActions;
        setEditedPages((pages) => ({ ...pages, [nextPage.$uuid]: nextPage }));
        setActivePage(nextPage);
        setSelectedKey(to);
    };

    const updateSelectedAction = (update: (action: any) => void) => {
        if (!currentPage || !selectedKey) return;
        const nextPage = structuredClone(currentPage);
        const keypad = getKeypadController(nextPage);
        const action = keypad?.Actions?.[selectedKey];
        if (!action) return;
        update(action);
        setEditedPages((pages) => ({ ...pages, [nextPage.$uuid]: nextPage }));
        setActivePage(nextPage);
    };

    const updateSelectedState = (update: (state: any) => void) => {
        updateSelectedAction((action) => {
            const stateIndex = action.State ?? 0;
            if (!Array.isArray(action.States)) action.States = [];
            if (!action.States[stateIndex]) action.States[stateIndex] = {};
            update(action.States[stateIndex]);
        });
    };

    const deleteSelectedAction = () => {
        if (!currentPage || !selectedKey) return;
        const nextPage = structuredClone(currentPage);
        const keypad = getKeypadController(nextPage);
        if (!keypad?.Actions?.[selectedKey]) return;
        delete keypad.Actions[selectedKey];
        setEditedPages((pages) => ({ ...pages, [nextPage.$uuid]: nextPage }));
        setActivePage(nextPage);
        setSelectedKey(null);
        setAppearancePopoverOpen(false);
        setDeleteDialogOpen(false);
        setContextMenu(null);
    };

    const copyAction = (action: any) => {
        if (!action) return;
        setButtonClipboard(structuredClone(action));
        setContextMenu(null);
    };

    const pasteAction = (targetKey: string) => {
        if (!currentPage || !buttonClipboard || actions[targetKey]) return;
        const nextPage = structuredClone(currentPage);
        const keypad = getKeypadController(nextPage);
        if (!keypad) return;
        if (!keypad.Actions) keypad.Actions = {};
        const pasted = structuredClone(buttonClipboard);
        if (pasted.ActionID) pasted.ActionID = crypto.randomUUID();
        keypad.Actions[targetKey] = pasted;
        setEditedPages((pages) => ({ ...pages, [nextPage.$uuid]: nextPage }));
        setActivePage(nextPage);
        setSelectedKey(targetKey);
        setContextMenu(null);
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (
                target?.isContentEditable ||
                ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName || "")
            )
                return;
            if (event.key === "Escape") {
                setDeleteDialogOpen(false);
                setStartFreshDialogOpen(false);
                setContextMenu(null);
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && selectedAction) {
                if (window.getSelection()?.toString()) return;
                event.preventDefault();
                copyAction(selectedAction);
                return;
            }
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "v" &&
                selectedKey &&
                !actions[selectedKey]
            ) {
                event.preventDefault();
                pasteAction(selectedKey);
                return;
            }
            if (event.key === "Delete" && selectedKey && selectedAction) {
                event.preventDefault();
                setDeleteDialogOpen(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [actions, buttonClipboard, selectedAction, selectedKey]);

    useEffect(() => {
        const closeContextMenu = () => setContextMenu(null);
        window.addEventListener("pointerdown", closeContextMenu);
        return () => window.removeEventListener("pointerdown", closeContextMenu);
    }, []);

    const addPluginAction = async (
        pluginAction: ImportedPluginAction,
        targetKey: string,
    ) => {
        if (!currentPage?.$uuid) return;
        const nextPage = structuredClone(currentPage);
        const keypad = getKeypadController(nextPage);
        if (!keypad) return;
        if (!keypad.Actions) keypad.Actions = {};

        const pageAssets: Record<string, Uint8Array> = {};
        const nextImageUrls: Record<string, string> = {};
        const sourceStates = pluginAction.states.length
            ? pluginAction.states
            : [{ definition: {}, imageFile: pluginAction.iconFile }];
        const states = await Promise.all(
            sourceStates.map(async ({ definition, imageFile }) => {
                let imagePath: string | undefined;
                if (imageFile) {
                    const extension =
                        imageFile.name.match(/\.[a-z0-9]+$/i)?.[0] || ".png";
                    const filename = `imported-${crypto.randomUUID()}${extension}`;
                    imagePath = `Images/${filename}`;
                    pageAssets[filename] = new Uint8Array(await imageFile.arrayBuffer());
                    const url = URL.createObjectURL(imageFile);
                    nextImageUrls[imagePath] = url;
                    nextImageUrls[filename] = url;
                }
                return {
                    FontFamily: definition.FontFamily || "Arial",
                    FontSize: definition.FontSize ?? 12,
                    FontStyle: definition.FontStyle || "Bold",
                    FontUnderline: definition.FontUnderline ?? false,
                    Image: imagePath,
                    OutlineThickness: definition.OutlineThickness ?? 2,
                    ShowTitle: definition.ShowTitle ?? true,
                    Title: definition.Title || "",
                    TitleAlignment: definition.TitleAlignment || "bottom",
                    TitleColor: definition.TitleColor || "#ffffff",
                };
            }),
        );

        keypad.Actions[targetKey] = {
            ActionID: crypto.randomUUID(),
            LinkedTitle: true,
            Name: pluginAction.name,
            Plugin: {
                Name: pluginAction.pluginName,
                UUID: pluginAction.pluginUuid,
                Version: pluginAction.pluginVersion,
            },
            Resources: null,
            Settings: {},
            State: 0,
            States: states,
            UUID: pluginAction.uuid,
        };
        setEditedPages((pages) => ({ ...pages, [nextPage.$uuid]: nextPage }));
        setAddedAssets((assets) => ({
            ...assets,
            [nextPage.$uuid]: { ...(assets[nextPage.$uuid] || {}), ...pageAssets },
        }));
        setImages((urls) => ({ ...(urls || {}), ...nextImageUrls }));
        setActivePage(nextPage);
        setSelectedKey(targetKey);
    };

    const downloadAction = () => {
        if (!archiveData) return;
        downloadEditedAction(
            archiveData,
            editedPages,
            addedAssets,
            projectFilename,
        );
    };

    const selectedPluginLabel =
        selectedIsSystemTextAction
            ? "System"
            : (selectedPluginAction?.pluginName || selectedAction?.Plugin?.Name || "Stream Deck");
    const selectedActionLabel =
        selectedAction?.Name || selectedPluginAction?.name || "Action";

    if (!workspaceReady) {
        return <EditorBootScreen status={restoreStatus} />;
    }

    if (!manifest) {
        return (
            <EditorStartScreen
                loading={loading}
                error={error}
                sampleFilename={sampleProjectName}
                libraryLoading={builtInPluginsLoading || savedPluginsLoading}
                onImport={loadImportedArchive}
                onLoadSample={loadAction}
            />
        );
    }

    return (
        <main className="editor-shell">
            <EditorTopBar
                projectName={projectName}
                onImport={loadImportedArchive}
                onStartFresh={() => setStartFreshDialogOpen(true)}
                onExport={downloadAction}
            />
            {error && <div className="error-banner">{error}</div>}
            {startFreshDialogOpen && (
                <StartFreshDialog
                    projectName={projectName}
                    onCancel={() => setStartFreshDialogOpen(false)}
                    onConfirm={() => void startFresh()}
                />
            )}
            {deleteDialogOpen && selectedAction && (
                <div className="delete-dialog-backdrop" role="presentation">
                    <section
                        className="delete-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-dialog-title"
                    >
                        <h2 id="delete-dialog-title">Delete button?</h2>
                        <p>
                            Are you sure you want to delete this <strong>{selectedPluginLabel}</strong>
                            {": "}
                            <strong>{selectedActionLabel}</strong> button?
                        </p>
                        <div className="delete-dialog-actions">
                            <button
                                className="secondary-button"
                                type="button"
                                onClick={() => setDeleteDialogOpen(false)}
                            >
                                Keep
                            </button>
                            <button
                                className="delete-button"
                                type="button"
                                onClick={deleteSelectedAction}
                            >
                                Delete
                            </button>
                        </div>
                    </section>
                </div>
            )}
            {contextMenu && (
                <div
                    className="button-context-menu"
                    role="menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button
                        type="button"
                        role="menuitem"
                        disabled={!actions[contextMenu.key]}
                        onClick={() => copyAction(actions[contextMenu.key])}
                    >
                        Copy
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        disabled={!buttonClipboard || !!actions[contextMenu.key]}
                        onClick={() => pasteAction(contextMenu.key)}
                    >
                        Paste
                    </button>
                    <hr />
                    <button
                        className="context-delete"
                        type="button"
                        role="menuitem"
                        disabled={!actions[contextMenu.key]}
                        onClick={() => {
                            setSelectedKey(contextMenu.key);
                            setDeleteDialogOpen(true);
                            setContextMenu(null);
                        }}
                    >
                        Delete
                    </button>
                </div>
            )}
            <div className="editor-layout">
                <aside className="control-panel">
                    <section className="panel-section">
                        <div className="panel-heading">
                            <span>01</span>
                            <h2>Visual device</h2>
                        </div>
                        <p>
                            Keys outside this device stay visible but are darkened to show
                            they would be clipped on hardware.
                        </p>
                        <label className="device-select-label">
                            Preview device
                            <select
                                value={preview}
                                onChange={(event) => setPreview(event.target.value)}
                            >
                                <option value="auto">
                                    Auto-fit imported grid
                                    {autoDevice ? ` (${autoDevice.label})` : ""}
                                </option>
                                {devices.map((device) => (
                                    <option key={device.id} value={device.id}>
                                        {device.label} ({gridLabel(device)})
                                    </option>
                                ))}
                                <option value="custom">Custom size</option>
                            </select>
                        </label>
                        <div className="custom-device">
                            <strong>Custom visual size</strong>
                            <div className="dimension-inputs">
                                <label>
                                    Rows
                                    <input
                                        type="number"
                                        min="1"
                                        max="12"
                                        value={customSize.rows}
                                        onChange={(event) =>
                                            updateCustomSize("rows", event.target.value)
                                        }
                                    />
                                </label>
                                <b>{"\u00d7"}</b>
                                <label>
                                    Columns
                                    <input
                                        type="number"
                                        min="1"
                                        max="12"
                                        value={customSize.columns}
                                        onChange={(event) =>
                                            updateCustomSize("columns", event.target.value)
                                        }
                                    />
                                </label>
                            </div>
                            <button
                                className="secondary-button custom-size-button"
                                onClick={() => setPreview("custom")}
                            >
                                Use {gridLabel(customSize)} canvas
                            </button>
                        </div>
                    </section>
                    <PluginLibrary
                        plugins={libraryPlugins}
                        visiblePlugins={visiblePlugins}
                        search={pluginSearch}
                        loading={pluginsLoading}
                        builtInsLoading={builtInPluginsLoading}
                        savedPluginsLoading={savedPluginsLoading}
                        saving={pluginsSaving}
                        onSearchChange={setPluginSearch}
                        onLoadFolder={loadPluginDirectory}
                        onDragAction={(action) => {
                            setDraggedPluginAction(action);
                            setDraggedKey(null);
                        }}
                        onError={setError}
                    />
                </aside>
                <section className="canvas-panel">
                    <div className="canvas-topline">
                        <div>
                            <p className="eyebrow">Live canvas</p>
                            <h2>{currentPage?.Name || "Root page"}</h2>
                        </div>
                        <div className="canvas-badges">
                            <span>{gridLabel(selectedDevice)} selected device</span>
                            <span>{gridLabel(imported)} imported page</span>
                        </div>
                    </div>
                    {!manifest && (
                        <div className="empty-state">
                            <div className="empty-icon">SD</div>
                            <h2>Open a Stream Deck action to begin</h2>
                            <p>
                                Your action stays in the browser while linked folders and button
                                artwork are unpacked.
                            </p>
                            <button
                                className="primary-button"
                                onClick={loadAction}
                                disabled={loading}
                            >
                                Open action from public
                            </button>
                        </div>
                    )}
                    {manifest && (
                        <div
                            className={`deck-frame ${isActionLandingPage ? "action-landing-frame" : ""}`}
                        >
                            <div className="deck-header">
                                <span>Stream Deck preview</span>
                                <span>
                                    {requestedDevice?.shortLabel ||
                                        (preview === "custom" ? "Custom canvas" : "Auto-fit")}
                                </span>
                            </div>
                            <div className="deck-content">
                                <div
                                    className="deck-grid"
                                    style={{
                                        gridTemplateColumns: `repeat(${isActionLandingPage ? 1 : visual.columns}, clamp(54px, 7.7vw, 95px))`,
                                    }}
                                >
                                    {displayedKeys.map((key) => {
                                            const [column, row] = key.split(",").map(Number);
                                            const clipped =
                                                row >= selectedDevice.rows ||
                                                column >= selectedDevice.columns;
                                            const action = actions[key];
                                            const actionState =
                                                action?.States?.[action?.State ?? 0] ??
                                                action?.States?.[0];
                                            const pluginAction = pluginActionFor(action);
                                            const image =
                                                (action?.ActionID
                                                    ? pluginPreviewImages[action.ActionID]
                                                    : undefined) ||
                                                imageUrlFor(actionState?.Image, images) ||
                                                pluginAction?.states[
                                                    action?.State ?? 0
                                                ]?.imageUrl ||
                                                pluginAction?.states[0]?.imageUrl ||
                                                pluginAction?.iconUrl;
                                            const profile = action?.Settings?.ProfileUUID;
                                            const folder = !!profile && typeof profile === "object";
                                            const parent =
                                                action?.UUID === parentFolderActionId ||
                                                action?.Plugin?.UUID === parentFolderActionId;
                                            const navigable =
                                                folder || (parent && history.length > 0);
                                            const title =
                                                actionState?.ShowTitle !== false || parent
                                                    ? actionState?.Title ||
                                                      (parent ? action?.Name : "")
                                                    : "";
                                            const fontStyle = String(
                                                actionState?.FontStyle || "",
                                            ).toLowerCase();
                                            const titleStyle = {
                                                fontFamily:
                                                    actionState?.FontFamily || "Arial, sans-serif",
                                                fontSize: `${actionState?.FontSize || 12}px`,
                                                fontStyle: fontStyle.includes("italic")
                                                    ? "italic"
                                                    : undefined,
                                                fontWeight: fontStyle
                                                    ? fontStyle.includes("bold")
                                                        ? 700
                                                        : 400
                                                    : 700,
                                                textDecoration: actionState?.FontUnderline
                                                    ? "underline"
                                                    : undefined,
                                                color: actionState?.TitleColor || "#ffffff",
                                                WebkitTextStroke: actionState?.OutlineThickness
                                                    ? `${Math.min(Number(actionState.OutlineThickness), 2)}px #000000`
                                                    : undefined,
                                                paintOrder: "stroke fill",
                                            };
                                            return (
                                                <button
                                                    key={key}
                                                    draggable={!!action}
                                                    className={`deck-key ${selectedKey === key ? "selected" : ""} ${navigable ? "navigable" : ""} ${clipped ? "clipped-key" : ""} ${draggedPluginAction ? "plugin-drop-target" : ""}`}
                                                    onDragStart={() => {
                                                        setDraggedKey(key);
                                                        setDraggedPluginAction(null);
                                                    }}
                                                    onDragOver={(event) => event.preventDefault()}
                                                    onDrop={() => {
                                                        if (draggedPluginAction)
                                                            void addPluginAction(draggedPluginAction, key);
                                                        else if (draggedKey) moveAction(draggedKey, key);
                                                        setDraggedPluginAction(null);
                                                        setDraggedKey(null);
                                                    }}
                                                    onDragEnd={() => setDraggedKey(null)}
                                                    onClick={() => {
                                                        setSelectedKey(key);
                                                        setAppearancePopoverOpen(false);
                                                    }}
                                                    onContextMenu={(event) => {
                                                        event.preventDefault();
                                                        setSelectedKey(key);
                                                        setAppearancePopoverOpen(false);
                                                        setContextMenu({
                                                            key,
                                                            x: Math.min(event.clientX, window.innerWidth - 172),
                                                            y: Math.min(event.clientY, window.innerHeight - 142),
                                                        });
                                                    }}
                                                    onDoubleClick={() => {
                                                        if (navigable) openAction(action);
                                                    }}
                                                    title={
                                                        parent
                                                            ? "Double-click to go to the parent folder"
                                                            : folder
                                                                ? "Double-click to open folder"
                                                                : action?.Name || `Key ${key}`
                                                    }
                                                >
                                                    {image && <img src={image} alt="" />}
                                                    {title && (
                                                        <span
                                                            className={`key-title title-${String(actionState?.TitleAlignment || "bottom").toLowerCase()}`}
                                                            style={titleStyle}
                                                        >
                                                            {title}
                                                        </span>
                                                    )}
                                                    {action && !image && !title && (
                                                        <span className="key-title title-middle">
                                                            {action.Name || action.Plugin?.Name || "Action"}
                                                        </span>
                                                    )}
                                                    {folder && <span className="folder-mark">{"\u2197"}</span>}
                                                    {parent && <span className="folder-mark">{"\u2196"}</span>}
                                                </button>
                                            );
                                    })}
                                </div>
                                <div className="plugin-live-previews" aria-hidden="true">
                                    {Object.entries(actions).map(([key, action]: [string, any]) => {
                                        const pluginAction = pluginActionFor(action);
                                        if (!action?.ActionID || !pluginAction?.renderer) return null;
                                        return (
                                            <PluginLivePreview
                                                key={`${key}:${JSON.stringify(action.Settings || {})}`}
                                                renderer={pluginAction.renderer}
                                                settings={action.Settings || {}}
                                                onImage={(image) =>
                                                    setPluginPreviewImages((current) =>
                                                        current[action.ActionID] === image
                                                            ? current
                                                            : { ...current, [action.ActionID]: image },
                                                    )
                                                }
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                                {selectedAction && (
                                    <aside className="selected-key-panel">
                                        <header className="selected-key-header">
                                            <div>
                                                <h3>
                                                    <strong>
                                                        {selectedPluginLabel}
                                                    </strong>
                                                    {": "}
                                                    {selectedAction.Name || "Unnamed action"}
                                                </h3>
                                            </div>
                                        </header>
                                        <div className="selected-key-body">
                                            <div className="selected-key-icon selected-key-preview">
                                                {selectedPreviewImage && (
                                                    <img src={selectedPreviewImage} alt="" />
                                                )}
                                                {selectedPreviewTitle && (
                                                    <span
                                                        className={`key-title title-${String(selectedActionState?.TitleAlignment || "bottom").toLowerCase()}`}
                                                        style={selectedPreviewTitleStyle}
                                                    >
                                                        {selectedPreviewTitle}
                                                    </span>
                                                )}
                                                {!selectedPreviewImage &&
                                                    !selectedPreviewTitle && (
                                                        <span className="key-title title-middle">
                                                            {selectedAction.Name ||
                                                                selectedAction.Plugin?.Name ||
                                                                "Action"}
                                                        </span>
                                                    )}
                                            </div>
                                            <div className="button-editor-grid">
                                            <section className="button-appearance title-editor">
                                                <label className="button-editor-field title-field">
                                                    <span>Title:</span>
                                                    <span className="title-input-control">
                                                        <textarea
                                                            rows={1}
                                                            value={
                                                                selectedAction.States?.[
                                                                    selectedAction.State ?? 0
                                                                ]?.Title || ""
                                                            }
                                                            onChange={(event) =>
                                                                updateSelectedState((state) => {
                                                                    state.Title = event.target.value;
                                                                })
                                                            }
                                                        />
                                                        <button
                                                            className="title-format-toggle"
                                                            type="button"
                                                            aria-expanded={appearancePopoverOpen}
                                                            aria-label="Edit title formatting"
                                                            onClick={() =>
                                                                setAppearancePopoverOpen((open) => !open)
                                                            }
                                                        >
                                                            T {"\u25be"}
                                                        </button>
                                                    </span>
                                                </label>
                                                {appearancePopoverOpen && (
                                                    <div className="title-format-popover">
                                                        <div className="format-row format-options-row">
                                                    <label className="button-editor-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                selectedAction.States?.[
                                                                    selectedAction.State ?? 0
                                                                ]?.ShowTitle !== false
                                                            }
                                                            onChange={(event) =>
                                                                updateSelectedState((state) => {
                                                                    state.ShowTitle = event.target.checked;
                                                                })
                                                            }
                                                        />
                                                        Show title
                                                    </label>
                                                        {[
                                                            ["bottom", "T\u2193", "Align bottom"],
                                                            ["middle", "T\u2195", "Align vertical middle"],
                                                            ["top", "T\u2191", "Align top"],
                                                        ].map(([alignment, icon, label]) => (
                                                            <button
                                                                key={alignment}
                                                                type="button"
                                                                className={`format-icon-button ${String(selectedAction.States?.[selectedAction.State ?? 0]?.TitleAlignment || "bottom") === alignment ? "active" : ""}`}
                                                                title={label}
                                                                onClick={() =>
                                                                    updateSelectedState((state) => {
                                                                        state.TitleAlignment = alignment;
                                                                    })
                                                                }
                                                            >
                                                                {icon}
                                                            </button>
                                                        ))}
                                                        <button
                                                            className="format-reset-button"
                                                            type="button"
                                                            onClick={() =>
                                                                updateSelectedState((state) => {
                                                                    Object.assign(state, {
                                                                        FontFamily: "",
                                                                        FontSize: 12,
                                                                        FontStyle: "Bold",
                                                                        FontUnderline: false,
                                                                        ShowTitle: true,
                                                                        TitleAlignment: "bottom",
                                                                        TitleColor: "#ffffff",
                                                                    });
                                                                })
                                                            }
                                                        >
                                                            Reset
                                                        </button>
                                                        </div>
                                                        <label className="format-select-field">
                                                            <select
                                                                value={
                                                                    selectedAction.States?.[
                                                                        selectedAction.State ?? 0
                                                                    ]?.FontFamily || "Default"
                                                                }
                                                                onChange={(event) =>
                                                                    updateSelectedState((state) => {
                                                                        state.FontFamily =
                                                                            event.target.value === "Default"
                                                                                ? ""
                                                                                : event.target.value;
                                                                        if (event.target.value === "Default") {
                                                                            state.FontStyle = "Bold";
                                                                        }
                                                                    })
                                                                }
                                                            >
                                                                <option value="Default">Default — Arial (Bold)</option>
                                                                <option>Arial</option>
                                                                <option>Comic Sans MS</option>
                                                                <option>Courier</option>
                                                                <option>Courier New</option>
                                                                <option>Georgia</option>
                                                                <option>Impact</option>
                                                                <option>Microsoft Sans Serif</option>
                                                                <option>Symbol</option>
                                                                <option>Tahoma</option>
                                                                <option>Times New Roman</option>
                                                                <option>Trebuchet MS</option>
                                                                <option>Verdana</option>
                                                                <option>Webdings</option>
                                                                <option>Wingdings</option>
                                                            </select>
                                                        </label>
                                                        <div className="format-row format-style-row">
                                                            <label className="format-size-field">
                                                                <span>Font size</span>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="72"
                                                                    value={
                                                                        selectedAction.States?.[
                                                                            selectedAction.State ?? 0
                                                                        ]?.FontSize ?? 12
                                                                    }
                                                                    onChange={(event) =>
                                                                        updateSelectedState((state) => {
                                                                            state.FontSize = Math.max(
                                                                                1,
                                                                                Number(event.target.value) || 12,
                                                                            );
                                                                        })
                                                                    }
                                                                />
                                                            </label>
                                                            <button
                                                                className={`format-icon-button bold-button ${String(selectedAction.States?.[selectedAction.State ?? 0]?.FontStyle || "Bold").toLowerCase().includes("bold") ? "active" : ""}`}
                                                                type="button"
                                                                title="Bold"
                                                                disabled={!selectedAction.States?.[selectedAction.State ?? 0]?.FontFamily}
                                                                onClick={() =>
                                                                    updateSelectedState((state) => {
                                                                        const styles = String(
                                                                            state.FontStyle || "Bold",
                                                                        );
                                                                        state.FontStyle = /bold/i.test(styles)
                                                                            ? (styles
                                                                                  .replace(/bold/gi, "")
                                                                                  .trim() || "Regular")
                                                                            : `${styles} Bold`.trim();
                                                                    })
                                                                }
                                                            >
                                                                B
                                                            </button>
                                                            <button
                                                                className={`format-icon-button underline-button ${selectedAction.States?.[selectedAction.State ?? 0]?.FontUnderline ? "active" : ""}`}
                                                                type="button"
                                                                title="Underline"
                                                                onClick={() =>
                                                                    updateSelectedState((state) => {
                                                                        state.FontUnderline = !state.FontUnderline;
                                                                    })
                                                                }
                                                            >
                                                                U
                                                            </button>
                                                            <label className="format-colour-field" title="Text colour">
                                                                <input
                                                                    type="color"
                                                                    value={
                                                                        selectedAction.States?.[
                                                                            selectedAction.State ?? 0
                                                                        ]?.TitleColor || "#ffffff"
                                                                    }
                                                                    onChange={(event) =>
                                                                        updateSelectedState((state) => {
                                                                            state.TitleColor = event.target.value;
                                                                        })
                                                                    }
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}
                                            </section>
                                            {selectedPluginAction?.propertyInspector && (
                                                <section className="plugin-settings plugin-settings-from-plugin">
                                                    <h4>Plugin settings</h4>
                                                    <PluginPropertyInspector
                                                        key={selectedKey}
                                                        inspector={selectedPluginAction.propertyInspector}
                                                        settings={selectedAction.Settings || {}}
                                                        onSettingChange={(key, value, isPath) =>
                                                            updateSelectedAction((action) => {
                                                                action.Settings ||= {};
                                                                if (!isPath) {
                                                                    action.Settings[key] = value;
                                                                    return;
                                                                }
                                                                const parts = key.split(".").filter(Boolean);
                                                                const last = parts.pop();
                                                                if (!last) return;
                                                                const target = parts.reduce((current, part) => {
                                                                    if (!current[part] || typeof current[part] !== "object") {
                                                                        current[part] = {};
                                                                    }
                                                                    return current[part];
                                                                }, action.Settings as Record<string, any>);
                                                                target[last] = value;
                                                            })
                                                        }
                                                    />
                                                </section>
                                            )}
                                            {selectedIsSystemTextAction && (
                                                <section className="plugin-settings system-text-settings">
                                                    <label className="built-in-form-row built-in-textarea-row">
                                                        <span>Text:</span>
                                                        <span className="built-in-textarea-control">
                                                            <textarea
                                                                value={selectedAction.Settings?.pastedText || ""}
                                                                onChange={(event) =>
                                                                    updateSelectedAction((action) => {
                                                                        action.Settings ||= {};
                                                                        action.Settings.pastedText = event.target.value;
                                                                    })
                                                                }
                                                            />
                                                            <small>
                                                                {String(selectedAction.Settings?.pastedText || "").length} characters
                                                            </small>
                                                        </span>
                                                    </label>
                                                    <label className="button-editor-checkbox built-in-checkbox-row">
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(selectedAction.Settings?.isSendingEnter)}
                                                            onChange={(event) =>
                                                                updateSelectedAction((action) => {
                                                                    action.Settings ||= {};
                                                                    action.Settings.isSendingEnter = event.target.checked;
                                                                })
                                                            }
                                                        />
                                                        Press Enter after message
                                                    </label>
                                                    <label className="built-in-form-row">
                                                        <span>Text Mode:</span>
                                                        <select
                                                            value={selectedAction.Settings?.isTypingMode ? "typing" : "clipboard"}
                                                            onChange={(event) =>
                                                                updateSelectedAction((action) => {
                                                                    action.Settings ||= {};
                                                                    action.Settings.isTypingMode =
                                                                        event.target.value === "typing";
                                                                })
                                                            }
                                                        >
                                                            <option value="clipboard">Paste from Clipboard</option>
                                                            <option value="typing">Simulate typing</option>
                                                        </select>
                                                    </label>
                                                </section>
                                            )}
                                            {selectedPluginNotImported && (
                                                <section className="plugin-settings plugin-settings-unsupported">
                                                    <h4>Plugin not imported</h4>
                                                    <p>
                                                        Import this action&apos;s plugin folder to load its
                                                        settings form, default artwork, and other plugin info.
                                                    </p>
                                                </section>
                                            )}
                                            {selectedPluginSettingsUnsupported && (
                                                <section className="plugin-settings plugin-settings-unsupported">
                                                    <h4>Plugin settings unavailable</h4>
                                                    <p>
                                                        This imported plugin does not expose a
                                                        browser-compatible settings form for this action.
                                                    </p>
                                                </section>
                                            )}
                                            {selectedPluginPartiallySupported && (
                                                <section className="plugin-settings plugin-settings-partial">
                                                    <h4>Some plugin settings are unavailable</h4>
                                                    <p>
                                                        Basic settings work here, but this plugin also relies
                                                        on Stream Deck&apos;s native runtime. External data,
                                                        generated presets, and desktop-editor actions may not
                                                        be available.
                                                    </p>
                                                </section>
                                            )}
                                        </div>
                                        </div>
                                        <details className="raw-action-details">
                                            <summary>Raw action data</summary>
                                            <pre>{JSON.stringify(selectedAction, null, 2)}</pre>
                                        </details>
                                    </aside>
                                )}
                        </div>
                    )}
                    {imported.rows > selectedDevice.rows ||
                        imported.columns > selectedDevice.columns ? (
                        <p className="canvas-note">
                            Dark keys are outside the selected device and would be cut off by
                            Stream Deck hardware. They remain editable here.
                        </p>
                    ) : (
                        <p className="canvas-note">
                            Drag one action onto another to swap their locations. Use Export
                            profile/action when you are ready.
                        </p>
                    )}
                </section>
            </div>
            {manifest && (
                <section className="data-drawer">
                    <button
                        className="drawer-toggle"
                        onClick={() => setShowData((show) => !show)}
                    >
                        {showData ? "Hide raw profile data" : "Show raw profile data"}
                    </button>
                    {showData && (
                        <div className="data-columns">
                            <article>
                                <h3>Profile manifest</h3>
                                <pre>{JSON.stringify(manifest, null, 2)}</pre>
                            </article>
                            <article>
                                <h3>Current page</h3>
                                <pre>{JSON.stringify(currentPage, null, 2)}</pre>
                            </article>
                            <article>
                                <h3>Linked page graph</h3>
                                <pre>{JSON.stringify(graph, null, 2)}</pre>
                            </article>
                        </div>
                    )}
                </section>
            )}
        </main>
    );
}
