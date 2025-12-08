import React, { useState, useCallback } from "react";

export interface TermFormValues {
	targetTerm: string;
	sourceTerm: string;
	type: string;
	context: string;
	examples: string;
}

export interface TermModalContentProps {
	/** Whether we're editing an existing term */
	isEditing: boolean;
	/** Initial form values */
	initialValues: TermFormValues;
	/** Target language name (e.g., "French") */
	targetLanguage: string;
	/** Source language name (e.g., "Spanish") */
	sourceLanguage: string;
	/** Whether AI is configured and available */
	aiEnabled: boolean;
	/** Callback to ask AI for term info */
	onAskAI?: (term: string) => Promise<{
		sourceTerm: string;
		type: string;
		context: string;
		examples: string;
	} | null>;
	/** Callback when form is submitted */
	onSubmit: (values: TermFormValues) => Promise<void>;
	/** Callback when modal should close */
	onClose: () => void;
}

/**
 * React component for the term modal content
 */
export function TermModalContent({
	isEditing,
	initialValues,
	targetLanguage,
	sourceLanguage,
	aiEnabled,
	onAskAI,
	onSubmit,
	onClose
}: TermModalContentProps) {
	// Form state
	const [targetTerm, setTargetTerm] = useState(initialValues.targetTerm);
	const [sourceTerm, setSourceTerm] = useState(initialValues.sourceTerm);
	const [type, setType] = useState(initialValues.type);
	const [context, setContext] = useState(initialValues.context);
	const [examples, setExamples] = useState(initialValues.examples);
	const [isLoading, setIsLoading] = useState(false);

	// Handle Ask AI
	const handleAskAI = useCallback(async () => {
		if (!targetTerm.trim() || !onAskAI) return;

		setIsLoading(true);
		try {
			const response = await onAskAI(targetTerm);
			if (response) {
				setSourceTerm(response.sourceTerm);
				setType(response.type);
				setContext(response.context);
				setExamples(response.examples);
			}
		} finally {
			setIsLoading(false);
		}
	}, [targetTerm, onAskAI]);

	// Handle submit
	const handleSubmit = useCallback(async () => {
		if (!targetTerm.trim()) return;

		setIsLoading(true);
		try {
			await onSubmit({
				targetTerm: targetTerm.trim(),
				sourceTerm: sourceTerm.trim(),
				type: type.trim(),
				context: context.trim(),
				examples: examples.trim()
			});
		} finally {
			setIsLoading(false);
		}
	}, [targetTerm, sourceTerm, type, context, examples, onSubmit]);

	return (
		<div className="ll-term-modal-content">
			<h2>{isEditing ? "Edit Term" : "Create New Term"}</h2>

			<div className="ll-term-form">
				{/* Target language input */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">{targetLanguage}</div>
						<div className="setting-item-description">
							The {targetLanguage} term or expression
						</div>
					</div>
					<div className="setting-item-control">
						<input
							type="text"
							placeholder={`Enter ${targetLanguage} term`}
							value={targetTerm}
							onChange={(e) => setTargetTerm(e.target.value)}
							disabled={isEditing}
						/>
					</div>
				</div>

				{/* Source language input */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">{sourceLanguage}</div>
						<div className="setting-item-description">
							Translation to {sourceLanguage}
						</div>
					</div>
					<div className="setting-item-control">
						<input
							type="text"
							placeholder={`Enter ${sourceLanguage} translation`}
							value={sourceTerm}
							onChange={(e) => setSourceTerm(e.target.value)}
						/>
					</div>
				</div>

				{/* Type input */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">Type</div>
						<div className="setting-item-description">
							Term type (e.g., #verbe, #nom, #expression)
						</div>
					</div>
					<div className="setting-item-control">
						<input
							type="text"
							placeholder="#type/subtype"
							value={type}
							onChange={(e) => setType(e.target.value)}
						/>
					</div>
				</div>

				{/* Context input */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">Context</div>
						<div className="setting-item-description">
							Usage context (e.g., #social, #culinary)
						</div>
					</div>
					<div className="setting-item-control">
						<input
							type="text"
							placeholder="#context/subcontext"
							value={context}
							onChange={(e) => setContext(e.target.value)}
						/>
					</div>
				</div>

				{/* Examples textarea */}
				<div className="setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">Examples</div>
						<div className="setting-item-description">
							Usage examples (separate with &lt;br&gt;)
						</div>
					</div>
					<div className="setting-item-control">
						<textarea
							placeholder="Example 1<br>Example 2"
							value={examples}
							onChange={(e) => setExamples(e.target.value)}
							rows={4}
						/>
					</div>
				</div>
			</div>

			{/* Buttons */}
			<div className="ll-modal-buttons">
				{!isEditing && aiEnabled && onAskAI && (
					<button
						onClick={handleAskAI}
						disabled={isLoading || !targetTerm.trim()}
						aria-label="Ask AI"
					>
						🤖 Ask AI
					</button>
				)}
				<button onClick={onClose} disabled={isLoading}>
					Cancel
				</button>
				<button
					className="mod-cta"
					onClick={handleSubmit}
					disabled={isLoading || !targetTerm.trim()}
				>
					{isLoading ? "..." : isEditing ? "Update" : "Create"}
				</button>
			</div>
		</div>
	);
}
