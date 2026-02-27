import { App, PluginSettingTab, Setting, Notice, ButtonComponent, TFolder, TFile, AbstractInputSuggest } from "obsidian";
import type LearnLanguagePlugin from "./main";
import { LANGUAGE_LOCALE_MAP } from "./types";

/**
 * Folder suggester for folder path inputs
 */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const folders: TFolder[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((folder) => {
			if (
				folder instanceof TFolder &&
				folder.path.toLowerCase().contains(lowerCaseInputStr) &&
				!folder.path.includes("_assets")
			) {
				folders.push(folder);
			}
		});

		return folders.sort((a, b) => a.path.localeCompare(b.path));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.inputEl.value = folder.path;
		this.inputEl.trigger("input");
		this.close();
	}
}

/**
 * File suggester for markdown file inputs
 */
class FileSuggest extends AbstractInputSuggest<TFile> {
	private inputEl: HTMLInputElement;
	private extension: string;

	constructor(app: App, inputEl: HTMLInputElement, extension: string = "md") {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.extension = extension;
	}

	getSuggestions(inputStr: string): TFile[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const files: TFile[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((file) => {
			if (
				file instanceof TFile &&
				file.extension === this.extension &&
				file.path.toLowerCase().contains(lowerCaseInputStr) &&
				!file.path.includes("_assets")
			) {
				files.push(file);
			}
		});

		return files.sort((a, b) => a.path.localeCompare(b.path));
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger("input");
		this.close();
	}
}

export class LearnLanguageSettingTab extends PluginSettingTab {
	plugin: LearnLanguagePlugin;

