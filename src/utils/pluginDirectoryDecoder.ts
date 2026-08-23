export type ImportedPluginState = {
	definition: Record<string, any>;
	imageFile?: File;
	imageUrl?: string;
};

export type ImportedPluginAction = {
	id: string;
	name: string;
	uuid: string;
	visibleInActionsList: boolean;
	pluginName: string;
	pluginUuid: string;
	pluginVersion: string;
	iconUrl?: string;
	iconFile?: File;
	states: ImportedPluginState[];
	propertyInspector?: {
		html: string;
		styles: string[];
		scripts: string[];
	};
	/** A browser-compatible plugin entry point. Native/Node entry points are omitted. */
	renderer?: {
		html: string;
		scripts: string[];
	};
};

export type ImportedPlugin = {
	uuid: string;
	name: string;
	author?: string;
	iconUrl?: string;
	iconFile?: File;
	actions: ImportedPluginAction[];
};

export type PluginSourceFile = File & { streamdeckRelativePath?: string };

export function pluginFilePath(file: PluginSourceFile) {
	return file.streamdeckRelativePath || file.webkitRelativePath || file.name;
}

const assetExtensions = [
	"",
	".png",
	"@2x.png",
	".svg",
	".gif",
	".jpg",
	".jpeg",
	".webp",
];

function normalized(path: string) {
	return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function findAsset(
	files: Map<string, File>,
	pluginFolder: string,
	assetPath?: string,
) {
	if (!assetPath) return undefined;
	const cleanAssetPath = normalized(assetPath);
	for (const suffix of assetExtensions) {
		const match = files.get(
			`${pluginFolder}${cleanAssetPath}${suffix}`.toLowerCase(),
		);
		if (match) return match;
	}
	return undefined;
}

function findFile(files: Map<string, File>, pluginFolder: string, path?: string) {
	if (!path) return undefined;
	return files.get(`${pluginFolder}${normalized(path)}`.toLowerCase());
}

function relativeTo(filePath: string, target: string) {
	const directory = filePath.split("/").slice(0, -1).join("/");
	return new URL(target, `https://plugin.local/${directory}/`).pathname.slice(1);
}

async function readPropertyInspector(
	files: Map<string, File>,
	pluginFolder: string,
	propertyInspectorPath?: string,
) {
	const inspectorFile = findFile(files, pluginFolder, propertyInspectorPath);
	if (!inspectorFile || !propertyInspectorPath) return undefined;
	const html = await inspectorFile.text();
	const styles = await Promise.all(
		[...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)]
			.map((match) =>
				findFile(
					files,
					pluginFolder,
					relativeTo(propertyInspectorPath, match[1]),
				),
			)
			.filter((file): file is File => !!file)
			.map((file) => file.text()),
	);
	const inlineScripts = [
		...html.matchAll(/<script(?![^>]+src=)[^>]*>([\s\S]*?)<\/script>/gi),
	].map((match) => Promise.resolve(match[1]));
	const externalScripts = [
		...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi),
	]
		.map((match) =>
			findFile(files, pluginFolder, relativeTo(propertyInspectorPath, match[1])),
		)
		.filter((file): file is File => !!file)
		.map((file) => file.text());
	return {
		html,
		styles,
		scripts: await Promise.all([...inlineScripts, ...externalScripts]),
	};
}

async function readPluginRenderer(
	files: Map<string, File>,
	pluginFolder: string,
	codePath?: string,
) {
	// Only HTML runtimes can safely run in the isolated browser preview. A plugin
	// with a native executable or Node entry point simply keeps its static image.
	if (!codePath || !/\.html?$/i.test(codePath)) return undefined;
	const runtimeFile = findFile(files, pluginFolder, codePath);
	if (!runtimeFile) return undefined;
	const html = await runtimeFile.text();
	const scripts: string[] = [];
	for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
		const src = match[1].match(/\bsrc=["']([^"']+)["']/i)?.[1];
		if (src) {
			const file = findFile(files, pluginFolder, relativeTo(codePath, src));
			if (file) scripts.push(await file.text());
		} else if (match[2].trim()) {
			scripts.push(match[2]);
		}
	}
	return { html, scripts };
}

