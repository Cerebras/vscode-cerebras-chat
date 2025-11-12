import { CancellationToken, LanguageModelResponsePart, LanguageModelTextPart, Progress } from "vscode";
import { APIError, RateLimitError } from "@cerebras/cerebras_cloud_sdk/error";

const HTTP_STATUS = {
	TOO_MANY_REQUESTS: 429
} as const;

const TIMING = {
	ONE_SECOND_MS: 1000,
	BASE_BACKOFF_MS: 1000,
	MAX_BACKOFF_MS: 15000,
	MAX_JITTER_MS: 1000,
	MIN_WAIT_SECONDS: 1,
	MAX_WAIT_MS: 30 * 60 * 1000 // Cap waits to thirty minutes to avoid excessive delays
} as const;

const ERROR_MESSAGES = {
	CANCELLATION: "Operation cancelled",
	DAILY_TOKEN_LIMIT_MARKER: "tokens per day limit exceeded"
} as const;

export class RateLimitHandler {
	private rateLimitResumeAt: number | null = null;
	private readonly rateLimitWaiters = new Set<symbol>();
	private static readonly DAILY_TOKEN_LIMIT_MARKER = ERROR_MESSAGES.DAILY_TOKEN_LIMIT_MARKER;

	isRateLimitError(error: unknown): error is RateLimitError | APIError {
		if (error instanceof RateLimitError) {
			return true;
		}

		if (error instanceof APIError) {
			return error.status === HTTP_STATUS.TOO_MANY_REQUESTS;
		}

		return false;
	}

	isDailyTokenLimitError(error: unknown): error is APIError {
		if (!(error instanceof APIError) || error.status !== HTTP_STATUS.TOO_MANY_REQUESTS) {
			return false;
		}

		const message = this.extractErrorMessage(error);
		return message.toLowerCase().includes(RateLimitHandler.DAILY_TOKEN_LIMIT_MARKER);
	}

	reportDailyTokenLimit(progress: Progress<LanguageModelResponsePart>, error: APIError): void {
		const message = this.extractErrorMessage(error);
		const requestId = this.extractRequestId(message);
		const logContext = {
			scope: "daily_token_limit",
			timestamp: new Date().toISOString(),
			requestId,
			message
		};
		const advisory = requestId
			? `Cerebras daily token quota exceeded (request ${requestId}). Please wait for the quota to reset or upgrade your plan before retrying.\n`
			: "Cerebras daily token quota exceeded. Please wait for the quota to reset or upgrade your plan before retrying.\n";

		console.warn("Cerebras API daily token limit hit", logContext);
		progress.report(new LanguageModelTextPart(advisory));
		this.setRateLimitResumeAt(null);
	}

	/**
	 * Extracts the retry-after delay in milliseconds from a rate limit error.
	 * Cerebras provides rate limit reset times in response headers:
	 * - x-ratelimit-reset-requests-day: seconds until daily request limit resets
	 * - x-ratelimit-reset-tokens-minute: seconds until per-minute token limit resets
	 *
	 * Returns null if no retry-after information is found.
	 */
	extractRetryAfterMillis(error: RateLimitError | APIError): number | null {
		const headers = error.headers ?? {};

		const resetHeaders = [
			"x-ratelimit-reset-tokens-minute",
			"x-ratelimit-reset-requests-day",
		];

		for (const headerName of resetHeaders) {
			const value = this.getHeaderValue(headers, headerName);
			if (value !== null) {
				const seconds = Number(value);
				if (Number.isFinite(seconds) && seconds > 0) {
					const delayMs = Math.ceil(seconds * TIMING.ONE_SECOND_MS);
					return Math.min(delayMs, TIMING.MAX_WAIT_MS);
				}
			}
		}

		// Fallback to standard Retry-After header (RFC 9110) in case another infra component intervenes
		const retryAfter = this.getHeaderValue(headers, "retry-after");
		if (retryAfter !== null) {
			// Can be either seconds (integer) or HTTP-date
			const seconds = Number(retryAfter);
			if (Number.isFinite(seconds) && !Number.isNaN(seconds)) {
				const delayMs = Math.max(0, seconds * TIMING.ONE_SECOND_MS);
				return Math.min(delayMs, TIMING.MAX_WAIT_MS);
			}

			// Try parsing as HTTP-date
			const date = Date.parse(retryAfter);
			if (!Number.isNaN(date)) {
				const delayMs = Math.max(0, date - Date.now());
				return Math.min(delayMs, TIMING.MAX_WAIT_MS);
			}
		}

		return null;
	}

