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
	const normalizeExternal = (v: string) => (v === "all" ? "" : v);
	const [inputValue, setInputValue] = useState(normalizeExternal(initialValue));
	const onChangeRef = useRef(onChange);
	const debounceTimerRef = useRef<number | null>(null);
	const isComposingRef = useRef(false);
	const isFocusedRef = useRef(false);

	// Keep the ref updated with the latest onChange
	useEffect(() => {
		onChangeRef.current = onChange;
	});

	// If external value changes (e.g. filters set programmatically), sync it
	// only when the user isn't actively typing/focused to avoid clobbering input.
	useEffect(() => {
		if (isFocusedRef.current || isComposingRef.current) return;
		const next = normalizeExternal(initialValue);
		setInputValue(next);
		if (debounceTimerRef.current) {
			window.clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
	}, [initialValue]);

	const scheduleNotify = useCallback((nextValue: string) => {
		if (debounceTimerRef.current) {
			window.clearTimeout(debounceTimerRef.current);
		}
		debounceTimerRef.current = window.setTimeout(() => {
			debounceTimerRef.current = null;
			onChangeRef.current(nextValue || "all");
		}, delay);
	}, [delay]);

	const flushNotify = useCallback((currentValue: string) => {
		if (debounceTimerRef.current) {
			window.clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		onChangeRef.current(currentValue || "all");
	}, []);

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const next = e.target.value;
		setInputValue(next);
		if (!isComposingRef.current) {
			scheduleNotify(next);
		}
	}, [scheduleNotify]);

	const handleClear = useCallback(() => {
		setInputValue("");
		flushNotify("");
	}, [flushNotify]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			handleClear();
		}
	}, [handleClear]);

	const handleFocus = useCallback(() => {
		isFocusedRef.current = true;
	}, []);

	const handleBlur = useCallback(() => {
		isFocusedRef.current = false;
		// Commit any pending value when leaving the field.
		if (!isComposingRef.current) {
			flushNotify(inputValue);
		}
	}, [flushNotify, inputValue]);

	const handleCompositionStart = useCallback(() => {
		isComposingRef.current = true;
		if (debounceTimerRef.current) {
			window.clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
	}, []);

	const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
		isComposingRef.current = false;
		const next = (e.target as HTMLInputElement).value;
		setInputValue(next);
		scheduleNotify(next);
	}, [scheduleNotify]);

	return {
		inputValue,
		setInputValue,
		handleChange,
		handleClear,
		handleKeyDown,
		handleFocus,
		handleBlur,
		handleCompositionStart,
		handleCompositionEnd,
		isActive: inputValue !== ""
	};
}
