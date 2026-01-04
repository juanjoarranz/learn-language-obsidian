import { App, Modal, Notice } from "obsidian";
import type LearnLanguagePlugin from "../main";
import { createReactRoot, ReactMountPoint } from "../utils/reactMount";
import { TermModalContent, TermFormValues } from "../components/modals/TermModalContent";

/**
 * TermModal - Modal wrapper that renders React content
 */
export class TermModal extends Modal {
	plugin: LearnLanguagePlugin;
	private reactMount: ReactMountPoint | null = null;

	// Mode
	private isEditing: boolean = false;
	private existingFilePath: string | null = null;

	// Initial values
	private initialValues: TermFormValues = {
		targetTerm: "",
		sourceTerm: "",
		type: "",
		context: "",
		examples: ""
	};

	// Callbacks
	private onSubmitCallback: ((result: TermFormValues) => void) | null = null;

	constructor(app: App, plugin: LearnLanguagePlugin) {
		super(app);
		this.plugin = plugin;
	}

	/**
	 * Open modal for creating a new term
	 */
	openForCreate(onSubmit?: (result: TermFormValues) => void): void {
		this.isEditing = false;
		this.existingFilePath = null;
		this.initialValues = {
			targetTerm: "",
			sourceTerm: "",
			type: "",
			context: "",
			examples: ""
		};
		this.onSubmitCallback = onSubmit || null;
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
		onSubmit?: (result: TermFormValues) => void
	): void {
		this.isEditing = true;
		this.existingFilePath = filePath;
		this.initialValues = {
			targetTerm: values.target,
			sourceTerm: values.source,
			type: values.type,
			context: values.context,
			examples: values.examples
		};
		this.onSubmitCallback = onSubmit || null;
		this.open();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ll-term-modal");

		const targetLanguage = this.plugin.settings.targetLanguage || "French";
		const sourceLanguage = this.plugin.settings.sourceLanguage || "Spanish";

		// Handle Ask AI
		const handleAskAI = async (term: string) => {
			new Notice(`Asking AI for "${term}"...`);
			const response = await this.plugin.openAIService.askForTerm(term);

			if (!response) {
				new Notice("Failed to get AI response");
				return null;
			}
			if (typeof response === "string") {
				new Notice(response, 0);
				return null;
			}

			new Notice("AI response applied!");
			const sourceKey = sourceLanguage.toLowerCase();
			return {
				sourceTerm: (response as unknown as Record<string, unknown>)[sourceKey] as string || "",
				type: response.type || "",
				context: response.context || "",
				examples: response.examples || ""
			};
		};

		// Handle submit
		const handleSubmit = async (values: TermFormValues) => {
			if (!values.targetTerm.trim()) {
				new Notice(`${targetLanguage} term is required`);
				return;
			}

			try {
				if (this.isEditing && this.existingFilePath) {
					// Update existing term
					await this.plugin.termService.updateTermFile(
						this.app.vault.getAbstractFileByPath(this.existingFilePath) as any,
						values
					);
					new Notice(`Term "${values.targetTerm}" updated!`);
					try {
						await this.plugin.refreshOpenUIsAfterTermUpsert();
					} catch (e) {
						console.warn("LearnLanguage: failed to refresh open UIs after TermModal update", e);
					}
				} else {
					// Create new term
					const file = await this.plugin.termService.createOrUpdateTermPage(values);
					if (file) {
						new Notice(`Term "${values.targetTerm}" created!`);
						// Open the new file
						await this.app.workspace.openLinkText(file.path, "");
						try {
							await this.plugin.refreshOpenUIsAfterTermUpsert();
						} catch (e) {
							console.warn("LearnLanguage: failed to refresh open UIs after TermModal create", e);
						}
					}
				}

				if (this.onSubmitCallback) {
					this.onSubmitCallback(values);
				}

				this.close();
			} catch (error) {
				console.error("Error saving term:", error);
				new Notice("Error saving term. Check console for details.");
			}
		};

		// Mount React component
		this.reactMount = createReactRoot(
			contentEl,
			this.app,
			this.plugin.settings,
			this.plugin.filterService,
			this.plugin.dictionaryService
		);

		this.reactMount.render(
			<TermModalContent
				isEditing={this.isEditing}
				initialValues={this.initialValues}
				targetLanguage={targetLanguage}
				sourceLanguage={sourceLanguage}
				aiEnabled={this.plugin.openAIService.isConfigured()}
				onAskAI={handleAskAI}
				onSubmit={handleSubmit}
				onClose={() => this.close()}
			/>
		);
	}

	onClose(): void {
		// Unmount React
		if (this.reactMount) {
			this.reactMount.unmount();
			this.reactMount = null;
		}
		const { contentEl } = this;
		contentEl.empty();
	}
}
