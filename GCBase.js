class GCBase {
	constructor(income) {
		if (!income) throw new Error("GCBase constructor error: no incoming parameters");

		if ( (typeof income) === "string" ) {

			if (income.length <= 30) {
				this.load(income);
			} else {
				this.parse(income);			
			}

		/*
		 Если передан объект, проверяем, это заголовок новой БД или БД целиком
		*/
		} else if (typeof income === "object") {
			
			if (GCBase.checkDBData(income)) {
				this.__data = Object.assign({}, income);
			} else if (GCBase.checkDB(income)) {
				this.__data = Object.assign({}, income.__data);
				this.__tables = Object.assign({}, income.__tables);
			} else {
				throw new Error("GCBase constructor error: wrong database ");
			}			
		
		} else {
			throw new Error("GCBase constructor error: wrong incoming parameter");
		}
	}
	
	addTable(name,captions) {
		if (!name) throw new Error("GCBase addTable: wrong name");
		if (!GCBase.checkCaptions(captions)) throw new Error("GCBase addTable: wrong captions");
		this.__tables[name.toString()].__captions = Object.assign({}, captions);
		this.__tables[name.toString()].__rows = [ ];	
	}
	
	get about() {
		return Object.assign({}, this.__data);
	}
	
	/*
		Проверяет объект на соответствие формату __data
	*/
	static checkDBData(data) {
		if ( !(data && data.name && data.version && data.description) ) return false;
		if ( !(typeof data.version === "number") ) return false;
		return true;
	}

	static checkDB(data) {
		if ( !(data && data.__data && data.__tables) ) return false;
		return true;
	}
	
	/*
		Проверяет объект на соответствие формату __captions
		в данной версии — заглушка.
	*/
	static checkCaptions(captions) {
		if ( !(captions instanceof Object) ) return false;
		return true;
	}
	
}
/* TODO:
Проверка корректности captions
Добавление записи: проверка формата записи
Извлечение записи со ссылкой.
*/

