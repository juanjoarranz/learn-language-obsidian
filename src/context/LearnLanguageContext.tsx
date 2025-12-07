import { createContext, useContext } from "react";
import { App } from "obsidian";
import { LearnLanguageSettings } from "../types";
import { FilterService, DictionaryService } from "../services";

/**
 * Context value for Learn Language plugin
 */
export interface LearnLanguageContextValue {
	app: App;
	settings: LearnLanguageSettings;
	filterService: FilterService;
	dictionaryService: DictionaryService;
}

/**
 * React context for accessing plugin services
 */
export const LearnLanguageContext = createContext<LearnLanguageContextValue | null>(null);

/**
 * Hook to access the Learn Language context
 */
export function useLearnLanguage(): LearnLanguageContextValue {
	const context = useContext(LearnLanguageContext);
	if (!context) {
		throw new Error("useLearnLanguage must be used within a LearnLanguageProvider");
	}
	return context;
}
