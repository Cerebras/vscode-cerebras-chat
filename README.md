# Cerebras VS Code Extension

> Build with the world's fastest AI inference—directly in VS Code, powered by Cerebras.

Make GitHub Copilot run 10× faster with the world’s fastest inference API. Cerebras Inference powers the world’s top coding models at 2,000 tokens/sec, making code generation instant and enabling super-fast agentic flows. Get your [free API key](https://cloud.cerebras.ai/?referral_code=vscode&utm_source=vscode) to get started today.

## Get Started

### API Key Setup

Here's how you can use Cerebras models in VS Code:

1. Get your free API key from [Cerebras Cloud](https://cloud.cerebras.ai/?referral_code=vscode&utm_source=vscode).
2. Install the [Cerebras VS Code extension](https://marketplace.visualstudio.com/items?itemName=cerebras.cerebras-chat).
3. Set up GitHub Copilot if you haven't already done so.
4. In the GitHub Copilot chat interface, select Manage Models and choose Cerebras.
5. Paste in your API key when prompted.
6. Choose which models to enable.
7. You're all set! Happy coding 🎉


> Note: Bring-your-own-key is not supported for GitHub Copilot Enterprise subscriptions at this time.

### Supported Models

This extension provides support for **GLM 4.6 in agent mode**, as well as the following models in chat mode:

| Model | Token Speed |
|------------|-------------|
| OpenAI GPT OSS | ~3,000 tokens/sec |
| Z.ai GLM 4.7 | ~1,000 tokens/sec |
| Z.ai GLM 4.6 | ~1,000 tokens/sec |
| Qwen 3 32B | ~2,600 tokens/sec |
| Qwen 3 235B Instruct (Preview) | ~1,400 tokens/sec |
| Llama 3.1 8B | ~2,200 tokens/sec |
| Llama 3.3 70B | ~2,100 tokens/sec |

### Advanced Tips

Here's how you can accomplish more with Cerebras:
* Get higher rate limits on GLM 4.6 with our [Cerebras Code](https://www.cerebras.ai/blog/introducing-cerebras-code) plans, starting at $50/month.
* Generate code at top speed with Cerebras by installing the [Cerebras Code MCP server](https://inference-docs.cerebras.ai/integrations/code-mcp).
* Read our [developer documentation](https://inference-docs.cerebras.ai/) to turbocharge your own AI products using Cerebras' Inference API.

## What is Cerebras?

Cerebras Systems delivers the world's fastest AI inference for leading open models on top of its revolutionary AI hardware and software.

Cerebras consistently delivers chart-topping speeds for leading open models like Qwen 3 480B Coder and OpenAI's GPT OSS 120B, according to independent measurements by [Artificial Analysis](https://artificialanalysis.ai/models/qwen3-coder-480b-a35b-instruct/providers) and [OpenRouter](https://openrouter.ai/qwen/qwen3-coder).

At the heart of Cerebras' technology is the Wafer-Scale Engine (WSE), which is purpose-built for ultra-fast AI training and inference. The Cerebras WSE is the world's fastest processor for AI, delivering unprecedented speed that no number of GPUs can match. Learn more about our novel hardware architecture [here](https://www.youtube.com/watch?v=RhXONURR7Yc).

## Related

- [Cerebras Inference Documentation](https://inference-docs.cerebras.ai/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Language Model API Documentation](https://code.visualstudio.com/api/extension-guides/chat)
- [VS Code Extension Samples](https://github.com/Microsoft/vscode-extension-samples)