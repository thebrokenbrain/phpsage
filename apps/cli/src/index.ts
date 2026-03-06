// This file provides the PHPSage CLI command for running PHPStan and syncing run lifecycle events.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync, type Dirent } from "node:fs";
import { resolve } from "node:path";
import { parsePhpstanJsonOutput, type ParsedPhpstanIssue } from "@phpsage/shared";

const cliVersion = "0.1.0";

interface CliOptions {
	readonly targetPath: string;
	readonly serverUrl: string;
	readonly phpstanBin: string;
	readonly cwd: string;
	readonly memoryLimit?: string;
	readonly timeoutMs: number | null;
	readonly openBrowser: boolean;
	readonly watch: boolean;
	readonly watchIntervalMs: number;
	readonly watchDebounceMs: number;
	readonly watchRunOnStart: boolean;
	readonly watchQuiet: boolean;
	readonly watchIgnoredDirectories: readonly string[];
	readonly watchMaxCycles: number | null;
	readonly watchExtensions: readonly string[];
	readonly watchFiles: readonly string[];
	readonly jsonSummary: boolean;
}

interface AnalyseCycleResult {
	readonly runId: string;
	readonly exitCode: number;
	readonly issueCount: number;
	readonly durationMs: number;
	readonly finishedAt: string;
}

interface TargetSnapshot {
	readonly fingerprint: string;
	readonly fileCount: number;
}

interface WatchRuntimeState {
	cycleCount: number;
	successCount: number;
	failureCount: number;
	lastExitCode: number | null;
	isCycleRunning: boolean;
	rerunRequested: boolean;
	isStopping: boolean;
	stopReason: string | null;
}

interface AppCommandOptions {
	readonly serverUrl: string;
	readonly openBrowser: boolean;
}

interface RagIngestCommandOptions {
	readonly serverUrl: string;
	readonly targetPath?: string;
	readonly waitForCompletion: boolean;
	readonly pollIntervalMs: number;
}

type CliCommand =
	| {
			readonly kind: "analyse";
			readonly options: CliOptions;
		}
	| {
			readonly kind: "app";
			readonly options: AppCommandOptions;
		}
	| {
			readonly kind: "rag-ingest";
			readonly options: RagIngestCommandOptions;
		};

interface StartRunResponse {
	readonly runId: string;
}

interface HealthResponse {
	readonly statusCode: number;
	readonly text: string;
}

interface AiIngestJobResponse {
	readonly jobId: string;
	readonly targetPath: string;
	readonly status: "queued" | "running" | "completed" | "failed";
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly startedAt: string | null;
	readonly finishedAt: string | null;
	readonly error: string | null;
	readonly stats: {
		readonly filesIndexed: number;
		readonly chunksIndexed: number;
	} | null;
}

async function main(): Promise<void> {
	if (process.argv.includes("--help") || process.argv.includes("-h")) {
		printUsage();
		process.exitCode = 0;
		return;
	}

	if (process.argv.includes("--version") || process.argv.includes("-v")) {
		process.stdout.write(`${cliVersion}\n`);
		process.exitCode = 0;
		return;
	}

	const command = parseArguments(process.argv.slice(2));
	if (!command) {
		printUsage();
		process.exitCode = 1;
		return;
	}

	await ensureServerReady(command.options.serverUrl);

	if (command.kind === "app") {
		startAppExperience(command.options);
		return;
	}

	if (command.kind === "rag-ingest") {
		await runRagIngest(command.options);
		return;
	}

	const { options } = command;
	ensureTargetPathIsDirectory(options.targetPath);

	if (options.openBrowser) {
		process.stdout.write(`PHPSage UI available at ${options.serverUrl}\n`);
	}

	if (options.watch) {
		await runWatchMode(options);
		return;
	}

	const result = await runAnalyseCycle(options);
	if (options.jsonSummary) {
		process.stdout.write(`${JSON.stringify({ event: "analyse-summary", ...result })}\n`);
	}
	process.exitCode = result.exitCode;
}

