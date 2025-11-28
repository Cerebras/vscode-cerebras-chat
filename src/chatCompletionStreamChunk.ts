export interface ChatCompletionStreamChunk {
	choices?: Array<{
		delta?: {
			content?: string;
			tool_calls?: Array<{
				id?: string;
				function?: {
					name?: string;
					arguments?: string;
				};
			}>;
		};
	}>;
}
