import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { gentlePiConfigHome } from "./agent-home.ts";

// How the agent_end review-preflight reminder lays out its native context,
// chosen in Gentle → Customize ("Detailed RDD suggestions"). `default` keeps
// one bounded `Flagged:` line; `detailed` lists each flagged reason on its own
// line with wider bounds. It never decides whether the reminder is sent. A
// missing file means default; a malformed or unreadable one also reads as
// default, and the writer refuses to replace it so a hand edit is never lost.
// There is no environment override.
export const RDD_SUGGESTIONS_SCHEMA = "gentle-pi.rdd-suggestions/v1";
const RDD_SUGGESTIONS_FILE = "rdd-suggestions.json";

export const RDD_SUGGESTIONS = {
	DEFAULT: "default",
	DETAILED: "detailed",
} as const;

export type RddSuggestions = (typeof RDD_SUGGESTIONS)[keyof typeof RDD_SUGGESTIONS];
export const DEFAULT_RDD_SUGGESTIONS: RddSuggestions = RDD_SUGGESTIONS.DEFAULT;

interface RddSuggestionsOptions { gentlePiConfigHome?: string }

export interface RddSuggestionsResolution {
	suggestions: RddSuggestions;
	source: "global_file" | "default";
	malformed: boolean;
	globalFile: string;
}

function isRddSuggestions(value: unknown): value is RddSuggestions {
	return value === RDD_SUGGESTIONS.DEFAULT || value === RDD_SUGGESTIONS.DETAILED;
}

export function parseRddSuggestionsFile(raw: string): RddSuggestions | undefined {
	try {
		const value: unknown = JSON.parse(raw);
		if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
		if (Object.keys(value).length !== 2 || !("schema" in value) || value.schema !== RDD_SUGGESTIONS_SCHEMA || !("suggestions" in value)) return undefined;
		return isRddSuggestions(value.suggestions) ? value.suggestions : undefined;
	} catch { return undefined; }
}

// The reminder reads this while rendering, so it must never throw: anything
// other than a missing file reads as a malformed default.
export function resolveRddSuggestions(options: RddSuggestionsOptions = {}): RddSuggestionsResolution {
	let globalFile = "";
	try {
		globalFile = join(options.gentlePiConfigHome ?? gentlePiConfigHome(), RDD_SUGGESTIONS_FILE);
		const suggestions = parseRddSuggestionsFile(readFileSync(globalFile, "utf8"));
		return { suggestions: suggestions ?? DEFAULT_RDD_SUGGESTIONS, source: "global_file", malformed: suggestions === undefined, globalFile };
	} catch (error) {
		const missing = globalFile !== "" && typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
		return { suggestions: DEFAULT_RDD_SUGGESTIONS, source: missing ? "default" : "global_file", malformed: !missing, globalFile };
	}
}

export function writeRddSuggestions(suggestions: RddSuggestions, options: RddSuggestionsOptions = {}): string {
	if (!isRddSuggestions(suggestions)) throw new TypeError("Invalid RDD suggestions");
	const home = options.gentlePiConfigHome ?? gentlePiConfigHome();
	const current = resolveRddSuggestions({ gentlePiConfigHome: home });
	if (current.malformed) throw new Error(`Cannot update malformed or unreadable RDD suggestions preference: ${current.globalFile}`);
	const path = current.globalFile;
	const temporary = `${path}.${randomUUID()}.tmp`;
	mkdirSync(home, { recursive: true });
	try {
		writeFileSync(temporary, `${JSON.stringify({ schema: RDD_SUGGESTIONS_SCHEMA, suggestions })}\n`, { flag: "wx", mode: 0o600 });
		renameSync(temporary, path);
	} finally {
		try { unlinkSync(temporary); } catch { /* Rename consumed the temporary file. */ }
	}
	return path;
}