async function runRagIngest(options: RagIngestCommandOptions): Promise<void> {
	const payload = options.targetPath ? { targetPath: options.targetPath } : {};
	const job = await postJson<AiIngestJobResponse>(`${options.serverUrl}/api/ai/ingest`, payload);

	process.stdout.write(`Ingest job queued: ${job.jobId} (${job.targetPath})\n`);

	if (!options.waitForCompletion) {
		return;
	}

	const finalJob = await waitForIngestJobCompletion(options, job.jobId);
	process.stdout.write(`Ingest job ${finalJob.status}: ${finalJob.jobId}\n`);
	if (finalJob.stats) {
		process.stdout.write(
			`Ingest stats filesIndexed=${finalJob.stats.filesIndexed} chunksIndexed=${finalJob.stats.chunksIndexed}\n`
		);
	}

	if (finalJob.status === "failed") {
		const reason = finalJob.error ? ` (${finalJob.error})` : "";
		throw new Error(`Ingest failed${reason}`);
	}
}

async function waitForIngestJobCompletion(
	options: RagIngestCommandOptions,
	jobId: string
): Promise<AiIngestJobResponse> {
	while (true) {
		const job = await getJson<AiIngestJobResponse>(`${options.serverUrl}/api/ai/ingest/${jobId}`);
		if (job.status === "completed" || job.status === "failed") {
			return job;
		}

		await wait(options.pollIntervalMs);
	}
}

