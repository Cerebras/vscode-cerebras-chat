import { CancellationToken, LanguageModelChatInformation, LanguageModelChatMessage, LanguageModelChatMessageRole, LanguageModelChatProvider, LanguageModelChatRequestHandleOptions, LanguageModelResponsePart, LanguageModelTextPart, LanguageModelToolCallPart, LanguageModelToolResultPart, Progress, ProviderResult, window } from "vscode";
import { Cerebras } from "@cerebras/cerebras_cloud_sdk";
import { ChatCompletionCreateParams, ChatCompletionCreateParamsStreaming } from "@cerebras/cerebras_cloud_sdk/src/resources/chat/index.js";


type ChatCompletionMessage = ChatCompletionCreateParams.SystemMessageRequest | ChatCompletionCreateParams.ToolMessageRequest | ChatCompletionCreateParams.AssistantMessageRequest | ChatCompletionCreateParams.UserMessageRequest;

// Production models
const PRODUCTION_MODELS = [
	{
		id: "llama-4-scout-17b-16e-instruct",
		name: "Llama 4 Scout",
		detail: "~2,600 tokens/sec",
		maxInputTokens: 32000, // 32k for paid tiers, 8k for free tier
		maxOutputTokens: 8000,
		toolCalling: false,
		supportsParallelToolCalls: false
	},
	{
		id: "llama3.1-8b",
		name: "Llama 3.1 8B",
		detail: "~2,200 tokens/sec",
		maxInputTokens: 32000, // 32k for paid tiers, 8k for free tier
		maxOutputTokens: 8000,
		toolCalling: false,
		supportsParallelToolCalls: false
	},
	{
		id: "llama-3.3-70b",
		name: "Llama 3.3 70B",
		detail: "~2,100 tokens/sec",
		maxInputTokens: 128000, // 128k for paid tiers, 65k for free tier
		maxOutputTokens: 8000,
		toolCalling: true,
		supportsParallelToolCalls: true,
	},
	{
		id: "gpt-oss-120b",
		name: "OpenAI GPT OSS",
		detail: "~2,800 tokens/sec",
		maxInputTokens: 131000, // 131k for paid tiers, 64k for free tier
		maxOutputTokens: 64000,
		toolCalling: true,
		supportsReasoningEffort: true,
		supportsParallelToolCalls: false,
	},
	{
		id: "qwen-3-32b",
		name: "Qwen 3 32B",
		detail: "~2,600 tokens/sec",
		maxInputTokens: 128000, // 128k for paid tiers, 64k for free tier
		maxOutputTokens: 8000,
		toolCalling: false,
		supportsReasoningEffort: false,
		supportsParallelToolCalls: false,
		temperature: 0.6,
		top_p: 0.95
	}
];

// Preview models
const PREVIEW_MODELS = [
	{
		id: "qwen-3-coder-480b",
		name: "Qwen 3 480B Coder",
		detail: "~2,000 tokens/sec",
		maxInputTokens: 128000, // 128k for paid tiers, 64k for free tier
		maxOutputTokens: 2000,
		toolCalling: true,
		supportsParallelToolCalls: false,
		temperature: 0.7,
		top_p: 0.8
	},
	{
		id: "qwen-3-235b-a22b-instruct-2507",
		name: "Qwen 3 235B Instruct",
		detail: "~1,400 tokens/sec",
		maxInputTokens: 131000, // 131k for paid tiers, 64k for free tier
		maxOutputTokens: 1400,
		toolCalling: false,
		supportsParallelToolCalls: false
	},
	{
		id: "qwen-3-235b-a22b-thinking-2507",
		name: "Qwen 3 235B Thinking",
		detail: "~1,700 tokens/sec",
		maxInputTokens: 128000, // 128k for paid tiers, 65k for free tier
		maxOutputTokens: 64000,
		toolCalling: false,
		supportsReasoningEffort: false,
		supportsParallelToolCalls: true
	},
	{
		id: "llama-4-maverick-17b-128e-instruct",
		name: "Llama 4 Maverick",
		detail: "~2,400 tokens/sec",
		maxInputTokens: 32000, // 32k for paid tiers, 8k for free tier
		maxOutputTokens: 8000,
		toolCalling: false,
		supportsParallelToolCalls: true,
		temperature: 0.6,
		min_p: 0.01,
		top_p: 0.9
	},
];

