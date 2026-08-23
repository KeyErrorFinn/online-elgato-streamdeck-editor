import { useRef, useState } from "react";
import type {
    ImportedPlugin,
    ImportedPluginAction,
} from "../utils/pluginDirectoryDecoder";
import { installedPluginsPath } from "../utils/editorModel";

type PluginLibraryProps = {
    plugins: ImportedPlugin[];
    visiblePlugins: ImportedPlugin[];
    search: string;
    loading: boolean;
    onSearchChange: (search: string) => void;
    onLoadFolder: (files: FileList | null) => void;
    onDragAction: (action: ImportedPluginAction | null) => void;
    onError: (message: string) => void;
};

export default function PluginLibrary({
    plugins,
    visiblePlugins,
    search,
    loading,
    onSearchChange,
    onLoadFolder,
    onDragAction,
    onError,
}: PluginLibraryProps) {
    const [pathCopied, setPathCopied] = useState(false);
    const folderInput = useRef<HTMLInputElement>(null);

    const copyPluginsPath = async () => {
        try {
            await navigator.clipboard.writeText(installedPluginsPath);
            setPathCopied(true);
            window.setTimeout(() => setPathCopied(false), 1800);
        } catch {
            onError(`Copy this path into the folder picker: ${installedPluginsPath}`);
        }
    };

    const handleFolderChange = (files: FileList | null) => {
        onLoadFolder(files);
        if (folderInput.current) folderInput.current.value = "";
    };

    const choosePluginsFolder = () => {
        folderInput.current?.click();
    };


    return (
        <section className="panel-section plugin-library">
            <div className="panel-heading">
                <span>02</span>
                <h2>Installed plugins</h2>
            </div>
            <p>
                Select your Stream Deck <code>Plugins</code> folder. Files are read
                locally and are not uploaded.
            </p>
            <input
                ref={(input) => {
                    folderInput.current = input;
                    input?.setAttribute("webkitdirectory", "");
                }}
                className="sr-only"
                type="file"
                multiple
                onChange={(event) => handleFolderChange(event.target.files)}
            />
            <button
                className="secondary-button plugin-folder-button"
                onClick={choosePluginsFolder}
                disabled={loading}
            >
                {loading
                    ? "Reading plugins…"
                    : plugins.length
                        ? "Change plugins folder"
                        : "Choose plugins folder"}
            </button>
            <div className="plugins-path-hint">
                <span>Default Windows folder</span>
                <code>{installedPluginsPath}</code>
                <button className="text-button" onClick={copyPluginsPath}>
                    {pathCopied ? "Copied" : "Copy path"}
                </button>
                <small>
                    Paste this into the folder picker’s address bar, then select the
                    folder.
                </small>
            </div>
            {plugins.length > 0 && (
                <>
                    <div className="plugin-summary">
                        {plugins.length} plugins ·{" "}
                        {plugins.reduce(
                            (total, plugin) => total + plugin.actions.length,
                            0,
                        )}{" "}
                        actions
                    </div>
                    <input
                        className="plugin-search"
                        type="search"
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search actions…"
                    />
                    <div className="plugin-list">
                        {visiblePlugins.map((plugin) => (
                            <details key={plugin.uuid} open={!!search.trim()}>
                                <summary>
                                    {plugin.iconUrl && <img src={plugin.iconUrl} alt="" />}
                                    <span>
                                        <strong>{plugin.name}</strong>
                                        <small>{plugin.actions.length} actions</small>
                                    </span>
                                </summary>
                                <div className="plugin-actions">
                                    {plugin.actions.map((action) => (
                                        <button
                                            key={action.id}
                                            draggable
                                            onDragStart={() => onDragAction(action)}
                                            onDragEnd={() => onDragAction(null)}
                                            title={`Drag ${action.name} onto the grid`}
                                        >
                                            {action.iconUrl ? (
                                                <img src={action.iconUrl} alt="" />
                                            ) : (
                                                <span className="plugin-action-placeholder">◆</span>
                                            )}
                                            <span>{action.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </details>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