async function runWatchMode(options: CliOptions): Promise<void> {
	process.stdout.write(
		`Watch mode enabled for ${options.targetPath} (interval=${options.watchIntervalMs}ms debounce=${options.watchDebounceMs}ms)\n`
	);

	const state: WatchRuntimeState = {
		cycleCount: 0,
		successCount: 0,
		failureCount: 0,
		lastExitCode: null,
		isCycleRunning: false,
		rerunRequested: false,
		isStopping: false,
		stopReason: null
	};

	let lastSnapshot = createTargetSnapshot(
		options.targetPath,
		options.watchIgnoredDirectories,
		options.watchExtensions,
		options.watchFiles
	);
	if (!options.watchQuiet) {
		process.stdout.write(`Watch mode is tracking ${lastSnapshot.fileCount} files\n`);
	}
	let pollTimer: NodeJS.Timeout | null = null;
	let debounceTimer: NodeJS.Timeout | null = null;
	let resolveStopPromise: (() => void) | null = null;

	const clearTimers = () => {
		if (pollTimer) {
			clearTimeout(pollTimer);
			pollTimer = null;
		}

		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	};

	const requestStop = (reason: string, signal?: NodeJS.Signals) => {
		if (state.isStopping) {
			return;
		}

		state.isStopping = true;
		state.stopReason = reason;
		clearTimers();
		if (signal) {
			process.stdout.write(`\nStopping watch mode (${signal})...\n`);
		} else {
			process.stdout.write(`\nStopping watch mode (${reason})...\n`);
		}
		process.stdout.write(
			`Watch summary: cycles=${state.cycleCount} ok=${state.successCount} failed=${state.failureCount} lastExit=${state.lastExitCode ?? "-"}\n`
		);
		process.exitCode = state.lastExitCode ?? 0;
		if (resolveStopPromise) {
			resolveStopPromise();
		}
	};

	process.once("SIGINT", () => requestStop("signal", "SIGINT"));
	process.once("SIGTERM", () => requestStop("signal", "SIGTERM"));

	const executeCycle = async () => {
		if (state.isStopping) {
			return;
		}

		if (state.isCycleRunning) {
			state.rerunRequested = true;
			return;
		}

		state.isCycleRunning = true;
		state.cycleCount += 1;
		const cycleStartedAt = Date.now();
		try {
			if (options.watchMaxCycles && state.cycleCount > options.watchMaxCycles) {
				requestStop(`max-cycles:${options.watchMaxCycles}`);
				return;
			}

			const cycleResult = await runAnalyseCycle(options);
			state.lastExitCode = cycleResult.exitCode;
			if (cycleResult.exitCode === 0) {
				state.successCount += 1;
			} else {
				state.failureCount += 1;
			}

			if (options.jsonSummary) {
				process.stdout.write(
					`${JSON.stringify({ event: "watch-cycle", cycle: state.cycleCount, ...cycleResult })}\n`
				);
			}

			if (!options.watchQuiet) {
				const durationMs = Date.now() - cycleStartedAt;
				process.stdout.write(`Watch cycle #${state.cycleCount} finished exitCode=${cycleResult.exitCode} duration=${durationMs}ms\n`);
			}

			if (options.watchMaxCycles && state.cycleCount >= options.watchMaxCycles) {
				requestStop(`max-cycles:${options.watchMaxCycles}`);
			}
		} catch (error) {
			state.lastExitCode = 1;
			state.failureCount += 1;
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Watch cycle error: ${message}\n`);
		} finally {
			state.isCycleRunning = false;
			if (state.rerunRequested && !state.isStopping) {
				state.rerunRequested = false;
				await executeCycle();
			}
		}
	};

	const scheduleDebouncedCycle = () => {
		if (state.isStopping) {
			return;
		}

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			if (!options.watchQuiet) {
				process.stdout.write("Changes detected. Scheduling analysis...\n");
			}
			void executeCycle();
		}, options.watchDebounceMs);
	};

	const schedulePoll = () => {
		if (state.isStopping) {
			return;
		}

		pollTimer = setTimeout(() => {
			const nextSnapshot = createTargetSnapshot(
				options.targetPath,
				options.watchIgnoredDirectories,
				options.watchExtensions,
				options.watchFiles
			);
			if (nextSnapshot.fingerprint !== lastSnapshot.fingerprint) {
				if (!options.watchQuiet) {
					process.stdout.write(
						`Watch detected changes (files: ${lastSnapshot.fileCount} -> ${nextSnapshot.fileCount})\n`
					);
				}

				lastSnapshot = nextSnapshot;
				scheduleDebouncedCycle();
			}

			schedulePoll();
		}, options.watchIntervalMs);
	};

	if (options.watchRunOnStart) {
		await executeCycle();
	}

	if (state.isStopping) {
		return;
	}

	schedulePoll();

	await new Promise<void>((resolveWatchStop) => {
		resolveStopPromise = resolveWatchStop;
	});
}

async function runAnalyseCycle(options: CliOptions): Promise<AnalyseCycleResult> {
	const run = await postJson<StartRunResponse>(`${options.serverUrl}/api/runs/start`, {
		targetPath: options.targetPath
	});

	return runPhpstanAndFinalize(options, run.runId);
}

function startAppExperience(options: AppCommandOptions): void {
	if (options.openBrowser) {
		process.stdout.write(`PHPSage app ready at ${options.serverUrl}\n`);
	}

	process.stdout.write("Use the Dashboard target selector to choose a folder and click Run.\n");
}

async function runPhpstanAndFinalize(options: CliOptions, runId: string): Promise<AnalyseCycleResult> {
	const startedAt = Date.now();
	const phpstanArgs = buildPhpstanArgs(options);
	const stdoutChunks: string[] = [];
	const stderrChunks: string[] = [];

	const child = spawn(options.phpstanBin, phpstanArgs, {
		cwd: options.cwd,
		stdio: ["ignore", "pipe", "pipe"]
	});

	let timedOut = false;
	let forceKillTimer: NodeJS.Timeout | null = null;
	let timeoutTimer: NodeJS.Timeout | null = null;

	if (options.timeoutMs) {
		timeoutTimer = setTimeout(() => {
			timedOut = true;
			const timeoutMessage = `PHPStan execution timeout after ${options.timeoutMs}ms`;
			process.stderr.write(`${timeoutMessage}\n`);
			child.kill("SIGTERM");

			forceKillTimer = setTimeout(() => {
				child.kill("SIGKILL");
			}, 2000);
		}, options.timeoutMs);
	}

	let streamQueue = Promise.resolve();
	const queueLog = (stream: "stdout" | "stderr", chunk: string) => {
		const message = chunk.trimEnd();
		if (!message) {
			return;
		}

		streamQueue = streamQueue.then(async () => {
			const logPosted = await postRunLogWithRetry(options.serverUrl, runId, stream, message);
			if (!logPosted) {
				process.stderr.write(`Could not send run log after retries. runId=${runId} stream=${stream}\n`);
			}
		});
	};

	child.stdout.on("data", (chunk: Buffer) => {
		const text = chunk.toString("utf-8");
		stdoutChunks.push(text);
		process.stdout.write(text);
		queueLog("stdout", text);
	});

	child.stderr.on("data", (chunk: Buffer) => {
		const text = chunk.toString("utf-8");
		stderrChunks.push(text);
		process.stderr.write(text);
		queueLog("stderr", text);
	});

	const exitCode = await new Promise<number>((resolveExitCode) => {
		child.on("error", (error) => {
			const message = `PHPStan execution failed: ${error.message}`;
			process.stderr.write(`${message}\n`);
			stderrChunks.push(`${message}\n`);
			queueLog("stderr", message);
			resolveExitCode(1);
		});

		child.on("close", (code) => {
			if (timeoutTimer) {
				clearTimeout(timeoutTimer);
			}

			if (forceKillTimer) {
				clearTimeout(forceKillTimer);
			}

			if (timedOut) {
				resolveExitCode(124);
				return;
			}

			resolveExitCode(typeof code === "number" ? code : 1);
		});
	});

	await streamQueue;

	const issues = parseIssuesFromOutput(stdoutChunks.join(""), stderrChunks.join(""));
	const finishPosted = await postRunFinishWithRetry(options.serverUrl, runId, {
		issues,
		exitCode
	});
	if (!finishPosted) {
		process.stderr.write(`Could not send run finish event after retries. runId=${runId}\n`);
	}

	process.stdout.write(`Run finished. runId=${runId} exitCode=${exitCode} issues=${issues.length}\n`);
	return {
		runId,
		exitCode,
		issueCount: issues.length,
		durationMs: Date.now() - startedAt,
		finishedAt: new Date().toISOString()
	};
}

async function postRunFinishWithRetry(
	serverUrl: string,
	runId: string,
	body: { issues: ParsedPhpstanIssue[]; exitCode: number },
	maxAttempts = 3
): Promise<boolean> {
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			await postJson(`${serverUrl}/api/runs/${runId}/finish`, body);
			return true;
		} catch {
			if (attempt < maxAttempts) {
				await wait(200 * attempt);
			}
		}
	}

	return false;
}

async function postRunLogWithRetry(
	serverUrl: string,
	runId: string,
	stream: "stdout" | "stderr",
	message: string,
	maxAttempts = 3
): Promise<boolean> {
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			await postJson(`${serverUrl}/api/runs/${runId}/log`, {
				stream,
				message
			});
			return true;
		} catch {
			if (attempt < maxAttempts) {
				await wait(120 * attempt);
			}
		}
	}

	return false;
}

function createTargetSnapshot(
	targetPath: string,
	ignoredDirectories: readonly string[] = [],
	watchExtensions: readonly string[] = ["php"],
	watchFiles: readonly string[] = ["phpstan.neon", "phpstan.neon.dist", "composer.json"]
): TargetSnapshot {
	const ignoredDirectorySet = new Set<string>([".git", "node_modules", "vendor", ...ignoredDirectories]);
	const normalizedWatchExtensions = new Set(watchExtensions.map((entry) => normalizeExtension(entry)));
	const watchFileSet = new Set(watchFiles);
	const entries: string[] = [];

	function walk(currentPath: string): void {
		let directoryEntries: Dirent<string>[];
		try {
			directoryEntries = readdirSync(currentPath, { withFileTypes: true, encoding: "utf8" });
		} catch {
			return;
		}

		for (const entry of directoryEntries) {
			const entryName = entry.name;

			if (entry.isDirectory() && ignoredDirectorySet.has(entryName)) {
				continue;
			}

			const fullPath = resolve(currentPath, entryName);
			if (entry.isDirectory()) {
				walk(fullPath);
				continue;
			}

			if (!isWatchedPath(entryName, normalizedWatchExtensions, watchFileSet)) {
				continue;
			}

			try {
				const fileStat = statSync(fullPath);
				entries.push(`${fullPath}:${fileStat.mtimeMs}:${fileStat.size}`);
			} catch {
				// Ignore transient file access errors.
			}
		}
	}

	walk(targetPath);
	entries.sort((leftEntry, rightEntry) => leftEntry.localeCompare(rightEntry));
	return {
		fingerprint: entries.join("|"),
		fileCount: entries.length
	};
}

function ensureTargetPathIsDirectory(targetPath: string): void {
	try {
		const targetStat = statSync(targetPath);
		if (!targetStat.isDirectory()) {
			throw new Error(`Target path is not a directory: ${targetPath}`);
		}
	} catch {
		throw new Error(`Target path does not exist or cannot be accessed: ${targetPath}`);
	}
}

function isWatchedPath(
	fileName: string,
	watchExtensions: ReadonlySet<string>,
	watchFiles: ReadonlySet<string>
): boolean {
	if (watchFiles.has(fileName)) {
		return true;
	}

	const extension = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
	return watchExtensions.has(normalizeExtension(extension));
}

function normalizeExtension(extension: string): string {
	const normalized = extension.trim().toLowerCase();
	return normalized.startsWith(".") ? normalized.slice(1) : normalized;
}

function buildPhpstanArgs(options: CliOptions): string[] {
	const args = ["analyse", options.targetPath, "--error-format=json", "--no-progress"];
	const configPath = resolve(options.targetPath, "phpstan.neon");
	if (existsSync(configPath)) {
		args.push(`--configuration=${configPath}`);
	}

	if (options.memoryLimit) {
		args.push(`--memory-limit=${options.memoryLimit}`);
	}

	return args;
}

function parseIssuesFromOutput(stdout: string, stderr: string): ParsedPhpstanIssue[] {
	const fromStdout = parsePhpstanJsonOutput(stdout);
	if (fromStdout.length > 0) {
		return fromStdout;
	}

	return parsePhpstanJsonOutput(stderr);
}

async function ensureServerReady(serverUrl: string): Promise<void> {
	const maxAttempts = 20;
	const delayMs = 500;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const health = await getHealth(`${serverUrl}/healthz`);
		if (health.statusCode === 200) {
			const normalized = health.text.trim().toLowerCase();
			if (normalized === "ok") {
				return;
			}

			try {
				const parsed = JSON.parse(health.text) as { status?: string };
				if (typeof parsed.status === "string" && parsed.status.toLowerCase() === "ok") {
					return;
				}
			} catch {
				// Ignore parse errors and retry.
			}
		}

		await wait(delayMs);
	}

	throw new Error(`Unable to reach PHPSage server at ${serverUrl}`);
}

async function getHealth(url: string): Promise<HealthResponse> {
	try {
		const response = await fetch(url, { method: "GET" });
		return {
			statusCode: response.status,
			text: await response.text()
		};
	} catch {
		return {
			statusCode: 0,
			text: ""
		};
	}
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolveWait) => {
		setTimeout(resolveWait, milliseconds);
	});
}

function parseArguments(args: string[]): CliCommand | null {
	const appOptions = parseAppArguments(args);
	if (appOptions) {
		return {
			kind: "app",
			options: appOptions
		};
	}

	const ragIngestOptions = parseRagIngestArguments(args);
	if (ragIngestOptions) {
		return {
			kind: "rag-ingest",
			options: ragIngestOptions
		};
	}

	if (args.length < 3 || args[0] !== "phpstan" || args[1] !== "analyse") {
		return null;
	}

	validateFlags(args, [
		"--port",
		"--no-open",
		"--cwd",
		"--phpstan-bin",
		"--memory-limit",
		"--timeout-ms",
		"--watch",
		"--watch-interval",
		"--watch-debounce",
		"--watch-no-initial",
		"--watch-quiet",
		"--watch-ignore",
		"--watch-ext",
		"--watch-files",
		"--watch-max-cycles",
		"--json-summary",
		"--docker",
		"--server-url"
	], [
		"--port",
		"--cwd",
		"--phpstan-bin",
		"--memory-limit",
		"--timeout-ms",
		"--watch-interval",
		"--watch-debounce",
		"--watch-ignore",
		"--watch-ext",
		"--watch-files",
		"--watch-max-cycles",
		"--server-url"
	]);

	const targetPath = args[2];
	if (!targetPath) {
		return null;
	}

	const dockerMode = args.includes("--docker");
	const serverUrlFromFlag = getFlagValue(args, "--server-url");
	const portFromFlag = getFlagValue(args, "--port");
	const phpstanBin = getFlagValue(args, "--phpstan-bin") ?? process.env.PHPSAGE_PHPSTAN_BIN ?? "phpstan";
	const cwd = resolve(getFlagValue(args, "--cwd") ?? process.cwd());
	const memoryLimit = getFlagValue(args, "--memory-limit");
	const timeoutMs = parsePositiveIntegerFlagOrNull(args, "--timeout-ms");
	const openBrowser = !args.includes("--no-open");
	const watch = args.includes("--watch");
	const watchIntervalMs = parsePositiveIntegerFlag(args, "--watch-interval", 2000);
	const watchDebounceMs = parsePositiveIntegerFlag(args, "--watch-debounce", 800);
	const watchRunOnStart = !args.includes("--watch-no-initial");
	const watchQuiet = args.includes("--watch-quiet");
	const watchIgnoredDirectories = parseListFlag(args, "--watch-ignore");
	const watchExtensions = parseListFlag(args, "--watch-ext").map((entry) => normalizeExtension(entry));
	const watchFiles = parseListFlag(args, "--watch-files");
	const watchMaxCycles = parsePositiveIntegerFlagOrNull(args, "--watch-max-cycles");
	const jsonSummary = args.includes("--json-summary");
	const serverUrlFromEnv = process.env.PHPSAGE_SERVER_URL;

	const defaultPort = portFromFlag ?? "8080";
	const defaultServerUrl = dockerMode
		? `http://phpsage-server:${defaultPort}`
		: `http://localhost:${defaultPort}`;

	const serverUrl = serverUrlFromFlag ?? serverUrlFromEnv ?? defaultServerUrl;

	return {
		kind: "analyse",
		options: {
			targetPath,
			serverUrl,
			phpstanBin,
			cwd,
			memoryLimit,
			timeoutMs,
			openBrowser,
			watch,
			watchIntervalMs,
			watchDebounceMs,
			watchRunOnStart,
			watchQuiet,
			watchIgnoredDirectories,
			watchMaxCycles,
			watchExtensions: watchExtensions.length > 0 ? watchExtensions : ["php"],
			watchFiles: watchFiles.length > 0 ? watchFiles : ["phpstan.neon", "phpstan.neon.dist", "composer.json"],
			jsonSummary
		}
	};
}

function parseRagIngestArguments(args: string[]): RagIngestCommandOptions | null {
	if (args.length < 2 || args[0] !== "rag" || args[1] !== "ingest") {
		return null;
	}

	validateFlags(args, ["--port", "--docker", "--server-url", "--target-path", "--wait", "--poll-interval-ms"], [
		"--port",
		"--server-url",
		"--target-path",
		"--poll-interval-ms"
	]);

	const dockerMode = args.includes("--docker");
	const serverUrlFromFlag = getFlagValue(args, "--server-url");
	const portFromFlag = getFlagValue(args, "--port");
	const targetPath = getFlagValue(args, "--target-path");
	const waitForCompletion = args.includes("--wait");
	const pollIntervalMs = parsePositiveIntegerFlag(args, "--poll-interval-ms", 1000);
	const serverUrlFromEnv = process.env.PHPSAGE_SERVER_URL;

	const defaultPort = portFromFlag ?? "8080";
	const defaultServerUrl = dockerMode
		? `http://phpsage-server:${defaultPort}`
		: `http://localhost:${defaultPort}`;

	return {
		serverUrl: serverUrlFromFlag ?? serverUrlFromEnv ?? defaultServerUrl,
		targetPath,
		waitForCompletion,
		pollIntervalMs
	};
}

function parsePositiveIntegerFlag(args: string[], flag: string, defaultValue: number): number {
	const rawValue = getFlagValue(args, flag);
	if (!rawValue) {
		return defaultValue;
	}

	const parsedValue = Number.parseInt(rawValue, 10);
	if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
		return defaultValue;
	}

	return parsedValue;
}

function parsePositiveIntegerFlagOrNull(args: string[], flag: string): number | null {
	const rawValue = getFlagValue(args, flag);
	if (!rawValue) {
		return null;
	}

	const parsedValue = Number.parseInt(rawValue, 10);
	if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
		return null;
	}

	return parsedValue;
}

