import React from "react";

interface StudyToggleProps {
	value: "yes" | "no" | "source";
	targetLanguage: string;
	sourceLanguage: string;
	onChange: (value: "yes" | "no" | "source") => void;
}

/**
 * Study mode toggle component
 */
export function StudyToggle({
	value,
	targetLanguage,
	sourceLanguage,
	onChange
}: StudyToggleProps) {
	const isActive = value !== "no";

	return (
		<div className={`ll-filter-item ${isActive ? "ll-filter-active" : ""}`}>
			<span className="ll-filter-label">Study:</span>
			<select
				className="dropdown"
				value={value}
				onChange={(e) => onChange(e.target.value as "yes" | "no" | "source")}
				aria-label="Study mode"
			>
				<option value="no">No</option>
				<option value="yes">{targetLanguage} → {sourceLanguage}</option>
				<option value="source">{sourceLanguage} → {targetLanguage}</option>
			</select>
		</div>
	);
}
