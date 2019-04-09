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
				if ( !this.hasTable(result.table) || !this.__captions[result.table][result.to] ) throw new Error("GCBase addTable: wrong link, table or column doesn't exists.");
				break;

			case "date":
				if ( !(result.format && result.format instanceof Object && result.language && !(result.unique)) ) throw new Error("GCBase addTable: wrong date format");				
				break;

			case "rowdate":		
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
	
	fixRow(row) {
		if ("some" in row && "map" in row) return row.map(this.fixRow); /*Если массив, обрабатываем каждую строку*/

		let column, fixedRow = { };

		for (column in row) {
			switch (this.captions[column].type) {
				case "link":
					if(this.captions[column].multiply === true) {
						fixedRow[column] = [ ];
						row[column].forEach( (keyValue) => fixedRow[column].push( this.__valFromLink(this.captions[column], keyValue) ) );
						fixedRow[column].source = Object.assign([ ], row[column]);
					} else {
						fixedRow[column] =  this.__valFromLink(this.captions[column], row[column]);
						fixedRow[column].source = row[column];
					}

					break;
				
				case "date":
					fixedRow[column] = row[column].toLocaleString(this.captions[column].language, this.captions[column].format);
					break;
			}
		}
		return result;
	}
	
}

class GCTable {
	constructor(table, base) {
		this.__rows = table.__rows;
		this.rows = GCTable.fix(this.source);
		this.rows.add = this.__addRow.bind(this);
		this.captions = object.assign({}, table.__captions);
		this.base = base;
	}
	
	get(options, first = false) {
        if (!options) new Error("GCBase get(All): empty options");
		if ( !("name" in options && "value" in options) throw new Error(`GCTable get: unknown options type: ${options}`);
		
		let 
			fn = function(row) {return row[options.name] === options.value;},
			result = [ ], i, row
        ;
		first = first || (options.name && this.captions[options.name].unique === true);
		
		for (i in this.rows) {
			row = this.rows[i];
			if ( fn(row) ) result.push(row);
			if (first) break;
		}
		return result;
	}
	
	
	__addRow(obj) {
		if ("some" in obj && "map" in obj) return obj.map(this.rows.add); /*Если массив, обрабатываем каждую строку*/

		let check =  GCTable.checkRow(obj, this.captions);
		if (check !== true) throw new Error (`GCTable adding row: wrong row. ${check}`);
		this.__rows.push(obj);
		return this;
	}
	
	static cacheTable(row) {
		if ("some" in row && "map" in row) return row.map(GCTable.fix); /*Если массив, обрабатываем каждую строку*/

		let column, fixedRow = { };

		for (column in row) {
			switch (this.captions[column].type) {
				case "link":
					if(this.captions[column].multiply === true) {
						fixedRow[column] = [ ];
						row[column].forEach( (keyValue) => fixedRow[column].push( this.__valFromLink(this.captions[column], keyValue) ) );
						fixedRow[column].source = Object.assign([ ], row[column]);
					} else {
						fixedRow[column] =  this.__valFromLink(this.captions[column], row[column]);
						fixedRow[column].source = row[column];
					}
 
					break;
				
				case "date":
					fixedRow[column] = row[column].toLocaleString(this.captions[column].language, this.captions[column].format);
					break;
			}
		}
		return result;
    }
	
    
	/* Заменяет ключи полей link на значения по соотв. адресу.
	 * Если в результате есть link, рекурсивно извлечет данные для него.
	 */
	__valFromLink(caption, val) {
        let 
			targetCaption = this.base.table(caption.table).captions[caption.to],
			multiply = targetCaption.unique === false,
            row = !multiply ? this.base.table(caption.table).get({name: caption.to, value: val}) : this.base.table(caption.table).getAll({name: caption.to, value: val}),
            result = [ ]
		;
		if(!multiply) return this.__valFromLinkOneRow(caption, val, row, targetCaption);
		if(!row) throw new Error("valFromLink: неверная ссылка, записей не найдено.");
		
		row.forEach( (el) =>  result.push(this.__valFromLinkOneRow(caption, val, el, targetCaption)) );		
		return result;
	}
	
	__getLinkValue(caption, keyValue) {
		
	
	}
	
	
	__valFromLinkOneRow(caption, val, row, targetCaption) {
		let result = {};
		if (caption.data === ":all") {
			result = row;
		} else if (caption.data instanceof Array) {
			caption.data.forEach( (i) => {
				targetCaption = this.base.__tables[caption.table].__captions[i];
				result[i] = targetCaption.type === "link" ? this.__valFromLink(targetCaption, row[i]) : row[i];
			} );
		} else {
			targetCaption = this.base.__tables[caption.__table].__captions[caption.data];
			result = targetCaption.type === "link" ? this.__valFromLink(targetCaption, row[caption.data]) : row[caption.data];
		}
		return result;
	}
	
	get length() {
		return this.__table.length;
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
					if ( isNaN(parsedDate.getDay( )) ) return `recieved wrong date: ${row[i]}`;
					row[i] = parsedDate;
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
