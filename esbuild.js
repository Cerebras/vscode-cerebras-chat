const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * @type {import('esbuild').Plugin}
 */
const copyTiktokenPlugin = {
	name: 'copy-tiktoken',
	setup(build) {
		build.onEnd(() => {
			// Ensure dist directory exists
			if (!fs.existsSync('dist')) {
				fs.mkdirSync('dist', { recursive: true });
			}

			// Copy tiktoken WASM files
			const tiktokenPath = path.join('node_modules', 'tiktoken');
			// Use the main tiktoken_bg.wasm file (full version)
			const sourcePath = path.join(tiktokenPath, 'tiktoken_bg.wasm');
			const destPath = path.join('dist', 'tiktoken_bg.wasm');

			if (fs.existsSync(sourcePath)) {
				try {
					fs.copyFileSync(sourcePath, destPath);
					console.log(`Copied tiktoken_bg.wasm to dist/`);
				} catch (error) {
					console.warn(`Failed to copy tiktoken_bg.wasm:`, error.message);
				}
			}
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			copyTiktokenPlugin,
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
