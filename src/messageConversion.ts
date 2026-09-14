import type { ChatCompletionCreateParams } from "@cerebras/cerebras_cloud_sdk/src/resources/chat/index.js";

export type ChatCompletionMessage =
	| ChatCompletionCreateParams.SystemMessageRequest
	| ChatCompletionCreateParams.ToolMessageRequest
	| ChatCompletionCreateParams.AssistantMessageRequest
	| ChatCompletionCreateParams.UserMessageRequest;

type AssistantToolCalls = NonNullable<ChatCompletionCreateParams.AssistantMessageRequest['tool_calls']>;
type ImageContent = ChatCompletionCreateParams.UserMessageRequest.ImageURLContent;

export type CerebrasMessagePart =
	| { kind: 'text'; value: string }
	| { kind: 'image'; mimeType: string; data: Uint8Array }
	| { kind: 'tool_call'; callId: string; name: string; input: unknown }
	| { kind: 'tool_result'; callId: string; content: string };

export interface CerebrasMessageInput {
	role: 'user' | 'assistant';
	content: ReadonlyArray<CerebrasMessagePart>;
}

function createChatMessage(
	role: CerebrasMessageInput['role'],
	textParts: string[],
	imageParts: ImageContent[],
	toolCalls: AssistantToolCalls
): ChatCompletionMessage | null {
	const messageContent = textParts.join('');

	if (role === 'user' && imageParts.length > 0) {
		return {
			role: 'user',
			content: [
				...(messageContent ? [{ type: 'text' as const, text: messageContent }] : []),
				...imageParts,
			],
		};
	}

	if (toolCalls.length > 0) {
		return {
			role: 'assistant',
			content: messageContent || '',
			tool_calls: [...toolCalls],
		};
	}

	if (messageContent.length === 0) {
		return null;
	}

	return {
		role,
		content: messageContent,
	};
}

export function toCerebrasMessages(messages: ReadonlyArray<CerebrasMessageInput>): ChatCompletionMessage[] {
	const cerebrasMessages: ChatCompletionMessage[] = [];

	for (const message of messages) {
		const textParts: string[] = [];
		const imageParts: ImageContent[] = [];
		const toolCalls: AssistantToolCalls = [];

		const flushPendingMessage = () => {
			const pendingMessage = createChatMessage(message.role, textParts, imageParts, toolCalls);
			if (pendingMessage) {
				cerebrasMessages.push(pendingMessage);
			}
			textParts.length = 0;
			imageParts.length = 0;
			toolCalls.length = 0;
		};

		for (const part of message.content) {
			switch (part.kind) {
				case 'text':
					textParts.push(part.value);
					break;
				case 'image':
					imageParts.push({
						type: 'image_url',
						image_url: {
							url: `data:${part.mimeType};base64,${Buffer.from(part.data).toString('base64')}`,
						},
					});
					break;
				case 'tool_call':
					toolCalls.push({
						id: part.callId,
						type: 'function',
						function: {
							name: part.name,
							arguments: JSON.stringify(part.input),
						},
					});
					break;
				case 'tool_result':
					flushPendingMessage();
					cerebrasMessages.push({
						role: 'tool',
						content: part.content,
						tool_call_id: part.callId,
					});
					break;
			}
		}

		flushPendingMessage();
	}

	return cerebrasMessages;
}
