# Change Log

All notable changes to the Cerebras BYOK VS Code extension will be documented in this file.

## `v0.1.18` (2026-01-02)

### Features
- Add GLM 4.7 in preview to agent mode
- Use conservative `max_completion_tokens` defaults (8192) to prevent premature rate limiting
  - Cerebras rate limiter estimates quota based on `max_completion_tokens` upfront, not actual usage
  - Lower defaults preserve rate limit headroom for agentic tools

### Fixes
- Update `llama-3.3-70b`: maxInputTokens to 131072, maxOutputTokens to 65536
- Update `qwen-3-235b-a22b-instruct-2507`: maxOutputTokens to 40960

## `v0.1.17` (2025-11-23)

### Features
- Removal of llama-4-scout, qwen-3-235b-thinking, qwen-3-480b-coder


## `v0.1.16` (2025-10-29)

### Features
- Add GLM 4.6 in preview to agent mode

### Fixes
- Mark [upcoming model deprecations](https://inference-docs.cerebras.ai/support/deprecation) (Qwen 3 235B Thinking, Qwen 3 480B Coder, Llama 4 Scout)

## `v0.1.15` (2025-10-26)

### Fixes
- Support both `csk_` and `csk-` prefixes in API key validation (thanks [@acomarce](https://github.com/acomarce)!)
