# Cerebras Chat Model Provider

This VS Code extension implements a Cerebras chat model provider using the VS Code Language Model (LM) API. It provides access to Cerebras' production and preview models directly within VS Code's chat interface.

## What is Cerebras?

Cerebras Systems delivers the world's fastest AI inference for leading open models on top of its revolutionary AI hardware and software. At the heart of Cerebras' technology is the Wafer-Scale Engine (WSE), which is purpose-built for ultra-fast AI training and inference.

The Cerebras WSE is the world's fastest processor for AI, delivering unprecedented speed that no number of GPUs can match. It's designed for builders who want to do extraordinary things with AI, enabling them to run full-parameter models faster than anyone else while maintaining production scale. Learn more about our hardware architecture [here](https://www.youtube.com/watch?v=RhXONURR7Yc).

## Features

This extension provides support for the following open models in GitHub Copilot:
  - **Llama 4 Scout** (llama-4-scout-17b-16e-instruct)
  - **Llama 3.1 8B** (llama3.1-8b)
  - **Llama 3.3 70B** (llama-3.3-70b)
  - **OpenAI GPT OSS** (gpt-oss-120b)
  - **Qwen 3 32B** (qwen-3-32b)
  - **Llama 4 Maverick** (llama-4-maverick-17b-128e-instruct) - Preview
  - **Qwen 3 235B Instruct** (qwen-3-235b-a22b-instruct-2507) - Preview
  - **Qwen 3 235B Thinking** (qwen-3-235b-a22b-thinking-2507) - Preview
  - **Qwen 3 480B Coder** (qwen-3-coder-480b) - Preview

## Usage

### API Key Setup

To use the Cerebras models, you need to obtain an API key:

1. Get your API key from [Cerebras Cloud](https://cloud.cerebras.ai/)
2. In the chat UI, select Manage Models > Cerebras.
3. Paste in your API key.
4. You're all set!

Once the extension is active and the API key is set:

1. Open VS Code's chat interface
2. Click the model picker and click manage models
3. Select the Cerebras provider
4. Check the models based on what you want in the model picker
5. Send a request to the model

## Related

- [Cerebras Inference Documentation](https://inference-docs.cerebras.ai/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Language Model API Documentation](https://code.visualstudio.com/api/extension-guides/chat)
- [VS Code Extension Samples](https://github.com/Microsoft/vscode-extension-samples)