	private getHeaderValue(headers: Record<string, string | string[] | null | undefined>, headerName: string): string | null {
		const lowerName = headerName.toLowerCase();
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() === lowerName && value != null) {
				if (Array.isArray(value)) {
					const normalized = value.find(item => item != null && item.length > 0);
					if (normalized) {
						return normalized;
					}
					continue;
				}
				return value;
			}
		}
		return null;
	}

	private extractErrorMessage(error: APIError): string {
		if (typeof error.message === "string" && error.message.length > 0) {
			return error.message;
		}

		const payload = error.error;
		if (this.isMessagePayload(payload)) {
			const message = payload.message;
			if (typeof message === "string" && message.length > 0) {
				return message;
			}
		}

		return String(error);
	}

	private isMessagePayload(value: unknown): value is { message?: unknown } {
		return typeof value === "object" && value !== null && "message" in value;
	}

	private extractRequestId(message: string): string | undefined {
		const match = message.match(/Request id:\s*([0-9a-f-]+)/i);
		return match?.[1];
	}

	/**
	 * Calculates exponential backoff delay with jitter.
	 * @param attempt The 1-based retry attempt count.
	 * @returns Delay in milliseconds capped by TIMING.MAX_BACKOFF_MS.
	 */
	calculateBackoffDelay(attempt: number): number {
		const jitterMs = Math.random() * TIMING.MAX_JITTER_MS;
		const exponent = Math.max(0, attempt - 1);
		const baseDelay = TIMING.BASE_BACKOFF_MS * Math.pow(2, exponent);
		return Math.min(TIMING.MAX_BACKOFF_MS, baseDelay + jitterMs);
	}

	/**
	 * Records when requests can resume without violating rate limits.
	 * Ensures the wait horizon never exceeds TIMING.MAX_WAIT_MS.
	 */
	setRateLimitResumeAt(timestamp: number | null): void {
		if (typeof timestamp === "number") {
			const now = Date.now();
			if (timestamp <= now) {
				this.rateLimitResumeAt = now;
				return;
			}

			const clampedTimestamp = Math.min(timestamp, now + TIMING.MAX_WAIT_MS);
			this.rateLimitResumeAt = clampedTimestamp;
			return;
		}

		this.rateLimitResumeAt = null;
	}

	async waitForRateLimit(progress: Progress<LanguageModelResponsePart>, token: CancellationToken): Promise<boolean> {
		const waiterToken = Symbol("rate-limit-waiter");
		this.rateLimitWaiters.add(waiterToken);

		try {
			while (true) {
				const resumeAt = this.rateLimitResumeAt;
				if (!resumeAt) {
					return true;
				}

				let waitMs = resumeAt - Date.now();
				if (waitMs <= 0) {
					if (this.rateLimitResumeAt === resumeAt) {
						this.rateLimitResumeAt = null;
					}
					return true;
				}

				if (this.rateLimitResumeAt !== resumeAt) {
					continue;
				}

				waitMs = Math.min(waitMs, TIMING.MAX_WAIT_MS);
				const remainingSeconds = Math.max(TIMING.MIN_WAIT_SECONDS, Math.ceil(waitMs / TIMING.ONE_SECOND_MS));
				progress.report(new LanguageModelTextPart(`Rate limit active. Resuming in ~${remainingSeconds}s...\n`));

				try {
					await this.delay(waitMs, token);
				} catch {
					return false;
				}

				if (token.isCancellationRequested) {
					return false;
				}
			}
		} finally {
			this.rateLimitWaiters.delete(waiterToken);
		}
	}

	private async delay(ms: number, token: CancellationToken): Promise<void> {
		if (ms <= 0) {
			return;
		}

		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				disposable.dispose();
				resolve();
			}, ms);

			const disposable = token.onCancellationRequested(() => {
				clearTimeout(timer);
				disposable.dispose();
				reject(new Error(ERROR_MESSAGES.CANCELLATION));
			});
		});
	}
}
