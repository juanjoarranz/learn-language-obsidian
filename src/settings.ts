import { App, PluginSettingTab, Setting, Notice, ButtonComponent } from "obsidian";
import type LearnLanguagePlugin from "./main";

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
		// Folder Paths Section
		// =====================
		containerEl.createEl("h2", { text: "Folder Paths" });

		new Setting(containerEl)
			.setName("Dictionary folder")
			.setDesc("Folder containing dictionary entries")
			.addText(text => text
				.setPlaceholder("10. Dictionary")
				.setValue(this.plugin.settings.dictionaryFolder)
				.onChange(async (value) => {
					this.plugin.settings.dictionaryFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Verbs folder")
			.setDesc("Folder containing verb entries (optional, uses dictionary if empty)")
			.addText(text => text
				.setPlaceholder("15. Verbs")
				.setValue(this.plugin.settings.verbsFolder)
				.onChange(async (value) => {
					this.plugin.settings.verbsFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Grammar folder")
			.setDesc("Folder containing grammar resources")
			.addText(text => text
				.setPlaceholder("30. Grammar")
				.setValue(this.plugin.settings.grammarFolder)
				.onChange(async (value) => {
					this.plugin.settings.grammarFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Templates folder")
			.setDesc("Folder containing note templates")
			.addText(text => text
				.setPlaceholder("90. TEMPLATES")
				.setValue(this.plugin.settings.templatesFolder)
				.onChange(async (value) => {
					this.plugin.settings.templatesFolder = value;
					await this.plugin.saveSettings();
				}));

		// =====================
		// Classification Files Section
		// =====================
		containerEl.createEl("h2", { text: "Classification Files" });

		new Setting(containerEl)
			.setName("Term types file")
			.setDesc("File containing term type definitions")
			.addText(text => text
				.setPlaceholder("30. Grammar/TermTypes.txt")
				.setValue(this.plugin.settings.termTypesFile)
				.onChange(async (value) => {
					this.plugin.settings.termTypesFile = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Context types file")
			.setDesc("File containing context type definitions")
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
			.setName("Auto-sync types with OpenAI")
			.setDesc("Automatically upload term/context types files when changed")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSyncTypesWithOpenAI)
				.onChange(async (value) => {
					this.plugin.settings.autoSyncTypesWithOpenAI = value;
					await this.plugin.saveSettings();
				}));

		// OpenAI Status
		const openAIStatus = containerEl.createDiv({ cls: "ll-openai-status" });

		if (this.plugin.settings.openAIApiKey) {
			openAIStatus.createEl("p", {
				text: "✅ OpenAI API key configured",
				cls: "ll-status-ok"
			});

			if (this.plugin.settings.assistantId) {
				openAIStatus.createEl("p", {
					text: `Assistant ID: ${this.plugin.settings.assistantId.substring(0, 20)}...`,
					cls: "ll-status-info"
				});
			}

			if (this.plugin.settings.threadId) {
				openAIStatus.createEl("p", {
					text: `Thread ID: ${this.plugin.settings.threadId.substring(0, 20)}...`,
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
			.setName("Sync types files with OpenAI")
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
						await this.plugin.openAIService.syncTypesWithOpenAI();
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
			.setDesc("Start a new conversation thread with the AI assistant")
			.addButton(button => button
				.setButtonText("Reset Thread")
				.onClick(async () => {
					if (!this.plugin.settings.openAIApiKey) {
						new Notice("Please configure OpenAI API key first");
						return;
					}

					new Notice("Resetting conversation...");
					try {
						await this.plugin.openAIService.resetThread();
						await this.plugin.saveSettings();
						new Notice("Conversation reset!");
						this.display();
					} catch (error) {
						new Notice("Failed to reset thread. Check console.");
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
