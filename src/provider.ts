import { CancellationToken, ExtensionContext, InputBoxValidationSeverity, LanguageModelChatInformation, LanguageModelChatMessage, LanguageModelChatMessageRole, LanguageModelChatProvider, LanguageModelResponsePart, LanguageModelTextPart, LanguageModelToolCallPart, LanguageModelToolResultPart, Progress, ProvideLanguageModelChatResponseOptions, window } from "vscode";
import { Cerebras } from "@cerebras/cerebras_cloud_sdk";
import { ChatCompletionCreateParams, ChatCompletionCreateParamsStreaming } from "@cerebras/cerebras_cloud_sdk/src/resources/chat/index.js";
import { get_encoding, Tiktoken } from "tiktoken";


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
		toolCalling: false,
		supportsParallelToolCalls: true,
	},
	{
		id: "gpt-oss-120b",
		name: "OpenAI GPT OSS",
		detail: "~3,000 tokens/sec",
		maxInputTokens: 131000, // 131k for paid tiers, 64k for free tier
		maxOutputTokens: 64000,
		toolCalling: false,
		supportsReasoningEffort: true,
		supportsParallelToolCalls: false,
	},
	{
		id: "qwen-3-32b",
		name: "Qwen 3 32B",
		detail: "~2,600 tokens/sec",
		maxInputTokens: 128000, // 128k for paid tiers, 64k for free tier
		supportsThinking: true,
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
		supportsThinking: true,
		supportsParallelToolCalls: true
	}
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

const THINK_DELIMITER = '</think>';

export class CerebrasChatModelProvider implements LanguageModelChatProvider {
	private client: Cerebras | null = null;
	private tokenizer: Tiktoken | null = null;

	constructor(private readonly context: ExtensionContext) { }

	/**
	 * Prompts the user to enter their Cerebras API key and stores it securely.
	 *
	 * @param apiKey - Optional pre-filled API key value to display in the input box
	 * @returns A promise that resolves to the entered API key if valid, or undefined if cancelled
	 *
	 * @remarks
	 * This method validates that the API key:
	 * - Starts with 'csk-' prefix
	 * - Is exactly 52 characters long
	 *
	 * The API key is stored securely using VS Code's secrets API under the key 'CEREBRAS_API_KEY'.
	 */
	public async setApiKey(): Promise<string | undefined> {
		let apiKey: string | undefined = await this.context.secrets.get('CEREBRAS_API_KEY');
		apiKey = await window.showInputBox({
			placeHolder: "Cerebras API Key (e.g. csk-...)",
			password: true,
			value: apiKey || '',
			prompt: "Enter your Cerebras API key",
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value.startsWith('csk-') || value.length !== 52) {
					return { message: "Invalid API key", severity: InputBoxValidationSeverity.Error };
				}
			}
		});

		if (!apiKey) {
			return undefined;
		}

		void this.context.secrets.store('CEREBRAS_API_KEY', apiKey);
		this.client = new Cerebras({
			apiKey: apiKey,
		});

		return apiKey;
	}

	/**
	 * Initialize the Cerebras client.
	 * @param silent Whether to initialize silently without prompting for API key
	 * @returns Whether the initialization was successful
	 */
	private async initClient(silent: boolean): Promise<boolean> {
		if (this.client) {
			return true;
		}

		// Prompt for API key if not silent using quickpick
		let apiKey: string | undefined = await this.context.secrets.get('CEREBRAS_API_KEY');
		if (!silent && !apiKey) {
			apiKey = await this.setApiKey();
		} else if (apiKey) {
			this.client = new Cerebras({
				apiKey: apiKey,
			});
		}

		return !!apiKey;
	}

	async provideLanguageModelChatInformation(options: { silent: boolean; }, _token: CancellationToken): Promise<LanguageModelChatInformation[]> {
		const initialized = await this.initClient(options.silent);
		if (!initialized) {
			console.warn('Cerebras client not initialized. Please set your API key.');
			return [];
		}

		// Combine production and preview models
		const allModels = [...PREVIEW_MODELS, ...PRODUCTION_MODELS];

		// Map to LanguageModelChatInformation objects
		return allModels.map(model => getChatModelInfo(model));
	}

	async provideLanguageModelChatResponse(model: LanguageModelChatInformation, messages: Array<LanguageModelChatMessage>, options: ProvideLanguageModelChatResponseOptions, progress: Progress<LanguageModelResponsePart>, token: CancellationToken): Promise<void> {
		// Check if client is initialized
		if (!this.client) {
			progress.report(new LanguageModelTextPart("Please add your Cerebras API key to use Cerebras Inference."));
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
			const toolCalls: ChatCompletionCreateParams.AssistantMessageRequest['tool_calls'] = [];
			const role = msg.role;

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
				} else if (part instanceof LanguageModelToolResultPart) {
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
					role: "assistant",
					content: messageContent || '',
					tool_calls: toolCalls
				} satisfies ChatCompletionCreateParams.AssistantMessageRequest;
			}

			return {
				role: toChatMessageRole(role),
				content: messageContent
			} satisfies ChatCompletionMessage;
		}).filter(msg => (msg.content !== null && msg.content.length > 0) || (msg.role === "tool" || msg.tool_calls));

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

		// Reset text buffer at the start of each response
		let thinkingBuffer: string | null = '';

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

				// Handle text content with buffering logic
				if (delta?.content) {
					if (!foundModel.supportsThinking || thinkingBuffer === null) {
						// If thinking is not supported for this model, we can process the content directly
						progress.report(new LanguageModelTextPart(delta.content));
					} else {
						// Accumulate content in buffer
						thinkingBuffer += delta.content;

						// Check if buffer contains the delimiter
						const delimiterIndex = thinkingBuffer.indexOf(THINK_DELIMITER);
						if (delimiterIndex !== -1) {
							// Report only the text after the delimiter
							const textAfterDelimiter = thinkingBuffer.substring(delimiterIndex + THINK_DELIMITER.length).trim();
							if (textAfterDelimiter) {
								progress.report(new LanguageModelTextPart(textAfterDelimiter));
							}
							// Clear the buffer after processing
							thinkingBuffer = null;
						}
					}
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
		if (!this.tokenizer) {
			this.tokenizer = get_encoding("cl100k_base");
		}

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
						// Count tokens for tool calls (name + JSON-serialized input)
						return part.name + JSON.stringify(part.input);
					} else if (part instanceof LanguageModelToolResultPart) {
						// Count tokens for tool results
						return part.content
							.filter(resultPart => resultPart instanceof LanguageModelTextPart)
							.map(resultPart => (resultPart as LanguageModelTextPart).value)
							.join('');
					}
					return '';
				})
				.join('');
		}

		const tokens = this.tokenizer.encode(textContent);
		this.tokenizer.free(); // Free associated memory
		return tokens.length;
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