interface CerebrasModel {
	id: string;
	name: string;
	detail?: string;
	maxInputTokens: number;
	maxOutputTokens: number;
	toolCalling: boolean;
	supportsParallelToolCalls: boolean;
	hasMultiTurnToolLimitations?: boolean;
	supportsReasoningEffort?: boolean;
}

function getChatModelInfo(model: CerebrasModel): LanguageModelChatInformation {
	return {
		id: model.id,
		name: model.name,
		tooltip: `Cerebras ${model.name} model`,
		family: "cerebras",
		detail: model.detail,
		maxInputTokens: model.maxInputTokens,
		maxOutputTokens: model.maxOutputTokens,
		version: "1.0.0",
		capabilities: {
			toolCalling: model.toolCalling,
			imageInput: false,
		}
	};
}

export class CerebrasChatModelProvider implements LanguageModelChatProvider {
	private client: Cerebras | null = null;

	constructor() {
		// Initialize the Cerebras client if API key is available
		const apiKey = process.env.CEREBRAS_API_KEY;
		if (apiKey) {
			this.client = new Cerebras({
				apiKey: apiKey,
			});
		}
	}

	async prepareLanguageModelChatInformation(options: { silent: boolean; }, _token: CancellationToken): Promise<LanguageModelChatInformation[]> {
		if (options.silent && !this.client) {
			// If silent and no client, return empty list
			return [];
		}

		if (!this.client) {
			// Prompt for API key if not silent using quickpick
			const apiKey = await window.showInputBox({
				placeHolder: "Cerebras API Key",
				prompt: "Enter your Cerebras API key",
				ignoreFocusOut: true,
			});

			if (!apiKey) {
				return [];
			}

			this.client = new Cerebras({
				apiKey: apiKey,
			});
		}

		// Combine production and preview models
		const allModels = [...PREVIEW_MODELS, ...PRODUCTION_MODELS];

		// Map to LanguageModelChatInformation objects
		return allModels.map(model => getChatModelInfo(model));
	}

	async provideLanguageModelChatResponse(model: LanguageModelChatInformation, messages: Array<LanguageModelChatMessage>, options: LanguageModelChatRequestHandleOptions, progress: Progress<LanguageModelResponsePart>, token: CancellationToken): Promise<void> {
		// Check if client is initialized
		if (!this.client) {
			progress.report(new LanguageModelTextPart("Cerebras API key not found. Please set the CEREBRAS_API_KEY environment variable."));
			return;
		}

		// Find the model in our lists
		const allModels = [...PREVIEW_MODELS, ...PRODUCTION_MODELS];
		const foundModel = allModels.find(m => m.id === model.id);

		if (!foundModel) {
			return;
		}

		// Convert VS Code messages to Cerebras format
		// Handle text content, tool calls, and tool results
		const cerebrasMessages: ChatCompletionMessage[] = messages.map(msg => {
			const textContent: string[] = [];
			const toolCalls: any[] = [];
			let role = msg.role;

			for (const part of msg.content) {
				if (part instanceof LanguageModelTextPart) {
					textContent.push(part.value);
				} else if (part instanceof LanguageModelToolCallPart) {
					toolCalls.push({
						id: part.callId,
						type: "function",
						function: {
							name: part.name,
							arguments: JSON.stringify(part.input)
						}
					});
				} else if ('callId' in part) { // HACK: instanceof LanguageModelToolResultPart doesn't work
					// Tool results should be in user messages
					const resultContent = part.content
						.filter(resultPart => resultPart instanceof LanguageModelTextPart)
						.map(resultPart => (resultPart as LanguageModelTextPart).value)
						.join('');

					return {
						role: "tool",
						content: resultContent,
						tool_call_id: part.callId
					} satisfies ChatCompletionCreateParams.ToolMessageRequest;
				}
			}

			const messageContent = textContent.join('');

			// Return message with tool calls if present
			if (toolCalls.length > 0) {
				return {
					role: toChatMessageRole(role),
					content: messageContent || '',
					tool_calls: toolCalls
				};
			}

			return {
				role: toChatMessageRole(role),
				content: messageContent
			} satisfies ChatCompletionMessage;
		}).filter(msg => msg.content !== null && msg.content.length > 0 || msg.role === "tool" || (msg as any).tool_calls);

		// Convert VS Code tools to Cerebras format
		const cerebrasTools = options.tools?.map(tool => ({
			type: "function",
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema || {}
			}
		}));

