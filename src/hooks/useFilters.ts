import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { FilterState, PaginationState, DictionaryEntry } from "../types";
import { FilterService } from "../services";

/**
 * Hook for managing filter state with debouncing for type-ahead fields
 */
export function useFilters(initialFilters: Partial<FilterState> = {}) {
	const [filters, setFilters] = useState<Partial<FilterState>>({
		targetWord: "all",
		sourceWord: "all",
		type: "all",
		context: "all",
		revision: "all",
		study: "no",
		...initialFilters
	});

	const updateFilter = useCallback((key: keyof FilterState, value: string) => {
		setFilters(prev => ({ ...prev, [key]: value }));
	}, []);

	const resetFilters = useCallback(() => {
		setFilters({
			targetWord: "all",
			sourceWord: "all",
			type: "all",
			context: "all",
			revision: "all",
			study: "no"
		});
	}, []);

	return { filters, setFilters, updateFilter, resetFilters };
}

/**
 * Hook for managing pagination state
 */
export function usePagination(initialPageSize: number = 100) {
	const [pagination, setPagination] = useState<PaginationState>({
		pageStart: 0,
		pageSize: initialPageSize,
		outputCount: 0
	});

	const setPage = useCallback((pageStart: number) => {
		setPagination(prev => ({ ...prev, pageStart }));
	}, []);

	const setPageSize = useCallback((pageSize: number) => {
		setPagination(prev => ({ ...prev, pageSize, pageStart: 0 }));
	}, []);

	const setOutputCount = useCallback((outputCount: number) => {
		setPagination(prev => ({ ...prev, outputCount }));
	}, []);

	const nextPage = useCallback(() => {
		setPagination(prev => ({
			...prev,
			pageStart: Math.min(prev.pageStart + prev.pageSize, prev.outputCount - prev.pageSize)
		}));
	}, []);

	const prevPage = useCallback(() => {
		setPagination(prev => ({
			...prev,
			pageStart: Math.max(0, prev.pageStart - prev.pageSize)
		}));
	}, []);

	const resetPage = useCallback(() => {
		setPagination(prev => ({ ...prev, pageStart: 0 }));
	}, []);

	const currentPage = Math.floor(pagination.pageStart / pagination.pageSize) + 1;
	const totalPages = Math.ceil(pagination.outputCount / pagination.pageSize);
	const hasNext = pagination.pageStart + pagination.pageSize < pagination.outputCount;
	const hasPrev = pagination.pageStart > 0;

	return {
		pagination,
		setPage,
		setPageSize,
		setOutputCount,
		nextPage,
		prevPage,
		resetPage,
		currentPage,
		totalPages,
		hasNext,
		hasPrev
	};
}

/**
 * Hook for filtering and paginating dictionary entries
 */
export function useFilteredEntries(
	entries: DictionaryEntry[],
	filters: Partial<FilterState>,
	filterService: FilterService,
	pagination: PaginationState,
	showPagination: boolean = true
) {
	const filteredEntries = useMemo(() => {
		return filterService.applyFilters(entries, filters);
	}, [entries, filters, filterService]);

	const paginatedEntries = useMemo(() => {
		if (!showPagination) return filteredEntries;
		return filterService.paginate(
			filteredEntries,
			pagination.pageStart,
			pagination.pageSize
		);
	}, [filteredEntries, pagination, showPagination, filterService]);

	return { filteredEntries, paginatedEntries };
}

/**
 * Hook for debounced value updates (for type-ahead search)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(timer);
		};
	}, [value, delay]);

	return debouncedValue;
}

/**
 * Hook for type-ahead input with debouncing
 */
export function useTypeAhead(
	initialValue: string = "",
	onChange: (value: string) => void,
	delay: number = 300
) {
	const [inputValue, setInputValue] = useState(initialValue === "all" ? "" : initialValue);
	const debouncedValue = useDebounce(inputValue, delay);
	const isFirstRender = useRef(true);

	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}
		onChange(debouncedValue || "all");
	}, [debouncedValue, onChange]);

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(e.target.value);
	}, []);

	const handleClear = useCallback(() => {
		setInputValue("");
		onChange("all");
	}, [onChange]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			handleClear();
		}
	}, [handleClear]);

	return {
		inputValue,
		setInputValue,
		handleChange,
		handleClear,
		handleKeyDown,
		isActive: inputValue !== ""
	};
}
