import { defineConfig } from "vite";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const publicDirectory = resolve(import.meta.dirname, "public");
const streamDeckActionFile = readdirSync(publicDirectory, { withFileTypes: true })
	.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".streamdeckaction"))
	?.name;

// https://vite.dev/config/
export default defineConfig({
	define: {
		__PUBLIC_STREAMDECK_ACTION__: JSON.stringify(streamDeckActionFile ?? null),
	},
	plugins: [
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler"]],
			},
		}),
		tailwindcss(),
	],
});
