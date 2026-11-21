// Runs `vite build --watch`, changes the routes and reports what the watcher
// built.
//
//   node reproduce.js            add src/routes/about, then edit the home page
//   node reproduce.js remove     start with src/routes/about, delete it, then edit the home page
//   node reproduce.js control    only edit the home page
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const mode = process.argv[2] ?? 'add';
const home = 'src/routes/+page.svelte';
const about = 'src/routes/about/+page.svelte';

function addAbout() {
	mkdirSync('src/routes/about', { recursive: true });
	writeFileSync(about, '<h1>about</h1>\n');
}

// Start from the committed state.
writeFileSync(home, '<h1>home</h1>\n');
rmSync('src/routes/about', { recursive: true, force: true });
rmSync('build', { recursive: true, force: true });
rmSync('.svelte-kit', { recursive: true, force: true });
if (mode === 'remove') addAbout();

let log = '';
const watcher = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--watch']);
watcher.stdout.on('data', (data) => (log += data));
watcher.stderr.on('data', (data) => (log += data));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const builds = () => log.split('✔ done').length - 1;
const listsAbout = () =>
	existsSync('build/server/manifest.js') &&
	readFileSync('build/server/manifest.js', 'utf8').includes('"/about"');
const errors = (text) =>
	text
		.split('\n')
		.map((line) => line.replace(/\x1b\[[0-9;]*m/g, '').trim())
		.filter((line) => /^\[[A-Z_]+\]|^Error:/.test(line));

async function until(condition, ms) {
	const deadline = Date.now() + ms;
	while (!condition() && Date.now() < deadline) await sleep(200);
	return condition();
}

/** Applies a change and reports whether a build finished or failed after it. */
async function change(label, apply, wait) {
	const before = builds();
	const mark = log.length;
	apply();
	const done = await until(() => builds() > before, wait);
	await sleep(1_000);
	const output = log.slice(mark);
	const failed = errors(output);
	const server = output.includes('built in') ? 'server environment rebuilt, ' : '';
	const result = done
		? 'build finished (✔ done)'
		: failed.length
			? `build failed: ${failed[0]}`
			: server
				? 'no "✔ done" and no error'
				: 'no build started';
	console.log(`${label}: ${server}${result}`);
}

try {
	if (!(await until(() => builds() === 1, 60_000))) throw new Error('first build did not finish');
	console.log(`1. first build finished, /about listed: ${listsAbout()}`);

	if (mode === 'add') await change(`2. added ${about}`, addAbout, 5_000);
	if (mode === 'remove') {
		await change(`2. deleted ${about}`, () => rmSync('src/routes/about', { recursive: true }), 5_000);
	}

	await change(`3. edited ${home}`, () => writeFileSync(home, '<h1>home edited</h1>\n'), 15_000);
	console.log(`4. build/server/manifest.js lists /about: ${listsAbout()}`);
} finally {
	if (process.platform === 'win32') {
		spawnSync('taskkill', ['/pid', String(watcher.pid), '/t', '/f'], { stdio: 'ignore' });
	} else {
		watcher.kill();
	}
	writeFileSync('watch.log', log);
	writeFileSync(home, '<h1>home</h1>\n');
	rmSync('src/routes/about', { recursive: true, force: true });
}
