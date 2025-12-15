import { App, TFile, TFolder, CachedMetadata } from "obsidian";
import {
	DictionaryEntry,
	VerbEntry,
	GrammarPage,
	VerbGroup,
	LearnLanguageSettings,
	getLocaleCode
} from "../types";

/**
 * DictionaryService - Centralized data management for dictionary entries
 * Replaces getDictionary(), getVerbs(), getGrammarPages() from dvViews/dictionary.js
 */
export class DictionaryService {
	private app: App;
	private settings: LearnLanguageSettings;

	// Cache
	private dictionaryCache: DictionaryEntry[] | null = null;
	private verbsCache: VerbEntry[] | null = null;
	private grammarCache: GrammarPage[] | null = null;
	private cacheTimestamp: number = 0;
	private cacheTTL: number = 5000; // 5 seconds cache TTL

	constructor(app: App, settings: LearnLanguageSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Invalidate all caches - call this when files change
	 */
	invalidateCache(): void {
		this.dictionaryCache = null;
		this.verbsCache = null;
		this.grammarCache = null;
		this.cacheTimestamp = 0;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: LearnLanguageSettings): void {
		this.settings = settings;
		this.invalidateCache();
	}

	/**
	 * Check if cache is still valid
	 */
	private isCacheValid(): boolean {
		return Date.now() - this.cacheTimestamp < this.cacheTTL;
	}

	/**
	 * Get all dictionary entries from the dictionary folder
	 */
	async getDictionary(): Promise<DictionaryEntry[]> {
		if (this.dictionaryCache && this.isCacheValid()) {
			return this.dictionaryCache;
		}

		const entries: DictionaryEntry[] = [];
		const folder = this.app.vault.getAbstractFileByPath(this.settings.dictionaryFolder);

		if (!(folder instanceof TFolder)) {
			console.warn(`Dictionary folder not found: ${this.settings.dictionaryFolder}`);
			return entries;
		}

		const files = this.getMarkdownFilesRecursively(folder);

		for (const file of files) {
			// Skip templates and database files
			if (file.path.includes(this.settings.templatesFolder)) continue;
			if (file.path.includes("French Dictionary DB")) continue;

			const entry = await this.parseFileToEntry(file);
			if (entry) {
				entries.push(entry);
			}
		}

		// Sort by name ascending using target language locale
		const locale = getLocaleCode(this.settings.targetLanguage);
		entries.sort((a, b) => a.file.name.localeCompare(b.file.name, locale));
		this.dictionaryCache = entries;
		this.cacheTimestamp = Date.now();

		return entries;
	}

	/**
	 * Get all verb entries (filtered from dictionary)
	 */
	async getVerbs(): Promise<VerbEntry[]> {
		if (this.verbsCache && this.isCacheValid()) {
			return this.verbsCache;
		}

		const dictionary = await this.getDictionary();
		const verbs: VerbEntry[] = [];

		for (const entry of dictionary) {
			if (entry.type && entry.type.includes("#verbe")) {
				const verbEntry = this.enrichVerbEntry(entry);
				verbs.push(verbEntry);
			}
		}

		// Sort by name ascending using target language locale
		const locale = getLocaleCode(this.settings.targetLanguage);
		verbs.sort((a, b) => a.file.name.localeCompare(b.file.name, locale));

		this.verbsCache = verbs;
		return verbs;
	}

	/**
	 * Get all grammar pages
	 */
	async getGrammarPages(): Promise<GrammarPage[]> {
		if (this.grammarCache && this.isCacheValid()) {
			return this.grammarCache;
		}

		const pages: GrammarPage[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();

		for (const file of allFiles) {
			// Skip templates
			if (file.path.includes(this.settings.templatesFolder)) continue;

			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const fm = cache.frontmatter;
			const isGrammar = fm.isGrammar === true;
			const hasGrammarContext = this.getFieldValue(fm.context, fm.Context)?.includes("#grammar");

			if (isGrammar || hasGrammarContext) {
				const page = this.parseToGrammarPage(file, fm);
				pages.push(page);
			}
		}

		// Sort by name ascending using target language locale
		const locale = getLocaleCode(this.settings.targetLanguage);
		pages.sort((a, b) => a.file.name.localeCompare(b.file.name, locale));

		this.grammarCache = pages;
		return pages;
	}

	/**
	 * Parse a file to a DictionaryEntry
	 */
	private async parseFileToEntry(file: TFile): Promise<DictionaryEntry | null> {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return null;

		const fm = cache.frontmatter || {};
		const inlineFields = await this.getInlineFields(file, cache);

		// Merge frontmatter and inline fields
		const type = this.getFieldValue(inlineFields.type, inlineFields.Type, fm.type, fm.Type);
		const context = this.getFieldValue(inlineFields.context, inlineFields.Context, fm.context, fm.Context);

		// Revision can be stored either as frontmatter (Revision: 1) or as an inline field (Revision:: 1).
		// Many notes use the inline field form, so we must read both.
		const revisionCandidate = [
			inlineFields.Revision,
			(inlineFields as Record<string, string>).revision,
			fm.Revision,
			(fm as Record<string, unknown>).revision
		].find(v => v !== undefined && v !== null && String(v).trim() !== "");
		const revision = revisionCandidate
			? (String(revisionCandidate).trim().toLowerCase() === "new"
				? "new"
				: String(revisionCandidate).trim())
			: "new";

		// Get source language value using configured language name
		const sourceLanguage = this.settings.sourceLanguage;
		const sourceValue = this.getFieldValue(
			fm[sourceLanguage],
			fm[sourceLanguage.toLowerCase()],
			inlineFields[sourceLanguage],
			inlineFields[sourceLanguage.toLowerCase()]
		);

		return {
			file: {
				path: file.path,
				name: file.name,
				basename: file.basename,
			},
			targetWord: file.basename.toLowerCase(),
			sourceWord: sourceValue.toLowerCase(),
			type: this.normalizeArrayField(type),
			context: this.normalizeArrayField(context),
			revision,
			rating: inlineFields.Rating || fm.Rating || "",
			examples: inlineFields.Examples || fm.Examples || "",
			synonyms: inlineFields.Synonyms || fm.Synonyms || "",
			relations: inlineFields.Relations || fm.Relations || "",
			project: inlineFields.Project || fm.Project || "",
		};
	}

	/**
	 * Get inline fields from file content (Dataview-style fields like "Type:: value")
	 */
	private async getInlineFields(file: TFile, cache: CachedMetadata): Promise<Record<string, string>> {
		const fields: Record<string, string> = {};

		// Use Dataview's cached inline fields if available
		const dvCache = (cache as CachedMetadata & { frontmatterLinks?: unknown })?.frontmatterLinks;
		if (dvCache) {
			// Dataview caches inline fields
		}

		// Fallback: parse file content for inline fields
		try {
			const content = await this.app.vault.cachedRead(file);
			const lines = content.split("\n");

			for (const line of lines) {
				// Match Dataview inline field pattern: "FieldName:: value"
				const match = line.match(/^([A-Za-z_-]+)::\s*(.*)$/);
				if (match) {
					fields[match[1]] = match[2].trim();
				}
			}
		} catch (error) {
			console.error(`Error reading file ${file.path}:`, error);
		}

		return fields;
	}

	/**
	 * Enrich a dictionary entry with verb-specific fields
	 */
	private enrichVerbEntry(entry: DictionaryEntry): VerbEntry {
		const verbEntry: VerbEntry = {
			...entry,
			F: entry.file.basename,
			S: entry.sourceWord,
			Group: this.determineVerbGroup(entry.type),
			Irregular: this.determineIrregular(entry.type),
		};

		return verbEntry;
	}

	/**
	 * Determine verb group from type field
	 */
	private determineVerbGroup(type: string): VerbGroup {
		if (type.includes("#verbe/régulier/1")) return "1";
		if (type.includes("#verbe/régulier/2")) return "2";
		if (type.includes("#verbe/irrégulier/3/ir")) return "3ir";
		if (type.includes("#verbe/irrégulier/3/oir")) return "3oir";
		if (type.includes("#verbe/irrégulier/3/re")) return "3re";
		if (type.includes("#verbe/irrégulier/3")) return "3";
		if (type.includes("#verbe/irrégulier")) return "i";
		return "";
	}

	/**
	 * Determine if verb is irregular
	 */
	private determineIrregular(type: string): string {
		if (type.includes("#verbe/irrégulier")) {
			// Extract irregular number if present
			const match = type.match(/#verbe\/irrégulier(?:\/\d+)?/);
			if (match) {
				return "i";
			}
		}
		return "";
	}

	/**
	 * Parse file to GrammarPage
	 */
	private parseToGrammarPage(file: TFile, fm: Record<string, unknown>): GrammarPage {
		const context = this.getFieldValue(fm.context, fm.Context);
		const type = this.getFieldValue(fm.type, fm.Type);
		const tags = fm.tags;

		let typeStr = this.normalizeArrayField(type);
		const tagsStr = Array.isArray(tags)
			? tags.map(t => `#${t}`).sort().join(", ")
			: (tags ? `#${tags}` : "");

		if (typeStr && tagsStr) {
			typeStr = `${typeStr}, ${tagsStr}`;
		} else if (tagsStr) {
			typeStr = tagsStr;
		}

		return {
			file: {
				path: file.path,
				name: file.name,
				basename: file.basename,
			},
			Type: typeStr,
			Context: this.normalizeArrayField(context),
			Tags: tagsStr,
			isGrammar: fm.isGrammar === true,
		};
	}

	/**
	 * Get markdown files recursively from a folder
	 */
	private getMarkdownFilesRecursively(folder: TFolder): TFile[] {
		const files: TFile[] = [];

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				files.push(child);
			} else if (child instanceof TFolder) {
				files.push(...this.getMarkdownFilesRecursively(child));
			}
		}

		return files;
	}

	/**
	 * Get first non-null value from multiple possible field sources
	 */
	private getFieldValue(...values: unknown[]): string {
		for (const val of values) {
			if (val !== undefined && val !== null) {
				if (Array.isArray(val)) {
					return val.sort().join(", ");
				}
				return String(val);
			}
		}
		return "";
	}

	/**
	 * Normalize array field to string
	 */
	private normalizeArrayField(value: unknown): string {
		if (Array.isArray(value)) {
			return value.sort().join(", ");
		}
		return value ? String(value) : "";
	}
}
