import {
    readInstalledPlugins,
    type ImportedPlugin,
    type PluginSourceFile,
} from "./pluginDirectoryDecoder";

// Keep these imports lazy. Eagerly importing every built-in image makes Vite put
// the whole library on the application's initial execution path, leaving a blank
// page while the browser parses it.
const manifestResources = import.meta.glob("../builtinPlugins/**/*.sdPlugin/manifest.json", {
    query: "?raw",
    import: "default",
}) as Record<string, () => Promise<string>>;

const binaryResources = import.meta.glob(
    "../builtinPlugins/**/*.{png,svg,gif,jpg,jpeg,webp}",
    { query: "?url", import: "default" },
) as Record<string, () => Promise<string>>;

function relativePath(modulePath: string) {
    return modulePath.replace(/^\.\.\/builtinPlugins\//, "");
}

function sourceFile(contents: BlobPart, path: string, type?: string) {
    // Blob URLs need an image MIME type. Without retaining it, SVG files in
    // particular are treated as arbitrary binary data and browsers show their
    // broken-image placeholder instead of the bundled Stream Deck artwork.
    const resolvedType = type || (contents instanceof Blob ? contents.type : "");
    const file = new File([contents], path.split("/").at(-1) || path, {
        type: resolvedType,
    }) as PluginSourceFile;
    Object.defineProperty(file, "streamdeckRelativePath", { value: path });
    return file;
}

/** Built-in plugins are bundled locally so browser users need not expose Program Files. */
export async function readBuiltInPlugins(): Promise<ImportedPlugin[]> {
    const textFiles = await Promise.all(
        Object.entries(manifestResources).map(async ([path, load]) =>
            sourceFile(await load(), relativePath(path), "application/json"),
        ),
    );

    // Do not let one malformed or unavailable bundled asset discard the whole
    // built-in library. The remaining action images still work as expected.
    const loadedAssets = await Promise.allSettled(
        Object.entries(binaryResources).map(async ([path, load]) => {
            const url = await load();
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Unable to read ${path}`);
            return sourceFile(await response.blob(), relativePath(path));
        }),
    );
    const binaryFiles = loadedAssets.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
    );
    return readInstalledPlugins([...textFiles, ...binaryFiles]);
}
