import { App, TFile, requestUrl } from "obsidian";
import {
	LearnLanguageSettings,
	AITermResponse
} from "../types";
import { getResponsesInstructions } from "./openAIServicesPrompts";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_MODEL = "gpt-4o";

export class OpenAIService {
	private app: App;
	private settings: LearnLanguageSettings;
	private saveSettingsCallback: () => Promise<void>;

	constructor(app: App, settings: LearnLanguageSettings, saveSettingsCallback: () => Promise<void>) {
		this.app = app;
		this.settings = settings;
		this.saveSettingsCallback = saveSettingsCallback;
	}

	updateSettings(settings: LearnLanguageSettings): void {
		this.settings = settings;
	}

	isConfigured(): boolean {
		return !!this.settings.openAIApiKey;
	}

	async askForTerm(term: string): Promise<AITermResponse | string | null> {
		if (!this.isConfigured()) {
			console.error("OpenAI API key not configured");
			return null;
		}

		try {
			let { termsFileId, contextFileId, vectorStoreId } = this.assistantConfig;
			const shouldSyncFiles =
				this.assistantConfig.updateTermsStructure ||
				this.assistantConfig.updateContextStructure ||
				!termsFileId ||
				!contextFileId ||
				!vectorStoreId;

			if (shouldSyncFiles) {
				await this.syncClassificationFilesWithOpenAI();
				termsFileId = this.assistantConfig.termsFileId || "";
				contextFileId = this.assistantConfig.contextFileId || "";
				vectorStoreId = this.assistantConfig.vectorStoreId || "";
			}

			if (!termsFileId || !contextFileId || !vectorStoreId) {
				console.error("Missing OpenAI classification resources.");
				return null;
			}

			const sourceLanguage = this.settings.sourceLanguage || "Spanish";
			const targetLanguage = this.settings.targetLanguage || "French";
			const termTypesFileName = "TermTypes.txt";
			const contextTypesFileName = "ContextTypes.txt";
			const instructions = getResponsesInstructions(
				sourceLanguage,
				targetLanguage,
				termTypesFileName,
				contextTypesFileName
			);

			const result = await this.callResponsesAPI(
				instructions,
				term,
				vectorStoreId,
				this.assistantConfig.previousResponseId || undefined,
				sourceLanguage
			);

			if (!result) {
				return null;
			}

			this.assistantConfig.previousResponseId = result.responseId;
			await this.saveAssistantConfig();

			return this.parseJsonResponse(result.responseText);
		} catch (error) {
			console.error("Error asking AI for term:", error);
			if (error instanceof Error) {
				return error.message;
			}
			return null;
		}
	}

