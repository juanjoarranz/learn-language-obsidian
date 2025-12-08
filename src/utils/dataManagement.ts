import { App } from "obsidian";

const DATABASE_URI = ".obsidian/plugins/learn-language/src/";

/**
 * Saves a JSON file to the specified file path within the vault.
 * Uses app.vault.adapter to access files in .obsidian folder.
 *
 * @param app - The Obsidian App instance
 * @param filePath - The relative file path (within the database URI) where the JSON file should be saved
 * @param data - The JSON data to save in the file
 * @param compacted - Whether to save the JSON data in a compact format (no indentation). Defaults to false
 * @returns A promise that resolves when the file is successfully created or modified
 */
export async function saveJsonFile<T>(
	app: App,
	filePath: string,
	data: T,
	compacted = false
): Promise<void> {
	const fullPath = `${DATABASE_URI}${filePath}`;
	const content = JSON.stringify(data, null, compacted ? 0 : 2);

	await app.vault.adapter.write(fullPath, content);
}

/**
 * Retrieves data from a JSON file within the vault.
 * Uses app.vault.adapter to access files in .obsidian folder.
 *
 * This function reads the contents of a JSON file at the specified file path.
 * If the file does not exist, it returns null.
 * If the file is empty, it returns null. Otherwise, it parses and returns the
 * JSON data from the file.
 *
 * @param app - The Obsidian App instance
 * @param filePath - The relative file path (within the database URI) to the JSON file
 * @returns A promise that resolves to the parsed JSON data from the file, or null if the file is empty or doesn't exist
 */
export async function getDataFromJsonFile<T>(
	app: App,
	filePath: string
): Promise<T | null> {
	const fullPath = `${DATABASE_URI}${filePath}`;

	// Check if file exists using adapter
	const exists = await app.vault.adapter.exists(fullPath);
	if (!exists) {
		console.log(`File not found at ${fullPath}`);
		return null;
	}

	// Read file using adapter
	const jsonString = await app.vault.adapter.read(fullPath);

	if (!jsonString || jsonString.trim() === "") {
		return null;
	}

	try {
		return JSON.parse(jsonString) as T;
	} catch (error) {
		console.error(`Error parsing JSON from ${fullPath}:`, error);
		return null;
	}
}
