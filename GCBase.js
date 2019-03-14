class CGBase {
	constructor(income) {
		if (!income) throw new Error("GCBase constructor error: no incoming parameters");

		if ( (typeof income) === "string" ) {

			if (income.length <= 30) {
				this.load(income);
			} else {
				this.parse(income);			
			}

		} else if (typeof income === "object") {
			if (!income.name || !income.version || !income.description)
		}

	}
}