function parseListFlag(args: string[], flag: string): string[] {
	const rawValue = getFlagValue(args, flag);
	if (!rawValue) {
		return [];
	}

	return rawValue
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parseAppArguments(args: string[]): AppCommandOptions | null {
	if (args.length < 1 || args[0] !== "app") {
		return null;
	}

	validateFlags(args, ["--port", "--no-open", "--docker", "--server-url"], ["--port", "--server-url"]);

	const dockerMode = args.includes("--docker");
	const serverUrlFromFlag = getFlagValue(args, "--server-url");
	const portFromFlag = getFlagValue(args, "--port");
	const openBrowser = !args.includes("--no-open");
	const serverUrlFromEnv = process.env.PHPSAGE_SERVER_URL;

	const defaultPort = portFromFlag ?? "8080";
	const defaultServerUrl = dockerMode
		? `http://phpsage-server:${defaultPort}`
		: `http://localhost:${defaultPort}`;

	return {
		serverUrl: serverUrlFromFlag ?? serverUrlFromEnv ?? defaultServerUrl,
		openBrowser
	};
}

function getFlagValue(args: string[], flag: string): string | undefined {
	const index = args.findIndex((item) => item === flag);
	if (index === -1) {
		return undefined;
	}

	const nextValue = args[index + 1];
	if (!nextValue || nextValue.startsWith("--")) {
		return undefined;
	}

	return nextValue;
}

function validateFlags(args: string[], allowedFlags: readonly string[], flagsWithValue: readonly string[]): void {
	const allowedSet = new Set<string>(allowedFlags);
	const withValueSet = new Set<string>(flagsWithValue);

	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (!argument.startsWith("--")) {
			continue;
		}

		if (!allowedSet.has(argument)) {
			throw new Error(`Unknown flag: ${argument}`);
		}

		if (!withValueSet.has(argument)) {
			continue;
		}

		const nextValue = args[index + 1];
		if (!nextValue || nextValue.startsWith("--")) {
			throw new Error(`Flag ${argument} requires a value`);
		}

		index += 1;
	}
}

