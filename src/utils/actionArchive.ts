import { strToU8, unzipSync, zipSync } from "fflate";

export function downloadEditedAction(
	archiveData: ArrayBuffer,
	editedPages: Record<string, any>,
	addedAssets: Record<string, Record<string, Uint8Array>>,
	sourceFilename: string | null,
) {
	const entries = unzipSync(new Uint8Array(archiveData));

	for (const path of Object.keys(entries)) {
		if (!path.endsWith("/manifest.json")) continue;

		try {
			const page = JSON.parse(new TextDecoder().decode(entries[path]));
			if (page.$uuid && editedPages[page.$uuid]) {
				entries[path] = strToU8(
					JSON.stringify(editedPages[page.$uuid], null, 2),
				);
			}

			if (page.$uuid && addedAssets[page.$uuid]) {
				const pageFolder = path.slice(0, -"manifest.json".length);
				for (const [filename, bytes] of Object.entries(
					addedAssets[page.$uuid],
				)) {
					entries[`${pageFolder}Images/${filename}`] = bytes;
				}
			}
		} catch {
			// Non-page manifests are left untouched.
		}
	}

	const zipBytes = new Uint8Array(zipSync(entries));
	const blob = new Blob([zipBytes.buffer], {
		type: "application/octet-stream",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download =
		sourceFilename?.replace(
			/\.streamdeckaction$/i,
			" (edited).streamDeckAction",
		) || "edited.streamDeckAction";
	link.click();
	URL.revokeObjectURL(url);
}
