import React, { useCallback } from "react";
import { DictionaryEntry } from "../../types";
import { useLearnLanguage } from "../../context";

interface DictionaryTableProps {
	entries: DictionaryEntry[];
	isStudying: boolean;
	showSourceFirst: boolean;
}

/**
 * Dictionary table component
 */
export function DictionaryTable({
	entries,
	isStudying,
	showSourceFirst
}: DictionaryTableProps) {
	const { app, settings } = useLearnLanguage();
	const targetLang = settings.targetLanguage;
	const sourceLang = settings.sourceLanguage;

	const openFile = useCallback((path: string) => {
		app.workspace.openLinkText(path, "");
	}, [app]);

	if (entries.length === 0) {
		return (
			<div className="ll-no-results">
				No entries found matching the filters.
			</div>
		);
	}

	return (
		<table className="ll-table">
			<thead>
				<tr>
					<th>{targetLang}</th>
					<th>{sourceLang}</th>
					<th>Type</th>
					<th>Context</th>
					<th>Rating</th>
					<th>Examples</th>
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
	entry: DictionaryEntry;
	onOpenFile: (path: string) => void;
}

function NormalRow({ entry, onOpenFile }: NormalRowProps) {
	const handleClick = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		onOpenFile(entry.file.path);
	}, [entry.file.path, onOpenFile]);

	return (
		<tr>
			<td>
				<a
					className="internal-link"
					href={entry.file.path}
					onClick={handleClick}
				>
					{entry.file.basename}
				</a>
			</td>
			<td>{entry.sourceWord}</td>
			<td className="ll-tags">{entry.type}</td>
			<td className="ll-tags">{entry.context}</td>
			<td>{entry.rating || ""}</td>
			<td
				className="ll-examples"
				dangerouslySetInnerHTML={{
					__html: entry.examples?.replace(/<br>/g, "<br>") || ""
				}}
			/>
		</tr>
	);
}

interface StudyRowProps {
	entry: DictionaryEntry;
	showSourceFirst: boolean;
}

function StudyRow({ entry, showSourceFirst }: StudyRowProps) {
	const [isExpanded, setIsExpanded] = React.useState(false);

	const questionText = showSourceFirst ? entry.sourceWord : entry.file.basename;
	const answerText = showSourceFirst ? entry.file.basename : entry.sourceWord;

	return (
		<tr className="ll-study-row">
			<td colSpan={6}>
				<div
					className="ll-study-question"
					onClick={() => setIsExpanded(!isExpanded)}
				>
					<h4 className="ll-collapsible">{questionText}</h4>
				</div>
				<div className={`ll-study-answer ${isExpanded ? "" : "ll-hidden"}`}>
					<span className="ll-answer-text">{answerText}</span>
					{entry.type && (
						<span className="ll-answer-type"> ({entry.type})</span>
					)}
					{entry.examples && (
						<div
							className="ll-answer-examples"
							dangerouslySetInnerHTML={{
								__html: entry.examples.replace(/<br>/g, "<br>")
							}}
						/>
					)}
				</div>
			</td>
		</tr>
	);
}