function printUsage(): void {
	process.stdout.write(
		"Usage:\n"
			+ "  phpsage --help | -h\n"
			+ "  phpsage --version | -v\n"
			+ "  phpsage app [--port <port>] [--no-open] [--docker] [--server-url <url>]\n"
			+ "  phpsage rag ingest [--target-path <path>] [--wait] [--poll-interval-ms <ms>] [--port <port>] [--docker] [--server-url <url>]\n"
			+ "  phpsage phpstan analyse <path> [--port <port>] [--no-open] [--cwd <dir>] [--phpstan-bin <bin>] [--memory-limit <limit>] [--timeout-ms <ms>] [--watch] [--watch-interval <ms>] [--watch-debounce <ms>] [--watch-no-initial] [--watch-quiet] [--watch-ignore <dir1,dir2>] [--watch-ext <php,inc>] [--watch-files <phpstan.neon,composer.json>] [--watch-max-cycles <n>] [--json-summary] [--docker] [--server-url <url>]\n"
	);
}

async function getJson<TResponse = unknown>(url: string): Promise<TResponse> {
	const response = await fetch(url, {
		method: "GET"
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`HTTP ${response.status}: ${text}`);
	}

	return (await response.json()) as TResponse;
}

async function postJson<TResponse = unknown>(url: string, body: unknown): Promise<TResponse> {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`HTTP ${response.status}: ${text}`);
	}

	return (await response.json()) as TResponse;
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`CLI error: ${message}\n`);
	process.exitCode = 1;
});
