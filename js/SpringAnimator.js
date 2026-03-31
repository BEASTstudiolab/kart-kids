export class SpringAnimator {

	constructor( stiffness = 150, damping = 12 ) {

		this.k = stiffness;
		this.d = damping;
		this.position = 0;
		this.velocity = 0;
		this.target = 0;

	}

	setTarget( value ) {

		this.target = value;

	}

	update( dt ) {

		const displacement = this.position - this.target;
		const acceleration = - this.k * displacement - this.d * this.velocity;

		this.velocity += acceleration * dt;
		this.position += this.velocity * dt;

		// Snap to rest when settled
		if ( Math.abs( displacement ) < 0.001 && Math.abs( this.velocity ) < 0.001 ) {

			this.position = this.target;
			this.velocity = 0;

		}

		return this.position;

	}

	isAtRest() {

		return this.position === this.target && this.velocity === 0;

	}

	reset( value ) {

		this.position = value;
		this.target = value;
		this.velocity = 0;

	}

}
