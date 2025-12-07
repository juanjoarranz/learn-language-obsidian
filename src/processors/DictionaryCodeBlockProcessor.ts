import { MarkdownPostProcessorContext, App } from "obsidian";
import { DictionaryComponent, DictionaryComponentOptions } from "../components";
import { LearnLanguageSettings, FilterState, DictionaryEntry } from "../types";
import { DictionaryService, FilterService } from "../services";

/**
 * Parse YAML-like options from code block content
 */
function parseBlockOptions(source: string): Partial<FilterState> & { limit?: number; pageSize?: number; showStudy?: boolean; showPagination?: boolean } {
	const options: Record<string, string> = {};

	source.split("\n").forEach(line => {
		const match = line.match(/^(\w+):\s*(.+)$/);
		if (match) {
			options[match[1].toLowerCase()] = match[2].trim();
		}
	});

	return {
		targetWord: options.targetword || options.french || "all",
		sourceWord: options.sourceword || options.spanish || "all",
		type: options.type || "all",
		context: options.context || "all",
		revision: options.revision || "all",
		study: (options.study as "yes" | "no" | "spanish") || "no",
		limit: options.limit ? parseInt(options.limit) : undefined,
		pageSize: options.pagesize ? parseInt(options.pagesize) : 50,
		showStudy: options.showstudy !== "false",
		showPagination: options.showpagination !== "false"
	};
}

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
 * ```
 */
export function registerDictionaryCodeBlockProcessor(
	app: App,
	settings: LearnLanguageSettings,
	dictionaryService: DictionaryService,
	filterService: FilterService
): (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> {

	return async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> => {
		// Parse options from the code block
		const options = parseBlockOptions(source);

		// Create container with embedded styling
		const container = el.createDiv({ cls: "ll-embedded-dictionary" });

		// Get dictionary entries
		let entries: DictionaryEntry[] = [];
		try {
			entries = await dictionaryService.getDictionary();
		} catch (error) {
			container.createDiv({
				text: `Error loading dictionary: ${error}`,
				cls: "ll-error"
			});
			return;
		}

		// Apply limit if specified (before component handles filtering)
		const limit = options.limit;
		delete options.limit;

		// Extract component options
		const componentOptions: DictionaryComponentOptions = {
			showRefresh: true,
			showStudyMode: options.showStudy !== false,
			showPagination: options.showPagination !== false,
			pageSize: options.pageSize || 50,
			initialFilters: {
				targetWord: options.targetWord,
				sourceWord: options.sourceWord,
				type: options.type,
				context: options.context,
				revision: options.revision,
				study: options.study
			},
			onRefresh: async () => {
				// Refresh entries from service
				dictionaryService.invalidateCache();
				let refreshedEntries = await dictionaryService.getDictionary();
				if (limit) {
					refreshedEntries = refreshedEntries.slice(0, limit);
				}
				component.updateEntries(refreshedEntries);
			}
		};

		// Apply initial limit if specified
		if (limit) {
			entries = entries.slice(0, limit);
		}

		// Create and render the dictionary component
		const component = new DictionaryComponent(
			app,
			container,
			settings,
			filterService,
			componentOptions
		);

		component.render(entries);
	};
}
