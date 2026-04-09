import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizePlayerName, sanitizeText } from '../../js/ui/utils/sanitize.js';

describe( 'sanitizePlayerName', () => {

	it( 'strips <script> tags (tag delimiters removed, inner text remains)', () => {

		// The regex strips < > delimited tags but leaves text between them
		assert.strictEqual(
			sanitizePlayerName( '<script>alert("xss")</script>Bob' ),
			'alert("xss")Bob'
		);

	} );

	it( 'strips script tag when self-closing or empty', () => {

		assert.strictEqual(
			sanitizePlayerName( '<script></script>Bob' ),
			'Bob'
		);

	} );

	it( 'strips <b> tags', () => {

		assert.strictEqual( sanitizePlayerName( '<b>Bold</b>' ), 'Bold' );

	} );

	it( 'strips <img> tags', () => {

		assert.strictEqual(
			sanitizePlayerName( '<img src=x onerror=alert(1)>Name' ),
			'Name'
		);

	} );

	it( 'truncates to maxLength', () => {

		const result = sanitizePlayerName( 'A very long player name that exceeds the limit', 10 );
		assert.strictEqual( result.length, 10 );
		assert.strictEqual( result, 'A very lon' );

	} );

	it( 'truncates to default maxLength of 20', () => {

		const long = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		assert.strictEqual( sanitizePlayerName( long ).length, 20 );

	} );

	it( 'returns fallback on empty string', () => {

		assert.strictEqual( sanitizePlayerName( '' ), 'Player' );

	} );

	it( 'returns fallback on whitespace-only input', () => {

		assert.strictEqual( sanitizePlayerName( '   ' ), 'Player' );

	} );

	it( 'returns custom fallback when provided', () => {

		assert.strictEqual( sanitizePlayerName( '', 20, 'Anon' ), 'Anon' );

	} );

	it( 'returns fallback for null input', () => {

		assert.strictEqual( sanitizePlayerName( null ), 'Player' );

	} );

	it( 'returns fallback for undefined input', () => {

		assert.strictEqual( sanitizePlayerName( undefined ), 'Player' );

	} );

	it( 'returns fallback for number input', () => {

		assert.strictEqual( sanitizePlayerName( 42 ), 'Player' );

	} );

	it( 'strips nested/malformed tags', () => {

		assert.strictEqual(
			sanitizePlayerName( '<<b>inner</b>>' ),
			'inner>'
		);

	} );

	it( 'does not strip unclosed tags (no closing >)', () => {

		// The regex /<[^>]*>/g requires a closing > — unclosed tags are kept
		assert.strictEqual(
			sanitizePlayerName( 'Hello<br' ),
			'Hello<br'
		);

	} );

	it( 'handles string that becomes empty after stripping tags', () => {

		assert.strictEqual(
			sanitizePlayerName( '<div><span></span></div>' ),
			'Player'
		);

	} );

} );

describe( 'sanitizeText', () => {

	it( 'strips HTML tags', () => {

		assert.strictEqual( sanitizeText( '<b>hello</b> world' ), 'hello world' );

	} );

	it( 'trims whitespace', () => {

		assert.strictEqual( sanitizeText( '  padded  ' ), 'padded' );

	} );

	it( 'respects maxLength when provided', () => {

		assert.strictEqual( sanitizeText( 'abcdefghij', 5 ), 'abcde' );

	} );

	it( 'returns full string when maxLength is 0 (unlimited)', () => {

		const long = 'x'.repeat( 1000 );
		assert.strictEqual( sanitizeText( long ), long );

	} );

	it( 'returns empty string for non-string input', () => {

		assert.strictEqual( sanitizeText( null ), '' );
		assert.strictEqual( sanitizeText( undefined ), '' );
		assert.strictEqual( sanitizeText( 123 ), '' );

	} );

} );
