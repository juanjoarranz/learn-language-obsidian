import React from "react";
import { App, Modal, Notice } from "obsidian";
import { createReactRoot, ReactMountPoint } from "../utils/reactMount";
import type { LearnLanguageSettings, DictionaryEntry } from "../types";
import type { FilterService, DictionaryService } from "../services";
import { entriesToCsv, getDictionaryExportFields } from "../utils/csv";
import { pickFolderPath, joinPathAbsolute, writeTextFileAbsolute } from "../utils/folderPicker";
import { ExportCsvModalContent, ExportCsvModalResult } from "../components/modals/ExportCsvModalContent";

export interface ExportCsvModalDeps {
	settings: LearnLanguageSettings;
	filterService: FilterService;
	dictionaryService: DictionaryService;
}

export interface ExportCsvModalData {
	filteredEntries: DictionaryEntry[];
	pageSize: number;
}

function uniqueSortedPages(pages: number[]): number[] {
	return Array.from(new Set(pages)).filter(n => n > 0).sort((a, b) => a - b);
}

function sliceByPages(filteredEntries: DictionaryEntry[], pageSize: number, pages: number[]): DictionaryEntry[] {
	const out: DictionaryEntry[] = [];
	for (const page of pages) {
		const start = (page - 1) * pageSize;
		const end = start + pageSize;
		out.push(...filteredEntries.slice(start, end));
	}
	return out;
}

export class ExportCsvModal extends Modal {
	private reactMount: ReactMountPoint | null = null;
	private deps: ExportCsvModalDeps;
	private data: ExportCsvModalData;
	private isSubmitting = false;

	constructor(app: App, deps: ExportCsvModalDeps, data: ExportCsvModalData) {
		super(app);
		this.deps = deps;
		this.data = data;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ll-term-modal");

		const totalPages = Math.max(1, Math.ceil((this.data.filteredEntries.length || 0) / (this.data.pageSize || 1)));
		const defaultFileName = "dictionary-export.txt";
		const exportFields = getDictionaryExportFields(this.deps.settings);

		const handleOk = async (result: ExportCsvModalResult) => {
			if (this.isSubmitting) return;
			this.isSubmitting = true;

			try {
				const { filteredEntries, pageSize } = this.data;
				const pages = uniqueSortedPages(result.selectedPages);

				const entriesToExport = result.exportAllPages
					? filteredEntries
					: sliceByPages(filteredEntries, pageSize, pages);

				const csv = entriesToCsv(entriesToExport, result.selectedFields, result.separator, this.deps.settings);
				const fullPath = joinPathAbsolute(result.folderPath, result.fileName);

				await writeTextFileAbsolute(fullPath, csv);
				new Notice(`Exported ${entriesToExport.length} rows to ${fullPath}`);
				this.close();
			} catch (e: any) {
				console.error("ExportCsvModal: export failed", e);
				new Notice("Export failed. Check console for details.");
			} finally {
				this.isSubmitting = false;
			}
		};

		// Mount React content (re-using plugin context)
		this.reactMount = createReactRoot(
			contentEl,
			this.app,
			this.deps.settings,
			this.deps.filterService,
			this.deps.dictionaryService
		);

		this.reactMount.render(
			<ExportCsvModalContent
				exportFields={exportFields}
				totalPages={totalPages}
				defaultFileName={defaultFileName}
				defaultSeparator="|"
				defaultExportAllPages={true}
				isSubmitting={false}
				onBrowseFolder={() => pickFolderPath()}
				onCancel={() => this.close()}
				onOk={handleOk}
			/>
		);
	}

	onClose(): void {
		if (this.reactMount) {
			this.reactMount.unmount();
			this.reactMount = null;
		}
		this.contentEl.empty();
	}
}
