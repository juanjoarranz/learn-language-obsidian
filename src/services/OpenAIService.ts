import { App, TFile, requestUrl, RequestUrlResponse } from "obsidian";
import {
	LearnLanguageSettings,
	AITermResponse,
	OpenAIAssistantConfig
} from "../types";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

/**
 * OpenAIService - Handles all OpenAI API interactions
 * Replaces logic from dvViews/openAI/quickAdd/createOrUpdateTerm.js
 */
export class OpenAIService {
	private app: App;
	private settings: LearnLanguageSettings;

	constructor(app: App, settings: LearnLanguageSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: LearnLanguageSettings): void {
		this.settings = settings;
	}

	/**
	 * Check if OpenAI is configured
	 */
	isConfigured(): boolean {
		return !!this.settings.openAIApiKey;
	}

	/**
	 * Ask AI for term translation and classification
	 */
	async askForTerm(term: string): Promise<AITermResponse | null> {
		if (!this.isConfigured()) {
			console.error("OpenAI API key not configured");
			return null;
		}

		try {
			// Ensure we have an assistant and thread
			await this.ensureAssistantAndThread();

			// Send the question
			const response = await this.askQuestion(term);

			if (!response) return null;

			// Parse JSON response
			try {
				const parsed = JSON.parse(response) as AITermResponse;
				return parsed;
			} catch {
				console.error("Failed to parse AI response as JSON:", response);
				return null;
			}
		} catch (error) {
			console.error("Error asking AI for term:", error);
			return null;
		}
	}

	/**
	 * Ensure assistant and thread are set up
	 */
	private async ensureAssistantAndThread(): Promise<void> {
		// Check if we need to create/update assistant
		if (!this.settings.assistantId) {
			await this.createAssistant();
		}

		// Check if we need to create thread
		if (!this.settings.threadId) {
			await this.createThread();
			await this.sendInitialInstructions();
		}
	}

