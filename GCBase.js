/*jshint esversion: 6 */


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
		if (this.hasTable(name)) throw new Error("GCBase addTable: table alredy exists");
        
        this.__tables[name] = {};
		this.__tables[name].__captions = this.loadCaptions(captions);
		this.__tables[name].__rows = [ ];	
	}
	
	table(name) {
        if (!this.hasTable(name)) throw new Error(`GCBase get table: table doesn't exist: ${name}.`);
        return new GCTable(this.__tables[name], this);
    }

    /*
     * Прогоняет заголовки через проверку и дополнение, копирует их в новый объект.
     */
    loadCaptions(captions) {
		let result = {}, key;
		for (key in captions) {
			result[key] = Object.assign({}, GCBase.checkAndFixCaption(captions[key]));
		}
		return result;
	}

    hasTable(tableName) {
    	return tableName in this.__tables;
	}

    get about() {
        let obj = {};
        obj.toString = ( ( ) => `${this.__data.name} v${this.__data.version}: ${this.__data.description}` ).bind(this);
		return Object.assign(obj, this.__data);
	}


	/*
     * Проверяет заголовок таблицы (один конкретный столбец)
     * @param {object} caption — заголовок одного столбца
     * @return {object} дополненная копия заголовка
     * @throws отсутствие обязательных полей, не проставляемых автоматически, некорректный формат, неизвестный формат
     */
	static checkAndFixCaption(caption) {
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
				if ( !("data" in result && "to" in result && "table" in result) ) throw new Error("GCBase addTable: wrong link caption");
				break;

			case "date":
				if ( !(result.format && result.format instanceof Object) ) throw new Error("GCBase addTable: wrong date format");
				break;

			default:
				throw new Error(`GCBase addTable: unknown caption type: ${result.type}`);
		}
		return result;
	}

	/*
		Проверяет объект на соответствие формату __data
	*/
	static checkDBData(data) {
		if ( !(data && data.name && data.version && data.description) ) return false;
		if ( typeof data.version !== "number" ) return false;
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

class GCTable {
	constructor(table, base) {
		this.table = table.__rows;
		this.captions = table.__captions;
		this.base = base;
	}
	
	get(value) {
		if (!this.table.length) return false;
        if (!value) throw new Error(`GCTable: query without parameter.`);
		let 
			result, i, 
			fn = typeof value === "function" ? value : function(rowNow) {return rowNow[value.columnName] === value.value;}
        ;
		for (i in this.table) {
			if	( fn(this.table[i]) ) return this.__valFromLinkInRow(this.table[i]); 
		}
		return false;
	}
	
	addRow(obj) {
		let check =  GCTable.checkRow(obj, this.captions);
		if (check !== true) throw new Error (`GCTable adding row: wrong row. ${check}`);
		this.table.push(obj);
	}
	__valFromLinkInRow(row) {
        let i, result = Object.assign({}, row);
        for (i in result) {
			if (this.captions[i].type === "link") {
				result[i] = this.__valFromLink(this.captions[i], result[i]);
			}
		}
		return result;
    }
    
/* Заменяет ключи полей link на значения по соотв. адресу.
 * Если в результате есть link, рекурсивно извлечет данные для него.
 */
    __valFromLink(caption, val) {
        let 
            row = this.base.table(caption.table).get({columnName: caption.to, value: val}),
            names = caption.data.split(";"),
            result = {},
			targetCaption
        ;
        
        if (caption.data === ":all") {
            result = row;
		} else if (names.length > 1) {
			names.forEach( (i) => {
				targetCaption = this.base.__tables[caption.table].__captions[i];
				if (i !== "") {
					result[i] = targetCaption.type === "link" ? this.__valFromLink(targetCaption, row[i]) : row[i];
				}
			});
		} else {
			targetCaption = this.base.__tables[caption.table].__captions[caption.data];
			result = targetCaption.type === "link" ? this.__valFromLink(targetCaption, row[caption.data]) : row[caption.data];
		}
        
		return result;
		}
	
	static checkRow(row, captions) {
	  let length = Object.keys(row).length;
		for (let i in row) {
			if ( !(i in captions) ) return `Unknown key in row: ${i}`;
		}
		for (let i in captions) {
			if (captions[i].type === "auto") {
				row[i] === captions[i].next;
				captions[i].next++
			}
		}
		if (Object.keys(row).length !== Object.keys(captions).length) return "The number of key in row and in captions doesn't match";
		return true;
	}
}

/* TODO:
при добавлении записи убрать из чексуммы столбцы с типом auto, записывать их автоматически
класс таблиц
Добавление записи: проверка формата записи
*/

/* DONE
 * исправить ошибку: при возврате строки не подставляются данные по ссылке
 * Извлечение записи со ссылкой.
*/