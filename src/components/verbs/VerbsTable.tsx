import React, { useCallback } from "react";
import { VerbEntry } from "../../types";
import { useLearnLanguage } from "../../context";

interface VerbsTableProps {
	entries: VerbEntry[];
	isStudying: boolean;
	showSourceFirst: boolean;
}

/**
 * Verbs table component
 */
export function VerbsTable({
	entries,
	isStudying,
	showSourceFirst
}: VerbsTableProps) {
	const { app, settings } = useLearnLanguage();
	const targetLang = settings.targetLanguage;
	const sourceLang = settings.sourceLanguage;

	const openFile = useCallback((path: string) => {
		app.workspace.openLinkText(path, "");
	}, [app]);

	if (entries.length === 0) {
		return (
			<div className="ll-no-results">
				No verbs found matching the filters.
			</div>
		);
	}

	return (
		<table className="ll-table ll-verbs-table">
			<thead>
				<tr>
					<th>{targetLang}</th>
					<th>{sourceLang}</th>
					<th>G</th>
					<th>Présent</th>
					<th>Subjonctif</th>
					<th>Imparfait</th>
					<th>Passé composé</th>
					<th>Futur</th>
				</tr>
			</thead>
			<tbody>
				{entries.map((entry) => (
					isStudying ? (
						<StudyRow
							key={entry.file.path}
							entry={entry}
							showSourceFirst={showSourceFirst}
						/>
					) : (
						<NormalRow
							key={entry.file.path}
							entry={entry}
							onOpenFile={openFile}
						/>
					)
				))}
			</tbody>
		</table>
	);
}

interface NormalRowProps {
	entry: VerbEntry;
	onOpenFile: (path: string) => void;
}

function NormalRow({ entry, onOpenFile }: NormalRowProps) {
	const handleClick = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		onOpenFile(entry.file.path);
	}, [entry.file.path, onOpenFile]);

	const conjugationFields = ["présent", "présent-subjonctif", "imparfait", "passé-composé", "futur"] as const;

	return (
		<tr>
			<td>
				<a
					className="internal-link"
					href={entry.file.path}
					onClick={handleClick}
				>
					{entry.F}
				</a>
			</td>
			<td>{entry.S}</td>
			<td>{entry.Group}</td>
			{conjugationFields.map((field) => {
				const value = (entry as unknown as Record<string, unknown>)[field];
				return (
					<td key={field} className="ll-conjugation">
						{value ? (
							<span dangerouslySetInnerHTML={{ __html: String(value) }} />
						) : (
							<span className="ll-empty">—</span>
						)}
					</td>
				);
			})}
		</tr>
	);
}

interface StudyRowProps {
	entry: VerbEntry;
	showSourceFirst: boolean;
}

function StudyRow({ entry, showSourceFirst }: StudyRowProps) {
	const [isExpanded, setIsExpanded] = React.useState(false);

	const questionText = showSourceFirst ? entry.S : entry.F;
	const answerText = showSourceFirst ? entry.F : entry.S;

	return (
		<tr className="ll-study-row">
			<td colSpan={8}>
				<div
					className="ll-study-question"
					onClick={() => setIsExpanded(!isExpanded)}
				>
					<h4 className="ll-collapsible">{questionText}</h4>
				</div>
				<div className={`ll-study-answer ${isExpanded ? "" : "ll-hidden"}`}>
					<span className="ll-answer-text">{answerText}</span>
					{entry.Group && (
						<span className="ll-answer-type"> (Group {entry.Group})</span>
					)}
				</div>
			</td>
		</tr>
	);
}
