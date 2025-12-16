import React from "react";
import { PaginationState } from "../../types";

interface PaginationProps {
	pagination: PaginationState;
	currentPage: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
	onNext: () => void;
	onPrev: () => void;
	onPageSizeChange: (size: number) => void;
	entityName?: string;
  showPaginationInfo?: boolean;
}

/**
 * Pagination controls component
 */
export function Pagination({
	pagination,
	currentPage,
	totalPages,
	hasNext,
	hasPrev,
	onNext,
	onPrev,
	onPageSizeChange,
	entityName = "entries",
  showPaginationInfo = true
}: PaginationProps) {
	const { pageStart, pageSize, outputCount } = pagination;
	const showStart = pageStart + 1;
	const showEnd = Math.min(pageStart + pageSize, outputCount);

	return (
		<div className="ll-pagination">
			{showPaginationInfo && <span className="ll-pagination-info">
				Showing {showStart}-{showEnd} of {outputCount} {entityName} (Page {currentPage}/{totalPages})
			</span>}
			<div className="ll-pagination-buttons">
				{hasPrev && (
					<button className="mod-cta" onClick={onPrev}>
						← Previous
					</button>
				)}
				{hasNext && (
					<button className="mod-cta" onClick={onNext}>
						Next →
					</button>
				)}
				<div className="ll-page-size">
					<span>Page size: </span>
					<select
						className="dropdown"
						value={pageSize}
						onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
						aria-label="Page size"
					>
						{[25, 50, 100, 200].map(size => (
							<option key={size} value={size}>{size}</option>
						))}
					</select>
				</div>
			</div>
		</div>
	);
}
