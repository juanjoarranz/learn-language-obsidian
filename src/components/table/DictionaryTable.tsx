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
			{!isStudying && (
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
			)}
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

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function examplesHtml(input?: string): string {
	if (!input) return "";

	// Normalize <br> variants to newlines for easier processing
	const normalized = input.replace(/<br\s*\/?>/gi, "\n");
	const escaped = escapeHtml(normalized);

	// Minimal emphasis:
	// - *text* -> <em>text</em>
	// - _text_ -> <em>text</em>
	// Avoid converting underscores inside words like "dès_lors".
	let emphasized = escaped.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
	emphasized = emphasized.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, "$1<em>$2</em>");

	// Wrap in a span like the legacy DOM and restore <br>
	return `<span>${emphasized.replace(/\n/g, "<br>")}</span>`;
}

function tagsHtml(input?: string): React.ReactNode {
	if (!input) return null;

	const tokens = input
		.split(",")
		.map(t => t.trim())
		.filter(Boolean);

	return (
		<>
			{tokens.map((tagtrim, idx) => (
				<React.Fragment key={`${tagtrim}-${idx}`}>
					<span>
						<a
							href={tagtrim}
							className="tag"
							target="_blank"
							rel="noopener nofollow"
						>
							{tagtrim}
						</a>
					</span>
					{idx < tokens.length - 1 ? ", " : null}
				</React.Fragment>
			))}
		</>
	);
}

function NormalRow({ entry, onOpenFile }: NormalRowProps) {
	const { app } = useLearnLanguage();

	const hasMetadataMenu = Boolean(
		(app as any)?.plugins?.enabledPlugins?.has?.("metadata-menu") ||
		(app as any)?.plugins?.plugins?.["metadata-menu"]
	);

	const openMetadataMenuFieldsModal = useCallback(async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const commandId = "metadata-menu:open_fields_modal";
		const command = (app as any)?.commands?.commands?.[commandId];
		if (!command) return;

		const originalLeaf = app.workspace.activeLeaf;
		await app.workspace.openLinkText(entry.file.path, "", "tab");
		await (app as any).commands.executeCommandById(commandId);
		if (originalLeaf) {
			app.workspace.setActiveLeaf(originalLeaf, { focus: false });
		}
	}, [app, entry.file.path]);

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
				{hasMetadataMenu && (
					<a
						className="metadata-menu fileclass-icon"
						onClick={openMetadataMenuFieldsModal}
						aria-label="Open Metadata Menu fields"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="svg-icon lucide-clipboard-list"
						>
							<rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
							<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
							<path d="M12 11h4"></path>
							<path d="M12 16h4"></path>
							<path d="M8 11h.01"></path>
							<path d="M8 16h.01"></path>
						</svg>
					</a>
				)}


			</td>
			<td>{entry.sourceWord}</td>
			<td className="ll-tags">{tagsHtml(entry.type)}</td>
			<td className="ll-tags">{tagsHtml(entry.context)}</td>
			<td>{tagsHtml(entry.rating || "")}</td>
			<td
				className="ll-examples"
				dangerouslySetInnerHTML={{
					__html: examplesHtml(entry.examples)
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

  const questionLink = (
    <a className="internal-link" href={entry.file.path}>
      {showSourceFirst ? entry.sourceWord : entry.file.basename}
    </a>);

	const answerText = showSourceFirst ? entry.file.basename : entry.sourceWord;

	return (
		<tr className="ll-study-row">
			<td colSpan={6}>
				<div
					className="ll-study-question"
					onClick={() => setIsExpanded(!isExpanded)}
				>
					<h4 className="ll-collapsible">{questionLink}</h4>
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
								__html: examplesHtml(entry.examples)
							}}
						/>
					)}
				</div>
			</td>
		</tr>
	);
}
