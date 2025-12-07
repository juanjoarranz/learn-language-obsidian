import {
	ItemView,
	WorkspaceLeaf,
	Setting,
	DropdownComponent,
	ButtonComponent,
	Notice,
	TFile
} from "obsidian";
import {
	VIEW_TYPE_DICTIONARY,
	DictionaryEntry,
	FilterState,
	PaginationState
} from "../types";
import type LearnLanguagePlugin from "../main";

/**
 * DictionaryView - Custom view for displaying and filtering dictionary entries
 */
export class DictionaryView extends ItemView {
	plugin: LearnLanguagePlugin;

	// State
	private entries: DictionaryEntry[] = [];
	private filteredEntries: DictionaryEntry[] = [];
	private filters: Partial<FilterState> = {
		targetWord: "all",
		sourceWord: "all",
		type: "all",
		context: "all",
		revision: "all",
		study: "no",
	};
	private pagination: PaginationState = {
		pageStart: 0,
		pageSize: 100,
		outputCount: 0,
	};

	// UI Elements
	private filterContainer: HTMLElement | null = null;
	private tableContainer: HTMLElement | null = null;
	private paginationContainer: HTMLElement | null = null;

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
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("learn-language-view", "dictionary-view");

		// Create layout
		this.filterContainer = container.createDiv({ cls: "ll-filters" });
		this.tableContainer = container.createDiv({ cls: "ll-table-container" });
		this.paginationContainer = container.createDiv({ cls: "ll-pagination" });

