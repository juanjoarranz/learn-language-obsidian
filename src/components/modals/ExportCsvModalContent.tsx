import React, { useCallback, useMemo, useState } from "react";
import { CsvSeparator, ExportableField } from "../../utils/csv";

export interface ExportCsvModalResult {
	exportAllPages: boolean;
	selectedPages: number[];
	fileName: string;
	folderPath: string;
	separator: CsvSeparator;
	selectedFields: string[];
}

export interface ExportCsvModalContentProps {
	exportFields: ExportableField[];
	totalPages: number;
	defaultFileName: string;
	defaultFolderPath?: string;
	defaultSeparator?: CsvSeparator;
	defaultExportAllPages?: boolean;
	defaultSelectedFields?: string[];
	isSubmitting?: boolean;
	onBrowseFolder: () => Promise<string | null>;
	onCancel: () => void;
	onOk: (result: ExportCsvModalResult) => Promise<void>;
}

function normalizeFileName(name: string): string {
	const trimmed = name.trim();
	if (trimmed.length === 0) return "";
	return trimmed.toLowerCase().endsWith(".txt") ? trimmed : `${trimmed}.txt`;
}

export function ExportCsvModalContent({
	exportFields,
	totalPages,
	defaultFileName,
	defaultFolderPath = "",
	defaultSeparator = "|",
	defaultExportAllPages = true,
	defaultSelectedFields,
	isSubmitting = false,
	onBrowseFolder,
	onCancel,
	onOk
}: ExportCsvModalContentProps) {
	const [exportAllPages, setExportAllPages] = useState(defaultExportAllPages);
	const [selectedPages, setSelectedPages] = useState<number[]>([]);
	const [fileName, setFileName] = useState(defaultFileName);
	const [folderPath, setFolderPath] = useState(defaultFolderPath);
	const [separator, setSeparator] = useState<CsvSeparator>(defaultSeparator);
	const [selectedFields, setSelectedFields] = useState<string[]>(
		defaultSelectedFields && defaultSelectedFields.length > 0
			? defaultSelectedFields
			: exportFields.map(f => f.id)
	);

	const pageOptions = useMemo(() => {
		return Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1);
	}, [totalPages]);

	const canSubmit = useMemo(() => {
		const normalizedName = normalizeFileName(fileName);
		if (!normalizedName) return false;
		if (!folderPath.trim()) return false;
		if (selectedFields.length === 0) return false;
		if (!exportAllPages && selectedPages.length === 0) return false;
		return true;
	}, [exportAllPages, fileName, folderPath, selectedFields.length, selectedPages.length]);

	const toggleField = useCallback((fieldId: string, checked: boolean) => {
		setSelectedFields(prev => {
			if (checked) {
				return prev.includes(fieldId) ? prev : [...prev, fieldId];
			}
			return prev.filter(id => id !== fieldId);
		});
	}, []);

	const handleBrowse = useCallback(async () => {
		const next = await onBrowseFolder();
		if (next) setFolderPath(next);
	}, [onBrowseFolder]);

	const handleOk = useCallback(async () => {
		await onOk({
			exportAllPages,
			selectedPages,
			fileName: normalizeFileName(fileName),
			folderPath: folderPath.trim(),
			separator,
			selectedFields
		});
	}, [exportAllPages, fileName, folderPath, onOk, selectedFields, selectedPages, separator]);

	return (
		<div className="ll-term-modal-content ll-export-csv-modal-content">
			<h2>Export Filtered Dictionary Entries </h2>

			<div className="ll-term-form">
				{/* Pages */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">Pages</div>
						<div className="setting-item-description">
							Select which pages of the filtered results to export.
						</div>
					</div>
					<div className="setting-item-control">
						<label className="ll-export-inline-row">
							<input
								type="checkbox"
								checked={exportAllPages}
								onChange={(e) => setExportAllPages(e.target.checked)}
								disabled={isSubmitting}
								aria-label="Export all pages"
							/>
							All pages
						</label>
						{!exportAllPages && (
							<select
								className="ll-export-pages-select"
								multiple
								value={selectedPages.map(String)}
								onChange={(e) => {
									const values = Array.from(e.target.selectedOptions).map(o => parseInt(o.value));
									setSelectedPages(values.filter(n => Number.isFinite(n)));
								}}
								disabled={isSubmitting}
								title="Select pages to export"
								aria-label="Select pages to export"
							>
								{pageOptions.map(p => (
									<option key={p} value={p}>{p}</option>
								))}
							</select>
						)}
					</div>
				</div>

				{/* File name */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">File name</div>
						<div className="setting-item-description">Name of the TXT file</div>
					</div>
					<div className="setting-item-control">
						<input
							type="text"
							title="File name"
							placeholder="dictionary-export.txt"
							value={fileName}
							onChange={(e) => setFileName(e.target.value)}
							disabled={isSubmitting}
						/>
					</div>
				</div>

				{/* Folder path */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">Folder</div>
						<div className="setting-item-description">Absolute folder path where the file will be saved</div>
					</div>
					<div className="setting-item-control ll-export-folder-control">
						<input
							type="text"
							title="Folder path"
							placeholder="C:\\path\\to\\folder"
							value={folderPath}
							onChange={(e) => setFolderPath(e.target.value)}
							disabled={isSubmitting}
							className="ll-export-folder-input"
						/>
						<button onClick={handleBrowse} disabled={isSubmitting}>
							Browse
						</button>
					</div>
				</div>

				{/* Separator */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">Separator</div>
						<div className="setting-item-description">Field separator character</div>
					</div>
					<div className="setting-item-control">
						<select
							value={separator}
							onChange={(e) => setSeparator(e.target.value as CsvSeparator)}
							disabled={isSubmitting}
							title="Separator"
							aria-label="Separator"
						>
							<option value="|">|</option>
							<option value=";">;</option>
						</select>
					</div>
				</div>

				{/* Fields */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">Fields</div>
						<div className="setting-item-description">Select which fields to export</div>
					</div>
					<div className="setting-item-control">
						<div className="ll-export-fields-grid">
							{exportFields.map(field => {
								const checked = selectedFields.includes(field.id);
								return (
									<label key={field.id} className="ll-export-inline-row">
										<input
											type="checkbox"
											checked={checked}
											onChange={(e) => toggleField(field.id, e.target.checked)}
											disabled={isSubmitting}
											aria-label={`Export field ${field.label}`}
										/>
										{field.label}
									</label>
								);
							})}
						</div>
					</div>
				</div>
			</div>

			<div className="ll-modal-buttons">
				<button onClick={onCancel} disabled={isSubmitting}>
					Cancel
				</button>
				<button
					className="mod-cta"
					onClick={handleOk}
					disabled={isSubmitting || !canSubmit}
				>
					{isSubmitting ? "..." : "Ok"}
				</button>
			</div>
		</div>
	);
}
