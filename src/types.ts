/**
 * Learn Language Plugin - Types and Interfaces
 */

// ============================================
// Data Models
// ============================================

export interface DictionaryEntry {
	file: {
		path: string;
		name: string;
		basename: string;
	};
	targetWord: string;
	sourceWord: string;
	type: string;
	context: string;
	revision: string;
	rating?: string;
	examples?: string;
	synonyms?: string;
	relations?: string;
	project?: string;
}

export interface VerbEntry extends DictionaryEntry {
	F: string;
	S: string;
	Group: VerbGroup;
	Irregular: string;
	model?: string;
	irregular?: number;
	infinitif?: string;
	radical?: string;
	"radical-imparfait"?: string;
	"radical-futur"?: string;
	"participe-présent"?: string;
	"participe-passé"?: string;
	présent?: string;
	imparfait?: string;
	"passé-composé"?: string;
	futur?: string;
	"présent-subjonctif"?: string;
	"conditionnel-présent"?: string;
}

export interface GrammarPage {
	file: {
		path: string;
		name: string;
		basename: string;
	};
	Type: string;
	Context: string;
	Tags?: string;
	isGrammar?: boolean;
}

export type VerbGroup = "" | "1" | "2" | "i" | "3" | "3ir" | "3oir" | "3re";

export type StudyMode = "yes" | "no" | "source";

// ============================================
// Filter Types
// ============================================

export interface FilterState {
	targetWord: string;
	sourceWord: string;
	type: string;
	context: string;
	revision: string;
	study: StudyMode;
	group?: string;
	irregular?: string;
}

export interface PaginationState {
	pageStart: number;
	pageSize: number;
	outputCount: number;
}

// ============================================
// Language Locale Mapping
// ============================================

export const LANGUAGE_LOCALE_MAP: Record<string, string> = {
	// Romance languages
	"French": "fr",
	"Spanish": "es",
	"Italian": "it",
	"Portuguese": "pt",
	"Romanian": "ro",
	"Catalan": "ca",
	// Germanic languages
	"German": "de",
	"English": "en",
	"Dutch": "nl",
	"Swedish": "sv",
	"Norwegian": "no",
	"Danish": "da",
	// Slavic languages
	"Russian": "ru",
	"Polish": "pl",
	"Czech": "cs",
	"Ukrainian": "uk",
	// Asian languages
	"Japanese": "ja",
	"Chinese": "zh",
	"Korean": "ko",
	"Vietnamese": "vi",
	"Thai": "th",
	// Other languages
	"Greek": "el",
	"Turkish": "tr",
	"Arabic": "ar",
	"Hebrew": "he",
	"Hindi": "hi",
	"Finnish": "fi",
	"Hungarian": "hu",
};

/**
 * Get locale code for a language name
 * Falls back to 'en' if language is not found
 */
export function getLocaleCode(language: string): string {
	return LANGUAGE_LOCALE_MAP[language] || LANGUAGE_LOCALE_MAP[language.toLowerCase()] || "en";
}

// ============================================
// Plugin Settings
// ============================================

export interface LearnLanguageSettings {
	// Language configuration
	targetLanguage: string;  // The language being learned (e.g., "French")
	sourceLanguage: string;  // The native/source language (e.g., "Spanish")

	// Folder paths
	dictionaryFolder: string;
	verbsFolder: string;
	grammarFolder: string;
	templatesFolder: string;

	// Template files
	termTemplateFile: string;  // Template file for new terms

	// File paths
	termTypesFile: string;
	contextTypesFile: string;

	// OpenAI settings
	openAIApiKey: string;
  askTermAssistant: {
    updateTermsStructure: boolean;
    updateContextStructure: boolean;
    updateAssistantId: boolean;
    isInitialQuestion: boolean;
    withAdditionalInstructions: boolean;
    jsonResponse: boolean;
    termsFileId: string,
    contextFileId: string,
    assistantId: string,
    threadId: string
  }

	// Display settings
	defaultPageSize: number;
	enableStudyMode: boolean;

	// Auto-sync
	autoSyncTypesWithOpenAI: boolean;
}

export const DEFAULT_SETTINGS: LearnLanguageSettings = {
	// Language defaults (French-Spanish)
	targetLanguage: "French",
	sourceLanguage: "Spanish",

	// Folder defaults
	dictionaryFolder: "10. Dictionary",
	verbsFolder: "15. Verbs",
	grammarFolder: "30. Grammar",
	templatesFolder: "90. TEMPLATES",
	termTemplateFile: "90. TEMPLATES/tpl - New Term.md",  // Empty means use default content
	termTypesFile: "30. Grammar/TermTypes.txt",
	contextTypesFile: "30. Grammar/ContextTypes.txt",
	openAIApiKey: "",

  askTermAssistant: {
    updateTermsStructure: true,
    updateContextStructure: true,
    updateAssistantId: true,
    isInitialQuestion: true,
    withAdditionalInstructions: true,
    jsonResponse: true,
    termsFileId: "",
    contextFileId: "",
    assistantId: "",
    threadId: ""
  },

	defaultPageSize: 100,
	enableStudyMode: true,
	autoSyncTypesWithOpenAI: true,
};

// ============================================
// OpenAI Types
// ============================================

export interface OpenAIAssistantConfig {
	updateTermsStructure: boolean;
	updateContextStructure: boolean;
	updateAssistantId: boolean;
	isInitialQuestion: boolean;
	withAdditionalInstructions: boolean;
	jsonResponse: boolean;
	termsFileId: string;
	contextFileId: string;
	assistantId: string;
	threadId: string;
}

export interface AITermResponse {
	spanish: string;
	type: string;
	context: string;
	examples: string;
}

// ============================================
// View Types
// ============================================

export const VIEW_TYPE_DICTIONARY = "learn-language-dictionary-view";
export const VIEW_TYPE_VERBS = "learn-language-verbs-view";
export const VIEW_TYPE_GRAMMAR = "learn-language-grammar-view";

// ============================================
// Event Types
// ============================================

export interface DictionaryUpdateEvent {
	type: "add" | "update" | "delete";
	entry: DictionaryEntry;
}

// ============================================
// Global API Interface (for Dataview compatibility)
// ============================================

export interface LearnLanguageAPI {
	// Language settings
	targetLanguage: string;
	sourceLanguage: string;

	// Data access
	getDictionary: () => Promise<DictionaryEntry[]>;
	getVerbs: () => Promise<VerbEntry[]>;
	getGrammarPages: () => Promise<GrammarPage[]>;
	createTerm: (term: Partial<DictionaryEntry>) => Promise<void>;
	updateTerm: (filePath: string, updates: Partial<DictionaryEntry>) => Promise<void>;
	askAI: (term: string) => Promise<AITermResponse | null>;
	filterEntries: <T extends DictionaryEntry>(entries: T[], filters: Partial<FilterState>) => T[];
	paginateEntries: <T>(entries: T[], start: number, size: number) => T[];
}

declare global {
	interface Window {
		learnLanguage: LearnLanguageAPI;
	}
}
