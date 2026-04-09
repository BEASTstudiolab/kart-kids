import { defineConfig } from '@playwright/test';

export default defineConfig( {

	testDir: './tests',
	timeout: 30000,
	retries: 0,
	workers: 1,

	use: {
		baseURL: 'http://localhost:3000',
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
		port: 3000,
		reuseExistingServer: true,
		timeout: 10000,
	},

} );
