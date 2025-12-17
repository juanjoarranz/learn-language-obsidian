import React from "react";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_VERBS, VerbEntry } from "../types";
import type LearnLanguagePlugin from "../main";
import { VerbsComponent } from "../components/verbs";
import { createReactRoot, ReactMountPoint } from "../utils";

/**
 * VerbsView - Custom view for displaying and filtering verb conjugations
 * Uses React VerbsComponent for the UI
 */
export class VerbsView extends ItemView {
	plugin: LearnLanguagePlugin;
	private reactRoot: ReactMountPoint | null = null;
	private entries: VerbEntry[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: LearnLanguagePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_VERBS;
	}

	getDisplayText(): string {
		return "Verbs";
	}

	getIcon(): string {
		return "languages";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("learn-language-view", "verbs-view");

		// Load data
		await this.loadData();

		// Create React root
		this.reactRoot = createReactRoot(
			container,
			this.app,
			this.plugin.settings,
			this.plugin.filterService,
			this.plugin.dictionaryService,
			this.plugin.termService
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
			<VerbsComponent
				entries={this.entries}
				showRefresh={true}
				showStudyMode={true}
				showPagination={true}
				pageSize={25}
				onRefresh={() => this.refresh()}
			/>
		);
	}

	/**
	 * Load verbs data
	 */
	private async loadData(): Promise<void> {
		this.entries = await this.plugin.dictionaryService.getVerbs();
	}

	/**
	 * Refresh the view
	 */
	async refresh(): Promise<void> {
		this.plugin.dictionaryService.invalidateCache();
		await this.loadData();
		this.renderComponent();
	}
}
