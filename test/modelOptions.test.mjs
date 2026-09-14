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
