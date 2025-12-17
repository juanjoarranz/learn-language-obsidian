import React from "react";
import { Root, createRoot } from "react-dom/client";
import { App } from "obsidian";
import { LearnLanguageContext, LearnLanguageContextValue } from "../context";
import { LearnLanguageSettings } from "../types";
import { FilterService, DictionaryService, TermService } from "../services";

/**
 * Creates a React root and mounts a component with the Learn Language context
 */
export function createReactRoot(
	container: HTMLElement,
	app: App,
	settings: LearnLanguageSettings,
	filterService: FilterService,
	dictionaryService: DictionaryService,
	termService?: TermService
): ReactMountPoint {
	const root = createRoot(container);

	const contextValue: LearnLanguageContextValue = {
		app,
		settings,
		filterService,
		dictionaryService,
		termService
	};

	return new ReactMountPoint(root, contextValue);
}

/**
 * Helper class for managing React component lifecycle in Obsidian
 */
export class ReactMountPoint {
	private root: Root;
	private contextValue: LearnLanguageContextValue;

	constructor(root: Root, contextValue: LearnLanguageContextValue) {
		this.root = root;
		this.contextValue = contextValue;
	}

	/**
	 * Render a React component with the context provider
	 */
	render(component: React.ReactNode): void {
		this.root.render(
			<LearnLanguageContext.Provider value={this.contextValue}>
				{component}
			</LearnLanguageContext.Provider>
		);
	}

	/**
	 * Update the context value (e.g., when settings change)
	 */
	updateContext(updates: Partial<LearnLanguageContextValue>): void {
		this.contextValue = { ...this.contextValue, ...updates };
	}

	/**
	 * Unmount the React component
	 */
	unmount(): void {
		this.root.unmount();
	}
}
