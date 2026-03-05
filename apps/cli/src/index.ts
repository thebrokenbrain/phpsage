// This file provides the PHPSage CLI command for running PHPStan and syncing run lifecycle events.
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { parsePhpstanJsonOutput, type ParsedPhpstanIssue } from "@phpsage/shared";

interface CliOptions {
	readonly targetPath: string;
	readonly serverUrl: string;
	readonly phpstanBin: string;
	readonly cwd: string;
	readonly memoryLimit?: string;
	readonly openBrowser: boolean;
	readonly watch: boolean;
	readonly watchIntervalMs: number;
}

interface AppCommandOptions {
	readonly serverUrl: string;
	readonly openBrowser: boolean;
}

type CliCommand =
	| {
			readonly kind: "analyse";
			readonly options: CliOptions;
		}
	| {
			readonly kind: "app";
			readonly options: AppCommandOptions;
		};

interface StartRunResponse {
	readonly runId: string;
}

interface HealthResponse {
	readonly statusCode: number;
	readonly text: string;
}

async function main(): Promise<void> {
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

	const { options } = command;

	if (options.openBrowser) {
		process.stdout.write(`PHPSage UI available at ${options.serverUrl}\n`);
	}

	if (options.watch) {
		await runWatchMode(options);
		return;
	}

	const exitCode = await runAnalyseCycle(options);
	process.exitCode = exitCode;
}

async function runWatchMode(options: CliOptions): Promise<void> {
	process.stdout.write(`Watch mode enabled for ${options.targetPath} (${options.watchIntervalMs}ms)\n`);
	let isRunning = false;
	let rerunRequested = false;
	let lastSnapshot = createTargetSnapshot(options.targetPath);

	const executeCycle = async () => {
		if (isRunning) {
			rerunRequested = true;
			return;
		}

		isRunning = true;
		try {
			const exitCode = await runAnalyseCycle(options);
			process.stdout.write(`Watch cycle finished with exitCode=${exitCode}\n`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Watch cycle error: ${message}\n`);
		} finally {
			isRunning = false;
			if (rerunRequested) {
				rerunRequested = false;
				await executeCycle();
			}
		}
	};

	await executeCycle();

	setInterval(() => {
		const nextSnapshot = createTargetSnapshot(options.targetPath);
		if (nextSnapshot === lastSnapshot) {
			return;
		}

		lastSnapshot = nextSnapshot;
		process.stdout.write("Changes detected. Scheduling analysis...\n");
		void executeCycle();
	}, options.watchIntervalMs);

	await new Promise<void>(() => {
		// Keep process alive while watching.
	});
}

async function runAnalyseCycle(options: CliOptions): Promise<number> {
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

async function runPhpstanAndFinalize(options: CliOptions, runId: string): Promise<number> {
	const phpstanArgs = buildPhpstanArgs(options);
	const stdoutChunks: string[] = [];
	const stderrChunks: string[] = [];

	const child = spawn(options.phpstanBin, phpstanArgs, {
		cwd: options.cwd,
		stdio: ["ignore", "pipe", "pipe"]
	});

	let streamQueue = Promise.resolve();
	const queueLog = (stream: "stdout" | "stderr", chunk: string) => {
		const message = chunk.trimEnd();
		if (!message) {
			return;
		}

		streamQueue = streamQueue.then(() =>
			postJson(`${options.serverUrl}/api/runs/${runId}/log`, {
				stream,
				message
			})
		);
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
			resolveExitCode(typeof code === "number" ? code : 1);
		});
	});

	await streamQueue;

	const issues = parseIssuesFromOutput(stdoutChunks.join(""), stderrChunks.join(""));
	await postJson(`${options.serverUrl}/api/runs/${runId}/finish`, {
		issues,
		exitCode
	});

	process.stdout.write(`Run finished. runId=${runId} exitCode=${exitCode} issues=${issues.length}\n`);
	return exitCode;
}

function createTargetSnapshot(targetPath: string): string {
	const entries: string[] = [];

	function walk(currentPath: string): void {
		let directoryEntries: ReturnType<typeof readdirSync>;
		try {
			directoryEntries = readdirSync(currentPath, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of directoryEntries) {
			if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "vendor") {
				continue;
			}

			const fullPath = resolve(currentPath, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
				continue;
			}

			if (!isWatchedPath(entry.name)) {
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
	return entries.join("|");
}

function isWatchedPath(fileName: string): boolean {
	if (fileName.endsWith(".php")) {
		return true;
	}

	return fileName === "phpstan.neon" || fileName === "phpstan.neon.dist" || fileName === "composer.json";
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

	if (args.length < 3 || args[0] !== "phpstan" || args[1] !== "analyse") {
		return null;
	}

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
	const openBrowser = !args.includes("--no-open");
	const watch = args.includes("--watch");
	const watchIntervalMs = parsePositiveIntegerFlag(args, "--watch-interval", 2000);
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
			openBrowser,
			watch,
			watchIntervalMs
		}
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

function parseAppArguments(args: string[]): AppCommandOptions | null {
	if (args.length < 1 || args[0] !== "app") {
		return null;
	}

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

	return args[index + 1];
}

function printUsage(): void {
	process.stdout.write(
		"Usage:\n"
			+ "  phpsage app [--port <port>] [--no-open] [--docker] [--server-url <url>]\n"
			+ "  phpsage phpstan analyse <path> [--port <port>] [--no-open] [--cwd <dir>] [--phpstan-bin <bin>] [--memory-limit <limit>] [--watch] [--watch-interval <ms>] [--docker] [--server-url <url>]\n"
	);
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
