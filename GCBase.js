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
		
		/* Если передан объект, проверяем, это заголовок новой БД или БД целиком */
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
	/* Добавляем таблицу в экземпляр БД */
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
		if (!this.hasTable(name)) throw new Error(`GCBase get table: table doesnt exist: ${name}.`);
		return new GCTable(this.__tables[name], this);
	}
	
	/* Прогоняет заголовки через проверку и дополнение, копирует их в новый объект.*/
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
				if ( !(result.format && result.format instanceof Object && result.language && !(result.unique)) ) throw new Error("GCBase addTable: wrong date format");				
				break;
			
			case "flag":
				if (result.unique) throw new Error("GCBase addTable: flag can't contain unique: true");
				result.format = "boolean";
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
	
	get(options) {
		return this.getAll(options, true);
	}
	
	getAll(options, onlyFirst) {
		if (!this.table.length) return false;
        if (!options) return onlyFirst ? this.__fixRow(this.table[0]) : this.__fixRows(this.table);
		
		if (typeof options === "number" && onlyFirst) return this.__fixRows( this.table.slice(0, parseInt(options) + 1) );
		if ("from" in options && "to" in options) return this.__fixRows(this.table.slice( parseInt(options.from), parseInt(options.to) + 1) );
		if ( !("name" in options && "value" in options) && typeof options !== "function" ) throw new Error(`GCBase get(All): unknown options type: ${options}`);
		
		let 
			fn = typeof options === "function" ? options : function(fixedRow) {return fixedRow[options.name] === options.value;},
			result = [ ], i, row
        ;
		for (i in this.table) {
			row = this.__fixRow(this.table[i]);
			if	( fn(row, Object.assign({}, this.table[i])) ) {
				if (onlyFirst) return row;
				result.push(row); 
			}
		}
		result = result.length ? result : false;
		return result;
	}
	
	addRows(arr) {
		if (!arr.forEach) throw new Error(`GCTable: method addRows didn't resieve array.`);
		arr.forEach( (el) => this.addRow(el) );
		return this;
	}
	
	addRow(obj) {
		let check =  GCTable.checkRow(obj, this.captions);
		if (check !== true) throw new Error (`GCTable adding row: wrong row. ${check}`);
		this.table.push(obj);
		return this;
	}
	
	__fixRow(row) {
		let i, result = Object.assign({}, row), linkArr = [ ];
		for (i in result) {
			switch (this.captions[i].type) {
				case "link":
					if(this.captions[i].multiply === true) {
						result[i].forEach( (el) => linkArr.push( this.__valFromLink(this.captions[i], el) ) );
						result[i] = linkArr;
					} else {
						result[i] = this.__valFromLink(this.captions[i], result[i]);
					}
					break;
				
				case "date":
					result[i] = result[i].toLocaleString(this.captions[i].language, this.captions[i].format);
					break;
			}
		}
		return result;
    }
	
	__fixRows(arr) {
		return arr.map( (el) => this.__fixRow(el) );
    }
    
	/* Заменяет ключи полей link на значения по соотв. адресу.
	 * Если в результате есть link, рекурсивно извлечет данные для него.
	 */
	__valFromLink(caption, val) {
        let 
            row = this.base.table(caption.table).get({name: caption.to, value: val}),
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
			switch (captions[i].type) {
				case "auto":
					row[i] = captions[i].next;
					captions[i].next++;
					break;
					
				case "date":
					var parsedDate = row[i] instanceof Date ? row[i] : new Date(row[i]);
					if (parsedDate.toString().toLowerCase() === "invalid date") return `recieved wrong date: ${row[i]}`;
					row[i] = parsedDate
					break;
			}
		}
		if (Object.keys(row).length !== Object.keys(captions).length) return "The number of key in row and in captions doesn't match";
		return true;
	}
}

/* TODO:
Добавление записи: проверка формата записи
*/

/* DONE
 * при добавлении записи убрать из чексуммы столбцы с типом auto, записывать их автоматически
 * класс таблиц
 * исправить ошибку: при возврате строки не подставляются данные по ссылке
 * Извлечение записи со ссылкой.
*/
