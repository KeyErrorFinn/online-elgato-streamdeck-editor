import { useRef, useState, type DragEvent } from "react";

const acceptedFiles = ".streamDeckAction,.streamDeckProfile";

type ImportHandler = (files: FileList | null) => void;

function Brand() {
    return (
        <div className="editor-brand">
            <span className="editor-brand-mark" aria-hidden="true">
                {Array.from({ length: 9 }, (_, index) => (
                    <i key={index} />
                ))}
            </span>
            <span>
                <strong>Online Stream Deck Editor</strong>
                <small>Profile &amp; action workspace</small>
            </span>
        </div>
    );
}

type EditorTopBarProps = {
    projectName: string;
    onImport: ImportHandler;
    onStartFresh: () => void;
    onExport: () => void;
};

export function EditorTopBar({
    projectName,
    onImport,
    onStartFresh,
    onExport,
}: EditorTopBarProps) {
    const input = useRef<HTMLInputElement>(null);

    return (
        <header className="editor-app-bar">
            <Brand />
            <div className="project-identity" title={projectName}>
                <span className="project-status-dot" />
                <span>
                    <small>Current project</small>
                    <strong>{projectName}</strong>
                </span>
            </div>
            <nav className="editor-file-actions" aria-label="Project actions">
                <input
                    ref={input}
                    className="sr-only"
                    type="file"
                    accept={acceptedFiles}
                    onChange={(event) => {
                        onImport(event.target.files);
                        event.target.value = "";
                    }}
                />
                <button className="chrome-button" type="button" onClick={onStartFresh}>
                    <span aria-hidden="true">＋</span> Start fresh
                </button>
                <button
                    className="chrome-button"
                    type="button"
                    onClick={() => input.current?.click()}
                >
                    <span aria-hidden="true">↥</span> Import another
                </button>
                <button className="export-button" type="button" onClick={onExport}>
                    <span aria-hidden="true">⇩</span> Export profile/action
                </button>
            </nav>
        </header>
    );
}

type EditorStartScreenProps = {
    loading: boolean;
    error: string | null;
    sampleFilename: string | null;
    libraryLoading: boolean;
    onImport: ImportHandler;
    onLoadSample: () => void;
};

export function EditorStartScreen({
    loading,
    error,
    sampleFilename,
    libraryLoading,
    onImport,
    onLoadSample,
}: EditorStartScreenProps) {
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const receiveDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        onImport(event.dataTransfer.files);
    };

    return (
        <main className="start-shell">
            <header className="start-header">
                <Brand />
                <span className="local-only-badge">Private · runs in your browser</span>
            </header>
            <section className="start-workspace">
                <div className="start-copy">
                    <p className="eyebrow">Build beyond your hardware</p>
                    <h1>Edit any Stream Deck layout, at any size.</h1>
                    <p className="start-lede">
                        Import an existing profile or action, arrange keys on a larger
                        canvas, configure actions, and export a ready-to-use archive.
                    </p>
                    <ol className="workflow-steps">
                        <li><span>1</span><div><strong>Import</strong><small>Open a profile or action archive</small></div></li>
                        <li><span>2</span><div><strong>Edit</strong><small>Arrange keys and configure actions</small></div></li>
                        <li><span>3</span><div><strong>Export</strong><small>Download your edited archive</small></div></li>
                    </ol>
                </div>
                <div className="import-card">
                    <div
                        className={`file-drop-zone ${dragging ? "dragging" : ""}`}
                        onDragEnter={(event) => {
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                                setDragging(false);
                            }
                        }}
                        onDrop={receiveDrop}
                    >
                        <input
                            ref={input}
                            className="sr-only"
                            type="file"
                            accept={acceptedFiles}
                            onChange={(event) => {
                                onImport(event.target.files);
                                event.target.value = "";
                            }}
                        />
                        <span className="archive-art" aria-hidden="true">
                            <i /><i /><i />
                        </span>
                        <h2>{loading ? "Opening your archive..." : "Open a project"}</h2>
                        <p>Drop a file here or choose one from your computer.</p>
                        <button
                            className="start-import-button"
                            type="button"
                            disabled={loading}
                            onClick={() => input.current?.click()}
                        >
                            {loading ? <span className="restore-spinner" /> : <span aria-hidden="true">↥</span>}
                            Import profile/action
                        </button>
                        <small className="accepted-types">
                            .streamDeckAction or .streamDeckProfile
                        </small>
                    </div>
                    {error && <div className="start-error" role="alert">{error}</div>}
                    {sampleFilename && (
                        <button
                            className="debug-sample-link"
                            type="button"
                            disabled={loading}
                            onClick={onLoadSample}
                        >
                            Developer debug: open bundled sample ({sampleFilename})
                        </button>
                    )}
                </div>
            </section>
            <footer className="start-footer">
                <span>Your files stay on this device.</span>
                <span>{libraryLoading ? "Preparing the action library..." : "Action library ready"}</span>
                <span>Edits are saved locally as you work.</span>
            </footer>
        </main>
    );
}

type StartFreshDialogProps = {
    projectName: string;
    onCancel: () => void;
    onConfirm: () => void;
};

export function StartFreshDialog({
    projectName,
    onCancel,
    onConfirm,
}: StartFreshDialogProps) {
    return (
        <div className="delete-dialog-backdrop" role="presentation">
            <section
                className="delete-dialog start-fresh-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="start-fresh-title"
            >
                <span className="dialog-warning-icon" aria-hidden="true">!</span>
                <h2 id="start-fresh-title">Start fresh?</h2>
                <p>
                    This will remove <strong>{projectName}</strong> and all of its edits
                    from this browser. Export first if you want to keep your work.
                </p>
                <p className="dialog-footnote">Your imported plugin library will be kept.</p>
                <div className="delete-dialog-actions">
                    <button className="secondary-button" type="button" onClick={onCancel}>
                        Keep editing
                    </button>
                    <button className="delete-button" type="button" onClick={onConfirm}>
                        Delete work &amp; start fresh
                    </button>
                </div>
            </section>
        </div>
    );
}

export function EditorBootScreen({ status }: { status: string }) {
    return (
        <main className="editor-boot-screen">
            <Brand />
            <span className="restore-spinner" aria-hidden="true" />
            <h1>{status || "Preparing your workspace..."}</h1>
            <p>Restoring your locally saved project and edits.</p>
        </main>
    );
}