export async function readInstalledPlugins(fileList: FileList | PluginSourceFile[]) {
	const files = Array.from(fileList) as PluginSourceFile[];
	const filesByPath = new Map<string, PluginSourceFile>();
	for (const file of files) {
		const path = normalized(pluginFilePath(file));
		filesByPath.set(path.toLowerCase(), file);
	}

	const plugins: ImportedPlugin[] = [];
	const handledPluginFolders = new Set<string>();
	for (const [lowerPath, manifestFile] of filesByPath) {
		if (!/\.sdplugin\/manifest\.json$/i.test(lowerPath)) continue;
		try {
			const manifest = JSON.parse(await manifestFile.text());
			const originalPath = normalized(
				pluginFilePath(manifestFile),
			);
			const pluginFolder = originalPath.slice(0, -"manifest.json".length);
			const pluginIcon = findAsset(
				filesByPath,
				pluginFolder,
				manifest.Icon,
			);
			const renderer = await readPluginRenderer(
				filesByPath,
				pluginFolder,
				manifest.CodePath,
			);
			const actions: ImportedPluginAction[] = await Promise.all((manifest.Actions || [])
				.filter((action: any) => action?.UUID)
				.map(async (action: any) => {
					const states: ImportedPluginState[] = (
						action.States || []
					).map((state: any) => {
						const imageFile = findAsset(
							filesByPath,
							pluginFolder,
							state?.Image,
						);
						return {
							definition: state,
							imageFile,
							imageUrl: imageFile
								? URL.createObjectURL(imageFile)
								: undefined,
						};
					});
					const iconFile =
						findAsset(filesByPath, pluginFolder, action.Icon) ||
						states[0]?.imageFile;
					const propertyInspectorPath =
						action.PropertyInspectorPath || manifest.PropertyInspectorPath;
					const propertyInspector = await readPropertyInspector(
						filesByPath,
						pluginFolder,
						propertyInspectorPath,
					);
					return {
						id: `${manifest.UUID}:${action.UUID}`,
						name: action.Name || action.UUID,
						uuid: action.UUID,
						visibleInActionsList:
							action.VisibleInActionsList !== false,
						pluginName: manifest.Name || manifest.UUID,
						pluginUuid: manifest.UUID,
						pluginVersion: manifest.Version || "1.0.0.0",
						iconUrl: iconFile
							? URL.createObjectURL(iconFile)
							: undefined,
						iconFile,
						states,
						propertyInspector,
						renderer,
					};
				}));
			plugins.push({
				uuid: manifest.UUID || pluginFolder,
				name: manifest.Name || manifest.UUID || "Unnamed plugin",
				author: manifest.Author,
				iconUrl: pluginIcon
					? URL.createObjectURL(pluginIcon)
					: undefined,
				iconFile: pluginIcon,
				actions,
			});
			handledPluginFolders.add(pluginFolder.toLowerCase());
		} catch {
			// Ignore malformed or incompatible plugin manifests and continue.
		}
	}

	const pluginFolders = new Set<string>();
	for (const path of filesByPath.keys()) {
		const match = path.match(/^(.*?\.sdplugin\/)/i);
		if (match) pluginFolders.add(match[1]);
	}
	for (const pluginFolder of pluginFolders) {
		if (handledPluginFolders.has(pluginFolder)) continue;
		const inspectorEntry = [...filesByPath.entries()].find(
			([path]) =>
				path.startsWith(pluginFolder) &&
				/(propertyinspector|pluginactionpi)\.html$/i.test(path),
		);
		if (!inspectorEntry) continue;
		const inspectorPath = inspectorEntry[0].slice(pluginFolder.length);
		const propertyInspector = await readPropertyInspector(
			filesByPath,
			pluginFolder,
			inspectorPath,
		);
		if (!propertyInspector) continue;
		const pluginUuid = pluginFolder
			.slice(0, -1)
			.split("/")
			.at(-1)
			?.replace(/\.sdplugin$/i, "");
		if (!pluginUuid) continue;
		const iconFile =
			findAsset(filesByPath, pluginFolder, "imgs/pluginAction") ||
			findAsset(filesByPath, pluginFolder, "imgs/icon");
		plugins.push({
			uuid: pluginUuid,
			name: pluginUuid,
			iconFile,
			actions: [
				{
					id: `${pluginUuid}:fallback-inspector`,
					name: "Plugin action",
					uuid: pluginUuid,
					visibleInActionsList: false,
					pluginName: pluginUuid,
					pluginUuid,
					pluginVersion: "",
					iconUrl: iconFile ? URL.createObjectURL(iconFile) : undefined,
					iconFile,
					states: [],
					propertyInspector,
				},
			],
		});
	}
	return plugins.sort((a, b) => a.name.localeCompare(b.name));
}
