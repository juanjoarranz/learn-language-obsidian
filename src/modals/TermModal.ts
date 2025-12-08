import {
	App,
	Modal,
	Setting,
	Notice,
	TextComponent,
	TextAreaComponent,
	ButtonComponent
} from "obsidian";
import type LearnLanguagePlugin from "../main";
import { AITermResponse } from "../types";

/**
 * TermModal - Modal for creating and editing dictionary terms
 */
export class TermModal extends Modal {
	plugin: LearnLanguagePlugin;

	// Mode
	private isEditing: boolean = false;
	private existingFilePath: string | null = null;

	// Form values
	private targetValue: string = "";
	private sourceValue: string = "";
	private typeValue: string = "";
	private contextValue: string = "";
	private examplesValue: string = "";

	// Callbacks
	private onSubmit: ((result: {
		targetTerm: string;
		sourceTerm: string;
		type: string;
		context: string;
		examples: string;
	}) => void) | null = null;

	constructor(app: App, plugin: LearnLanguagePlugin) {
		super(app);
		this.plugin = plugin;
	}

	/**
	 * Open modal for creating a new term
	 */
	openForCreate(onSubmit?: (result: {
		targetTerm: string;
		sourceTerm: string;
		type: string;
		context: string;
		examples: string;
	}) => void): void {
		this.isEditing = false;
		this.existingFilePath = null;
		this.targetValue = "";
		this.sourceValue = "";
		this.typeValue = "";
		this.contextValue = "";
		this.examplesValue = "";
		this.onSubmit = onSubmit || null;
		this.open();
	}

	/**
	 * Open modal for editing an existing term
	 */
	openForEdit(
		filePath: string,
		values: {
			target: string;
			source: string;
			type: string;
			context: string;
			examples: string;
		},
		onSubmit?: (result: {
			targetTerm: string;
			sourceTerm: string;
			type: string;
			context: string;
			examples: string;
		}) => void
	): void {
		this.isEditing = true;
		this.existingFilePath = filePath;
		this.targetValue = values.target;
		this.sourceValue = values.source;
		this.typeValue = values.type;
		this.contextValue = values.context;
		this.examplesValue = values.examples;
		this.onSubmit = onSubmit || null;
		this.open();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ll-term-modal");
    const targetLanguage = this.plugin.settings.targetLanguage || "French";
    const sourceLanguage = this.plugin.settings.sourceLanguage || "Spanish";

		// Title
		contentEl.createEl("h2", {
			text: this.isEditing ? "Edit Term" : "Create New Term"
		});

		// Form
		const form = contentEl.createDiv({ cls: "ll-term-form" });

		// French input
		new Setting(form)
			.setName(targetLanguage)
			.setDesc(`The ${targetLanguage} term or expression`)
			.addText(text => {
				text
					.setPlaceholder(`Enter ${targetLanguage} term`)
					.setValue(this.targetValue)
					.onChange(value => {
						this.targetValue = value;
					});

				if (this.isEditing) {
					text.setDisabled(true);
				}
			});

		// Spanish input
		new Setting(form)
			.setName(sourceLanguage)
			.setDesc(`Translation to ${sourceLanguage}`)
			.addText(text => {
				text
					.setPlaceholder(`Enter ${sourceLanguage} translation`)
					.setValue(this.sourceValue)
					.onChange(value => {
						this.sourceValue = value;
					});
			});

		// Type input
		new Setting(form)
			.setName("Type")
			.setDesc("Term type (e.g., #verbe, #nom, #expression)")
			.addText(text => {
				text
					.setPlaceholder("#type/subtype")
					.setValue(this.typeValue)
					.onChange(value => {
						this.typeValue = value;
					});
			});

		// Context input
		new Setting(form)
			.setName("Context")
			.setDesc("Usage context (e.g., #social, #culinary)")
			.addText(text => {
				text
					.setPlaceholder("#context/subcontext")
					.setValue(this.contextValue)
					.onChange(value => {
						this.contextValue = value;
					});
			});

		// Examples textarea
		new Setting(form)
			.setName("Examples")
			.setDesc("Usage examples (separate with <br>)")
			.addTextArea(textarea => {
				textarea
					.setPlaceholder("Example 1<br>Example 2")
					.setValue(this.examplesValue)
					.onChange(value => {
						this.examplesValue = value;
					});
				textarea.inputEl.rows = 4;
			});

		// Buttons container
		const buttonsContainer = contentEl.createDiv({ cls: "ll-modal-buttons" });

		// Ask AI button (only for new terms)
		if (!this.isEditing && this.plugin.openAIService.isConfigured()) {
			new ButtonComponent(buttonsContainer)
				.setButtonText("Ask AI")
				.setIcon("bot")
				.onClick(async () => {
					if (!this.targetValue.trim()) {
						new Notice(`Please enter a ${targetLanguage} term first`);
						return;
					}

					new Notice("Asking AI...");
					const response = await this.plugin.openAIService.askForTerm(this.targetValue);

					if (response) {
						this.applyAIResponse(response);
						new Notice("AI response applied!");
					} else {
						new Notice("Failed to get AI response");
					}
				});
		}

		// Cancel button
		new ButtonComponent(buttonsContainer)
			.setButtonText("Cancel")
			.onClick(() => {
				this.close();
			});

		// Submit button
		new ButtonComponent(buttonsContainer)
			.setButtonText(this.isEditing ? "Update" : "Create")
			.setCta()
			.onClick(async () => {
				await this.handleSubmit();
			});
	}

	/**
	 * Apply AI response to form fields
	 */
	private applyAIResponse(response: AITermResponse): void {
    const sourceLanguage = this.plugin.settings.sourceLanguage || "Spanish";
		this.sourceValue = (response as unknown as Record<string, unknown>)[sourceLanguage.toLowerCase()] as string,
		this.typeValue = response.type;
		this.contextValue = response.context;
		this.examplesValue = response.examples;

		// Re-render to show updated values
		this.onOpen();
	}

	/**
	 * Handle form submission
	 */
	private async handleSubmit(): Promise<void> {
    const targetLanguage = this.plugin.settings.targetLanguage || "French";
		if (!this.targetValue.trim()) {
			new Notice(`${targetLanguage} term is required`);
			return;
		}

		const result = {
			targetTerm: this.targetValue.trim(),
			sourceTerm: this.sourceValue.trim(),
			type: this.typeValue.trim(),
			context: this.contextValue.trim(),
			examples: this.examplesValue.trim(),
		};

		try {
			if (this.isEditing && this.existingFilePath) {
				// Update existing term
				await this.plugin.termService.updateTermFile(
					this.app.vault.getAbstractFileByPath(this.existingFilePath) as any,
					result
				);
				new Notice(`Term "${result.targetTerm}" updated!`);
			} else {
				// Create new term
				const file = await this.plugin.termService.createOrUpdateTerm(result);
				if (file) {
					new Notice(`Term "${result.targetTerm}" created!`);
					// Open the new file
					await this.app.workspace.openLinkText(file.path, "");
				}
			}

			if (this.onSubmit) {
				this.onSubmit(result);
			}

			this.close();
		} catch (error) {
			console.error("Error saving term:", error);
			new Notice("Error saving term. Check console for details.");
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
