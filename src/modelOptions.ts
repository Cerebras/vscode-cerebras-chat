import type { ChatCompletionCreateParamsStreaming } from "@cerebras/cerebras_cloud_sdk/src/resources/chat/index.js";

export type CerebrasModelOptions = Partial<ChatCompletionCreateParamsStreaming>;

export interface CerebrasRateLimitSnapshot {
	limitRequestsMinute?: number;
	remainingRequestsMinute?: number;
	resetRequestsMinuteSeconds?: number;
	limitTokensMinute?: number;
	remainingTokensMinute?: number;
	resetTokensMinuteSeconds?: number;
}

interface HeaderBag {
	get(name: string): string | null | undefined;
}

export const FREE_TIER_TPM_THRESHOLD = 64000;
export const FREE_TIER_RPM_THRESHOLD = 10;
export const FREE_TIER_AGENT_COMPLETION_TOKENS = 2048;
export const MIN_AGENT_COMPLETION_TOKENS = 512;

// VS Code's modelOptions bag can include private Copilot telemetry and
// correlation fields. Only forward options that are part of the Cerebras API
// contract; the provider owns model, messages, stream, tools, and tool_choice.
const FORWARDED_MODEL_OPTION_KEYS = [
	'clear_thinking',
	'disable_reasoning',
	'frequency_penalty',
	'logit_bias',
	'logprobs',
	'max_completion_tokens',
	'max_tokens',
	'min_completion_tokens',
	'min_tokens',
	'parallel_tool_calls',
	'prediction',
	'presence_penalty',
	'reasoning_effort',
	'reasoning_format',
	'response_format',
	'seed',
	'service_tier',
	'stop',
	'temperature',
	'top_logprobs',
	'top_p',
	'user',
] as const satisfies ReadonlyArray<keyof ChatCompletionCreateParamsStreaming>;

export function sanitizeCerebrasModelOptions(
	modelOptions: Readonly<Record<string, unknown>> | undefined
): CerebrasModelOptions {
	if (!modelOptions) {
		return {};
	}

	return Object.fromEntries(
		FORWARDED_MODEL_OPTION_KEYS
			.filter(key => modelOptions[key] !== undefined)
			.map(key => [key, modelOptions[key]])
	) as CerebrasModelOptions;
}

function readHeaderValue(
	headers: HeaderBag | Readonly<Record<string, string | null | undefined>>,
	name: string
): string | null | undefined {
	if (typeof (headers as HeaderBag).get === 'function') {
		return (headers as HeaderBag).get(name);
	}
	const record = headers as Readonly<Record<string, string | null | undefined>>;
	if (record[name] !== undefined) {
		return record[name];
	}
	const lower = name.toLowerCase();
	for (const [key, value] of Object.entries(record)) {
		if (key.toLowerCase() === lower) {
			return value;
		}
	}
	return undefined;
}

function parseNonNegativeNumber(raw: string | null | undefined): number | undefined {
	if (raw === null || raw === undefined || raw.trim() === '') {
		return undefined;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseCerebrasRateLimitHeaders(
	headers: HeaderBag | Readonly<Record<string, string | null | undefined>> | null | undefined
): CerebrasRateLimitSnapshot | null {
	if (!headers) {
		return null;
	}

	const snapshot: CerebrasRateLimitSnapshot = {
		limitRequestsMinute: parseNonNegativeNumber(readHeaderValue(headers, 'x-ratelimit-limit-requests-minute')),
		remainingRequestsMinute: parseNonNegativeNumber(readHeaderValue(headers, 'x-ratelimit-remaining-requests-minute')),
		resetRequestsMinuteSeconds: parseNonNegativeNumber(readHeaderValue(headers, 'x-ratelimit-reset-requests-minute')),
		limitTokensMinute: parseNonNegativeNumber(readHeaderValue(headers, 'x-ratelimit-limit-tokens-minute')),
		remainingTokensMinute: parseNonNegativeNumber(readHeaderValue(headers, 'x-ratelimit-remaining-tokens-minute')),
		resetTokensMinuteSeconds: parseNonNegativeNumber(readHeaderValue(headers, 'x-ratelimit-reset-tokens-minute')),
	};

	const hasAnyField = Object.values(snapshot).some(value => value !== undefined);
	return hasAnyField ? snapshot : null;
}

export function isLowRateLimitTier(
	snapshot: CerebrasRateLimitSnapshot | null | undefined
): boolean {
	if (!snapshot) {
		return false;
	}
	if (snapshot.limitTokensMinute !== undefined && snapshot.limitTokensMinute <= FREE_TIER_TPM_THRESHOLD) {
		return true;
	}
	if (snapshot.limitRequestsMinute !== undefined && snapshot.limitRequestsMinute <= FREE_TIER_RPM_THRESHOLD) {
		return true;
	}
	return false;
}

export function resolveMaxCompletionTokens(options: {
	callerMaxCompletionTokens?: number | null;
	callerMaxTokens?: number | null;
	defaultCompletionTokens: number;
	isAgentRequest: boolean;
	rateLimits?: CerebrasRateLimitSnapshot | null;
}): number | undefined {
	const {
		callerMaxCompletionTokens,
		callerMaxTokens,
		defaultCompletionTokens,
		isAgentRequest,
		rateLimits,
	} = options;

	const requestedTokens = callerMaxCompletionTokens !== undefined && callerMaxCompletionTokens !== null
		? callerMaxCompletionTokens
		: callerMaxTokens !== undefined && callerMaxTokens !== null
			? callerMaxTokens
			: defaultCompletionTokens;

	if (isAgentRequest && isLowRateLimitTier(rateLimits)) {
		let budget = Math.min(requestedTokens, FREE_TIER_AGENT_COMPLETION_TOKENS);
		if (rateLimits?.remainingTokensMinute !== undefined && rateLimits.remainingTokensMinute > 0) {
			budget = Math.min(
				budget,
				Math.max(MIN_AGENT_COMPLETION_TOKENS, Math.floor(rateLimits.remainingTokensMinute * 0.5))
			);
		}
		return budget;
	}

	if (callerMaxCompletionTokens !== undefined && callerMaxCompletionTokens !== null) {
		return callerMaxCompletionTokens;
	}
	if (callerMaxTokens !== undefined && callerMaxTokens !== null) {
		return undefined;
	}
	return defaultCompletionTokens;
}

export function getPreStreamWaitNotice(
	rateLimits: CerebrasRateLimitSnapshot | null | undefined
): string {
	if (isLowRateLimitTier(rateLimits)) {
		const resetSeconds = Math.max(
			rateLimits?.resetTokensMinuteSeconds ?? 0,
			rateLimits?.resetRequestsMinuteSeconds ?? 0
		);
		const tpmInfo = rateLimits?.limitTokensMinute
			? ` (${rateLimits.limitTokensMinute.toLocaleString('en-US')} TPM free-tier limit)`
			: ' (free-tier rate limit)';
		if (resetSeconds > 0) {
			return `Cerebras: waiting ~${Math.ceil(resetSeconds)}s for rate-limit window reset${tpmInfo} before streaming starts...`;
		}
		return `Cerebras: waiting for available rate-limit capacity${tpmInfo} before streaming starts...`;
	}
	return 'Cerebras: waiting for API rate-limit capacity before streaming starts...';
}
