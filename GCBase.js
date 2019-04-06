/**
 * База данных
 * @constructor
 */
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
                this.__tables = {};
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
	
	/*
     * Добавляем таблицу в экземпляр БД
     */
	addTable(name, captions) {
		if (!name) throw new Error("GCBase addTable: wrong name");
		if (!GCBase.checkCaptions(captions)) throw new Error("GCBase addTable: wrong captions");
        name = name.toString( );
		if (this.__tables[name]) throw new Error("GCBase addTable: table alredy exists");
        
        this.__tables[name] = {};
		this.__tables[name].__captions = this.loadCaptions(captions);
		this.__tables[name].__rows = [ ];	
	}
	
	table(name) {
        
    }

    /*
     * Прогоняет заголовки через проверку и дополнение, копирует их в новый объект.
     */
    loadCaptions(captions) {
		let result = {}, key;
		for (key in captions) {
			result = Object.assign({}, this.checkAndFixCaption(captions[key]));
		}
		return result;
	}

    /* 
     * Проверяет заголовок таблицы (один конкретный столбец) 
     * @param {object} caption — заголовок одного столбца
     * @return {object} дополненная копия заголовка
     * @throws отсутствие обязательных полей, не проставляемых автоматически, некорректный формат, неизвестный формат
     */
    checkAndFixCaption(caption) {
        if( !(caption && caption instanceof Object && caption.type) ) throw new Error("GCBase addTable: wrong captions");
        let result = Object.assign({}, caption);

        switch (result.type) {
            case "text":
                result.format = "string";
                break;
            
            case "auto":
                result.format = "integer";
                result.unique = true;
                result.next = 0;
                break;
            
            case "link":
            	if ( !(result.data && result.multiply && result.to && result.table)) throw new Error("GCBase addTable: wrong link caption");
            	break;

			case "date":
				if ( !(result.format && result.format instanceof Object) ) throw new Error("GCBase addTable: wrong date format");
				break;

            default:
				throw new Error(`GCBase addTable: unknown caption type: ${result.type}`);
				break;
		};
        return result;
    }

    hasTable

    get about() {
        let obj = {};
        obj.toString = ( ( ) => `${this.__data.name} v${this.__data.version}: ${this.__data.description}` ).bind(this);
		return Object.assign(obj, this.__data);
	}


	/*
		Проверяет объект на соответствие формату __data
	*/
	static checkDBData(data) {
		if ( !(data && data.name && data.version && data.description) ) return false;
		if ( !(typeof data.version === "number") ) return false;
		return true;
	}

	/*
		Проверяет экземпляр базы на соответствие формату
	*/
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