	constructor(app: App, plugin: LearnLanguagePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h1", { text: "Learn Language Settings" });

		// =====================
		// Language Configuration Section
		// =====================
		containerEl.createEl("h2", { text: "Language Configuration" });

		// Get available languages from the locale map (sorted alphabetically)
		const availableLanguages = Object.keys(LANGUAGE_LOCALE_MAP).sort();

		new Setting(containerEl)
			.setName("Target language")
			.setDesc("The language you are learning")
			.addDropdown(dropdown => {
				availableLanguages.forEach(lang => {
					dropdown.addOption(lang, lang);
				});
				dropdown
					.setValue(this.plugin.settings.targetLanguage)
					.onChange(async (value) => {
						this.plugin.settings.targetLanguage = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Source language")
			.setDesc("Your native/source language")
			.addDropdown(dropdown => {
				availableLanguages.forEach(lang => {
					dropdown.addOption(lang, lang);
				});
				dropdown
					.setValue(this.plugin.settings.sourceLanguage)
					.onChange(async (value) => {
						this.plugin.settings.sourceLanguage = value;
						await this.plugin.saveSettings();
					});
			});

		// =====================
		// Folder Paths Section
		// =====================
		containerEl.createEl("h2", { text: "Folder Paths" });

		new Setting(containerEl)
			.setName("Dictionary folder")
			.setDesc("Folder containing dictionary entries")
			.addSearch(search => {
				new FolderSuggest(this.app, search.inputEl);
				search
					.setPlaceholder("10. Dictionary")
					.setValue(this.plugin.settings.dictionaryFolder)
					.onChange(async (value) => {
						this.plugin.settings.dictionaryFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Verbs folder")
			.setDesc("Folder containing verb entries (optional, uses dictionary if empty)")
			.addSearch(search => {
				new FolderSuggest(this.app, search.inputEl);
				search
					.setPlaceholder("15. Verbs")
					.setValue(this.plugin.settings.verbsFolder)
					.onChange(async (value) => {
						this.plugin.settings.verbsFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Grammar folder")
			.setDesc("Folder containing grammar resources")
			.addSearch(search => {
				new FolderSuggest(this.app, search.inputEl);
				search
					.setPlaceholder("30. Grammar")
					.setValue(this.plugin.settings.grammarFolder)
					.onChange(async (value) => {
						this.plugin.settings.grammarFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Templates folder")
			.setDesc("Folder containing note templates")
			.addSearch(search => {
				new FolderSuggest(this.app, search.inputEl);
				search
					.setPlaceholder("90. TEMPLATES")
					.setValue(this.plugin.settings.templatesFolder)
					.onChange(async (value) => {
						this.plugin.settings.templatesFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Term template file")
			.setDesc("Template file for creating new terms (leave empty to use default)")
			.addSearch(search => {
				new FileSuggest(this.app, search.inputEl, "md");
				search
					.setPlaceholder("90. TEMPLATES/tpl - New Term.md")
					.setValue(this.plugin.settings.termTemplateFile)
					.onChange(async (value) => {
						this.plugin.settings.termTemplateFile = value;
						await this.plugin.saveSettings();
					});
			});

		// =====================
		// Classification Files Section
		// =====================
		containerEl.createEl("h2", { text: "Classification Files" });

		new Setting(containerEl)
			.setName("Term types file")
			.setDesc("TextFile containing term type definitions")
			.addText(text => text
				.setPlaceholder("30. Grammar/TermTypes.txt")
				.setValue(this.plugin.settings.termTypesFile)
				.onChange(async (value) => {
					this.plugin.settings.termTypesFile = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Context types file")
			.setDesc("Text File containing context type definitions")
			.addText(text => text
				.setPlaceholder("30. Grammar/ContextTypes.txt")
				.setValue(this.plugin.settings.contextTypesFile)
				.onChange(async (value) => {
					this.plugin.settings.contextTypesFile = value;
					await this.plugin.saveSettings();
				}));

		// =====================
		// Display Settings Section
		// =====================
		containerEl.createEl("h2", { text: "Display Settings" });

		new Setting(containerEl)
			.setName("Default page size")
			.setDesc("Number of entries to display per page")
			.addDropdown(dropdown => dropdown
				.addOption("25", "25")
				.addOption("50", "50")
				.addOption("100", "100")
				.addOption("200", "200")
				.setValue(String(this.plugin.settings.defaultPageSize))
				.onChange(async (value) => {
					this.plugin.settings.defaultPageSize = parseInt(value, 10);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Enable study mode")
			.setDesc("Allow toggling study/flashcard mode in views")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableStudyMode)
				.onChange(async (value) => {
					this.plugin.settings.enableStudyMode = value;
					await this.plugin.saveSettings();
				}));

		// =====================
		// OpenAI Section
		// =====================
		containerEl.createEl("h2", { text: "OpenAI Integration" });

		new Setting(containerEl)
			.setName("OpenAI API key")
			.setDesc("Your OpenAI API key for AI-assisted term creation")
			.addText(text => {
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openAIApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openAIApiKey = value;
						await this.plugin.saveSettings();
						this.plugin.openAIService.updateSettings(this.plugin.settings);
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Auto-sync Classification Files with OpenAI")
			.setDesc("Automatically upload term and context types files when changed")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSyncClassificationFilesWithOpenAI)
				.onChange(async (value) => {
					this.plugin.settings.autoSyncClassificationFilesWithOpenAI = value;
					await this.plugin.saveSettings();
				}));

		// OpenAI Status
		const openAIStatus = containerEl.createDiv({ cls: "ll-openai-status" });

		if (this.plugin.settings.openAIApiKey) {
			openAIStatus.createEl("p", {
				text: "✅ OpenAI API key configured",
				cls: "ll-status-ok"
			});

			// Show responses config info
			const config = this.plugin.openAIService.getAssistantConfig();
			if (config?.vectorStoreId) {
				openAIStatus.createEl("p", {
					text: `Vector Store ID: ${config.vectorStoreId.substring(0, 20)}...`,
					cls: "ll-status-info"
				});
			}

			if (config?.previousResponseId) {
				openAIStatus.createEl("p", {
					text: `Previous Response ID: ${config.previousResponseId.substring(0, 20)}...`,
					cls: "ll-status-info"
				});
			}
		} else {
			openAIStatus.createEl("p", {
				text: "⚠️ OpenAI API key not configured",
				cls: "ll-status-warning"
			});
		}

		// OpenAI Actions
		const openAIActions = containerEl.createDiv({ cls: "ll-openai-actions" });

		new Setting(openAIActions)
			.setName("Sync Classification Files with OpenAI")
			.setDesc("Upload/re-upload term and context types files to OpenAI")
			.addButton(button => button
				.setButtonText("Sync Now")
				.onClick(async () => {
					if (!this.plugin.settings.openAIApiKey) {
						new Notice("Please configure OpenAI API key first");
						return;
					}

					new Notice("Syncing types with OpenAI...");
					try {
						await this.plugin.openAIService.syncClassificationFilesWithOpenAI();
						await this.plugin.saveSettings();
						new Notice("Types synced successfully!");
						this.display(); // Refresh to show new IDs
					} catch (error) {
						new Notice("Failed to sync types. Check console.");
						console.error(error);
					}
				}));

		new Setting(openAIActions)
			.setName("Reset conversation")
			.setDesc("Start a new conversation with the AI assistant")
			.addButton(button => button
				.setButtonText("Reset Conversation")
				.onClick(async () => {
					if (!this.plugin.settings.openAIApiKey) {
						new Notice("Please configure OpenAI API key first");
						return;
					}

					new Notice("Resetting conversation...");
					try {
						await this.plugin.openAIService.resetConversation();
						await this.plugin.saveSettings();
						new Notice("Conversation reset!");
						this.display();
					} catch (error) {
						new Notice("Failed to reset conversation. Check console.");
						console.error(error);
					}
				}));

		// =====================
		// Advanced Section
		// =====================
		containerEl.createEl("h2", { text: "Advanced" });

		new Setting(containerEl)
			.setName("Clear cache")
			.setDesc("Clear the dictionary cache to force reload")
			.addButton(button => button
				.setButtonText("Clear Cache")
				.onClick(() => {
					this.plugin.dictionaryService.invalidateCache();
					new Notice("Cache cleared!");
				}));

		// Debug info
		const debugInfo = containerEl.createDiv({ cls: "ll-debug-info" });
		debugInfo.createEl("h3", { text: "Debug Info" });
		debugInfo.createEl("p", { text: `Plugin version: 1.0.0` });
		debugInfo.createEl("p", { text: `Settings file: data.json` });
	}
}
