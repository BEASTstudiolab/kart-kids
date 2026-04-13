import { createHash, randomBytes } from 'crypto';

export class ManageTokenService {

	createToken() {

		return randomBytes( 24 ).toString( 'base64url' );

	}

	hashToken( token ) {

		return createHash( 'sha256' ).update( String( token || '' ) ).digest( 'hex' );

	}

}
