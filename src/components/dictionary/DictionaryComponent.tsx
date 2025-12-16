import React, { useEffect, useCallback, useMemo } from "react";
import { DictionaryEntry, FilterState } from "../../types";
import { useLearnLanguage } from "../../context";
import { useFilters, usePagination, useFilteredEntries } from "../../hooks";
import { TypeAheadFilter, DropdownFilter, StudyToggle } from "../filters";
import { DictionaryTable, Pagination } from "../table";

export interface DictionaryComponentProps {
	/** Initial entries to display */
	entries: DictionaryEntry[];
	/** Show the refresh button */
	showRefresh?: boolean;
	/** Show the study mode toggle */
	showStudyMode?: boolean;
	/** Show pagination controls */
	showPagination?: boolean;
	/** Initial page size */
	pageSize?: number;
	/** Initial filters to apply */
	initialFilters?: Partial<FilterState>;
	/** Callback when refresh is requested */
	onRefresh?: () => Promise<void>;
	/** Callback when filters change */
	onFiltersChange?: (filters: Partial<FilterState>) => void;
	/** Callback to open Ask AI for Term modal */
	onAskAIForTerm?: () => void;
}

/**
 * DictionaryComponent - React component for displaying and filtering dictionary entries
 */
export function DictionaryComponent({
	entries,
	showRefresh = true,
	showStudyMode = true,
	showPagination = true,
	pageSize = 100,
	initialFilters = {},
	onRefresh,
	onFiltersChange,
	onAskAIForTerm
}: DictionaryComponentProps) {
	const { settings, filterService } = useLearnLanguage();
	const targetLang = settings.targetLanguage;
	const sourceLang = settings.sourceLanguage;
	const isFirstFiltersEmit = React.useRef(true);

	// State management with hooks
	const { filters, updateFilter } = useFilters(initialFilters);
	const {
		pagination,
		setOutputCount,
		setPageSize,
		nextPage,
		prevPage,
		resetPage,
		currentPage,
		totalPages,
		hasNext,
		hasPrev
	} = usePagination(pageSize);

	// Filter and paginate entries
	const { filteredEntries, paginatedEntries } = useFilteredEntries(
		entries,
		filters,
		filterService,
		pagination,
		showPagination
	);

	// Update output count when filtered entries change
	useEffect(() => {
		setOutputCount(filteredEntries.length);
	}, [filteredEntries.length]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reset page when filters change
	useEffect(() => {
		resetPage();
	}, [filters.targetWord, filters.sourceWord, filters.type, filters.context, filters.revision, filters.study]); // eslint-disable-line react-hooks/exhaustive-deps

	// Notify external listeners (e.g. code block processor persistence)
	useEffect(() => {
		if (isFirstFiltersEmit.current) {
			isFirstFiltersEmit.current = false;
			return;
		}
		onFiltersChange?.(filters);
	}, [filters, onFiltersChange]);

	// Faceted dropdown options:
	// - Based on the current filtered dataset (by other filters)
	// - Excluding the dropdown's own filter
	// - INCLUDING the type-ahead filters (targetWord/sourceWord)
	const typeOptions = useMemo(() => {
		const facetEntries = filterService.applyFilters(entries, {
			...filters,
			type: "all"
		});
		const opts = filterService.getUniqueValues(facetEntries, "type");
		const selected = filters.type;
		if (selected && selected !== "all" && !opts.includes(selected)) {
			return ["all", selected, ...opts.filter(o => o !== "all")];
		}
		return opts;
	}, [entries, filterService, filters]);

  //console.log('JAA typeOptions:', typeOptions);

	const contextOptions = useMemo(() => {
		const facetEntries = filterService.applyFilters(entries, {
			...filters,
			context: "all"
		});
		const opts = filterService.getUniqueValues(facetEntries, "context");
		const selected = filters.context;
		if (selected && selected !== "all" && !opts.includes(selected)) {
			return ["all", selected, ...opts.filter(o => o !== "all")];
		}
		return opts;
	}, [entries, filterService, filters]);

	const revisionOptions = useMemo(() => {
		const facetEntries = filterService.applyFilters(entries, {
			...filters,
			revision: "all"
		});
		const opts = filterService.getUniqueValues(facetEntries, "revision");
		const selected = filters.revision;
		if (selected && selected !== "all" && !opts.includes(selected)) {
			return ["all", selected, ...opts.filter(o => o !== "all")];
		}
		return opts;
	}, [entries, filterService, filters]);

	// Handlers
	const handleRefresh = useCallback(async () => {
		if (onRefresh) {
			await onRefresh();
		}
	}, [onRefresh]);

	const handleStudyChange = useCallback((value: "yes" | "no" | "source") => {
		updateFilter("study", value);
	}, [updateFilter]);

	const handlePageSizeChange = useCallback((size: number) => {
		setPageSize(size);
	}, [setPageSize]);

	const isStudying = filters.study !== "no";
	const showSourceFirst = filters.study === "source";

	return (
		<div className="ll-dictionary-component">
			{/* Filters */}
			<div className="ll-filters">
				<div className="ll-filter-row">
					<TypeAheadFilter
						label={targetLang}
						value={filters.targetWord || "all"}
						onChange={(value) => updateFilter("targetWord", value)}
					/>
					<TypeAheadFilter
						label={sourceLang}
						value={filters.sourceWord || "all"}
						onChange={(value) => updateFilter("sourceWord", value)}
					/>
					<DropdownFilter
						label="Type"
						value={filters.type || "all"}
						options={typeOptions}
						onChange={(value) => updateFilter("type", value)}
					/>
					<DropdownFilter
						label="Context"
						value={filters.context || "all"}
						options={contextOptions}
						onChange={(value) => updateFilter("context", value)}
					/>
					<DropdownFilter
						label="Revision"
						value={filters.revision || "all"}
						options={revisionOptions}
						onChange={(value) => updateFilter("revision", value)}
					/>
					{showStudyMode && (
						<StudyToggle
							value={(filters.study as "yes" | "no" | "source") || "no"}
							targetLanguage={targetLang}
							sourceLanguage={sourceLang}
							onChange={handleStudyChange}
						/>
					)}
					{showRefresh && onRefresh && (
						<button
							className="mod-cta"
							onClick={handleRefresh}
							aria-label="Refresh"
						>
							🔄 Refresh
						</button>
					)}
					{onAskAIForTerm && (
						<button
							className="mod-cta"
							onClick={onAskAIForTerm}
							aria-label="Ask AI for Term"
						>
							🤖 Ask AI for Term
						</button>
					)}
				</div>
			</div>

			{/* Pagination */}
			{showPagination && (
				<Pagination
					pagination={pagination}
					currentPage={currentPage}
					totalPages={totalPages}
					hasNext={hasNext}
					hasPrev={hasPrev}
					onNext={nextPage}
					onPrev={prevPage}
					onPageSizeChange={handlePageSizeChange}
				/>
			)}

			{/* Table */}
			<div className="ll-table-container">
				<DictionaryTable
					entries={paginatedEntries}
					isStudying={isStudying}
					showSourceFirst={showSourceFirst}
				/>
			</div>

			{/* Pagination */}
			{showPagination && (
				<Pagination
					pagination={pagination}
					currentPage={currentPage}
					totalPages={totalPages}
					hasNext={hasNext}
					hasPrev={hasPrev}
					onNext={nextPage}
					onPrev={prevPage}
					onPageSizeChange={handlePageSizeChange}
          showPaginationInfo={false}
				/>
			)}
		</div>
	);
}
