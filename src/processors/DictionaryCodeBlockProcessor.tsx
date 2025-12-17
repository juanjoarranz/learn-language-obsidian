import React from "react";
import { MarkdownPostProcessorContext, MarkdownRenderChild, App, TFile, CachedMetadata, LinkCache } from "obsidian";
import { LearnLanguageSettings, FilterState, DictionaryEntry } from "../types";
import { DictionaryService, FilterService, TermService } from "../services";
import { DictionaryComponent } from "../components/dictionary";
import { createReactRoot, ReactMountPoint } from "../utils";

/**
 * Parse YAML-like options from code block content
 */
function parseBlockOptions(source: string): Partial<FilterState> & {
	limit?: number;
	pageSize?: number;
	showStudy?: boolean;
	showPagination?: boolean;
	outlinksOnly?: boolean;
} & { explicitFilterKeys: Set<keyof FilterState> } {
	const options: Record<string, string> = {};
	const explicitFilterKeys = new Set<keyof FilterState>();

	source.split("\n").forEach(line => {
		const match = line.match(/^(\w+):\s*(.+)$/);
		if (match) {
			const key = match[1].toLowerCase();
			options[key] = match[2].trim();
		}
	});

	// Track which filter keys were explicitly provided in the code block
	if (options.targetword || options.french) explicitFilterKeys.add("targetWord");
	if (options.sourceword || options.spanish) explicitFilterKeys.add("sourceWord");
	if (options.type) explicitFilterKeys.add("type");
	if (options.context) explicitFilterKeys.add("context");
	if (options.revision) explicitFilterKeys.add("revision");
	if (options.rating) explicitFilterKeys.add("rating");
	if (options.study) explicitFilterKeys.add("study");

	return {
		targetWord: options.targetword || options.french || "all",
		sourceWord: options.sourceword || options.spanish || "all",
		type: options.type || "all",
		context: options.context || "all",
		revision: options.revision || "all",
		rating: options.rating || "all",
		study: (options.study as "yes" | "no" | "source") || "no",
		limit: options.limit ? parseInt(options.limit) : undefined,
		pageSize: options.pagesize ? parseInt(options.pagesize) : 50,
		showStudy: options.showstudy !== "false",
		showPagination: options.showpagination !== "false",
		outlinksOnly: options.outlinksonly === "true" || options.lessonmode === "true",
		explicitFilterKeys
	};
}

/**
 * Get outlinks from the current document that point to dictionary entries.
 * Similar to displayDictionaryInLesson logic from the legacy solution.
 *
 * @param app - The Obsidian App instance
 * @param sourcePath - Path of the current document
 * @param dictionaryFolder - The folder containing dictionary entries (e.g., "10. Dictionary")
 * @returns Set of file paths that are linked from the current document
 */
function getOutlinksToDict(
	app: App,
	sourcePath: string,
	dictionaryFolder: string
): Set<string> {
	const outlinks = new Set<string>();

	const file = app.vault.getAbstractFileByPath(sourcePath);
	if (!(file instanceof TFile)) return outlinks;

	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return outlinks;

	// Collect all links from the document (both inline links and embeds)
	const allLinks: LinkCache[] = [
		...(cache.links || []),
		...(cache.embeds || [])
	];

	for (const link of allLinks) {
		// Resolve the link to get the actual file path
		const linkedFile = app.metadataCache.getFirstLinkpathDest(link.link, sourcePath);
		if (!linkedFile) continue;

		// Check if the linked file is in the dictionary folder and is not an image
		const isInDictFolder = linkedFile.path.includes(dictionaryFolder);
		const isImage = /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(linkedFile.path);

		if (isInDictFolder && !isImage) {
			outlinks.add(linkedFile.path);
		}
	}

	return outlinks;
}

/**
 * Filter dictionary entries to only those referenced in the current document.
 *
 * @param entries - All dictionary entries
 * @param outlinks - Set of file paths linked from the current document
 * @returns Filtered entries that are referenced in the document
 */
function filterEntriesByOutlinks(
	entries: DictionaryEntry[],
	outlinks: Set<string>
): DictionaryEntry[] {
	if (outlinks.size === 0) return [];
	return entries.filter(entry => outlinks.has(entry.file.path));
}

/**
 * Inserts or updates a key-value pair in an array of strings.
 *
 * Searches for a line matching the key pattern (case-insensitive) and updates it with the new value.
 * If no matching line is found, appends a new key-value line to the end of the array.
 *
 * @param lines - The array of strings to search and modify.
 * @param key - The key to search for or insert.
 * @param value - The value to associate with the key.
 * @returns A new array with the key-value pair inserted or updated.
 */
function upsertKeyValueLine(
	lines: string[],
	key: string,
	value: string
): string[] {
	const re = new RegExp(`^\\s*${key}\\s*:\\s*.*$`, "i");
	const index = lines.findIndex(l => re.test(l));
	const nextLine = `${key}: ${value}`;
	if (index >= 0) {
		const next = [...lines];
		next[index] = nextLine;
		return next;
	}
	return [...lines, nextLine];
}

