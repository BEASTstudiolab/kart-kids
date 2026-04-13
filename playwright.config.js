import { defineConfig } from '@playwright/test';

const PLAYWRIGHT_PORT = process.env.PLAYWRIGHT_PORT || '3101';
const PLAYWRIGHT_BASE_URL = `http://localhost:${ PLAYWRIGHT_PORT }`;

export default defineConfig( {

	testDir: './tests',
	timeout: 30000,
	retries: 0,
	workers: 1,

	use: {
		baseURL: PLAYWRIGHT_BASE_URL,
		headless: true,
		screenshot: 'only-on-failure',
	},

	projects: [
		{
			name: 'chromium',
			use: { browserName: 'chromium' },
		},
	],

	webServer: {
		command: 'node server.js',
		port: Number( PLAYWRIGHT_PORT ),
		reuseExistingServer: false,
		timeout: 10000,
		env: {
			...process.env,
			PORT: PLAYWRIGHT_PORT,
		},
	},

} );