		// Create chat completion request options
		const requestOptions: ChatCompletionCreateParamsStreaming = {
			...(foundModel.supportsReasoningEffort ? { reasoning_effort: 'medium' } : {}),
			model: model.id,
			messages: cerebrasMessages,
			max_completion_tokens: model.maxOutputTokens,
			stream: true,
			temperature: foundModel.temperature ?? 0.1,
			top_p: foundModel.top_p ?? undefined,
		};

		// Add tools if available
		if (cerebrasTools && cerebrasTools.length > 0 && foundModel.toolCalling) {
			requestOptions.tools = cerebrasTools;
		}

		const chatCompletion = await this.client.chat.completions.create(requestOptions);

		// Process streaming response
		for await (const chunk of chatCompletion) {
			// Check if the operation was cancelled
			if (token.isCancellationRequested) {
				break;
			}

			// Report the response chunk
			if (Array.isArray(chunk.choices) && chunk.choices.length > 0) {
				const choice = chunk.choices[0];
				const delta = choice.delta;

				// Handle text content
				if (delta?.content) {
					progress.report(new LanguageModelTextPart(delta.content));
				}

				// Handle tool calls
				if (delta?.tool_calls) {
					for (const toolCall of delta.tool_calls) {
						if (toolCall.function?.name && toolCall.function?.arguments && toolCall.id) {
							try {
								const parsedArgs = JSON.parse(toolCall.function.arguments);
								progress.report(new LanguageModelToolCallPart(
									toolCall.id,
									toolCall.function.name,
									parsedArgs
								));
							} catch (e) {
								// If arguments can't be parsed, skip this tool call
								console.warn('Failed to parse tool call arguments:', e);
							}
						}
					}
				}
			}
		}
	}

	async provideTokenCount(_model: LanguageModelChatInformation, text: string | LanguageModelChatMessage, _token: CancellationToken): Promise<number> {
		// In a real implementation, this would calculate actual token count
		// For now, we'll use a simple estimation
		let textContent = '';

		if (typeof text === 'string') {
			textContent = text;
		} else {
			// Extract text from message parts including tool calls and results
			textContent = text.content
				.map(part => {
					if (part instanceof LanguageModelTextPart) {
						return part.value;
					} else if (part instanceof LanguageModelToolCallPart) {
						// Estimate tokens for tool calls (name + JSON-serialized input)
						return part.name + JSON.stringify(part.input);
					} else if (part instanceof LanguageModelToolResultPart) {
						// Estimate tokens for tool results
						return part.content
							.filter(resultPart => resultPart instanceof LanguageModelTextPart)
							.map(resultPart => (resultPart as LanguageModelTextPart).value)
							.join('');
					}
					return '';
				})
				.join('');
		}

		// Rough estimation: 1 token ≈ 4 characters
		return Math.ceil(textContent.length / 4);
	}
}

function toChatMessageRole(role: LanguageModelChatMessageRole): "user" | "assistant" {
	switch (role) {
		case LanguageModelChatMessageRole.User:
			return 'user';
		case LanguageModelChatMessageRole.Assistant:
			return 'assistant';
		default:
			return 'user';
	}
}