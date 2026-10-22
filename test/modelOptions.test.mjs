import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeCerebrasModelOptions } from '../src/modelOptions.ts';

test('forwards supported Cerebras options and drops VS Code private fields', () => {
	assert.deepEqual(sanitizeCerebrasModelOptions({
		temperature: 0.2,
		max_completion_tokens: 512,
		response_format: { type: 'json_object' },
		parallel_tool_calls: true,
		_capturingTokenCorrelationId: 'correlation-id',
		_otelTraceContext: { traceId: 'trace-id' },
		_telemetryTurn: { turnId: 'turn-id' },
		_enableThinking: true,
		_conversationId: 'conversation-id',
	}), {
		temperature: 0.2,
		max_completion_tokens: 512,
		parallel_tool_calls: true,
		response_format: { type: 'json_object' },
	});
});

test('does not allow model options to override provider-owned request fields', () => {
	assert.deepEqual(sanitizeCerebrasModelOptions({
		model: 'other-model',
		messages: [],
		stream: false,
		tools: [],
		tool_choice: 'none',
	}), {});
});

import {
	FREE_TIER_AGENT_COMPLETION_TOKENS,
	getPreStreamWaitNotice,
	isLowRateLimitTier,
	parseCerebrasRateLimitHeaders,
	resolveMaxCompletionTokens,
} from '../src/modelOptions.ts';

test('parses Cerebras x-ratelimit-* response headers', () => {
	const snapshot = parseCerebrasRateLimitHeaders({
		'x-ratelimit-limit-requests-minute': '5',
		'x-ratelimit-remaining-requests-minute': '1',
		'x-ratelimit-reset-requests-minute': '42',
		'x-ratelimit-limit-tokens-minute': '30000',
		'x-ratelimit-remaining-tokens-minute': '3000',
		'x-ratelimit-reset-tokens-minute': '18.5',
	});

	assert.deepEqual(snapshot, {
		limitRequestsMinute: 5,
		remainingRequestsMinute: 1,
		resetRequestsMinuteSeconds: 42,
		limitTokensMinute: 30000,
		remainingTokensMinute: 3000,
		resetTokensMinuteSeconds: 18.5,
	});
	assert.equal(isLowRateLimitTier(snapshot), true);
});

test('shapes completion token reservation for free-tier agent requests', () => {
	const freeTierLimits = {
		limitRequestsMinute: 5,
		limitTokensMinute: 30000,
		remainingTokensMinute: 12000,
	};

	assert.equal(resolveMaxCompletionTokens({
		callerMaxCompletionTokens: 32768,
		defaultCompletionTokens: 8192,
		isAgentRequest: true,
		rateLimits: freeTierLimits,
	}), FREE_TIER_AGENT_COMPLETION_TOKENS);

	assert.equal(resolveMaxCompletionTokens({
		defaultCompletionTokens: 8192,
		isAgentRequest: true,
		rateLimits: {
			limitTokensMinute: 30000,
			remainingTokensMinute: 2000,
		},
	}), 1000);

	assert.equal(resolveMaxCompletionTokens({
		callerMaxCompletionTokens: 16384,
		defaultCompletionTokens: 8192,
		isAgentRequest: true,
		rateLimits: {
			limitRequestsMinute: 1000,
			limitTokensMinute: 1000000,
		},
	}), 16384);
});

test('formats pre-stream wait notice for free-tier rate limits', () => {
	const notice = getPreStreamWaitNotice({
		limitTokensMinute: 30000,
		resetTokensMinuteSeconds: 14.2,
	});
	assert.match(notice, /waiting ~15s/);
	assert.match(notice, /30,000 TPM free-tier limit/);
});
