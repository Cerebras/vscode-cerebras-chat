# Contributing to Cerebras VS Code Extension

Thank you for your interest in contributing to the Cerebras VS Code Extension! We welcome contributions from the community and are excited to collaborate with you.

## Getting Help and Support

If you have questions about the extension or need help:

- Join our Discord community: https://discord.gg/fQwFthdrq2
- File bugs and feature requests in our GitHub issues

## Reporting Issues

If you encounter any bugs or have feature requests, please file them in our [GitHub issues](https://github.com/cerebras/vscode-cerebras-chat/issues) with as much detail as possible.

When reporting a bug, please include:
- A clear description of the issue
- Steps to reproduce the problem
- Expected behavior vs. actual behavior
- VS Code version and operating system
- Any relevant error messages or logs

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or higher)
- [npm](https://www.npmjs.com/)
- [VS Code](https://code.visualstudio.com/)

### Building the Extension

1. Clone the repository:
   ```bash
   git clone https://github.com/cerebras/vscode-cerebras-chat.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run compile
   ```

   This will:
   - Check types with TypeScript
   - Run ESLint for code linting
   - Bundle the extension using esbuild
   - Copy required WASM files

### Development Build (Watch Mode)

For continuous development with automatic rebuilding:

```bash
npm run watch
```

This will watch for file changes and automatically rebuild the extension.

### Packaging the Extension

To create a VSIX package for distribution:

```bash
npm run package
```

This creates a production build with minified code and generates a `.vsix` file that can be installed in VS Code.

## Testing

To test the extension during development:

1. Open the project in VS Code
2. Press `F5` to launch the extension in a new Extension Development Host window
3. Use the Cerebras chat provider in the GitHub Copilot chat interface

## Code Style and Linting

The project uses ESLint for code quality and style enforcement. Run the linter with:

```bash
npm run lint
```

TypeScript type checking can be run separately with:

```bash
npm run check-types
```

## Making Changes

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes
4. Ensure your code follows the project's style guidelines
5. Test your changes thoroughly
6. Commit your changes with a clear, descriptive commit message
7. Push your branch to your fork
8. Open a pull request with a detailed description of your changes

## Pull Request Guidelines

- Keep pull requests focused on a single feature or bug fix
- Include a clear description of what the pull request does
- Reference any related issues in the pull request description
- Ensure all checks pass before submitting

## Additional Resources

- [Cerebras Inference Documentation](https://inference-docs.cerebras.ai/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Language Model API Documentation](https://code.visualstudio.com/api/extension-guides/chat)
