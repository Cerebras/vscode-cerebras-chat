import assert from 'node:assert/strict';
import test from 'node:test';

import { toCerebrasMessages } from '../src/messageConversion.ts';

test('preserves mixed text and multiple tool-result boundaries', () => {
	assert.deepEqual(toCerebrasMessages([{
		role: 'user',
		content: [
			{ kind: 'text', value: 'before' },
			{ kind: 'tool_result', callId: 'call-1', content: 'first result' },
			{ kind: 'text', value: 'between' },
			{ kind: 'tool_result', callId: 'call-2', content: 'second result' },
			{ kind: 'text', value: 'after' },
		],
	}]), [
		{ role: 'user', content: 'before' },
		{ role: 'tool', content: 'first result', tool_call_id: 'call-1' },
		{ role: 'user', content: 'between' },
		{ role: 'tool', content: 'second result', tool_call_id: 'call-2' },
		{ role: 'user', content: 'after' },
	]);
});

test('retains image content on both sides of a tool result', () => {
	assert.deepEqual(toCerebrasMessages([{
		role: 'user',
		content: [
			{ kind: 'text', value: 'first image' },
			{ kind: 'image', mimeType: 'image/png', data: Uint8Array.from([1, 2, 3]) },
			{ kind: 'tool_result', callId: 'call-1', content: 'image result' },
			{ kind: 'text', value: 'second image' },
			{ kind: 'image', mimeType: 'image/jpeg', data: Uint8Array.from([4, 5, 6]) },
		],
	}]), [
		{
			role: 'user',
			content: [
				{ type: 'text', text: 'first image' },
				{ type: 'image_url', image_url: { url: 'data:image/png;base64,AQID' } },
			],
		},
		{ role: 'tool', content: 'image result', tool_call_id: 'call-1' },
		{
			role: 'user',
			content: [
				{ type: 'text', text: 'second image' },
				{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BAUG' } },
			],
		},
	]);
});

test('keeps multiple tool calls together with assistant text', () => {
	assert.deepEqual(toCerebrasMessages([{
		role: 'assistant',
		content: [
			{ kind: 'text', value: 'calling tools' },
			{ kind: 'tool_call', callId: 'call-1', name: 'first', input: { value: 1 } },
			{ kind: 'tool_call', callId: 'call-2', name: 'second', input: { value: 2 } },
		],
	}]), [{
		role: 'assistant',
		content: 'calling tools',
		tool_calls: [
			{
				id: 'call-1',
				type: 'function',
				function: { name: 'first', arguments: '{"value":1}' },
			},
			{
				id: 'call-2',
				type: 'function',
				function: { name: 'second', arguments: '{"value":2}' },
			},
		],
	}]);
});
