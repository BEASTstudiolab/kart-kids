/**
 * Inline SVG snippets for menu music transport controls (stroke icons, currentColor).
 */

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

function _svg( className, size, inner ) {

	const cls = className ? ` class="${ className }"` : '';
	const w = size || 24;
	return `<svg${ cls } viewBox="0 0 24 24" width="${ w }" height="${ w }" aria-hidden="true" ${ STROKE }>${ inner }</svg>`;

}

export const mvMusic = {

	play: _svg( 'kk-mv-svg', 20, '<polygon points="8 5 19 12 8 19 8 5"/>' ),

	pause: _svg( 'kk-mv-svg', 20, '<rect x="7" y="5" width="3" height="14"/><rect x="14" y="5" width="3" height="14"/>' ),

	next: _svg( 'kk-mv-svg', 20, '<polygon points="6 5 16 12 6 19 6 5"/><line x1="19" y1="5" x2="19" y2="19"/>' ),

};

