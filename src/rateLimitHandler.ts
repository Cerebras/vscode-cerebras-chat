import { CancellationToken, LanguageModelResponsePart, LanguageModelTextPart, Progress } from "vscode";
import { APIError, RateLimitError } from "@cerebras/cerebras_cloud_sdk/error";

const HTTP_TOO_MANY_REQUESTS_STATUS_CODE = 429;
const ONE_SECOND_IN_MS = 1000;
const BASE_BACKOFF_DELAY_MS = ONE_SECOND_IN_MS;
const MAX_BACKOFF_DELAY_MS = 15 * BASE_BACKOFF_DELAY_MS;
const MAX_JITTER_MS = BASE_BACKOFF_DELAY_MS;
const MIN_WAIT_SECONDS = 1;
const CANCELLATION_ERROR_MESSAGE = "Operation cancelled";

export class RateLimitHandler {
	private rateLimitResumeAt: number | null = null;
	private static readonly DAILY_TOKEN_LIMIT_MARKER = "tokens per day limit exceeded";

	isRateLimitError(error: unknown): error is RateLimitError {
		if (error instanceof RateLimitError) {
			return true;
		}

		return error instanceof APIError && error.status === HTTP_TOO_MANY_REQUESTS_STATUS_CODE;
	}

	isDailyTokenLimitError(error: unknown): error is APIError {
		if (!(error instanceof APIError) || error.status !== HTTP_TOO_MANY_REQUESTS_STATUS_CODE) {
			return false;
		}

		const message = this.extractErrorMessage(error);
		return message.toLowerCase().includes(RateLimitHandler.DAILY_TOKEN_LIMIT_MARKER);
	}

	reportDailyTokenLimit(progress: Progress<LanguageModelResponsePart>, error: APIError): void {
		const message = this.extractErrorMessage(error);
		const requestId = this.extractRequestId(message);
		const advisory = requestId
			? `Cerebras daily token quota exceeded (request ${requestId}). Please wait for the quota to reset or upgrade your plan before retrying.\n`
			: "Cerebras daily token quota exceeded. Please wait for the quota to reset or upgrade your plan before retrying.\n";

		console.warn(`Cerebras API daily token limit hit${requestId ? ` (request ${requestId})` : ""}.`);
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

		// Check Cerebras-specific rate limit reset headers (in seconds)
		const resetHeaders = [
			"x-ratelimit-reset-tokens-minute",
			"x-ratelimit-reset-requests-day",
		];

		for (const headerName of resetHeaders) {
			const value = this.getHeaderValue(headers, headerName);
			if (value !== null) {
				const seconds = Number(value);
				if (Number.isFinite(seconds) && seconds > 0) {
					return Math.ceil(seconds * ONE_SECOND_IN_MS);
				}
			}
		}

		// Fallback to standard Retry-After header (RFC 9110) in case another infra component intervenes
		const retryAfter = this.getHeaderValue(headers, "retry-after");
		if (retryAfter !== null) {
			// Can be either seconds (integer) or HTTP-date
			const seconds = Number(retryAfter);
			if (Number.isFinite(seconds) && !Number.isNaN(seconds)) {
				return Math.max(0, seconds * ONE_SECOND_IN_MS);
			}

			// Try parsing as HTTP-date
			const date = Date.parse(retryAfter);
			if (!Number.isNaN(date)) {
				return Math.max(0, date - Date.now());
			}
		}

		return null;
	}

	private getHeaderValue(headers: Record<string, string | null | undefined>, headerName: string): string | null {
		const lowerName = headerName.toLowerCase();
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() === lowerName && value != null) {
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

	calculateBackoffDelay(attempt: number): number {
		// Exponential backoff: 1s, 2s, 4s, 8s, 15s (capped)
		const jitterMs = Math.random() * MAX_JITTER_MS; // Add 0-1s jitter to avoid thundering herd
		const delay = BASE_BACKOFF_DELAY_MS * Math.pow(2, attempt - 1) + jitterMs;
		return Math.min(MAX_BACKOFF_DELAY_MS, delay);
	}

	setRateLimitResumeAt(timestamp: number | null): void {
		this.rateLimitResumeAt = timestamp;
	}

	async waitForRateLimit(progress: Progress<LanguageModelResponsePart>, token: CancellationToken): Promise<boolean> {
		if (!this.rateLimitResumeAt) {
			return true;
		}

		const waitMs = this.rateLimitResumeAt - Date.now();
		if (waitMs <= 0) {
			this.rateLimitResumeAt = null;
			return true;
		}

		const remainingSeconds = Math.max(MIN_WAIT_SECONDS, Math.ceil(waitMs / ONE_SECOND_IN_MS));
		progress.report(new LanguageModelTextPart(`Rate limit active. Resuming in ~${remainingSeconds}s...\n`));

		try {
			await this.delay(waitMs, token);
		} catch {
			// Cancelled during wait
			return false;
		}

		if (token.isCancellationRequested) {
			return false;
		}

		// Only clear if we're the ones who finished waiting
		// (another concurrent request might have set a newer time)
		if (this.rateLimitResumeAt && Date.now() >= this.rateLimitResumeAt) {
			this.rateLimitResumeAt = null;
		}

		return true;
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
				reject(new Error(CANCELLATION_ERROR_MESSAGE));
			});
		});
	}
}
