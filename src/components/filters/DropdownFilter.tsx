import React from "react";

interface DropdownFilterProps {
	label: string;
	value: string;
	options: string[];
	onChange: (value: string) => void;
}

/**
 * Dropdown filter component
 */
export function DropdownFilter({
	label,
	value,
	options,
	onChange
}: DropdownFilterProps) {
	const isActive = value !== "all";

	return (
		<div className={`ll-filter-item ${isActive ? "ll-filter-active" : ""}`}>
			<span className="ll-filter-label">{label}:</span>
			<select
				className="dropdown"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				aria-label={label}
			>
				{options.map(option => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		</div>
	);
}