	async uploadFile(filePath: string, purpose: string = "assistants"): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			console.error(`File not found: ${filePath}`);
			return null;
		}

		try {
			const content = await this.app.vault.read(file);
			const blob = new Blob([content], { type: "text/plain" });

			const formData = new FormData();
			formData.append("file", blob, file.name);
			formData.append("purpose", purpose);

			const response = await fetch(`${OPENAI_BASE_URL}/files`, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
				},
				body: formData,
			});

			const data = await response.json();
			if (!response.ok || data.error) {
				console.error("Error uploading file:", data.error || data);
				return null;
			}

			return data.id || null;
		} catch (error) {
			console.error("Error uploading file:", error);
			return null;
		}
	}

	async deleteFile(fileId: string): Promise<boolean> {
		try {
			await requestUrl({
				url: `${OPENAI_BASE_URL}/files/${fileId}`,
				method: "DELETE",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
				},
			});
			return true;
		} catch (error) {
			console.error("Error deleting file:", error);
			return false;
		}
	}

	async resetConversation(): Promise<void> {
		this.assistantConfig.previousResponseId = "";
		await this.saveAssistantConfig();
	}

	async forceRefresh(): Promise<void> {
		this.assistantConfig.updateTermsStructure = true;
		this.assistantConfig.updateContextStructure = true;
		this.assistantConfig.previousResponseId = "";
		await this.saveAssistantConfig();
	}

	async syncClassificationFilesWithOpenAI(): Promise<void> {
		if (this.assistantConfig.vectorStoreId) {
			await this.deleteVectorStore(this.assistantConfig.vectorStoreId);
		}

		if (this.assistantConfig.termsFileId) {
			await this.deleteFile(this.assistantConfig.termsFileId);
		}

		if (this.assistantConfig.contextFileId) {
			await this.deleteFile(this.assistantConfig.contextFileId);
		}

		const termsFileId = await this.uploadFile(this.settings.termTypesFile);
		const contextFileId = await this.uploadFile(this.settings.contextTypesFile);

		if (!termsFileId || !contextFileId) {
			throw new Error("Unable to upload classification files to OpenAI");
		}

		const vectorStoreName = `learn-language-${Date.now()}`;
		const vectorStoreId = await this.createVectorStore(vectorStoreName);
		if (!vectorStoreId) {
			throw new Error("Unable to create OpenAI vector store");
		}

		const termsAdded = await this.addFileToVectorStore(vectorStoreId, termsFileId);
		const contextAdded = await this.addFileToVectorStore(vectorStoreId, contextFileId);

		if (!termsAdded || !contextAdded) {
			throw new Error("Unable to index files in OpenAI vector store");
		}

		this.assistantConfig.termsFileId = termsFileId;
		this.assistantConfig.contextFileId = contextFileId;
		this.assistantConfig.vectorStoreId = vectorStoreId;
		this.assistantConfig.previousResponseId = "";
		this.assistantConfig.updateTermsStructure = false;
		this.assistantConfig.updateContextStructure = false;

		await this.saveAssistantConfig();
		console.log("Classification files synced with OpenAI:", {
			termsFileId,
			contextFileId,
			vectorStoreId
		});
	}

	getAssistantConfig(): typeof this.settings.askTermAssistant {
		return this.assistantConfig;
	}

	private get assistantConfig() {
		return this.settings.askTermAssistant;
	}

	private async saveAssistantConfig(): Promise<void> {
		await this.saveSettingsCallback();
	}

	private parseJsonResponse(response: string): AITermResponse | null {
		try {
			return JSON.parse(response) as AITermResponse;
		} catch {
			console.error("Failed to parse AI response as JSON:", response);
			return null;
		}
	}

	private async createVectorStore(name: string): Promise<string | null> {
		try {
			const response = await fetch(`${OPENAI_BASE_URL}/vector_stores`, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name }),
			});

			const data = await response.json();
			if (!response.ok || data.error) {
				console.error("Error creating vector store:", data.error || data);
				return null;
			}

			return data.id || null;
		} catch (error) {
			console.error("Error creating vector store:", error);
			return null;
		}
	}

	private async addFileToVectorStore(vectorStoreId: string, fileId: string): Promise<boolean> {
		try {
			const response = await fetch(`${OPENAI_BASE_URL}/vector_stores/${vectorStoreId}/files`, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ file_id: fileId }),
			});

			const data = await response.json();
			if (!response.ok || data.error) {
				console.error("Error adding file to vector store:", data.error || data);
				return false;
			}

			return true;
		} catch (error) {
			console.error("Error adding file to vector store:", error);
			return false;
		}
	}

	private async deleteVectorStore(vectorStoreId: string): Promise<boolean> {
		try {
			const response = await fetch(`${OPENAI_BASE_URL}/vector_stores/${vectorStoreId}`, {
				method: "DELETE",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
				},
			});

			if (!response.ok) {
				const data = await response.json();
				console.error("Error deleting vector store:", data?.error || data);
				return false;
			}

			return true;
		} catch (error) {
			console.error("Error deleting vector store:", error);
			return false;
		}
	}

	private async callResponsesAPI(
		instructions: string,
		userMessage: string,
		vectorStoreId: string,
		previousResponseId: string | undefined,
		sourceLanguage: string
	): Promise<{ responseText: string; responseId: string } | null> {
		const sourceLanguageKey = sourceLanguage.toLowerCase();
		const schema = {
			type: "object",
			properties: {
				[sourceLanguageKey]: { type: "string" },
				type: { type: "string" },
				context: { type: "string" },
				rating: { type: "string", enum: ["#⭐⭐⭐", "#⭐⭐", "#⭐"] },
				examples: { type: "string" }
			},
			required: [sourceLanguageKey, "type", "context", "rating", "examples"],
			additionalProperties: false
		};

		const body: Record<string, unknown> = {
			model: OPENAI_MODEL,
			instructions,
			input: [
				{
					role: "user",
					content: userMessage
				}
			],
			tools: [
				{
					type: "file_search",
					vector_store_ids: [vectorStoreId]
				}
			],
			text: {
				format: {
					type: "json_schema",
					name: "term_classification",
					strict: true,
					schema
				}
			},
			store: true
		};

		if (previousResponseId) {
			body.previous_response_id = previousResponseId;
		}

		const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.settings.openAIApiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		const data = await response.json();
		if (!response.ok || data.error) {
			const errorMessage = data?.error?.message || "OpenAI Responses API error";
			throw new Error(errorMessage);
		}

		const outputText = this.extractResponseText(data);
		if (!outputText) {
			console.error("No output text in Responses API result:", data);
			return null;
		}

		return {
			responseText: outputText,
			responseId: data.id || ""
		};
	}

	private extractResponseText(data: Record<string, unknown>): string | null {
		const outputText = data.output_text;
		if (typeof outputText === "string" && outputText.trim().length > 0) {
			return outputText;
		}

		const output = data.output;
		if (!Array.isArray(output)) {
			return null;
		}

		for (const item of output) {
			if (!item || typeof item !== "object") {
				continue;
			}

			const itemType = (item as Record<string, unknown>).type;
			if (itemType !== "message") {
				continue;
			}

			const content = (item as Record<string, unknown>).content;
			if (!Array.isArray(content)) {
				continue;
			}

			for (const part of content) {
				if (!part || typeof part !== "object") {
					continue;
				}

				const partRecord = part as Record<string, unknown>;
				if (partRecord.type === "output_text" && typeof partRecord.text === "string") {
					return partRecord.text;
				}
			}
		}

		return null;
	}
}
