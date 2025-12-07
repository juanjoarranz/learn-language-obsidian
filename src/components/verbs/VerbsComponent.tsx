import React, { useEffect, useCallback, useMemo, useState } from "react";
import { VerbEntry, FilterState, PaginationState } from "../../types";
import { useLearnLanguage } from "../../context";
import { usePagination } from "../../hooks";
import { DropdownFilter, StudyToggle } from "../filters";
import { VerbsTable } from "./VerbsTable";
import { Pagination } from "../table";

interface VerbFilterState extends Partial<FilterState> {
	group?: string;
	irregular?: string;
	F?: string;
	S?: string;
}

export interface VerbsComponentProps {
	/** Initial entries to display */
	entries: VerbEntry[];
	/** Show the refresh button */
	showRefresh?: boolean;
	/** Show the study mode toggle */
	showStudyMode?: boolean;
	/** Show pagination controls */
	showPagination?: boolean;
	/** Initial page size */
	pageSize?: number;
	/** Callback when refresh is requested */
	onRefresh?: () => Promise<void>;
}

/**
 * VerbsComponent - React component for displaying and filtering verb entries
 */
export function VerbsComponent({
	entries,
	showRefresh = true,
	showStudyMode = true,
	showPagination = true,
	pageSize = 25,
	onRefresh
}: VerbsComponentProps) {
	const { settings, filterService } = useLearnLanguage();
	const targetLang = settings.targetLanguage;
	const sourceLang = settings.sourceLanguage;

	// Filter state
	const [filters, setFilters] = useState<VerbFilterState>({
		F: "all",
		S: "all",
		group: "all",
		irregular: "all",
		revision: "all",
		study: "no"
	});

	// Pagination
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

	// Apply verb filters
	const filteredEntries = useMemo(() => {
		let result = [...entries];

		if (filters.F && filters.F !== "all") {
			result = result.filter(e => e.F.toLowerCase().includes(filters.F!.toLowerCase()));
		}

		if (filters.S && filters.S !== "all") {
			result = result.filter(e => e.S.toLowerCase().includes(filters.S!.toLowerCase()));
		}

		if (filters.group && filters.group !== "all") {
			result = result.filter(e => e.Group === filters.group);
		}

		if (filters.irregular && filters.irregular !== "all") {
			result = result.filter(e => {
				if (filters.irregular === "i1") {
					return e.Irregular.startsWith("i");
				}
				return e.Irregular === filters.irregular;
			});
		}

		if (filters.revision && filters.revision !== "all") {
			result = result.filter(e => e.revision === filters.revision);
		}

		return result;
	}, [entries, filters]);

	// Paginate
	const paginatedEntries = useMemo(() => {
		if (!showPagination) return filteredEntries;
		return filterService.paginate(
			filteredEntries,
			pagination.pageStart,
			pagination.pageSize
		);
	}, [filteredEntries, pagination, showPagination, filterService]);

	// Update output count when filtered entries change
	useEffect(() => {
		setOutputCount(filteredEntries.length);
	}, [filteredEntries.length, setOutputCount]);

	// Reset page when filters change
	useEffect(() => {
		resetPage();
	}, [filters, resetPage]);

	// Get unique values for dropdowns
	const fOptions = useMemo(
		() => filterService.getUniqueValues(entries, "F"),
		[entries, filterService]
	);
	const sOptions = useMemo(
		() => filterService.getUniqueValues(entries, "S"),
		[entries, filterService]
	);
	const groupOptions = useMemo(
		() => filterService.getUniqueValues(entries, "Group"),
		[entries, filterService]
	);
	const irregularOptions = useMemo(
		() => filterService.getUniqueValues(entries, "Irregular"),
		[entries, filterService]
	);
	const revisionOptions = useMemo(
		() => filterService.getUniqueValues(entries, "revision"),
		[entries, filterService]
	);

	// Handlers
	const updateFilter = useCallback((key: keyof VerbFilterState, value: string) => {
		setFilters(prev => ({ ...prev, [key]: value }));
	}, []);

	const handleRefresh = useCallback(async () => {
		if (onRefresh) {
			await onRefresh();
		}
	}, [onRefresh]);

	const handleStudyChange = useCallback((value: "yes" | "no" | "spanish") => {
		updateFilter("study", value);
	}, [updateFilter]);

	const handlePageSizeChange = useCallback((size: number) => {
		setPageSize(size);
	}, [setPageSize]);

	const isStudying = filters.study !== "no";
	const showSourceFirst = filters.study === "spanish";

	return (
		<div className="ll-verbs-component">
			{/* Filters */}
			<div className="ll-filters">
				<div className="ll-filter-row">
					<DropdownFilter
						label={targetLang}
						value={filters.F || "all"}
						options={fOptions}
						onChange={(value) => updateFilter("F", value)}
					/>
					<DropdownFilter
						label={sourceLang}
						value={filters.S || "all"}
						options={sOptions}
						onChange={(value) => updateFilter("S", value)}
					/>
					<DropdownFilter
						label="Group"
						value={filters.group || "all"}
						options={groupOptions}
						onChange={(value) => updateFilter("group", value)}
					/>
					<DropdownFilter
						label="Irregular"
						value={filters.irregular || "all"}
						options={irregularOptions}
						onChange={(value) => updateFilter("irregular", value)}
					/>
					<DropdownFilter
						label="Revision"
						value={filters.revision || "all"}
						options={revisionOptions}
						onChange={(value) => updateFilter("revision", value)}
					/>
					{showStudyMode && (
						<StudyToggle
							value={(filters.study as "yes" | "no" | "spanish") || "no"}
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
				</div>
			</div>

			{/* Table */}
			<div className="ll-table-container">
				<VerbsTable
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
					entityName="verbs"
				/>
			)}
		</div>
	);
}
