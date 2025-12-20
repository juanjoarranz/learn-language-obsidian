import React, { useState, useRef, useEffect, useCallback } from "react";

interface DropdownFilterProps {
	label: string;
	value: string;
	options: string[];
	onChange: (value: string) => void;
}

/**
 * Dropdown filter component with search/autosearch functionality
 */
export function DropdownFilter({
	label,
	value,
	options,
	onChange
}: DropdownFilterProps) {
	const isActive = value !== "all";
	const [isOpen, setIsOpen] = useState(false);
	const [searchText, setSearchText] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	// Filter options based on search text
	const filteredOptions = options.filter(option =>
		option.toLowerCase().includes(searchText.toLowerCase())
	);

	// Get display text for the input
	const displayText = isOpen ? searchText : (value === "all" ? "" : value);

	// Handle click outside to close dropdown
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				setSearchText("");
				setHighlightedIndex(-1);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Scroll highlighted item into view
	useEffect(() => {
		if (highlightedIndex >= 0 && listRef.current) {
			const highlightedItem = listRef.current.children[highlightedIndex] as HTMLElement;
			if (highlightedItem) {
				highlightedItem.scrollIntoView({ block: "nearest" });
			}
		}
	}, [highlightedIndex]);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchText(e.target.value);
		setHighlightedIndex(-1);
		if (!isOpen) {
			setIsOpen(true);
		}
	};

	const handleInputFocus = () => {
		setIsOpen(true);
		setSearchText("");
	};

	const handleOptionSelect = useCallback((option: string) => {
		onChange(option);
		setIsOpen(false);
		setSearchText("");
		setHighlightedIndex(-1);
		inputRef.current?.blur();
	}, [onChange]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!isOpen) {
			if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
				setIsOpen(true);
				e.preventDefault();
			}
			return;
		}

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setHighlightedIndex(prev =>
					prev < filteredOptions.length - 1 ? prev + 1 : prev
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
				break;
			case "Enter":
				e.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
					handleOptionSelect(filteredOptions[highlightedIndex]);
				} else if (filteredOptions.length === 1) {
					handleOptionSelect(filteredOptions[0]);
				}
				break;
			case "Escape":
				setIsOpen(false);
				setSearchText("");
				setHighlightedIndex(-1);
				inputRef.current?.blur();
				break;
			case "Tab":
				setIsOpen(false);
				setSearchText("");
				setHighlightedIndex(-1);
				break;
		}
	};

	const handleClear = () => {
		onChange("all");
		setSearchText("");
		setHighlightedIndex(-1);
	};

	const listboxId = `ll-dropdown-listbox-${label.toLowerCase().replace(/\s+/g, '-')}`;

	return (
		<div
			className={`ll-filter-item ${isActive ? "ll-filter-active" : ""}`}
			ref={containerRef}
		>
			<span className="ll-filter-label">{label}:</span>
			<div className="ll-dropdown-container">
				{/* eslint-disable-next-line jsx-a11y/role-has-required-aria-props */}
				<input
					ref={inputRef}
					type="text"
					className="ll-dropdown-input"
					value={displayText}
					onChange={handleInputChange}
					onFocus={handleInputFocus}
					onKeyDown={handleKeyDown}
					placeholder={value === "all" ? "all" : ""}
					aria-label={label}
					aria-expanded={isOpen}
					aria-haspopup="listbox"
					aria-controls={listboxId}
					role="combobox"
					autoComplete="off"
				/>
				<button
					type="button"
					className="ll-dropdown-toggle"
					onClick={() => {
						setIsOpen(!isOpen);
						if (!isOpen) {
							inputRef.current?.focus();
						}
					}}
					aria-label="Toggle dropdown"
					tabIndex={-1}
				>
					<svg
						className={`ll-dropdown-arrow ${isOpen ? "ll-dropdown-arrow-open" : ""}`}
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M2.5 4.5L6 8L9.5 4.5"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
				{isOpen && (
					<ul
						ref={listRef}
						id={listboxId}
						className="ll-dropdown-list"
						role="listbox"
						aria-label={`${label} options`}
					>
						{filteredOptions.length > 0 ? (
							filteredOptions.map((option, index) => (
								<li
									key={option}
									className={`ll-dropdown-option ${option === value ? "ll-dropdown-option-selected" : ""} ${index === highlightedIndex ? "ll-dropdown-option-highlighted" : ""}`}
									onClick={() => handleOptionSelect(option)}
									role="option"
									aria-selected={option === value ? "true" : "false"}
								>
									{option}
								</li>
							))
						) : (
							<li className="ll-dropdown-no-results" role="option" aria-disabled="true">No results found</li>
						)}
					</ul>
				)}
			</div>
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
