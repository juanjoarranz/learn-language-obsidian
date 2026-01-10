import { Notice } from "obsidian";

function getDesktopRequire(): ((moduleName: string) => any) | null {
	const w = window as any;
	return typeof w?.require === "function" ? w.require : null;
}

export async function pickFolderPath(): Promise<string | null> {
	const req = getDesktopRequire();
	if (!req) {
		new Notice("Folder picker is only available on desktop.");
		return null;
	}

	let electron: any;
	try {
		electron = req("electron");
	} catch (e) {
		new Notice("Folder picker is not available in this environment.");
		return null;
	}

	const dialog = electron?.remote?.dialog ?? electron?.dialog;
	if (!dialog?.showOpenDialog) {
		new Notice("Folder picker dialog is not available.");
		return null;
	}

	const result = await dialog.showOpenDialog({
		properties: ["openDirectory"]
	});

	if (result?.canceled) return null;
	const folder = result?.filePaths?.[0];
	return typeof folder === "string" && folder.length > 0 ? folder : null;
}

export async function writeTextFileAbsolute(fullPath: string, content: string): Promise<void> {
	const req = getDesktopRequire();
	if (!req) {
		throw new Error("Writing files is only available on desktop.");
	}

	const fs = req("fs");
	if (!fs?.promises?.writeFile) {
		throw new Error("fs.writeFile is not available in this environment.");
	}

	await fs.promises.writeFile(fullPath, content, "utf8");
}

export function joinPathAbsolute(folderPath: string, fileName: string): string {
	const req = getDesktopRequire();
	if (!req) {
		// Fallback; should not be used in desktop export flow
		return folderPath.replace(/[\\/]+$/, "") + "/" + fileName;
	}
	const path = req("path");
	return path.join(folderPath, fileName);
}
