import {
	ItemView,
	WorkspaceLeaf
} from "obsidian";
import {
	VIEW_TYPE_DICTIONARY,
	DictionaryEntry,
	FilterState
} from "../types";
import type LearnLanguagePlugin from "../main";
import { DictionaryComponent } from "../components";

/**
 * DictionaryView - Custom view for displaying and filtering dictionary entries
 * Uses DictionaryComponent for the actual UI rendering
 */
export class DictionaryView extends ItemView {
	plugin: LearnLanguagePlugin;
	private dictionaryComponent: DictionaryComponent | null = null;
	private entries: DictionaryEntry[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: LearnLanguagePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DICTIONARY;
	}

	getDisplayText(): string {
		return "Dictionary";
	}

	getIcon(): string {
		return "book-open";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("learn-language-view", "dictionary-view");

		// Load data
		await this.loadData();

		// Create dictionary component
		this.dictionaryComponent = new DictionaryComponent(
			this.app,
			container,
			this.plugin.settings,
			this.plugin.filterService,
			{
				showRefresh: true,
				showStudyMode: true,
				showPagination: true,
				pageSize: 100,
				onRefresh: () => this.refresh()
			}
		);

		// Render with loaded entries
		this.dictionaryComponent.render(this.entries);
	}

	async onClose(): Promise<void> {
		this.dictionaryComponent = null;
	}

	/**
	 * Load dictionary data
	 */
	private async loadData(): Promise<void> {
		this.entries = await this.plugin.dictionaryService.getDictionary();
	}

	/**
	 * Refresh the view
	 */
	async refresh(): Promise<void> {
		this.plugin.dictionaryService.invalidateCache();
		await this.loadData();

		if (this.dictionaryComponent) {
			this.dictionaryComponent.updateEntries(this.entries);
		}
	}

	/**
	 * Set filters externally (for command integration)
	 */
	setFilters(filters: Partial<FilterState>): void {
		if (this.dictionaryComponent) {
			this.dictionaryComponent.setFilters(filters);
		}
	}
}
