import { Plugin, WorkspaceLeaf, Notice, TFile } from "obsidian";
import {
	LearnLanguageSettings,
	DEFAULT_SETTINGS,
	VIEW_TYPE_DICTIONARY,
	VIEW_TYPE_VERBS,
	LearnLanguageAPI,
	DictionaryEntry,
	VerbEntry,
	GrammarPage,
	FilterState
} from "./types";
import {
	DictionaryService,
	OpenAIService,
	TermService,
	FilterService
} from "./services";
import { DictionaryView, VerbsView } from "./views";
import { TermModal, AskAIModal } from "./modals";
import { LearnLanguageSettingTab } from "./settings";
import { registerDictionaryCodeBlockProcessor } from "./processors";

export default class LearnLanguagePlugin extends Plugin {
	settings: LearnLanguageSettings = DEFAULT_SETTINGS;

	// Services
	dictionaryService!: DictionaryService;
	openAIService!: OpenAIService;
	termService!: TermService;
	filterService!: FilterService;

	// Modals
	termModal!: TermModal;
	askAIModal!: AskAIModal;

	// Public API exposed to other plugins/scripts
	// Usage: app.plugins.plugins["learn-language"].api
	public api!: LearnLanguageAPI;

	async onload(): Promise<void> {
		console.log("Loading Learn Language plugin");

		// Load settings
		await this.loadSettings();

		// Initialize services
		this.dictionaryService = new DictionaryService(this.app, this.settings);
		this.openAIService = new OpenAIService(this.app, this.settings);
		this.termService = new TermService(this.app, this.settings);
		this.filterService = new FilterService(this.app, this.settings);

		// Initialize modals
		this.termModal = new TermModal(this.app, this);
		this.askAIModal = new AskAIModal(this.app, this);

		// Register views
		this.registerView(
			VIEW_TYPE_DICTIONARY,
			(leaf) => new DictionaryView(leaf, this)
		);

		this.registerView(
			VIEW_TYPE_VERBS,
			(leaf) => new VerbsView(leaf, this)
		);

		// Register code block processor for embedding dictionary in notes
		this.registerMarkdownCodeBlockProcessor(
			"learn-dictionary",
			registerDictionaryCodeBlockProcessor(
				this.app,
				this.settings,
				this.dictionaryService,
				this.filterService
			)
		);

		// Register commands
		this.registerCommands();

		// Add ribbon icons
		this.addRibbonIcons();

		// Add settings tab
		this.addSettingTab(new LearnLanguageSettingTab(this.app, this));

		// Register file change events for cache invalidation
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile && file.path.startsWith(this.settings.dictionaryFolder)) {
					this.dictionaryService.invalidateCache();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.path.startsWith(this.settings.dictionaryFolder)) {
					this.dictionaryService.invalidateCache();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file instanceof TFile && file.path.startsWith(this.settings.dictionaryFolder)) {
					this.dictionaryService.invalidateCache();
				}
			})
		);

		// Auto-sync types with OpenAI if configured
		if (this.settings.autoSyncTypesWithOpenAI && this.settings.openAIApiKey) {
			this.registerEvent(
				this.app.vault.on("modify", async (file) => {
					if (file instanceof TFile) {
						if (file.path === this.settings.termTypesFile ||
							file.path === this.settings.contextTypesFile) {
							// Debounce sync
							setTimeout(async () => {
								await this.openAIService.syncTypesWithOpenAI();
								await this.saveSettings();
							}, 5000);
						}
					}
				})
			);
		}

		// Expose global API for Dataview compatibility
		this.exposeGlobalAPI();
	}

	onunload(): void {
		console.log("Unloading Learn Language plugin");

		// Remove global API
		if (window.learnLanguage) {
			delete (window as Partial<Window>).learnLanguage;
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Update services with new settings
		this.dictionaryService.updateSettings(this.settings);
		this.openAIService.updateSettings(this.settings);
		this.termService.updateSettings(this.settings);
		this.filterService.updateSettings(this.settings);
	}

	/**
	 * Register all plugin commands
	 */
	private registerCommands(): void {
		// Open Dictionary View
		this.addCommand({
			id: "open-dictionary-view",
			name: "Open Dictionary View",
			callback: () => {
				this.activateView(VIEW_TYPE_DICTIONARY);
			},
		});

		// Open Verbs View
		this.addCommand({
			id: "open-verbs-view",
			name: "Open Verbs View",
			callback: () => {
				this.activateView(VIEW_TYPE_VERBS);
			},
		});

		// Create New Term
		this.addCommand({
			id: "create-new-term",
			name: "Create New Term",
			callback: () => {
				this.termModal.openForCreate();
			},
		});

		// Ask AI for Term
		this.addCommand({
			id: "ask-ai-for-term",
			name: "Ask AI for Term",
			callback: () => {
				if (!this.openAIService.isConfigured()) {
					new Notice("OpenAI API key not configured. Go to plugin settings.");
					return;
				}
				this.askAIModal.open();
			},
		});

		// Edit Current Term (when viewing a dictionary file)
		this.addCommand({
			id: "edit-current-term",
			name: "Edit Current Term",
			checkCallback: (checking) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile && activeFile.path.startsWith(this.settings.dictionaryFolder)) {
					if (!checking) {
						this.editTermFromFile(activeFile);
					}
					return true;
				}
				return false;
			},
		});

		// Refresh Dictionary Cache
		this.addCommand({
			id: "refresh-dictionary-cache",
			name: "Refresh Dictionary Cache",
			callback: () => {
				this.dictionaryService.invalidateCache();
				new Notice("Dictionary cache refreshed!");
			},
		});

		// Reset OpenAI Thread
		this.addCommand({
			id: "reset-openai-thread",
			name: "Reset OpenAI Conversation",
			callback: async () => {
				if (!this.openAIService.isConfigured()) {
					new Notice("OpenAI API key not configured.");
					return;
				}
				await this.openAIService.resetThread();
				await this.saveSettings();
				new Notice("OpenAI conversation reset!");
			},
		});
	}

	/**
	 * Add ribbon icons
	 */
	private addRibbonIcons(): void {
		// Dictionary icon
		this.addRibbonIcon("book-open", "Open Dictionary", () => {
			this.activateView(VIEW_TYPE_DICTIONARY);
		});

		// Verbs icon
		this.addRibbonIcon("languages", "Open Verbs", () => {
			this.activateView(VIEW_TYPE_VERBS);
		});

		// Quick add term icon
		this.addRibbonIcon("plus-circle", "Create New Term", () => {
			this.termModal.openForCreate();
		});
	}

	/**
	 * Activate a view
	 */
	async activateView(viewType: string): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(viewType);

		if (leaves.length > 0) {
			// View already exists, reveal it
			leaf = leaves[0];
		} else {
			// Create new leaf in right sidebar
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: viewType, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Edit term from file
	 */
	private async editTermFromFile(file: TFile): Promise<void> {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter || {};

		// Read inline fields from file
		const content = await this.app.vault.read(file);
		const inlineFields: Record<string, string> = {};

		content.split("\n").forEach(line => {
			const match = line.match(/^([A-Za-z_-]+)::\s*(.*)$/);
			if (match) {
				inlineFields[match[1]] = match[2].trim();
			}
		});

		this.termModal.openForEdit(
			file.path,
			{
				target: file.basename,
				source: fm.Spanish || fm.spanish || "",
				type: inlineFields.Type || "",
				context: inlineFields.Context || "",
				examples: inlineFields.Examples || "",
			}
		);
	}

	/**
	 * Expose API for Dataview compatibility (Option C from plan)
	 * Accessible via:
	 *   - app.plugins.plugins["learn-language"].api (recommended)
	 *   - window.learnLanguage (legacy/compatibility)
	 */
	private exposeGlobalAPI(): void {
		this.api = {
			// Language settings
			targetLanguage: this.settings.targetLanguage,
			sourceLanguage: this.settings.sourceLanguage,

			// Data access
			getDictionary: () => this.dictionaryService.getDictionary(),
			getVerbs: () => this.dictionaryService.getVerbs(),
			getGrammarPages: () => this.dictionaryService.getGrammarPages(),
			createTerm: async (term) => {
				await this.termService.createOrUpdateTerm({
					targetTerm: term.targetWord || term.file?.basename || "",
					sourceTerm: term.sourceWord,
					type: term.type,
					context: term.context,
					examples: term.examples,
				});
			},
			updateTerm: async (filePath, updates) => {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
					await this.termService.updateTermFile(file, {
						targetTerm: file.basename,
						sourceTerm: updates.sourceWord,
						type: updates.type,
						context: updates.context,
						examples: updates.examples,
					});
				}
			},
			askAI: (term) => this.openAIService.askForTerm(term),
			filterEntries: (entries, filters) => this.filterService.applyFilters(entries, filters),
			paginateEntries: (entries, start, size) => this.filterService.paginate(entries, start, size),
		};

		// Also expose on window for legacy/compatibility
		window.learnLanguage = this.api;
	}
}