	/**
	 * Upload a file to OpenAI
	 */
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
			return data.id || null;
		} catch (error) {
			console.error("Error uploading file:", error);
			return null;
		}
	}

	/**
	 * Delete a file from OpenAI
	 */
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

	/**
	 * Create OpenAI Assistant
	 */
	private async createAssistant(): Promise<void> {
		// Upload term types and context files if needed
		if (this.settings.autoSyncTypesWithOpenAI) {
			if (!this.settings.termsFileId) {
				const termsFileId = await this.uploadFile(this.settings.termTypesFile);
				if (termsFileId) {
					this.settings.termsFileId = termsFileId;
				}
			}

			if (!this.settings.contextFileId) {
				const contextFileId = await this.uploadFile(this.settings.contextTypesFile);
				if (contextFileId) {
					this.settings.contextFileId = contextFileId;
				}
			}
		}

		const assistantConfig = {
			name: "French Language Learning Assistant",
			description: "Assistant for French language learning - provides translations, term types, contexts, and examples",
			model: "gpt-4-turbo-preview",
			instructions: `Eres un asistente experto en el idioma francés. Tu trabajo es ayudar a clasificar términos franceses proporcionando:
1. Traducción al español
2. Tipo de término basado en los tipos disponibles
3. Contexto de uso
4. Ejemplos de uso

Siempre responde en formato JSON con la siguiente estructura:
{
  "spanish": "<traducción al español>",
  "type": "<tipo del término>",
  "context": "<contexto de uso>",
  "examples": "<ejemplo 1><br><ejemplo 2><br><ejemplo 3>"
}`,
			tools: [{ type: "file_search" }],
			tool_resources: this.settings.termsFileId && this.settings.contextFileId ? {
				file_search: {
					vector_stores: [{
						file_ids: [this.settings.termsFileId, this.settings.contextFileId]
					}]
				}
			} : undefined,
			response_format: { type: "json_object" },
		};

		try {
			const response = await requestUrl({
				url: `${OPENAI_BASE_URL}/assistants`,
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"Content-Type": "application/json",
					"OpenAI-Beta": "assistants=v2",
				},
				body: JSON.stringify(assistantConfig),
			});

			const data = response.json;
			this.settings.assistantId = data.id;
		} catch (error) {
			console.error("Error creating assistant:", error);
			throw error;
		}
	}

	/**
	 * Create a new thread
	 */
	private async createThread(): Promise<void> {
		const threadConfig: Record<string, unknown> = {};

		// Attach files to thread if available
		if (this.settings.termsFileId || this.settings.contextFileId) {
			const fileIds: string[] = [];
			if (this.settings.termsFileId) fileIds.push(this.settings.termsFileId);
			if (this.settings.contextFileId) fileIds.push(this.settings.contextFileId);

			threadConfig.tool_resources = {
				file_search: {
					vector_stores: [{
						file_ids: fileIds
					}]
				}
			};
		}

		try {
			const response = await requestUrl({
				url: `${OPENAI_BASE_URL}/threads`,
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"Content-Type": "application/json",
					"OpenAI-Beta": "assistants=v2",
				},
				body: JSON.stringify(threadConfig),
			});

			const data = response.json;
			this.settings.threadId = data.id;
		} catch (error) {
			console.error("Error creating thread:", error);
			throw error;
		}
	}

	/**
	 * Send initial instructions to the assistant
	 */
	private async sendInitialInstructions(): Promise<void> {
		const initialQuestion = `Por cada término o expresión francesa que te suministre posteriormente, dime primero su traducción al español, luego el tipo de término (type), luego el contexto (context) y finalmente algunos ejemplos de uso. Responde siempre en formato JSON.`;

		await this.askQuestion(initialQuestion);
		// Wait a bit for the assistant to process
		await this.sleep(2000);
	}

	/**
	 * Ask a question to the assistant
	 */
	private async askQuestion(question: string): Promise<string | null> {
		if (!this.settings.assistantId || !this.settings.threadId) {
			console.error("Assistant or thread not configured");
			return null;
		}

		try {
			// Add message to thread
			await requestUrl({
				url: `${OPENAI_BASE_URL}/threads/${this.settings.threadId}/messages`,
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"Content-Type": "application/json",
					"OpenAI-Beta": "assistants=v2",
				},
				body: JSON.stringify({
					role: "user",
					content: question,
				}),
			});

			// Run the assistant
			const runResponse = await requestUrl({
				url: `${OPENAI_BASE_URL}/threads/${this.settings.threadId}/runs`,
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"Content-Type": "application/json",
					"OpenAI-Beta": "assistants=v2",
				},
				body: JSON.stringify({
					assistant_id: this.settings.assistantId,
				}),
			});

			const runId = runResponse.json.id;

			// Poll for completion
			let status = runResponse.json.status;
			let attempts = 0;
			const maxAttempts = 60; // 60 seconds max

			while ((status === "in_progress" || status === "queued") && attempts < maxAttempts) {
				await this.sleep(1000);

				const statusResponse = await requestUrl({
					url: `${OPENAI_BASE_URL}/threads/${this.settings.threadId}/runs/${runId}`,
					method: "GET",
					headers: {
						"Authorization": `Bearer ${this.settings.openAIApiKey}`,
						"OpenAI-Beta": "assistants=v2",
					},
				});

				status = statusResponse.json.status;
				attempts++;
			}

			if (status !== "completed") {
				console.error(`Run did not complete. Status: ${status}`);
				if (status === "failed") {
					return null;
				}
				// Cancel the run if still in progress
				await this.cancelRun(runId);
				return null;
			}

			// Get messages
			const messagesResponse = await requestUrl({
				url: `${OPENAI_BASE_URL}/threads/${this.settings.threadId}/messages?limit=1&order=desc`,
				method: "GET",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"OpenAI-Beta": "assistants=v2",
				},
			});

			const messages = messagesResponse.json.data;
			if (messages && messages.length > 0) {
				const lastMessage = messages[0];
				if (lastMessage.role === "assistant" && lastMessage.content && lastMessage.content.length > 0) {
					const textContent = lastMessage.content.find((c: { type: string }) => c.type === "text");
					if (textContent) {
						return textContent.text.value;
					}
				}
			}

			return null;
		} catch (error) {
			console.error("Error asking question:", error);
			return null;
		}
	}

	/**
	 * Cancel a run
	 */
	private async cancelRun(runId: string): Promise<void> {
		try {
			await requestUrl({
				url: `${OPENAI_BASE_URL}/threads/${this.settings.threadId}/runs/${runId}/cancel`,
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"OpenAI-Beta": "assistants=v2",
				},
			});
		} catch (error) {
			console.error("Error canceling run:", error);
		}
	}

	/**
	 * Reset thread (create new conversation)
	 */
	async resetThread(): Promise<void> {
		this.settings.threadId = "";
		await this.createThread();
		await this.sendInitialInstructions();
	}

	/**
	 * Sync types files with OpenAI
	 */
	async syncTypesWithOpenAI(): Promise<void> {
		// Delete old files
		if (this.settings.termsFileId) {
			await this.deleteFile(this.settings.termsFileId);
			this.settings.termsFileId = "";
		}
		if (this.settings.contextFileId) {
			await this.deleteFile(this.settings.contextFileId);
			this.settings.contextFileId = "";
		}

		// Upload new files
		const termsFileId = await this.uploadFile(this.settings.termTypesFile);
		if (termsFileId) {
			this.settings.termsFileId = termsFileId;
		}

		const contextFileId = await this.uploadFile(this.settings.contextTypesFile);
		if (contextFileId) {
			this.settings.contextFileId = contextFileId;
		}

		// Reset assistant and thread to use new files
		this.settings.assistantId = "";
		this.settings.threadId = "";
	}

	/**
	 * Sleep helper
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
