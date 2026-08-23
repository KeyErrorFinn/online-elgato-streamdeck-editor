export type GridSize = {
	rows: number;
	columns: number;
};

export type Device = GridSize & {
	id: string;
	label: string;
	shortLabel: string;
};

export const devices: Device[] = [
	{
		id: "mini",
		label: "Stream Deck Mini",
		shortLabel: "Mini",
		rows: 2,
		columns: 3,
	},
	{
		id: "neo",
		label: "Stream Deck Neo / +",
		shortLabel: "Neo / +",
		rows: 2,
		columns: 4,
	},
	{
		id: "classic",
		label: "Stream Deck Classic / MK.2",
		shortLabel: "Classic",
		rows: 3,
		columns: 5,
	},
	{
		id: "xl",
		label: "Stream Deck XL",
		shortLabel: "XL",
		rows: 4,
		columns: 8,
	},
	{
		id: "plus-xl",
		label: "Stream Deck + XL",
		shortLabel: "+ XL",
		rows: 4,
		columns: 9,
	},
];

export const parentFolderActionId =
	"com.elgato.streamdeck.profile.backtoparent";
export const installedPluginsPath = "%APPDATA%\\Elgato\\StreamDeck\\Plugins";

export function gridLabel({ rows, columns }: GridSize) {
	return `${rows} × ${columns}`;
}

export function getGridBounds(actions: Record<string, unknown>): GridSize {
	return Object.keys(actions).reduce<GridSize>(
		(size, key) => {
			const [column, row] = key.split(",").map(Number);
			return {
				rows: Number.isFinite(row)
					? Math.max(size.rows, row + 1)
					: size.rows,
				columns: Number.isFinite(column)
					? Math.max(size.columns, column + 1)
					: size.columns,
			};
		},
		{ rows: 1, columns: 1 },
	);
}

export function imageUrlFor(
	path: string | undefined,
	urls: Record<string, string> | null,
) {
	if (!path || !urls) return undefined;
	if (urls[path]) return urls[path];

	const basename = path.split("/").pop();
	if (basename && urls[basename]) return urls[basename];

	return Object.entries(urls).find(([entry]) => entry.endsWith(path))?.[1];
}

export function getKeypadActions(page: any): Record<string, any> {
	return (
		page?.Controllers?.find(
			(controller: any) => controller?.Type === "Keypad",
		)?.Actions || {}
	);
}

export function getKeypadController(page: any) {
	return page?.Controllers?.find(
		(controller: any) => controller?.Type === "Keypad",
	);
}
