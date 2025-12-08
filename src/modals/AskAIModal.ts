import {
	App,
	Modal,
	Setting,
	Notice,
	ButtonComponent
} from "obsidian";
import type LearnLanguagePlugin from "../main";

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

		new Notice(`Asking AI for "${this.termValue}"...`);
		const response = await this.plugin.openAIService.askForTerm(this.termValue);

    console.log('JAA AI response:', response);

		if (response) {
			// Create the term with AI response
			const file = await this.plugin.termService.createOrUpdateTerm({
				targetTerm: this.termValue,
				sourceTerm: response.spanish,
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