function normalizeFilterValue(value: unknown, fallback: string): string {
	if (value == null) return fallback;
	const trimmed = String(value).trim();
	return trimmed.length === 0 ? fallback : trimmed;
}

async function persistFiltersIntoCodeBlock(
	app: App,
	sourcePath: string,
	anchorLine: number,
	filters: Partial<FilterState>,
	blockType: string = "learn-dictionary"
): Promise<boolean> {
	const file = app.vault.getAbstractFileByPath(sourcePath);
	if (!(file instanceof TFile)) return false;

	const text = await app.vault.read(file);
	const lines = text.split(/\r?\n/);

	// Find all fenced blocks of this type, then pick the one that contains (or is nearest to) the anchor line.
	const openFenceLower = ("```" + blockType).toLowerCase();
	const blocks: Array<{ start: number; end: number }> = [];
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].trim().toLowerCase() !== openFenceLower) continue;
		for (let j = i + 1; j < lines.length; j++) {
			if (lines[j].trim() === "```") {
				blocks.push({ start: i, end: j });
				i = j;
				break;
			}
		}
	}
	if (blocks.length === 0) return false;

	const anchor = Math.max(0, Math.min(anchorLine, lines.length - 1));
	let chosen = blocks.find(b => b.start <= anchor && anchor <= b.end);
	if (!chosen) {
		chosen = blocks.reduce((best, candidate) => {
			const bestDist = Math.min(Math.abs(anchor - best.start), Math.abs(anchor - best.end));
			const candDist = Math.min(Math.abs(anchor - candidate.start), Math.abs(anchor - candidate.end));
			return candDist < bestDist ? candidate : best;
		}, blocks[0]);
	}

	let inner = lines.slice(chosen.start + 1, chosen.end);

	// Update the filter keys in the code block content
	inner = upsertKeyValueLine(inner, "targetWord", filters.targetWord ?? "all");
	inner = upsertKeyValueLine(inner, "sourceWord", filters.sourceWord ?? "all");
	inner = upsertKeyValueLine(inner, "type", filters.type ?? "all");
	inner = upsertKeyValueLine(inner, "context", filters.context ?? "all");
	inner = upsertKeyValueLine(inner, "revision", filters.revision ?? "all");
	inner = upsertKeyValueLine(inner, "rating", filters.rating ?? "all");
	inner = upsertKeyValueLine(inner, "study", (filters.study as any) ?? "no");

	const nextLines = [...lines.slice(0, chosen.start + 1), ...inner, ...lines.slice(chosen.end)];
	const nextText = nextLines.join("\n");
	if (nextText !== text) {
		await app.vault.modify(file, nextText);
	}

	return true;
}

// Store React roots for cleanup
const reactRoots = new Map<HTMLElement, ReactMountPoint>();

/**
 * Register the learn-dictionary code block processor
 *
 * Usage in a note:
 * ```learn-dictionary
 * type: verb
 * context: A1
 * pageSize: 25
 * showStudy: true
 * showPagination: true
 * outlinksOnly: true
 * ```
 *
 * Options:
 * - targetWord/french: Filter by target word (default: "all")
 * - sourceWord/spanish: Filter by source word (default: "all")
 * - type: Filter by type (default: "all")
 * - context: Filter by context (default: "all")
 * - revision: Filter by revision status (default: "all")
 * - rating: Filter by rating (default: "all")
 * - study: Study mode - "yes", "no", or "source" (default: "no")
 * - limit: Maximum number of entries to display
 * - pageSize: Number of entries per page (default: 50)
 * - showStudy: Show study mode toggle (default: true)
 * - showPagination: Show pagination controls (default: true)
 * - outlinksOnly/lessonMode: Only show dictionary entries that are referenced
 *   (linked) in the current document. Useful for lesson notes. (default: false)
 */
