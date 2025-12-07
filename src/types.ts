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
	french: string;
	spanish: string;
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

export type StudyMode = "yes" | "no" | "spanish";

// ============================================
// Filter Types
// ============================================

export interface FilterState {
	French: string;
	Spanish: string;
	Type: string;
	Context: string;
	Revision: string;
	Study: StudyMode;
	Group?: string;
	Irregular?: string;
}

export interface PaginationState {
	pageStart: number;
	pageSize: number;
	outputCount: number;
}

// ============================================
// Plugin Settings
// ============================================

export interface LearnLanguageSettings {
	// Folder paths
	dictionaryFolder: string;
	verbsFolder: string;
	grammarFolder: string;
	templatesFolder: string;

	// File paths
	termTypesFile: string;
	contextTypesFile: string;

	// OpenAI settings
	openAIApiKey: string;
	assistantId: string;
	threadId: string;
	termsFileId: string;
	contextFileId: string;

	// Display settings
	defaultPageSize: number;
	enableStudyMode: boolean;

	// Auto-sync
	autoSyncTypesWithOpenAI: boolean;
}

export const DEFAULT_SETTINGS: LearnLanguageSettings = {
	dictionaryFolder: "10. Dictionary",
	verbsFolder: "15. Verbs",
	grammarFolder: "30. Grammar",
	templatesFolder: "90. TEMPLATES",
	termTypesFile: "30. Grammar/TermTypes.txt",
	contextTypesFile: "30. Grammar/ContextTypes.txt",
	openAIApiKey: "",
	assistantId: "",
	threadId: "",
	termsFileId: "",
	contextFileId: "",
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
