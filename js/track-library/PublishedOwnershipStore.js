const OWNERSHIP_KEY = 'kk-track-library-owned';

export class PublishedOwnershipStore {

	getAll() {

		try {

			const parsed = JSON.parse( localStorage.getItem( OWNERSHIP_KEY ) || '[]' );
			return Array.isArray( parsed ) ? parsed : [];

		} catch {

			return [];

		}

	}

	save( record ) {

		const current = this.getAll().filter( ( entry ) => entry.publicId !== record.publicId );
		current.unshift( {
			...record,
			importedAt: record.importedAt || new Date().toISOString(),
		} );
		localStorage.setItem( OWNERSHIP_KEY, JSON.stringify( current ) );

	}

	getByPublicId( publicId ) {

		return this.getAll().find( ( entry ) => entry.publicId === publicId ) || null;

	}

}
