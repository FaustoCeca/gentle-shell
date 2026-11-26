import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_RDD_SUGGESTIONS, RDD_SUGGESTIONS, RDD_SUGGESTIONS_SCHEMA, parseRddSuggestionsFile, resolveRddSuggestions, writeRddSuggestions } from "../lib/rdd-suggestions-policy.ts";

const home = (t: { after(callback: () => void): void }) => {
	const dir = mkdtempSync(join(tmpdir(), "gentle-rdd-suggestions-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
};

test("a missing preference means the default suggestions", (t) => {
	const dir = home(t);
	assert.equal(DEFAULT_RDD_SUGGESTIONS, "default");
	assert.deepEqual(resolveRddSuggestions({ gentlePiConfigHome: dir }), { suggestions: "default", source: "default", malformed: false, globalFile: join(dir, "rdd-suggestions.json") });
	assert.deepEqual(readdirSync(dir), [], "resolving never creates the file");
});

test("the preference round-trips through the atomic writer", (t) => {
	const dir = home(t);
	const path = writeRddSuggestions(RDD_SUGGESTIONS.DETAILED, { gentlePiConfigHome: dir });
	assert.equal(path, join(dir, "rdd-suggestions.json"));
	assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { schema: RDD_SUGGESTIONS_SCHEMA, suggestions: "detailed" });
	assert.equal(RDD_SUGGESTIONS_SCHEMA, "gentle-pi.rdd-suggestions/v1");
	assert.deepEqual(resolveRddSuggestions({ gentlePiConfigHome: dir }), { suggestions: "detailed", source: "global_file", malformed: false, globalFile: path });
	writeRddSuggestions(RDD_SUGGESTIONS.DEFAULT, { gentlePiConfigHome: dir });
	assert.equal(resolveRddSuggestions({ gentlePiConfigHome: dir }).suggestions, "default");
	assert.deepEqual(readdirSync(dir), ["rdd-suggestions.json"], "no temporary file survives the rename");
});

test("the writer creates a missing config home", (t) => {
	const dir = join(home(t), "nested");
	writeRddSuggestions(RDD_SUGGESTIONS.DETAILED, { gentlePiConfigHome: dir });
	assert.equal(resolveRddSuggestions({ gentlePiConfigHome: dir }).suggestions, "detailed");
});

test("the writer rejects values outside the suggestions domain", (t) => {
	const dir = home(t);
	assert.throws(() => writeRddSuggestions("verbose" as never, { gentlePiConfigHome: dir }), TypeError);
	assert.equal(existsSync(join(dir, "rdd-suggestions.json")), false);
});

test("invalid or unreadable preference files read as default and are never overwritten", (t) => {
	for (const raw of ["", "{", "[]", "null", `{"schema":"${RDD_SUGGESTIONS_SCHEMA}","suggestions":"verbose"}`, `{"schema":"other/v1","suggestions":"detailed"}`, `{"schema":"${RDD_SUGGESTIONS_SCHEMA}","suggestions":"detailed","extra":1}`, `{"schema":"${RDD_SUGGESTIONS_SCHEMA}","content":"detailed"}`]) {
		assert.equal(parseRddSuggestionsFile(raw), undefined, raw);
		const dir = home(t);
		const path = join(dir, "rdd-suggestions.json");
		writeFileSync(path, raw);
		assert.deepEqual(resolveRddSuggestions({ gentlePiConfigHome: dir }), { suggestions: "default", source: "global_file", malformed: true, globalFile: path }, raw);
		assert.throws(() => writeRddSuggestions(RDD_SUGGESTIONS.DETAILED, { gentlePiConfigHome: dir }), /Cannot update malformed or unreadable RDD suggestions preference/, raw);
		assert.equal(readFileSync(path, "utf8"), raw, "the malformed file is preserved");
	}
	const dir = home(t);
	mkdirSync(join(dir, "rdd-suggestions.json"));
	assert.equal(resolveRddSuggestions({ gentlePiConfigHome: dir }).malformed, true, "a directory in its place is unreadable, not missing");
	assert.throws(() => writeRddSuggestions(RDD_SUGGESTIONS.DETAILED, { gentlePiConfigHome: dir }), /Cannot update malformed or unreadable RDD suggestions preference/);
	assert.deepEqual(readdirSync(dir), ["rdd-suggestions.json"], "the rejected write must not create temporary files");
	assert.deepEqual(readdirSync(join(dir, "rdd-suggestions.json")), [], "the unreadable directory is preserved");
});

// The agent_end reminder reads this at render time, so a broken config home must not throw there.
test("the resolver never throws, even for an unusable config home", (t) => {
	const file = join(home(t), "not-a-directory");
	writeFileSync(file, "x");
	assert.deepEqual({ ...resolveRddSuggestions({ gentlePiConfigHome: file }), globalFile: "" }, { suggestions: "default", source: "global_file", malformed: true, globalFile: "" });
	assert.equal(resolveRddSuggestions({ gentlePiConfigHome: "\0" }).suggestions, "default");
});

// chmod cannot deny reads on Windows; retain the portable directory case above.
test("POSIX unreadable preference files read as default and are never overwritten", {
	skip: process.platform === "win32" || process.getuid?.() === 0 ? "requires POSIX permissions and a non-root user" : false,
}, (t) => {
	const locked = home(t);
	writeRddSuggestions(RDD_SUGGESTIONS.DETAILED, { gentlePiConfigHome: locked });
	chmodSync(join(locked, "rdd-suggestions.json"), 0o000);
	try {
		assert.deepEqual({ ...resolveRddSuggestions({ gentlePiConfigHome: locked }), globalFile: "" }, { suggestions: "default", source: "global_file", malformed: true, globalFile: "" });
		assert.throws(() => writeRddSuggestions(RDD_SUGGESTIONS.DEFAULT, { gentlePiConfigHome: locked }), /Cannot update malformed or unreadable RDD suggestions preference/);
	} finally {
		chmodSync(join(locked, "rdd-suggestions.json"), 0o600);
	}
	assert.equal(resolveRddSuggestions({ gentlePiConfigHome: locked }).suggestions, RDD_SUGGESTIONS.DETAILED, "the rejected write preserves the stored preference");
	assert.deepEqual(readdirSync(locked), ["rdd-suggestions.json"], "the rejected write leaves no temporary files");
});
