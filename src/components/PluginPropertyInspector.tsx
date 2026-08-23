import { useEffect, useMemo, useRef } from "react";

type Inspector = {
    html: string;
    styles: string[];
    scripts: string[];
};

type Props = {
    inspector: Inspector;
    settings: Record<string, any>;
    onSettingChange: (key: string, value: unknown, isPath?: boolean) => void;
};

function documentFor(inspector: Inspector, settings: Record<string, any>) {
    const pluginMarkup = inspector.html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<link\b[^>]*>/gi, "")
        .replace(/\son\w+=["'][^"']*["']/gi, "");
    const bridge = `<style>${inspector.styles.join("\n")}</style>
        <style>
            body { margin: 0; background: transparent; color: inherit; }
            .sdpi-wrapper, .sdpi-wrapper.hidden { display: block !important; max-width: none; padding: 0; }
            .response-only, .server-only, #dialSection { display: none !important; }
        </style>
        <script>
            const settings = ${JSON.stringify(settings).replace(/</g, "\\u003c")};
            function valueAtPath(object, path) {
                return path.split('.').reduce((value, key) => value == null ? undefined : value[key], object);
            }
            function settingFor(field) {
                return field.dataset.setting || field.id;
            }
            function hydrate() {
                document.querySelectorAll('input[id], textarea[id], select[id]').forEach((field) => {
                    const key = settingFor(field);
                    const value = key in settings ? settings[key] : valueAtPath(settings, key);
                    if (value === undefined) return;
                    if (field.type === 'checkbox') {
                        field.checked = field.value.startsWith('!') ? !Boolean(value) : Boolean(value);
                    } else field.value = value ?? '';
                });
                document.querySelectorAll('input[type="number"][id]').forEach(updateStateSections);
            }
            function setupTabs() {
                const tabs = [...document.querySelectorAll('[data-target]')];
                if (!tabs.length) return;
                const selectTab = (tab) => {
                    tabs.forEach((item) => item.classList.toggle('selected', item === tab));
                    tabs.forEach((item) => {
                        const panel = document.querySelector(item.dataset.target);
                        if (panel) panel.style.display = item === tab ? '' : 'none';
                    });
                };
                tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab)));
                selectTab(tabs.find((tab) => tab.classList.contains('selected')) || tabs[0]);
            }
            function updateStateSections(field) {
                if (!/states/i.test(field.id)) return;
                const count = Math.max(1, Number(field.value) || 1);
                document.querySelectorAll('[id]').forEach((section) => {
                    const match = section.id.match(/^state(\\d+)$/i);
                    if (match) section.style.display = Number(match[1]) < count ? 'inline' : 'none';
                });
            }
            function send(event) {
                const field = event.target;
                if (!field.id) return;
                const key = settingFor(field);
                let value = field.type === 'checkbox' ? field.checked : field.value;
                if (field.type === 'checkbox' && field.value.startsWith('!')) value = !value;
                if (field.type === 'number' || field.type === 'range') {
                    const minimum = field.min === '' ? -Infinity : Number(field.min);
                    const maximum = field.max === '' ? Infinity : Number(field.max);
                    const parsed = Number(field.value);
                    value = Number.isFinite(parsed)
                        ? Math.min(maximum, Math.max(minimum, parsed))
                        : (Number.isFinite(minimum) ? minimum : 0);
                    field.value = String(value);
                }
                updateStateSections(field);
                parent.postMessage({ source: 'streamdeck-plugin-inspector', key,
                    value, isPath: Boolean(field.dataset.setting) }, '*');
            }
            document.addEventListener('DOMContentLoaded', () => {
                hydrate();
                setupTabs();
                document.addEventListener('input', send);
                document.addEventListener('change', send);
            });
        </script>`;
    return pluginMarkup.replace("</head>", `${bridge}</head>`);
}

export default function PluginPropertyInspector({
    inspector,
    settings,
    onSettingChange,
}: Props) {
    const frame = useRef<HTMLIFrameElement>(null);
    const srcDoc = useMemo(() => documentFor(inspector, settings), [inspector]);

    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (event.source !== frame.current?.contentWindow) return;
            const data = event.data;
            if (data?.source !== "streamdeck-plugin-inspector") return;
            if (data.settings && typeof data.settings === "object") {
                Object.entries(data.settings).forEach(([key, value]) =>
                    onSettingChange(key, value),
                );
            } else if (data.key) onSettingChange(data.key, data.value, data.isPath);
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
    }, [onSettingChange]);

    return (
        <iframe
            ref={frame}
            className="plugin-property-inspector"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            title="Plugin settings"
        />
    );
}