export function registerDictionaryCodeBlockProcessor(
	app: App,
	settings: LearnLanguageSettings,
	dictionaryService: DictionaryService,
	filterService: FilterService,
	termService: TermService,
	onAskAIForTerm?: () => void
): (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> {

	return async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> => {
		// Parse options from the code block
		const options = parseBlockOptions(source);

		// Initial filters come from the block itself
		const initialFilters: Partial<FilterState> = {
			targetWord: options.targetWord,
			sourceWord: options.sourceWord,
			type: options.type,
			context: options.context,
			revision: options.revision,
			rating: options.rating,
			study: options.study
		};

		// Create container with embedded styling
		const container = el.createDiv({ cls: "ll-embedded-dictionary" });

		// Get the source path for outlinks filtering
		const sourcePath = ctx.sourcePath;

		// Get outlinks if outlinksOnly mode is enabled
		const outlinksToDict = options.outlinksOnly
			? getOutlinksToDict(app, sourcePath, settings.dictionaryFolder)
			: null;

		// Get dictionary entries
		let entries: DictionaryEntry[] = [];
		try {
			entries = await dictionaryService.getDictionary();

			// Filter by outlinks if outlinksOnly mode is enabled
			if (outlinksToDict) {
				entries = filterEntriesByOutlinks(entries, outlinksToDict);
			}
		} catch (error) {
			container.createDiv({
				text: `Error loading dictionary: ${error}`,
				cls: "ll-error"
			});
			return;
		}

		// Apply limit if specified
		const limit = options.limit;
		if (limit) {
			entries = entries.slice(0, limit);
		}

		// Create React root
		const reactRoot = createReactRoot(
			container,
			app,
			settings,
			filterService,
			dictionaryService,
			termService
		);

		// Store for cleanup
		reactRoots.set(el, reactRoot);

		// Create refresh handler
		const handleRefresh = async () => {
			dictionaryService.invalidateCache();
			let refreshedEntries = await dictionaryService.getDictionary();

			// Re-check outlinks on refresh (document may have changed)
			if (options.outlinksOnly) {
				const refreshedOutlinks = getOutlinksToDict(app, sourcePath, settings.dictionaryFolder);
				refreshedEntries = filterEntriesByOutlinks(refreshedEntries, refreshedOutlinks);
			}

			if (limit) {
				refreshedEntries = refreshedEntries.slice(0, limit);
			}
			// Re-render with new entries
			renderComponent(refreshedEntries);
		};

		// Persist handler (debounced) - writes back into the markdown code block itself
		const sectionInfo = (ctx as any)?.getSectionInfo?.(el) as { lineStart?: number; lineEnd?: number } | undefined;
		let persistTimer: number | null = null;
		let lastScheduled: string | null = null;
		let lastWritten: string | null = null;
		let lastSeenFilters: Partial<FilterState> | null = null;
		const persistFilters = (next: Partial<FilterState>) => {
			if (!sourcePath || sectionInfo?.lineStart == null || sectionInfo.lineStart < 0) return;

			const normalizedNext = {
				targetWord: normalizeFilterValue(next.targetWord, "all"),
				sourceWord: normalizeFilterValue(next.sourceWord, "all"),
				type: normalizeFilterValue(next.type, "all"),
				context: normalizeFilterValue(next.context, "all"),
				revision: normalizeFilterValue(next.revision, "all"),
				rating: normalizeFilterValue(next.rating, "all"),
				study: normalizeFilterValue(next.study as any, "no")
			} as const;

			const previous = lastSeenFilters;
			lastSeenFilters = normalizedNext as any;

			const changedKeys: Array<keyof FilterState> = [];
			if (previous) {
				if (normalizeFilterValue(previous.targetWord, "all") !== normalizedNext.targetWord) changedKeys.push("targetWord");
				if (normalizeFilterValue(previous.sourceWord, "all") !== normalizedNext.sourceWord) changedKeys.push("sourceWord");
				if (normalizeFilterValue(previous.type, "all") !== normalizedNext.type) changedKeys.push("type");
				if (normalizeFilterValue(previous.context, "all") !== normalizedNext.context) changedKeys.push("context");
				if (normalizeFilterValue(previous.revision, "all") !== normalizedNext.revision) changedKeys.push("revision");
				if (normalizeFilterValue(previous.rating, "all") !== normalizedNext.rating) changedKeys.push("rating");
				if (normalizeFilterValue(previous.study as any, "no") !== normalizedNext.study) changedKeys.push("study");
			} else {
				// First emission after mount guard: treat as a non-typeahead change (persist quickly)
				changedKeys.push("type");
			}

			const isOnlyTypeAheadChange = changedKeys.length > 0 && changedKeys.every(k => k === "targetWord" || k === "sourceWord");
			const debounceMs = isOnlyTypeAheadChange ? 45_000 : 800;

			const snapshot = JSON.stringify(normalizedNext);
			if (snapshot === lastWritten) return;
			if (snapshot === lastScheduled) return;
			lastScheduled = snapshot;

			if (persistTimer) window.clearTimeout(persistTimer);
			persistTimer = window.setTimeout(() => {
				void (async () => {
					const ok = await persistFiltersIntoCodeBlock(
					app,
					sourcePath,
					sectionInfo.lineStart ?? 0,
					normalizedNext as any,
					"learn-dictionary"
					);
					if (ok) {
						lastWritten = snapshot;
					} else {
						// Allow retry if we couldn't locate the code block.
						lastScheduled = null;
					}
				})();
			}, debounceMs);
		};

		// Render function
		const renderComponent = (entriesToRender: DictionaryEntry[]) => {
			reactRoot.render(
				<DictionaryComponent
					entries={entriesToRender}
					showRefresh={true}
					showStudyMode={options.showStudy !== false}
					showPagination={options.showPagination !== false}
					pageSize={options.pageSize || 50}
					initialFilters={initialFilters}
					onRefresh={handleRefresh}
					onFiltersChange={persistFilters}
					onAskAIForTerm={onAskAIForTerm}
				/>
			);
		};

		// Initial render
		renderComponent(entries);

		// Cleanup on unload (when note is closed or re-rendered)
		const cleanupChild = new MarkdownRenderChild(container);
		cleanupChild.onunload = () => {
			if (persistTimer) {
				window.clearTimeout(persistTimer);
				persistTimer = null;
			}
			const root = reactRoots.get(el);
			if (root) {
				root.unmount();
				reactRoots.delete(el);
			}
		};
		ctx.addChild(cleanupChild);
	};
}
