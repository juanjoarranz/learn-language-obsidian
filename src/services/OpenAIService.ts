import { App, TFile, requestUrl } from "obsidian";
import {
	LearnLanguageSettings,
	AITermResponse
} from "../types";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_MODEL = "gpt-4o"; // https://chatgpt.com/c/69466c48-990c-8333-95ff-be44e310932b
//const OPENAI_MODEL = "gpt-5.2-pro";

/**
 * OpenAIService - Handles all OpenAI API interactions
 * Based on logic from dvViews/openAI/quickAdd/createOrUpdateTerm.js
 */
export class OpenAIService {
	private app: App;
	private settings: LearnLanguageSettings;
	private saveSettingsCallback: () => Promise<void>;

	constructor(app: App, settings: LearnLanguageSettings, saveSettingsCallback: () => Promise<void>) {
		this.app = app;
		this.settings = settings;
		this.saveSettingsCallback = saveSettingsCallback;
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
	 * Get assistant config from settings
	 */
	private get assistantConfig() {
		return this.settings.askTermAssistant;
	}

	/**
	 * Save assistant config (saves entire settings)
	 */
	private async saveAssistantConfig(): Promise<void> {
		await this.saveSettingsCallback();
	}

	/**
	 * Ask AI for term translation and classification
	 * Returns AITermResponse on success, string on error (to display as notice), or null on failure
	 */
	async askForTerm(term: string): Promise<AITermResponse | string | null> {
		if (!this.isConfigured()) {
			console.error("OpenAI API key not configured");
			return null;
		}

		try {
			console.log("assistantConfig:", this.assistantConfig);

			let {
				updateAssistantId,
				isInitialQuestion,
				withAdditionalInstructions
			} = this.assistantConfig;

			let termsFileId: string = this.assistantConfig.termsFileId || "";
			let contextFileId: string = this.assistantConfig.contextFileId || "";
			let assistantId: string = this.assistantConfig.assistantId || "";
			let threadId: string = this.assistantConfig.threadId || "";

			// Check if we need to recreate assistant (when updateAssistantId flag is true)
			if (updateAssistantId || !assistantId) {
				console.log("Creating new assistant...");

				// Upload files if needed
				if (this.assistantConfig.updateTermsStructure || !termsFileId) {
					const newTermsFileId = await this.uploadFile(this.settings.termTypesFile);
					termsFileId = newTermsFileId || "";
					this.assistantConfig.termsFileId = termsFileId;
				}

				if (this.assistantConfig.updateContextStructure || !contextFileId) {
					const newContextFileId = await this.uploadFile(this.settings.contextTypesFile);
					contextFileId = newContextFileId || "";
					this.assistantConfig.contextFileId = contextFileId;
				}

				const newAssistantId = await this.createAssistant(termsFileId, contextFileId);

        if (!newAssistantId) {
          console.error("Failed to create assistant");
          return null;
        }

				assistantId = newAssistantId || "";
				this.assistantConfig.assistantId = assistantId;
				this.assistantConfig.updateAssistantId = false;
				this.assistantConfig.updateTermsStructure = false;
				this.assistantConfig.updateContextStructure = false;
				this.assistantConfig.isInitialQuestion = true;
				this.assistantConfig.withAdditionalInstructions = true;

				await this.saveAssistantConfig();

				isInitialQuestion = true;
				withAdditionalInstructions = true;
			}

			// Create new thread if needed (isInitialQuestion flag)
			if (isInitialQuestion || !threadId) {
				console.log("Creating new thread...");
				const fileIds = [termsFileId, contextFileId].filter(id => id.length > 0);
				const newThreadId = await this.createThread(fileIds);

				if (!newThreadId) {
					console.error("Failed to create thread");
					return null;
				}

				threadId = newThreadId;
				this.assistantConfig.threadId = threadId;
				this.assistantConfig.isInitialQuestion = false;

				// Send initial question
				await this.sendInitialQuestion(assistantId, threadId, termsFileId, contextFileId);
				await this.sleep(2000);

				await this.saveAssistantConfig();
			}

			// Send additional instructions if needed
			if (withAdditionalInstructions) {
				console.log("Sending additional instructions...");
				await this.sendAdditionalInstructions(assistantId, threadId, termsFileId, contextFileId);

				this.assistantConfig.withAdditionalInstructions = false;
				await this.saveAssistantConfig();

				await this.sleep(2000);
			}

			// Now ask the actual question
			console.log("Asking for term:", term);
			const response = await this.askAssistant(assistantId, threadId, term);

			if (!response) {
				console.error("No response from assistant");
				return null;
			}

			// Handle rate limit error - retry with new thread
			if (response === "rate_limit_exceeded") {
				console.log("Rate limit exceeded, creating new thread and retrying...");

				const fileIds = [termsFileId, contextFileId].filter(id => id.length > 0);
				const retryThreadId = await this.createThread(fileIds);
				if (!retryThreadId) return null;

				threadId = retryThreadId;
				this.assistantConfig.threadId = threadId;
				await this.saveAssistantConfig();

				await this.sendInitialQuestion(assistantId, threadId, termsFileId, contextFileId);
				await this.sleep(2000);

				await this.sendAdditionalInstructions(assistantId, threadId, termsFileId, contextFileId);
				await this.sleep(2000);

				const retryResponse = await this.askAssistant(assistantId, threadId, term);
				if (!retryResponse || retryResponse === "rate_limit_exceeded") {
					return null;
				}

				return this.parseJsonResponse(retryResponse);
			}

			return this.parseJsonResponse(response);

		} catch (error) {
			console.error("Error asking AI for term:", error);
			// Return error message as string to display in Notice
			if (error instanceof Error) {
				return error.message;
			}
			return null;
		}
	}

	/**
	 * Parse JSON response from assistant
	 */
	private parseJsonResponse(response: string): AITermResponse | null {
		try {
			return JSON.parse(response) as AITermResponse;
		} catch {
			console.error("Failed to parse AI response as JSON:", response);
			return null;
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
			console.log("File uploaded:", data);
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
	private async createAssistant(termsFileId: string, contextFileId: string): Promise<string | null> {
		const termTypesFileName = "TermTypes.txt";
		const contextTypesFileName = "ContextTypes.txt";
    const targetLanguage = this.settings.targetLanguage || "French";
    const sourceLanguage = this.settings.sourceLanguage || "Spanish";
		try {
			const response = await fetch(`${OPENAI_BASE_URL}/assistants`, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"Content-Type": "application/json",
					"OpenAI-Beta": "assistants=v2",
				},
				body: JSON.stringify({
					model: OPENAI_MODEL,
					instructions: `Usa los ficheros adjuntos para clasificar el término en ${targetLanguage} que posteriormente te suministraré. Por ejemplo el término 'au debut' es de tipo #adverbe/loc_adverbial. No añadas la traducción posterior en ${sourceLanguage} que hay entre paréntesis.

El valor type lo debes deducir a partir del fichero ${termTypesFileName} con id ${termsFileId}.

El valor context lo debes deducir a partir del fichero ${contextTypesFileName} con id ${contextFileId}.`,
					tools: [{ type: "file_search" }]
				}),
			});

			const data = await response.json();

			// Handle API error responses
			if (data.error) {
				const errorMessage = data.error.message || "Unknown error";
				console.error("OpenAI API Error:", data.error);
				throw new Error(errorMessage);
			}

			console.log("Assistant created:", data);

			return data.id || null;
		} catch (error) {
			console.error("Error creating assistant:", error);
			throw error;
		}
	}

	/**
	 * Create a new thread with attached files
	 */
	private async createThread(fileIds: string[]): Promise<string | null> {
		const attachments = fileIds.map(id => ({
			file_id: id,
			tools: [{ type: "file_search" }]
		}));

		try {
			const response = await fetch(`${OPENAI_BASE_URL}/threads`, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"Content-Type": "application/json",
					"OpenAI-Beta": "assistants=v2",
				},
				body: JSON.stringify({
					messages: [{
						role: "user",
						content: "Consulta los archivos adjuntos para responder.",
						attachments
					}]
				}),
			});

			const data = await response.json();
			console.log("Thread created:", data);
			return data.id || null;
		} catch (error) {
			console.error("Error creating thread:", error);
			return null;
		}
	}

	/**
	 * Send initial question to establish context
	 */
	private async sendInitialQuestion(
		assistantId: string,
		threadId: string,
		termsFileId: string,
		contextFileId: string
	): Promise<void> {
		const termTypesFileName = "TermTypes.txt";
		const contextTypesFileName = "ContextTypes.txt";
    const sourceLanguage = this.settings.sourceLanguage || "Spanish";


		const initialQuestion = `Por cada término o expresión que te suministre posteriormente, dime primero su traducción al ${sourceLanguage}, luego el tipo de término (type) basado en el fichero ${termTypesFileName} con id ${termsFileId}, luego el contexto (context) basado en el fichero ${contextTypesFileName} con id ${contextFileId} y finalmente algunos ejemplos`;

		await this.askAssistant(assistantId, threadId, initialQuestion);
	}

	/**
	 * Send additional instructions for JSON response format
	 */
	private async sendAdditionalInstructions(
		assistantId: string,
		threadId: string,
		termsFileId: string,
		contextFileId: string
	): Promise<void> {
		const termTypesFileName = "TermTypes.txt";
		const contextTypesFileName = "ContextTypes.txt";
    const sourceLanguage = this.settings.sourceLanguage || "Spanish";
		const commonInstructions = `
El valor del tipo de término debe ser el más exacto y preciso, por ejemplo #verbe/irrégulier/3/ir es más completo y preciso que #verbe/irrégulier/3.

El valor del tipo de término puede ser múltiple, por ejemplo auberge se corresponde con #nom/commun, #nom/masculin y #nom/singulier. En estos casos establece el valor final type con cada uno de los tipos SEPARADOS por un espacio y una coma.

Cuando un valor de tipo de término ya aparece en el nivel inferior, dicho valor no se duplica: por ejemplo dado que #verbe/régulier/1 ya contiene verbe, el valor #verbe no se debe repetir en el resultado final.

Muy importante: el valor del tipo de término (type) se obtiene exclusivamente de los valores del fichero ${termTypesFileName} con id ${termsFileId}. No se pueden inventar nuevos valores.

No inventes valores de type. Por ejemplo el type #préposition/loc_prépositionnelle no existe en el fichero ${termTypesFileName} con id ${termsFileId}. Utiliza el valor que mejor que se corresponda con el fichero ${termTypesFileName} con id ${termsFileId}.

De igual forma el valor de context se obtiene exclusivamente de los valores del fichero ${contextTypesFileName} con id ${contextFileId} (no inventes nuevos valores). Por ejemplo el contexto #animals no existe en el fichero ${contextTypesFileName} con id ${contextFileId}, en su lugar debes utilizar el valor #env/animal que sí existe en el fichero ${contextTypesFileName} con id ${contextFileId}.

No inventes valores de context. Por ejemplo el context #society no existe en el fichero ${contextTypesFileName} con id ${contextFileId}. Tampoco el valor #shopping/clothes existe en el fichero ${contextTypesFileName} con id ${contextFileId}. Tampoco existe el context #economy/agriculture.

El context #economy/agriculture no existe en el fichero ${contextTypesFileName} con id ${contextFileId}. Deja el resultado en blanco o vacío en esos casos.

Si el context de un término no se puede asociar a un valor del fichero ${contextTypesFileName} con id ${contextFileId} entonces se deja vacío.

El valor del contexto puede ser nulo si el término no se puede asociar a ningún contexto, puede ser un sólo valor, o puede ser múltiple y en estos casos establece el valor final con cada uno de los tipos separados por coma.

En los ejemplos encierra el término objetivo entre asteriscos, por ejemplo para el término arnaque un ejemplo sería "Elle a été victime d'une *arnaque* financière."

Cuando se trate de un verbo los ejemplos que generes hazlo con diferentes formas verbales que ilustren su uso. Repito, cuando se trate de un verbo, los ejemplos deben siempre utilizar diferentes formas verbales. Respeta siempre esta instrucción.

En la respuesta no quiero que muestres la referencia al fichero utilizado, tan sólo responde con el formato json.`;

		const clarification = `
Quiero la respuesta en formato json según el siguiente esquema:

{
  "sourceLanguage": <valor de la traducción al ${sourceLanguage} del término que te he suministrado>,
  "type": <valor tipo de término por ejemplo #pronom/personnel/réfléchi o si es multiple pon los valores separadods por coma y espacio por ejemplo #nom/commun , #nom/masculin>,
  "context": <valor del tipo del contexto por ejemplo #travel/transport>,
  "examples": <ejemplo1<br>ejemplo2<br>ejemplo3>
}

No envuelvas la respuesta json con el calificador triple coma invertida-json. Limítate a devolver un string json con el esquema especificado anteriormente.

${commonInstructions}`;

		await this.askAssistant(assistantId, threadId, clarification);
	}

	/**
	 * Ask a question to the assistant (core method based on legacy askAssistant)
	 */
	private async askAssistant(
		assistantId: string,
		threadId: string,
		question: string
	): Promise<string | null> {
		console.log("Asking assistant:", question.substring(0, 100) + "...");

		try {
			// Add message to thread
			await fetch(`${OPENAI_BASE_URL}/threads/${threadId}/messages`, {
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

			console.log(`Message sent to thread ${threadId}`);

			// Run the assistant
			const runResponse = await fetch(`${OPENAI_BASE_URL}/threads/${threadId}/runs`, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.settings.openAIApiKey}`,
					"Content-Type": "application/json",
					"OpenAI-Beta": "assistants=v2",
				},
				body: JSON.stringify({
					assistant_id: assistantId,
				}),
			});

			const runData = await runResponse.json();
			console.log("Run started:", runData);

			if (runData.error) {
				console.error("Run error:", runData.error);
				return null;
			}

			const runId = runData.id;

			// Poll for completion
			let status = "in_progress";
			let runStatusData: { status: string; last_error?: { code: string } } = { status: "" };

			while (status === "in_progress" || status === "queued") {
				await this.sleep(2000);

				const statusResponse = await fetch(
					`${OPENAI_BASE_URL}/threads/${threadId}/runs/${runId}`,
					{
						method: "GET",
						headers: {
							"Authorization": `Bearer ${this.settings.openAIApiKey}`,
							"OpenAI-Beta": "assistants=v2",
						},
					}
				);

				runStatusData = await statusResponse.json();
				status = runStatusData.status;
				console.log("Run status:", status);
			}

			// Handle failed run
			if (status === "failed") {
				const errorCode = runStatusData.last_error?.code;
				console.error("Run failed:", runStatusData.last_error);
				if (errorCode === "rate_limit_exceeded") {
					return "rate_limit_exceeded";
				}
				return null;
			}

			if (status !== "completed") {
				console.error(`Run did not complete. Status: ${status}`);
				return null;
			}

			// Get messages
			const messagesResponse = await fetch(
				`${OPENAI_BASE_URL}/threads/${threadId}/messages`,
				{
					method: "GET",
					headers: {
						"Authorization": `Bearer ${this.settings.openAIApiKey}`,
						"OpenAI-Beta": "assistants=v2",
					},
				}
			);

			const messagesData = await messagesResponse.json();
			const assistantMessages = messagesData.data?.filter(
				(msg: { role: string }) => msg.role === "assistant"
			);

			if (assistantMessages && assistantMessages.length > 0) {
				const responseText = assistantMessages[0].content[0]?.text?.value;
				console.log("Assistant response received");
				return responseText || null;
			}

			console.log("No assistant response found");
			return null;

		} catch (error) {
			console.error("Error asking assistant:", error);
			return null;
		}
	}

	/**
	 * Reset thread (create new conversation)
	 */
	async resetThread(): Promise<void> {
		const fileIds = [
			this.assistantConfig.termsFileId,
			this.assistantConfig.contextFileId
		].filter(Boolean);

		const threadId = await this.createThread(fileIds);
		if (threadId) {
			this.assistantConfig.threadId = threadId;
			this.assistantConfig.isInitialQuestion = true;
			this.assistantConfig.withAdditionalInstructions = true;
			await this.saveAssistantConfig();
		}
	}

	/**
	 * Force refresh - recreate assistant and thread
	 */
	async forceRefresh(): Promise<void> {
		this.assistantConfig.updateAssistantId = true;
		this.assistantConfig.isInitialQuestion = true;
		this.assistantConfig.withAdditionalInstructions = true;
		await this.saveAssistantConfig();
	}

	/**
	 * Sync types files with OpenAI - re-upload term and context files
	 */
	async syncTypesWithOpenAI(): Promise<void> {
		// Delete old files if they exist
		if (this.assistantConfig.termsFileId) {
			await this.deleteFile(this.assistantConfig.termsFileId);
		}
		if (this.assistantConfig.contextFileId) {
			await this.deleteFile(this.assistantConfig.contextFileId);
		}

		// Upload new files
		const termsFileId = await this.uploadFile(this.settings.termTypesFile);
		const contextFileId = await this.uploadFile(this.settings.contextTypesFile);

		// Update config
		this.assistantConfig.termsFileId = termsFileId || "";
		this.assistantConfig.contextFileId = contextFileId || "";
		this.assistantConfig.updateTermsStructure = false;
		this.assistantConfig.updateContextStructure = false;
		this.assistantConfig.updateAssistantId = true; // Need to recreate assistant with new files
		this.assistantConfig.isInitialQuestion = true;
		this.assistantConfig.withAdditionalInstructions = true;

		await this.saveAssistantConfig();
		console.log("Types synced with OpenAI:", {
			termsFileId,
			contextFileId
		});
	}

	/**
	 * Get current assistant config (for display in settings)
	 */
	getAssistantConfig(): typeof this.settings.askTermAssistant {
		return this.assistantConfig;
	}

	/**
	 * Sleep helper
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
