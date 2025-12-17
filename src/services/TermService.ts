import { App, TFile, Notice } from "obsidian";
import {
	DictionaryEntry,
	LearnLanguageSettings,
	AITermResponse
} from "../types";

/**
 * TermService - Handles term file creation and updates
 * Based on createOrUpdateTermPage() and createTermFile() from dvViews/utils.js
 */
export class TermService {
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
	 * Create or update a term page (main entry point)
	 * Based on legacy createOrUpdateTermPage()
	 */
	async createOrUpdateTermPage(term: {
		targetTerm: string;
		sourceTerm?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): Promise<TFile | null> {
		const fileName = term.targetTerm;
		const filePath = `${this.settings.dictionaryFolder}/${fileName}.md`;

		// Check if file already exists
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (existingFile instanceof TFile) {
			// Update existing file (only update empty fields)
			await this.updateTermPageProperties(existingFile, term);
			return existingFile;
		} else {
			// Create new file from template
			return await this.createTermFile(term);
		}
	}

	/**
	 * Create a new term file from template
	 * Based on legacy createTermFile()
	 */
	async createTermFile(term: {
		targetTerm: string;
		sourceTerm?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): Promise<TFile | null> {
		// Get template content
		let fileContent = "";
		const templatePath = this.settings.termTemplateFile || `${this.settings.templatesFolder}/tpl - New Term.md`;
		const templateFile = this.app.vault.getAbstractFileByPath(templatePath);

		if (templateFile instanceof TFile) {
			fileContent = await this.app.vault.read(templateFile);
			// Replace placeholders in template
			fileContent = this.replaceTemplatePlaceholders(fileContent, term);
		} else {
			console.log(`Template file "${templatePath}" not found, using default content.`);
			fileContent = this.getDefaultTermContent();
		}

		const fullFilePath = `${this.settings.dictionaryFolder}/${term.targetTerm}.md`;

		try {
			// Create the file
			const newFile = await this.app.vault.create(fullFilePath, fileContent);
			console.log("File created:", fullFilePath);

			// Update inline fields sequentially to avoid race conditions with vault.process()
			if (term.type) {
				await this.updateInlineFieldValue(fullFilePath, "Type", term.type);
			}
			if (term.context) {
				await this.updateInlineFieldValue(fullFilePath, "Context", term.context);
			}
			if (term.examples) {
				await this.updateInlineFieldValue(fullFilePath, "Examples", term.examples);
			}

			// Update frontmatter
			if (term.sourceTerm) {
				await this.storeFrontmatterProperty(fullFilePath, this.settings.sourceLanguage, term.sourceTerm);
			}

			new Notice(`Successfully created the note file: ${term.targetTerm}`, 10000);
			return newFile;

		} catch (error) {
			console.error("Error creating term file:", error);
			return null;
		}
	}

	/**
	 * Update an existing term page properties (only update empty fields)
	 * Based on legacy updateTermPageProperties()
	 */
	async updateTermPageProperties(file: TFile, term: {
		targetTerm: string;
		sourceTerm?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): Promise<void> {
		const filePath = file.path;
		let termUpdated = false;

		// Read current content to check existing values
		const content = await this.app.vault.read(file);

		// Get current inline field values
		const currentType = this.getInlineFieldValue(content, "Type");
		const currentContext = this.getInlineFieldValue(content, "Context");
		const currentExamples = this.getInlineFieldValue(content, "Examples");

		// Update Type only if empty
		if ((!currentType || currentType === undefined || currentType === "") && term.type) {
			console.log(`Updating Type for ${term.targetTerm}`);
			await this.updateInlineFieldValue(filePath, "Type", term.type);
			termUpdated = true;
		}

		// Update Context only if empty
		if ((!currentContext || currentContext === undefined || currentContext === "") && term.context) {
			await this.updateInlineFieldValue(filePath, "Context", term.context);
			termUpdated = true;
		}

		// Update Examples: add new examples if less than 3 exist
		if (term.examples) {
			const currentExamplesCount = currentExamples ? currentExamples.split("<br>").length : 0;
			console.log("currentExamplesCount", currentExamplesCount);

			if (!currentExamples || currentExamples === undefined || currentExamples === "" || currentExamplesCount < 3) {
				if (currentExamplesCount === 0) {
					await this.updateInlineFieldValue(filePath, "Examples", term.examples);
				} else {
					const updatedExamples = `${currentExamples}<br>${term.examples}`;
					await this.updateInlineFieldValue(filePath, "Examples", updatedExamples);
				}
				termUpdated = true;
			}
		}

		if (termUpdated) {
			new Notice(`Successfully updated the term: ${term.targetTerm}`, 10000);
		} else {
			new Notice(`The term "${term.targetTerm}" HAS NOT been updated`, 10000);
		}
	}

	/**
	 * Update an existing term file (force update all provided fields)
	 * Used by the edit modal to update all fields regardless of existing values
	 */
	async updateTermFile(file: TFile, term: {
		targetTerm: string;
		sourceTerm?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): Promise<void> {
		const filePath = file.path;

		// Update inline fields sequentially to avoid race conditions with vault.process()
		if (term.type !== undefined) {
			await this.updateInlineFieldValue(filePath, "Type", term.type);
		}
		if (term.context !== undefined) {
			await this.updateInlineFieldValue(filePath, "Context", term.context);
		}
		if (term.examples !== undefined) {
			await this.updateInlineFieldValue(filePath, "Examples", term.examples);
		}

		// Update frontmatter
		if (term.sourceTerm !== undefined) {
			await this.storeFrontmatterProperty(filePath, this.settings.sourceLanguage, term.sourceTerm);
		}
	}

	/**
	 * Update a term from AI response
	 */
	async updateTermFromAI(targetTerm: string, aiResponse: AITermResponse): Promise<TFile | null> {
		const sourceLang = this.settings.sourceLanguage.toLowerCase();

		// Get the source translation from the AI response using the configured source language
		const sourceTerm = (aiResponse as unknown as Record<string, unknown>)[sourceLang] as string;

		return await this.createOrUpdateTermPage({
			targetTerm: targetTerm,
			sourceTerm: sourceTerm,
			type: aiResponse.type,
			context: aiResponse.context,
			examples: aiResponse.examples,
		});
	}

	/**
	 * Get inline field value from content
	 */
	private getInlineFieldValue(content: string, fieldName: string): string | null {
		// Use [^\S\n]* instead of \s* to match whitespace WITHOUT consuming newlines
		const regex = new RegExp(`^${fieldName}\\s*::[^\\S\\n]*(.*)$`, "m");
		const match = content.match(regex);
		if (match && match[1]) {
			return match[1].trim();
		}
		return null;
	}

	/**
	 * Update a single inline field in a file (public API)
	 * Used by UI components to update individual fields like Revision or Rating
	 */
	async updateField(filePath: string, fieldName: string, fieldValue: string): Promise<void> {
		await this.updateInlineFieldValue(filePath, fieldName, fieldValue);
	}

	/**
	 * Update inline field in file
	 * Based on legacy updateInlineFieldValue()
	 */
	private async updateInlineFieldValue(filePath: string, fieldName: string, fieldValue: string): Promise<void> {
		const vaultFile = this.app.vault.getAbstractFileByPath(filePath);
		if (!(vaultFile instanceof TFile)) {
			console.error(`File not found: ${filePath}`);
			return;
		}

		await this.app.vault.process(vaultFile, (data) => {
			// Legacy regex: matches field at start of line, optional space, ::, then anything until newline
			const re = new RegExp(`^${fieldName}\\s?::.*`, "m");
			const match = data.match(re);
			if (match) {
				data = data.replace(re, `${fieldName}:: ${fieldValue}`);
			}
			return data;
		});
	}

	/**
	 * Store frontmatter property
	 * Based on legacy storeFrontmatterProperty()
	 */
	private async storeFrontmatterProperty(filePath: string, key: string, value: string): Promise<void> {
		const vaultFile = this.app.vault.getAbstractFileByPath(filePath);
		if (!(vaultFile instanceof TFile)) {
			console.error(`File not found: ${filePath}`);
			return;
		}

		await this.app.fileManager.processFrontMatter(vaultFile, (frontmatter) => {
			frontmatter[key] = value;
		});
	}

	/**
	 * Get default term content when no template exists
	 */
	private getDefaultTermContent(): string {
		const sourceLang = this.settings.sourceLanguage;
		return `---
${sourceLang}:
cssclasses:
  - ja-readable
---

Type::
Synonyms::
Context::
Examples::
Rating::
Relations::
Revision::
Project:: [[Learn ${this.settings.targetLanguage}]]

---

## Notes

`;
	}

	/**
	 * Replace placeholders in template content
	 */
	private replaceTemplatePlaceholders(content: string, term: {
		targetTerm: string;
	}): string {
		let result = content;

    // Language name placeholders (e.g., "SourceLanguage" -> "Spanish")
		result = result.replace(/SourceLanguage/g, this.settings.sourceLanguage);
		result = result.replace(/TargetLanguage/g, this.settings.targetLanguage);

		// Templater-style placeholders
		result = result.replace(/<% tp\.file\.title %>/g, term.targetTerm);
		return result;
	}

	/**
	 * Capitalize first letter
	 */
	capitalizeFirstLetter(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}
