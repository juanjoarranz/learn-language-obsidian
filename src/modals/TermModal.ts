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
	private frenchValue: string = "";
	private spanishValue: string = "";
	private typeValue: string = "";
	private contextValue: string = "";
	private examplesValue: string = "";

	// Callbacks
	private onSubmit: ((result: {
		french: string;
		spanish: string;
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
		french: string;
		spanish: string;
		type: string;
		context: string;
		examples: string;
	}) => void): void {
		this.isEditing = false;
		this.existingFilePath = null;
		this.frenchValue = "";
		this.spanishValue = "";
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
			french: string;
			spanish: string;
			type: string;
			context: string;
			examples: string;
		},
		onSubmit?: (result: {
			french: string;
			spanish: string;
			type: string;
			context: string;
			examples: string;
		}) => void
	): void {
		this.isEditing = true;
		this.existingFilePath = filePath;
		this.frenchValue = values.french;
		this.spanishValue = values.spanish;
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

		// Title
		contentEl.createEl("h2", {
			text: this.isEditing ? "Edit Term" : "Create New Term"
		});

		// Form
		const form = contentEl.createDiv({ cls: "ll-term-form" });

		// French input
		new Setting(form)
			.setName("French")
			.setDesc("The French term or expression")
			.addText(text => {
				text
					.setPlaceholder("Enter French term")
					.setValue(this.frenchValue)
					.onChange(value => {
						this.frenchValue = value;
					});

				if (this.isEditing) {
					text.setDisabled(true);
				}
			});

		// Spanish input
		new Setting(form)
			.setName("Spanish")
			.setDesc("Translation to Spanish")
			.addText(text => {
				text
					.setPlaceholder("Enter Spanish translation")
					.setValue(this.spanishValue)
					.onChange(value => {
						this.spanishValue = value;
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
					if (!this.frenchValue.trim()) {
						new Notice("Please enter a French term first");
						return;
					}

					new Notice("Asking AI...");
					const response = await this.plugin.openAIService.askForTerm(this.frenchValue);

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
		this.spanishValue = response.spanish;
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
		if (!this.frenchValue.trim()) {
			new Notice("French term is required");
			return;
		}

		const result = {
			french: this.frenchValue.trim(),
			spanish: this.spanishValue.trim(),
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
				new Notice(`Term "${result.french}" updated!`);
			} else {
				// Create new term
				const file = await this.plugin.termService.createOrUpdateTerm(result);
				if (file) {
					new Notice(`Term "${result.french}" created!`);
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

/**
 * Quick input modal for asking AI about a term
 */
export class AskAIModal extends Modal {
	plugin: LearnLanguagePlugin;
	private termValue: string = "";

	constructor(app: App, plugin: LearnLanguagePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ll-ask-ai-modal");

		contentEl.createEl("h2", { text: "Ask AI for Term" });

		new Setting(contentEl)
			.setName("French term")
			.setDesc("Enter the French term or expression to look up")
			.addText(text => {
				text
					.setPlaceholder("Enter French term")
					.onChange(value => {
						this.termValue = value;
					});

				// Focus and handle enter key
				text.inputEl.focus();
				text.inputEl.addEventListener("keydown", async (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						await this.handleAsk();
					}
				});
			});

		const buttonsContainer = contentEl.createDiv({ cls: "ll-modal-buttons" });

		new ButtonComponent(buttonsContainer)
			.setButtonText("Cancel")
			.onClick(() => {
				this.close();
			});

		new ButtonComponent(buttonsContainer)
			.setButtonText("Ask AI & Create")
			.setCta()
			.onClick(async () => {
				await this.handleAsk();
			});
	}

	private async handleAsk(): Promise<void> {
		if (!this.termValue.trim()) {
			new Notice("Please enter a French term");
			return;
		}

		if (!this.plugin.openAIService.isConfigured()) {
			new Notice("OpenAI API key not configured. Go to plugin settings.");
			return;
		}

		new Notice("Asking AI...");
		const response = await this.plugin.openAIService.askForTerm(this.termValue);

		if (response) {
			// Create the term with AI response
			const file = await this.plugin.termService.createOrUpdateTerm({
				french: this.termValue,
				spanish: response.spanish,
				type: response.type,
				context: response.context,
				examples: response.examples,
			});

			if (file) {
				new Notice(`Term "${this.termValue}" created with AI data!`);
				await this.app.workspace.openLinkText(file.path, "");
			}

			this.close();
		} else {
			new Notice("Failed to get AI response. Try again later.");
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
