import React, { useRef, useEffect, useCallback } from "react";
import { useTypeAhead } from "../../hooks";

let lastFocusedLabel: string | null = null;
let lastFocusAtMs = 0;

interface TypeAheadFilterProps {
	label: string;
	value: string;
	placeholder?: string;
	onChange: (value: string) => void;
}

/**
 * Type-ahead filter input component with debouncing
 */
export function TypeAheadFilter({
	label,
	value,
	placeholder,
	onChange
}: TypeAheadFilterProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	const {
		inputValue,
		handleChange,
		handleClear,
		handleKeyDown,
		handleFocus,
		handleBlur,
		handleCompositionStart,
		handleCompositionEnd,
		isActive,
		restoreFocusTrigger
	} = useTypeAhead(value, onChange);

	const restoreFocus = useCallback(() => {
		const input = inputRef.current;
		if (!input) return;

		// Avoid stealing focus if the user explicitly focused another input-like control
		const ae = document.activeElement as HTMLElement | null;
		const aeTag = ae?.tagName?.toLowerCase();
		const userFocusedOtherField =
			ae && ae !== input && (aeTag === "input" || aeTag === "textarea" || aeTag === "select");
		if (userFocusedOtherField) return;

		if (document.activeElement !== input) {
			try {
				input.focus({ preventScroll: true });
			} catch {
				input.focus();
			}
		}
	}, []);

	// Restore focus when restoreFocusTrigger changes (after debounce fires)
	useEffect(() => {
		if (restoreFocusTrigger <= 0) return;
		let cancelled = false;

		const attempt = () => {
			if (cancelled) return;
			restoreFocus();
		};

		// Multiple attempts because Obsidian (or other plugins) may move focus
		// after React commits.
		attempt();
		const t0 = window.setTimeout(attempt, 0);
		const t1 = window.setTimeout(attempt, 25);
		const t2 = window.setTimeout(attempt, 75);
		const t3 = window.setTimeout(attempt, 150);
		const t4 = window.setTimeout(attempt, 300);

		return () => {
			cancelled = true;
			window.clearTimeout(t0);
			window.clearTimeout(t1);
			window.clearTimeout(t2);
			window.clearTimeout(t3);
			window.clearTimeout(t4);
		};
	}, [restoreFocusTrigger, restoreFocus]);

	// If this component got remounted during the update cycle, restore focus
	// best-effort if it was focused very recently.
	useEffect(() => {
		if (lastFocusedLabel !== label) return;
		if (Date.now() - lastFocusAtMs > 2000) return;
		restoreFocus();
	}, [label, restoreFocus]);

	const handleFocusWrapped = useCallback(() => {
		lastFocusedLabel = label;
		lastFocusAtMs = Date.now();
		handleFocus();
	}, [handleFocus, label]);

	const handleChangeWrapped = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		lastFocusedLabel = label;
		lastFocusAtMs = Date.now();
		handleChange(e);
	}, [handleChange, label]);

	return (
		<div className={`ll-filter-item ${isActive ? "ll-filter-active" : ""}`}>
			<span className="ll-filter-label">{label}:</span>
			<input
				ref={inputRef}
				type="text"
				className="ll-filter-input"
				placeholder={placeholder || `Search ${label.toLowerCase()}...`}
				value={inputValue}
				onChange={handleChangeWrapped}
				onKeyDown={handleKeyDown}
				onFocus={handleFocusWrapped}
				onBlur={handleBlur}
				onCompositionStart={handleCompositionStart}
				onCompositionEnd={handleCompositionEnd}
			/>
			{isActive && (
				<button
					type="button"
					className="ll-filter-clear"
					onClick={handleClear}
					aria-label={`Clear ${label}`}
					title={`Clear ${label}`}
				>
					✕
				</button>
			)}
		</div>
	);
}