		// Load data and render
		await this.loadData();
		this.renderFilters();
		this.applyFiltersAndRender();
	}

	async onClose(): Promise<void> {
		// Cleanup
	}

	/**
	 * Load dictionary data
	 */
	private async loadData(): Promise<void> {
		this.entries = await this.plugin.dictionaryService.getDictionary();
		this.pagination.outputCount = this.entries.length;
	}

	/**
	 * Refresh the view
	 */
	async refresh(): Promise<void> {
		this.plugin.dictionaryService.invalidateCache();
		await this.loadData();
		this.applyFiltersAndRender();
	}

	/**
	 * Render filter controls
	 */
	private renderFilters(): void {
		if (!this.filterContainer) return;
		this.filterContainer.empty();

		const filterRow = this.filterContainer.createDiv({ cls: "ll-filter-row" });
		const targetLang = this.plugin.settings.targetLanguage;
		const sourceLang = this.plugin.settings.sourceLanguage;

		// Target word filter
		this.createFilterDropdown(filterRow, "targetWord", this.filters.targetWord || "all", targetLang);

		// Source word filter
		this.createFilterDropdown(filterRow, "sourceWord", this.filters.sourceWord || "all", sourceLang);

		// Type filter
		this.createFilterDropdown(filterRow, "type", this.filters.type || "all", "Type");

		// Context filter
		this.createFilterDropdown(filterRow, "context", this.filters.context || "all", "Context");

		// Revision filter
		this.createFilterDropdown(filterRow, "revision", this.filters.revision || "all", "Revision");

		// Study mode toggle
		this.createStudyToggle(filterRow);

		// Refresh button
		new ButtonComponent(filterRow)
			.setButtonText("Refresh")
			.setIcon("refresh-cw")
			.onClick(async () => {
				await this.refresh();
			});
	}

	/**
	 * Create a filter dropdown
	 */
	private createFilterDropdown(
		container: HTMLElement,
		filterName: keyof FilterState,
		currentValue: string,
		displayName?: string
	): void {
		const wrapper = container.createDiv({ cls: "ll-filter-item" });
		wrapper.createSpan({ text: `${displayName || filterName}:`, cls: "ll-filter-label" });

		const values = this.plugin.filterService.getUniqueValues(this.entries, filterName);

		const dropdown = new DropdownComponent(wrapper);
		values.forEach(v => dropdown.addOption(v, v));
		dropdown.setValue(currentValue);

		dropdown.onChange(async (value) => {
			this.filters[filterName] = value as never;
			this.pagination.pageStart = 0; // Reset pagination on filter change
			this.applyFiltersAndRender();
		});

		// Highlight active filters
		if (currentValue !== "all") {
			wrapper.addClass("ll-filter-active");
		}
	}

	/**
	 * Create study mode toggle
	 */
	private createStudyToggle(container: HTMLElement): void {
		const wrapper = container.createDiv({ cls: "ll-filter-item" });
		wrapper.createSpan({ text: "Study:", cls: "ll-filter-label" });

		const targetLang = this.plugin.settings.targetLanguage;
		const sourceLang = this.plugin.settings.sourceLanguage;

		const dropdown = new DropdownComponent(wrapper);
		dropdown.addOption("no", "No");
		dropdown.addOption("yes", `${targetLang} → ${sourceLang}`);
		dropdown.addOption("spanish", `${sourceLang} → ${targetLang}`);
		dropdown.setValue(this.filters.study || "no");

		dropdown.onChange((value) => {
			this.filters.study = value as "yes" | "no" | "spanish";
			this.applyFiltersAndRender();
		});

		if (this.filters.study !== "no") {
			wrapper.addClass("ll-filter-active");
		}
	}

	/**
	 * Apply filters and render table
	 */
	private applyFiltersAndRender(): void {
		// Apply filters
		this.filteredEntries = this.plugin.filterService.applyFilters(this.entries, this.filters);
		this.pagination.outputCount = this.filteredEntries.length;

		// Apply pagination
		const paginatedEntries = this.plugin.filterService.paginate(
			this.filteredEntries,
			this.pagination.pageStart,
			this.pagination.pageSize
		);

		// Render
		this.renderTable(paginatedEntries);
		this.renderPagination();
	}

	/**
	 * Render the entries table
	 */
	private renderTable(entries: DictionaryEntry[]): void {
		if (!this.tableContainer) return;
		this.tableContainer.empty();

		if (entries.length === 0) {
			this.tableContainer.createDiv({
				text: "No entries found matching the filters.",
				cls: "ll-no-results"
			});
			return;
		}

		const table = this.tableContainer.createEl("table", { cls: "ll-table" });
		const targetLang = this.plugin.settings.targetLanguage;
		const sourceLang = this.plugin.settings.sourceLanguage;

		// Header
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");

		const headers = [targetLang, sourceLang, "Type", "Context", "Rating", "Examples"];
		headers.forEach(h => {
			headerRow.createEl("th", { text: h });
		});

		// Body
		const tbody = table.createEl("tbody");
		const isStudying = this.filters.study !== "no";
		const showSpanishFirst = this.filters.study === "spanish";

		entries.forEach(entry => {
			const row = tbody.createEl("tr", { cls: isStudying ? "ll-study-row" : "" });

			if (isStudying) {
				this.renderStudyRow(row, entry, showSpanishFirst);
			} else {
				this.renderNormalRow(row, entry);
			}
		});
	}

	/**
	 * Render a normal (non-study) table row
	 */
	private renderNormalRow(row: HTMLElement, entry: DictionaryEntry): void {
		// Target word (link)
		const targetCell = row.createEl("td");
		const link = targetCell.createEl("a", {
			text: entry.file.basename,
			cls: "internal-link",
			href: entry.file.path,
		});
		link.addEventListener("click", (e) => {
			e.preventDefault();
			this.app.workspace.openLinkText(entry.file.path, "");
		});

		// Source word
		row.createEl("td", { text: entry.sourceWord });

		// Type
		row.createEl("td", { text: entry.type, cls: "ll-tags" });

		// Context
		row.createEl("td", { text: entry.context, cls: "ll-tags" });

		// Rating
		row.createEl("td", { text: entry.rating || "" });

		// Examples
		const examplesCell = row.createEl("td", { cls: "ll-examples" });
		if (entry.examples) {
			examplesCell.innerHTML = entry.examples.replace(/<br>/g, "<br>");
		}
	}

	/**
	 * Render a study mode row (collapsible)
	 */
	private renderStudyRow(row: HTMLElement, entry: DictionaryEntry, showSpanishFirst: boolean): void {
		const questionText = showSpanishFirst ? entry.sourceWord : entry.file.basename;
		const answerText = showSpanishFirst ? entry.file.basename : entry.sourceWord;

		// Question cell (spans all columns)
		const questionCell = row.createEl("td", { attr: { colspan: "6" } });

		const questionDiv = questionCell.createDiv({ cls: "ll-study-question" });
		questionDiv.createEl("h4", {
			text: questionText,
			cls: "ll-collapsible"
		});

		const answerDiv = questionCell.createDiv({ cls: "ll-study-answer ll-hidden" });
		answerDiv.createEl("span", { text: answerText, cls: "ll-answer-text" });

		if (entry.type) {
			answerDiv.createEl("span", { text: ` (${entry.type})`, cls: "ll-answer-type" });
		}

		if (entry.examples) {
			const examplesDiv = answerDiv.createDiv({ cls: "ll-answer-examples" });
			examplesDiv.innerHTML = entry.examples.replace(/<br>/g, "<br>");
		}

		// Toggle on click
		questionDiv.addEventListener("click", () => {
			answerDiv.toggleClass("ll-hidden", !answerDiv.hasClass("ll-hidden"));
		});
	}

	/**
	 * Render pagination controls
	 */
	private renderPagination(): void {
		if (!this.paginationContainer) return;
		this.paginationContainer.empty();

		const { pageStart, pageSize, outputCount } = this.pagination;
		const currentPage = Math.floor(pageStart / pageSize) + 1;
		const totalPages = Math.ceil(outputCount / pageSize);

		// Info text
		const infoText = this.paginationContainer.createSpan({ cls: "ll-pagination-info" });
		infoText.setText(
			`Showing ${pageStart + 1}-${Math.min(pageStart + pageSize, outputCount)} of ${outputCount} entries (Page ${currentPage}/${totalPages})`
		);

		const buttonsDiv = this.paginationContainer.createDiv({ cls: "ll-pagination-buttons" });

		// Previous button
		if (pageStart > 0) {
			new ButtonComponent(buttonsDiv)
				.setButtonText("← Previous")
				.onClick(() => {
					this.pagination.pageStart = Math.max(0, pageStart - pageSize);
					this.applyFiltersAndRender();
				});
		}

		// Next button
		if (pageStart + pageSize < outputCount) {
			new ButtonComponent(buttonsDiv)
				.setButtonText("Next →")
				.onClick(() => {
					this.pagination.pageStart = pageStart + pageSize;
					this.applyFiltersAndRender();
				});
		}

		// Page size selector
		const pageSizeWrapper = buttonsDiv.createDiv({ cls: "ll-page-size" });
		pageSizeWrapper.createSpan({ text: "Page size: " });

		const pageSizeDropdown = new DropdownComponent(pageSizeWrapper);
		["25", "50", "100", "200"].forEach(size => {
			pageSizeDropdown.addOption(size, size);
		});
		pageSizeDropdown.setValue(String(pageSize));
		pageSizeDropdown.onChange((value) => {
			this.pagination.pageSize = parseInt(value, 10);
			this.pagination.pageStart = 0;
			this.applyFiltersAndRender();
		});
	}

	/**
	 * Set filters externally (for command integration)
	 */
	setFilters(filters: Partial<FilterState>): void {
		this.filters = { ...this.filters, ...filters };
		this.pagination.pageStart = 0;
		this.applyFiltersAndRender();
	}
}
