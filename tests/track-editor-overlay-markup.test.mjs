import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test( 'track-editor.html exposes route trace controls and a compass rose anchor', () => {
	const html = readFileSync( new URL( '../track-editor.html', import.meta.url ), 'utf8' );
	assert.match( html, /<div[^>]*id="editor-route-trace-controls"[^>]*role="group"[^>]*aria-label="Route trace playback controls"[^>]*hidden[^>]*>/ );
	assert.match( html, /id="route-trace-play"/ );
	assert.match( html, /id="route-trace-pause"/ );
	assert.match( html, /<div[^>]*id="editor-compass"[^>]*>\s*<div[^>]*class="kk-editor-compass__shell"[^>]*>\s*<div[^>]*data-role="compass-rose"/s );
} );
