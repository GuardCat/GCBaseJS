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
				throw new Error("GCBase constructor error: wrong database");
			}	

		} else {
			throw new Error("GCBase constructor error: wrong incoming parameter");
		}
		this.cachedTables = {};
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
	
	table(name, recache = false) {
		if (!this.hasTable(name)) throw new Error(`GCBase get table: table doesnt exist: ${name}.`);
		return new GCTable(name, this, recache);
	}
	
	/* Прогоняет заголовки через проверку и дополнение, копирует их в новый объект.*/
	loadCaptions(captions) {
		let result = {}, key;
		for (key in captions) {
			result[key] = Object.assign({}, GCBase.checkAndFixCaption(captions[key], this));
		}
		return result;
	}
	
	hasTable(tableName) {
		return tableName in this.__tables;
	}
	
	hasColumn(tableName, columnName) {
		return this.hasTable(tableName) && columnName in this.__tables[tableName].__captions;
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
	static checkAndFixCaption(caption, base) {
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
				if ( result.multiply !== true && result.data.some ) throw new Error("GCBase addTable: multiply is false, but there is several keys in the caption.data");
				if ( !base.hasColumn(result.table, result.to) ) throw new Error(`GCBase addTable: wrong link, table or column doesn't exists.`);
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
				
			case "number":
				result.format = result.format || "integer";
				if ( !["integer", "float", "precision"].some((el) => el === result.format) )  throw new Error(`GCBase addTable: number has unknown format: ${result.format}`);
				if (result.format === "precision") {
					result.precision = parseInt(result.precision);
					if(isNaN(result.precision)) throw new Error(`GCBase addTable: precision number needs quantity of numbers after comma in precision as Integer. Recieved: ${result.format}`);
				} 
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
	constructor(name, base, recache) {
		this.__rows = base.__tables[name].__rows;
		
		if ( !(name in base.cachedTables) || recache ) {
			base.cachedTables[name] = this.__fixRow(this.__rows);
		}
		this.rows = base.cachedTables[name];
		
		/* тюнинг rows, минимальная защита от шаловливых рук*/
		this.rows.add = this.__addRow.bind(this);
		this.rows.__push = this.rows.push /* для внутреннего использования*/
		this.rows.splice = this.rows.shift = this.rows.push = this.rows.unshift = this.rows.pop = this.rows.delete = undefined;
		this.captions = Object.assign({}, base.__tables[name].__captions);
		this.base = base;
		this.name = name;
	}
	
	get(options, first = false) {
        if (!options) throw new Error("GCBase get(All): empty options");
		if ( !("name" in options && "value" in options) ) throw new Error(`GCTable get: unknown options type: ${options}`);
		
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
	
	__fixRow(row) {
		if ("some" in row && "map" in row) return row.map(this.__fixRow); /*Если массив, обрабатываем каждую строку*/

		let column, fixedRow = { }, caption, parsedDate;

		for (column in row) {
			caption = this.captions[column];
			switch (caption.type) {
				case "link":
					fixedRow[column] = this.__valFromLink(caption, row[column], this.base.__tables[caption.table].__captions[caption.to], this.base.cachedTables[caption.table]);	
					fixedRow[column].source = row[column] instanceof Array ? Object.assign([ ], row[column]) : row[column];
					break;				
				case "date":
					parsedDate = row[column] instanceof Date ? row[column] : new Date(row[column]);
					if ( isNaN(parsedDate.getDay( )) ) throw new Error(`GCTable addRow: recieved wrong date: ${row[i]}`);
					if ( (caption.format && !caption.language) || (!caption.format && caption.language) ) throw new Error(`GCTable addRow: if you add format or language to date, you must use BOTH of the parameters.`);
					if ( !caption.format instanceof Object) throw new Error(`GCTable addRow: date format can be only object. Recieved: ${caption.format}`);
					
					fixedRow[column]= parsedDate;
					if (caption.format) {
						fixedRow[column].toString = fixedRow[column].toLocaleDateString.bind(fixedRow[column], caption.language, caption.format)
					} 
					break;
				default:
					fixedRow[column] = row[column];
			}
		}
		return fixedRow;
	}
	
	__addRow(row) {
		if ("some" in row && "map" in row) return row.map(this.rows.add); /*Если массив, обрабатываем каждую строку*/

		for (let column in row) if ( !(column in this.captions) ) throw new Error (`GCTable adding row: Unknown key in row: ${i}`);

		for (let column in this.captions) { /* Обновляем заголовок для автоматического поля */
			if(this.captions[column].type === "auto") {
				row[column] = this.captions[column].next;
				this.base.__tables[this.name].__captions[column].next++;
			}
		}
		
		if (Object.keys(row).length !== Object.keys(this.captions).length) throw new Error (`GCTable adding row: The number of key in row and in captions doesn't match`);
		
		this.__rows.push(row);

		this.base.cachedTables[this.name].__push( this.__fixRow(row) );
		return this;
	}
	
	/* todo: recache table */
    
	/* Получает значение по ссылке. Важно: на вход подаётся обработанный массив строк целевой таблицы! */
	__valFromLink(caption, key, targetCaption, targetTableRows) {
		let result = [ ], 
			rows = targetTableRows.filter( (row) => {
				return caption.multiply ? key.some( (keyVariant) => keyVariant === row[caption.to] ) : key === row[caption.to];
			} )
		;
		
		if (caption.data !== ":all") {
			rows.forEach( (row) => {
				let resultRow = {};

				if ("some" in caption.data) {
					caption.data.forEach( (k) => {
						resultRow[k] = row[k];
					} );
					result.push(resultRow);
				} else {
					result.push(row[caption.to]);
				}
			} );
		} else {
			result = rows;
		}
		return result.length > 1 ? result : result[0];	
	}
	
	
}

/* TODO:
добавить метод recache для перестройки таблиц
добавить сохранение и получение таблицы из LS
добавить методы парсинга текста для таблицы и БД
проверить ссылки на ссылки
добавить метод для выявления циклических ссылок
Добавление записи: проверка формата записи
* (-) rename(string: new name) rename table
* (-) removeColumn( colname, [filterfn | value ***strict equal***] ) will remove the whole column if don't recieve the second parameter.
* (-) addColumn(colname, object: description of the format for __captions
* (-) change(filterfn, changefn) prohibit to change link and qlink columns 
* (-) rows.delete(fn)
*/

/* DONE
 * при добавлении записи убрать из чексуммы столбцы с типом auto, записывать их автоматически
 * класс таблиц
 * исправить ошибку: при возврате строки не подставляются данные по ссылке
 * Извлечение записи со ссылкой.
*/
