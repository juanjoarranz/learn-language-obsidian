import { App, TFile } from "obsidian";
import {
	DictionaryEntry,
	FilterState,
	LearnLanguageSettings,
	getLocaleCode
} from "../types";

/**
 * FilterService - Handles filtering and pagination logic
 * Replaces filterFunction() and paginatedEntries() from liveFiltering/view.js
 */
export class FilterService {
	private app: App;
	private settings: LearnLanguageSettings;

	constructor(app: App, settings: LearnLanguageSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: LearnLanguageSettings): void {
		this.settings = settings;
	}

	/**
	 * Apply a single filter to entries
	 */
	filterByProperty<T>(
		entries: T[],
		property: keyof T,
		filterValue: string | null | undefined
	): T[] {
		if (!filterValue || filterValue === "all") {
			return entries;
		}

		return entries.filter(entry => {
			const value = entry[property];
			if (!value) return false;

			const valueStr = String(value);

			// Check if value contains the filter (for tags/compound values)
			return valueStr.toLowerCase().includes(filterValue.toLowerCase());
		});
	}

	/**
	 * Apply multiple filters to entries
	 */
	applyFilters<T extends DictionaryEntry>(
		entries: T[],
		filters: Partial<FilterState>
	): T[] {
		let result = [...entries];

		if (filters.targetWord && filters.targetWord !== "all") {
			result = result.filter(e => e.targetWord.toLowerCase().includes(filters.targetWord!.toLowerCase()));
		}

		if (filters.sourceWord && filters.sourceWord !== "all") {
			result = result.filter(e => e.sourceWord.toLowerCase().includes(filters.sourceWord!.toLowerCase()));
		}

		if (filters.type && filters.type !== "all") {
			result = result.filter(e => e.type.toLowerCase().includes(filters.type!.toLowerCase()));
		}

		if (filters.context && filters.context !== "all") {
			result = result.filter(e => e.context.toLowerCase().includes(filters.context!.toLowerCase()));
		}

		if (filters.revision && filters.revision !== "all") {
			result = result.filter(e => e.revision === filters.revision);
		}

		if (filters.rating && filters.rating !== "all") {
			result = result.filter(e => e.rating === filters.rating);
		}

		// Verb-specific filters (cast to access additional properties)
		const verbFilters = filters as Partial<FilterState> & { group?: string; irregular?: string };
		if (verbFilters.group && verbFilters.group !== "all") {
			result = result.filter(e => (e as unknown as { Group: string }).Group === verbFilters.group);
		}

		if (verbFilters.irregular && verbFilters.irregular !== "all") {
			result = result.filter(e => {
				const irregular = (e as unknown as { Irregular: string }).Irregular;
				return irregular === verbFilters.irregular ||
					(verbFilters.irregular === "i1" && irregular.startsWith("i"));
			});
		}

		return result;
	}

	/**
	 * Paginate entries
	 */
	paginate<T>(entries: T[], start: number, size: number): T[] {
		return entries.slice(start, start + size);
	}

	/**
	 * Extract unique filter values from entries
	 */
	getUniqueValues<T>(
		entries: T[],
		property: keyof T | string
	): string[] {
		const values = new Set<string>();

		entries.forEach(entry => {
			const value = (entry as Record<string, unknown>)[property as string];
			if (value === null || value === undefined) return;

			const valueStr = String(value);

			// Handle compound values (comma-separated)
			if (valueStr.includes(",")) {
				valueStr.split(",").forEach(v => {
					const trimmed = v.trim();
					if (trimmed) {
						// Expand tags hierarchy
						if (trimmed.startsWith("#")) {
							this.generateTagArray(trimmed).forEach(tag => values.add(tag));
						} else {
							values.add(trimmed);
						}
					}
				});
			} else if (valueStr.trim()) {
				// Expand tags hierarchy
				if (valueStr.startsWith("#")) {
					this.generateTagArray(valueStr.trim()).forEach(tag => values.add(tag));
				} else {
					values.add(valueStr.trim());
				}
			}
		});

		// Sort using target language locale
		const locale = getLocaleCode(this.settings.targetLanguage);
		const sorted = Array.from(values).sort((a, b) => a.localeCompare(b, locale));

		// Add "all" option at the beginning
		return ["all", ...sorted];
	}

	/**
	 * Generate progressive tag array from compound tag
	 * e.g., "#parent/child/grandchild" -> ["#parent", "#parent/child", "#parent/child/grandchild"]
	 */
	generateTagArray(compoundTag: string): string[] {
		const parts = compoundTag.split("/");
		let accumulated = "";

		return parts.map((part, index) => {
			accumulated += (index === 0 ? part : "/" + part);
			return accumulated;
		});
	}

	/**
	 * Parse markdown links to extract display text
	 * e.g., "[text](url)" -> "text"
	 */
	parseMarkdownLink(value: string): string {
		const match = value.match(/\[(.+)\]\([^)]+\)/);
		return match ? match[1] : value;
	}

	/**
	 * Store filter value in file frontmatter
	 */
	async storeFilterValue(filePath: string, filterName: string, value: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm[`filter-${filterName}`] = value;
		});
	}

	/**
	 * Store pagination value in file frontmatter
	 */
	async storePaginationValue(filePath: string, key: string, value: number): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm[key] = value;
		});
	}

	/**
	 * Toggle study mode
	 */
	async toggleStudyMode(filePath: string, mode: "yes" | "no" | "spanish"): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm["filter-Study"] = mode;

			// Manage CSS classes for study mode
			const cssclasses = (fm.cssclasses as string[]) || [];
			const stickyIndex = cssclasses.indexOf("ja-sticky-header");

			if (mode !== "no" && mode !== undefined) {
				// Remove sticky header in study mode
				if (stickyIndex !== -1) {
					cssclasses.splice(stickyIndex, 1);
				}
			} else {
				// Add sticky header when not studying
				if (stickyIndex === -1) {
					cssclasses.push("ja-sticky-header");
				}
			}

			fm.cssclasses = cssclasses;
		});
	}
}
