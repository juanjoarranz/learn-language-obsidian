import React from "react";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_DICTIONARY, DictionaryEntry, FilterState } from "../types";
import type LearnLanguagePlugin from "../main";
import { DictionaryComponent } from "../components/dictionary";
import { createReactRoot, ReactMountPoint } from "../utils";

/**
 * DictionaryView - Custom view for displaying and filtering dictionary entries
 * Uses React DictionaryComponent for the UI
 */
export class DictionaryView extends ItemView {
	plugin: LearnLanguagePlugin;
	private reactRoot: ReactMountPoint | null = null;
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

		// Create React root
		this.reactRoot = createReactRoot(
			container,
			this.app,
			this.plugin.settings,
			this.plugin.filterService,
			this.plugin.dictionaryService
		);

		// Render React component
		this.renderComponent();
	}

	async onClose(): Promise<void> {
		if (this.reactRoot) {
			this.reactRoot.unmount();
			this.reactRoot = null;
		}
	}

	/**
	 * Render the React component
	 */
	private renderComponent(): void {
		if (!this.reactRoot) return;

		this.reactRoot.render(
			<DictionaryComponent
				entries={this.entries}
				showRefresh={true}
				showStudyMode={true}
				showPagination={true}
				pageSize={100}
				onRefresh={() => this.refresh()}
			/>
		);
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
		this.renderComponent();
	}

	/**
	 * Set filters externally (for command integration)
	 * Note: With React, we need to re-render with new initial filters
	 */
	setFilters(filters: Partial<FilterState>): void {
		if (!this.reactRoot) return;

		this.reactRoot.render(
			<DictionaryComponent
				entries={this.entries}
				showRefresh={true}
				showStudyMode={true}
				showPagination={true}
				pageSize={100}
				initialFilters={filters}
				onRefresh={() => this.refresh()}
			/>
		);
	}
}
