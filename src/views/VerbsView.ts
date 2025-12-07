import {
	ItemView,
	WorkspaceLeaf,
	Setting,
	DropdownComponent,
	ButtonComponent,
} from "obsidian";
import {
	VIEW_TYPE_VERBS,
	VerbEntry,
	FilterState,
	PaginationState
} from "../types";
import type LearnLanguagePlugin from "../main";

interface VerbFilterState extends Partial<FilterState> {
	group?: string;
	irregular?: string;
	F?: string;
	S?: string;
}

/**
 * VerbsView - Custom view for displaying and filtering verb conjugations
 */
export class VerbsView extends ItemView {
	plugin: LearnLanguagePlugin;

	// State
	private entries: VerbEntry[] = [];
	private filteredEntries: VerbEntry[] = [];
	private filters: VerbFilterState = {
		F: "all",
		S: "all",
		group: "all",
		irregular: "all",
		revision: "all",
		study: "no",
	};
	private pagination: PaginationState = {
		pageStart: 0,
		pageSize: 25,
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
		return VIEW_TYPE_VERBS;
	}

	getDisplayText(): string {
		return "Verbs";
	}

	getIcon(): string {
		return "languages";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("learn-language-view", "verbs-view");

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
	 * Load verbs data
	 */
	private async loadData(): Promise<void> {
		this.entries = await this.plugin.dictionaryService.getVerbs();
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

		// Target language filter
		this.createFilterDropdown(filterRow, "F", this.filters.F || "all", targetLang);

		// Source language filter
		this.createFilterDropdown(filterRow, "S", this.filters.S || "all", sourceLang);

		// Group filter
		this.createFilterDropdown(filterRow, "Group", this.filters.group || "all", "Group");

		// Irregular filter
		this.createFilterDropdown(filterRow, "Irregular", this.filters.irregular || "all", "Irregular");

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
		filterName: string,
		currentValue: string,
		displayName: string
	): void {
		const wrapper = container.createDiv({ cls: "ll-filter-item" });
		wrapper.createSpan({ text: `${displayName}:`, cls: "ll-filter-label" });

		const values = this.plugin.filterService.getUniqueValues(this.entries, filterName);

		const dropdown = new DropdownComponent(wrapper);
		values.forEach(v => dropdown.addOption(v, v));
		dropdown.setValue(currentValue);

		dropdown.onChange(async (value) => {
			(this.filters as Record<string, string>)[filterName] = value;
			this.pagination.pageStart = 0;
			this.applyFiltersAndRender();
		});

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
		this.filteredEntries = this.applyVerbFilters(this.entries, this.filters);
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
	 * Apply verb-specific filters
	 */
	private applyVerbFilters(entries: VerbEntry[], filters: VerbFilterState): VerbEntry[] {
		let result = [...entries];

		if (filters.F && filters.F !== "all") {
			result = result.filter(e => e.F.toLowerCase().includes(filters.F!.toLowerCase()));
		}

		if (filters.S && filters.S !== "all") {
			result = result.filter(e => e.S.toLowerCase().includes(filters.S!.toLowerCase()));
		}

		if (filters.group && filters.group !== "all") {
			result = result.filter(e => e.Group === filters.group);
		}

		if (filters.irregular && filters.irregular !== "all") {
			result = result.filter(e => {
				if (filters.irregular === "i1") {
					return e.Irregular.startsWith("i");
				}
				return e.Irregular === filters.irregular;
			});
		}

		if (filters.revision && filters.revision !== "all") {
			result = result.filter(e => e.revision === filters.revision);
		}

		return result;
	}

	/**
	 * Render the verbs table
	 */
	private renderTable(entries: VerbEntry[]): void {
		if (!this.tableContainer) return;
		this.tableContainer.empty();

		if (entries.length === 0) {
			this.tableContainer.createDiv({
				text: "No verbs found matching the filters.",
				cls: "ll-no-results"
			});
			return;
		}

		const table = this.tableContainer.createEl("table", { cls: "ll-table ll-verbs-table" });
		const targetLang = this.plugin.settings.targetLanguage;
		const sourceLang = this.plugin.settings.sourceLanguage;

		// Header
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");

		const headers = [targetLang, sourceLang, "G", "Présent", "Subjonctif", "Imparfait", "Passé composé", "Futur"];
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
	private renderNormalRow(row: HTMLElement, entry: VerbEntry): void {
		// Target word (link)
		const targetCell = row.createEl("td");
		const link = targetCell.createEl("a", {
			text: entry.F,
			cls: "internal-link",
			href: entry.file.path,
		});
		link.addEventListener("click", (e) => {
			e.preventDefault();
			this.app.workspace.openLinkText(entry.file.path, "");
		});

		// Source word
		row.createEl("td", { text: entry.S });

		// Group
		row.createEl("td", { text: entry.Group });

		// Conjugations - these would typically come from inline fields
		// For now, show placeholder or link to entry
		const conjugationFields = ["présent", "présent-subjonctif", "imparfait", "passé-composé", "futur"];

		conjugationFields.forEach(field => {
			const cell = row.createEl("td", { cls: "ll-conjugation" });
			const value = (entry as unknown as Record<string, unknown>)[field];
			if (value) {
				cell.innerHTML = String(value);
			} else {
				cell.createEl("span", { text: "—", cls: "ll-empty" });
			}
		});
	}

	/**
	 * Render a study mode row (collapsible)
	 */
	private renderStudyRow(row: HTMLElement, entry: VerbEntry, showSpanishFirst: boolean): void {
		const questionText = showSpanishFirst ? entry.S : entry.F;
		const answerText = showSpanishFirst ? entry.F : entry.S;

		// Question cell (spans all columns)
		const questionCell = row.createEl("td", { attr: { colspan: "8" } });

		const questionDiv = questionCell.createDiv({ cls: "ll-study-question" });
		questionDiv.createEl("h4", {
			text: questionText,
			cls: "ll-collapsible"
		});

		const answerDiv = questionCell.createDiv({ cls: "ll-study-answer ll-hidden" });
		answerDiv.createEl("span", { text: answerText, cls: "ll-answer-text" });

		if (entry.Group) {
			answerDiv.createEl("span", { text: ` (Group ${entry.Group})`, cls: "ll-answer-type" });
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

		const infoText = this.paginationContainer.createSpan({ cls: "ll-pagination-info" });
		infoText.setText(
			`Showing ${pageStart + 1}-${Math.min(pageStart + pageSize, outputCount)} of ${outputCount} verbs (Page ${currentPage}/${totalPages})`
		);

		const buttonsDiv = this.paginationContainer.createDiv({ cls: "ll-pagination-buttons" });

		if (pageStart > 0) {
			new ButtonComponent(buttonsDiv)
				.setButtonText("← Previous")
				.onClick(() => {
					this.pagination.pageStart = Math.max(0, pageStart - pageSize);
					this.applyFiltersAndRender();
				});
		}

		if (pageStart + pageSize < outputCount) {
			new ButtonComponent(buttonsDiv)
				.setButtonText("Next →")
				.onClick(() => {
					this.pagination.pageStart = pageStart + pageSize;
					this.applyFiltersAndRender();
				});
		}

		const pageSizeWrapper = buttonsDiv.createDiv({ cls: "ll-page-size" });
		pageSizeWrapper.createSpan({ text: "Page size: " });

		const pageSizeDropdown = new DropdownComponent(pageSizeWrapper);
		["10", "25", "50", "100"].forEach(size => {
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
