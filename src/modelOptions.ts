import type { ChatCompletionCreateParamsStreaming } from "@cerebras/cerebras_cloud_sdk/src/resources/chat/index.js";

export type CerebrasModelOptions = Partial<ChatCompletionCreateParamsStreaming>;

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
