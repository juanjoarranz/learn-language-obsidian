import React from "react";
import { useTypeAhead } from "../../hooks";

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
	const {
		inputValue,
		handleChange,
		handleClear,
		handleKeyDown,
		isActive
	} = useTypeAhead(value, onChange);

	return (
		<div className={`ll-filter-item ${isActive ? "ll-filter-active" : ""}`}>
			<span className="ll-filter-label">{label}:</span>
			<input
				type="text"
				className="ll-filter-input"
				placeholder={placeholder || `Search ${label.toLowerCase()}...`}
				value={inputValue}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
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
