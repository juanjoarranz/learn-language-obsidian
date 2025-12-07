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
		french: string;
		spanish?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): Promise<TFile | null> {
		const fileName = term.french;
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
		french: string;
		spanish?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): Promise<TFile | null> {
		const templatePath = `${this.settings.templatesFolder}/tpl - New French Term.md`;
		const templateFile = this.app.vault.getAbstractFileByPath(templatePath);

		let content: string;

		if (templateFile instanceof TFile) {
			// Use template
			content = await this.app.vault.read(templateFile);
		} else {
			// Create default content
			content = this.getDefaultTermContent();
		}

		// Replace placeholders and set values
		content = this.replacePlaceholders(content, term);

		const filePath = `${this.settings.dictionaryFolder}/${term.french}.md`;

		try {
			const newFile = await this.app.vault.create(filePath, content);

			// Update frontmatter
			await this.app.fileManager.processFrontMatter(newFile, (fm) => {
				if (term.spanish) fm.Spanish = term.spanish;
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
		french: string;
		spanish?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): Promise<void> {
		// Update frontmatter
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			if (term.spanish !== undefined) fm.Spanish = term.spanish;
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
		return await this.createOrUpdateTerm({
			french,
			spanish: aiResponse.spanish,
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
		french: string;
		spanish?: string;
		type?: string;
		context?: string;
		examples?: string;
	}): string {
		let result = content;

		// Common placeholder patterns
		result = result.replace(/\{\{french\}\}/gi, term.french);
		result = result.replace(/\{\{spanish\}\}/gi, term.spanish || "");
		result = result.replace(/\{\{type\}\}/gi, term.type || "");
		result = result.replace(/\{\{context\}\}/gi, term.context || "");
		result = result.replace(/\{\{examples\}\}/gi, term.examples || "");

		// Templater-style placeholders
		result = result.replace(/<% tp\.file\.title %>/g, term.french);

		return result;
	}

	/**
	 * Capitalize first letter
	 */
	capitalizeFirstLetter(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}
