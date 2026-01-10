import { DictionaryEntry, LearnLanguageSettings } from "../types";

export type CsvSeparator = "|" | ";";

export interface ExportableField {
	id: string;
	label: string;
}

export function getDictionaryExportFields(settings: LearnLanguageSettings): ExportableField[] {
	const targetId = settings.targetLanguage || "Target";
	const sourceId = settings.sourceLanguage || "Source";

	return [
	{ id: targetId, label: targetId },
	{ id: sourceId, label: sourceId },
	{ id: "type", label: "Type" },
	{ id: "context", label: "Context" },
	{ id: "revision", label: "Revision" },
	{ id: "rating", label: "Rating" },
	{ id: "examples", label: "Examples" },
	];
}

function shouldQuote(value: string, separator: CsvSeparator): boolean {
	return value.includes("\n") || value.includes("\r") || value.includes("\"") || value.includes(separator);
}

export function escapeCsv(value: string, separator: CsvSeparator): string {
	const normalized = value ?? "";
	const escapedQuotes = normalized.replace(/\"/g, '""');
	if (!shouldQuote(escapedQuotes, separator)) return escapedQuotes;
	return `"${escapedQuotes}"`;
}

function stripHtmlItalics(input: string): string {
	return input.replace(/<\/?(?:em|i)\b[^>]*>/gi, "");
}

function stripMarkdownItalics(input: string): string {
	let output = input;
	// *text* -> text (single-line)
	output = output.replace(/\*([^*\n]+)\*/g, "$1");
	// _text_ -> text, avoid underscores inside words
	output = output.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, "$1$2");
	return output;
}

export function normalizeExamplesForCsv(input?: string): string {
	if (!input) return "";
	const withNewlines = input.replace(/<br\s*\/?>/gi, " ; ");
	const noHtmlItalics = stripHtmlItalics(withNewlines);
	return stripMarkdownItalics(noHtmlItalics);
}

export function getFieldValue(
	entry: DictionaryEntry,
	fieldId: string,
	normalizeExamples: boolean,
	settings: LearnLanguageSettings
): string {
	if (fieldId === (settings.targetLanguage || "")) {
		return entry.targetWord || "";
	}
	if (fieldId === (settings.sourceLanguage || "")) {
		return entry.sourceWord || "";
	}

	switch (fieldId) {
		case "type":
			return entry.type || "";
		case "context":
			return entry.context || "";
		case "revision":
			return entry.revision || "";
		case "rating":
			return entry.rating || "";
		case "examples":
			return normalizeExamples ? normalizeExamplesForCsv(entry.examples) : (entry.examples || "");
		default:
			return "";
	}
}

export function entriesToCsv(
	entries: DictionaryEntry[],
	fields: string[],
	separator: CsvSeparator,
	settings: LearnLanguageSettings
): string {
	const header = fields.map(f => escapeCsv(f, separator)).join(separator);
	const normalizeExamples = fields.includes("examples");

	const rows = entries.map(entry => {
		return fields
			.map(fieldId => escapeCsv(getFieldValue(entry, fieldId, normalizeExamples, settings), separator))
			.join(separator);
	});

	return [header, ...rows].join("\n");
}
