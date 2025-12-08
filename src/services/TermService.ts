import { App, TFile } from "obsidian";
import {
	DictionaryEntry,
	LearnLanguageSettings,
	AITermResponse
} from "../types";

/**
 * TermService - Handles term file creation and updates
 * Replaces createOrUpdateTermPage() and createTermFile() from dvViews/utils.js
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
	 * Create or update a term page
	 */
	async createOrUpdateTerm(term: {
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
			// Update existing file
			await this.updateTermFile(existingFile, term);
			return existingFile;
		} else {
			// Create new file
			return await this.createTermFile(term);
		}
	}

	/**
	 * Create a new term file from template
	 */
	async createTermFile(term: {
		targetTerm: string;
		sourceTerm?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): Promise<TFile | null> {
		// Use configured template or fall back to default content
		let content: string;

		if (this.settings.termTemplateFile) {
			const templateFile = this.app.vault.getAbstractFileByPath(this.settings.termTemplateFile);
			if (templateFile instanceof TFile) {
				content = await this.app.vault.read(templateFile);
			} else {
				content = this.getDefaultTermContent();
			}
		} else {
			content = this.getDefaultTermContent();
		}


		// Replace placeholders and set values
		content = this.replacePlaceholders(content, term);

		const filePath = `${this.settings.dictionaryFolder}/${term.targetTerm}.md`;

		try {
			const newFile = await this.app.vault.create(filePath, content);

			// Update frontmatter
			await this.app.fileManager.processFrontMatter(newFile, (fm) => {
				if (term.sourceTerm) fm[this.settings.sourceLanguage] = term.sourceTerm;
			});

			return newFile;
		} catch (error) {
			console.error("Error creating term file:", error);
			return null;
		}
	}

	/**
	 * Update an existing term file
	 */
	async updateTermFile(file: TFile, term: {
		targetTerm: string;
		sourceTerm?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): Promise<void> {
		// Update frontmatter
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			if (term.sourceTerm !== undefined) fm[this.settings.sourceLanguage] = term.sourceTerm;
		});

		// Update inline fields
		let content = await this.app.vault.read(file);

		if (term.type !== undefined) {
			content = this.updateInlineField(content, "Type", term.type);
		}
		if (term.context !== undefined) {
			content = this.updateInlineField(content, "Context", term.context);
		}
		if (term.examples !== undefined) {
			content = this.updateInlineField(content, "Examples", term.examples);
		}

		await this.app.vault.modify(file, content);
	}

	/**
	 * Update a term from AI response
	 */
	async updateTermFromAI(french: string, aiResponse: AITermResponse): Promise<TFile | null> {
    const targetLanguage = this.settings.targetLanguage || "French";
    const sourceLanguage = this.settings.sourceLanguage || "Spanish";
		return await this.createOrUpdateTerm({
			targetTerm: targetLanguage.toLocaleLowerCase(),
			sourceTerm: (aiResponse as unknown as Record<string, unknown>)[sourceLanguage.toLowerCase()] as string,
			type: aiResponse.type,
			context: aiResponse.context,
			examples: aiResponse.examples,
		});
	}

	/**
	 * Update inline field in content
	 */
	private updateInlineField(content: string, fieldName: string, value: string): string {
		const regex = new RegExp(`^${fieldName}::.*$`, "m");
		const newLine = `${fieldName}:: ${value}`;

		if (regex.test(content)) {
			// Replace existing field
			return content.replace(regex, newLine);
		} else {
			// Field doesn't exist - try to add it after a known field or at the end of frontmatter section
			const lines = content.split("\n");
			let insertIndex = -1;

			// Find a good place to insert (after other inline fields or after frontmatter)
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].match(/^[A-Za-z_-]+::/)) {
					insertIndex = i + 1;
				}
			}

			if (insertIndex > 0) {
				lines.splice(insertIndex, 0, newLine);
				return lines.join("\n");
			}

			// Append after content
			return content + "\n" + newLine;
		}
	}

	/**
	 * Get default term content when no template exists
	 */
	private getDefaultTermContent(): string {
		return `---
Spanish:
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
Project:: [[Learn French]]

---

## Notes

`;
	}

	/**
	 * Replace placeholders in template content
	 */
	private replacePlaceholders(content: string, term: {
		targetTerm: string;
		sourceTerm?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): string {
		let result = content;
		const targetLang = this.settings.targetLanguage.toLowerCase();
		const sourceLang = this.settings.sourceLanguage.toLowerCase();

		// Dynamic language placeholder patterns (e.g., {{french}}, {{spanish}})
		result = result.replace(new RegExp(`\\{\\{${targetLang}\\}\\}`, "gi"), term.targetTerm);
		result = result.replace(new RegExp(`\\{\\{${sourceLang}\\}\\}`, "gi"), term.sourceTerm || "");

		// Generic placeholder patterns
		result = result.replace(/\{\{targetTerm\}\}/gi, term.targetTerm);
		result = result.replace(/\{\{sourceTerm\}\}/gi, term.sourceTerm || "");
		result = result.replace(/\{\{type\}\}/gi, term.type || "");
		result = result.replace(/\{\{context\}\}/gi, term.context || "");
		result = result.replace(/\{\{examples\}\}/gi, term.examples || "");

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
