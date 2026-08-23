import { useEffect, useMemo, useRef } from "react";

type Renderer = { html: string; scripts: string[] };

type Props = {
    renderer: Renderer;
    settings: Record<string, any>;
    onImage: (image: string) => void;
};

function runtimeDocument(renderer: Renderer, settings: Record<string, any>) {
    const markup = renderer.html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<link\b[^>]*>/gi, "");
    const safeSettings = JSON.stringify(settings).replace(/</g, "\\u003c");
    const safeScripts = renderer.scripts
        .map((script) => script.replace(/<\/script/gi, "<\\/script"))
        .join("\n;\n");
    const bridge = `<script>
        (() => {
            const handlers = Object.create(null);
            const sendImage = (image) => {
                if (typeof image === 'string' && image.startsWith('data:image/')) {
                    parent.postMessage({ source: 'streamdeck-plugin-preview', image }, '*');
                }
            };
            // A live renderer may redraw several times a second. Its debug logs
            // are not editor errors and would otherwise flood the host console.
            const quietConsole = { log() {}, info() {}, warn() {}, error() {}, debug() {}, trace() {}, group() {}, groupEnd() {} };
            try { Object.defineProperty(window, 'console', { configurable: true, value: quietConsole }); } catch {}
            window.onerror = () => true;
            window.addEventListener('unhandledrejection', event => event.preventDefault());
            class EditorSocket {
                static OPEN = 1;
                readyState = 1;
                constructor() { Promise.resolve().then(() => this.onopen && this.onopen()); }
                send() {}
                close() { this.readyState = 3; }
            }
            window.WebSocket = EditorSocket;
            const api = {
                setImage: (_context, image) => sendImage(image),
                setFeedback: (_context, feedback) => sendImage(feedback && (feedback.icon || feedback.image)),
                setTitle() {}, setSettings() {}, getSettings() {}, sendToPropertyInspector() {}
            };
            const streamDeckBridge = {
                on: (event, callback) => { (handlers[event] ||= []).push(callback); },
                emit: (event, payload) => (handlers[event] || []).forEach(callback => callback(payload)),
                connect: () => {}, logger: { info() {}, warn() {}, error() {} }
            };
            Object.defineProperty(streamDeckBridge, 'api', {
                configurable: false,
                get: () => api,
                set: () => {}
            });
            // Older SDK helpers assign a complete host object to window.$SD.
            // Keep their useful utility code, but preserve our isolated API bridge.
            Object.defineProperty(window, '$SD', {
                configurable: false,
                get: () => streamDeckBridge,
                set: () => {}
            });
            window.connectElgatoStreamDeckSocket = () => {};
            window.__streamdeckEditorSchedule = callback => Promise.resolve().then(callback);
            window.__streamdeckEditorPreview = { handlers, settings: ${safeSettings} };
        })();
    <\/script><script>${safeScripts}<\/script><script>
        (() => {
            const preview = window.__streamdeckEditorPreview;
            const payload = { settings: preview.settings, coordinates: { column: 0, row: 0 }, controller: 'Key' };
            const message = { context: 'streamdeck-editor-preview', payload };
            const dispatch = () => {
                // Some plugins register their action handlers only after their
                // connection callback, so emulate that lifecycle first.
                (preview.handlers.connected || []).forEach(callback => {
                    try { callback({}); } catch {}
                });
                Object.entries(preview.handlers).forEach(([event, callbacks]) => {
                    if (/willAppear$/i.test(event) || /didReceiveSettings$/i.test(event)) {
                        callbacks.forEach(callback => { try { callback(message); } catch {} });
                    }
                });
            };
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.__streamdeckEditorSchedule(dispatch));
            else window.__streamdeckEditorSchedule(dispatch);
        })();
    <\/script>`;
    return markup.includes("</body>")
        ? markup.replace("</body>", `${bridge}</body>`)
        : `${markup}${bridge}`;
}

export default function PluginLivePreview({ renderer, settings, onImage }: Props) {
    const frame = useRef<HTMLIFrameElement>(null);
    const srcDoc = useMemo(
        () => runtimeDocument(renderer, settings),
        [renderer, settings],
    );

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (event.source !== frame.current?.contentWindow) return;
            if (event.data?.source === "streamdeck-plugin-preview") onImage(event.data.image);
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
    }, [onImage]);

    return <iframe ref={frame} className="plugin-live-preview" sandbox="allow-scripts" srcDoc={srcDoc} title="Plugin preview" />;
}
