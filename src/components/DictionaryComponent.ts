import {
	App,
	DropdownComponent,
	ButtonComponent
} from "obsidian";
import {
	DictionaryEntry,
	FilterState,
	PaginationState,
	LearnLanguageSettings
} from "../types";
import { FilterService } from "../services";

/**
 * Configuration options for DictionaryComponent
 */
export interface DictionaryComponentOptions {
	/** Show the refresh button */
	showRefresh?: boolean;
	/** Show the study mode toggle */
	showStudyMode?: boolean;
	/** Show pagination controls */
	showPagination?: boolean;
	/** Initial page size */
	pageSize?: number;
	/** Initial filters to apply */
	initialFilters?: Partial<FilterState>;
	/** Callback when refresh is requested */
	onRefresh?: () => Promise<void>;
}

const DEFAULT_OPTIONS: DictionaryComponentOptions = {
	showRefresh: true,
	showStudyMode: true,
	showPagination: true,
	pageSize: 100,
	initialFilters: {}
};

/**
 * DictionaryComponent - Reusable UI component for displaying and filtering dictionary entries
 * Can be used in both ItemView and code block processors
 */
export class DictionaryComponent {
	private app: App;
	private settings: LearnLanguageSettings;
	private filterService: FilterService;
	private options: DictionaryComponentOptions;

	// Container elements
	private container: HTMLElement;
	private filterContainer: HTMLElement | null = null;
	private tableContainer: HTMLElement | null = null;
	private paginationContainer: HTMLElement | null = null;

	// State
	private entries: DictionaryEntry[] = [];
	private filteredEntries: DictionaryEntry[] = [];
	private filters: Partial<FilterState>;
	private pagination: PaginationState;

	constructor(
		app: App,
		container: HTMLElement,
		settings: LearnLanguageSettings,
		filterService: FilterService,
		options: DictionaryComponentOptions = {}
	) {
		this.app = app;
		this.container = container;
		this.settings = settings;
		this.filterService = filterService;
		this.options = { ...DEFAULT_OPTIONS, ...options };

		// Initialize state
		this.filters = {
			targetWord: "all",
			sourceWord: "all",
			type: "all",
			context: "all",
			revision: "all",
			study: "no",
			...this.options.initialFilters
		};

		this.pagination = {
			pageStart: 0,
			pageSize: this.options.pageSize || 100,
			outputCount: 0
		};
	}

	/**
	 * Initialize and render the component
	 */
	render(entries: DictionaryEntry[]): void {
		this.entries = entries;
		this.pagination.outputCount = entries.length;

		// Clear and setup container
		this.container.empty();
		this.container.addClass("ll-dictionary-component");

		// Create layout
		this.filterContainer = this.container.createDiv({ cls: "ll-filters" });
		this.tableContainer = this.container.createDiv({ cls: "ll-table-container" });

		if (this.options.showPagination) {
			this.paginationContainer = this.container.createDiv({ cls: "ll-pagination" });
		}

		// Render UI
		this.renderFilters();
		this.applyFiltersAndRender();
	}

	/**
	 * Update entries and re-render
	 */
	updateEntries(entries: DictionaryEntry[]): void {
		this.entries = entries;
		this.pagination.outputCount = entries.length;
		this.pagination.pageStart = 0;
		this.applyFiltersAndRender();
	}

	/**
	 * Set filters externally
	 */
	setFilters(filters: Partial<FilterState>): void {
		this.filters = { ...this.filters, ...filters };
		this.pagination.pageStart = 0;
		this.renderFilters(); // Re-render filters to update UI
		this.applyFiltersAndRender();
	}

	/**
	 * Render filter controls
	 */
	private renderFilters(): void {
		if (!this.filterContainer) return;
		this.filterContainer.empty();

		const filterRow = this.filterContainer.createDiv({ cls: "ll-filter-row" });
		const targetLang = this.settings.targetLanguage;
		const sourceLang = this.settings.sourceLanguage;

		// Target word filter (type-ahead search)
		this.createTypeAheadFilter(filterRow, "targetWord", this.filters.targetWord || "", targetLang);

		// Source word filter (type-ahead search)
		this.createTypeAheadFilter(filterRow, "sourceWord", this.filters.sourceWord || "", sourceLang);

		// Type filter
		this.createFilterDropdown(filterRow, "type", this.filters.type || "all", "Type");

		// Context filter
		this.createFilterDropdown(filterRow, "context", this.filters.context || "all", "Context");

		// Revision filter
		this.createFilterDropdown(filterRow, "revision", this.filters.revision || "all", "Revision");

		// Study mode toggle
		if (this.options.showStudyMode) {
			this.createStudyToggle(filterRow);
		}

		// Refresh button
		if (this.options.showRefresh && this.options.onRefresh) {
			new ButtonComponent(filterRow)
				.setButtonText("Refresh")
				.setIcon("refresh-cw")
				.onClick(async () => {
					if (this.options.onRefresh) {
						await this.options.onRefresh();
					}
				});
		}
	}

	/**
	 * Create a type-ahead search filter
	 */
	private createTypeAheadFilter(
		container: HTMLElement,
		filterName: keyof FilterState,
		currentValue: string,
		displayName: string
	): void {
		const wrapper = container.createDiv({ cls: "ll-filter-item" });
		wrapper.createSpan({ text: `${displayName}:`, cls: "ll-filter-label" });

		const input = wrapper.createEl("input", {
			type: "text",
			cls: "ll-filter-input",
			placeholder: `Search ${displayName.toLowerCase()}...`,
			value: currentValue === "all" ? "" : currentValue
		});

		// Debounce timer
		let debounceTimer: ReturnType<typeof setTimeout>;

		input.addEventListener("input", () => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				const value = input.value.trim();
				this.filters[filterName] = (value || "all") as never;
				this.pagination.pageStart = 0;
				this.applyFiltersAndRender();
			}, 300);
		});

		// Clear on Escape
		input.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				input.value = "";
				this.filters[filterName] = "all" as never;
				this.pagination.pageStart = 0;
				this.applyFiltersAndRender();
			}
		});

		// Highlight active filters
		if (currentValue && currentValue !== "all") {
			wrapper.addClass("ll-filter-active");
		}
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

		const values = this.filterService.getUniqueValues(this.entries, filterName);

		const dropdown = new DropdownComponent(wrapper);
		values.forEach(v => dropdown.addOption(v, v));
		dropdown.setValue(currentValue);

		dropdown.onChange(async (value) => {
			this.filters[filterName] = value as never;
			this.pagination.pageStart = 0;
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

		const targetLang = this.settings.targetLanguage;
		const sourceLang = this.settings.sourceLanguage;

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
		this.filteredEntries = this.filterService.applyFilters(this.entries, this.filters);
		this.pagination.outputCount = this.filteredEntries.length;

		// Apply pagination
		const paginatedEntries = this.options.showPagination
			? this.filterService.paginate(
				this.filteredEntries,
				this.pagination.pageStart,
				this.pagination.pageSize
			)
			: this.filteredEntries;

		// Render
		this.renderTable(paginatedEntries);

		if (this.options.showPagination) {
			this.renderPagination();
		}
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
		const targetLang = this.settings.targetLanguage;
		const sourceLang = this.settings.sourceLanguage;

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
}
