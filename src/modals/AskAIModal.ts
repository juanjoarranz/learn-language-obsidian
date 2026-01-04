import {
	App,
	Modal,
	Setting,
	Notice,
	ButtonComponent
} from "obsidian";
import type LearnLanguagePlugin from "../main";
import type { AITermResponse } from "../types";

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
			.setName(`${this.plugin.settings.targetLanguage || "French"} term`)
			.setDesc(`Enter the ${this.plugin.settings.targetLanguage || "French"} term or expression to look up`)
			.addText(text => {
				text
					.setPlaceholder(`Enter ${this.plugin.settings.targetLanguage || "French"} term`)
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
			.setButtonText("Ask AI & Create or Update Term")
			.setCta()
			.onClick(async () => {
				await this.handleAsk();
			});
	}

	private async handleAsk(): Promise<void> {
		if (!this.termValue.trim()) {
			new Notice(`Please enter a ${this.plugin.settings.targetLanguage || "French"} term`);
			return;
		}

		if (!this.plugin.openAIService.isConfigured()) {
			new Notice("OpenAI API key not configured. Go to plugin settings.");
			return;
		}

		new Notice(`Asking AI for "${this.termValue}"...`);
		const response = await this.plugin.openAIService.askForTerm(this.termValue);

		console.log("JAA AI response:", response);

		// If response is not a valid JSON object (e.g., plain text message), show it as a Notice
		if (response && typeof response === 'string') {
			new Notice(response, 0);
			this.close();
			return;
		}

		const sourceLanguage = this.plugin.settings.sourceLanguage || "Spanish";
		if (response && typeof response === 'object') {
			const ai = response as AITermResponse;
			const sourceKey = sourceLanguage.toLowerCase();
			const sourceTerm = typeof ai[sourceKey] === "string" ? (ai[sourceKey] as string) : undefined;

			// Create the term with AI response
			const file = await this.plugin.termService.createOrUpdateTermPage({
				targetTerm: this.termValue,
				sourceTerm,
				type: ai.type,
				context: ai.context,
				examples: ai.examples,
				rating: ai.rating
			});

			if (file) {
				new Notice(`Term "${this.termValue}" created with AI data!`);
				try {
					await this.plugin.refreshOpenUIsAfterTermUpsert();
				} catch (e) {
					console.warn("LearnLanguage: failed to refresh open UIs after AskAI upsert", e);
				}
				//await this.app.workspace.openLinkText(file.path, ""); // ONLY IF WE WANT TO OPEN THE FILE
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
