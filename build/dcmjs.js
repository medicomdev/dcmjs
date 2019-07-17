(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, factory(global.dcmjs = {}));
}(this, function (exports) { 'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	/*
	  Copyright © 2018 Andrew Powell

	  This Source Code Form is subject to the terms of the Mozilla Public
	  License, v. 2.0. If a copy of the MPL was not distributed with this
	  file, You can obtain one at http://mozilla.org/MPL/2.0/.

	  The above copyright notice and this permission notice shall be
	  included in all copies or substantial portions of this Source Code Form.
	*/

	const noop = () => {};
	const levels = Symbol('log-levels');
	const instance = Symbol('log-instance');

	var MethodFactory_1 = class MethodFactory {
	  constructor(logger) {
	    this[instance] = logger;
	    this[levels] = {
	      TRACE: 0,
	      DEBUG: 1,
	      INFO: 2,
	      WARN: 3,
	      ERROR: 4,
	      SILENT: 5
	    };
	  }

	  get levels() {
	    return this[levels];
	  }

	  get logger() {
	    return this[instance];
	  }

	  set logger(logger) {
	    this[instance] = logger;
	  }

	  get methods() {
	    return Object.keys(this.levels)
	      .map((key) => key.toLowerCase())
	      .filter((key) => key !== 'silent');
	  }

	  // eslint-disable-next-line class-methods-use-this
	  bindMethod(obj, methodName) {
	    const method = obj[methodName];
	    if (typeof method.bind === 'function') {
	      return method.bind(obj);
	    }

	    try {
	      return Function.prototype.bind.call(method, obj);
	    } catch (e) {
	      // Missing bind shim or IE8 + Modernizr, fallback to wrapping
	      return function result() {
	        // eslint-disable-next-line prefer-rest-params
	        return Function.prototype.apply.apply(method, [obj, arguments]);
	      };
	    }
	  }

	  distillLevel(level) {
	    let result = level;

	    if (typeof result === 'string' && typeof this.levels[result.toUpperCase()] !== 'undefined') {
	      result = this.levels[result.toUpperCase()];
	    }

	    if (this.levelValid(result)) {
	      return result;
	    }

	    return false;
	  }

	  levelValid(level) {
	    if (typeof level === 'number' && level >= 0 && level <= this.levels.SILENT) {
	      return true;
	    }

	    return false;
	  }

	  /**
	   * Build the best logging method possible for this env
	   * Wherever possible we want to bind, not wrap, to preserve stack traces.
	   * Since we're targeting modern browsers, there's no need to wait for the
	   * console to become available.
	   */
	  // eslint-disable-next-line class-methods-use-this
	  make(methodName) {
	    if (methodName === 'debug') {
	      // eslint-disable-next-line no-param-reassign
	      methodName = 'log';
	    }

	    /* eslint-disable no-console */
	    if (typeof console[methodName] !== 'undefined') {
	      return this.bindMethod(console, methodName);
	    } else if (typeof console.log !== 'undefined') {
	      return this.bindMethod(console, 'log');
	    }

	    /* eslint-enable no-console */
	    return noop;
	  }

	  replaceMethods(logLevel) {
	    const level = this.distillLevel(logLevel);

	    if (level == null) {
	      throw new Error(`loglevelnext: replaceMethods() called with invalid level: ${logLevel}`);
	    }

	    if (!this.logger || this.logger.type !== 'LogLevel') {
	      throw new TypeError(
	        'loglevelnext: Logger is undefined or invalid. Please specify a valid Logger instance.'
	      );
	    }

	    this.methods.forEach((methodName) => {
	      const { [methodName.toUpperCase()]: methodLevel } = this.levels;

	      this.logger[methodName] = methodLevel < level ? noop : this.make(methodName);
	    });

	    // Define log.log as an alias for log.debug
	    this.logger.log = this.logger.debug;
	  }
	};

	/*
	  Copyright © 2018 Andrew Powell

	  This Source Code Form is subject to the terms of the Mozilla Public
	  License, v. 2.0. If a copy of the MPL was not distributed with this
	  file, You can obtain one at http://mozilla.org/MPL/2.0/.

	  The above copyright notice and this permission notice shall be
	  included in all copies or substantial portions of this Source Code Form.
	*/



	const defaults = {
	  level: (opts) => `[${opts.level}]`,
	  name: (opts) => opts.logger.name,
	  template: '{{time}} {{level}} ',
	  time: () => new Date().toTimeString().split(' ')[0]
	};

	var PrefixFactory_1 = class PrefixFactory extends MethodFactory_1 {
	  constructor(logger, options) {
	    super(logger);
	    this.options = Object.assign({}, defaults, options);
	  }

	  interpolate(level) {
	    return this.options.template.replace(/{{([^{}]*)}}/g, (stache, prop) => {
	      const fn = this.options[prop];

	      if (fn) {
	        return fn({ level, logger: this.logger });
	      }

	      return stache;
	    });
	  }

	  make(methodName) {
	    const og = super.make(methodName);

	    return (...args) => {
	      const output = this.interpolate(methodName);
	      const [first] = args;

	      if (typeof first === 'string') {
	        // eslint-disable-next-line no-param-reassign
	        args[0] = output + first;
	      } else {
	        args.unshift(output);
	      }

	      og(...args);
	    };
	  }
	};

	/*
	  Copyright © 2018 Andrew Powell

	  This Source Code Form is subject to the terms of the Mozilla Public
	  License, v. 2.0. If a copy of the MPL was not distributed with this
	  file, You can obtain one at http://mozilla.org/MPL/2.0/.

	  The above copyright notice and this permission notice shall be
	  included in all copies or substantial portions of this Source Code Form.
	*/





	const defaults$1 = {
	  factory: null,
	  level: 'warn',
	  name: +new Date(),
	  prefix: null
	};

	var LogLevel_1 = class LogLevel {
	  constructor(options) {
	    // implement for some _very_ loose type checking. avoids getting into a
	    // circular require between MethodFactory and LogLevel
	    this.type = 'LogLevel';
	    this.options = Object.assign({}, defaults$1, options);
	    this.methodFactory = options.factory;

	    if (!this.methodFactory) {
	      const factory = options.prefix
	        ? new PrefixFactory_1(this, options.prefix)
	        : new MethodFactory_1(this);
	      this.methodFactory = factory;
	    }

	    if (!this.methodFactory.logger) {
	      this.methodFactory.logger = this;
	    }

	    this.name = options.name || '<unknown>';

	    // this.level is a setter, do this after setting up the factory
	    this.level = this.options.level;
	  }

	  get factory() {
	    return this.methodFactory;
	  }

	  set factory(factory) {
	    // eslint-disable-next-line no-param-reassign
	    factory.logger = this;
	    this.methodFactory = factory;
	    this.methodFactory.replaceMethods(this.level);
	  }

	  disable() {
	    this.level = this.levels.SILENT;
	  }

	  enable() {
	    this.level = this.levels.TRACE;
	  }

	  get level() {
	    return this.currentLevel;
	  }

	  set level(logLevel) {
	    const level = this.methodFactory.distillLevel(logLevel);

	    if (level === false || level == null) {
	      throw new RangeError(`loglevelnext: setLevel() called with invalid level: ${logLevel}`);
	    }

	    this.currentLevel = level;
	    this.methodFactory.replaceMethods(level);

	    if (typeof console === 'undefined' && level < this.levels.SILENT) {
	      // eslint-disable-next-line no-console
	      console.warn('loglevelnext: console is undefined. The log will produce no output.');
	    }
	  }

	  get levels() {
	    // eslint-disable-line class-methods-use-this
	    return this.methodFactory.levels;
	  }
	};

	var lib = createCommonjsModule(function (module) {
	/*
	  Copyright © 2018 Andrew Powell

	  This Source Code Form is subject to the terms of the Mozilla Public
	  License, v. 2.0. If a copy of the MPL was not distributed with this
	  file, You can obtain one at http://mozilla.org/MPL/2.0/.

	  The above copyright notice and this permission notice shall be
	  included in all copies or substantial portions of this Source Code Form.
	*/





	const factories = Symbol('log-factories');

	class DefaultLogger extends LogLevel_1 {
	  constructor() {
	    super({ name: 'default' });

	    this.cache = { default: this };
	    this[factories] = { MethodFactory: MethodFactory_1, PrefixFactory: PrefixFactory_1 };
	  }

	  get factories() {
	    return this[factories];
	  }

	  get loggers() {
	    return this.cache;
	  }

	  create(opts) {
	    let options;

	    if (typeof opts === 'string') {
	      options = { name: opts };
	    } else {
	      options = Object.assign({}, opts);
	    }

	    if (!options.id) {
	      options.id = options.name;
	    }

	    const { name, id } = options;
	    const defaults = { level: this.level };

	    if (typeof name !== 'string' || !name || !name.length) {
	      throw new TypeError('You must supply a name when creating a logger.');
	    }

	    let logger = this.cache[id];
	    if (!logger) {
	      logger = new LogLevel_1(Object.assign({}, defaults, options));
	      this.cache[id] = logger;
	    }
	    return logger;
	  }
	}

	module.exports = new DefaultLogger();

	// TypeScript fix
	module.exports.default = module.exports;
	});

	/* eslint no-bitwise: 0 */
	var BitArray = {
	  getBytesForBinaryFrame: getBytesForBinaryFrame,
	  pack: pack,
	  unpack: unpack
	};

	function getBytesForBinaryFrame(numPixels) {
	  // Check whether the 1-bit pixels exactly fit into bytes
	  var remainder = numPixels % 8; // Number of bytes that work on an exact fit

	  var bytesRequired = Math.floor(numPixels / 8); // Add one byte if we have a remainder

	  if (remainder > 0) {
	    bytesRequired++;
	  }

	  return bytesRequired;
	}

	function pack(pixelData) {
	  var numPixels = pixelData.length;
	  lib.log("numPixels: " + numPixels);
	  var length = getBytesForBinaryFrame(numPixels); //log.log('getBytesForBinaryFrame: ' + length);

	  var bitPixelData = new Uint8Array(length);
	  var bytePos = 0;

	  for (var i = 0; i < numPixels; i++) {
	    // Compute byte position
	    bytePos = Math.floor(i / 8);
	    var pixValue = pixelData[i] !== 0; //log.log('i: ' + i);
	    //log.log('pixValue: ' + pixValue);
	    //log.log('bytePos: ' + bytePos);

	    var bitPixelValue = pixValue << i % 8; //log.log('current bitPixelData: ' + bitPixelData[bytePos]);
	    //log.log('this bitPixelValue: ' + bitPixelValue);

	    bitPixelData[bytePos] |= bitPixelValue; //log.log('new bitPixelValue: ' + bitPixelData[bytePos]);
	  }

	  return bitPixelData;
	} // convert a packed bitwise pixel array into a byte-per-pixel
	// array with 255 corresponding to each set bit in the bit array


	function unpack(bitPixelArray) {
	  var bitArray = new Uint8Array(bitPixelArray);
	  var byteArray = new Uint8Array(8 * bitArray.length);

	  for (var byteIndex = 0; byteIndex < byteArray.length; byteIndex++) {
	    var bitIndex = byteIndex % 8;
	    var bitByteIndex = Math.floor(byteIndex / 8);
	    byteArray[byteIndex] = 255 * ((bitArray[bitByteIndex] & 1 << bitIndex) >> bitIndex);
	  }

	  return byteArray;
	}

	function _classCallCheck(instance, Constructor) {
	  if (!(instance instanceof Constructor)) {
	    throw new TypeError("Cannot call a class as a function");
	  }
	}

	function _defineProperties(target, props) {
	  for (var i = 0; i < props.length; i++) {
	    var descriptor = props[i];
	    descriptor.enumerable = descriptor.enumerable || false;
	    descriptor.configurable = true;
	    if ("value" in descriptor) descriptor.writable = true;
	    Object.defineProperty(target, descriptor.key, descriptor);
	  }
	}

	function _createClass(Constructor, protoProps, staticProps) {
	  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
	  if (staticProps) _defineProperties(Constructor, staticProps);
	  return Constructor;
	}

	function _inherits(subClass, superClass) {
	  if (typeof superClass !== "function" && superClass !== null) {
	    throw new TypeError("Super expression must either be null or a function");
	  }

	  subClass.prototype = Object.create(superClass && superClass.prototype, {
	    constructor: {
	      value: subClass,
	      writable: true,
	      configurable: true
	    }
	  });
	  if (superClass) _setPrototypeOf(subClass, superClass);
	}

	function _getPrototypeOf(o) {
	  _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
	    return o.__proto__ || Object.getPrototypeOf(o);
	  };
	  return _getPrototypeOf(o);
	}

	function _setPrototypeOf(o, p) {
	  _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
	    o.__proto__ = p;
	    return o;
	  };

	  return _setPrototypeOf(o, p);
	}

	function _assertThisInitialized(self) {
	  if (self === void 0) {
	    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
	  }

	  return self;
	}

	function _possibleConstructorReturn(self, call) {
	  if (call && (typeof call === "object" || typeof call === "function")) {
	    return call;
	  }

	  return _assertThisInitialized(self);
	}

	function _superPropBase(object, property) {
	  while (!Object.prototype.hasOwnProperty.call(object, property)) {
	    object = _getPrototypeOf(object);
	    if (object === null) break;
	  }

	  return object;
	}

	function _get(target, property, receiver) {
	  if (typeof Reflect !== "undefined" && Reflect.get) {
	    _get = Reflect.get;
	  } else {
	    _get = function _get(target, property, receiver) {
	      var base = _superPropBase(target, property);

	      if (!base) return;
	      var desc = Object.getOwnPropertyDescriptor(base, property);

	      if (desc.get) {
	        return desc.get.call(receiver);
	      }

	      return desc.value;
	    };
	  }

	  return _get(target, property, receiver || target);
	}

	function _slicedToArray(arr, i) {
	  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
	}

	function _toConsumableArray(arr) {
	  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
	}

	function _arrayWithoutHoles(arr) {
	  if (Array.isArray(arr)) {
	    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

	    return arr2;
	  }
	}

	function _arrayWithHoles(arr) {
	  if (Array.isArray(arr)) return arr;
	}

	function _iterableToArray(iter) {
	  if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
	}

	function _iterableToArrayLimit(arr, i) {
	  var _arr = [];
	  var _n = true;
	  var _d = false;
	  var _e = undefined;

	  try {
	    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
	      _arr.push(_s.value);

	      if (i && _arr.length === i) break;
	    }
	  } catch (err) {
	    _d = true;
	    _e = err;
	  } finally {
	    try {
	      if (!_n && _i["return"] != null) _i["return"]();
	    } finally {
	      if (_d) throw _e;
	    }
	  }

	  return _arr;
	}

	function _nonIterableSpread() {
	  throw new TypeError("Invalid attempt to spread non-iterable instance");
	}

	function _nonIterableRest() {
	  throw new TypeError("Invalid attempt to destructure non-iterable instance");
	}

	//http://jonisalonen.com/2012/from-utf-16-to-utf-8-in-javascript/
	function toUTF8Array(str) {
	  var utf8 = [];

	  for (var i = 0; i < str.length; i++) {
	    var charcode = str.charCodeAt(i);
	    if (charcode < 0x80) utf8.push(charcode);else if (charcode < 0x800) {
	      utf8.push(0xc0 | charcode >> 6, 0x80 | charcode & 0x3f);
	    } else if (charcode < 0xd800 || charcode >= 0xe000) {
	      utf8.push(0xe0 | charcode >> 12, 0x80 | charcode >> 6 & 0x3f, 0x80 | charcode & 0x3f);
	    } // surrogate pair
	    else {
	        i++; // UTF-16 encodes 0x10000-0x10FFFF by
	        // subtracting 0x10000 and splitting the
	        // 20 bits of 0x0-0xFFFFF into two halves

	        charcode = 0x10000 + ((charcode & 0x3ff) << 10 | str.charCodeAt(i) & 0x3ff);
	        utf8.push(0xf0 | charcode >> 18, 0x80 | charcode >> 12 & 0x3f, 0x80 | charcode >> 6 & 0x3f, 0x80 | charcode & 0x3f);
	      }
	  }

	  return utf8;
	}

	function toInt(val) {
	  if (isNaN(val)) {
	    throw new Error("Not a number: " + val);
	  } else if (typeof val == "string") {
	    return parseInt(val);
	  } else return val;
	}

	function toFloat(val) {
	  if (isNaN(val)) {
	    throw new Error("Not a number: " + val);
	  } else if (typeof val == "string") {
	    return parseFloat(val);
	  } else return val;
	}

	var BufferStream =
	/*#__PURE__*/
	function () {
	  function BufferStream(sizeOrBuffer, littleEndian) {
	    _classCallCheck(this, BufferStream);

	    this.buffer = typeof sizeOrBuffer == "number" ? new ArrayBuffer(sizeOrBuffer) : sizeOrBuffer;

	    if (!this.buffer) {
	      this.buffer = new ArrayBuffer(0);
	    }

	    this.view = new DataView(this.buffer);
	    this.offset = 0;
	    this.isLittleEndian = littleEndian || false;
	    this.size = 0;
	  }

	  _createClass(BufferStream, [{
	    key: "setEndian",
	    value: function setEndian(isLittle) {
	      this.isLittleEndian = isLittle;
	    }
	  }, {
	    key: "writeUint8",
	    value: function writeUint8(value) {
	      this.checkSize(1);
	      this.view.setUint8(this.offset, toInt(value));
	      return this.increment(1);
	    }
	  }, {
	    key: "writeInt8",
	    value: function writeInt8(value) {
	      this.checkSize(1);
	      this.view.setInt8(this.offset, toInt(value));
	      return this.increment(1);
	    }
	  }, {
	    key: "writeUint16",
	    value: function writeUint16(value) {
	      this.checkSize(2);
	      this.view.setUint16(this.offset, toInt(value), this.isLittleEndian);
	      return this.increment(2);
	    }
	  }, {
	    key: "writeInt16",
	    value: function writeInt16(value) {
	      this.checkSize(2);
	      this.view.setInt16(this.offset, toInt(value), this.isLittleEndian);
	      return this.increment(2);
	    }
	  }, {
	    key: "writeUint32",
	    value: function writeUint32(value) {
	      this.checkSize(4);
	      this.view.setUint32(this.offset, toInt(value), this.isLittleEndian);
	      return this.increment(4);
	    }
	  }, {
	    key: "writeInt32",
	    value: function writeInt32(value) {
	      this.checkSize(4);
	      this.view.setInt32(this.offset, toInt(value), this.isLittleEndian);
	      return this.increment(4);
	    }
	  }, {
	    key: "writeFloat",
	    value: function writeFloat(value) {
	      this.checkSize(4);
	      this.view.setFloat32(this.offset, toFloat(value), this.isLittleEndian);
	      return this.increment(4);
	    }
	  }, {
	    key: "writeDouble",
	    value: function writeDouble(value) {
	      this.checkSize(8);
	      this.view.setFloat64(this.offset, toFloat(value), this.isLittleEndian);
	      return this.increment(8);
	    }
	  }, {
	    key: "writeString",
	    value: function writeString(value) {
	      value = value || "";
	      var utf8 = toUTF8Array(value),
	          bytelen = utf8.length;
	      this.checkSize(bytelen);
	      var startOffset = this.offset;

	      for (var i = 0; i < bytelen; i++) {
	        this.view.setUint8(startOffset, utf8[i]);
	        startOffset++;
	      }

	      return this.increment(bytelen);
	    }
	  }, {
	    key: "writeHex",
	    value: function writeHex(value) {
	      var len = value.length,
	          blen = len / 2,
	          startOffset = this.offset;
	      this.checkSize(blen);

	      for (var i = 0; i < len; i += 2) {
	        var code = parseInt(value[i], 16),
	            nextCode;

	        if (i == len - 1) {
	          nextCode = null;
	        } else {
	          nextCode = parseInt(value[i + 1], 16);
	        }

	        if (nextCode !== null) {
	          code = code << 4 | nextCode;
	        }

	        this.view.setUint8(startOffset, code);
	        startOffset++;
	      }

	      return this.increment(blen);
	    }
	  }, {
	    key: "readUint32",
	    value: function readUint32() {
	      var val = this.view.getUint32(this.offset, this.isLittleEndian);
	      this.increment(4);
	      return val;
	    }
	  }, {
	    key: "readUint16",
	    value: function readUint16() {
	      var val = this.view.getUint16(this.offset, this.isLittleEndian);
	      this.increment(2);
	      return val;
	    }
	  }, {
	    key: "readUint8",
	    value: function readUint8() {
	      var val = this.view.getUint8(this.offset);
	      this.increment(1);
	      return val;
	    }
	  }, {
	    key: "readUint8Array",
	    value: function readUint8Array(length) {
	      var arr = new Uint8Array(this.buffer, this.offset, length);
	      this.increment(length);
	      return arr;
	    }
	  }, {
	    key: "readUint16Array",
	    value: function readUint16Array(length) {
	      var sixlen = length / 2,
	          arr = new Uint16Array(sixlen),
	          i = 0;

	      while (i++ < sixlen) {
	        arr[i] = this.view.getUint16(this.offset, this.isLittleEndian);
	        this.offset += 2;
	      }

	      return arr;
	    }
	  }, {
	    key: "readInt16",
	    value: function readInt16() {
	      var val = this.view.getInt16(this.offset, this.isLittleEndian);
	      this.increment(2);
	      return val;
	    }
	  }, {
	    key: "readInt32",
	    value: function readInt32() {
	      var val = this.view.getInt32(this.offset, this.isLittleEndian);
	      this.increment(4);
	      return val;
	    }
	  }, {
	    key: "readFloat",
	    value: function readFloat() {
	      var val = this.view.getFloat32(this.offset, this.isLittleEndian);
	      this.increment(4);
	      return val;
	    }
	  }, {
	    key: "readDouble",
	    value: function readDouble() {
	      var val = this.view.getFloat64(this.offset, this.isLittleEndian);
	      this.increment(8);
	      return val;
	    }
	  }, {
	    key: "readString",
	    value: function readString(length) {
	      var string = "";
	      var numOfMulti = length,
	          index = 0;

	      while (index++ < numOfMulti) {
	        var charCode = this.readUint8();
	        string += String.fromCharCode(charCode);
	      }

	      return string;
	    }
	  }, {
	    key: "readHex",
	    value: function readHex(length) {
	      var hexString = "";

	      for (var i = 0; i < length; i++) {
	        hexString += this.readUint8().toString(16);
	      }

	      return hexString;
	    }
	  }, {
	    key: "checkSize",
	    value: function checkSize(step) {
	      if (this.offset + step > this.buffer.byteLength) {
	        //throw new Error("Writing exceeded the size of buffer");
	        //resize
	        var dst = new ArrayBuffer(this.buffer.byteLength * 2);
	        new Uint8Array(dst).set(new Uint8Array(this.buffer));
	        this.buffer = dst;
	        this.view = new DataView(this.buffer);
	      }
	    }
	  }, {
	    key: "concat",
	    value: function concat(stream) {
	      var newbuf = new ArrayBuffer(this.offset + stream.size),
	          int8 = new Uint8Array(newbuf);
	      int8.set(new Uint8Array(this.getBuffer(0, this.offset)));
	      int8.set(new Uint8Array(stream.getBuffer(0, stream.size)), this.offset);
	      this.buffer = newbuf;
	      this.view = new DataView(this.buffer);
	      this.offset += stream.size;
	      this.size = this.offset;
	      return this.buffer.byteLength;
	    }
	  }, {
	    key: "increment",
	    value: function increment(step) {
	      this.offset += step;

	      if (this.offset > this.size) {
	        this.size = this.offset;
	      }

	      return step;
	    }
	  }, {
	    key: "getBuffer",
	    value: function getBuffer(start, end) {
	      if (!start && !end) {
	        start = 0;
	        end = this.size;
	      }

	      return this.buffer.slice(start, end);
	    }
	  }, {
	    key: "more",
	    value: function more(length) {
	      if (this.offset + length > this.buffer.byteLength) {
	        throw new Error("Request more than currently allocated buffer");
	      }

	      var newBuf = this.buffer.slice(this.offset, this.offset + length);
	      this.increment(length);
	      return new ReadBufferStream(newBuf);
	    }
	  }, {
	    key: "reset",
	    value: function reset() {
	      this.offset = 0;
	      return this;
	    }
	  }, {
	    key: "end",
	    value: function end() {
	      return this.offset >= this.buffer.byteLength;
	    }
	  }, {
	    key: "toEnd",
	    value: function toEnd() {
	      this.offset = this.buffer.byteLength;
	    }
	  }]);

	  return BufferStream;
	}();

	var ReadBufferStream =
	/*#__PURE__*/
	function (_BufferStream) {
	  _inherits(ReadBufferStream, _BufferStream);

	  function ReadBufferStream(buffer, littleEndian) {
	    var _this;

	    _classCallCheck(this, ReadBufferStream);

	    _this = _possibleConstructorReturn(this, _getPrototypeOf(ReadBufferStream).call(this, buffer, littleEndian));
	    _this.size = _this.buffer.byteLength;
	    return _this;
	  }

	  return ReadBufferStream;
	}(BufferStream);

	var WriteBufferStream =
	/*#__PURE__*/
	function (_BufferStream2) {
	  _inherits(WriteBufferStream, _BufferStream2);

	  function WriteBufferStream(buffer, littleEndian) {
	    var _this2;

	    _classCallCheck(this, WriteBufferStream);

	    _this2 = _possibleConstructorReturn(this, _getPrototypeOf(WriteBufferStream).call(this, buffer, littleEndian));
	    _this2.size = 0;
	    return _this2;
	  }

	  return WriteBufferStream;
	}(BufferStream);

	function paddingLeft(paddingValue, string) {
	  return String(paddingValue + string).slice(-paddingValue.length);
	}

	function rtrim(str) {
	  return str.replace(/\s*$/g, "");
	}

	function tagFromNumbers(group, element) {
	  return new Tag((group << 16 | element) >>> 0);
	}

	function readTag(stream) {
	  var group = stream.readUint16(),
	      element = stream.readUint16();
	  return tagFromNumbers(group, element);
	}

	var binaryVRs = ["FL", "FD", "SL", "SS", "UL", "US", "AT"],
	    explicitVRs = ["OB", "OW", "OF", "SQ", "UC", "UR", "UT", "UN"],
	    singleVRs = ["SQ", "OF", "OW", "OB", "UN"];

	var ValueRepresentation =
	/*#__PURE__*/
	function () {
	  function ValueRepresentation(type) {
	    _classCallCheck(this, ValueRepresentation);

	    this.type = type;
	    this.padByte = "00";
	  }

	  _createClass(ValueRepresentation, [{
	    key: "isBinary",
	    value: function isBinary() {
	      return binaryVRs.indexOf(this.type) !== -1;
	    }
	  }, {
	    key: "allowMultiple",
	    value: function allowMultiple() {
	      return !this.isBinary() && singleVRs.indexOf(this.type) === -1;
	    }
	  }, {
	    key: "isExplicit",
	    value: function isExplicit() {
	      return explicitVRs.indexOf(this.type) !== -1;
	    }
	  }, {
	    key: "read",
	    value: function read(stream, length, syntax) {
	      var _this = this;

	      if (this.fixed && this.maxLength) {
	        if (!length) return this.defaultValue;
	      }

	      var val = this.readBytes(stream, length, syntax);

	      if (this.fixed && this.maxLength && this.maxLength !== length) {
	        if (!this.noMultiple && typeof val === 'string' && val.includes(String.fromCharCode(0x5c))) {
	          if (val.split(String.fromCharCode(0x5c)).some(function (string) {
	            return string.length !== _this.maxLength;
	          })) {
	            lib.error("Invalid length for fixed length tag, vr " + this.type + ", length " + this.maxLength + " !== " + length);
	          }
	        } else {
	          lib.error("Invalid length for fixed length tag, vr " + this.type + ", length " + this.maxLength + " !== " + length);
	        }
	      }

	      return val;
	    }
	  }, {
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      return stream.readString(length);
	    }
	  }, {
	    key: "readNullPaddedString",
	    value: function readNullPaddedString(stream, length) {
	      if (!length) return "";
	      var str = stream.readString(length - 1);

	      if (stream.readUint8() !== 0) {
	        stream.increment(-1);
	        str += stream.readString(1);
	      }

	      return str;
	    }
	  }, {
	    key: "writeFilledString",
	    value: function writeFilledString(stream, value, length) {
	      if (length < this.maxLength && length >= 0) {
	        var written = 0;
	        if (length > 0) written += stream.writeString(value);
	        var zeroLength = this.maxLength - length;
	        written += stream.writeHex(this.fillWith.repeat(zeroLength));
	        return written;
	      } else if (length === this.maxLength) {
	        return stream.writeString(value);
	      } else {
	        throw "Length mismatch";
	      }
	    }
	  }, {
	    key: "write",
	    value: function write(stream, type) {
	      var args = Array.from(arguments);

	      if (args[2] === null || args[2] === "" || args[2] === undefined) {
	        return [stream.writeString("")];
	      } else {
	        var written = [],
	            valueArgs = args.slice(2),
	            func = stream["write" + type];

	        if (Array.isArray(valueArgs[0])) {
	          if (valueArgs[0].length < 1) {
	            written.push(0);
	          } else {
	            var self = this;
	            valueArgs[0].forEach(function (v, k) {
	              if (self.allowMultiple() && k > 0) {
	                stream.writeHex("5C"); //byteCount++;
	              }

	              var singularArgs = [v].concat(valueArgs.slice(1));
	              var byteCount = func.apply(stream, singularArgs);
	              written.push(byteCount);
	            });
	          }
	        } else {
	          written.push(func.apply(stream, valueArgs));
	        }

	        return written;
	      }
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value, lengths) {
	      var valid = true,
	          valarr = Array.isArray(value) ? value : [value],
	          total = 0;

	      for (var i = 0; i < valarr.length; i++) {
	        var checkValue = valarr[i],
	            checklen = lengths[i],
	            isString = false,
	            displaylen = checklen;

	        if (this.checkLength) {
	          valid = this.checkLength(checkValue);
	        } else if (this.maxCharLength) {
	          var check = this.maxCharLength; //, checklen = checkValue.length;

	          valid = checkValue.length <= check;
	          displaylen = checkValue.length;
	          isString = true;
	        } else if (this.maxLength) {
	          valid = checklen <= this.maxLength;
	        }

	        var errmsg = "Value exceeds max length, vr: " + this.type + ", value: " + checkValue + ", length: " + displaylen;

	        if (!valid) {
	          if (isString) lib.log(errmsg);else throw new Error(errmsg);
	        }

	        total += checklen;
	      }

	      if (this.allowMultiple()) {
	        total += valarr.length ? valarr.length - 1 : 0;
	      } //check for odd


	      var written = total;

	      if (total & 1) {
	        stream.writeHex(this.padByte);
	        written++;
	      }

	      return written;
	    }
	  }], [{
	    key: "createByTypeString",
	    value: function createByTypeString(type) {
	      var vr = null;
	      if (type === "AE") vr = new ApplicationEntity();else if (type === "AS") vr = new AgeString();else if (type === "AT") vr = new AttributeTag();else if (type === "CS") vr = new CodeString();else if (type === "DA") vr = new DateValue();else if (type === "DS") vr = new DecimalString();else if (type === "DT") vr = new DateTime();else if (type === "FL") vr = new FloatingPointSingle();else if (type === "FD") vr = new FloatingPointDouble();else if (type === "IS") vr = new IntegerString();else if (type === "LO") vr = new LongString();else if (type === "LT") vr = new LongText();else if (type === "OB") vr = new OtherByteString();else if (type === "OD") vr = new OtherDoubleString();else if (type === "OF") vr = new OtherFloatString();else if (type === "OW") vr = new OtherWordString(); // else if (type === "OL") vr = new OtherLongString();
	      // else if (type === "OV") vr = new OtherVeryLongString();
	      else if (type === "PN") vr = new PersonName();else if (type === "SH") vr = new ShortString();else if (type === "SL") vr = new SignedLong();else if (type === "SQ") vr = new SequenceOfItems();else if (type === "SS") vr = new SignedShort();else if (type === "ST") vr = new ShortText();else if (type === "TM") vr = new TimeValue();else if (type === "UC") vr = new UnlimitedCharacters();else if (type === "UI") vr = new UniqueIdentifier();else if (type === "UL") vr = new UnsignedLong();else if (type === "UN") vr = new UnknownValue();else if (type === "UR") vr = new UniversalResource();else if (type === "US") vr = new UnsignedShort();else if (type === "UT") vr = new UnlimitedText();else if (type === "ox") {
	          // TODO: determine VR based on context (could be 1 byte pixel data)
	          // https://github.com/dgobbi/vtk-dicom/issues/38
	          lib.error("Invalid vr type " + type + " - using OW");
	          vr = new OtherWordString();
	        } else if (type === "xs") {
	          lib.error("Invalid vr type " + type + " - using US");
	          vr = new UnsignedShort();
	        } else {
	          lib.error("Invalid vr type " + type + " - using UN");
	          vr = new UnknownValue();
	        }
	      return vr;
	    }
	  }]);

	  return ValueRepresentation;
	}();

	var StringRepresentation =
	/*#__PURE__*/
	function (_ValueRepresentation) {
	  _inherits(StringRepresentation, _ValueRepresentation);

	  function StringRepresentation(type) {
	    var _this2;

	    _classCallCheck(this, StringRepresentation);

	    _this2 = _possibleConstructorReturn(this, _getPrototypeOf(StringRepresentation).call(this, type));
	    _this2.padByte = "20";
	    return _this2;
	  }

	  _createClass(StringRepresentation, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      return stream.readString(length);
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value) {
	      var written = _get(_getPrototypeOf(StringRepresentation.prototype), "write", this).call(this, stream, "String", value);

	      return _get(_getPrototypeOf(StringRepresentation.prototype), "writeBytes", this).call(this, stream, value, written);
	    }
	  }]);

	  return StringRepresentation;
	}(ValueRepresentation);

	var BinaryRepresentation =
	/*#__PURE__*/
	function (_ValueRepresentation2) {
	  _inherits(BinaryRepresentation, _ValueRepresentation2);

	  function BinaryRepresentation(type) {
	    _classCallCheck(this, BinaryRepresentation);

	    return _possibleConstructorReturn(this, _getPrototypeOf(BinaryRepresentation).call(this, type));
	  }

	  _createClass(BinaryRepresentation, [{
	    key: "writeBytes",
	    value: function writeBytes(stream, value, syntax, isEncapsulated, isPixelDataTag) {
	      var i;
	      var binaryStream;

	      if (isEncapsulated) {
	        var fragmentSize = 1024 * 1024 * 20,
	            frames = value.length,
	            startOffset = [];
	        binaryStream = new WriteBufferStream(1024 * 1024 * 20, stream.isLittleEndian);

	        for (i = 0; i < frames; i++) {
	          startOffset.push(binaryStream.size);
	          var frameBuffer = value[i],
	              frameStream = new ReadBufferStream(frameBuffer),
	              fragmentsLength = isPixelDataTag ? Math.ceil(frameStream.size / fragmentSize) : 1;

	          for (var j = 0, fragmentStart = 0; j < fragmentsLength; j++) {
	            var fragmentEnd = fragmentStart + fragmentSize;

	            if (j === fragmentsLength - 1) {
	              fragmentEnd = frameStream.size;
	            }

	            var fragStream = new ReadBufferStream(frameStream.getBuffer(fragmentStart, fragmentEnd));
	            fragmentStart = fragmentEnd;

	            if (isPixelDataTag) {
	              binaryStream.writeUint16(0xfffe);
	              binaryStream.writeUint16(0xe000);
	            }

	            binaryStream.writeUint32(fragStream.size);
	            binaryStream.concat(fragStream);
	          }
	        }

	        if (isPixelDataTag) {
	          stream.writeUint16(0xfffe);
	          stream.writeUint16(0xe000);
	          stream.writeUint32(startOffset.length * 4);

	          for (i = 0; i < startOffset.length; i++) {
	            stream.writeUint32(startOffset[i]);
	          }
	        }

	        stream.concat(binaryStream);

	        if (isPixelDataTag) {
	          stream.writeUint16(0xfffe);
	          stream.writeUint16(0xe0dd);
	          stream.writeUint32(0x0);
	        }

	        var written = 8 + binaryStream.size + startOffset.length * 4 + 8;

	        if (written & 1) {
	          stream.writeHex(this.padByte);
	          written++;
	        }

	        return 0xffffffff;
	      } else {
	        var binaryData = value[0];
	        binaryStream = new ReadBufferStream(binaryData);
	        stream.concat(binaryStream);
	        return _get(_getPrototypeOf(BinaryRepresentation.prototype), "writeBytes", this).call(this, stream, binaryData, [binaryStream.size]);
	      }
	    }
	  }, {
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      if (length === 0xffffffff) {
	        var itemTagValue = Tag.readTag(stream),
	            frames = [];

	        if (itemTagValue.is(0xfffee000)) {
	          var itemLength = stream.readUint32(),
	              numOfFrames = 1,
	              offsets = [];

	          if (itemLength > 0x0) {
	            //has frames
	            numOfFrames = itemLength / 4;
	            var i = 0;

	            while (i++ < numOfFrames) {
	              offsets.push(stream.readUint32());
	            }
	          } else {
	            offsets = [0];
	          }

	          var nextTag = Tag.readTag(stream),
	              fragmentStream = null,
	              start = 4,
	              frameOffset = offsets.shift();

	          while (nextTag.is(0xfffee000)) {
	            if (frameOffset === start) {
	              frameOffset = offsets.shift();

	              if (fragmentStream !== null) {
	                frames.push(fragmentStream.buffer);
	                fragmentStream = null;
	              }
	            }

	            var frameItemLength = stream.readUint32(),
	                thisStream = stream.more(frameItemLength);

	            if (fragmentStream === null) {
	              fragmentStream = thisStream;
	            } else {
	              fragmentStream.concat(thisStream);
	            }

	            nextTag = Tag.readTag(stream);
	            start += 4 + frameItemLength;
	          }

	          if (fragmentStream !== null) {
	            frames.push(fragmentStream.buffer);
	          }

	          stream.readUint32();
	        } else {
	          throw new Error("Item tag not found after undefined binary length");
	        }

	        return frames;
	      } else {
	        var bytes;
	        /*if (this.type === 'OW') {
	            bytes = stream.readUint16Array(length);
	        } else if (this.type === 'OB') {
	            bytes = stream.readUint8Array(length);
	        }*/

	        bytes = stream.more(length).buffer;
	        return [bytes];
	      }
	    }
	  }]);

	  return BinaryRepresentation;
	}(ValueRepresentation);

	var ApplicationEntity =
	/*#__PURE__*/
	function (_StringRepresentation) {
	  _inherits(ApplicationEntity, _StringRepresentation);

	  function ApplicationEntity() {
	    var _this3;

	    _classCallCheck(this, ApplicationEntity);

	    _this3 = _possibleConstructorReturn(this, _getPrototypeOf(ApplicationEntity).call(this, "AE"));
	    _this3.maxLength = 16;
	    _this3.fillWith = "20"; // TODO use writeFilledString

	    return _this3;
	  }

	  _createClass(ApplicationEntity, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      return stream.readString(length).trim();
	    }
	  }]);

	  return ApplicationEntity;
	}(StringRepresentation);

	var CodeString =
	/*#__PURE__*/
	function (_StringRepresentation2) {
	  _inherits(CodeString, _StringRepresentation2);

	  function CodeString() {
	    var _this4;

	    _classCallCheck(this, CodeString);

	    _this4 = _possibleConstructorReturn(this, _getPrototypeOf(CodeString).call(this, "CS"));
	    _this4.maxLength = 16;
	    return _this4;
	  }

	  _createClass(CodeString, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      //return this.readNullPaddedString(stream, length).trim();
	      return stream.readString(length).trim();
	    }
	  }]);

	  return CodeString;
	}(StringRepresentation);

	var AgeString =
	/*#__PURE__*/
	function (_StringRepresentation3) {
	  _inherits(AgeString, _StringRepresentation3);

	  function AgeString() {
	    var _this5;

	    _classCallCheck(this, AgeString);

	    _this5 = _possibleConstructorReturn(this, _getPrototypeOf(AgeString).call(this, "AS"));
	    _this5.maxLength = 4;
	    _this5.fixed = true;
	    _this5.defaultValue = "";
	    return _this5;
	  }

	  return AgeString;
	}(StringRepresentation);

	var AttributeTag =
	/*#__PURE__*/
	function (_ValueRepresentation3) {
	  _inherits(AttributeTag, _ValueRepresentation3);

	  function AttributeTag() {
	    var _this6;

	    _classCallCheck(this, AttributeTag);

	    _this6 = _possibleConstructorReturn(this, _getPrototypeOf(AttributeTag).call(this, "AT"));
	    _this6.maxLength = 4;
	    _this6.fixed = true;
	    return _this6;
	  }

	  _createClass(AttributeTag, [{
	    key: "readBytes",
	    value: function readBytes(stream) {
	      var group = stream.readUint16(),
	          element = stream.readUint16();
	      return tagFromNumbers(group, element).value;
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value) {
	      return _get(_getPrototypeOf(AttributeTag.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(AttributeTag.prototype), "write", this).call(this, stream, "Uint32", value));
	    }
	  }]);

	  return AttributeTag;
	}(ValueRepresentation);

	var DateValue =
	/*#__PURE__*/
	function (_StringRepresentation4) {
	  _inherits(DateValue, _StringRepresentation4);

	  function DateValue(value) {
	    var _this7;

	    _classCallCheck(this, DateValue);

	    _this7 = _possibleConstructorReturn(this, _getPrototypeOf(DateValue).call(this, "DA", value));
	    _this7.maxLength = 8; // this.maxLength = 18; // only in context of query

	    _this7.fixed = true;
	    _this7.defaultValue = "";
	    return _this7;
	  }

	  _createClass(DateValue, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      return _get(_getPrototypeOf(DateValue.prototype), "readBytes", this).call(this, stream, length).trim();
	    }
	  }]);

	  return DateValue;
	}(StringRepresentation);

	var DecimalString =
	/*#__PURE__*/
	function (_StringRepresentation5) {
	  _inherits(DecimalString, _StringRepresentation5);

	  function DecimalString() {
	    var _this8;

	    _classCallCheck(this, DecimalString);

	    _this8 = _possibleConstructorReturn(this, _getPrototypeOf(DecimalString).call(this, "DS"));
	    _this8.maxLength = 16;
	    return _this8;
	  }

	  _createClass(DecimalString, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      //return this.readNullPaddedString(stream, length).trim();
	      var ds = stream.readString(length);
	      ds = ds.replace(/[^0-9.\\\-+e]/gi, "");
	      return ds;
	    }
	  }]);

	  return DecimalString;
	}(StringRepresentation);

	var DateTime =
	/*#__PURE__*/
	function (_StringRepresentation6) {
	  _inherits(DateTime, _StringRepresentation6);

	  function DateTime() {
	    var _this9;

	    _classCallCheck(this, DateTime);

	    _this9 = _possibleConstructorReturn(this, _getPrototypeOf(DateTime).call(this, "DT"));
	    _this9.maxLength = 26; // this.maxLength = 54; // only in context of query

	    return _this9;
	  }

	  return DateTime;
	}(StringRepresentation);

	var FloatingPointSingle =
	/*#__PURE__*/
	function (_ValueRepresentation4) {
	  _inherits(FloatingPointSingle, _ValueRepresentation4);

	  function FloatingPointSingle() {
	    var _this10;

	    _classCallCheck(this, FloatingPointSingle);

	    _this10 = _possibleConstructorReturn(this, _getPrototypeOf(FloatingPointSingle).call(this, "FL"));
	    _this10.maxLength = 4;
	    _this10.fixed = true;
	    _this10.defaultValue = 0.0;
	    return _this10;
	  }

	  _createClass(FloatingPointSingle, [{
	    key: "readBytes",
	    value: function readBytes(stream) {
	      return stream.readFloat();
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value) {
	      return _get(_getPrototypeOf(FloatingPointSingle.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(FloatingPointSingle.prototype), "write", this).call(this, stream, "Float", value));
	    }
	  }]);

	  return FloatingPointSingle;
	}(ValueRepresentation);

	var FloatingPointDouble =
	/*#__PURE__*/
	function (_ValueRepresentation5) {
	  _inherits(FloatingPointDouble, _ValueRepresentation5);

	  function FloatingPointDouble() {
	    var _this11;

	    _classCallCheck(this, FloatingPointDouble);

	    _this11 = _possibleConstructorReturn(this, _getPrototypeOf(FloatingPointDouble).call(this, "FD"));
	    _this11.maxLength = 8;
	    _this11.fixed = true;
	    _this11.defaultValue = 0.0;
	    return _this11;
	  }

	  _createClass(FloatingPointDouble, [{
	    key: "readBytes",
	    value: function readBytes(stream) {
	      return stream.readDouble();
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value) {
	      return _get(_getPrototypeOf(FloatingPointDouble.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(FloatingPointDouble.prototype), "write", this).call(this, stream, "Double", value));
	    }
	  }]);

	  return FloatingPointDouble;
	}(ValueRepresentation);

	var IntegerString =
	/*#__PURE__*/
	function (_StringRepresentation7) {
	  _inherits(IntegerString, _StringRepresentation7);

	  function IntegerString() {
	    var _this12;

	    _classCallCheck(this, IntegerString);

	    _this12 = _possibleConstructorReturn(this, _getPrototypeOf(IntegerString).call(this, "IS"));
	    _this12.maxLength = 12;
	    return _this12;
	  }

	  _createClass(IntegerString, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      //return this.readNullPaddedString(stream, length);
	      return stream.readString(length).trim();
	    }
	  }]);

	  return IntegerString;
	}(StringRepresentation);

	var LongString =
	/*#__PURE__*/
	function (_StringRepresentation8) {
	  _inherits(LongString, _StringRepresentation8);

	  function LongString() {
	    var _this13;

	    _classCallCheck(this, LongString);

	    _this13 = _possibleConstructorReturn(this, _getPrototypeOf(LongString).call(this, "LO"));
	    _this13.maxCharLength = 64;
	    return _this13;
	  }

	  _createClass(LongString, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      //return this.readNullPaddedString(stream, length).trim();
	      return stream.readString(length).trim();
	    }
	  }]);

	  return LongString;
	}(StringRepresentation);

	var LongText =
	/*#__PURE__*/
	function (_StringRepresentation9) {
	  _inherits(LongText, _StringRepresentation9);

	  function LongText() {
	    var _this14;

	    _classCallCheck(this, LongText);

	    _this14 = _possibleConstructorReturn(this, _getPrototypeOf(LongText).call(this, "LT"));
	    _this14.maxCharLength = 10240;
	    return _this14;
	  }

	  _createClass(LongText, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      //return rtrim(this.readNullPaddedString(stream, length));
	      return rtrim(stream.readString(length));
	    }
	  }]);

	  return LongText;
	}(StringRepresentation);

	var PersonName =
	/*#__PURE__*/
	function (_StringRepresentation10) {
	  _inherits(PersonName, _StringRepresentation10);

	  function PersonName() {
	    var _this15;

	    _classCallCheck(this, PersonName);

	    _this15 = _possibleConstructorReturn(this, _getPrototypeOf(PersonName).call(this, "PN"));
	    _this15.maxLength = null;
	    return _this15;
	  }

	  _createClass(PersonName, [{
	    key: "checkLength",
	    value: function checkLength(value) {
	      var cmps = value.split(/\^/);

	      for (var i in cmps) {
	        if (cmps.hasOwnProperty(i)) {
	          var cmp = cmps[i];
	          if (cmp.length > 64) return false;
	        }
	      }

	      return true;
	    }
	  }, {
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      //return rtrim(this.readNullPaddedString(stream, length));
	      return rtrim(stream.readString(length));
	    }
	  }]);

	  return PersonName;
	}(StringRepresentation);

	var ShortString =
	/*#__PURE__*/
	function (_StringRepresentation11) {
	  _inherits(ShortString, _StringRepresentation11);

	  function ShortString() {
	    var _this16;

	    _classCallCheck(this, ShortString);

	    _this16 = _possibleConstructorReturn(this, _getPrototypeOf(ShortString).call(this, "SH"));
	    _this16.maxCharLength = 16;
	    return _this16;
	  }

	  _createClass(ShortString, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      //return this.readNullPaddedString(stream, length).trim();
	      return stream.readString(length).trim();
	    }
	  }]);

	  return ShortString;
	}(StringRepresentation);

	var SignedLong =
	/*#__PURE__*/
	function (_ValueRepresentation6) {
	  _inherits(SignedLong, _ValueRepresentation6);

	  function SignedLong() {
	    var _this17;

	    _classCallCheck(this, SignedLong);

	    _this17 = _possibleConstructorReturn(this, _getPrototypeOf(SignedLong).call(this, "SL"));
	    _this17.maxLength = 4;
	    _this17.fixed = true;
	    _this17.defaultValue = 0;
	    return _this17;
	  }

	  _createClass(SignedLong, [{
	    key: "readBytes",
	    value: function readBytes(stream) {
	      return stream.readInt32();
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value) {
	      return _get(_getPrototypeOf(SignedLong.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(SignedLong.prototype), "write", this).call(this, stream, "Int32", value));
	    }
	  }]);

	  return SignedLong;
	}(ValueRepresentation);

	var SequenceOfItems =
	/*#__PURE__*/
	function (_ValueRepresentation7) {
	  _inherits(SequenceOfItems, _ValueRepresentation7);

	  function SequenceOfItems() {
	    var _this18;

	    _classCallCheck(this, SequenceOfItems);

	    _this18 = _possibleConstructorReturn(this, _getPrototypeOf(SequenceOfItems).call(this, "SQ"));
	    _this18.maxLength = null;
	    _this18.noMultiple = true;
	    return _this18;
	  }

	  _createClass(SequenceOfItems, [{
	    key: "readBytes",
	    value: function readBytes(stream, sqlength, syntax) {
	      if (sqlength === 0x0) {
	        return []; //contains no dataset
	      } else {
	        var undefLength = sqlength === 0xffffffff,
	            elements = [],
	            read = 0;
	        /* eslint-disable-next-line no-constant-condition */

	        while (true) {
	          var tag = readTag(stream),
	              length = null;
	          read += 4;

	          if (tag.is(0xfffee0dd)) {
	            stream.readUint32();
	            break;
	          } else if (!undefLength && read === sqlength) {
	            break;
	          } else if (tag.is(0xfffee000)) {
	            length = stream.readUint32();
	            read += 4;
	            var itemStream = null,
	                toRead = 0,
	                undef = length === 0xffffffff;

	            if (undef) {
	              var stack = 0;
	              /* eslint-disable-next-line no-constant-condition */

	              while (1) {
	                var g = stream.readUint16();

	                if (g === 0xfffe) {
	                  var ge = stream.readUint16();

	                  if (ge === 0xe00d) {
	                    stack--;

	                    if (stack < 0) {
	                      stream.increment(4);
	                      read += 8;
	                      break;
	                    } else {
	                      toRead += 4;
	                    }
	                  } else if (ge === 0xe000) {
	                    stack++;
	                    toRead += 4;
	                  } else {
	                    toRead += 2;
	                    stream.increment(-2);
	                  }
	                } else {
	                  toRead += 2;
	                }
	              }
	            } else {
	              toRead = length;
	            }

	            if (toRead) {
	              stream.increment(undef ? -toRead - 8 : 0);
	              itemStream = stream.more(toRead); //parseElements

	              read += toRead;
	              if (undef) stream.increment(8);
	              var items = DicomMessage.read(itemStream, syntax);
	              elements.push(items);
	            }

	            if (!undefLength && read === sqlength) {
	              break;
	            }
	          }
	        }

	        return elements;
	      }
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value, syntax) {
	      var written = 0;

	      if (value) {
	        for (var i = 0; i < value.length; i++) {
	          var item = value[i];

	          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xfffe);

	          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xe000);

	          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint32", 0xffffffff);

	          written += DicomMessage.write(item, stream, syntax);

	          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xfffe);

	          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xe00d);

	          _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint32", 0x00000000);

	          written += 16;
	        }
	      }

	      _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xfffe);

	      _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint16", 0xe0dd);

	      _get(_getPrototypeOf(SequenceOfItems.prototype), "write", this).call(this, stream, "Uint32", 0x00000000);

	      written += 8;
	      return _get(_getPrototypeOf(SequenceOfItems.prototype), "writeBytes", this).call(this, stream, value, [written]);
	    }
	  }]);

	  return SequenceOfItems;
	}(ValueRepresentation);

	var SignedShort =
	/*#__PURE__*/
	function (_ValueRepresentation8) {
	  _inherits(SignedShort, _ValueRepresentation8);

	  function SignedShort() {
	    var _this19;

	    _classCallCheck(this, SignedShort);

	    _this19 = _possibleConstructorReturn(this, _getPrototypeOf(SignedShort).call(this, "SS"));
	    _this19.maxLength = 2;
	    _this19.fixed = true;
	    _this19.defaultValue = 0;
	    return _this19;
	  }

	  _createClass(SignedShort, [{
	    key: "readBytes",
	    value: function readBytes(stream) {
	      return stream.readInt16();
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value) {
	      return _get(_getPrototypeOf(SignedShort.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(SignedShort.prototype), "write", this).call(this, stream, "Int16", value));
	    }
	  }]);

	  return SignedShort;
	}(ValueRepresentation);

	var ShortText =
	/*#__PURE__*/
	function (_StringRepresentation12) {
	  _inherits(ShortText, _StringRepresentation12);

	  function ShortText() {
	    var _this20;

	    _classCallCheck(this, ShortText);

	    _this20 = _possibleConstructorReturn(this, _getPrototypeOf(ShortText).call(this, "ST"));
	    _this20.maxCharLength = 1024;
	    return _this20;
	  }

	  _createClass(ShortText, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      //return rtrim(this.readNullPaddedString(stream, length));
	      return rtrim(stream.readString(length));
	    }
	  }]);

	  return ShortText;
	}(StringRepresentation);

	var TimeValue =
	/*#__PURE__*/
	function (_StringRepresentation13) {
	  _inherits(TimeValue, _StringRepresentation13);

	  function TimeValue() {
	    var _this21;

	    _classCallCheck(this, TimeValue);

	    _this21 = _possibleConstructorReturn(this, _getPrototypeOf(TimeValue).call(this, "TM"));
	    _this21.maxLength = 14; // this.maxLength = 28; // only in context of query

	    return _this21;
	  }

	  _createClass(TimeValue, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      return rtrim(stream.readString(length));
	    }
	  }]);

	  return TimeValue;
	}(StringRepresentation);

	var UnlimitedCharacters =
	/*#__PURE__*/
	function (_StringRepresentation14) {
	  _inherits(UnlimitedCharacters, _StringRepresentation14);

	  function UnlimitedCharacters() {
	    var _this22;

	    _classCallCheck(this, UnlimitedCharacters);

	    _this22 = _possibleConstructorReturn(this, _getPrototypeOf(UnlimitedCharacters).call(this, "UC"));
	    _this22.maxLength = Math.pow(2, 32) - 2;
	    return _this22;
	  }

	  _createClass(UnlimitedCharacters, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      return rtrim(stream.readString(length));
	    }
	  }]);

	  return UnlimitedCharacters;
	}(StringRepresentation);

	var UnlimitedText =
	/*#__PURE__*/
	function (_StringRepresentation15) {
	  _inherits(UnlimitedText, _StringRepresentation15);

	  function UnlimitedText() {
	    var _this23;

	    _classCallCheck(this, UnlimitedText);

	    _this23 = _possibleConstructorReturn(this, _getPrototypeOf(UnlimitedText).call(this, "UT"));
	    _this23.maxLength = null;
	    return _this23;
	  }

	  _createClass(UnlimitedText, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      //return this.readNullPaddedString(stream, length);
	      return rtrim(stream.readString(length));
	    }
	  }]);

	  return UnlimitedText;
	}(StringRepresentation);

	var UnsignedShort =
	/*#__PURE__*/
	function (_ValueRepresentation9) {
	  _inherits(UnsignedShort, _ValueRepresentation9);

	  function UnsignedShort() {
	    var _this24;

	    _classCallCheck(this, UnsignedShort);

	    _this24 = _possibleConstructorReturn(this, _getPrototypeOf(UnsignedShort).call(this, "US"));
	    _this24.maxLength = 2;
	    _this24.fixed = true;
	    _this24.defaultValue = 0;
	    return _this24;
	  }

	  _createClass(UnsignedShort, [{
	    key: "readBytes",
	    value: function readBytes(stream) {
	      return stream.readUint16();
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value) {
	      return _get(_getPrototypeOf(UnsignedShort.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(UnsignedShort.prototype), "write", this).call(this, stream, "Uint16", value));
	    }
	  }]);

	  return UnsignedShort;
	}(ValueRepresentation);

	var UnsignedLong =
	/*#__PURE__*/
	function (_ValueRepresentation10) {
	  _inherits(UnsignedLong, _ValueRepresentation10);

	  function UnsignedLong() {
	    var _this25;

	    _classCallCheck(this, UnsignedLong);

	    _this25 = _possibleConstructorReturn(this, _getPrototypeOf(UnsignedLong).call(this, "UL"));
	    _this25.maxLength = 4;
	    _this25.fixed = true;
	    _this25.defaultValue = 0;
	    return _this25;
	  }

	  _createClass(UnsignedLong, [{
	    key: "readBytes",
	    value: function readBytes(stream) {
	      return stream.readUint32();
	    }
	  }, {
	    key: "writeBytes",
	    value: function writeBytes(stream, value) {
	      return _get(_getPrototypeOf(UnsignedLong.prototype), "writeBytes", this).call(this, stream, value, _get(_getPrototypeOf(UnsignedLong.prototype), "write", this).call(this, stream, "Uint32", value));
	    }
	  }]);

	  return UnsignedLong;
	}(ValueRepresentation);

	var UniqueIdentifier =
	/*#__PURE__*/
	function (_StringRepresentation16) {
	  _inherits(UniqueIdentifier, _StringRepresentation16);

	  function UniqueIdentifier() {
	    var _this26;

	    _classCallCheck(this, UniqueIdentifier);

	    _this26 = _possibleConstructorReturn(this, _getPrototypeOf(UniqueIdentifier).call(this, "UI"));
	    _this26.maxLength = 64;
	    _this26.padByte = "00";
	    return _this26;
	  }

	  _createClass(UniqueIdentifier, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      return this.readNullPaddedString(stream, length).replace(/[^0-9.]/g, "");
	    }
	  }]);

	  return UniqueIdentifier;
	}(StringRepresentation);

	var UniversalResource =
	/*#__PURE__*/
	function (_StringRepresentation17) {
	  _inherits(UniversalResource, _StringRepresentation17);

	  function UniversalResource() {
	    var _this27;

	    _classCallCheck(this, UniversalResource);

	    _this27 = _possibleConstructorReturn(this, _getPrototypeOf(UniversalResource).call(this, "UR"));
	    _this27.maxLength = Math.pow(2, 32) - 2;
	    return _this27;
	  }

	  _createClass(UniversalResource, [{
	    key: "readBytes",
	    value: function readBytes(stream, length) {
	      return stream.readString(length);
	    }
	  }]);

	  return UniversalResource;
	}(StringRepresentation);

	var UnknownValue =
	/*#__PURE__*/
	function (_BinaryRepresentation) {
	  _inherits(UnknownValue, _BinaryRepresentation);

	  function UnknownValue() {
	    var _this28;

	    _classCallCheck(this, UnknownValue);

	    _this28 = _possibleConstructorReturn(this, _getPrototypeOf(UnknownValue).call(this, "UN"));
	    _this28.maxLength = null;
	    _this28.noMultiple = true;
	    return _this28;
	  }

	  return UnknownValue;
	}(BinaryRepresentation); // TODO implement these
	// class OtherLongString extends BinaryRepresentation {
	//     constructor() {
	//         super("OL");
	//         this.maxLength = null;
	//         this.noMultiple = true;
	//     }
	// }
	//
	// class OtherVeryLongString extends BinaryRepresentation {
	//     constructor() {
	//         super("OV");
	//         this.maxLength = null;
	//         this.noMultiple = true;
	//     }
	// }


	var OtherWordString =
	/*#__PURE__*/
	function (_BinaryRepresentation2) {
	  _inherits(OtherWordString, _BinaryRepresentation2);

	  function OtherWordString() {
	    var _this29;

	    _classCallCheck(this, OtherWordString);

	    _this29 = _possibleConstructorReturn(this, _getPrototypeOf(OtherWordString).call(this, "OW"));
	    _this29.maxLength = null;
	    _this29.noMultiple = true;
	    return _this29;
	  }

	  return OtherWordString;
	}(BinaryRepresentation);

	var OtherByteString =
	/*#__PURE__*/
	function (_BinaryRepresentation3) {
	  _inherits(OtherByteString, _BinaryRepresentation3);

	  function OtherByteString() {
	    var _this30;

	    _classCallCheck(this, OtherByteString);

	    _this30 = _possibleConstructorReturn(this, _getPrototypeOf(OtherByteString).call(this, "OB"));
	    _this30.maxLength = null;
	    _this30.padByte = "00";
	    _this30.noMultiple = true;
	    return _this30;
	  }

	  return OtherByteString;
	}(BinaryRepresentation);

	var OtherDoubleString =
	/*#__PURE__*/
	function (_BinaryRepresentation4) {
	  _inherits(OtherDoubleString, _BinaryRepresentation4);

	  function OtherDoubleString() {
	    var _this31;

	    _classCallCheck(this, OtherDoubleString);

	    _this31 = _possibleConstructorReturn(this, _getPrototypeOf(OtherDoubleString).call(this, "OD"));
	    _this31.maxLength = Math.pow(2, 32) - 8;
	    _this31.noMultiple = true;
	    return _this31;
	  }

	  return OtherDoubleString;
	}(BinaryRepresentation);

	var OtherFloatString =
	/*#__PURE__*/
	function (_BinaryRepresentation5) {
	  _inherits(OtherFloatString, _BinaryRepresentation5);

	  function OtherFloatString() {
	    var _this32;

	    _classCallCheck(this, OtherFloatString);

	    _this32 = _possibleConstructorReturn(this, _getPrototypeOf(OtherFloatString).call(this, "OF"));
	    _this32.maxLength = Math.pow(2, 32) - 4;
	    _this32.noMultiple = true;
	    return _this32;
	  }

	  return OtherFloatString;
	}(BinaryRepresentation);

	var IMPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2";
	var EXPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2.1";

	var Tag =
	/*#__PURE__*/
	function () {
	  function Tag(value) {
	    _classCallCheck(this, Tag);

	    this.value = value;
	  }

	  _createClass(Tag, [{
	    key: "toString",
	    value: function toString() {
	      return "(" + paddingLeft("0000", this.group().toString(16).toUpperCase()) + "," + paddingLeft("0000", this.element().toString(16).toUpperCase()) + ")";
	    }
	  }, {
	    key: "toCleanString",
	    value: function toCleanString() {
	      return paddingLeft("0000", this.group().toString(16).toUpperCase()) + paddingLeft("0000", this.element().toString(16).toUpperCase());
	    }
	  }, {
	    key: "is",
	    value: function is(t) {
	      return this.value === t;
	    }
	  }, {
	    key: "group",
	    value: function group() {
	      return this.value >>> 16;
	    }
	  }, {
	    key: "element",
	    value: function element() {
	      return this.value & 0xffff;
	    }
	  }, {
	    key: "isPixelDataTag",
	    value: function isPixelDataTag() {
	      return this.is(0x7fe00010);
	    }
	  }, {
	    key: "write",
	    value: function write(stream, vrType, values, syntax) {
	      var vr = ValueRepresentation.createByTypeString(vrType),
	          useSyntax = DicomMessage._normalizeSyntax(syntax);

	      var implicit = useSyntax === IMPLICIT_LITTLE_ENDIAN,
	          isLittleEndian = useSyntax === IMPLICIT_LITTLE_ENDIAN || useSyntax === EXPLICIT_LITTLE_ENDIAN,
	          isEncapsulated = DicomMessage.isEncapsulated(syntax);
	      var oldEndian = stream.isLittleEndian;
	      stream.setEndian(isLittleEndian);
	      stream.writeUint16(this.group());
	      stream.writeUint16(this.element());
	      var tagStream = new WriteBufferStream(256),
	          valueLength;
	      tagStream.setEndian(isLittleEndian);

	      if (["OB", "OW"].includes(vrType)) {
	        valueLength = vr.writeBytes(tagStream, values, useSyntax, isEncapsulated, this.isPixelDataTag());
	      } else {
	        valueLength = vr.writeBytes(tagStream, values, useSyntax);
	      }

	      if (vrType === "SQ") {
	        valueLength = 0xffffffff;
	      }

	      var written = tagStream.size + 4;

	      if (implicit) {
	        stream.writeUint32(valueLength);
	        written += 4;
	      } else {
	        if (vr.isExplicit()) {
	          stream.writeString(vr.type);
	          stream.writeHex("0000");

	          if (valueLength !== 0xffffffff || !["OB", "OW"].includes(vrType) || this.isPixelDataTag()) {
	            stream.writeUint32(valueLength);
	            written += 8;
	          } else {
	            written += 4;
	          }
	        } else {
	          stream.writeString(vr.type);
	          stream.writeUint16(valueLength);
	          written += 4;
	        }
	      }

	      stream.concat(tagStream);
	      stream.setEndian(oldEndian);
	      return written;
	    }
	  }], [{
	    key: "fromString",
	    value: function fromString(str) {
	      var group = parseInt(str.substring(0, 4), 16),
	          element = parseInt(str.substring(4), 16);
	      return Tag.fromNumbers(group, element);
	    }
	  }, {
	    key: "fromPString",
	    value: function fromPString(str) {
	      var group = parseInt(str.substring(1, 5), 16),
	          element = parseInt(str.substring(6, 10), 16);
	      return Tag.fromNumbers(group, element);
	    }
	  }, {
	    key: "fromNumbers",
	    value: function fromNumbers(group, element) {
	      return new Tag((group << 16 | element) >>> 0);
	    }
	  }, {
	    key: "readTag",
	    value: function readTag(stream) {
	      var group = stream.readUint16(),
	          element = stream.readUint16();
	      return Tag.fromNumbers(group, element);
	    }
	  }]);

	  return Tag;
	}();

	var dictionary={"(0000,0000)":{tag:"(0000,0000)",vr:"UL",name:"CommandGroupLength",vm:"1",version:"DICOM"},"(0000,0002)":{tag:"(0000,0002)",vr:"UI",name:"AffectedSOPClassUID",vm:"1",version:"DICOM"},"(0000,0003)":{tag:"(0000,0003)",vr:"UI",name:"RequestedSOPClassUID",vm:"1",version:"DICOM"},"(0000,0100)":{tag:"(0000,0100)",vr:"US",name:"CommandField",vm:"1",version:"DICOM"},"(0000,0110)":{tag:"(0000,0110)",vr:"US",name:"MessageID",vm:"1",version:"DICOM"},"(0000,0120)":{tag:"(0000,0120)",vr:"US",name:"MessageIDBeingRespondedTo",vm:"1",version:"DICOM"},"(0000,0600)":{tag:"(0000,0600)",vr:"AE",name:"MoveDestination",vm:"1",version:"DICOM"},"(0000,0700)":{tag:"(0000,0700)",vr:"US",name:"Priority",vm:"1",version:"DICOM"},"(0000,0800)":{tag:"(0000,0800)",vr:"US",name:"CommandDataSetType",vm:"1",version:"DICOM"},"(0000,0900)":{tag:"(0000,0900)",vr:"US",name:"Status",vm:"1",version:"DICOM"},"(0000,0901)":{tag:"(0000,0901)",vr:"AT",name:"OffendingElement",vm:"1-n",version:"DICOM"},"(0000,0902)":{tag:"(0000,0902)",vr:"LO",name:"ErrorComment",vm:"1",version:"DICOM"},"(0000,0903)":{tag:"(0000,0903)",vr:"US",name:"ErrorID",vm:"1",version:"DICOM"},"(0000,1000)":{tag:"(0000,1000)",vr:"UI",name:"AffectedSOPInstanceUID",vm:"1",version:"DICOM"},"(0000,1001)":{tag:"(0000,1001)",vr:"UI",name:"RequestedSOPInstanceUID",vm:"1",version:"DICOM"},"(0000,1002)":{tag:"(0000,1002)",vr:"US",name:"EventTypeID",vm:"1",version:"DICOM"},"(0000,1005)":{tag:"(0000,1005)",vr:"AT",name:"AttributeIdentifierList",vm:"1-n",version:"DICOM"},"(0000,1008)":{tag:"(0000,1008)",vr:"US",name:"ActionTypeID",vm:"1",version:"DICOM"},"(0000,1020)":{tag:"(0000,1020)",vr:"US",name:"NumberOfRemainingSuboperations",vm:"1",version:"DICOM"},"(0000,1021)":{tag:"(0000,1021)",vr:"US",name:"NumberOfCompletedSuboperations",vm:"1",version:"DICOM"},"(0000,1022)":{tag:"(0000,1022)",vr:"US",name:"NumberOfFailedSuboperations",vm:"1",version:"DICOM"},"(0000,1023)":{tag:"(0000,1023)",vr:"US",name:"NumberOfWarningSuboperations",vm:"1",version:"DICOM"},"(0000,1030)":{tag:"(0000,1030)",vr:"AE",name:"MoveOriginatorApplicationEntityTitle",vm:"1",version:"DICOM"},"(0000,1031)":{tag:"(0000,1031)",vr:"US",name:"MoveOriginatorMessageID",vm:"1",version:"DICOM"},"(0002,0000)":{tag:"(0002,0000)",vr:"UL",name:"FileMetaInformationGroupLength",vm:"1",version:"DICOM"},"(0002,0001)":{tag:"(0002,0001)",vr:"OB",name:"FileMetaInformationVersion",vm:"1",version:"DICOM"},"(0002,0002)":{tag:"(0002,0002)",vr:"UI",name:"MediaStorageSOPClassUID",vm:"1",version:"DICOM"},"(0002,0003)":{tag:"(0002,0003)",vr:"UI",name:"MediaStorageSOPInstanceUID",vm:"1",version:"DICOM"},"(0002,0010)":{tag:"(0002,0010)",vr:"UI",name:"TransferSyntaxUID",vm:"1",version:"DICOM"},"(0002,0012)":{tag:"(0002,0012)",vr:"UI",name:"ImplementationClassUID",vm:"1",version:"DICOM"},"(0002,0013)":{tag:"(0002,0013)",vr:"SH",name:"ImplementationVersionName",vm:"1",version:"DICOM"},"(0002,0016)":{tag:"(0002,0016)",vr:"AE",name:"SourceApplicationEntityTitle",vm:"1",version:"DICOM"},"(0002,0017)":{tag:"(0002,0017)",vr:"AE",name:"SendingApplicationEntityTitle",vm:"1",version:"DICOM"},"(0002,0018)":{tag:"(0002,0018)",vr:"AE",name:"ReceivingApplicationEntityTitle",vm:"1",version:"DICOM"},"(0002,0100)":{tag:"(0002,0100)",vr:"UI",name:"PrivateInformationCreatorUID",vm:"1",version:"DICOM"},"(0002,0102)":{tag:"(0002,0102)",vr:"OB",name:"PrivateInformation",vm:"1",version:"DICOM"},"(0004,1130)":{tag:"(0004,1130)",vr:"CS",name:"FileSetID",vm:"1",version:"DICOM"},"(0004,1141)":{tag:"(0004,1141)",vr:"CS",name:"FileSetDescriptorFileID",vm:"1-8",version:"DICOM"},"(0004,1142)":{tag:"(0004,1142)",vr:"CS",name:"SpecificCharacterSetOfFileSetDescriptorFile",vm:"1",version:"DICOM"},"(0004,1200)":{tag:"(0004,1200)",vr:"up",name:"OffsetOfTheFirstDirectoryRecordOfTheRootDirectoryEntity",vm:"1",version:"DICOM"},"(0004,1202)":{tag:"(0004,1202)",vr:"up",name:"OffsetOfTheLastDirectoryRecordOfTheRootDirectoryEntity",vm:"1",version:"DICOM"},"(0004,1212)":{tag:"(0004,1212)",vr:"US",name:"FileSetConsistencyFlag",vm:"1",version:"DICOM"},"(0004,1220)":{tag:"(0004,1220)",vr:"SQ",name:"DirectoryRecordSequence",vm:"1",version:"DICOM"},"(0004,1400)":{tag:"(0004,1400)",vr:"up",name:"OffsetOfTheNextDirectoryRecord",vm:"1",version:"DICOM"},"(0004,1410)":{tag:"(0004,1410)",vr:"US",name:"RecordInUseFlag",vm:"1",version:"DICOM"},"(0004,1420)":{tag:"(0004,1420)",vr:"up",name:"OffsetOfReferencedLowerLevelDirectoryEntity",vm:"1",version:"DICOM"},"(0004,1430)":{tag:"(0004,1430)",vr:"CS",name:"DirectoryRecordType",vm:"1",version:"DICOM"},"(0004,1432)":{tag:"(0004,1432)",vr:"UI",name:"PrivateRecordUID",vm:"1",version:"DICOM"},"(0004,1500)":{tag:"(0004,1500)",vr:"CS",name:"ReferencedFileID",vm:"1-8",version:"DICOM"},"(0004,1510)":{tag:"(0004,1510)",vr:"UI",name:"ReferencedSOPClassUIDInFile",vm:"1",version:"DICOM"},"(0004,1511)":{tag:"(0004,1511)",vr:"UI",name:"ReferencedSOPInstanceUIDInFile",vm:"1",version:"DICOM"},"(0004,1512)":{tag:"(0004,1512)",vr:"UI",name:"ReferencedTransferSyntaxUIDInFile",vm:"1",version:"DICOM"},"(0004,151A)":{tag:"(0004,151A)",vr:"UI",name:"ReferencedRelatedGeneralSOPClassUIDInFile",vm:"1-n",version:"DICOM"},"(0008,0005)":{tag:"(0008,0005)",vr:"CS",name:"SpecificCharacterSet",vm:"1-n",version:"DICOM"},"(0008,0006)":{tag:"(0008,0006)",vr:"SQ",name:"LanguageCodeSequence",vm:"1",version:"DICOM"},"(0008,0008)":{tag:"(0008,0008)",vr:"CS",name:"ImageType",vm:"2-n",version:"DICOM"},"(0008,0012)":{tag:"(0008,0012)",vr:"DA",name:"InstanceCreationDate",vm:"1",version:"DICOM"},"(0008,0013)":{tag:"(0008,0013)",vr:"TM",name:"InstanceCreationTime",vm:"1",version:"DICOM"},"(0008,0014)":{tag:"(0008,0014)",vr:"UI",name:"InstanceCreatorUID",vm:"1",version:"DICOM"},"(0008,0015)":{tag:"(0008,0015)",vr:"DT",name:"InstanceCoercionDateTime",vm:"1",version:"DICOM"},"(0008,0016)":{tag:"(0008,0016)",vr:"UI",name:"SOPClassUID",vm:"1",version:"DICOM"},"(0008,0018)":{tag:"(0008,0018)",vr:"UI",name:"SOPInstanceUID",vm:"1",version:"DICOM"},"(0008,001A)":{tag:"(0008,001A)",vr:"UI",name:"RelatedGeneralSOPClassUID",vm:"1-n",version:"DICOM"},"(0008,001B)":{tag:"(0008,001B)",vr:"UI",name:"OriginalSpecializedSOPClassUID",vm:"1",version:"DICOM"},"(0008,0020)":{tag:"(0008,0020)",vr:"DA",name:"StudyDate",vm:"1",version:"DICOM"},"(0008,0021)":{tag:"(0008,0021)",vr:"DA",name:"SeriesDate",vm:"1",version:"DICOM"},"(0008,0022)":{tag:"(0008,0022)",vr:"DA",name:"AcquisitionDate",vm:"1",version:"DICOM"},"(0008,0023)":{tag:"(0008,0023)",vr:"DA",name:"ContentDate",vm:"1",version:"DICOM"},"(0008,002A)":{tag:"(0008,002A)",vr:"DT",name:"AcquisitionDateTime",vm:"1",version:"DICOM"},"(0008,0030)":{tag:"(0008,0030)",vr:"TM",name:"StudyTime",vm:"1",version:"DICOM"},"(0008,0031)":{tag:"(0008,0031)",vr:"TM",name:"SeriesTime",vm:"1",version:"DICOM"},"(0008,0032)":{tag:"(0008,0032)",vr:"TM",name:"AcquisitionTime",vm:"1",version:"DICOM"},"(0008,0033)":{tag:"(0008,0033)",vr:"TM",name:"ContentTime",vm:"1",version:"DICOM"},"(0008,0050)":{tag:"(0008,0050)",vr:"SH",name:"AccessionNumber",vm:"1",version:"DICOM"},"(0008,0051)":{tag:"(0008,0051)",vr:"SQ",name:"IssuerOfAccessionNumberSequence",vm:"1",version:"DICOM"},"(0008,0052)":{tag:"(0008,0052)",vr:"CS",name:"QueryRetrieveLevel",vm:"1",version:"DICOM"},"(0008,0053)":{tag:"(0008,0053)",vr:"CS",name:"QueryRetrieveView",vm:"1",version:"DICOM"},"(0008,0054)":{tag:"(0008,0054)",vr:"AE",name:"RetrieveAETitle",vm:"1-n",version:"DICOM"},"(0008,0056)":{tag:"(0008,0056)",vr:"CS",name:"InstanceAvailability",vm:"1",version:"DICOM"},"(0008,0058)":{tag:"(0008,0058)",vr:"UI",name:"FailedSOPInstanceUIDList",vm:"1-n",version:"DICOM"},"(0008,0060)":{tag:"(0008,0060)",vr:"CS",name:"Modality",vm:"1",version:"DICOM"},"(0008,0061)":{tag:"(0008,0061)",vr:"CS",name:"ModalitiesInStudy",vm:"1-n",version:"DICOM"},"(0008,0062)":{tag:"(0008,0062)",vr:"UI",name:"SOPClassesInStudy",vm:"1-n",version:"DICOM"},"(0008,0064)":{tag:"(0008,0064)",vr:"CS",name:"ConversionType",vm:"1",version:"DICOM"},"(0008,0068)":{tag:"(0008,0068)",vr:"CS",name:"PresentationIntentType",vm:"1",version:"DICOM"},"(0008,0070)":{tag:"(0008,0070)",vr:"LO",name:"Manufacturer",vm:"1",version:"DICOM"},"(0008,0080)":{tag:"(0008,0080)",vr:"LO",name:"InstitutionName",vm:"1",version:"DICOM"},"(0008,0081)":{tag:"(0008,0081)",vr:"ST",name:"InstitutionAddress",vm:"1",version:"DICOM"},"(0008,0082)":{tag:"(0008,0082)",vr:"SQ",name:"InstitutionCodeSequence",vm:"1",version:"DICOM"},"(0008,0090)":{tag:"(0008,0090)",vr:"PN",name:"ReferringPhysicianName",vm:"1",version:"DICOM"},"(0008,0092)":{tag:"(0008,0092)",vr:"ST",name:"ReferringPhysicianAddress",vm:"1",version:"DICOM"},"(0008,0094)":{tag:"(0008,0094)",vr:"SH",name:"ReferringPhysicianTelephoneNumbers",vm:"1-n",version:"DICOM"},"(0008,0096)":{tag:"(0008,0096)",vr:"SQ",name:"ReferringPhysicianIdentificationSequence",vm:"1",version:"DICOM"},"(0008,009C)":{tag:"(0008,009C)",vr:"PN",name:"ConsultingPhysicianName",vm:"1-n",version:"DICOM"},"(0008,009D)":{tag:"(0008,009D)",vr:"SQ",name:"ConsultingPhysicianIdentificationSequence",vm:"1",version:"DICOM"},"(0008,0100)":{tag:"(0008,0100)",vr:"SH",name:"CodeValue",vm:"1",version:"DICOM"},"(0008,0101)":{tag:"(0008,0101)",vr:"LO",name:"ExtendedCodeValue",vm:"1",version:"DICOM/DICOS"},"(0008,0102)":{tag:"(0008,0102)",vr:"SH",name:"CodingSchemeDesignator",vm:"1",version:"DICOM"},"(0008,0103)":{tag:"(0008,0103)",vr:"SH",name:"CodingSchemeVersion",vm:"1",version:"DICOM"},"(0008,0104)":{tag:"(0008,0104)",vr:"LO",name:"CodeMeaning",vm:"1",version:"DICOM"},"(0008,0105)":{tag:"(0008,0105)",vr:"CS",name:"MappingResource",vm:"1",version:"DICOM"},"(0008,0106)":{tag:"(0008,0106)",vr:"DT",name:"ContextGroupVersion",vm:"1",version:"DICOM"},"(0008,0107)":{tag:"(0008,0107)",vr:"DT",name:"ContextGroupLocalVersion",vm:"1",version:"DICOM"},"(0008,0108)":{tag:"(0008,0108)",vr:"LT",name:"ExtendedCodeMeaning",vm:"1",version:"DICOM/DICOS"},"(0008,010B)":{tag:"(0008,010B)",vr:"CS",name:"ContextGroupExtensionFlag",vm:"1",version:"DICOM"},"(0008,010C)":{tag:"(0008,010C)",vr:"UI",name:"CodingSchemeUID",vm:"1",version:"DICOM"},"(0008,010D)":{tag:"(0008,010D)",vr:"UI",name:"ContextGroupExtensionCreatorUID",vm:"1",version:"DICOM"},"(0008,010F)":{tag:"(0008,010F)",vr:"CS",name:"ContextIdentifier",vm:"1",version:"DICOM"},"(0008,0110)":{tag:"(0008,0110)",vr:"SQ",name:"CodingSchemeIdentificationSequence",vm:"1",version:"DICOM"},"(0008,0112)":{tag:"(0008,0112)",vr:"LO",name:"CodingSchemeRegistry",vm:"1",version:"DICOM"},"(0008,0114)":{tag:"(0008,0114)",vr:"ST",name:"CodingSchemeExternalID",vm:"1",version:"DICOM"},"(0008,0115)":{tag:"(0008,0115)",vr:"ST",name:"CodingSchemeName",vm:"1",version:"DICOM"},"(0008,0116)":{tag:"(0008,0116)",vr:"ST",name:"CodingSchemeResponsibleOrganization",vm:"1",version:"DICOM"},"(0008,0117)":{tag:"(0008,0117)",vr:"UI",name:"ContextUID",vm:"1",version:"DICOM"},"(0008,0118)":{tag:"(0008,0118)",vr:"UI",name:"MappingResourceUID",vm:"1",version:"DICOM"},"(0008,0119)":{tag:"(0008,0119)",vr:"UC",name:"LongCodeValue",vm:"1",version:"DICOM"},"(0008,0120)":{tag:"(0008,0120)",vr:"UR",name:"URNCodeValue",vm:"1",version:"DICOM"},"(0008,0121)":{tag:"(0008,0121)",vr:"SQ",name:"EquivalentCodeSequence",vm:"1",version:"DICOM"},"(0008,0201)":{tag:"(0008,0201)",vr:"SH",name:"TimezoneOffsetFromUTC",vm:"1",version:"DICOM"},"(0008,0300)":{tag:"(0008,0300)",vr:"SQ",name:"PrivateDataElementCharacteristicsSequence",vm:"1",version:"DICOM"},"(0008,0301)":{tag:"(0008,0301)",vr:"US",name:"PrivateGroupReference",vm:"1",version:"DICOM"},"(0008,0302)":{tag:"(0008,0302)",vr:"LO",name:"PrivateCreatorReference",vm:"1",version:"DICOM"},"(0008,0303)":{tag:"(0008,0303)",vr:"CS",name:"BlockIdentifyingInformationStatus",vm:"1",version:"DICOM"},"(0008,0304)":{tag:"(0008,0304)",vr:"US",name:"NonidentifyingPrivateElements",vm:"1-n",version:"DICOM"},"(0008,0305)":{tag:"(0008,0305)",vr:"SQ",name:"DeidentificationActionSequence",vm:"1",version:"DICOM"},"(0008,0306)":{tag:"(0008,0306)",vr:"US",name:"IdentifyingPrivateElements",vm:"1-n",version:"DICOM"},"(0008,0307)":{tag:"(0008,0307)",vr:"CS",name:"DeidentificationAction",vm:"1",version:"DICOM"},"(0008,1010)":{tag:"(0008,1010)",vr:"SH",name:"StationName",vm:"1",version:"DICOM"},"(0008,1030)":{tag:"(0008,1030)",vr:"LO",name:"StudyDescription",vm:"1",version:"DICOM"},"(0008,1032)":{tag:"(0008,1032)",vr:"SQ",name:"ProcedureCodeSequence",vm:"1",version:"DICOM"},"(0008,103E)":{tag:"(0008,103E)",vr:"LO",name:"SeriesDescription",vm:"1",version:"DICOM"},"(0008,103F)":{tag:"(0008,103F)",vr:"SQ",name:"SeriesDescriptionCodeSequence",vm:"1",version:"DICOM"},"(0008,1040)":{tag:"(0008,1040)",vr:"LO",name:"InstitutionalDepartmentName",vm:"1",version:"DICOM"},"(0008,1048)":{tag:"(0008,1048)",vr:"PN",name:"PhysiciansOfRecord",vm:"1-n",version:"DICOM"},"(0008,1049)":{tag:"(0008,1049)",vr:"SQ",name:"PhysiciansOfRecordIdentificationSequence",vm:"1",version:"DICOM"},"(0008,1050)":{tag:"(0008,1050)",vr:"PN",name:"PerformingPhysicianName",vm:"1-n",version:"DICOM"},"(0008,1052)":{tag:"(0008,1052)",vr:"SQ",name:"PerformingPhysicianIdentificationSequence",vm:"1",version:"DICOM"},"(0008,1060)":{tag:"(0008,1060)",vr:"PN",name:"NameOfPhysiciansReadingStudy",vm:"1-n",version:"DICOM"},"(0008,1062)":{tag:"(0008,1062)",vr:"SQ",name:"PhysiciansReadingStudyIdentificationSequence",vm:"1",version:"DICOM"},"(0008,1070)":{tag:"(0008,1070)",vr:"PN",name:"OperatorsName",vm:"1-n",version:"DICOM"},"(0008,1072)":{tag:"(0008,1072)",vr:"SQ",name:"OperatorIdentificationSequence",vm:"1",version:"DICOM"},"(0008,1080)":{tag:"(0008,1080)",vr:"LO",name:"AdmittingDiagnosesDescription",vm:"1-n",version:"DICOM"},"(0008,1084)":{tag:"(0008,1084)",vr:"SQ",name:"AdmittingDiagnosesCodeSequence",vm:"1",version:"DICOM"},"(0008,1090)":{tag:"(0008,1090)",vr:"LO",name:"ManufacturerModelName",vm:"1",version:"DICOM"},"(0008,1110)":{tag:"(0008,1110)",vr:"SQ",name:"ReferencedStudySequence",vm:"1",version:"DICOM"},"(0008,1111)":{tag:"(0008,1111)",vr:"SQ",name:"ReferencedPerformedProcedureStepSequence",vm:"1",version:"DICOM"},"(0008,1115)":{tag:"(0008,1115)",vr:"SQ",name:"ReferencedSeriesSequence",vm:"1",version:"DICOM"},"(0008,1120)":{tag:"(0008,1120)",vr:"SQ",name:"ReferencedPatientSequence",vm:"1",version:"DICOM"},"(0008,1125)":{tag:"(0008,1125)",vr:"SQ",name:"ReferencedVisitSequence",vm:"1",version:"DICOM"},"(0008,1134)":{tag:"(0008,1134)",vr:"SQ",name:"ReferencedStereometricInstanceSequence",vm:"1",version:"DICOM"},"(0008,113A)":{tag:"(0008,113A)",vr:"SQ",name:"ReferencedWaveformSequence",vm:"1",version:"DICOM"},"(0008,1140)":{tag:"(0008,1140)",vr:"SQ",name:"ReferencedImageSequence",vm:"1",version:"DICOM"},"(0008,114A)":{tag:"(0008,114A)",vr:"SQ",name:"ReferencedInstanceSequence",vm:"1",version:"DICOM"},"(0008,114B)":{tag:"(0008,114B)",vr:"SQ",name:"ReferencedRealWorldValueMappingInstanceSequence",vm:"1",version:"DICOM"},"(0008,1150)":{tag:"(0008,1150)",vr:"UI",name:"ReferencedSOPClassUID",vm:"1",version:"DICOM"},"(0008,1155)":{tag:"(0008,1155)",vr:"UI",name:"ReferencedSOPInstanceUID",vm:"1",version:"DICOM"},"(0008,115A)":{tag:"(0008,115A)",vr:"UI",name:"SOPClassesSupported",vm:"1-n",version:"DICOM"},"(0008,1160)":{tag:"(0008,1160)",vr:"IS",name:"ReferencedFrameNumber",vm:"1-n",version:"DICOM"},"(0008,1161)":{tag:"(0008,1161)",vr:"UL",name:"SimpleFrameList",vm:"1-n",version:"DICOM"},"(0008,1162)":{tag:"(0008,1162)",vr:"UL",name:"CalculatedFrameList",vm:"3-3n",version:"DICOM"},"(0008,1163)":{tag:"(0008,1163)",vr:"FD",name:"TimeRange",vm:"2",version:"DICOM"},"(0008,1164)":{tag:"(0008,1164)",vr:"SQ",name:"FrameExtractionSequence",vm:"1",version:"DICOM"},"(0008,1167)":{tag:"(0008,1167)",vr:"UI",name:"MultiFrameSourceSOPInstanceUID",vm:"1",version:"DICOM"},"(0008,1190)":{tag:"(0008,1190)",vr:"UR",name:"RetrieveURL",vm:"1",version:"DICOM"},"(0008,1195)":{tag:"(0008,1195)",vr:"UI",name:"TransactionUID",vm:"1",version:"DICOM"},"(0008,1196)":{tag:"(0008,1196)",vr:"US",name:"WarningReason",vm:"1",version:"DICOM"},"(0008,1197)":{tag:"(0008,1197)",vr:"US",name:"FailureReason",vm:"1",version:"DICOM"},"(0008,1198)":{tag:"(0008,1198)",vr:"SQ",name:"FailedSOPSequence",vm:"1",version:"DICOM"},"(0008,1199)":{tag:"(0008,1199)",vr:"SQ",name:"ReferencedSOPSequence",vm:"1",version:"DICOM"},"(0008,1200)":{tag:"(0008,1200)",vr:"SQ",name:"StudiesContainingOtherReferencedInstancesSequence",vm:"1",version:"DICOM"},"(0008,1250)":{tag:"(0008,1250)",vr:"SQ",name:"RelatedSeriesSequence",vm:"1",version:"DICOM"},"(0008,2111)":{tag:"(0008,2111)",vr:"ST",name:"DerivationDescription",vm:"1",version:"DICOM"},"(0008,2112)":{tag:"(0008,2112)",vr:"SQ",name:"SourceImageSequence",vm:"1",version:"DICOM"},"(0008,2120)":{tag:"(0008,2120)",vr:"SH",name:"StageName",vm:"1",version:"DICOM"},"(0008,2122)":{tag:"(0008,2122)",vr:"IS",name:"StageNumber",vm:"1",version:"DICOM"},"(0008,2124)":{tag:"(0008,2124)",vr:"IS",name:"NumberOfStages",vm:"1",version:"DICOM"},"(0008,2127)":{tag:"(0008,2127)",vr:"SH",name:"ViewName",vm:"1",version:"DICOM"},"(0008,2128)":{tag:"(0008,2128)",vr:"IS",name:"ViewNumber",vm:"1",version:"DICOM"},"(0008,2129)":{tag:"(0008,2129)",vr:"IS",name:"NumberOfEventTimers",vm:"1",version:"DICOM"},"(0008,212A)":{tag:"(0008,212A)",vr:"IS",name:"NumberOfViewsInStage",vm:"1",version:"DICOM"},"(0008,2130)":{tag:"(0008,2130)",vr:"DS",name:"EventElapsedTimes",vm:"1-n",version:"DICOM"},"(0008,2132)":{tag:"(0008,2132)",vr:"LO",name:"EventTimerNames",vm:"1-n",version:"DICOM"},"(0008,2133)":{tag:"(0008,2133)",vr:"SQ",name:"EventTimerSequence",vm:"1",version:"DICOM"},"(0008,2134)":{tag:"(0008,2134)",vr:"FD",name:"EventTimeOffset",vm:"1",version:"DICOM"},"(0008,2135)":{tag:"(0008,2135)",vr:"SQ",name:"EventCodeSequence",vm:"1",version:"DICOM"},"(0008,2142)":{tag:"(0008,2142)",vr:"IS",name:"StartTrim",vm:"1",version:"DICOM"},"(0008,2143)":{tag:"(0008,2143)",vr:"IS",name:"StopTrim",vm:"1",version:"DICOM"},"(0008,2144)":{tag:"(0008,2144)",vr:"IS",name:"RecommendedDisplayFrameRate",vm:"1",version:"DICOM"},"(0008,2218)":{tag:"(0008,2218)",vr:"SQ",name:"AnatomicRegionSequence",vm:"1",version:"DICOM"},"(0008,2220)":{tag:"(0008,2220)",vr:"SQ",name:"AnatomicRegionModifierSequence",vm:"1",version:"DICOM"},"(0008,2228)":{tag:"(0008,2228)",vr:"SQ",name:"PrimaryAnatomicStructureSequence",vm:"1",version:"DICOM"},"(0008,2229)":{tag:"(0008,2229)",vr:"SQ",name:"AnatomicStructureSpaceOrRegionSequence",vm:"1",version:"DICOM"},"(0008,2230)":{tag:"(0008,2230)",vr:"SQ",name:"PrimaryAnatomicStructureModifierSequence",vm:"1",version:"DICOM"},"(0008,3001)":{tag:"(0008,3001)",vr:"SQ",name:"AlternateRepresentationSequence",vm:"1",version:"DICOM"},"(0008,3010)":{tag:"(0008,3010)",vr:"UI",name:"IrradiationEventUID",vm:"1-n",version:"DICOM"},"(0008,3011)":{tag:"(0008,3011)",vr:"SQ",name:"SourceIrradiationEventSequence",vm:"1",version:"DICOM"},"(0008,3012)":{tag:"(0008,3012)",vr:"UI",name:"RadiopharmaceuticalAdministrationEventUID",vm:"1",version:"DICOM"},"(0008,9007)":{tag:"(0008,9007)",vr:"CS",name:"FrameType",vm:"4",version:"DICOM"},"(0008,9092)":{tag:"(0008,9092)",vr:"SQ",name:"ReferencedImageEvidenceSequence",vm:"1",version:"DICOM"},"(0008,9121)":{tag:"(0008,9121)",vr:"SQ",name:"ReferencedRawDataSequence",vm:"1",version:"DICOM"},"(0008,9123)":{tag:"(0008,9123)",vr:"UI",name:"CreatorVersionUID",vm:"1",version:"DICOM"},"(0008,9124)":{tag:"(0008,9124)",vr:"SQ",name:"DerivationImageSequence",vm:"1",version:"DICOM"},"(0008,9154)":{tag:"(0008,9154)",vr:"SQ",name:"SourceImageEvidenceSequence",vm:"1",version:"DICOM"},"(0008,9205)":{tag:"(0008,9205)",vr:"CS",name:"PixelPresentation",vm:"1",version:"DICOM"},"(0008,9206)":{tag:"(0008,9206)",vr:"CS",name:"VolumetricProperties",vm:"1",version:"DICOM"},"(0008,9207)":{tag:"(0008,9207)",vr:"CS",name:"VolumeBasedCalculationTechnique",vm:"1",version:"DICOM"},"(0008,9208)":{tag:"(0008,9208)",vr:"CS",name:"ComplexImageComponent",vm:"1",version:"DICOM"},"(0008,9209)":{tag:"(0008,9209)",vr:"CS",name:"AcquisitionContrast",vm:"1",version:"DICOM"},"(0008,9215)":{tag:"(0008,9215)",vr:"SQ",name:"DerivationCodeSequence",vm:"1",version:"DICOM"},"(0008,9237)":{tag:"(0008,9237)",vr:"SQ",name:"ReferencedPresentationStateSequence",vm:"1",version:"DICOM"},"(0008,9410)":{tag:"(0008,9410)",vr:"SQ",name:"ReferencedOtherPlaneSequence",vm:"1",version:"DICOM"},"(0008,9458)":{tag:"(0008,9458)",vr:"SQ",name:"FrameDisplaySequence",vm:"1",version:"DICOM"},"(0008,9459)":{tag:"(0008,9459)",vr:"FL",name:"RecommendedDisplayFrameRateInFloat",vm:"1",version:"DICOM"},"(0008,9460)":{tag:"(0008,9460)",vr:"CS",name:"SkipFrameRangeFlag",vm:"1",version:"DICOM"},"(0010,0010)":{tag:"(0010,0010)",vr:"PN",name:"PatientName",vm:"1",version:"DICOM"},"(0010,0020)":{tag:"(0010,0020)",vr:"LO",name:"PatientID",vm:"1",version:"DICOM"},"(0010,0021)":{tag:"(0010,0021)",vr:"LO",name:"IssuerOfPatientID",vm:"1",version:"DICOM"},"(0010,0022)":{tag:"(0010,0022)",vr:"CS",name:"TypeOfPatientID",vm:"1",version:"DICOM"},"(0010,0024)":{tag:"(0010,0024)",vr:"SQ",name:"IssuerOfPatientIDQualifiersSequence",vm:"1",version:"DICOM"},"(0010,0030)":{tag:"(0010,0030)",vr:"DA",name:"PatientBirthDate",vm:"1",version:"DICOM"},"(0010,0032)":{tag:"(0010,0032)",vr:"TM",name:"PatientBirthTime",vm:"1",version:"DICOM"},"(0010,0040)":{tag:"(0010,0040)",vr:"CS",name:"PatientSex",vm:"1",version:"DICOM"},"(0010,0050)":{tag:"(0010,0050)",vr:"SQ",name:"PatientInsurancePlanCodeSequence",vm:"1",version:"DICOM"},"(0010,0101)":{tag:"(0010,0101)",vr:"SQ",name:"PatientPrimaryLanguageCodeSequence",vm:"1",version:"DICOM"},"(0010,0102)":{tag:"(0010,0102)",vr:"SQ",name:"PatientPrimaryLanguageModifierCodeSequence",vm:"1",version:"DICOM"},"(0010,0200)":{tag:"(0010,0200)",vr:"CS",name:"QualityControlSubject",vm:"1",version:"DICOM"},"(0010,0201)":{tag:"(0010,0201)",vr:"SQ",name:"QualityControlSubjectTypeCodeSequence",vm:"1",version:"DICOM"},"(0010,1000)":{tag:"(0010,1000)",vr:"LO",name:"OtherPatientIDs",vm:"1-n",version:"DICOM"},"(0010,1001)":{tag:"(0010,1001)",vr:"PN",name:"OtherPatientNames",vm:"1-n",version:"DICOM"},"(0010,1002)":{tag:"(0010,1002)",vr:"SQ",name:"OtherPatientIDsSequence",vm:"1",version:"DICOM"},"(0010,1005)":{tag:"(0010,1005)",vr:"PN",name:"PatientBirthName",vm:"1",version:"DICOM"},"(0010,1010)":{tag:"(0010,1010)",vr:"AS",name:"PatientAge",vm:"1",version:"DICOM"},"(0010,1020)":{tag:"(0010,1020)",vr:"DS",name:"PatientSize",vm:"1",version:"DICOM"},"(0010,1021)":{tag:"(0010,1021)",vr:"SQ",name:"PatientSizeCodeSequence",vm:"1",version:"DICOM"},"(0010,1030)":{tag:"(0010,1030)",vr:"DS",name:"PatientWeight",vm:"1",version:"DICOM"},"(0010,1040)":{tag:"(0010,1040)",vr:"LO",name:"PatientAddress",vm:"1",version:"DICOM"},"(0010,1060)":{tag:"(0010,1060)",vr:"PN",name:"PatientMotherBirthName",vm:"1",version:"DICOM"},"(0010,1080)":{tag:"(0010,1080)",vr:"LO",name:"MilitaryRank",vm:"1",version:"DICOM"},"(0010,1081)":{tag:"(0010,1081)",vr:"LO",name:"BranchOfService",vm:"1",version:"DICOM"},"(0010,1090)":{tag:"(0010,1090)",vr:"LO",name:"MedicalRecordLocator",vm:"1",version:"DICOM"},"(0010,1100)":{tag:"(0010,1100)",vr:"SQ",name:"ReferencedPatientPhotoSequence",vm:"1",version:"DICOM"},"(0010,2000)":{tag:"(0010,2000)",vr:"LO",name:"MedicalAlerts",vm:"1-n",version:"DICOM"},"(0010,2110)":{tag:"(0010,2110)",vr:"LO",name:"Allergies",vm:"1-n",version:"DICOM"},"(0010,2150)":{tag:"(0010,2150)",vr:"LO",name:"CountryOfResidence",vm:"1",version:"DICOM"},"(0010,2152)":{tag:"(0010,2152)",vr:"LO",name:"RegionOfResidence",vm:"1",version:"DICOM"},"(0010,2154)":{tag:"(0010,2154)",vr:"SH",name:"PatientTelephoneNumbers",vm:"1-n",version:"DICOM"},"(0010,2155)":{tag:"(0010,2155)",vr:"LT",name:"PatientTelecomInformation",vm:"1",version:"DICOM"},"(0010,2160)":{tag:"(0010,2160)",vr:"SH",name:"EthnicGroup",vm:"1",version:"DICOM"},"(0010,2180)":{tag:"(0010,2180)",vr:"SH",name:"Occupation",vm:"1",version:"DICOM"},"(0010,21A0)":{tag:"(0010,21A0)",vr:"CS",name:"SmokingStatus",vm:"1",version:"DICOM"},"(0010,21B0)":{tag:"(0010,21B0)",vr:"LT",name:"AdditionalPatientHistory",vm:"1",version:"DICOM"},"(0010,21C0)":{tag:"(0010,21C0)",vr:"US",name:"PregnancyStatus",vm:"1",version:"DICOM"},"(0010,21D0)":{tag:"(0010,21D0)",vr:"DA",name:"LastMenstrualDate",vm:"1",version:"DICOM"},"(0010,21F0)":{tag:"(0010,21F0)",vr:"LO",name:"PatientReligiousPreference",vm:"1",version:"DICOM"},"(0010,2201)":{tag:"(0010,2201)",vr:"LO",name:"PatientSpeciesDescription",vm:"1",version:"DICOM"},"(0010,2202)":{tag:"(0010,2202)",vr:"SQ",name:"PatientSpeciesCodeSequence",vm:"1",version:"DICOM"},"(0010,2203)":{tag:"(0010,2203)",vr:"CS",name:"PatientSexNeutered",vm:"1",version:"DICOM"},"(0010,2210)":{tag:"(0010,2210)",vr:"CS",name:"AnatomicalOrientationType",vm:"1",version:"DICOM"},"(0010,2292)":{tag:"(0010,2292)",vr:"LO",name:"PatientBreedDescription",vm:"1",version:"DICOM"},"(0010,2293)":{tag:"(0010,2293)",vr:"SQ",name:"PatientBreedCodeSequence",vm:"1",version:"DICOM"},"(0010,2294)":{tag:"(0010,2294)",vr:"SQ",name:"BreedRegistrationSequence",vm:"1",version:"DICOM"},"(0010,2295)":{tag:"(0010,2295)",vr:"LO",name:"BreedRegistrationNumber",vm:"1",version:"DICOM"},"(0010,2296)":{tag:"(0010,2296)",vr:"SQ",name:"BreedRegistryCodeSequence",vm:"1",version:"DICOM"},"(0010,2297)":{tag:"(0010,2297)",vr:"PN",name:"ResponsiblePerson",vm:"1",version:"DICOM"},"(0010,2298)":{tag:"(0010,2298)",vr:"CS",name:"ResponsiblePersonRole",vm:"1",version:"DICOM"},"(0010,2299)":{tag:"(0010,2299)",vr:"LO",name:"ResponsibleOrganization",vm:"1",version:"DICOM"},"(0010,4000)":{tag:"(0010,4000)",vr:"LT",name:"PatientComments",vm:"1",version:"DICOM"},"(0010,9431)":{tag:"(0010,9431)",vr:"FL",name:"ExaminedBodyThickness",vm:"1",version:"DICOM"},"(0012,0010)":{tag:"(0012,0010)",vr:"LO",name:"ClinicalTrialSponsorName",vm:"1",version:"DICOM"},"(0012,0020)":{tag:"(0012,0020)",vr:"LO",name:"ClinicalTrialProtocolID",vm:"1",version:"DICOM"},"(0012,0021)":{tag:"(0012,0021)",vr:"LO",name:"ClinicalTrialProtocolName",vm:"1",version:"DICOM"},"(0012,0030)":{tag:"(0012,0030)",vr:"LO",name:"ClinicalTrialSiteID",vm:"1",version:"DICOM"},"(0012,0031)":{tag:"(0012,0031)",vr:"LO",name:"ClinicalTrialSiteName",vm:"1",version:"DICOM"},"(0012,0040)":{tag:"(0012,0040)",vr:"LO",name:"ClinicalTrialSubjectID",vm:"1",version:"DICOM"},"(0012,0042)":{tag:"(0012,0042)",vr:"LO",name:"ClinicalTrialSubjectReadingID",vm:"1",version:"DICOM"},"(0012,0050)":{tag:"(0012,0050)",vr:"LO",name:"ClinicalTrialTimePointID",vm:"1",version:"DICOM"},"(0012,0051)":{tag:"(0012,0051)",vr:"ST",name:"ClinicalTrialTimePointDescription",vm:"1",version:"DICOM"},"(0012,0060)":{tag:"(0012,0060)",vr:"LO",name:"ClinicalTrialCoordinatingCenterName",vm:"1",version:"DICOM"},"(0012,0062)":{tag:"(0012,0062)",vr:"CS",name:"PatientIdentityRemoved",vm:"1",version:"DICOM"},"(0012,0063)":{tag:"(0012,0063)",vr:"LO",name:"DeidentificationMethod",vm:"1-n",version:"DICOM"},"(0012,0064)":{tag:"(0012,0064)",vr:"SQ",name:"DeidentificationMethodCodeSequence",vm:"1",version:"DICOM"},"(0012,0071)":{tag:"(0012,0071)",vr:"LO",name:"ClinicalTrialSeriesID",vm:"1",version:"DICOM"},"(0012,0072)":{tag:"(0012,0072)",vr:"LO",name:"ClinicalTrialSeriesDescription",vm:"1",version:"DICOM"},"(0012,0081)":{tag:"(0012,0081)",vr:"LO",name:"ClinicalTrialProtocolEthicsCommitteeName",vm:"1",version:"DICOM"},"(0012,0082)":{tag:"(0012,0082)",vr:"LO",name:"ClinicalTrialProtocolEthicsCommitteeApprovalNumber",vm:"1",version:"DICOM"},"(0012,0083)":{tag:"(0012,0083)",vr:"SQ",name:"ConsentForClinicalTrialUseSequence",vm:"1",version:"DICOM"},"(0012,0084)":{tag:"(0012,0084)",vr:"CS",name:"DistributionType",vm:"1",version:"DICOM"},"(0012,0085)":{tag:"(0012,0085)",vr:"CS",name:"ConsentForDistributionFlag",vm:"1",version:"DICOM"},"(0014,0025)":{tag:"(0014,0025)",vr:"ST",name:"ComponentManufacturingProcedure",vm:"1-n",version:"DICOM/DICONDE"},"(0014,0028)":{tag:"(0014,0028)",vr:"ST",name:"ComponentManufacturer",vm:"1-n",version:"DICOM/DICONDE"},"(0014,0030)":{tag:"(0014,0030)",vr:"DS",name:"MaterialThickness",vm:"1-n",version:"DICOM/DICONDE"},"(0014,0032)":{tag:"(0014,0032)",vr:"DS",name:"MaterialPipeDiameter",vm:"1-n",version:"DICOM/DICONDE"},"(0014,0034)":{tag:"(0014,0034)",vr:"DS",name:"MaterialIsolationDiameter",vm:"1-n",version:"DICOM/DICONDE"},"(0014,0042)":{tag:"(0014,0042)",vr:"ST",name:"MaterialGrade",vm:"1-n",version:"DICOM/DICONDE"},"(0014,0044)":{tag:"(0014,0044)",vr:"ST",name:"MaterialPropertiesDescription",vm:"1-n",version:"DICOM/DICONDE"},"(0014,0046)":{tag:"(0014,0046)",vr:"LT",name:"MaterialNotes",vm:"1",version:"DICOM/DICONDE"},"(0014,0050)":{tag:"(0014,0050)",vr:"CS",name:"ComponentShape",vm:"1",version:"DICOM/DICONDE"},"(0014,0052)":{tag:"(0014,0052)",vr:"CS",name:"CurvatureType",vm:"1",version:"DICOM/DICONDE"},"(0014,0054)":{tag:"(0014,0054)",vr:"DS",name:"OuterDiameter",vm:"1",version:"DICOM/DICONDE"},"(0014,0056)":{tag:"(0014,0056)",vr:"DS",name:"InnerDiameter",vm:"1",version:"DICOM/DICONDE"},"(0014,1010)":{tag:"(0014,1010)",vr:"ST",name:"ActualEnvironmentalConditions",vm:"1",version:"DICOM/DICONDE"},"(0014,1020)":{tag:"(0014,1020)",vr:"DA",name:"ExpiryDate",vm:"1",version:"DICOM/DICONDE"},"(0014,1040)":{tag:"(0014,1040)",vr:"ST",name:"EnvironmentalConditions",vm:"1",version:"DICOM/DICONDE"},"(0014,2002)":{tag:"(0014,2002)",vr:"SQ",name:"EvaluatorSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,2004)":{tag:"(0014,2004)",vr:"IS",name:"EvaluatorNumber",vm:"1",version:"DICOM/DICONDE"},"(0014,2006)":{tag:"(0014,2006)",vr:"PN",name:"EvaluatorName",vm:"1",version:"DICOM/DICONDE"},"(0014,2008)":{tag:"(0014,2008)",vr:"IS",name:"EvaluationAttempt",vm:"1",version:"DICOM/DICONDE"},"(0014,2012)":{tag:"(0014,2012)",vr:"SQ",name:"IndicationSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,2014)":{tag:"(0014,2014)",vr:"IS",name:"IndicationNumber",vm:"1",version:"DICOM/DICONDE"},"(0014,2016)":{tag:"(0014,2016)",vr:"SH",name:"IndicationLabel",vm:"1",version:"DICOM/DICONDE"},"(0014,2018)":{tag:"(0014,2018)",vr:"ST",name:"IndicationDescription",vm:"1",version:"DICOM/DICONDE"},"(0014,201A)":{tag:"(0014,201A)",vr:"CS",name:"IndicationType",vm:"1-n",version:"DICOM/DICONDE"},"(0014,201C)":{tag:"(0014,201C)",vr:"CS",name:"IndicationDisposition",vm:"1",version:"DICOM/DICONDE"},"(0014,201E)":{tag:"(0014,201E)",vr:"SQ",name:"IndicationROISequence",vm:"1",version:"DICOM/DICONDE"},"(0014,2030)":{tag:"(0014,2030)",vr:"SQ",name:"IndicationPhysicalPropertySequence",vm:"1",version:"DICOM/DICONDE"},"(0014,2032)":{tag:"(0014,2032)",vr:"SH",name:"PropertyLabel",vm:"1",version:"DICOM/DICONDE"},"(0014,2202)":{tag:"(0014,2202)",vr:"IS",name:"CoordinateSystemNumberOfAxes",vm:"1",version:"DICOM/DICONDE"},"(0014,2204)":{tag:"(0014,2204)",vr:"SQ",name:"CoordinateSystemAxesSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,2206)":{tag:"(0014,2206)",vr:"ST",name:"CoordinateSystemAxisDescription",vm:"1",version:"DICOM/DICONDE"},"(0014,2208)":{tag:"(0014,2208)",vr:"CS",name:"CoordinateSystemDataSetMapping",vm:"1",version:"DICOM/DICONDE"},"(0014,220A)":{tag:"(0014,220A)",vr:"IS",name:"CoordinateSystemAxisNumber",vm:"1",version:"DICOM/DICONDE"},"(0014,220C)":{tag:"(0014,220C)",vr:"CS",name:"CoordinateSystemAxisType",vm:"1",version:"DICOM/DICONDE"},"(0014,220E)":{tag:"(0014,220E)",vr:"CS",name:"CoordinateSystemAxisUnits",vm:"1",version:"DICOM/DICONDE"},"(0014,2210)":{tag:"(0014,2210)",vr:"OB",name:"CoordinateSystemAxisValues",vm:"1",version:"DICOM/DICONDE"},"(0014,2220)":{tag:"(0014,2220)",vr:"SQ",name:"CoordinateSystemTransformSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,2222)":{tag:"(0014,2222)",vr:"ST",name:"TransformDescription",vm:"1",version:"DICOM/DICONDE"},"(0014,2224)":{tag:"(0014,2224)",vr:"IS",name:"TransformNumberOfAxes",vm:"1",version:"DICOM/DICONDE"},"(0014,2226)":{tag:"(0014,2226)",vr:"IS",name:"TransformOrderOfAxes",vm:"1-n",version:"DICOM/DICONDE"},"(0014,2228)":{tag:"(0014,2228)",vr:"CS",name:"TransformedAxisUnits",vm:"1",version:"DICOM/DICONDE"},"(0014,222A)":{tag:"(0014,222A)",vr:"DS",name:"CoordinateSystemTransformRotationAndScaleMatrix",vm:"1-n",version:"DICOM/DICONDE"},"(0014,222C)":{tag:"(0014,222C)",vr:"DS",name:"CoordinateSystemTransformTranslationMatrix",vm:"1-n",version:"DICOM/DICONDE"},"(0014,3011)":{tag:"(0014,3011)",vr:"DS",name:"InternalDetectorFrameTime",vm:"1",version:"DICOM/DICONDE"},"(0014,3012)":{tag:"(0014,3012)",vr:"DS",name:"NumberOfFramesIntegrated",vm:"1",version:"DICOM/DICONDE"},"(0014,3020)":{tag:"(0014,3020)",vr:"SQ",name:"DetectorTemperatureSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,3022)":{tag:"(0014,3022)",vr:"ST",name:"SensorName",vm:"1",version:"DICOM/DICONDE"},"(0014,3024)":{tag:"(0014,3024)",vr:"DS",name:"HorizontalOffsetOfSensor",vm:"1",version:"DICOM/DICONDE"},"(0014,3026)":{tag:"(0014,3026)",vr:"DS",name:"VerticalOffsetOfSensor",vm:"1",version:"DICOM/DICONDE"},"(0014,3028)":{tag:"(0014,3028)",vr:"DS",name:"SensorTemperature",vm:"1",version:"DICOM/DICONDE"},"(0014,3040)":{tag:"(0014,3040)",vr:"SQ",name:"DarkCurrentSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,3050)":{tag:"(0014,3050)",vr:"ox",name:"DarkCurrentCounts",vm:"1",version:"DICOM/DICONDE"},"(0014,3060)":{tag:"(0014,3060)",vr:"SQ",name:"GainCorrectionReferenceSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,3070)":{tag:"(0014,3070)",vr:"ox",name:"AirCounts",vm:"1",version:"DICOM/DICONDE"},"(0014,3071)":{tag:"(0014,3071)",vr:"DS",name:"KVUsedInGainCalibration",vm:"1",version:"DICOM/DICONDE"},"(0014,3072)":{tag:"(0014,3072)",vr:"DS",name:"MAUsedInGainCalibration",vm:"1",version:"DICOM/DICONDE"},"(0014,3073)":{tag:"(0014,3073)",vr:"DS",name:"NumberOfFramesUsedForIntegration",vm:"1",version:"DICOM/DICONDE"},"(0014,3074)":{tag:"(0014,3074)",vr:"LO",name:"FilterMaterialUsedInGainCalibration",vm:"1",version:"DICOM/DICONDE"},"(0014,3075)":{tag:"(0014,3075)",vr:"DS",name:"FilterThicknessUsedInGainCalibration",vm:"1",version:"DICOM/DICONDE"},"(0014,3076)":{tag:"(0014,3076)",vr:"DA",name:"DateOfGainCalibration",vm:"1",version:"DICOM/DICONDE"},"(0014,3077)":{tag:"(0014,3077)",vr:"TM",name:"TimeOfGainCalibration",vm:"1",version:"DICOM/DICONDE"},"(0014,3080)":{tag:"(0014,3080)",vr:"OB",name:"BadPixelImage",vm:"1",version:"DICOM/DICONDE"},"(0014,3099)":{tag:"(0014,3099)",vr:"LT",name:"CalibrationNotes",vm:"1",version:"DICOM/DICONDE"},"(0014,4002)":{tag:"(0014,4002)",vr:"SQ",name:"PulserEquipmentSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4004)":{tag:"(0014,4004)",vr:"CS",name:"PulserType",vm:"1",version:"DICOM/DICONDE"},"(0014,4006)":{tag:"(0014,4006)",vr:"LT",name:"PulserNotes",vm:"1",version:"DICOM/DICONDE"},"(0014,4008)":{tag:"(0014,4008)",vr:"SQ",name:"ReceiverEquipmentSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,400A)":{tag:"(0014,400A)",vr:"CS",name:"AmplifierType",vm:"1",version:"DICOM/DICONDE"},"(0014,400C)":{tag:"(0014,400C)",vr:"LT",name:"ReceiverNotes",vm:"1",version:"DICOM/DICONDE"},"(0014,400E)":{tag:"(0014,400E)",vr:"SQ",name:"PreAmplifierEquipmentSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,400F)":{tag:"(0014,400F)",vr:"LT",name:"PreAmplifierNotes",vm:"1",version:"DICOM/DICONDE"},"(0014,4010)":{tag:"(0014,4010)",vr:"SQ",name:"TransmitTransducerSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4011)":{tag:"(0014,4011)",vr:"SQ",name:"ReceiveTransducerSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4012)":{tag:"(0014,4012)",vr:"US",name:"NumberOfElements",vm:"1",version:"DICOM/DICONDE"},"(0014,4013)":{tag:"(0014,4013)",vr:"CS",name:"ElementShape",vm:"1",version:"DICOM/DICONDE"},"(0014,4014)":{tag:"(0014,4014)",vr:"DS",name:"ElementDimensionA",vm:"1",version:"DICOM/DICONDE"},"(0014,4015)":{tag:"(0014,4015)",vr:"DS",name:"ElementDimensionB",vm:"1",version:"DICOM/DICONDE"},"(0014,4016)":{tag:"(0014,4016)",vr:"DS",name:"ElementPitchA",vm:"1",version:"DICOM/DICONDE"},"(0014,4017)":{tag:"(0014,4017)",vr:"DS",name:"MeasuredBeamDimensionA",vm:"1",version:"DICOM/DICONDE"},"(0014,4018)":{tag:"(0014,4018)",vr:"DS",name:"MeasuredBeamDimensionB",vm:"1",version:"DICOM/DICONDE"},"(0014,4019)":{tag:"(0014,4019)",vr:"DS",name:"LocationOfMeasuredBeamDiameter",vm:"1",version:"DICOM/DICONDE"},"(0014,401A)":{tag:"(0014,401A)",vr:"DS",name:"NominalFrequency",vm:"1",version:"DICOM/DICONDE"},"(0014,401B)":{tag:"(0014,401B)",vr:"DS",name:"MeasuredCenterFrequency",vm:"1",version:"DICOM/DICONDE"},"(0014,401C)":{tag:"(0014,401C)",vr:"DS",name:"MeasuredBandwidth",vm:"1",version:"DICOM/DICONDE"},"(0014,401D)":{tag:"(0014,401D)",vr:"DS",name:"ElementPitchB",vm:"1",version:"DICOM/DICONDE"},"(0014,4020)":{tag:"(0014,4020)",vr:"SQ",name:"PulserSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4022)":{tag:"(0014,4022)",vr:"DS",name:"PulseWidth",vm:"1",version:"DICOM/DICONDE"},"(0014,4024)":{tag:"(0014,4024)",vr:"DS",name:"ExcitationFrequency",vm:"1",version:"DICOM/DICONDE"},"(0014,4026)":{tag:"(0014,4026)",vr:"CS",name:"ModulationType",vm:"1",version:"DICOM/DICONDE"},"(0014,4028)":{tag:"(0014,4028)",vr:"DS",name:"Damping",vm:"1",version:"DICOM/DICONDE"},"(0014,4030)":{tag:"(0014,4030)",vr:"SQ",name:"ReceiverSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4031)":{tag:"(0014,4031)",vr:"DS",name:"AcquiredSoundpathLength",vm:"1",version:"DICOM/DICONDE"},"(0014,4032)":{tag:"(0014,4032)",vr:"CS",name:"AcquisitionCompressionType",vm:"1",version:"DICOM/DICONDE"},"(0014,4033)":{tag:"(0014,4033)",vr:"IS",name:"AcquisitionSampleSize",vm:"1",version:"DICOM/DICONDE"},"(0014,4034)":{tag:"(0014,4034)",vr:"DS",name:"RectifierSmoothing",vm:"1",version:"DICOM/DICONDE"},"(0014,4035)":{tag:"(0014,4035)",vr:"SQ",name:"DACSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4036)":{tag:"(0014,4036)",vr:"CS",name:"DACType",vm:"1",version:"DICOM/DICONDE"},"(0014,4038)":{tag:"(0014,4038)",vr:"DS",name:"DACGainPoints",vm:"1-n",version:"DICOM/DICONDE"},"(0014,403A)":{tag:"(0014,403A)",vr:"DS",name:"DACTimePoints",vm:"1-n",version:"DICOM/DICONDE"},"(0014,403C)":{tag:"(0014,403C)",vr:"DS",name:"DACAmplitude",vm:"1-n",version:"DICOM/DICONDE"},"(0014,4040)":{tag:"(0014,4040)",vr:"SQ",name:"PreAmplifierSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4050)":{tag:"(0014,4050)",vr:"SQ",name:"TransmitTransducerSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4051)":{tag:"(0014,4051)",vr:"SQ",name:"ReceiveTransducerSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4052)":{tag:"(0014,4052)",vr:"DS",name:"IncidentAngle",vm:"1",version:"DICOM/DICONDE"},"(0014,4054)":{tag:"(0014,4054)",vr:"ST",name:"CouplingTechnique",vm:"1",version:"DICOM/DICONDE"},"(0014,4056)":{tag:"(0014,4056)",vr:"ST",name:"CouplingMedium",vm:"1",version:"DICOM/DICONDE"},"(0014,4057)":{tag:"(0014,4057)",vr:"DS",name:"CouplingVelocity",vm:"1",version:"DICOM/DICONDE"},"(0014,4058)":{tag:"(0014,4058)",vr:"DS",name:"ProbeCenterLocationX",vm:"1",version:"DICOM/DICONDE"},"(0014,4059)":{tag:"(0014,4059)",vr:"DS",name:"ProbeCenterLocationZ",vm:"1",version:"DICOM/DICONDE"},"(0014,405A)":{tag:"(0014,405A)",vr:"DS",name:"SoundPathLength",vm:"1",version:"DICOM/DICONDE"},"(0014,405C)":{tag:"(0014,405C)",vr:"ST",name:"DelayLawIdentifier",vm:"1",version:"DICOM/DICONDE"},"(0014,4060)":{tag:"(0014,4060)",vr:"SQ",name:"GateSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4062)":{tag:"(0014,4062)",vr:"DS",name:"GateThreshold",vm:"1",version:"DICOM/DICONDE"},"(0014,4064)":{tag:"(0014,4064)",vr:"DS",name:"VelocityOfSound",vm:"1",version:"DICOM/DICONDE"},"(0014,4070)":{tag:"(0014,4070)",vr:"SQ",name:"CalibrationSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4072)":{tag:"(0014,4072)",vr:"ST",name:"CalibrationProcedure",vm:"1",version:"DICOM/DICONDE"},"(0014,4074)":{tag:"(0014,4074)",vr:"SH",name:"ProcedureVersion",vm:"1",version:"DICOM/DICONDE"},"(0014,4076)":{tag:"(0014,4076)",vr:"DA",name:"ProcedureCreationDate",vm:"1",version:"DICOM/DICONDE"},"(0014,4078)":{tag:"(0014,4078)",vr:"DA",name:"ProcedureExpirationDate",vm:"1",version:"DICOM/DICONDE"},"(0014,407A)":{tag:"(0014,407A)",vr:"DA",name:"ProcedureLastModifiedDate",vm:"1",version:"DICOM/DICONDE"},"(0014,407C)":{tag:"(0014,407C)",vr:"TM",name:"CalibrationTime",vm:"1-n",version:"DICOM/DICONDE"},"(0014,407E)":{tag:"(0014,407E)",vr:"DA",name:"CalibrationDate",vm:"1-n",version:"DICOM/DICONDE"},"(0014,4080)":{tag:"(0014,4080)",vr:"SQ",name:"ProbeDriveEquipmentSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4081)":{tag:"(0014,4081)",vr:"CS",name:"DriveType",vm:"1",version:"DICOM/DICONDE"},"(0014,4082)":{tag:"(0014,4082)",vr:"LT",name:"ProbeDriveNotes",vm:"1",version:"DICOM/DICONDE"},"(0014,4083)":{tag:"(0014,4083)",vr:"SQ",name:"DriveProbeSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4084)":{tag:"(0014,4084)",vr:"DS",name:"ProbeInductance",vm:"1",version:"DICOM/DICONDE"},"(0014,4085)":{tag:"(0014,4085)",vr:"DS",name:"ProbeResistance",vm:"1",version:"DICOM/DICONDE"},"(0014,4086)":{tag:"(0014,4086)",vr:"SQ",name:"ReceiveProbeSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4087)":{tag:"(0014,4087)",vr:"SQ",name:"ProbeDriveSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4088)":{tag:"(0014,4088)",vr:"DS",name:"BridgeResistors",vm:"1",version:"DICOM/DICONDE"},"(0014,4089)":{tag:"(0014,4089)",vr:"DS",name:"ProbeOrientationAngle",vm:"1",version:"DICOM/DICONDE"},"(0014,408B)":{tag:"(0014,408B)",vr:"DS",name:"UserSelectedGainY",vm:"1",version:"DICOM/DICONDE"},"(0014,408C)":{tag:"(0014,408C)",vr:"DS",name:"UserSelectedPhase",vm:"1",version:"DICOM/DICONDE"},"(0014,408D)":{tag:"(0014,408D)",vr:"DS",name:"UserSelectedOffsetX",vm:"1",version:"DICOM/DICONDE"},"(0014,408E)":{tag:"(0014,408E)",vr:"DS",name:"UserSelectedOffsetY",vm:"1",version:"DICOM/DICONDE"},"(0014,4091)":{tag:"(0014,4091)",vr:"SQ",name:"ChannelSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,4092)":{tag:"(0014,4092)",vr:"DS",name:"ChannelThreshold",vm:"1",version:"DICOM/DICONDE"},"(0014,409A)":{tag:"(0014,409A)",vr:"SQ",name:"ScannerSettingsSequence",vm:"1",version:"DICOM/DICONDE"},"(0014,409B)":{tag:"(0014,409B)",vr:"ST",name:"ScanProcedure",vm:"1",version:"DICOM/DICONDE"},"(0014,409C)":{tag:"(0014,409C)",vr:"DS",name:"TranslationRateX",vm:"1",version:"DICOM/DICONDE"},"(0014,409D)":{tag:"(0014,409D)",vr:"DS",name:"TranslationRateY",vm:"1",version:"DICOM/DICONDE"},"(0014,409F)":{tag:"(0014,409F)",vr:"DS",name:"ChannelOverlap",vm:"1",version:"DICOM/DICONDE"},"(0014,40A0)":{tag:"(0014,40A0)",vr:"LO",name:"ImageQualityIndicatorType",vm:"1",version:"DICOM/DICONDE"},"(0014,40A1)":{tag:"(0014,40A1)",vr:"LO",name:"ImageQualityIndicatorMaterial",vm:"1",version:"DICOM/DICONDE"},"(0014,40A2)":{tag:"(0014,40A2)",vr:"LO",name:"ImageQualityIndicatorSize",vm:"1",version:"DICOM/DICONDE"},"(0014,5002)":{tag:"(0014,5002)",vr:"IS",name:"LINACEnergy",vm:"1",version:"DICOM/DICONDE"},"(0014,5004)":{tag:"(0014,5004)",vr:"IS",name:"LINACOutput",vm:"1",version:"DICOM/DICONDE"},"(0014,5100)":{tag:"(0014,5100)",vr:"US",name:"ActiveAperture",vm:"1",version:"DICOM/DICONDE"},"(0014,5101)":{tag:"(0014,5101)",vr:"DS",name:"TotalAperture",vm:"1",version:"DICOM/DICONDE"},"(0014,5102)":{tag:"(0014,5102)",vr:"DS",name:"ApertureElevation",vm:"1",version:"DICOM/DICONDE"},"(0014,5103)":{tag:"(0014,5103)",vr:"DS",name:"MainLobeAngle",vm:"1",version:"DICOM/DICONDE"},"(0014,5104)":{tag:"(0014,5104)",vr:"DS",name:"MainRoofAngle",vm:"1",version:"DICOM/DICONDE"},"(0014,5105)":{tag:"(0014,5105)",vr:"CS",name:"ConnectorType",vm:"1",version:"DICOM/DICONDE"},"(0014,5106)":{tag:"(0014,5106)",vr:"SH",name:"WedgeModelNumber",vm:"1",version:"DICOM/DICONDE"},"(0014,5107)":{tag:"(0014,5107)",vr:"DS",name:"WedgeAngleFloat",vm:"1",version:"DICOM/DICONDE"},"(0014,5108)":{tag:"(0014,5108)",vr:"DS",name:"WedgeRoofAngle",vm:"1",version:"DICOM/DICONDE"},"(0014,5109)":{tag:"(0014,5109)",vr:"CS",name:"WedgeElement1Position",vm:"1",version:"DICOM/DICONDE"},"(0014,510A)":{tag:"(0014,510A)",vr:"DS",name:"WedgeMaterialVelocity",vm:"1",version:"DICOM/DICONDE"},"(0014,510B)":{tag:"(0014,510B)",vr:"SH",name:"WedgeMaterial",vm:"1",version:"DICOM/DICONDE"},"(0014,510C)":{tag:"(0014,510C)",vr:"DS",name:"WedgeOffsetZ",vm:"1",version:"DICOM/DICONDE"},"(0014,510D)":{tag:"(0014,510D)",vr:"DS",name:"WedgeOriginOffsetX",vm:"1",version:"DICOM/DICONDE"},"(0014,510E)":{tag:"(0014,510E)",vr:"DS",name:"WedgeTimeDelay",vm:"1",version:"DICOM/DICONDE"},"(0014,510F)":{tag:"(0014,510F)",vr:"SH",name:"WedgeName",vm:"1",version:"DICOM/DICONDE"},"(0014,5110)":{tag:"(0014,5110)",vr:"SH",name:"WedgeManufacturerName",vm:"1",version:"DICOM/DICONDE"},"(0014,5111)":{tag:"(0014,5111)",vr:"LO",name:"WedgeDescription",vm:"1",version:"DICOM/DICONDE"},"(0014,5112)":{tag:"(0014,5112)",vr:"DS",name:"NominalBeamAngle",vm:"1",version:"DICOM/DICONDE"},"(0014,5113)":{tag:"(0014,5113)",vr:"DS",name:"WedgeOffsetX",vm:"1",version:"DICOM/DICONDE"},"(0014,5114)":{tag:"(0014,5114)",vr:"DS",name:"WedgeOffsetY",vm:"1",version:"DICOM/DICONDE"},"(0014,5115)":{tag:"(0014,5115)",vr:"DS",name:"WedgeTotalLength",vm:"1",version:"DICOM/DICONDE"},"(0014,5116)":{tag:"(0014,5116)",vr:"DS",name:"WedgeInContactLength",vm:"1",version:"DICOM/DICONDE"},"(0014,5117)":{tag:"(0014,5117)",vr:"DS",name:"WedgeFrontGap",vm:"1",version:"DICOM/DICONDE"},"(0014,5118)":{tag:"(0014,5118)",vr:"DS",name:"WedgeTotalHeight",vm:"1",version:"DICOM/DICONDE"},"(0014,5119)":{tag:"(0014,5119)",vr:"DS",name:"WedgeFrontHeight",vm:"1",version:"DICOM/DICONDE"},"(0014,511A)":{tag:"(0014,511A)",vr:"DS",name:"WedgeRearHeight",vm:"1",version:"DICOM/DICONDE"},"(0014,511B)":{tag:"(0014,511B)",vr:"DS",name:"WedgeTotalWidth",vm:"1",version:"DICOM/DICONDE"},"(0014,511C)":{tag:"(0014,511C)",vr:"DS",name:"WedgeInContactWidth",vm:"1",version:"DICOM/DICONDE"},"(0014,511D)":{tag:"(0014,511D)",vr:"DS",name:"WedgeChamferHeight",vm:"1",version:"DICOM/DICONDE"},"(0014,511E)":{tag:"(0014,511E)",vr:"CS",name:"WedgeCurve",vm:"1",version:"DICOM/DICONDE"},"(0014,511F)":{tag:"(0014,511F)",vr:"DS",name:"RadiusAlongWedge",vm:"1",version:"DICOM/DICONDE"},"(0018,0010)":{tag:"(0018,0010)",vr:"LO",name:"ContrastBolusAgent",vm:"1",version:"DICOM"},"(0018,0012)":{tag:"(0018,0012)",vr:"SQ",name:"ContrastBolusAgentSequence",vm:"1",version:"DICOM"},"(0018,0013)":{tag:"(0018,0013)",vr:"FL",name:"ContrastBolusT1Relaxivity",vm:"1",version:"DICOM"},"(0018,0014)":{tag:"(0018,0014)",vr:"SQ",name:"ContrastBolusAdministrationRouteSequence",vm:"1",version:"DICOM"},"(0018,0015)":{tag:"(0018,0015)",vr:"CS",name:"BodyPartExamined",vm:"1",version:"DICOM"},"(0018,0020)":{tag:"(0018,0020)",vr:"CS",name:"ScanningSequence",vm:"1-n",version:"DICOM"},"(0018,0021)":{tag:"(0018,0021)",vr:"CS",name:"SequenceVariant",vm:"1-n",version:"DICOM"},"(0018,0022)":{tag:"(0018,0022)",vr:"CS",name:"ScanOptions",vm:"1-n",version:"DICOM"},"(0018,0023)":{tag:"(0018,0023)",vr:"CS",name:"MRAcquisitionType",vm:"1",version:"DICOM"},"(0018,0024)":{tag:"(0018,0024)",vr:"SH",name:"SequenceName",vm:"1",version:"DICOM"},"(0018,0025)":{tag:"(0018,0025)",vr:"CS",name:"AngioFlag",vm:"1",version:"DICOM"},"(0018,0026)":{tag:"(0018,0026)",vr:"SQ",name:"InterventionDrugInformationSequence",vm:"1",version:"DICOM"},"(0018,0027)":{tag:"(0018,0027)",vr:"TM",name:"InterventionDrugStopTime",vm:"1",version:"DICOM"},"(0018,0028)":{tag:"(0018,0028)",vr:"DS",name:"InterventionDrugDose",vm:"1",version:"DICOM"},"(0018,0029)":{tag:"(0018,0029)",vr:"SQ",name:"InterventionDrugCodeSequence",vm:"1",version:"DICOM"},"(0018,002A)":{tag:"(0018,002A)",vr:"SQ",name:"AdditionalDrugSequence",vm:"1",version:"DICOM"},"(0018,0031)":{tag:"(0018,0031)",vr:"LO",name:"Radiopharmaceutical",vm:"1",version:"DICOM"},"(0018,0034)":{tag:"(0018,0034)",vr:"LO",name:"InterventionDrugName",vm:"1",version:"DICOM"},"(0018,0035)":{tag:"(0018,0035)",vr:"TM",name:"InterventionDrugStartTime",vm:"1",version:"DICOM"},"(0018,0036)":{tag:"(0018,0036)",vr:"SQ",name:"InterventionSequence",vm:"1",version:"DICOM"},"(0018,0038)":{tag:"(0018,0038)",vr:"CS",name:"InterventionStatus",vm:"1",version:"DICOM"},"(0018,003A)":{tag:"(0018,003A)",vr:"ST",name:"InterventionDescription",vm:"1",version:"DICOM"},"(0018,0040)":{tag:"(0018,0040)",vr:"IS",name:"CineRate",vm:"1",version:"DICOM"},"(0018,0042)":{tag:"(0018,0042)",vr:"CS",name:"InitialCineRunState",vm:"1",version:"DICOM"},"(0018,0050)":{tag:"(0018,0050)",vr:"DS",name:"SliceThickness",vm:"1",version:"DICOM"},"(0018,0060)":{tag:"(0018,0060)",vr:"DS",name:"KVP",vm:"1",version:"DICOM"},"(0018,0070)":{tag:"(0018,0070)",vr:"IS",name:"CountsAccumulated",vm:"1",version:"DICOM"},"(0018,0071)":{tag:"(0018,0071)",vr:"CS",name:"AcquisitionTerminationCondition",vm:"1",version:"DICOM"},"(0018,0072)":{tag:"(0018,0072)",vr:"DS",name:"EffectiveDuration",vm:"1",version:"DICOM"},"(0018,0073)":{tag:"(0018,0073)",vr:"CS",name:"AcquisitionStartCondition",vm:"1",version:"DICOM"},"(0018,0074)":{tag:"(0018,0074)",vr:"IS",name:"AcquisitionStartConditionData",vm:"1",version:"DICOM"},"(0018,0075)":{tag:"(0018,0075)",vr:"IS",name:"AcquisitionTerminationConditionData",vm:"1",version:"DICOM"},"(0018,0080)":{tag:"(0018,0080)",vr:"DS",name:"RepetitionTime",vm:"1",version:"DICOM"},"(0018,0081)":{tag:"(0018,0081)",vr:"DS",name:"EchoTime",vm:"1",version:"DICOM"},"(0018,0082)":{tag:"(0018,0082)",vr:"DS",name:"InversionTime",vm:"1",version:"DICOM"},"(0018,0083)":{tag:"(0018,0083)",vr:"DS",name:"NumberOfAverages",vm:"1",version:"DICOM"},"(0018,0084)":{tag:"(0018,0084)",vr:"DS",name:"ImagingFrequency",vm:"1",version:"DICOM"},"(0018,0085)":{tag:"(0018,0085)",vr:"SH",name:"ImagedNucleus",vm:"1",version:"DICOM"},"(0018,0086)":{tag:"(0018,0086)",vr:"IS",name:"EchoNumbers",vm:"1-n",version:"DICOM"},"(0018,0087)":{tag:"(0018,0087)",vr:"DS",name:"MagneticFieldStrength",vm:"1",version:"DICOM"},"(0018,0088)":{tag:"(0018,0088)",vr:"DS",name:"SpacingBetweenSlices",vm:"1",version:"DICOM"},"(0018,0089)":{tag:"(0018,0089)",vr:"IS",name:"NumberOfPhaseEncodingSteps",vm:"1",version:"DICOM"},"(0018,0090)":{tag:"(0018,0090)",vr:"DS",name:"DataCollectionDiameter",vm:"1",version:"DICOM"},"(0018,0091)":{tag:"(0018,0091)",vr:"IS",name:"EchoTrainLength",vm:"1",version:"DICOM"},"(0018,0093)":{tag:"(0018,0093)",vr:"DS",name:"PercentSampling",vm:"1",version:"DICOM"},"(0018,0094)":{tag:"(0018,0094)",vr:"DS",name:"PercentPhaseFieldOfView",vm:"1",version:"DICOM"},"(0018,0095)":{tag:"(0018,0095)",vr:"DS",name:"PixelBandwidth",vm:"1",version:"DICOM"},"(0018,1000)":{tag:"(0018,1000)",vr:"LO",name:"DeviceSerialNumber",vm:"1",version:"DICOM"},"(0018,1002)":{tag:"(0018,1002)",vr:"UI",name:"DeviceUID",vm:"1",version:"DICOM"},"(0018,1003)":{tag:"(0018,1003)",vr:"LO",name:"DeviceID",vm:"1",version:"DICOM"},"(0018,1004)":{tag:"(0018,1004)",vr:"LO",name:"PlateID",vm:"1",version:"DICOM"},"(0018,1005)":{tag:"(0018,1005)",vr:"LO",name:"GeneratorID",vm:"1",version:"DICOM"},"(0018,1006)":{tag:"(0018,1006)",vr:"LO",name:"GridID",vm:"1",version:"DICOM"},"(0018,1007)":{tag:"(0018,1007)",vr:"LO",name:"CassetteID",vm:"1",version:"DICOM"},"(0018,1008)":{tag:"(0018,1008)",vr:"LO",name:"GantryID",vm:"1",version:"DICOM"},"(0018,1010)":{tag:"(0018,1010)",vr:"LO",name:"SecondaryCaptureDeviceID",vm:"1",version:"DICOM"},"(0018,1012)":{tag:"(0018,1012)",vr:"DA",name:"DateOfSecondaryCapture",vm:"1",version:"DICOM"},"(0018,1014)":{tag:"(0018,1014)",vr:"TM",name:"TimeOfSecondaryCapture",vm:"1",version:"DICOM"},"(0018,1016)":{tag:"(0018,1016)",vr:"LO",name:"SecondaryCaptureDeviceManufacturer",vm:"1",version:"DICOM"},"(0018,1018)":{tag:"(0018,1018)",vr:"LO",name:"SecondaryCaptureDeviceManufacturerModelName",vm:"1",version:"DICOM"},"(0018,1019)":{tag:"(0018,1019)",vr:"LO",name:"SecondaryCaptureDeviceSoftwareVersions",vm:"1-n",version:"DICOM"},"(0018,1020)":{tag:"(0018,1020)",vr:"LO",name:"SoftwareVersions",vm:"1-n",version:"DICOM"},"(0018,1022)":{tag:"(0018,1022)",vr:"SH",name:"VideoImageFormatAcquired",vm:"1",version:"DICOM"},"(0018,1023)":{tag:"(0018,1023)",vr:"LO",name:"DigitalImageFormatAcquired",vm:"1",version:"DICOM"},"(0018,1030)":{tag:"(0018,1030)",vr:"LO",name:"ProtocolName",vm:"1",version:"DICOM"},"(0018,1040)":{tag:"(0018,1040)",vr:"LO",name:"ContrastBolusRoute",vm:"1",version:"DICOM"},"(0018,1041)":{tag:"(0018,1041)",vr:"DS",name:"ContrastBolusVolume",vm:"1",version:"DICOM"},"(0018,1042)":{tag:"(0018,1042)",vr:"TM",name:"ContrastBolusStartTime",vm:"1",version:"DICOM"},"(0018,1043)":{tag:"(0018,1043)",vr:"TM",name:"ContrastBolusStopTime",vm:"1",version:"DICOM"},"(0018,1044)":{tag:"(0018,1044)",vr:"DS",name:"ContrastBolusTotalDose",vm:"1",version:"DICOM"},"(0018,1045)":{tag:"(0018,1045)",vr:"IS",name:"SyringeCounts",vm:"1",version:"DICOM"},"(0018,1046)":{tag:"(0018,1046)",vr:"DS",name:"ContrastFlowRate",vm:"1-n",version:"DICOM"},"(0018,1047)":{tag:"(0018,1047)",vr:"DS",name:"ContrastFlowDuration",vm:"1-n",version:"DICOM"},"(0018,1048)":{tag:"(0018,1048)",vr:"CS",name:"ContrastBolusIngredient",vm:"1",version:"DICOM"},"(0018,1049)":{tag:"(0018,1049)",vr:"DS",name:"ContrastBolusIngredientConcentration",vm:"1",version:"DICOM"},"(0018,1050)":{tag:"(0018,1050)",vr:"DS",name:"SpatialResolution",vm:"1",version:"DICOM"},"(0018,1060)":{tag:"(0018,1060)",vr:"DS",name:"TriggerTime",vm:"1",version:"DICOM"},"(0018,1061)":{tag:"(0018,1061)",vr:"LO",name:"TriggerSourceOrType",vm:"1",version:"DICOM"},"(0018,1062)":{tag:"(0018,1062)",vr:"IS",name:"NominalInterval",vm:"1",version:"DICOM"},"(0018,1063)":{tag:"(0018,1063)",vr:"DS",name:"FrameTime",vm:"1",version:"DICOM"},"(0018,1064)":{tag:"(0018,1064)",vr:"LO",name:"CardiacFramingType",vm:"1",version:"DICOM"},"(0018,1065)":{tag:"(0018,1065)",vr:"DS",name:"FrameTimeVector",vm:"1-n",version:"DICOM"},"(0018,1066)":{tag:"(0018,1066)",vr:"DS",name:"FrameDelay",vm:"1",version:"DICOM"},"(0018,1067)":{tag:"(0018,1067)",vr:"DS",name:"ImageTriggerDelay",vm:"1",version:"DICOM"},"(0018,1068)":{tag:"(0018,1068)",vr:"DS",name:"MultiplexGroupTimeOffset",vm:"1",version:"DICOM"},"(0018,1069)":{tag:"(0018,1069)",vr:"DS",name:"TriggerTimeOffset",vm:"1",version:"DICOM"},"(0018,106A)":{tag:"(0018,106A)",vr:"CS",name:"SynchronizationTrigger",vm:"1",version:"DICOM"},"(0018,106C)":{tag:"(0018,106C)",vr:"US",name:"SynchronizationChannel",vm:"2",version:"DICOM"},"(0018,106E)":{tag:"(0018,106E)",vr:"UL",name:"TriggerSamplePosition",vm:"1",version:"DICOM"},"(0018,1070)":{tag:"(0018,1070)",vr:"LO",name:"RadiopharmaceuticalRoute",vm:"1",version:"DICOM"},"(0018,1071)":{tag:"(0018,1071)",vr:"DS",name:"RadiopharmaceuticalVolume",vm:"1",version:"DICOM"},"(0018,1072)":{tag:"(0018,1072)",vr:"TM",name:"RadiopharmaceuticalStartTime",vm:"1",version:"DICOM"},"(0018,1073)":{tag:"(0018,1073)",vr:"TM",name:"RadiopharmaceuticalStopTime",vm:"1",version:"DICOM"},"(0018,1074)":{tag:"(0018,1074)",vr:"DS",name:"RadionuclideTotalDose",vm:"1",version:"DICOM"},"(0018,1075)":{tag:"(0018,1075)",vr:"DS",name:"RadionuclideHalfLife",vm:"1",version:"DICOM"},"(0018,1076)":{tag:"(0018,1076)",vr:"DS",name:"RadionuclidePositronFraction",vm:"1",version:"DICOM"},"(0018,1077)":{tag:"(0018,1077)",vr:"DS",name:"RadiopharmaceuticalSpecificActivity",vm:"1",version:"DICOM"},"(0018,1078)":{tag:"(0018,1078)",vr:"DT",name:"RadiopharmaceuticalStartDateTime",vm:"1",version:"DICOM"},"(0018,1079)":{tag:"(0018,1079)",vr:"DT",name:"RadiopharmaceuticalStopDateTime",vm:"1",version:"DICOM"},"(0018,1080)":{tag:"(0018,1080)",vr:"CS",name:"BeatRejectionFlag",vm:"1",version:"DICOM"},"(0018,1081)":{tag:"(0018,1081)",vr:"IS",name:"LowRRValue",vm:"1",version:"DICOM"},"(0018,1082)":{tag:"(0018,1082)",vr:"IS",name:"HighRRValue",vm:"1",version:"DICOM"},"(0018,1083)":{tag:"(0018,1083)",vr:"IS",name:"IntervalsAcquired",vm:"1",version:"DICOM"},"(0018,1084)":{tag:"(0018,1084)",vr:"IS",name:"IntervalsRejected",vm:"1",version:"DICOM"},"(0018,1085)":{tag:"(0018,1085)",vr:"LO",name:"PVCRejection",vm:"1",version:"DICOM"},"(0018,1086)":{tag:"(0018,1086)",vr:"IS",name:"SkipBeats",vm:"1",version:"DICOM"},"(0018,1088)":{tag:"(0018,1088)",vr:"IS",name:"HeartRate",vm:"1",version:"DICOM"},"(0018,1090)":{tag:"(0018,1090)",vr:"IS",name:"CardiacNumberOfImages",vm:"1",version:"DICOM"},"(0018,1094)":{tag:"(0018,1094)",vr:"IS",name:"TriggerWindow",vm:"1",version:"DICOM"},"(0018,1100)":{tag:"(0018,1100)",vr:"DS",name:"ReconstructionDiameter",vm:"1",version:"DICOM"},"(0018,1110)":{tag:"(0018,1110)",vr:"DS",name:"DistanceSourceToDetector",vm:"1",version:"DICOM"},"(0018,1111)":{tag:"(0018,1111)",vr:"DS",name:"DistanceSourceToPatient",vm:"1",version:"DICOM"},"(0018,1114)":{tag:"(0018,1114)",vr:"DS",name:"EstimatedRadiographicMagnificationFactor",vm:"1",version:"DICOM"},"(0018,1120)":{tag:"(0018,1120)",vr:"DS",name:"GantryDetectorTilt",vm:"1",version:"DICOM"},"(0018,1121)":{tag:"(0018,1121)",vr:"DS",name:"GantryDetectorSlew",vm:"1",version:"DICOM"},"(0018,1130)":{tag:"(0018,1130)",vr:"DS",name:"TableHeight",vm:"1",version:"DICOM"},"(0018,1131)":{tag:"(0018,1131)",vr:"DS",name:"TableTraverse",vm:"1",version:"DICOM"},"(0018,1134)":{tag:"(0018,1134)",vr:"CS",name:"TableMotion",vm:"1",version:"DICOM"},"(0018,1135)":{tag:"(0018,1135)",vr:"DS",name:"TableVerticalIncrement",vm:"1-n",version:"DICOM"},"(0018,1136)":{tag:"(0018,1136)",vr:"DS",name:"TableLateralIncrement",vm:"1-n",version:"DICOM"},"(0018,1137)":{tag:"(0018,1137)",vr:"DS",name:"TableLongitudinalIncrement",vm:"1-n",version:"DICOM"},"(0018,1138)":{tag:"(0018,1138)",vr:"DS",name:"TableAngle",vm:"1",version:"DICOM"},"(0018,113A)":{tag:"(0018,113A)",vr:"CS",name:"TableType",vm:"1",version:"DICOM"},"(0018,1140)":{tag:"(0018,1140)",vr:"CS",name:"RotationDirection",vm:"1",version:"DICOM"},"(0018,1142)":{tag:"(0018,1142)",vr:"DS",name:"RadialPosition",vm:"1-n",version:"DICOM"},"(0018,1143)":{tag:"(0018,1143)",vr:"DS",name:"ScanArc",vm:"1",version:"DICOM"},"(0018,1144)":{tag:"(0018,1144)",vr:"DS",name:"AngularStep",vm:"1",version:"DICOM"},"(0018,1145)":{tag:"(0018,1145)",vr:"DS",name:"CenterOfRotationOffset",vm:"1",version:"DICOM"},"(0018,1147)":{tag:"(0018,1147)",vr:"CS",name:"FieldOfViewShape",vm:"1",version:"DICOM"},"(0018,1149)":{tag:"(0018,1149)",vr:"IS",name:"FieldOfViewDimensions",vm:"1-2",version:"DICOM"},"(0018,1150)":{tag:"(0018,1150)",vr:"IS",name:"ExposureTime",vm:"1",version:"DICOM"},"(0018,1151)":{tag:"(0018,1151)",vr:"IS",name:"XRayTubeCurrent",vm:"1",version:"DICOM"},"(0018,1152)":{tag:"(0018,1152)",vr:"IS",name:"Exposure",vm:"1",version:"DICOM"},"(0018,1153)":{tag:"(0018,1153)",vr:"IS",name:"ExposureInuAs",vm:"1",version:"DICOM"},"(0018,1154)":{tag:"(0018,1154)",vr:"DS",name:"AveragePulseWidth",vm:"1",version:"DICOM"},"(0018,1155)":{tag:"(0018,1155)",vr:"CS",name:"RadiationSetting",vm:"1",version:"DICOM"},"(0018,1156)":{tag:"(0018,1156)",vr:"CS",name:"RectificationType",vm:"1",version:"DICOM"},"(0018,115A)":{tag:"(0018,115A)",vr:"CS",name:"RadiationMode",vm:"1",version:"DICOM"},"(0018,115E)":{tag:"(0018,115E)",vr:"DS",name:"ImageAndFluoroscopyAreaDoseProduct",vm:"1",version:"DICOM"},"(0018,1160)":{tag:"(0018,1160)",vr:"SH",name:"FilterType",vm:"1",version:"DICOM"},"(0018,1161)":{tag:"(0018,1161)",vr:"LO",name:"TypeOfFilters",vm:"1-n",version:"DICOM"},"(0018,1162)":{tag:"(0018,1162)",vr:"DS",name:"IntensifierSize",vm:"1",version:"DICOM"},"(0018,1164)":{tag:"(0018,1164)",vr:"DS",name:"ImagerPixelSpacing",vm:"2",version:"DICOM"},"(0018,1166)":{tag:"(0018,1166)",vr:"CS",name:"Grid",vm:"1-n",version:"DICOM"},"(0018,1170)":{tag:"(0018,1170)",vr:"IS",name:"GeneratorPower",vm:"1",version:"DICOM"},"(0018,1180)":{tag:"(0018,1180)",vr:"SH",name:"CollimatorGridName",vm:"1",version:"DICOM"},"(0018,1181)":{tag:"(0018,1181)",vr:"CS",name:"CollimatorType",vm:"1",version:"DICOM"},"(0018,1182)":{tag:"(0018,1182)",vr:"IS",name:"FocalDistance",vm:"1-2",version:"DICOM"},"(0018,1183)":{tag:"(0018,1183)",vr:"DS",name:"XFocusCenter",vm:"1-2",version:"DICOM"},"(0018,1184)":{tag:"(0018,1184)",vr:"DS",name:"YFocusCenter",vm:"1-2",version:"DICOM"},"(0018,1190)":{tag:"(0018,1190)",vr:"DS",name:"FocalSpots",vm:"1-n",version:"DICOM"},"(0018,1191)":{tag:"(0018,1191)",vr:"CS",name:"AnodeTargetMaterial",vm:"1",version:"DICOM"},"(0018,11A0)":{tag:"(0018,11A0)",vr:"DS",name:"BodyPartThickness",vm:"1",version:"DICOM"},"(0018,11A2)":{tag:"(0018,11A2)",vr:"DS",name:"CompressionForce",vm:"1",version:"DICOM"},"(0018,11A4)":{tag:"(0018,11A4)",vr:"LO",name:"PaddleDescription",vm:"1",version:"DICOM"},"(0018,1200)":{tag:"(0018,1200)",vr:"DA",name:"DateOfLastCalibration",vm:"1-n",version:"DICOM"},"(0018,1201)":{tag:"(0018,1201)",vr:"TM",name:"TimeOfLastCalibration",vm:"1-n",version:"DICOM"},"(0018,1202)":{tag:"(0018,1202)",vr:"DT",name:"DateTimeOfLastCalibration",vm:"1",version:"DICOM"},"(0018,1210)":{tag:"(0018,1210)",vr:"SH",name:"ConvolutionKernel",vm:"1-n",version:"DICOM"},"(0018,1242)":{tag:"(0018,1242)",vr:"IS",name:"ActualFrameDuration",vm:"1",version:"DICOM"},"(0018,1243)":{tag:"(0018,1243)",vr:"IS",name:"CountRate",vm:"1",version:"DICOM"},"(0018,1244)":{tag:"(0018,1244)",vr:"US",name:"PreferredPlaybackSequencing",vm:"1",version:"DICOM"},"(0018,1250)":{tag:"(0018,1250)",vr:"SH",name:"ReceiveCoilName",vm:"1",version:"DICOM"},"(0018,1251)":{tag:"(0018,1251)",vr:"SH",name:"TransmitCoilName",vm:"1",version:"DICOM"},"(0018,1260)":{tag:"(0018,1260)",vr:"SH",name:"PlateType",vm:"1",version:"DICOM"},"(0018,1261)":{tag:"(0018,1261)",vr:"LO",name:"PhosphorType",vm:"1",version:"DICOM"},"(0018,1300)":{tag:"(0018,1300)",vr:"DS",name:"ScanVelocity",vm:"1",version:"DICOM"},"(0018,1301)":{tag:"(0018,1301)",vr:"CS",name:"WholeBodyTechnique",vm:"1-n",version:"DICOM"},"(0018,1302)":{tag:"(0018,1302)",vr:"IS",name:"ScanLength",vm:"1",version:"DICOM"},"(0018,1310)":{tag:"(0018,1310)",vr:"US",name:"AcquisitionMatrix",vm:"4",version:"DICOM"},"(0018,1312)":{tag:"(0018,1312)",vr:"CS",name:"InPlanePhaseEncodingDirection",vm:"1",version:"DICOM"},"(0018,1314)":{tag:"(0018,1314)",vr:"DS",name:"FlipAngle",vm:"1",version:"DICOM"},"(0018,1315)":{tag:"(0018,1315)",vr:"CS",name:"VariableFlipAngleFlag",vm:"1",version:"DICOM"},"(0018,1316)":{tag:"(0018,1316)",vr:"DS",name:"SAR",vm:"1",version:"DICOM"},"(0018,1318)":{tag:"(0018,1318)",vr:"DS",name:"dBdt",vm:"1",version:"DICOM"},"(0018,1400)":{tag:"(0018,1400)",vr:"LO",name:"AcquisitionDeviceProcessingDescription",vm:"1",version:"DICOM"},"(0018,1401)":{tag:"(0018,1401)",vr:"LO",name:"AcquisitionDeviceProcessingCode",vm:"1",version:"DICOM"},"(0018,1402)":{tag:"(0018,1402)",vr:"CS",name:"CassetteOrientation",vm:"1",version:"DICOM"},"(0018,1403)":{tag:"(0018,1403)",vr:"CS",name:"CassetteSize",vm:"1",version:"DICOM"},"(0018,1404)":{tag:"(0018,1404)",vr:"US",name:"ExposuresOnPlate",vm:"1",version:"DICOM"},"(0018,1405)":{tag:"(0018,1405)",vr:"IS",name:"RelativeXRayExposure",vm:"1",version:"DICOM"},"(0018,1411)":{tag:"(0018,1411)",vr:"DS",name:"ExposureIndex",vm:"1",version:"DICOM"},"(0018,1412)":{tag:"(0018,1412)",vr:"DS",name:"TargetExposureIndex",vm:"1",version:"DICOM"},"(0018,1413)":{tag:"(0018,1413)",vr:"DS",name:"DeviationIndex",vm:"1",version:"DICOM"},"(0018,1450)":{tag:"(0018,1450)",vr:"DS",name:"ColumnAngulation",vm:"1",version:"DICOM"},"(0018,1460)":{tag:"(0018,1460)",vr:"DS",name:"TomoLayerHeight",vm:"1",version:"DICOM"},"(0018,1470)":{tag:"(0018,1470)",vr:"DS",name:"TomoAngle",vm:"1",version:"DICOM"},"(0018,1480)":{tag:"(0018,1480)",vr:"DS",name:"TomoTime",vm:"1",version:"DICOM"},"(0018,1490)":{tag:"(0018,1490)",vr:"CS",name:"TomoType",vm:"1",version:"DICOM"},"(0018,1491)":{tag:"(0018,1491)",vr:"CS",name:"TomoClass",vm:"1",version:"DICOM"},"(0018,1495)":{tag:"(0018,1495)",vr:"IS",name:"NumberOfTomosynthesisSourceImages",vm:"1",version:"DICOM"},"(0018,1500)":{tag:"(0018,1500)",vr:"CS",name:"PositionerMotion",vm:"1",version:"DICOM"},"(0018,1508)":{tag:"(0018,1508)",vr:"CS",name:"PositionerType",vm:"1",version:"DICOM"},"(0018,1510)":{tag:"(0018,1510)",vr:"DS",name:"PositionerPrimaryAngle",vm:"1",version:"DICOM"},"(0018,1511)":{tag:"(0018,1511)",vr:"DS",name:"PositionerSecondaryAngle",vm:"1",version:"DICOM"},"(0018,1520)":{tag:"(0018,1520)",vr:"DS",name:"PositionerPrimaryAngleIncrement",vm:"1-n",version:"DICOM"},"(0018,1521)":{tag:"(0018,1521)",vr:"DS",name:"PositionerSecondaryAngleIncrement",vm:"1-n",version:"DICOM"},"(0018,1530)":{tag:"(0018,1530)",vr:"DS",name:"DetectorPrimaryAngle",vm:"1",version:"DICOM"},"(0018,1531)":{tag:"(0018,1531)",vr:"DS",name:"DetectorSecondaryAngle",vm:"1",version:"DICOM"},"(0018,1600)":{tag:"(0018,1600)",vr:"CS",name:"ShutterShape",vm:"1-3",version:"DICOM"},"(0018,1602)":{tag:"(0018,1602)",vr:"IS",name:"ShutterLeftVerticalEdge",vm:"1",version:"DICOM"},"(0018,1604)":{tag:"(0018,1604)",vr:"IS",name:"ShutterRightVerticalEdge",vm:"1",version:"DICOM"},"(0018,1606)":{tag:"(0018,1606)",vr:"IS",name:"ShutterUpperHorizontalEdge",vm:"1",version:"DICOM"},"(0018,1608)":{tag:"(0018,1608)",vr:"IS",name:"ShutterLowerHorizontalEdge",vm:"1",version:"DICOM"},"(0018,1610)":{tag:"(0018,1610)",vr:"IS",name:"CenterOfCircularShutter",vm:"2",version:"DICOM"},"(0018,1612)":{tag:"(0018,1612)",vr:"IS",name:"RadiusOfCircularShutter",vm:"1",version:"DICOM"},"(0018,1620)":{tag:"(0018,1620)",vr:"IS",name:"VerticesOfThePolygonalShutter",vm:"2-2n",version:"DICOM"},"(0018,1622)":{tag:"(0018,1622)",vr:"US",name:"ShutterPresentationValue",vm:"1",version:"DICOM"},"(0018,1623)":{tag:"(0018,1623)",vr:"US",name:"ShutterOverlayGroup",vm:"1",version:"DICOM"},"(0018,1624)":{tag:"(0018,1624)",vr:"US",name:"ShutterPresentationColorCIELabValue",vm:"3",version:"DICOM"},"(0018,1700)":{tag:"(0018,1700)",vr:"CS",name:"CollimatorShape",vm:"1-3",version:"DICOM"},"(0018,1702)":{tag:"(0018,1702)",vr:"IS",name:"CollimatorLeftVerticalEdge",vm:"1",version:"DICOM"},"(0018,1704)":{tag:"(0018,1704)",vr:"IS",name:"CollimatorRightVerticalEdge",vm:"1",version:"DICOM"},"(0018,1706)":{tag:"(0018,1706)",vr:"IS",name:"CollimatorUpperHorizontalEdge",vm:"1",version:"DICOM"},"(0018,1708)":{tag:"(0018,1708)",vr:"IS",name:"CollimatorLowerHorizontalEdge",vm:"1",version:"DICOM"},"(0018,1710)":{tag:"(0018,1710)",vr:"IS",name:"CenterOfCircularCollimator",vm:"2",version:"DICOM"},"(0018,1712)":{tag:"(0018,1712)",vr:"IS",name:"RadiusOfCircularCollimator",vm:"1",version:"DICOM"},"(0018,1720)":{tag:"(0018,1720)",vr:"IS",name:"VerticesOfThePolygonalCollimator",vm:"2-2n",version:"DICOM"},"(0018,1800)":{tag:"(0018,1800)",vr:"CS",name:"AcquisitionTimeSynchronized",vm:"1",version:"DICOM"},"(0018,1801)":{tag:"(0018,1801)",vr:"SH",name:"TimeSource",vm:"1",version:"DICOM"},"(0018,1802)":{tag:"(0018,1802)",vr:"CS",name:"TimeDistributionProtocol",vm:"1",version:"DICOM"},"(0018,1803)":{tag:"(0018,1803)",vr:"LO",name:"NTPSourceAddress",vm:"1",version:"DICOM"},"(0018,2001)":{tag:"(0018,2001)",vr:"IS",name:"PageNumberVector",vm:"1-n",version:"DICOM"},"(0018,2002)":{tag:"(0018,2002)",vr:"SH",name:"FrameLabelVector",vm:"1-n",version:"DICOM"},"(0018,2003)":{tag:"(0018,2003)",vr:"DS",name:"FramePrimaryAngleVector",vm:"1-n",version:"DICOM"},"(0018,2004)":{tag:"(0018,2004)",vr:"DS",name:"FrameSecondaryAngleVector",vm:"1-n",version:"DICOM"},"(0018,2005)":{tag:"(0018,2005)",vr:"DS",name:"SliceLocationVector",vm:"1-n",version:"DICOM"},"(0018,2006)":{tag:"(0018,2006)",vr:"SH",name:"DisplayWindowLabelVector",vm:"1-n",version:"DICOM"},"(0018,2010)":{tag:"(0018,2010)",vr:"DS",name:"NominalScannedPixelSpacing",vm:"2",version:"DICOM"},"(0018,2020)":{tag:"(0018,2020)",vr:"CS",name:"DigitizingDeviceTransportDirection",vm:"1",version:"DICOM"},"(0018,2030)":{tag:"(0018,2030)",vr:"DS",name:"RotationOfScannedFilm",vm:"1",version:"DICOM"},"(0018,2041)":{tag:"(0018,2041)",vr:"SQ",name:"BiopsyTargetSequence",vm:"1",version:"DICOM"},"(0018,2042)":{tag:"(0018,2042)",vr:"UI",name:"TargetUID",vm:"1",version:"DICOM"},"(0018,2043)":{tag:"(0018,2043)",vr:"FL",name:"LocalizingCursorPosition",vm:"2",version:"DICOM"},"(0018,2044)":{tag:"(0018,2044)",vr:"FL",name:"CalculatedTargetPosition",vm:"3",version:"DICOM"},"(0018,2045)":{tag:"(0018,2045)",vr:"SH",name:"TargetLabel",vm:"1",version:"DICOM"},"(0018,2046)":{tag:"(0018,2046)",vr:"FL",name:"DisplayedZValue",vm:"1",version:"DICOM"},"(0018,3100)":{tag:"(0018,3100)",vr:"CS",name:"IVUSAcquisition",vm:"1",version:"DICOM"},"(0018,3101)":{tag:"(0018,3101)",vr:"DS",name:"IVUSPullbackRate",vm:"1",version:"DICOM"},"(0018,3102)":{tag:"(0018,3102)",vr:"DS",name:"IVUSGatedRate",vm:"1",version:"DICOM"},"(0018,3103)":{tag:"(0018,3103)",vr:"IS",name:"IVUSPullbackStartFrameNumber",vm:"1",version:"DICOM"},"(0018,3104)":{tag:"(0018,3104)",vr:"IS",name:"IVUSPullbackStopFrameNumber",vm:"1",version:"DICOM"},"(0018,3105)":{tag:"(0018,3105)",vr:"IS",name:"LesionNumber",vm:"1-n",version:"DICOM"},"(0018,5000)":{tag:"(0018,5000)",vr:"SH",name:"OutputPower",vm:"1-n",version:"DICOM"},"(0018,5010)":{tag:"(0018,5010)",vr:"LO",name:"TransducerData",vm:"1-n",version:"DICOM"},"(0018,5012)":{tag:"(0018,5012)",vr:"DS",name:"FocusDepth",vm:"1",version:"DICOM"},"(0018,5020)":{tag:"(0018,5020)",vr:"LO",name:"ProcessingFunction",vm:"1",version:"DICOM"},"(0018,5022)":{tag:"(0018,5022)",vr:"DS",name:"MechanicalIndex",vm:"1",version:"DICOM"},"(0018,5024)":{tag:"(0018,5024)",vr:"DS",name:"BoneThermalIndex",vm:"1",version:"DICOM"},"(0018,5026)":{tag:"(0018,5026)",vr:"DS",name:"CranialThermalIndex",vm:"1",version:"DICOM"},"(0018,5027)":{tag:"(0018,5027)",vr:"DS",name:"SoftTissueThermalIndex",vm:"1",version:"DICOM"},"(0018,5028)":{tag:"(0018,5028)",vr:"DS",name:"SoftTissueFocusThermalIndex",vm:"1",version:"DICOM"},"(0018,5029)":{tag:"(0018,5029)",vr:"DS",name:"SoftTissueSurfaceThermalIndex",vm:"1",version:"DICOM"},"(0018,5050)":{tag:"(0018,5050)",vr:"IS",name:"DepthOfScanField",vm:"1",version:"DICOM"},"(0018,5100)":{tag:"(0018,5100)",vr:"CS",name:"PatientPosition",vm:"1",version:"DICOM"},"(0018,5101)":{tag:"(0018,5101)",vr:"CS",name:"ViewPosition",vm:"1",version:"DICOM"},"(0018,5104)":{tag:"(0018,5104)",vr:"SQ",name:"ProjectionEponymousNameCodeSequence",vm:"1",version:"DICOM"},"(0018,6000)":{tag:"(0018,6000)",vr:"DS",name:"Sensitivity",vm:"1",version:"DICOM"},"(0018,6011)":{tag:"(0018,6011)",vr:"SQ",name:"SequenceOfUltrasoundRegions",vm:"1",version:"DICOM"},"(0018,6012)":{tag:"(0018,6012)",vr:"US",name:"RegionSpatialFormat",vm:"1",version:"DICOM"},"(0018,6014)":{tag:"(0018,6014)",vr:"US",name:"RegionDataType",vm:"1",version:"DICOM"},"(0018,6016)":{tag:"(0018,6016)",vr:"UL",name:"RegionFlags",vm:"1",version:"DICOM"},"(0018,6018)":{tag:"(0018,6018)",vr:"UL",name:"RegionLocationMinX0",vm:"1",version:"DICOM"},"(0018,601A)":{tag:"(0018,601A)",vr:"UL",name:"RegionLocationMinY0",vm:"1",version:"DICOM"},"(0018,601C)":{tag:"(0018,601C)",vr:"UL",name:"RegionLocationMaxX1",vm:"1",version:"DICOM"},"(0018,601E)":{tag:"(0018,601E)",vr:"UL",name:"RegionLocationMaxY1",vm:"1",version:"DICOM"},"(0018,6020)":{tag:"(0018,6020)",vr:"SL",name:"ReferencePixelX0",vm:"1",version:"DICOM"},"(0018,6022)":{tag:"(0018,6022)",vr:"SL",name:"ReferencePixelY0",vm:"1",version:"DICOM"},"(0018,6024)":{tag:"(0018,6024)",vr:"US",name:"PhysicalUnitsXDirection",vm:"1",version:"DICOM"},"(0018,6026)":{tag:"(0018,6026)",vr:"US",name:"PhysicalUnitsYDirection",vm:"1",version:"DICOM"},"(0018,6028)":{tag:"(0018,6028)",vr:"FD",name:"ReferencePixelPhysicalValueX",vm:"1",version:"DICOM"},"(0018,602A)":{tag:"(0018,602A)",vr:"FD",name:"ReferencePixelPhysicalValueY",vm:"1",version:"DICOM"},"(0018,602C)":{tag:"(0018,602C)",vr:"FD",name:"PhysicalDeltaX",vm:"1",version:"DICOM"},"(0018,602E)":{tag:"(0018,602E)",vr:"FD",name:"PhysicalDeltaY",vm:"1",version:"DICOM"},"(0018,6030)":{tag:"(0018,6030)",vr:"UL",name:"TransducerFrequency",vm:"1",version:"DICOM"},"(0018,6031)":{tag:"(0018,6031)",vr:"CS",name:"TransducerType",vm:"1",version:"DICOM"},"(0018,6032)":{tag:"(0018,6032)",vr:"UL",name:"PulseRepetitionFrequency",vm:"1",version:"DICOM"},"(0018,6034)":{tag:"(0018,6034)",vr:"FD",name:"DopplerCorrectionAngle",vm:"1",version:"DICOM"},"(0018,6036)":{tag:"(0018,6036)",vr:"FD",name:"SteeringAngle",vm:"1",version:"DICOM"},"(0018,6039)":{tag:"(0018,6039)",vr:"SL",name:"DopplerSampleVolumeXPosition",vm:"1",version:"DICOM"},"(0018,603B)":{tag:"(0018,603B)",vr:"SL",name:"DopplerSampleVolumeYPosition",vm:"1",version:"DICOM"},"(0018,603D)":{tag:"(0018,603D)",vr:"SL",name:"TMLinePositionX0",vm:"1",version:"DICOM"},"(0018,603F)":{tag:"(0018,603F)",vr:"SL",name:"TMLinePositionY0",vm:"1",version:"DICOM"},"(0018,6041)":{tag:"(0018,6041)",vr:"SL",name:"TMLinePositionX1",vm:"1",version:"DICOM"},"(0018,6043)":{tag:"(0018,6043)",vr:"SL",name:"TMLinePositionY1",vm:"1",version:"DICOM"},"(0018,6044)":{tag:"(0018,6044)",vr:"US",name:"PixelComponentOrganization",vm:"1",version:"DICOM"},"(0018,6046)":{tag:"(0018,6046)",vr:"UL",name:"PixelComponentMask",vm:"1",version:"DICOM"},"(0018,6048)":{tag:"(0018,6048)",vr:"UL",name:"PixelComponentRangeStart",vm:"1",version:"DICOM"},"(0018,604A)":{tag:"(0018,604A)",vr:"UL",name:"PixelComponentRangeStop",vm:"1",version:"DICOM"},"(0018,604C)":{tag:"(0018,604C)",vr:"US",name:"PixelComponentPhysicalUnits",vm:"1",version:"DICOM"},"(0018,604E)":{tag:"(0018,604E)",vr:"US",name:"PixelComponentDataType",vm:"1",version:"DICOM"},"(0018,6050)":{tag:"(0018,6050)",vr:"UL",name:"NumberOfTableBreakPoints",vm:"1",version:"DICOM"},"(0018,6052)":{tag:"(0018,6052)",vr:"UL",name:"TableOfXBreakPoints",vm:"1-n",version:"DICOM"},"(0018,6054)":{tag:"(0018,6054)",vr:"FD",name:"TableOfYBreakPoints",vm:"1-n",version:"DICOM"},"(0018,6056)":{tag:"(0018,6056)",vr:"UL",name:"NumberOfTableEntries",vm:"1",version:"DICOM"},"(0018,6058)":{tag:"(0018,6058)",vr:"UL",name:"TableOfPixelValues",vm:"1-n",version:"DICOM"},"(0018,605A)":{tag:"(0018,605A)",vr:"FL",name:"TableOfParameterValues",vm:"1-n",version:"DICOM"},"(0018,6060)":{tag:"(0018,6060)",vr:"FL",name:"RWaveTimeVector",vm:"1-n",version:"DICOM"},"(0018,7000)":{tag:"(0018,7000)",vr:"CS",name:"DetectorConditionsNominalFlag",vm:"1",version:"DICOM"},"(0018,7001)":{tag:"(0018,7001)",vr:"DS",name:"DetectorTemperature",vm:"1",version:"DICOM"},"(0018,7004)":{tag:"(0018,7004)",vr:"CS",name:"DetectorType",vm:"1",version:"DICOM"},"(0018,7005)":{tag:"(0018,7005)",vr:"CS",name:"DetectorConfiguration",vm:"1",version:"DICOM"},"(0018,7006)":{tag:"(0018,7006)",vr:"LT",name:"DetectorDescription",vm:"1",version:"DICOM"},"(0018,7008)":{tag:"(0018,7008)",vr:"LT",name:"DetectorMode",vm:"1",version:"DICOM"},"(0018,700A)":{tag:"(0018,700A)",vr:"SH",name:"DetectorID",vm:"1",version:"DICOM"},"(0018,700C)":{tag:"(0018,700C)",vr:"DA",name:"DateOfLastDetectorCalibration",vm:"1",version:"DICOM"},"(0018,700E)":{tag:"(0018,700E)",vr:"TM",name:"TimeOfLastDetectorCalibration",vm:"1",version:"DICOM"},"(0018,7010)":{tag:"(0018,7010)",vr:"IS",name:"ExposuresOnDetectorSinceLastCalibration",vm:"1",version:"DICOM"},"(0018,7011)":{tag:"(0018,7011)",vr:"IS",name:"ExposuresOnDetectorSinceManufactured",vm:"1",version:"DICOM"},"(0018,7012)":{tag:"(0018,7012)",vr:"DS",name:"DetectorTimeSinceLastExposure",vm:"1",version:"DICOM"},"(0018,7014)":{tag:"(0018,7014)",vr:"DS",name:"DetectorActiveTime",vm:"1",version:"DICOM"},"(0018,7016)":{tag:"(0018,7016)",vr:"DS",name:"DetectorActivationOffsetFromExposure",vm:"1",version:"DICOM"},"(0018,701A)":{tag:"(0018,701A)",vr:"DS",name:"DetectorBinning",vm:"2",version:"DICOM"},"(0018,7020)":{tag:"(0018,7020)",vr:"DS",name:"DetectorElementPhysicalSize",vm:"2",version:"DICOM"},"(0018,7022)":{tag:"(0018,7022)",vr:"DS",name:"DetectorElementSpacing",vm:"2",version:"DICOM"},"(0018,7024)":{tag:"(0018,7024)",vr:"CS",name:"DetectorActiveShape",vm:"1",version:"DICOM"},"(0018,7026)":{tag:"(0018,7026)",vr:"DS",name:"DetectorActiveDimensions",vm:"1-2",version:"DICOM"},"(0018,7028)":{tag:"(0018,7028)",vr:"DS",name:"DetectorActiveOrigin",vm:"2",version:"DICOM"},"(0018,702A)":{tag:"(0018,702A)",vr:"LO",name:"DetectorManufacturerName",vm:"1",version:"DICOM"},"(0018,702B)":{tag:"(0018,702B)",vr:"LO",name:"DetectorManufacturerModelName",vm:"1",version:"DICOM"},"(0018,7030)":{tag:"(0018,7030)",vr:"DS",name:"FieldOfViewOrigin",vm:"2",version:"DICOM"},"(0018,7032)":{tag:"(0018,7032)",vr:"DS",name:"FieldOfViewRotation",vm:"1",version:"DICOM"},"(0018,7034)":{tag:"(0018,7034)",vr:"CS",name:"FieldOfViewHorizontalFlip",vm:"1",version:"DICOM"},"(0018,7036)":{tag:"(0018,7036)",vr:"FL",name:"PixelDataAreaOriginRelativeToFOV",vm:"2",version:"DICOM"},"(0018,7038)":{tag:"(0018,7038)",vr:"FL",name:"PixelDataAreaRotationAngleRelativeToFOV",vm:"1",version:"DICOM"},"(0018,7040)":{tag:"(0018,7040)",vr:"LT",name:"GridAbsorbingMaterial",vm:"1",version:"DICOM"},"(0018,7041)":{tag:"(0018,7041)",vr:"LT",name:"GridSpacingMaterial",vm:"1",version:"DICOM"},"(0018,7042)":{tag:"(0018,7042)",vr:"DS",name:"GridThickness",vm:"1",version:"DICOM"},"(0018,7044)":{tag:"(0018,7044)",vr:"DS",name:"GridPitch",vm:"1",version:"DICOM"},"(0018,7046)":{tag:"(0018,7046)",vr:"IS",name:"GridAspectRatio",vm:"2",version:"DICOM"},"(0018,7048)":{tag:"(0018,7048)",vr:"DS",name:"GridPeriod",vm:"1",version:"DICOM"},"(0018,704C)":{tag:"(0018,704C)",vr:"DS",name:"GridFocalDistance",vm:"1",version:"DICOM"},"(0018,7050)":{tag:"(0018,7050)",vr:"CS",name:"FilterMaterial",vm:"1-n",version:"DICOM"},"(0018,7052)":{tag:"(0018,7052)",vr:"DS",name:"FilterThicknessMinimum",vm:"1-n",version:"DICOM"},"(0018,7054)":{tag:"(0018,7054)",vr:"DS",name:"FilterThicknessMaximum",vm:"1-n",version:"DICOM"},"(0018,7056)":{tag:"(0018,7056)",vr:"FL",name:"FilterBeamPathLengthMinimum",vm:"1-n",version:"DICOM"},"(0018,7058)":{tag:"(0018,7058)",vr:"FL",name:"FilterBeamPathLengthMaximum",vm:"1-n",version:"DICOM"},"(0018,7060)":{tag:"(0018,7060)",vr:"CS",name:"ExposureControlMode",vm:"1",version:"DICOM"},"(0018,7062)":{tag:"(0018,7062)",vr:"LT",name:"ExposureControlModeDescription",vm:"1",version:"DICOM"},"(0018,7064)":{tag:"(0018,7064)",vr:"CS",name:"ExposureStatus",vm:"1",version:"DICOM"},"(0018,7065)":{tag:"(0018,7065)",vr:"DS",name:"PhototimerSetting",vm:"1",version:"DICOM"},"(0018,8150)":{tag:"(0018,8150)",vr:"DS",name:"ExposureTimeInuS",vm:"1",version:"DICOM"},"(0018,8151)":{tag:"(0018,8151)",vr:"DS",name:"XRayTubeCurrentInuA",vm:"1",version:"DICOM"},"(0018,9004)":{tag:"(0018,9004)",vr:"CS",name:"ContentQualification",vm:"1",version:"DICOM"},"(0018,9005)":{tag:"(0018,9005)",vr:"SH",name:"PulseSequenceName",vm:"1",version:"DICOM"},"(0018,9006)":{tag:"(0018,9006)",vr:"SQ",name:"MRImagingModifierSequence",vm:"1",version:"DICOM"},"(0018,9008)":{tag:"(0018,9008)",vr:"CS",name:"EchoPulseSequence",vm:"1",version:"DICOM"},"(0018,9009)":{tag:"(0018,9009)",vr:"CS",name:"InversionRecovery",vm:"1",version:"DICOM"},"(0018,9010)":{tag:"(0018,9010)",vr:"CS",name:"FlowCompensation",vm:"1",version:"DICOM"},"(0018,9011)":{tag:"(0018,9011)",vr:"CS",name:"MultipleSpinEcho",vm:"1",version:"DICOM"},"(0018,9012)":{tag:"(0018,9012)",vr:"CS",name:"MultiPlanarExcitation",vm:"1",version:"DICOM"},"(0018,9014)":{tag:"(0018,9014)",vr:"CS",name:"PhaseContrast",vm:"1",version:"DICOM"},"(0018,9015)":{tag:"(0018,9015)",vr:"CS",name:"TimeOfFlightContrast",vm:"1",version:"DICOM"},"(0018,9016)":{tag:"(0018,9016)",vr:"CS",name:"Spoiling",vm:"1",version:"DICOM"},"(0018,9017)":{tag:"(0018,9017)",vr:"CS",name:"SteadyStatePulseSequence",vm:"1",version:"DICOM"},"(0018,9018)":{tag:"(0018,9018)",vr:"CS",name:"EchoPlanarPulseSequence",vm:"1",version:"DICOM"},"(0018,9019)":{tag:"(0018,9019)",vr:"FD",name:"TagAngleFirstAxis",vm:"1",version:"DICOM"},"(0018,9020)":{tag:"(0018,9020)",vr:"CS",name:"MagnetizationTransfer",vm:"1",version:"DICOM"},"(0018,9021)":{tag:"(0018,9021)",vr:"CS",name:"T2Preparation",vm:"1",version:"DICOM"},"(0018,9022)":{tag:"(0018,9022)",vr:"CS",name:"BloodSignalNulling",vm:"1",version:"DICOM"},"(0018,9024)":{tag:"(0018,9024)",vr:"CS",name:"SaturationRecovery",vm:"1",version:"DICOM"},"(0018,9025)":{tag:"(0018,9025)",vr:"CS",name:"SpectrallySelectedSuppression",vm:"1",version:"DICOM"},"(0018,9026)":{tag:"(0018,9026)",vr:"CS",name:"SpectrallySelectedExcitation",vm:"1",version:"DICOM"},"(0018,9027)":{tag:"(0018,9027)",vr:"CS",name:"SpatialPresaturation",vm:"1",version:"DICOM"},"(0018,9028)":{tag:"(0018,9028)",vr:"CS",name:"Tagging",vm:"1",version:"DICOM"},"(0018,9029)":{tag:"(0018,9029)",vr:"CS",name:"OversamplingPhase",vm:"1",version:"DICOM"},"(0018,9030)":{tag:"(0018,9030)",vr:"FD",name:"TagSpacingFirstDimension",vm:"1",version:"DICOM"},"(0018,9032)":{tag:"(0018,9032)",vr:"CS",name:"GeometryOfKSpaceTraversal",vm:"1",version:"DICOM"},"(0018,9033)":{tag:"(0018,9033)",vr:"CS",name:"SegmentedKSpaceTraversal",vm:"1",version:"DICOM"},"(0018,9034)":{tag:"(0018,9034)",vr:"CS",name:"RectilinearPhaseEncodeReordering",vm:"1",version:"DICOM"},"(0018,9035)":{tag:"(0018,9035)",vr:"FD",name:"TagThickness",vm:"1",version:"DICOM"},"(0018,9036)":{tag:"(0018,9036)",vr:"CS",name:"PartialFourierDirection",vm:"1",version:"DICOM"},"(0018,9037)":{tag:"(0018,9037)",vr:"CS",name:"CardiacSynchronizationTechnique",vm:"1",version:"DICOM"},"(0018,9041)":{tag:"(0018,9041)",vr:"LO",name:"ReceiveCoilManufacturerName",vm:"1",version:"DICOM"},"(0018,9042)":{tag:"(0018,9042)",vr:"SQ",name:"MRReceiveCoilSequence",vm:"1",version:"DICOM"},"(0018,9043)":{tag:"(0018,9043)",vr:"CS",name:"ReceiveCoilType",vm:"1",version:"DICOM"},"(0018,9044)":{tag:"(0018,9044)",vr:"CS",name:"QuadratureReceiveCoil",vm:"1",version:"DICOM"},"(0018,9045)":{tag:"(0018,9045)",vr:"SQ",name:"MultiCoilDefinitionSequence",vm:"1",version:"DICOM"},"(0018,9046)":{tag:"(0018,9046)",vr:"LO",name:"MultiCoilConfiguration",vm:"1",version:"DICOM"},"(0018,9047)":{tag:"(0018,9047)",vr:"SH",name:"MultiCoilElementName",vm:"1",version:"DICOM"},"(0018,9048)":{tag:"(0018,9048)",vr:"CS",name:"MultiCoilElementUsed",vm:"1",version:"DICOM"},"(0018,9049)":{tag:"(0018,9049)",vr:"SQ",name:"MRTransmitCoilSequence",vm:"1",version:"DICOM"},"(0018,9050)":{tag:"(0018,9050)",vr:"LO",name:"TransmitCoilManufacturerName",vm:"1",version:"DICOM"},"(0018,9051)":{tag:"(0018,9051)",vr:"CS",name:"TransmitCoilType",vm:"1",version:"DICOM"},"(0018,9052)":{tag:"(0018,9052)",vr:"FD",name:"SpectralWidth",vm:"1-2",version:"DICOM"},"(0018,9053)":{tag:"(0018,9053)",vr:"FD",name:"ChemicalShiftReference",vm:"1-2",version:"DICOM"},"(0018,9054)":{tag:"(0018,9054)",vr:"CS",name:"VolumeLocalizationTechnique",vm:"1",version:"DICOM"},"(0018,9058)":{tag:"(0018,9058)",vr:"US",name:"MRAcquisitionFrequencyEncodingSteps",vm:"1",version:"DICOM"},"(0018,9059)":{tag:"(0018,9059)",vr:"CS",name:"Decoupling",vm:"1",version:"DICOM"},"(0018,9060)":{tag:"(0018,9060)",vr:"CS",name:"DecoupledNucleus",vm:"1-2",version:"DICOM"},"(0018,9061)":{tag:"(0018,9061)",vr:"FD",name:"DecouplingFrequency",vm:"1-2",version:"DICOM"},"(0018,9062)":{tag:"(0018,9062)",vr:"CS",name:"DecouplingMethod",vm:"1",version:"DICOM"},"(0018,9063)":{tag:"(0018,9063)",vr:"FD",name:"DecouplingChemicalShiftReference",vm:"1-2",version:"DICOM"},"(0018,9064)":{tag:"(0018,9064)",vr:"CS",name:"KSpaceFiltering",vm:"1",version:"DICOM"},"(0018,9065)":{tag:"(0018,9065)",vr:"CS",name:"TimeDomainFiltering",vm:"1-2",version:"DICOM"},"(0018,9066)":{tag:"(0018,9066)",vr:"US",name:"NumberOfZeroFills",vm:"1-2",version:"DICOM"},"(0018,9067)":{tag:"(0018,9067)",vr:"CS",name:"BaselineCorrection",vm:"1",version:"DICOM"},"(0018,9069)":{tag:"(0018,9069)",vr:"FD",name:"ParallelReductionFactorInPlane",vm:"1",version:"DICOM"},"(0018,9070)":{tag:"(0018,9070)",vr:"FD",name:"CardiacRRIntervalSpecified",vm:"1",version:"DICOM"},"(0018,9073)":{tag:"(0018,9073)",vr:"FD",name:"AcquisitionDuration",vm:"1",version:"DICOM"},"(0018,9074)":{tag:"(0018,9074)",vr:"DT",name:"FrameAcquisitionDateTime",vm:"1",version:"DICOM"},"(0018,9075)":{tag:"(0018,9075)",vr:"CS",name:"DiffusionDirectionality",vm:"1",version:"DICOM"},"(0018,9076)":{tag:"(0018,9076)",vr:"SQ",name:"DiffusionGradientDirectionSequence",vm:"1",version:"DICOM"},"(0018,9077)":{tag:"(0018,9077)",vr:"CS",name:"ParallelAcquisition",vm:"1",version:"DICOM"},"(0018,9078)":{tag:"(0018,9078)",vr:"CS",name:"ParallelAcquisitionTechnique",vm:"1",version:"DICOM"},"(0018,9079)":{tag:"(0018,9079)",vr:"FD",name:"InversionTimes",vm:"1-n",version:"DICOM"},"(0018,9080)":{tag:"(0018,9080)",vr:"ST",name:"MetaboliteMapDescription",vm:"1",version:"DICOM"},"(0018,9081)":{tag:"(0018,9081)",vr:"CS",name:"PartialFourier",vm:"1",version:"DICOM"},"(0018,9082)":{tag:"(0018,9082)",vr:"FD",name:"EffectiveEchoTime",vm:"1",version:"DICOM"},"(0018,9083)":{tag:"(0018,9083)",vr:"SQ",name:"MetaboliteMapCodeSequence",vm:"1",version:"DICOM"},"(0018,9084)":{tag:"(0018,9084)",vr:"SQ",name:"ChemicalShiftSequence",vm:"1",version:"DICOM"},"(0018,9085)":{tag:"(0018,9085)",vr:"CS",name:"CardiacSignalSource",vm:"1",version:"DICOM"},"(0018,9087)":{tag:"(0018,9087)",vr:"FD",name:"DiffusionBValue",vm:"1",version:"DICOM"},"(0018,9089)":{tag:"(0018,9089)",vr:"FD",name:"DiffusionGradientOrientation",vm:"3",version:"DICOM"},"(0018,9090)":{tag:"(0018,9090)",vr:"FD",name:"VelocityEncodingDirection",vm:"3",version:"DICOM"},"(0018,9091)":{tag:"(0018,9091)",vr:"FD",name:"VelocityEncodingMinimumValue",vm:"1",version:"DICOM"},"(0018,9092)":{tag:"(0018,9092)",vr:"SQ",name:"VelocityEncodingAcquisitionSequence",vm:"1",version:"DICOM"},"(0018,9093)":{tag:"(0018,9093)",vr:"US",name:"NumberOfKSpaceTrajectories",vm:"1",version:"DICOM"},"(0018,9094)":{tag:"(0018,9094)",vr:"CS",name:"CoverageOfKSpace",vm:"1",version:"DICOM"},"(0018,9095)":{tag:"(0018,9095)",vr:"UL",name:"SpectroscopyAcquisitionPhaseRows",vm:"1",version:"DICOM"},"(0018,9098)":{tag:"(0018,9098)",vr:"FD",name:"TransmitterFrequency",vm:"1-2",version:"DICOM"},"(0018,9100)":{tag:"(0018,9100)",vr:"CS",name:"ResonantNucleus",vm:"1-2",version:"DICOM"},"(0018,9101)":{tag:"(0018,9101)",vr:"CS",name:"FrequencyCorrection",vm:"1",version:"DICOM"},"(0018,9103)":{tag:"(0018,9103)",vr:"SQ",name:"MRSpectroscopyFOVGeometrySequence",vm:"1",version:"DICOM"},"(0018,9104)":{tag:"(0018,9104)",vr:"FD",name:"SlabThickness",vm:"1",version:"DICOM"},"(0018,9105)":{tag:"(0018,9105)",vr:"FD",name:"SlabOrientation",vm:"3",version:"DICOM"},"(0018,9106)":{tag:"(0018,9106)",vr:"FD",name:"MidSlabPosition",vm:"3",version:"DICOM"},"(0018,9107)":{tag:"(0018,9107)",vr:"SQ",name:"MRSpatialSaturationSequence",vm:"1",version:"DICOM"},"(0018,9112)":{tag:"(0018,9112)",vr:"SQ",name:"MRTimingAndRelatedParametersSequence",vm:"1",version:"DICOM"},"(0018,9114)":{tag:"(0018,9114)",vr:"SQ",name:"MREchoSequence",vm:"1",version:"DICOM"},"(0018,9115)":{tag:"(0018,9115)",vr:"SQ",name:"MRModifierSequence",vm:"1",version:"DICOM"},"(0018,9117)":{tag:"(0018,9117)",vr:"SQ",name:"MRDiffusionSequence",vm:"1",version:"DICOM"},"(0018,9118)":{tag:"(0018,9118)",vr:"SQ",name:"CardiacSynchronizationSequence",vm:"1",version:"DICOM"},"(0018,9119)":{tag:"(0018,9119)",vr:"SQ",name:"MRAveragesSequence",vm:"1",version:"DICOM"},"(0018,9125)":{tag:"(0018,9125)",vr:"SQ",name:"MRFOVGeometrySequence",vm:"1",version:"DICOM"},"(0018,9126)":{tag:"(0018,9126)",vr:"SQ",name:"VolumeLocalizationSequence",vm:"1",version:"DICOM"},"(0018,9127)":{tag:"(0018,9127)",vr:"UL",name:"SpectroscopyAcquisitionDataColumns",vm:"1",version:"DICOM"},"(0018,9147)":{tag:"(0018,9147)",vr:"CS",name:"DiffusionAnisotropyType",vm:"1",version:"DICOM"},"(0018,9151)":{tag:"(0018,9151)",vr:"DT",name:"FrameReferenceDateTime",vm:"1",version:"DICOM"},"(0018,9152)":{tag:"(0018,9152)",vr:"SQ",name:"MRMetaboliteMapSequence",vm:"1",version:"DICOM"},"(0018,9155)":{tag:"(0018,9155)",vr:"FD",name:"ParallelReductionFactorOutOfPlane",vm:"1",version:"DICOM"},"(0018,9159)":{tag:"(0018,9159)",vr:"UL",name:"SpectroscopyAcquisitionOutOfPlanePhaseSteps",vm:"1",version:"DICOM"},"(0018,9168)":{tag:"(0018,9168)",vr:"FD",name:"ParallelReductionFactorSecondInPlane",vm:"1",version:"DICOM"},"(0018,9169)":{tag:"(0018,9169)",vr:"CS",name:"CardiacBeatRejectionTechnique",vm:"1",version:"DICOM"},"(0018,9170)":{tag:"(0018,9170)",vr:"CS",name:"RespiratoryMotionCompensationTechnique",vm:"1",version:"DICOM"},"(0018,9171)":{tag:"(0018,9171)",vr:"CS",name:"RespiratorySignalSource",vm:"1",version:"DICOM"},"(0018,9172)":{tag:"(0018,9172)",vr:"CS",name:"BulkMotionCompensationTechnique",vm:"1",version:"DICOM"},"(0018,9173)":{tag:"(0018,9173)",vr:"CS",name:"BulkMotionSignalSource",vm:"1",version:"DICOM"},"(0018,9174)":{tag:"(0018,9174)",vr:"CS",name:"ApplicableSafetyStandardAgency",vm:"1",version:"DICOM"},"(0018,9175)":{tag:"(0018,9175)",vr:"LO",name:"ApplicableSafetyStandardDescription",vm:"1",version:"DICOM"},"(0018,9176)":{tag:"(0018,9176)",vr:"SQ",name:"OperatingModeSequence",vm:"1",version:"DICOM"},"(0018,9177)":{tag:"(0018,9177)",vr:"CS",name:"OperatingModeType",vm:"1",version:"DICOM"},"(0018,9178)":{tag:"(0018,9178)",vr:"CS",name:"OperatingMode",vm:"1",version:"DICOM"},"(0018,9179)":{tag:"(0018,9179)",vr:"CS",name:"SpecificAbsorptionRateDefinition",vm:"1",version:"DICOM"},"(0018,9180)":{tag:"(0018,9180)",vr:"CS",name:"GradientOutputType",vm:"1",version:"DICOM"},"(0018,9181)":{tag:"(0018,9181)",vr:"FD",name:"SpecificAbsorptionRateValue",vm:"1",version:"DICOM"},"(0018,9182)":{tag:"(0018,9182)",vr:"FD",name:"GradientOutput",vm:"1",version:"DICOM"},"(0018,9183)":{tag:"(0018,9183)",vr:"CS",name:"FlowCompensationDirection",vm:"1",version:"DICOM"},"(0018,9184)":{tag:"(0018,9184)",vr:"FD",name:"TaggingDelay",vm:"1",version:"DICOM"},"(0018,9185)":{tag:"(0018,9185)",vr:"ST",name:"RespiratoryMotionCompensationTechniqueDescription",vm:"1",version:"DICOM"},"(0018,9186)":{tag:"(0018,9186)",vr:"SH",name:"RespiratorySignalSourceID",vm:"1",version:"DICOM"},"(0018,9197)":{tag:"(0018,9197)",vr:"SQ",name:"MRVelocityEncodingSequence",vm:"1",version:"DICOM"},"(0018,9198)":{tag:"(0018,9198)",vr:"CS",name:"FirstOrderPhaseCorrection",vm:"1",version:"DICOM"},"(0018,9199)":{tag:"(0018,9199)",vr:"CS",name:"WaterReferencedPhaseCorrection",vm:"1",version:"DICOM"},"(0018,9200)":{tag:"(0018,9200)",vr:"CS",name:"MRSpectroscopyAcquisitionType",vm:"1",version:"DICOM"},"(0018,9214)":{tag:"(0018,9214)",vr:"CS",name:"RespiratoryCyclePosition",vm:"1",version:"DICOM"},"(0018,9217)":{tag:"(0018,9217)",vr:"FD",name:"VelocityEncodingMaximumValue",vm:"1",version:"DICOM"},"(0018,9218)":{tag:"(0018,9218)",vr:"FD",name:"TagSpacingSecondDimension",vm:"1",version:"DICOM"},"(0018,9219)":{tag:"(0018,9219)",vr:"SS",name:"TagAngleSecondAxis",vm:"1",version:"DICOM"},"(0018,9220)":{tag:"(0018,9220)",vr:"FD",name:"FrameAcquisitionDuration",vm:"1",version:"DICOM"},"(0018,9226)":{tag:"(0018,9226)",vr:"SQ",name:"MRImageFrameTypeSequence",vm:"1",version:"DICOM"},"(0018,9227)":{tag:"(0018,9227)",vr:"SQ",name:"MRSpectroscopyFrameTypeSequence",vm:"1",version:"DICOM"},"(0018,9231)":{tag:"(0018,9231)",vr:"US",name:"MRAcquisitionPhaseEncodingStepsInPlane",vm:"1",version:"DICOM"},"(0018,9232)":{tag:"(0018,9232)",vr:"US",name:"MRAcquisitionPhaseEncodingStepsOutOfPlane",vm:"1",version:"DICOM"},"(0018,9234)":{tag:"(0018,9234)",vr:"UL",name:"SpectroscopyAcquisitionPhaseColumns",vm:"1",version:"DICOM"},"(0018,9236)":{tag:"(0018,9236)",vr:"CS",name:"CardiacCyclePosition",vm:"1",version:"DICOM"},"(0018,9239)":{tag:"(0018,9239)",vr:"SQ",name:"SpecificAbsorptionRateSequence",vm:"1",version:"DICOM"},"(0018,9240)":{tag:"(0018,9240)",vr:"US",name:"RFEchoTrainLength",vm:"1",version:"DICOM"},"(0018,9241)":{tag:"(0018,9241)",vr:"US",name:"GradientEchoTrainLength",vm:"1",version:"DICOM"},"(0018,9250)":{tag:"(0018,9250)",vr:"CS",name:"ArterialSpinLabelingContrast",vm:"1",version:"DICOM"},"(0018,9251)":{tag:"(0018,9251)",vr:"SQ",name:"MRArterialSpinLabelingSequence",vm:"1",version:"DICOM"},"(0018,9252)":{tag:"(0018,9252)",vr:"LO",name:"ASLTechniqueDescription",vm:"1",version:"DICOM"},"(0018,9253)":{tag:"(0018,9253)",vr:"US",name:"ASLSlabNumber",vm:"1",version:"DICOM"},"(0018,9254)":{tag:"(0018,9254)",vr:"FD",name:"ASLSlabThickness",vm:"1",version:"DICOM"},"(0018,9255)":{tag:"(0018,9255)",vr:"FD",name:"ASLSlabOrientation",vm:"3",version:"DICOM"},"(0018,9256)":{tag:"(0018,9256)",vr:"FD",name:"ASLMidSlabPosition",vm:"3",version:"DICOM"},"(0018,9257)":{tag:"(0018,9257)",vr:"CS",name:"ASLContext",vm:"1",version:"DICOM"},"(0018,9258)":{tag:"(0018,9258)",vr:"UL",name:"ASLPulseTrainDuration",vm:"1",version:"DICOM"},"(0018,9259)":{tag:"(0018,9259)",vr:"CS",name:"ASLCrusherFlag",vm:"1",version:"DICOM"},"(0018,925A)":{tag:"(0018,925A)",vr:"FD",name:"ASLCrusherFlowLimit",vm:"1",version:"DICOM"},"(0018,925B)":{tag:"(0018,925B)",vr:"LO",name:"ASLCrusherDescription",vm:"1",version:"DICOM"},"(0018,925C)":{tag:"(0018,925C)",vr:"CS",name:"ASLBolusCutoffFlag",vm:"1",version:"DICOM"},"(0018,925D)":{tag:"(0018,925D)",vr:"SQ",name:"ASLBolusCutoffTimingSequence",vm:"1",version:"DICOM"},"(0018,925E)":{tag:"(0018,925E)",vr:"LO",name:"ASLBolusCutoffTechnique",vm:"1",version:"DICOM"},"(0018,925F)":{tag:"(0018,925F)",vr:"UL",name:"ASLBolusCutoffDelayTime",vm:"1",version:"DICOM"},"(0018,9260)":{tag:"(0018,9260)",vr:"SQ",name:"ASLSlabSequence",vm:"1",version:"DICOM"},"(0018,9295)":{tag:"(0018,9295)",vr:"FD",name:"ChemicalShiftMinimumIntegrationLimitInppm",vm:"1",version:"DICOM"},"(0018,9296)":{tag:"(0018,9296)",vr:"FD",name:"ChemicalShiftMaximumIntegrationLimitInppm",vm:"1",version:"DICOM"},"(0018,9297)":{tag:"(0018,9297)",vr:"CS",name:"WaterReferenceAcquisition",vm:"1",version:"DICOM"},"(0018,9298)":{tag:"(0018,9298)",vr:"IS",name:"EchoPeakPosition",vm:"1",version:"DICOM"},"(0018,9301)":{tag:"(0018,9301)",vr:"SQ",name:"CTAcquisitionTypeSequence",vm:"1",version:"DICOM"},"(0018,9302)":{tag:"(0018,9302)",vr:"CS",name:"AcquisitionType",vm:"1",version:"DICOM"},"(0018,9303)":{tag:"(0018,9303)",vr:"FD",name:"TubeAngle",vm:"1",version:"DICOM"},"(0018,9304)":{tag:"(0018,9304)",vr:"SQ",name:"CTAcquisitionDetailsSequence",vm:"1",version:"DICOM"},"(0018,9305)":{tag:"(0018,9305)",vr:"FD",name:"RevolutionTime",vm:"1",version:"DICOM"},"(0018,9306)":{tag:"(0018,9306)",vr:"FD",name:"SingleCollimationWidth",vm:"1",version:"DICOM"},"(0018,9307)":{tag:"(0018,9307)",vr:"FD",name:"TotalCollimationWidth",vm:"1",version:"DICOM"},"(0018,9308)":{tag:"(0018,9308)",vr:"SQ",name:"CTTableDynamicsSequence",vm:"1",version:"DICOM"},"(0018,9309)":{tag:"(0018,9309)",vr:"FD",name:"TableSpeed",vm:"1",version:"DICOM"},"(0018,9310)":{tag:"(0018,9310)",vr:"FD",name:"TableFeedPerRotation",vm:"1",version:"DICOM"},"(0018,9311)":{tag:"(0018,9311)",vr:"FD",name:"SpiralPitchFactor",vm:"1",version:"DICOM"},"(0018,9312)":{tag:"(0018,9312)",vr:"SQ",name:"CTGeometrySequence",vm:"1",version:"DICOM"},"(0018,9313)":{tag:"(0018,9313)",vr:"FD",name:"DataCollectionCenterPatient",vm:"3",version:"DICOM"},"(0018,9314)":{tag:"(0018,9314)",vr:"SQ",name:"CTReconstructionSequence",vm:"1",version:"DICOM"},"(0018,9315)":{tag:"(0018,9315)",vr:"CS",name:"ReconstructionAlgorithm",vm:"1",version:"DICOM"},"(0018,9316)":{tag:"(0018,9316)",vr:"CS",name:"ConvolutionKernelGroup",vm:"1",version:"DICOM"},"(0018,9317)":{tag:"(0018,9317)",vr:"FD",name:"ReconstructionFieldOfView",vm:"2",version:"DICOM"},"(0018,9318)":{tag:"(0018,9318)",vr:"FD",name:"ReconstructionTargetCenterPatient",vm:"3",version:"DICOM"},"(0018,9319)":{tag:"(0018,9319)",vr:"FD",name:"ReconstructionAngle",vm:"1",version:"DICOM"},"(0018,9320)":{tag:"(0018,9320)",vr:"SH",name:"ImageFilter",vm:"1",version:"DICOM"},"(0018,9321)":{tag:"(0018,9321)",vr:"SQ",name:"CTExposureSequence",vm:"1",version:"DICOM"},"(0018,9322)":{tag:"(0018,9322)",vr:"FD",name:"ReconstructionPixelSpacing",vm:"2",version:"DICOM"},"(0018,9323)":{tag:"(0018,9323)",vr:"CS",name:"ExposureModulationType",vm:"1",version:"DICOM"},"(0018,9324)":{tag:"(0018,9324)",vr:"FD",name:"EstimatedDoseSaving",vm:"1",version:"DICOM"},"(0018,9325)":{tag:"(0018,9325)",vr:"SQ",name:"CTXRayDetailsSequence",vm:"1",version:"DICOM"},"(0018,9326)":{tag:"(0018,9326)",vr:"SQ",name:"CTPositionSequence",vm:"1",version:"DICOM"},"(0018,9327)":{tag:"(0018,9327)",vr:"FD",name:"TablePosition",vm:"1",version:"DICOM"},"(0018,9328)":{tag:"(0018,9328)",vr:"FD",name:"ExposureTimeInms",vm:"1",version:"DICOM"},"(0018,9329)":{tag:"(0018,9329)",vr:"SQ",name:"CTImageFrameTypeSequence",vm:"1",version:"DICOM"},"(0018,9330)":{tag:"(0018,9330)",vr:"FD",name:"XRayTubeCurrentInmA",vm:"1",version:"DICOM"},"(0018,9332)":{tag:"(0018,9332)",vr:"FD",name:"ExposureInmAs",vm:"1",version:"DICOM"},"(0018,9333)":{tag:"(0018,9333)",vr:"CS",name:"ConstantVolumeFlag",vm:"1",version:"DICOM"},"(0018,9334)":{tag:"(0018,9334)",vr:"CS",name:"FluoroscopyFlag",vm:"1",version:"DICOM"},"(0018,9335)":{tag:"(0018,9335)",vr:"FD",name:"DistanceSourceToDataCollectionCenter",vm:"1",version:"DICOM"},"(0018,9337)":{tag:"(0018,9337)",vr:"US",name:"ContrastBolusAgentNumber",vm:"1",version:"DICOM"},"(0018,9338)":{tag:"(0018,9338)",vr:"SQ",name:"ContrastBolusIngredientCodeSequence",vm:"1",version:"DICOM"},"(0018,9340)":{tag:"(0018,9340)",vr:"SQ",name:"ContrastAdministrationProfileSequence",vm:"1",version:"DICOM"},"(0018,9341)":{tag:"(0018,9341)",vr:"SQ",name:"ContrastBolusUsageSequence",vm:"1",version:"DICOM"},"(0018,9342)":{tag:"(0018,9342)",vr:"CS",name:"ContrastBolusAgentAdministered",vm:"1",version:"DICOM"},"(0018,9343)":{tag:"(0018,9343)",vr:"CS",name:"ContrastBolusAgentDetected",vm:"1",version:"DICOM"},"(0018,9344)":{tag:"(0018,9344)",vr:"CS",name:"ContrastBolusAgentPhase",vm:"1",version:"DICOM"},"(0018,9345)":{tag:"(0018,9345)",vr:"FD",name:"CTDIvol",vm:"1",version:"DICOM"},"(0018,9346)":{tag:"(0018,9346)",vr:"SQ",name:"CTDIPhantomTypeCodeSequence",vm:"1",version:"DICOM"},"(0018,9351)":{tag:"(0018,9351)",vr:"FL",name:"CalciumScoringMassFactorPatient",vm:"1",version:"DICOM"},"(0018,9352)":{tag:"(0018,9352)",vr:"FL",name:"CalciumScoringMassFactorDevice",vm:"3",version:"DICOM"},"(0018,9353)":{tag:"(0018,9353)",vr:"FL",name:"EnergyWeightingFactor",vm:"1",version:"DICOM"},"(0018,9360)":{tag:"(0018,9360)",vr:"SQ",name:"CTAdditionalXRaySourceSequence",vm:"1",version:"DICOM"},"(0018,9401)":{tag:"(0018,9401)",vr:"SQ",name:"ProjectionPixelCalibrationSequence",vm:"1",version:"DICOM"},"(0018,9402)":{tag:"(0018,9402)",vr:"FL",name:"DistanceSourceToIsocenter",vm:"1",version:"DICOM"},"(0018,9403)":{tag:"(0018,9403)",vr:"FL",name:"DistanceObjectToTableTop",vm:"1",version:"DICOM"},"(0018,9404)":{tag:"(0018,9404)",vr:"FL",name:"ObjectPixelSpacingInCenterOfBeam",vm:"2",version:"DICOM"},"(0018,9405)":{tag:"(0018,9405)",vr:"SQ",name:"PositionerPositionSequence",vm:"1",version:"DICOM"},"(0018,9406)":{tag:"(0018,9406)",vr:"SQ",name:"TablePositionSequence",vm:"1",version:"DICOM"},"(0018,9407)":{tag:"(0018,9407)",vr:"SQ",name:"CollimatorShapeSequence",vm:"1",version:"DICOM"},"(0018,9410)":{tag:"(0018,9410)",vr:"CS",name:"PlanesInAcquisition",vm:"1",version:"DICOM"},"(0018,9412)":{tag:"(0018,9412)",vr:"SQ",name:"XAXRFFrameCharacteristicsSequence",vm:"1",version:"DICOM"},"(0018,9417)":{tag:"(0018,9417)",vr:"SQ",name:"FrameAcquisitionSequence",vm:"1",version:"DICOM"},"(0018,9420)":{tag:"(0018,9420)",vr:"CS",name:"XRayReceptorType",vm:"1",version:"DICOM"},"(0018,9423)":{tag:"(0018,9423)",vr:"LO",name:"AcquisitionProtocolName",vm:"1",version:"DICOM"},"(0018,9424)":{tag:"(0018,9424)",vr:"LT",name:"AcquisitionProtocolDescription",vm:"1",version:"DICOM"},"(0018,9425)":{tag:"(0018,9425)",vr:"CS",name:"ContrastBolusIngredientOpaque",vm:"1",version:"DICOM"},"(0018,9426)":{tag:"(0018,9426)",vr:"FL",name:"DistanceReceptorPlaneToDetectorHousing",vm:"1",version:"DICOM"},"(0018,9427)":{tag:"(0018,9427)",vr:"CS",name:"IntensifierActiveShape",vm:"1",version:"DICOM"},"(0018,9428)":{tag:"(0018,9428)",vr:"FL",name:"IntensifierActiveDimensions",vm:"1-2",version:"DICOM"},"(0018,9429)":{tag:"(0018,9429)",vr:"FL",name:"PhysicalDetectorSize",vm:"2",version:"DICOM"},"(0018,9430)":{tag:"(0018,9430)",vr:"FL",name:"PositionOfIsocenterProjection",vm:"2",version:"DICOM"},"(0018,9432)":{tag:"(0018,9432)",vr:"SQ",name:"FieldOfViewSequence",vm:"1",version:"DICOM"},"(0018,9433)":{tag:"(0018,9433)",vr:"LO",name:"FieldOfViewDescription",vm:"1",version:"DICOM"},"(0018,9434)":{tag:"(0018,9434)",vr:"SQ",name:"ExposureControlSensingRegionsSequence",vm:"1",version:"DICOM"},"(0018,9435)":{tag:"(0018,9435)",vr:"CS",name:"ExposureControlSensingRegionShape",vm:"1",version:"DICOM"},"(0018,9436)":{tag:"(0018,9436)",vr:"SS",name:"ExposureControlSensingRegionLeftVerticalEdge",vm:"1",version:"DICOM"},"(0018,9437)":{tag:"(0018,9437)",vr:"SS",name:"ExposureControlSensingRegionRightVerticalEdge",vm:"1",version:"DICOM"},"(0018,9438)":{tag:"(0018,9438)",vr:"SS",name:"ExposureControlSensingRegionUpperHorizontalEdge",vm:"1",version:"DICOM"},"(0018,9439)":{tag:"(0018,9439)",vr:"SS",name:"ExposureControlSensingRegionLowerHorizontalEdge",vm:"1",version:"DICOM"},"(0018,9440)":{tag:"(0018,9440)",vr:"SS",name:"CenterOfCircularExposureControlSensingRegion",vm:"2",version:"DICOM"},"(0018,9441)":{tag:"(0018,9441)",vr:"US",name:"RadiusOfCircularExposureControlSensingRegion",vm:"1",version:"DICOM"},"(0018,9442)":{tag:"(0018,9442)",vr:"SS",name:"VerticesOfThePolygonalExposureControlSensingRegion",vm:"2-n",version:"DICOM"},"(0018,9447)":{tag:"(0018,9447)",vr:"FL",name:"ColumnAngulationPatient",vm:"1",version:"DICOM"},"(0018,9449)":{tag:"(0018,9449)",vr:"FL",name:"BeamAngle",vm:"1",version:"DICOM"},"(0018,9451)":{tag:"(0018,9451)",vr:"SQ",name:"FrameDetectorParametersSequence",vm:"1",version:"DICOM"},"(0018,9452)":{tag:"(0018,9452)",vr:"FL",name:"CalculatedAnatomyThickness",vm:"1",version:"DICOM"},"(0018,9455)":{tag:"(0018,9455)",vr:"SQ",name:"CalibrationSequence",vm:"1",version:"DICOM"},"(0018,9456)":{tag:"(0018,9456)",vr:"SQ",name:"ObjectThicknessSequence",vm:"1",version:"DICOM"},"(0018,9457)":{tag:"(0018,9457)",vr:"CS",name:"PlaneIdentification",vm:"1",version:"DICOM"},"(0018,9461)":{tag:"(0018,9461)",vr:"FL",name:"FieldOfViewDimensionsInFloat",vm:"1-2",version:"DICOM"},"(0018,9462)":{tag:"(0018,9462)",vr:"SQ",name:"IsocenterReferenceSystemSequence",vm:"1",version:"DICOM"},"(0018,9463)":{tag:"(0018,9463)",vr:"FL",name:"PositionerIsocenterPrimaryAngle",vm:"1",version:"DICOM"},"(0018,9464)":{tag:"(0018,9464)",vr:"FL",name:"PositionerIsocenterSecondaryAngle",vm:"1",version:"DICOM"},"(0018,9465)":{tag:"(0018,9465)",vr:"FL",name:"PositionerIsocenterDetectorRotationAngle",vm:"1",version:"DICOM"},"(0018,9466)":{tag:"(0018,9466)",vr:"FL",name:"TableXPositionToIsocenter",vm:"1",version:"DICOM"},"(0018,9467)":{tag:"(0018,9467)",vr:"FL",name:"TableYPositionToIsocenter",vm:"1",version:"DICOM"},"(0018,9468)":{tag:"(0018,9468)",vr:"FL",name:"TableZPositionToIsocenter",vm:"1",version:"DICOM"},"(0018,9469)":{tag:"(0018,9469)",vr:"FL",name:"TableHorizontalRotationAngle",vm:"1",version:"DICOM"},"(0018,9470)":{tag:"(0018,9470)",vr:"FL",name:"TableHeadTiltAngle",vm:"1",version:"DICOM"},"(0018,9471)":{tag:"(0018,9471)",vr:"FL",name:"TableCradleTiltAngle",vm:"1",version:"DICOM"},"(0018,9472)":{tag:"(0018,9472)",vr:"SQ",name:"FrameDisplayShutterSequence",vm:"1",version:"DICOM"},"(0018,9473)":{tag:"(0018,9473)",vr:"FL",name:"AcquiredImageAreaDoseProduct",vm:"1",version:"DICOM"},"(0018,9474)":{tag:"(0018,9474)",vr:"CS",name:"CArmPositionerTabletopRelationship",vm:"1",version:"DICOM"},"(0018,9476)":{tag:"(0018,9476)",vr:"SQ",name:"XRayGeometrySequence",vm:"1",version:"DICOM"},"(0018,9477)":{tag:"(0018,9477)",vr:"SQ",name:"IrradiationEventIdentificationSequence",vm:"1",version:"DICOM"},"(0018,9504)":{tag:"(0018,9504)",vr:"SQ",name:"XRay3DFrameTypeSequence",vm:"1",version:"DICOM"},"(0018,9506)":{tag:"(0018,9506)",vr:"SQ",name:"ContributingSourcesSequence",vm:"1",version:"DICOM"},"(0018,9507)":{tag:"(0018,9507)",vr:"SQ",name:"XRay3DAcquisitionSequence",vm:"1",version:"DICOM"},"(0018,9508)":{tag:"(0018,9508)",vr:"FL",name:"PrimaryPositionerScanArc",vm:"1",version:"DICOM"},"(0018,9509)":{tag:"(0018,9509)",vr:"FL",name:"SecondaryPositionerScanArc",vm:"1",version:"DICOM"},"(0018,9510)":{tag:"(0018,9510)",vr:"FL",name:"PrimaryPositionerScanStartAngle",vm:"1",version:"DICOM"},"(0018,9511)":{tag:"(0018,9511)",vr:"FL",name:"SecondaryPositionerScanStartAngle",vm:"1",version:"DICOM"},"(0018,9514)":{tag:"(0018,9514)",vr:"FL",name:"PrimaryPositionerIncrement",vm:"1",version:"DICOM"},"(0018,9515)":{tag:"(0018,9515)",vr:"FL",name:"SecondaryPositionerIncrement",vm:"1",version:"DICOM"},"(0018,9516)":{tag:"(0018,9516)",vr:"DT",name:"StartAcquisitionDateTime",vm:"1",version:"DICOM"},"(0018,9517)":{tag:"(0018,9517)",vr:"DT",name:"EndAcquisitionDateTime",vm:"1",version:"DICOM"},"(0018,9518)":{tag:"(0018,9518)",vr:"SS",name:"PrimaryPositionerIncrementSign",vm:"1",version:"DICOM"},"(0018,9519)":{tag:"(0018,9519)",vr:"SS",name:"SecondaryPositionerIncrementSign",vm:"1",version:"DICOM"},"(0018,9524)":{tag:"(0018,9524)",vr:"LO",name:"ApplicationName",vm:"1",version:"DICOM"},"(0018,9525)":{tag:"(0018,9525)",vr:"LO",name:"ApplicationVersion",vm:"1",version:"DICOM"},"(0018,9526)":{tag:"(0018,9526)",vr:"LO",name:"ApplicationManufacturer",vm:"1",version:"DICOM"},"(0018,9527)":{tag:"(0018,9527)",vr:"CS",name:"AlgorithmType",vm:"1",version:"DICOM"},"(0018,9528)":{tag:"(0018,9528)",vr:"LO",name:"AlgorithmDescription",vm:"1",version:"DICOM"},"(0018,9530)":{tag:"(0018,9530)",vr:"SQ",name:"XRay3DReconstructionSequence",vm:"1",version:"DICOM"},"(0018,9531)":{tag:"(0018,9531)",vr:"LO",name:"ReconstructionDescription",vm:"1",version:"DICOM"},"(0018,9538)":{tag:"(0018,9538)",vr:"SQ",name:"PerProjectionAcquisitionSequence",vm:"1",version:"DICOM"},"(0018,9541)":{tag:"(0018,9541)",vr:"SQ",name:"DetectorPositionSequence",vm:"1",version:"DICOM"},"(0018,9542)":{tag:"(0018,9542)",vr:"SQ",name:"XRayAcquisitionDoseSequence",vm:"1",version:"DICOM"},"(0018,9543)":{tag:"(0018,9543)",vr:"FD",name:"XRaySourceIsocenterPrimaryAngle",vm:"1",version:"DICOM"},"(0018,9544)":{tag:"(0018,9544)",vr:"FD",name:"XRaySourceIsocenterSecondaryAngle",vm:"1",version:"DICOM"},"(0018,9545)":{tag:"(0018,9545)",vr:"FD",name:"BreastSupportIsocenterPrimaryAngle",vm:"1",version:"DICOM"},"(0018,9546)":{tag:"(0018,9546)",vr:"FD",name:"BreastSupportIsocenterSecondaryAngle",vm:"1",version:"DICOM"},"(0018,9547)":{tag:"(0018,9547)",vr:"FD",name:"BreastSupportXPositionToIsocenter",vm:"1",version:"DICOM"},"(0018,9548)":{tag:"(0018,9548)",vr:"FD",name:"BreastSupportYPositionToIsocenter",vm:"1",version:"DICOM"},"(0018,9549)":{tag:"(0018,9549)",vr:"FD",name:"BreastSupportZPositionToIsocenter",vm:"1",version:"DICOM"},"(0018,9550)":{tag:"(0018,9550)",vr:"FD",name:"DetectorIsocenterPrimaryAngle",vm:"1",version:"DICOM"},"(0018,9551)":{tag:"(0018,9551)",vr:"FD",name:"DetectorIsocenterSecondaryAngle",vm:"1",version:"DICOM"},"(0018,9552)":{tag:"(0018,9552)",vr:"FD",name:"DetectorXPositionToIsocenter",vm:"1",version:"DICOM"},"(0018,9553)":{tag:"(0018,9553)",vr:"FD",name:"DetectorYPositionToIsocenter",vm:"1",version:"DICOM"},"(0018,9554)":{tag:"(0018,9554)",vr:"FD",name:"DetectorZPositionToIsocenter",vm:"1",version:"DICOM"},"(0018,9555)":{tag:"(0018,9555)",vr:"SQ",name:"XRayGridSequence",vm:"1",version:"DICOM"},"(0018,9556)":{tag:"(0018,9556)",vr:"SQ",name:"XRayFilterSequence",vm:"1",version:"DICOM"},"(0018,9557)":{tag:"(0018,9557)",vr:"FD",name:"DetectorActiveAreaTLHCPosition",vm:"3",version:"DICOM"},"(0018,9558)":{tag:"(0018,9558)",vr:"FD",name:"DetectorActiveAreaOrientation",vm:"6",version:"DICOM"},"(0018,9559)":{tag:"(0018,9559)",vr:"CS",name:"PositionerPrimaryAngleDirection",vm:"1",version:"DICOM"},"(0018,9601)":{tag:"(0018,9601)",vr:"SQ",name:"DiffusionBMatrixSequence",vm:"1",version:"DICOM"},"(0018,9602)":{tag:"(0018,9602)",vr:"FD",name:"DiffusionBValueXX",vm:"1",version:"DICOM"},"(0018,9603)":{tag:"(0018,9603)",vr:"FD",name:"DiffusionBValueXY",vm:"1",version:"DICOM"},"(0018,9604)":{tag:"(0018,9604)",vr:"FD",name:"DiffusionBValueXZ",vm:"1",version:"DICOM"},"(0018,9605)":{tag:"(0018,9605)",vr:"FD",name:"DiffusionBValueYY",vm:"1",version:"DICOM"},"(0018,9606)":{tag:"(0018,9606)",vr:"FD",name:"DiffusionBValueYZ",vm:"1",version:"DICOM"},"(0018,9607)":{tag:"(0018,9607)",vr:"FD",name:"DiffusionBValueZZ",vm:"1",version:"DICOM"},"(0018,9701)":{tag:"(0018,9701)",vr:"DT",name:"DecayCorrectionDateTime",vm:"1",version:"DICOM"},"(0018,9715)":{tag:"(0018,9715)",vr:"FD",name:"StartDensityThreshold",vm:"1",version:"DICOM"},"(0018,9716)":{tag:"(0018,9716)",vr:"FD",name:"StartRelativeDensityDifferenceThreshold",vm:"1",version:"DICOM"},"(0018,9717)":{tag:"(0018,9717)",vr:"FD",name:"StartCardiacTriggerCountThreshold",vm:"1",version:"DICOM"},"(0018,9718)":{tag:"(0018,9718)",vr:"FD",name:"StartRespiratoryTriggerCountThreshold",vm:"1",version:"DICOM"},"(0018,9719)":{tag:"(0018,9719)",vr:"FD",name:"TerminationCountsThreshold",vm:"1",version:"DICOM"},"(0018,9720)":{tag:"(0018,9720)",vr:"FD",name:"TerminationDensityThreshold",vm:"1",version:"DICOM"},"(0018,9721)":{tag:"(0018,9721)",vr:"FD",name:"TerminationRelativeDensityThreshold",vm:"1",version:"DICOM"},"(0018,9722)":{tag:"(0018,9722)",vr:"FD",name:"TerminationTimeThreshold",vm:"1",version:"DICOM"},"(0018,9723)":{tag:"(0018,9723)",vr:"FD",name:"TerminationCardiacTriggerCountThreshold",vm:"1",version:"DICOM"},"(0018,9724)":{tag:"(0018,9724)",vr:"FD",name:"TerminationRespiratoryTriggerCountThreshold",vm:"1",version:"DICOM"},"(0018,9725)":{tag:"(0018,9725)",vr:"CS",name:"DetectorGeometry",vm:"1",version:"DICOM"},"(0018,9726)":{tag:"(0018,9726)",vr:"FD",name:"TransverseDetectorSeparation",vm:"1",version:"DICOM"},"(0018,9727)":{tag:"(0018,9727)",vr:"FD",name:"AxialDetectorDimension",vm:"1",version:"DICOM"},"(0018,9729)":{tag:"(0018,9729)",vr:"US",name:"RadiopharmaceuticalAgentNumber",vm:"1",version:"DICOM"},"(0018,9732)":{tag:"(0018,9732)",vr:"SQ",name:"PETFrameAcquisitionSequence",vm:"1",version:"DICOM"},"(0018,9733)":{tag:"(0018,9733)",vr:"SQ",name:"PETDetectorMotionDetailsSequence",vm:"1",version:"DICOM"},"(0018,9734)":{tag:"(0018,9734)",vr:"SQ",name:"PETTableDynamicsSequence",vm:"1",version:"DICOM"},"(0018,9735)":{tag:"(0018,9735)",vr:"SQ",name:"PETPositionSequence",vm:"1",version:"DICOM"},"(0018,9736)":{tag:"(0018,9736)",vr:"SQ",name:"PETFrameCorrectionFactorsSequence",vm:"1",version:"DICOM"},"(0018,9737)":{tag:"(0018,9737)",vr:"SQ",name:"RadiopharmaceuticalUsageSequence",vm:"1",version:"DICOM"},"(0018,9738)":{tag:"(0018,9738)",vr:"CS",name:"AttenuationCorrectionSource",vm:"1",version:"DICOM"},"(0018,9739)":{tag:"(0018,9739)",vr:"US",name:"NumberOfIterations",vm:"1",version:"DICOM"},"(0018,9740)":{tag:"(0018,9740)",vr:"US",name:"NumberOfSubsets",vm:"1",version:"DICOM"},"(0018,9749)":{tag:"(0018,9749)",vr:"SQ",name:"PETReconstructionSequence",vm:"1",version:"DICOM"},"(0018,9751)":{tag:"(0018,9751)",vr:"SQ",name:"PETFrameTypeSequence",vm:"1",version:"DICOM"},"(0018,9755)":{tag:"(0018,9755)",vr:"CS",name:"TimeOfFlightInformationUsed",vm:"1",version:"DICOM"},"(0018,9756)":{tag:"(0018,9756)",vr:"CS",name:"ReconstructionType",vm:"1",version:"DICOM"},"(0018,9758)":{tag:"(0018,9758)",vr:"CS",name:"DecayCorrected",vm:"1",version:"DICOM"},"(0018,9759)":{tag:"(0018,9759)",vr:"CS",name:"AttenuationCorrected",vm:"1",version:"DICOM"},"(0018,9760)":{tag:"(0018,9760)",vr:"CS",name:"ScatterCorrected",vm:"1",version:"DICOM"},"(0018,9761)":{tag:"(0018,9761)",vr:"CS",name:"DeadTimeCorrected",vm:"1",version:"DICOM"},"(0018,9762)":{tag:"(0018,9762)",vr:"CS",name:"GantryMotionCorrected",vm:"1",version:"DICOM"},"(0018,9763)":{tag:"(0018,9763)",vr:"CS",name:"PatientMotionCorrected",vm:"1",version:"DICOM"},"(0018,9764)":{tag:"(0018,9764)",vr:"CS",name:"CountLossNormalizationCorrected",vm:"1",version:"DICOM"},"(0018,9765)":{tag:"(0018,9765)",vr:"CS",name:"RandomsCorrected",vm:"1",version:"DICOM"},"(0018,9766)":{tag:"(0018,9766)",vr:"CS",name:"NonUniformRadialSamplingCorrected",vm:"1",version:"DICOM"},"(0018,9767)":{tag:"(0018,9767)",vr:"CS",name:"SensitivityCalibrated",vm:"1",version:"DICOM"},"(0018,9768)":{tag:"(0018,9768)",vr:"CS",name:"DetectorNormalizationCorrection",vm:"1",version:"DICOM"},"(0018,9769)":{tag:"(0018,9769)",vr:"CS",name:"IterativeReconstructionMethod",vm:"1",version:"DICOM"},"(0018,9770)":{tag:"(0018,9770)",vr:"CS",name:"AttenuationCorrectionTemporalRelationship",vm:"1",version:"DICOM"},"(0018,9771)":{tag:"(0018,9771)",vr:"SQ",name:"PatientPhysiologicalStateSequence",vm:"1",version:"DICOM"},"(0018,9772)":{tag:"(0018,9772)",vr:"SQ",name:"PatientPhysiologicalStateCodeSequence",vm:"1",version:"DICOM"},"(0018,9801)":{tag:"(0018,9801)",vr:"FD",name:"DepthsOfFocus",vm:"1-n",version:"DICOM"},"(0018,9803)":{tag:"(0018,9803)",vr:"SQ",name:"ExcludedIntervalsSequence",vm:"1",version:"DICOM"},"(0018,9804)":{tag:"(0018,9804)",vr:"DT",name:"ExclusionStartDateTime",vm:"1",version:"DICOM"},"(0018,9805)":{tag:"(0018,9805)",vr:"FD",name:"ExclusionDuration",vm:"1",version:"DICOM"},"(0018,9806)":{tag:"(0018,9806)",vr:"SQ",name:"USImageDescriptionSequence",vm:"1",version:"DICOM"},"(0018,9807)":{tag:"(0018,9807)",vr:"SQ",name:"ImageDataTypeSequence",vm:"1",version:"DICOM"},"(0018,9808)":{tag:"(0018,9808)",vr:"CS",name:"DataType",vm:"1",version:"DICOM"},"(0018,9809)":{tag:"(0018,9809)",vr:"SQ",name:"TransducerScanPatternCodeSequence",vm:"1",version:"DICOM"},"(0018,980B)":{tag:"(0018,980B)",vr:"CS",name:"AliasedDataType",vm:"1",version:"DICOM"},"(0018,980C)":{tag:"(0018,980C)",vr:"CS",name:"PositionMeasuringDeviceUsed",vm:"1",version:"DICOM"},"(0018,980D)":{tag:"(0018,980D)",vr:"SQ",name:"TransducerGeometryCodeSequence",vm:"1",version:"DICOM"},"(0018,980E)":{tag:"(0018,980E)",vr:"SQ",name:"TransducerBeamSteeringCodeSequence",vm:"1",version:"DICOM"},"(0018,980F)":{tag:"(0018,980F)",vr:"SQ",name:"TransducerApplicationCodeSequence",vm:"1",version:"DICOM"},"(0018,9810)":{tag:"(0018,9810)",vr:"xs",name:"ZeroVelocityPixelValue",vm:"1",version:"DICOM"},"(0018,A001)":{tag:"(0018,A001)",vr:"SQ",name:"ContributingEquipmentSequence",vm:"1",version:"DICOM"},"(0018,A002)":{tag:"(0018,A002)",vr:"DT",name:"ContributionDateTime",vm:"1",version:"DICOM"},"(0018,A003)":{tag:"(0018,A003)",vr:"ST",name:"ContributionDescription",vm:"1",version:"DICOM"},"(0020,000D)":{tag:"(0020,000D)",vr:"UI",name:"StudyInstanceUID",vm:"1",version:"DICOM"},"(0020,000E)":{tag:"(0020,000E)",vr:"UI",name:"SeriesInstanceUID",vm:"1",version:"DICOM"},"(0020,0010)":{tag:"(0020,0010)",vr:"SH",name:"StudyID",vm:"1",version:"DICOM"},"(0020,0011)":{tag:"(0020,0011)",vr:"IS",name:"SeriesNumber",vm:"1",version:"DICOM"},"(0020,0012)":{tag:"(0020,0012)",vr:"IS",name:"AcquisitionNumber",vm:"1",version:"DICOM"},"(0020,0013)":{tag:"(0020,0013)",vr:"IS",name:"InstanceNumber",vm:"1",version:"DICOM"},"(0020,0019)":{tag:"(0020,0019)",vr:"IS",name:"ItemNumber",vm:"1",version:"DICOM"},"(0020,0020)":{tag:"(0020,0020)",vr:"CS",name:"PatientOrientation",vm:"2",version:"DICOM"},"(0020,0032)":{tag:"(0020,0032)",vr:"DS",name:"ImagePositionPatient",vm:"3",version:"DICOM"},"(0020,0037)":{tag:"(0020,0037)",vr:"DS",name:"ImageOrientationPatient",vm:"6",version:"DICOM"},"(0020,0052)":{tag:"(0020,0052)",vr:"UI",name:"FrameOfReferenceUID",vm:"1",version:"DICOM"},"(0020,0060)":{tag:"(0020,0060)",vr:"CS",name:"Laterality",vm:"1",version:"DICOM"},"(0020,0062)":{tag:"(0020,0062)",vr:"CS",name:"ImageLaterality",vm:"1",version:"DICOM"},"(0020,0100)":{tag:"(0020,0100)",vr:"IS",name:"TemporalPositionIdentifier",vm:"1",version:"DICOM"},"(0020,0105)":{tag:"(0020,0105)",vr:"IS",name:"NumberOfTemporalPositions",vm:"1",version:"DICOM"},"(0020,0110)":{tag:"(0020,0110)",vr:"DS",name:"TemporalResolution",vm:"1",version:"DICOM"},"(0020,0200)":{tag:"(0020,0200)",vr:"UI",name:"SynchronizationFrameOfReferenceUID",vm:"1",version:"DICOM"},"(0020,0242)":{tag:"(0020,0242)",vr:"UI",name:"SOPInstanceUIDOfConcatenationSource",vm:"1",version:"DICOM"},"(0020,1002)":{tag:"(0020,1002)",vr:"IS",name:"ImagesInAcquisition",vm:"1",version:"DICOM"},"(0020,1040)":{tag:"(0020,1040)",vr:"LO",name:"PositionReferenceIndicator",vm:"1",version:"DICOM"},"(0020,1041)":{tag:"(0020,1041)",vr:"DS",name:"SliceLocation",vm:"1",version:"DICOM"},"(0020,1200)":{tag:"(0020,1200)",vr:"IS",name:"NumberOfPatientRelatedStudies",vm:"1",version:"DICOM"},"(0020,1202)":{tag:"(0020,1202)",vr:"IS",name:"NumberOfPatientRelatedSeries",vm:"1",version:"DICOM"},"(0020,1204)":{tag:"(0020,1204)",vr:"IS",name:"NumberOfPatientRelatedInstances",vm:"1",version:"DICOM"},"(0020,1206)":{tag:"(0020,1206)",vr:"IS",name:"NumberOfStudyRelatedSeries",vm:"1",version:"DICOM"},"(0020,1208)":{tag:"(0020,1208)",vr:"IS",name:"NumberOfStudyRelatedInstances",vm:"1",version:"DICOM"},"(0020,1209)":{tag:"(0020,1209)",vr:"IS",name:"NumberOfSeriesRelatedInstances",vm:"1",version:"DICOM"},"(0020,4000)":{tag:"(0020,4000)",vr:"LT",name:"ImageComments",vm:"1",version:"DICOM"},"(0020,9056)":{tag:"(0020,9056)",vr:"SH",name:"StackID",vm:"1",version:"DICOM"},"(0020,9057)":{tag:"(0020,9057)",vr:"UL",name:"InStackPositionNumber",vm:"1",version:"DICOM"},"(0020,9071)":{tag:"(0020,9071)",vr:"SQ",name:"FrameAnatomySequence",vm:"1",version:"DICOM"},"(0020,9072)":{tag:"(0020,9072)",vr:"CS",name:"FrameLaterality",vm:"1",version:"DICOM"},"(0020,9111)":{tag:"(0020,9111)",vr:"SQ",name:"FrameContentSequence",vm:"1",version:"DICOM"},"(0020,9113)":{tag:"(0020,9113)",vr:"SQ",name:"PlanePositionSequence",vm:"1",version:"DICOM"},"(0020,9116)":{tag:"(0020,9116)",vr:"SQ",name:"PlaneOrientationSequence",vm:"1",version:"DICOM"},"(0020,9128)":{tag:"(0020,9128)",vr:"UL",name:"TemporalPositionIndex",vm:"1",version:"DICOM"},"(0020,9153)":{tag:"(0020,9153)",vr:"FD",name:"NominalCardiacTriggerDelayTime",vm:"1",version:"DICOM"},"(0020,9154)":{tag:"(0020,9154)",vr:"FL",name:"NominalCardiacTriggerTimePriorToRPeak",vm:"1",version:"DICOM"},"(0020,9155)":{tag:"(0020,9155)",vr:"FL",name:"ActualCardiacTriggerTimePriorToRPeak",vm:"1",version:"DICOM"},"(0020,9156)":{tag:"(0020,9156)",vr:"US",name:"FrameAcquisitionNumber",vm:"1",version:"DICOM"},"(0020,9157)":{tag:"(0020,9157)",vr:"UL",name:"DimensionIndexValues",vm:"1-n",version:"DICOM"},"(0020,9158)":{tag:"(0020,9158)",vr:"LT",name:"FrameComments",vm:"1",version:"DICOM"},"(0020,9161)":{tag:"(0020,9161)",vr:"UI",name:"ConcatenationUID",vm:"1",version:"DICOM"},"(0020,9162)":{tag:"(0020,9162)",vr:"US",name:"InConcatenationNumber",vm:"1",version:"DICOM"},"(0020,9163)":{tag:"(0020,9163)",vr:"US",name:"InConcatenationTotalNumber",vm:"1",version:"DICOM"},"(0020,9164)":{tag:"(0020,9164)",vr:"UI",name:"DimensionOrganizationUID",vm:"1",version:"DICOM"},"(0020,9165)":{tag:"(0020,9165)",vr:"AT",name:"DimensionIndexPointer",vm:"1",version:"DICOM"},"(0020,9167)":{tag:"(0020,9167)",vr:"AT",name:"FunctionalGroupPointer",vm:"1",version:"DICOM"},"(0020,9170)":{tag:"(0020,9170)",vr:"SQ",name:"UnassignedSharedConvertedAttributesSequence",vm:"1",version:"DICOM"},"(0020,9171)":{tag:"(0020,9171)",vr:"SQ",name:"UnassignedPerFrameConvertedAttributesSequence",vm:"1",version:"DICOM"},"(0020,9172)":{tag:"(0020,9172)",vr:"SQ",name:"ConversionSourceAttributesSequence",vm:"1",version:"DICOM"},"(0020,9213)":{tag:"(0020,9213)",vr:"LO",name:"DimensionIndexPrivateCreator",vm:"1",version:"DICOM"},"(0020,9221)":{tag:"(0020,9221)",vr:"SQ",name:"DimensionOrganizationSequence",vm:"1",version:"DICOM"},"(0020,9222)":{tag:"(0020,9222)",vr:"SQ",name:"DimensionIndexSequence",vm:"1",version:"DICOM"},"(0020,9228)":{tag:"(0020,9228)",vr:"UL",name:"ConcatenationFrameOffsetNumber",vm:"1",version:"DICOM"},"(0020,9238)":{tag:"(0020,9238)",vr:"LO",name:"FunctionalGroupPrivateCreator",vm:"1",version:"DICOM"},"(0020,9241)":{tag:"(0020,9241)",vr:"FL",name:"NominalPercentageOfCardiacPhase",vm:"1",version:"DICOM"},"(0020,9245)":{tag:"(0020,9245)",vr:"FL",name:"NominalPercentageOfRespiratoryPhase",vm:"1",version:"DICOM"},"(0020,9246)":{tag:"(0020,9246)",vr:"FL",name:"StartingRespiratoryAmplitude",vm:"1",version:"DICOM"},"(0020,9247)":{tag:"(0020,9247)",vr:"CS",name:"StartingRespiratoryPhase",vm:"1",version:"DICOM"},"(0020,9248)":{tag:"(0020,9248)",vr:"FL",name:"EndingRespiratoryAmplitude",vm:"1",version:"DICOM"},"(0020,9249)":{tag:"(0020,9249)",vr:"CS",name:"EndingRespiratoryPhase",vm:"1",version:"DICOM"},"(0020,9250)":{tag:"(0020,9250)",vr:"CS",name:"RespiratoryTriggerType",vm:"1",version:"DICOM"},"(0020,9251)":{tag:"(0020,9251)",vr:"FD",name:"RRIntervalTimeNominal",vm:"1",version:"DICOM"},"(0020,9252)":{tag:"(0020,9252)",vr:"FD",name:"ActualCardiacTriggerDelayTime",vm:"1",version:"DICOM"},"(0020,9253)":{tag:"(0020,9253)",vr:"SQ",name:"RespiratorySynchronizationSequence",vm:"1",version:"DICOM"},"(0020,9254)":{tag:"(0020,9254)",vr:"FD",name:"RespiratoryIntervalTime",vm:"1",version:"DICOM"},"(0020,9255)":{tag:"(0020,9255)",vr:"FD",name:"NominalRespiratoryTriggerDelayTime",vm:"1",version:"DICOM"},"(0020,9256)":{tag:"(0020,9256)",vr:"FD",name:"RespiratoryTriggerDelayThreshold",vm:"1",version:"DICOM"},"(0020,9257)":{tag:"(0020,9257)",vr:"FD",name:"ActualRespiratoryTriggerDelayTime",vm:"1",version:"DICOM"},"(0020,9301)":{tag:"(0020,9301)",vr:"FD",name:"ImagePositionVolume",vm:"3",version:"DICOM"},"(0020,9302)":{tag:"(0020,9302)",vr:"FD",name:"ImageOrientationVolume",vm:"6",version:"DICOM"},"(0020,9307)":{tag:"(0020,9307)",vr:"CS",name:"UltrasoundAcquisitionGeometry",vm:"1",version:"DICOM"},"(0020,9308)":{tag:"(0020,9308)",vr:"FD",name:"ApexPosition",vm:"3",version:"DICOM"},"(0020,9309)":{tag:"(0020,9309)",vr:"FD",name:"VolumeToTransducerMappingMatrix",vm:"16",version:"DICOM"},"(0020,930A)":{tag:"(0020,930A)",vr:"FD",name:"VolumeToTableMappingMatrix",vm:"16",version:"DICOM"},"(0020,930B)":{tag:"(0020,930B)",vr:"CS",name:"VolumeToTransducerRelationship",vm:"1",version:"DICOM"},"(0020,930C)":{tag:"(0020,930C)",vr:"CS",name:"PatientFrameOfReferenceSource",vm:"1",version:"DICOM"},"(0020,930D)":{tag:"(0020,930D)",vr:"FD",name:"TemporalPositionTimeOffset",vm:"1",version:"DICOM"},"(0020,930E)":{tag:"(0020,930E)",vr:"SQ",name:"PlanePositionVolumeSequence",vm:"1",version:"DICOM"},"(0020,930F)":{tag:"(0020,930F)",vr:"SQ",name:"PlaneOrientationVolumeSequence",vm:"1",version:"DICOM"},"(0020,9310)":{tag:"(0020,9310)",vr:"SQ",name:"TemporalPositionSequence",vm:"1",version:"DICOM"},"(0020,9311)":{tag:"(0020,9311)",vr:"CS",name:"DimensionOrganizationType",vm:"1",version:"DICOM"},"(0020,9312)":{tag:"(0020,9312)",vr:"UI",name:"VolumeFrameOfReferenceUID",vm:"1",version:"DICOM"},"(0020,9313)":{tag:"(0020,9313)",vr:"UI",name:"TableFrameOfReferenceUID",vm:"1",version:"DICOM"},"(0020,9421)":{tag:"(0020,9421)",vr:"LO",name:"DimensionDescriptionLabel",vm:"1",version:"DICOM"},"(0020,9450)":{tag:"(0020,9450)",vr:"SQ",name:"PatientOrientationInFrameSequence",vm:"1",version:"DICOM"},"(0020,9453)":{tag:"(0020,9453)",vr:"LO",name:"FrameLabel",vm:"1",version:"DICOM"},"(0020,9518)":{tag:"(0020,9518)",vr:"US",name:"AcquisitionIndex",vm:"1-n",version:"DICOM"},"(0020,9529)":{tag:"(0020,9529)",vr:"SQ",name:"ContributingSOPInstancesReferenceSequence",vm:"1",version:"DICOM"},"(0020,9536)":{tag:"(0020,9536)",vr:"US",name:"ReconstructionIndex",vm:"1",version:"DICOM"},"(0022,0001)":{tag:"(0022,0001)",vr:"US",name:"LightPathFilterPassThroughWavelength",vm:"1",version:"DICOM"},"(0022,0002)":{tag:"(0022,0002)",vr:"US",name:"LightPathFilterPassBand",vm:"2",version:"DICOM"},"(0022,0003)":{tag:"(0022,0003)",vr:"US",name:"ImagePathFilterPassThroughWavelength",vm:"1",version:"DICOM"},"(0022,0004)":{tag:"(0022,0004)",vr:"US",name:"ImagePathFilterPassBand",vm:"2",version:"DICOM"},"(0022,0005)":{tag:"(0022,0005)",vr:"CS",name:"PatientEyeMovementCommanded",vm:"1",version:"DICOM"},"(0022,0006)":{tag:"(0022,0006)",vr:"SQ",name:"PatientEyeMovementCommandCodeSequence",vm:"1",version:"DICOM"},"(0022,0007)":{tag:"(0022,0007)",vr:"FL",name:"SphericalLensPower",vm:"1",version:"DICOM"},"(0022,0008)":{tag:"(0022,0008)",vr:"FL",name:"CylinderLensPower",vm:"1",version:"DICOM"},"(0022,0009)":{tag:"(0022,0009)",vr:"FL",name:"CylinderAxis",vm:"1",version:"DICOM"},"(0022,000A)":{tag:"(0022,000A)",vr:"FL",name:"EmmetropicMagnification",vm:"1",version:"DICOM"},"(0022,000B)":{tag:"(0022,000B)",vr:"FL",name:"IntraOcularPressure",vm:"1",version:"DICOM"},"(0022,000C)":{tag:"(0022,000C)",vr:"FL",name:"HorizontalFieldOfView",vm:"1",version:"DICOM"},"(0022,000D)":{tag:"(0022,000D)",vr:"CS",name:"PupilDilated",vm:"1",version:"DICOM"},"(0022,000E)":{tag:"(0022,000E)",vr:"FL",name:"DegreeOfDilation",vm:"1",version:"DICOM"},"(0022,0010)":{tag:"(0022,0010)",vr:"FL",name:"StereoBaselineAngle",vm:"1",version:"DICOM"},"(0022,0011)":{tag:"(0022,0011)",vr:"FL",name:"StereoBaselineDisplacement",vm:"1",version:"DICOM"},"(0022,0012)":{tag:"(0022,0012)",vr:"FL",name:"StereoHorizontalPixelOffset",vm:"1",version:"DICOM"},"(0022,0013)":{tag:"(0022,0013)",vr:"FL",name:"StereoVerticalPixelOffset",vm:"1",version:"DICOM"},"(0022,0014)":{tag:"(0022,0014)",vr:"FL",name:"StereoRotation",vm:"1",version:"DICOM"},"(0022,0015)":{tag:"(0022,0015)",vr:"SQ",name:"AcquisitionDeviceTypeCodeSequence",vm:"1",version:"DICOM"},"(0022,0016)":{tag:"(0022,0016)",vr:"SQ",name:"IlluminationTypeCodeSequence",vm:"1",version:"DICOM"},"(0022,0017)":{tag:"(0022,0017)",vr:"SQ",name:"LightPathFilterTypeStackCodeSequence",vm:"1",version:"DICOM"},"(0022,0018)":{tag:"(0022,0018)",vr:"SQ",name:"ImagePathFilterTypeStackCodeSequence",vm:"1",version:"DICOM"},"(0022,0019)":{tag:"(0022,0019)",vr:"SQ",name:"LensesCodeSequence",vm:"1",version:"DICOM"},"(0022,001A)":{tag:"(0022,001A)",vr:"SQ",name:"ChannelDescriptionCodeSequence",vm:"1",version:"DICOM"},"(0022,001B)":{tag:"(0022,001B)",vr:"SQ",name:"RefractiveStateSequence",vm:"1",version:"DICOM"},"(0022,001C)":{tag:"(0022,001C)",vr:"SQ",name:"MydriaticAgentCodeSequence",vm:"1",version:"DICOM"},"(0022,001D)":{tag:"(0022,001D)",vr:"SQ",name:"RelativeImagePositionCodeSequence",vm:"1",version:"DICOM"},"(0022,001E)":{tag:"(0022,001E)",vr:"FL",name:"CameraAngleOfView",vm:"1",version:"DICOM"},"(0022,0020)":{tag:"(0022,0020)",vr:"SQ",name:"StereoPairsSequence",vm:"1",version:"DICOM"},"(0022,0021)":{tag:"(0022,0021)",vr:"SQ",name:"LeftImageSequence",vm:"1",version:"DICOM"},"(0022,0022)":{tag:"(0022,0022)",vr:"SQ",name:"RightImageSequence",vm:"1",version:"DICOM"},"(0022,0028)":{tag:"(0022,0028)",vr:"CS",name:"StereoPairsPresent",vm:"1",version:"DICOM"},"(0022,0030)":{tag:"(0022,0030)",vr:"FL",name:"AxialLengthOfTheEye",vm:"1",version:"DICOM"},"(0022,0031)":{tag:"(0022,0031)",vr:"SQ",name:"OphthalmicFrameLocationSequence",vm:"1",version:"DICOM"},"(0022,0032)":{tag:"(0022,0032)",vr:"FL",name:"ReferenceCoordinates",vm:"2-2n",version:"DICOM"},"(0022,0035)":{tag:"(0022,0035)",vr:"FL",name:"DepthSpatialResolution",vm:"1",version:"DICOM"},"(0022,0036)":{tag:"(0022,0036)",vr:"FL",name:"MaximumDepthDistortion",vm:"1",version:"DICOM"},"(0022,0037)":{tag:"(0022,0037)",vr:"FL",name:"AlongScanSpatialResolution",vm:"1",version:"DICOM"},"(0022,0038)":{tag:"(0022,0038)",vr:"FL",name:"MaximumAlongScanDistortion",vm:"1",version:"DICOM"},"(0022,0039)":{tag:"(0022,0039)",vr:"CS",name:"OphthalmicImageOrientation",vm:"1",version:"DICOM"},"(0022,0041)":{tag:"(0022,0041)",vr:"FL",name:"DepthOfTransverseImage",vm:"1",version:"DICOM"},"(0022,0042)":{tag:"(0022,0042)",vr:"SQ",name:"MydriaticAgentConcentrationUnitsSequence",vm:"1",version:"DICOM"},"(0022,0048)":{tag:"(0022,0048)",vr:"FL",name:"AcrossScanSpatialResolution",vm:"1",version:"DICOM"},"(0022,0049)":{tag:"(0022,0049)",vr:"FL",name:"MaximumAcrossScanDistortion",vm:"1",version:"DICOM"},"(0022,004E)":{tag:"(0022,004E)",vr:"DS",name:"MydriaticAgentConcentration",vm:"1",version:"DICOM"},"(0022,0055)":{tag:"(0022,0055)",vr:"FL",name:"IlluminationWaveLength",vm:"1",version:"DICOM"},"(0022,0056)":{tag:"(0022,0056)",vr:"FL",name:"IlluminationPower",vm:"1",version:"DICOM"},"(0022,0057)":{tag:"(0022,0057)",vr:"FL",name:"IlluminationBandwidth",vm:"1",version:"DICOM"},"(0022,0058)":{tag:"(0022,0058)",vr:"SQ",name:"MydriaticAgentSequence",vm:"1",version:"DICOM"},"(0022,1007)":{tag:"(0022,1007)",vr:"SQ",name:"OphthalmicAxialMeasurementsRightEyeSequence",vm:"1",version:"DICOM"},"(0022,1008)":{tag:"(0022,1008)",vr:"SQ",name:"OphthalmicAxialMeasurementsLeftEyeSequence",vm:"1",version:"DICOM"},"(0022,1009)":{tag:"(0022,1009)",vr:"CS",name:"OphthalmicAxialMeasurementsDeviceType",vm:"1",version:"DICOM"},"(0022,1010)":{tag:"(0022,1010)",vr:"CS",name:"OphthalmicAxialLengthMeasurementsType",vm:"1",version:"DICOM"},"(0022,1012)":{tag:"(0022,1012)",vr:"SQ",name:"OphthalmicAxialLengthSequence",vm:"1",version:"DICOM"},"(0022,1019)":{tag:"(0022,1019)",vr:"FL",name:"OphthalmicAxialLength",vm:"1",version:"DICOM"},"(0022,1024)":{tag:"(0022,1024)",vr:"SQ",name:"LensStatusCodeSequence",vm:"1",version:"DICOM"},"(0022,1025)":{tag:"(0022,1025)",vr:"SQ",name:"VitreousStatusCodeSequence",vm:"1",version:"DICOM"},"(0022,1028)":{tag:"(0022,1028)",vr:"SQ",name:"IOLFormulaCodeSequence",vm:"1",version:"DICOM"},"(0022,1029)":{tag:"(0022,1029)",vr:"LO",name:"IOLFormulaDetail",vm:"1",version:"DICOM"},"(0022,1033)":{tag:"(0022,1033)",vr:"FL",name:"KeratometerIndex",vm:"1",version:"DICOM"},"(0022,1035)":{tag:"(0022,1035)",vr:"SQ",name:"SourceOfOphthalmicAxialLengthCodeSequence",vm:"1",version:"DICOM"},"(0022,1037)":{tag:"(0022,1037)",vr:"FL",name:"TargetRefraction",vm:"1",version:"DICOM"},"(0022,1039)":{tag:"(0022,1039)",vr:"CS",name:"RefractiveProcedureOccurred",vm:"1",version:"DICOM"},"(0022,1040)":{tag:"(0022,1040)",vr:"SQ",name:"RefractiveSurgeryTypeCodeSequence",vm:"1",version:"DICOM"},"(0022,1044)":{tag:"(0022,1044)",vr:"SQ",name:"OphthalmicUltrasoundMethodCodeSequence",vm:"1",version:"DICOM"},"(0022,1050)":{tag:"(0022,1050)",vr:"SQ",name:"OphthalmicAxialLengthMeasurementsSequence",vm:"1",version:"DICOM"},"(0022,1053)":{tag:"(0022,1053)",vr:"FL",name:"IOLPower",vm:"1",version:"DICOM"},"(0022,1054)":{tag:"(0022,1054)",vr:"FL",name:"PredictedRefractiveError",vm:"1",version:"DICOM"},"(0022,1059)":{tag:"(0022,1059)",vr:"FL",name:"OphthalmicAxialLengthVelocity",vm:"1",version:"DICOM"},"(0022,1065)":{tag:"(0022,1065)",vr:"LO",name:"LensStatusDescription",vm:"1",version:"DICOM"},"(0022,1066)":{tag:"(0022,1066)",vr:"LO",name:"VitreousStatusDescription",vm:"1",version:"DICOM"},"(0022,1090)":{tag:"(0022,1090)",vr:"SQ",name:"IOLPowerSequence",vm:"1",version:"DICOM"},"(0022,1092)":{tag:"(0022,1092)",vr:"SQ",name:"LensConstantSequence",vm:"1",version:"DICOM"},"(0022,1093)":{tag:"(0022,1093)",vr:"LO",name:"IOLManufacturer",vm:"1",version:"DICOM"},"(0022,1095)":{tag:"(0022,1095)",vr:"LO",name:"ImplantName",vm:"1",version:"DICOM"},"(0022,1096)":{tag:"(0022,1096)",vr:"SQ",name:"KeratometryMeasurementTypeCodeSequence",vm:"1",version:"DICOM"},"(0022,1097)":{tag:"(0022,1097)",vr:"LO",name:"ImplantPartNumber",vm:"1",version:"DICOM"},"(0022,1100)":{tag:"(0022,1100)",vr:"SQ",name:"ReferencedOphthalmicAxialMeasurementsSequence",vm:"1",version:"DICOM"},"(0022,1101)":{tag:"(0022,1101)",vr:"SQ",name:"OphthalmicAxialLengthMeasurementsSegmentNameCodeSequence",vm:"1",version:"DICOM"},"(0022,1103)":{tag:"(0022,1103)",vr:"SQ",name:"RefractiveErrorBeforeRefractiveSurgeryCodeSequence",vm:"1",version:"DICOM"},"(0022,1121)":{tag:"(0022,1121)",vr:"FL",name:"IOLPowerForExactEmmetropia",vm:"1",version:"DICOM"},"(0022,1122)":{tag:"(0022,1122)",vr:"FL",name:"IOLPowerForExactTargetRefraction",vm:"1",version:"DICOM"},"(0022,1125)":{tag:"(0022,1125)",vr:"SQ",name:"AnteriorChamberDepthDefinitionCodeSequence",vm:"1",version:"DICOM"},"(0022,1127)":{tag:"(0022,1127)",vr:"SQ",name:"LensThicknessSequence",vm:"1",version:"DICOM"},"(0022,1128)":{tag:"(0022,1128)",vr:"SQ",name:"AnteriorChamberDepthSequence",vm:"1",version:"DICOM"},"(0022,1130)":{tag:"(0022,1130)",vr:"FL",name:"LensThickness",vm:"1",version:"DICOM"},"(0022,1131)":{tag:"(0022,1131)",vr:"FL",name:"AnteriorChamberDepth",vm:"1",version:"DICOM"},"(0022,1132)":{tag:"(0022,1132)",vr:"SQ",name:"SourceOfLensThicknessDataCodeSequence",vm:"1",version:"DICOM"},"(0022,1133)":{tag:"(0022,1133)",vr:"SQ",name:"SourceOfAnteriorChamberDepthDataCodeSequence",vm:"1",version:"DICOM"},"(0022,1134)":{tag:"(0022,1134)",vr:"SQ",name:"SourceOfRefractiveMeasurementsSequence",vm:"1",version:"DICOM"},"(0022,1135)":{tag:"(0022,1135)",vr:"SQ",name:"SourceOfRefractiveMeasurementsCodeSequence",vm:"1",version:"DICOM"},"(0022,1140)":{tag:"(0022,1140)",vr:"CS",name:"OphthalmicAxialLengthMeasurementModified",vm:"1",version:"DICOM"},"(0022,1150)":{tag:"(0022,1150)",vr:"SQ",name:"OphthalmicAxialLengthDataSourceCodeSequence",vm:"1",version:"DICOM"},"(0022,1155)":{tag:"(0022,1155)",vr:"FL",name:"SignalToNoiseRatio",vm:"1",version:"DICOM"},"(0022,1159)":{tag:"(0022,1159)",vr:"LO",name:"OphthalmicAxialLengthDataSourceDescription",vm:"1",version:"DICOM"},"(0022,1210)":{tag:"(0022,1210)",vr:"SQ",name:"OphthalmicAxialLengthMeasurementsTotalLengthSequence",vm:"1",version:"DICOM"},"(0022,1211)":{tag:"(0022,1211)",vr:"SQ",name:"OphthalmicAxialLengthMeasurementsSegmentalLengthSequence",vm:"1",version:"DICOM"},"(0022,1212)":{tag:"(0022,1212)",vr:"SQ",name:"OphthalmicAxialLengthMeasurementsLengthSummationSequence",vm:"1",version:"DICOM"},"(0022,1220)":{tag:"(0022,1220)",vr:"SQ",name:"UltrasoundOphthalmicAxialLengthMeasurementsSequence",vm:"1",version:"DICOM"},"(0022,1225)":{tag:"(0022,1225)",vr:"SQ",name:"OpticalOphthalmicAxialLengthMeasurementsSequence",vm:"1",version:"DICOM"},"(0022,1230)":{tag:"(0022,1230)",vr:"SQ",name:"UltrasoundSelectedOphthalmicAxialLengthSequence",vm:"1",version:"DICOM"},"(0022,1250)":{tag:"(0022,1250)",vr:"SQ",name:"OphthalmicAxialLengthSelectionMethodCodeSequence",vm:"1",version:"DICOM"},"(0022,1255)":{tag:"(0022,1255)",vr:"SQ",name:"OpticalSelectedOphthalmicAxialLengthSequence",vm:"1",version:"DICOM"},"(0022,1257)":{tag:"(0022,1257)",vr:"SQ",name:"SelectedSegmentalOphthalmicAxialLengthSequence",vm:"1",version:"DICOM"},"(0022,1260)":{tag:"(0022,1260)",vr:"SQ",name:"SelectedTotalOphthalmicAxialLengthSequence",vm:"1",version:"DICOM"},"(0022,1262)":{tag:"(0022,1262)",vr:"SQ",name:"OphthalmicAxialLengthQualityMetricSequence",vm:"1",version:"DICOM"},"(0022,1300)":{tag:"(0022,1300)",vr:"SQ",name:"IntraocularLensCalculationsRightEyeSequence",vm:"1",version:"DICOM"},"(0022,1310)":{tag:"(0022,1310)",vr:"SQ",name:"IntraocularLensCalculationsLeftEyeSequence",vm:"1",version:"DICOM"},"(0022,1330)":{tag:"(0022,1330)",vr:"SQ",name:"ReferencedOphthalmicAxialLengthMeasurementQCImageSequence",vm:"1",version:"DICOM"},"(0022,1415)":{tag:"(0022,1415)",vr:"CS",name:"OphthalmicMappingDeviceType",vm:"1",version:"DICOM"},"(0022,1420)":{tag:"(0022,1420)",vr:"SQ",name:"AcquisitionMethodCodeSequence",vm:"1",version:"DICOM"},"(0022,1423)":{tag:"(0022,1423)",vr:"SQ",name:"AcquisitionMethodAlgorithmSequence",vm:"1",version:"DICOM"},"(0022,1436)":{tag:"(0022,1436)",vr:"SQ",name:"OphthalmicThicknessMapTypeCodeSequence",vm:"1",version:"DICOM"},"(0022,1443)":{tag:"(0022,1443)",vr:"SQ",name:"OphthalmicThicknessMappingNormalsSequence",vm:"1",version:"DICOM"},"(0022,1445)":{tag:"(0022,1445)",vr:"SQ",name:"RetinalThicknessDefinitionCodeSequence",vm:"1",version:"DICOM"},"(0022,1450)":{tag:"(0022,1450)",vr:"SQ",name:"PixelValueMappingToCodedConceptSequence",vm:"1",version:"DICOM"},"(0022,1452)":{tag:"(0022,1452)",vr:"xs",name:"MappedPixelValue",vm:"1",version:"DICOM"},"(0022,1454)":{tag:"(0022,1454)",vr:"LO",name:"PixelValueMappingExplanation",vm:"1",version:"DICOM"},"(0022,1458)":{tag:"(0022,1458)",vr:"SQ",name:"OphthalmicThicknessMapQualityThresholdSequence",vm:"1",version:"DICOM"},"(0022,1460)":{tag:"(0022,1460)",vr:"FL",name:"OphthalmicThicknessMapThresholdQualityRating",vm:"1",version:"DICOM"},"(0022,1463)":{tag:"(0022,1463)",vr:"FL",name:"AnatomicStructureReferencePoint",vm:"2",version:"DICOM"},"(0022,1465)":{tag:"(0022,1465)",vr:"SQ",name:"RegistrationToLocalizerSequence",vm:"1",version:"DICOM"},"(0022,1466)":{tag:"(0022,1466)",vr:"CS",name:"RegisteredLocalizerUnits",vm:"1",version:"DICOM"},"(0022,1467)":{tag:"(0022,1467)",vr:"FL",name:"RegisteredLocalizerTopLeftHandCorner",vm:"2",version:"DICOM"},"(0022,1468)":{tag:"(0022,1468)",vr:"FL",name:"RegisteredLocalizerBottomRightHandCorner",vm:"2",version:"DICOM"},"(0022,1470)":{tag:"(0022,1470)",vr:"SQ",name:"OphthalmicThicknessMapQualityRatingSequence",vm:"1",version:"DICOM"},"(0022,1472)":{tag:"(0022,1472)",vr:"SQ",name:"RelevantOPTAttributesSequence",vm:"1",version:"DICOM"},"(0022,1512)":{tag:"(0022,1512)",vr:"SQ",name:"TransformationMethodCodeSequence",vm:"1",version:"DICOM"},"(0022,1513)":{tag:"(0022,1513)",vr:"SQ",name:"TransformationAlgorithmSequence",vm:"1",version:"DICOM"},"(0022,1515)":{tag:"(0022,1515)",vr:"CS",name:"OphthalmicAxialLengthMethod",vm:"1",version:"DICOM"},"(0022,1517)":{tag:"(0022,1517)",vr:"FL",name:"OphthalmicFOV",vm:"1",version:"DICOM"},"(0022,1518)":{tag:"(0022,1518)",vr:"SQ",name:"TwoDimensionalToThreeDimensionalMapSequence",vm:"1",version:"DICOM"},"(0022,1525)":{tag:"(0022,1525)",vr:"SQ",name:"WideFieldOphthalmicPhotographyQualityRatingSequence",vm:"1",version:"DICOM"},"(0022,1526)":{tag:"(0022,1526)",vr:"SQ",name:"WideFieldOphthalmicPhotographyQualityThresholdSequence",vm:"1",version:"DICOM"},"(0022,1527)":{tag:"(0022,1527)",vr:"FL",name:"WideFieldOphthalmicPhotographyThresholdQualityRating",vm:"1",version:"DICOM"},"(0022,1528)":{tag:"(0022,1528)",vr:"FL",name:"XCoordinatesCenterPixelViewAngle",vm:"1",version:"DICOM"},"(0022,1529)":{tag:"(0022,1529)",vr:"FL",name:"YCoordinatesCenterPixelViewAngle",vm:"1",version:"DICOM"},"(0022,1530)":{tag:"(0022,1530)",vr:"UL",name:"NumberOfMapPoints",vm:"1",version:"DICOM"},"(0022,1531)":{tag:"(0022,1531)",vr:"OF",name:"TwoDimensionalToThreeDimensionalMapData",vm:"1",version:"DICOM"},"(0024,0010)":{tag:"(0024,0010)",vr:"FL",name:"VisualFieldHorizontalExtent",vm:"1",version:"DICOM"},"(0024,0011)":{tag:"(0024,0011)",vr:"FL",name:"VisualFieldVerticalExtent",vm:"1",version:"DICOM"},"(0024,0012)":{tag:"(0024,0012)",vr:"CS",name:"VisualFieldShape",vm:"1",version:"DICOM"},"(0024,0016)":{tag:"(0024,0016)",vr:"SQ",name:"ScreeningTestModeCodeSequence",vm:"1",version:"DICOM"},"(0024,0018)":{tag:"(0024,0018)",vr:"FL",name:"MaximumStimulusLuminance",vm:"1",version:"DICOM"},"(0024,0020)":{tag:"(0024,0020)",vr:"FL",name:"BackgroundLuminance",vm:"1",version:"DICOM"},"(0024,0021)":{tag:"(0024,0021)",vr:"SQ",name:"StimulusColorCodeSequence",vm:"1",version:"DICOM"},"(0024,0024)":{tag:"(0024,0024)",vr:"SQ",name:"BackgroundIlluminationColorCodeSequence",vm:"1",version:"DICOM"},"(0024,0025)":{tag:"(0024,0025)",vr:"FL",name:"StimulusArea",vm:"1",version:"DICOM"},"(0024,0028)":{tag:"(0024,0028)",vr:"FL",name:"StimulusPresentationTime",vm:"1",version:"DICOM"},"(0024,0032)":{tag:"(0024,0032)",vr:"SQ",name:"FixationSequence",vm:"1",version:"DICOM"},"(0024,0033)":{tag:"(0024,0033)",vr:"SQ",name:"FixationMonitoringCodeSequence",vm:"1",version:"DICOM"},"(0024,0034)":{tag:"(0024,0034)",vr:"SQ",name:"VisualFieldCatchTrialSequence",vm:"1",version:"DICOM"},"(0024,0035)":{tag:"(0024,0035)",vr:"US",name:"FixationCheckedQuantity",vm:"1",version:"DICOM"},"(0024,0036)":{tag:"(0024,0036)",vr:"US",name:"PatientNotProperlyFixatedQuantity",vm:"1",version:"DICOM"},"(0024,0037)":{tag:"(0024,0037)",vr:"CS",name:"PresentedVisualStimuliDataFlag",vm:"1",version:"DICOM"},"(0024,0038)":{tag:"(0024,0038)",vr:"US",name:"NumberOfVisualStimuli",vm:"1",version:"DICOM"},"(0024,0039)":{tag:"(0024,0039)",vr:"CS",name:"ExcessiveFixationLossesDataFlag",vm:"1",version:"DICOM"},"(0024,0040)":{tag:"(0024,0040)",vr:"CS",name:"ExcessiveFixationLosses",vm:"1",version:"DICOM"},"(0024,0042)":{tag:"(0024,0042)",vr:"US",name:"StimuliRetestingQuantity",vm:"1",version:"DICOM"},"(0024,0044)":{tag:"(0024,0044)",vr:"LT",name:"CommentsOnPatientPerformanceOfVisualField",vm:"1",version:"DICOM"},"(0024,0045)":{tag:"(0024,0045)",vr:"CS",name:"FalseNegativesEstimateFlag",vm:"1",version:"DICOM"},"(0024,0046)":{tag:"(0024,0046)",vr:"FL",name:"FalseNegativesEstimate",vm:"1",version:"DICOM"},"(0024,0048)":{tag:"(0024,0048)",vr:"US",name:"NegativeCatchTrialsQuantity",vm:"1",version:"DICOM"},"(0024,0050)":{tag:"(0024,0050)",vr:"US",name:"FalseNegativesQuantity",vm:"1",version:"DICOM"},"(0024,0051)":{tag:"(0024,0051)",vr:"CS",name:"ExcessiveFalseNegativesDataFlag",vm:"1",version:"DICOM"},"(0024,0052)":{tag:"(0024,0052)",vr:"CS",name:"ExcessiveFalseNegatives",vm:"1",version:"DICOM"},"(0024,0053)":{tag:"(0024,0053)",vr:"CS",name:"FalsePositivesEstimateFlag",vm:"1",version:"DICOM"},"(0024,0054)":{tag:"(0024,0054)",vr:"FL",name:"FalsePositivesEstimate",vm:"1",version:"DICOM"},"(0024,0055)":{tag:"(0024,0055)",vr:"CS",name:"CatchTrialsDataFlag",vm:"1",version:"DICOM"},"(0024,0056)":{tag:"(0024,0056)",vr:"US",name:"PositiveCatchTrialsQuantity",vm:"1",version:"DICOM"},"(0024,0057)":{tag:"(0024,0057)",vr:"CS",name:"TestPointNormalsDataFlag",vm:"1",version:"DICOM"},"(0024,0058)":{tag:"(0024,0058)",vr:"SQ",name:"TestPointNormalsSequence",vm:"1",version:"DICOM"},"(0024,0059)":{tag:"(0024,0059)",vr:"CS",name:"GlobalDeviationProbabilityNormalsFlag",vm:"1",version:"DICOM"},"(0024,0060)":{tag:"(0024,0060)",vr:"US",name:"FalsePositivesQuantity",vm:"1",version:"DICOM"},"(0024,0061)":{tag:"(0024,0061)",vr:"CS",name:"ExcessiveFalsePositivesDataFlag",vm:"1",version:"DICOM"},"(0024,0062)":{tag:"(0024,0062)",vr:"CS",name:"ExcessiveFalsePositives",vm:"1",version:"DICOM"},"(0024,0063)":{tag:"(0024,0063)",vr:"CS",name:"VisualFieldTestNormalsFlag",vm:"1",version:"DICOM"},"(0024,0064)":{tag:"(0024,0064)",vr:"SQ",name:"ResultsNormalsSequence",vm:"1",version:"DICOM"},"(0024,0065)":{tag:"(0024,0065)",vr:"SQ",name:"AgeCorrectedSensitivityDeviationAlgorithmSequence",vm:"1",version:"DICOM"},"(0024,0066)":{tag:"(0024,0066)",vr:"FL",name:"GlobalDeviationFromNormal",vm:"1",version:"DICOM"},"(0024,0067)":{tag:"(0024,0067)",vr:"SQ",name:"GeneralizedDefectSensitivityDeviationAlgorithmSequence",vm:"1",version:"DICOM"},"(0024,0068)":{tag:"(0024,0068)",vr:"FL",name:"LocalizedDeviationFromNormal",vm:"1",version:"DICOM"},"(0024,0069)":{tag:"(0024,0069)",vr:"LO",name:"PatientReliabilityIndicator",vm:"1",version:"DICOM"},"(0024,0070)":{tag:"(0024,0070)",vr:"FL",name:"VisualFieldMeanSensitivity",vm:"1",version:"DICOM"},"(0024,0071)":{tag:"(0024,0071)",vr:"FL",name:"GlobalDeviationProbability",vm:"1",version:"DICOM"},"(0024,0072)":{tag:"(0024,0072)",vr:"CS",name:"LocalDeviationProbabilityNormalsFlag",vm:"1",version:"DICOM"},"(0024,0073)":{tag:"(0024,0073)",vr:"FL",name:"LocalizedDeviationProbability",vm:"1",version:"DICOM"},"(0024,0074)":{tag:"(0024,0074)",vr:"CS",name:"ShortTermFluctuationCalculated",vm:"1",version:"DICOM"},"(0024,0075)":{tag:"(0024,0075)",vr:"FL",name:"ShortTermFluctuation",vm:"1",version:"DICOM"},"(0024,0076)":{tag:"(0024,0076)",vr:"CS",name:"ShortTermFluctuationProbabilityCalculated",vm:"1",version:"DICOM"},"(0024,0077)":{tag:"(0024,0077)",vr:"FL",name:"ShortTermFluctuationProbability",vm:"1",version:"DICOM"},"(0024,0078)":{tag:"(0024,0078)",vr:"CS",name:"CorrectedLocalizedDeviationFromNormalCalculated",vm:"1",version:"DICOM"},"(0024,0079)":{tag:"(0024,0079)",vr:"FL",name:"CorrectedLocalizedDeviationFromNormal",vm:"1",version:"DICOM"},"(0024,0080)":{tag:"(0024,0080)",vr:"CS",name:"CorrectedLocalizedDeviationFromNormalProbabilityCalculated",vm:"1",version:"DICOM"},"(0024,0081)":{tag:"(0024,0081)",vr:"FL",name:"CorrectedLocalizedDeviationFromNormalProbability",vm:"1",version:"DICOM"},"(0024,0083)":{tag:"(0024,0083)",vr:"SQ",name:"GlobalDeviationProbabilitySequence",vm:"1",version:"DICOM"},"(0024,0085)":{tag:"(0024,0085)",vr:"SQ",name:"LocalizedDeviationProbabilitySequence",vm:"1",version:"DICOM"},"(0024,0086)":{tag:"(0024,0086)",vr:"CS",name:"FovealSensitivityMeasured",vm:"1",version:"DICOM"},"(0024,0087)":{tag:"(0024,0087)",vr:"FL",name:"FovealSensitivity",vm:"1",version:"DICOM"},"(0024,0088)":{tag:"(0024,0088)",vr:"FL",name:"VisualFieldTestDuration",vm:"1",version:"DICOM"},"(0024,0089)":{tag:"(0024,0089)",vr:"SQ",name:"VisualFieldTestPointSequence",vm:"1",version:"DICOM"},"(0024,0090)":{tag:"(0024,0090)",vr:"FL",name:"VisualFieldTestPointXCoordinate",vm:"1",version:"DICOM"},"(0024,0091)":{tag:"(0024,0091)",vr:"FL",name:"VisualFieldTestPointYCoordinate",vm:"1",version:"DICOM"},"(0024,0092)":{tag:"(0024,0092)",vr:"FL",name:"AgeCorrectedSensitivityDeviationValue",vm:"1",version:"DICOM"},"(0024,0093)":{tag:"(0024,0093)",vr:"CS",name:"StimulusResults",vm:"1",version:"DICOM"},"(0024,0094)":{tag:"(0024,0094)",vr:"FL",name:"SensitivityValue",vm:"1",version:"DICOM"},"(0024,0095)":{tag:"(0024,0095)",vr:"CS",name:"RetestStimulusSeen",vm:"1",version:"DICOM"},"(0024,0096)":{tag:"(0024,0096)",vr:"FL",name:"RetestSensitivityValue",vm:"1",version:"DICOM"},"(0024,0097)":{tag:"(0024,0097)",vr:"SQ",name:"VisualFieldTestPointNormalsSequence",vm:"1",version:"DICOM"},"(0024,0098)":{tag:"(0024,0098)",vr:"FL",name:"QuantifiedDefect",vm:"1",version:"DICOM"},"(0024,0100)":{tag:"(0024,0100)",vr:"FL",name:"AgeCorrectedSensitivityDeviationProbabilityValue",vm:"1",version:"DICOM"},"(0024,0102)":{tag:"(0024,0102)",vr:"CS",name:"GeneralizedDefectCorrectedSensitivityDeviationFlag",vm:"1",version:"DICOM"},"(0024,0103)":{tag:"(0024,0103)",vr:"FL",name:"GeneralizedDefectCorrectedSensitivityDeviationValue",vm:"1",version:"DICOM"},"(0024,0104)":{tag:"(0024,0104)",vr:"FL",name:"GeneralizedDefectCorrectedSensitivityDeviationProbabilityValue",vm:"1",version:"DICOM"},"(0024,0105)":{tag:"(0024,0105)",vr:"FL",name:"MinimumSensitivityValue",vm:"1",version:"DICOM"},"(0024,0106)":{tag:"(0024,0106)",vr:"CS",name:"BlindSpotLocalized",vm:"1",version:"DICOM"},"(0024,0107)":{tag:"(0024,0107)",vr:"FL",name:"BlindSpotXCoordinate",vm:"1",version:"DICOM"},"(0024,0108)":{tag:"(0024,0108)",vr:"FL",name:"BlindSpotYCoordinate",vm:"1",version:"DICOM"},"(0024,0110)":{tag:"(0024,0110)",vr:"SQ",name:"VisualAcuityMeasurementSequence",vm:"1",version:"DICOM"},"(0024,0112)":{tag:"(0024,0112)",vr:"SQ",name:"RefractiveParametersUsedOnPatientSequence",vm:"1",version:"DICOM"},"(0024,0113)":{tag:"(0024,0113)",vr:"CS",name:"MeasurementLaterality",vm:"1",version:"DICOM"},"(0024,0114)":{tag:"(0024,0114)",vr:"SQ",name:"OphthalmicPatientClinicalInformationLeftEyeSequence",vm:"1",version:"DICOM"},"(0024,0115)":{tag:"(0024,0115)",vr:"SQ",name:"OphthalmicPatientClinicalInformationRightEyeSequence",vm:"1",version:"DICOM"},"(0024,0117)":{tag:"(0024,0117)",vr:"CS",name:"FovealPointNormativeDataFlag",vm:"1",version:"DICOM"},"(0024,0118)":{tag:"(0024,0118)",vr:"FL",name:"FovealPointProbabilityValue",vm:"1",version:"DICOM"},"(0024,0120)":{tag:"(0024,0120)",vr:"CS",name:"ScreeningBaselineMeasured",vm:"1",version:"DICOM"},"(0024,0122)":{tag:"(0024,0122)",vr:"SQ",name:"ScreeningBaselineMeasuredSequence",vm:"1",version:"DICOM"},"(0024,0124)":{tag:"(0024,0124)",vr:"CS",name:"ScreeningBaselineType",vm:"1",version:"DICOM"},"(0024,0126)":{tag:"(0024,0126)",vr:"FL",name:"ScreeningBaselineValue",vm:"1",version:"DICOM"},"(0024,0202)":{tag:"(0024,0202)",vr:"LO",name:"AlgorithmSource",vm:"1",version:"DICOM"},"(0024,0306)":{tag:"(0024,0306)",vr:"LO",name:"DataSetName",vm:"1",version:"DICOM"},"(0024,0307)":{tag:"(0024,0307)",vr:"LO",name:"DataSetVersion",vm:"1",version:"DICOM"},"(0024,0308)":{tag:"(0024,0308)",vr:"LO",name:"DataSetSource",vm:"1",version:"DICOM"},"(0024,0309)":{tag:"(0024,0309)",vr:"LO",name:"DataSetDescription",vm:"1",version:"DICOM"},"(0024,0317)":{tag:"(0024,0317)",vr:"SQ",name:"VisualFieldTestReliabilityGlobalIndexSequence",vm:"1",version:"DICOM"},"(0024,0320)":{tag:"(0024,0320)",vr:"SQ",name:"VisualFieldGlobalResultsIndexSequence",vm:"1",version:"DICOM"},"(0024,0325)":{tag:"(0024,0325)",vr:"SQ",name:"DataObservationSequence",vm:"1",version:"DICOM"},"(0024,0338)":{tag:"(0024,0338)",vr:"CS",name:"IndexNormalsFlag",vm:"1",version:"DICOM"},"(0024,0341)":{tag:"(0024,0341)",vr:"FL",name:"IndexProbability",vm:"1",version:"DICOM"},"(0024,0344)":{tag:"(0024,0344)",vr:"SQ",name:"IndexProbabilitySequence",vm:"1",version:"DICOM"},"(0028,0002)":{tag:"(0028,0002)",vr:"US",name:"SamplesPerPixel",vm:"1",version:"DICOM"},"(0028,0003)":{tag:"(0028,0003)",vr:"US",name:"SamplesPerPixelUsed",vm:"1",version:"DICOM"},"(0028,0004)":{tag:"(0028,0004)",vr:"CS",name:"PhotometricInterpretation",vm:"1",version:"DICOM"},"(0028,0006)":{tag:"(0028,0006)",vr:"US",name:"PlanarConfiguration",vm:"1",version:"DICOM"},"(0028,0008)":{tag:"(0028,0008)",vr:"IS",name:"NumberOfFrames",vm:"1",version:"DICOM"},"(0028,0009)":{tag:"(0028,0009)",vr:"AT",name:"FrameIncrementPointer",vm:"1-n",version:"DICOM"},"(0028,000A)":{tag:"(0028,000A)",vr:"AT",name:"FrameDimensionPointer",vm:"1-n",version:"DICOM"},"(0028,0010)":{tag:"(0028,0010)",vr:"US",name:"Rows",vm:"1",version:"DICOM"},"(0028,0011)":{tag:"(0028,0011)",vr:"US",name:"Columns",vm:"1",version:"DICOM"},"(0028,0014)":{tag:"(0028,0014)",vr:"US",name:"UltrasoundColorDataPresent",vm:"1",version:"DICOM"},"(0028,0030)":{tag:"(0028,0030)",vr:"DS",name:"PixelSpacing",vm:"2",version:"DICOM"},"(0028,0031)":{tag:"(0028,0031)",vr:"DS",name:"ZoomFactor",vm:"2",version:"DICOM"},"(0028,0032)":{tag:"(0028,0032)",vr:"DS",name:"ZoomCenter",vm:"2",version:"DICOM"},"(0028,0034)":{tag:"(0028,0034)",vr:"IS",name:"PixelAspectRatio",vm:"2",version:"DICOM"},"(0028,0051)":{tag:"(0028,0051)",vr:"CS",name:"CorrectedImage",vm:"1-n",version:"DICOM"},"(0028,0100)":{tag:"(0028,0100)",vr:"US",name:"BitsAllocated",vm:"1",version:"DICOM"},"(0028,0101)":{tag:"(0028,0101)",vr:"US",name:"BitsStored",vm:"1",version:"DICOM"},"(0028,0102)":{tag:"(0028,0102)",vr:"US",name:"HighBit",vm:"1",version:"DICOM"},"(0028,0103)":{tag:"(0028,0103)",vr:"US",name:"PixelRepresentation",vm:"1",version:"DICOM"},"(0028,0106)":{tag:"(0028,0106)",vr:"xs",name:"SmallestImagePixelValue",vm:"1",version:"DICOM"},"(0028,0107)":{tag:"(0028,0107)",vr:"xs",name:"LargestImagePixelValue",vm:"1",version:"DICOM"},"(0028,0108)":{tag:"(0028,0108)",vr:"xs",name:"SmallestPixelValueInSeries",vm:"1",version:"DICOM"},"(0028,0109)":{tag:"(0028,0109)",vr:"xs",name:"LargestPixelValueInSeries",vm:"1",version:"DICOM"},"(0028,0120)":{tag:"(0028,0120)",vr:"xs",name:"PixelPaddingValue",vm:"1",version:"DICOM"},"(0028,0121)":{tag:"(0028,0121)",vr:"xs",name:"PixelPaddingRangeLimit",vm:"1",version:"DICOM"},"(0028,0122)":{tag:"(0028,0122)",vr:"FL",name:"FloatPixelPaddingValue",vm:"1",version:"DICOM"},"(0028,0123)":{tag:"(0028,0123)",vr:"FD",name:"DoubleFloatPixelPaddingValue",vm:"1",version:"DICOM"},"(0028,0124)":{tag:"(0028,0124)",vr:"FL",name:"FloatPixelPaddingRangeLimit",vm:"1",version:"DICOM"},"(0028,0125)":{tag:"(0028,0125)",vr:"FD",name:"DoubleFloatPixelPaddingRangeLimit",vm:"1",version:"DICOM"},"(0028,0300)":{tag:"(0028,0300)",vr:"CS",name:"QualityControlImage",vm:"1",version:"DICOM"},"(0028,0301)":{tag:"(0028,0301)",vr:"CS",name:"BurnedInAnnotation",vm:"1",version:"DICOM"},"(0028,0302)":{tag:"(0028,0302)",vr:"CS",name:"RecognizableVisualFeatures",vm:"1",version:"DICOM"},"(0028,0303)":{tag:"(0028,0303)",vr:"CS",name:"LongitudinalTemporalInformationModified",vm:"1",version:"DICOM"},"(0028,0304)":{tag:"(0028,0304)",vr:"UI",name:"ReferencedColorPaletteInstanceUID",vm:"1",version:"DICOM"},"(0028,0A02)":{tag:"(0028,0A02)",vr:"CS",name:"PixelSpacingCalibrationType",vm:"1",version:"DICOM"},"(0028,0A04)":{tag:"(0028,0A04)",vr:"LO",name:"PixelSpacingCalibrationDescription",vm:"1",version:"DICOM"},"(0028,1040)":{tag:"(0028,1040)",vr:"CS",name:"PixelIntensityRelationship",vm:"1",version:"DICOM"},"(0028,1041)":{tag:"(0028,1041)",vr:"SS",name:"PixelIntensityRelationshipSign",vm:"1",version:"DICOM"},"(0028,1050)":{tag:"(0028,1050)",vr:"DS",name:"WindowCenter",vm:"1-n",version:"DICOM"},"(0028,1051)":{tag:"(0028,1051)",vr:"DS",name:"WindowWidth",vm:"1-n",version:"DICOM"},"(0028,1052)":{tag:"(0028,1052)",vr:"DS",name:"RescaleIntercept",vm:"1",version:"DICOM"},"(0028,1053)":{tag:"(0028,1053)",vr:"DS",name:"RescaleSlope",vm:"1",version:"DICOM"},"(0028,1054)":{tag:"(0028,1054)",vr:"LO",name:"RescaleType",vm:"1",version:"DICOM"},"(0028,1055)":{tag:"(0028,1055)",vr:"LO",name:"WindowCenterWidthExplanation",vm:"1-n",version:"DICOM"},"(0028,1056)":{tag:"(0028,1056)",vr:"CS",name:"VOILUTFunction",vm:"1",version:"DICOM"},"(0028,1090)":{tag:"(0028,1090)",vr:"CS",name:"RecommendedViewingMode",vm:"1",version:"DICOM"},"(0028,1101)":{tag:"(0028,1101)",vr:"xs",name:"RedPaletteColorLookupTableDescriptor",vm:"3",version:"DICOM"},"(0028,1102)":{tag:"(0028,1102)",vr:"xs",name:"GreenPaletteColorLookupTableDescriptor",vm:"3",version:"DICOM"},"(0028,1103)":{tag:"(0028,1103)",vr:"xs",name:"BluePaletteColorLookupTableDescriptor",vm:"3",version:"DICOM"},"(0028,1104)":{tag:"(0028,1104)",vr:"US",name:"AlphaPaletteColorLookupTableDescriptor",vm:"3",version:"DICOM"},"(0028,1199)":{tag:"(0028,1199)",vr:"UI",name:"PaletteColorLookupTableUID",vm:"1",version:"DICOM"},"(0028,1201)":{tag:"(0028,1201)",vr:"OW",name:"RedPaletteColorLookupTableData",vm:"1",version:"DICOM"},"(0028,1202)":{tag:"(0028,1202)",vr:"OW",name:"GreenPaletteColorLookupTableData",vm:"1",version:"DICOM"},"(0028,1203)":{tag:"(0028,1203)",vr:"OW",name:"BluePaletteColorLookupTableData",vm:"1",version:"DICOM"},"(0028,1204)":{tag:"(0028,1204)",vr:"OW",name:"AlphaPaletteColorLookupTableData",vm:"1",version:"DICOM"},"(0028,1221)":{tag:"(0028,1221)",vr:"OW",name:"SegmentedRedPaletteColorLookupTableData",vm:"1",version:"DICOM"},"(0028,1222)":{tag:"(0028,1222)",vr:"OW",name:"SegmentedGreenPaletteColorLookupTableData",vm:"1",version:"DICOM"},"(0028,1223)":{tag:"(0028,1223)",vr:"OW",name:"SegmentedBluePaletteColorLookupTableData",vm:"1",version:"DICOM"},"(0028,1300)":{tag:"(0028,1300)",vr:"CS",name:"BreastImplantPresent",vm:"1",version:"DICOM"},"(0028,1350)":{tag:"(0028,1350)",vr:"CS",name:"PartialView",vm:"1",version:"DICOM"},"(0028,1351)":{tag:"(0028,1351)",vr:"ST",name:"PartialViewDescription",vm:"1",version:"DICOM"},"(0028,1352)":{tag:"(0028,1352)",vr:"SQ",name:"PartialViewCodeSequence",vm:"1",version:"DICOM"},"(0028,135A)":{tag:"(0028,135A)",vr:"CS",name:"SpatialLocationsPreserved",vm:"1",version:"DICOM"},"(0028,1401)":{tag:"(0028,1401)",vr:"SQ",name:"DataFrameAssignmentSequence",vm:"1",version:"DICOM"},"(0028,1402)":{tag:"(0028,1402)",vr:"CS",name:"DataPathAssignment",vm:"1",version:"DICOM"},"(0028,1403)":{tag:"(0028,1403)",vr:"US",name:"BitsMappedToColorLookupTable",vm:"1",version:"DICOM"},"(0028,1404)":{tag:"(0028,1404)",vr:"SQ",name:"BlendingLUT1Sequence",vm:"1",version:"DICOM"},"(0028,1405)":{tag:"(0028,1405)",vr:"CS",name:"BlendingLUT1TransferFunction",vm:"1",version:"DICOM"},"(0028,1406)":{tag:"(0028,1406)",vr:"FD",name:"BlendingWeightConstant",vm:"1",version:"DICOM"},"(0028,1407)":{tag:"(0028,1407)",vr:"US",name:"BlendingLookupTableDescriptor",vm:"3",version:"DICOM"},"(0028,1408)":{tag:"(0028,1408)",vr:"OW",name:"BlendingLookupTableData",vm:"1",version:"DICOM"},"(0028,140B)":{tag:"(0028,140B)",vr:"SQ",name:"EnhancedPaletteColorLookupTableSequence",vm:"1",version:"DICOM"},"(0028,140C)":{tag:"(0028,140C)",vr:"SQ",name:"BlendingLUT2Sequence",vm:"1",version:"DICOM"},"(0028,140D)":{tag:"(0028,140D)",vr:"CS",name:"BlendingLUT2TransferFunction",vm:"1",version:"DICOM"},"(0028,140E)":{tag:"(0028,140E)",vr:"CS",name:"DataPathID",vm:"1",version:"DICOM"},"(0028,140F)":{tag:"(0028,140F)",vr:"CS",name:"RGBLUTTransferFunction",vm:"1",version:"DICOM"},"(0028,1410)":{tag:"(0028,1410)",vr:"CS",name:"AlphaLUTTransferFunction",vm:"1",version:"DICOM"},"(0028,2000)":{tag:"(0028,2000)",vr:"OB",name:"ICCProfile",vm:"1",version:"DICOM"},"(0028,2110)":{tag:"(0028,2110)",vr:"CS",name:"LossyImageCompression",vm:"1",version:"DICOM"},"(0028,2112)":{tag:"(0028,2112)",vr:"DS",name:"LossyImageCompressionRatio",vm:"1-n",version:"DICOM"},"(0028,2114)":{tag:"(0028,2114)",vr:"CS",name:"LossyImageCompressionMethod",vm:"1-n",version:"DICOM"},"(0028,3000)":{tag:"(0028,3000)",vr:"SQ",name:"ModalityLUTSequence",vm:"1",version:"DICOM"},"(0028,3002)":{tag:"(0028,3002)",vr:"xs",name:"LUTDescriptor",vm:"3",version:"DICOM"},"(0028,3003)":{tag:"(0028,3003)",vr:"LO",name:"LUTExplanation",vm:"1",version:"DICOM"},"(0028,3004)":{tag:"(0028,3004)",vr:"LO",name:"ModalityLUTType",vm:"1",version:"DICOM"},"(0028,3006)":{tag:"(0028,3006)",vr:"lt",name:"LUTData",vm:"1-n",version:"DICOM"},"(0028,3010)":{tag:"(0028,3010)",vr:"SQ",name:"VOILUTSequence",vm:"1",version:"DICOM"},"(0028,3110)":{tag:"(0028,3110)",vr:"SQ",name:"SoftcopyVOILUTSequence",vm:"1",version:"DICOM"},"(0028,6010)":{tag:"(0028,6010)",vr:"US",name:"RepresentativeFrameNumber",vm:"1",version:"DICOM"},"(0028,6020)":{tag:"(0028,6020)",vr:"US",name:"FrameNumbersOfInterest",vm:"1-n",version:"DICOM"},"(0028,6022)":{tag:"(0028,6022)",vr:"LO",name:"FrameOfInterestDescription",vm:"1-n",version:"DICOM"},"(0028,6023)":{tag:"(0028,6023)",vr:"CS",name:"FrameOfInterestType",vm:"1-n",version:"DICOM"},"(0028,6040)":{tag:"(0028,6040)",vr:"US",name:"RWavePointer",vm:"1-n",version:"DICOM"},"(0028,6100)":{tag:"(0028,6100)",vr:"SQ",name:"MaskSubtractionSequence",vm:"1",version:"DICOM"},"(0028,6101)":{tag:"(0028,6101)",vr:"CS",name:"MaskOperation",vm:"1",version:"DICOM"},"(0028,6102)":{tag:"(0028,6102)",vr:"US",name:"ApplicableFrameRange",vm:"2-2n",version:"DICOM"},"(0028,6110)":{tag:"(0028,6110)",vr:"US",name:"MaskFrameNumbers",vm:"1-n",version:"DICOM"},"(0028,6112)":{tag:"(0028,6112)",vr:"US",name:"ContrastFrameAveraging",vm:"1",version:"DICOM"},"(0028,6114)":{tag:"(0028,6114)",vr:"FL",name:"MaskSubPixelShift",vm:"2",version:"DICOM"},"(0028,6120)":{tag:"(0028,6120)",vr:"SS",name:"TIDOffset",vm:"1",version:"DICOM"},"(0028,6190)":{tag:"(0028,6190)",vr:"ST",name:"MaskOperationExplanation",vm:"1",version:"DICOM"},"(0028,7000)":{tag:"(0028,7000)",vr:"SQ",name:"EquipmentAdministratorSequence",vm:"1",version:"DICOM"},"(0028,7001)":{tag:"(0028,7001)",vr:"US",name:"NumberOfDisplaySubsystems",vm:"1",version:"DICOM"},"(0028,7002)":{tag:"(0028,7002)",vr:"US",name:"CurrentConfigurationID",vm:"1",version:"DICOM"},"(0028,7003)":{tag:"(0028,7003)",vr:"US",name:"DisplaySubsystemID",vm:"1",version:"DICOM"},"(0028,7004)":{tag:"(0028,7004)",vr:"SH",name:"DisplaySubsystemName",vm:"1",version:"DICOM"},"(0028,7005)":{tag:"(0028,7005)",vr:"LO",name:"DisplaySubsystemDescription",vm:"1",version:"DICOM"},"(0028,7006)":{tag:"(0028,7006)",vr:"CS",name:"SystemStatus",vm:"1",version:"DICOM"},"(0028,7007)":{tag:"(0028,7007)",vr:"LO",name:"SystemStatusComment",vm:"1",version:"DICOM"},"(0028,7008)":{tag:"(0028,7008)",vr:"SQ",name:"TargetLuminanceCharacteristicsSequence",vm:"1",version:"DICOM"},"(0028,7009)":{tag:"(0028,7009)",vr:"US",name:"LuminanceCharacteristicsID",vm:"1",version:"DICOM"},"(0028,700A)":{tag:"(0028,700A)",vr:"SQ",name:"DisplaySubsystemConfigurationSequence",vm:"1",version:"DICOM"},"(0028,700B)":{tag:"(0028,700B)",vr:"US",name:"ConfigurationID",vm:"1",version:"DICOM"},"(0028,700C)":{tag:"(0028,700C)",vr:"SH",name:"ConfigurationName",vm:"1",version:"DICOM"},"(0028,700D)":{tag:"(0028,700D)",vr:"LO",name:"ConfigurationDescription",vm:"1",version:"DICOM"},"(0028,700E)":{tag:"(0028,700E)",vr:"US",name:"ReferencedTargetLuminanceCharacteristicsID",vm:"1",version:"DICOM"},"(0028,700F)":{tag:"(0028,700F)",vr:"SQ",name:"QAResultsSequence",vm:"1",version:"DICOM"},"(0028,7010)":{tag:"(0028,7010)",vr:"SQ",name:"DisplaySubsystemQAResultsSequence",vm:"1",version:"DICOM"},"(0028,7011)":{tag:"(0028,7011)",vr:"SQ",name:"ConfigurationQAResultsSequence",vm:"1",version:"DICOM"},"(0028,7012)":{tag:"(0028,7012)",vr:"SQ",name:"MeasurementEquipmentSequence",vm:"1",version:"DICOM"},"(0028,7013)":{tag:"(0028,7013)",vr:"CS",name:"MeasurementFunctions",vm:"1-n",version:"DICOM"},"(0028,7014)":{tag:"(0028,7014)",vr:"CS",name:"MeasurementEquipmentType",vm:"1",version:"DICOM"},"(0028,7015)":{tag:"(0028,7015)",vr:"SQ",name:"VisualEvaluationResultSequence",vm:"1",version:"DICOM"},"(0028,7016)":{tag:"(0028,7016)",vr:"SQ",name:"DisplayCalibrationResultSequence",vm:"1",version:"DICOM"},"(0028,7017)":{tag:"(0028,7017)",vr:"US",name:"DDLValue",vm:"1",version:"DICOM"},"(0028,7018)":{tag:"(0028,7018)",vr:"FL",name:"CIExyWhitePoint",vm:"2",version:"DICOM"},"(0028,7019)":{tag:"(0028,7019)",vr:"CS",name:"DisplayFunctionType",vm:"1",version:"DICOM"},"(0028,701A)":{tag:"(0028,701A)",vr:"FL",name:"GammaValue",vm:"1",version:"DICOM"},"(0028,701B)":{tag:"(0028,701B)",vr:"US",name:"NumberOfLuminancePoints",vm:"1",version:"DICOM"},"(0028,701C)":{tag:"(0028,701C)",vr:"SQ",name:"LuminanceResponseSequence",vm:"1",version:"DICOM"},"(0028,701D)":{tag:"(0028,701D)",vr:"FL",name:"TargetMinimumLuminance",vm:"1",version:"DICOM"},"(0028,701E)":{tag:"(0028,701E)",vr:"FL",name:"TargetMaximumLuminance",vm:"1",version:"DICOM"},"(0028,701F)":{tag:"(0028,701F)",vr:"FL",name:"LuminanceValue",vm:"1",version:"DICOM"},"(0028,7020)":{tag:"(0028,7020)",vr:"LO",name:"LuminanceResponseDescription",vm:"1",version:"DICOM"},"(0028,7021)":{tag:"(0028,7021)",vr:"CS",name:"WhitePointFlag",vm:"1",version:"DICOM"},"(0028,7022)":{tag:"(0028,7022)",vr:"SQ",name:"DisplayDeviceTypeCodeSequence",vm:"1",version:"DICOM"},"(0028,7023)":{tag:"(0028,7023)",vr:"SQ",name:"DisplaySubsystemSequence",vm:"1",version:"DICOM"},"(0028,7024)":{tag:"(0028,7024)",vr:"SQ",name:"LuminanceResultSequence",vm:"1",version:"DICOM"},"(0028,7025)":{tag:"(0028,7025)",vr:"CS",name:"AmbientLightValueSource",vm:"1",version:"DICOM"},"(0028,7026)":{tag:"(0028,7026)",vr:"CS",name:"MeasuredCharacteristics",vm:"1-n",version:"DICOM"},"(0028,7027)":{tag:"(0028,7027)",vr:"SQ",name:"LuminanceUniformityResultSequence",vm:"1",version:"DICOM"},"(0028,7028)":{tag:"(0028,7028)",vr:"SQ",name:"VisualEvaluationTestSequence",vm:"1",version:"DICOM"},"(0028,7029)":{tag:"(0028,7029)",vr:"CS",name:"TestResult",vm:"1",version:"DICOM"},"(0028,702A)":{tag:"(0028,702A)",vr:"LO",name:"TestResultComment",vm:"1",version:"DICOM"},"(0028,702B)":{tag:"(0028,702B)",vr:"CS",name:"TestImageValidation",vm:"1",version:"DICOM"},"(0028,702C)":{tag:"(0028,702C)",vr:"SQ",name:"TestPatternCodeSequence",vm:"1",version:"DICOM"},"(0028,702D)":{tag:"(0028,702D)",vr:"SQ",name:"MeasurementPatternCodeSequence",vm:"1",version:"DICOM"},"(0028,702E)":{tag:"(0028,702E)",vr:"SQ",name:"VisualEvaluationMethodCodeSequence",vm:"1",version:"DICOM"},"(0028,7FE0)":{tag:"(0028,7FE0)",vr:"UR",name:"PixelDataProviderURL",vm:"1",version:"DICOM"},"(0028,9001)":{tag:"(0028,9001)",vr:"UL",name:"DataPointRows",vm:"1",version:"DICOM"},"(0028,9002)":{tag:"(0028,9002)",vr:"UL",name:"DataPointColumns",vm:"1",version:"DICOM"},"(0028,9003)":{tag:"(0028,9003)",vr:"CS",name:"SignalDomainColumns",vm:"1",version:"DICOM"},"(0028,9108)":{tag:"(0028,9108)",vr:"CS",name:"DataRepresentation",vm:"1",version:"DICOM"},"(0028,9110)":{tag:"(0028,9110)",vr:"SQ",name:"PixelMeasuresSequence",vm:"1",version:"DICOM"},"(0028,9132)":{tag:"(0028,9132)",vr:"SQ",name:"FrameVOILUTSequence",vm:"1",version:"DICOM"},"(0028,9145)":{tag:"(0028,9145)",vr:"SQ",name:"PixelValueTransformationSequence",vm:"1",version:"DICOM"},"(0028,9235)":{tag:"(0028,9235)",vr:"CS",name:"SignalDomainRows",vm:"1",version:"DICOM"},"(0028,9411)":{tag:"(0028,9411)",vr:"FL",name:"DisplayFilterPercentage",vm:"1",version:"DICOM"},"(0028,9415)":{tag:"(0028,9415)",vr:"SQ",name:"FramePixelShiftSequence",vm:"1",version:"DICOM"},"(0028,9416)":{tag:"(0028,9416)",vr:"US",name:"SubtractionItemID",vm:"1",version:"DICOM"},"(0028,9422)":{tag:"(0028,9422)",vr:"SQ",name:"PixelIntensityRelationshipLUTSequence",vm:"1",version:"DICOM"},"(0028,9443)":{tag:"(0028,9443)",vr:"SQ",name:"FramePixelDataPropertiesSequence",vm:"1",version:"DICOM"},"(0028,9444)":{tag:"(0028,9444)",vr:"CS",name:"GeometricalProperties",vm:"1",version:"DICOM"},"(0028,9445)":{tag:"(0028,9445)",vr:"FL",name:"GeometricMaximumDistortion",vm:"1",version:"DICOM"},"(0028,9446)":{tag:"(0028,9446)",vr:"CS",name:"ImageProcessingApplied",vm:"1-n",version:"DICOM"},"(0028,9454)":{tag:"(0028,9454)",vr:"CS",name:"MaskSelectionMode",vm:"1",version:"DICOM"},"(0028,9474)":{tag:"(0028,9474)",vr:"CS",name:"LUTFunction",vm:"1",version:"DICOM"},"(0028,9478)":{tag:"(0028,9478)",vr:"FL",name:"MaskVisibilityPercentage",vm:"1",version:"DICOM"},"(0028,9501)":{tag:"(0028,9501)",vr:"SQ",name:"PixelShiftSequence",vm:"1",version:"DICOM"},"(0028,9502)":{tag:"(0028,9502)",vr:"SQ",name:"RegionPixelShiftSequence",vm:"1",version:"DICOM"},"(0028,9503)":{tag:"(0028,9503)",vr:"SS",name:"VerticesOfTheRegion",vm:"2-2n",version:"DICOM"},"(0028,9505)":{tag:"(0028,9505)",vr:"SQ",name:"MultiFramePresentationSequence",vm:"1",version:"DICOM"},"(0028,9506)":{tag:"(0028,9506)",vr:"US",name:"PixelShiftFrameRange",vm:"2-2n",version:"DICOM"},"(0028,9507)":{tag:"(0028,9507)",vr:"US",name:"LUTFrameRange",vm:"2-2n",version:"DICOM"},"(0028,9520)":{tag:"(0028,9520)",vr:"DS",name:"ImageToEquipmentMappingMatrix",vm:"16",version:"DICOM"},"(0028,9537)":{tag:"(0028,9537)",vr:"CS",name:"EquipmentCoordinateSystemIdentification",vm:"1",version:"DICOM"},"(0032,1031)":{tag:"(0032,1031)",vr:"SQ",name:"RequestingPhysicianIdentificationSequence",vm:"1",version:"DICOM"},"(0032,1032)":{tag:"(0032,1032)",vr:"PN",name:"RequestingPhysician",vm:"1",version:"DICOM"},"(0032,1033)":{tag:"(0032,1033)",vr:"LO",name:"RequestingService",vm:"1",version:"DICOM"},"(0032,1034)":{tag:"(0032,1034)",vr:"SQ",name:"RequestingServiceCodeSequence",vm:"1",version:"DICOM"},"(0032,1060)":{tag:"(0032,1060)",vr:"LO",name:"RequestedProcedureDescription",vm:"1",version:"DICOM"},"(0032,1064)":{tag:"(0032,1064)",vr:"SQ",name:"RequestedProcedureCodeSequence",vm:"1",version:"DICOM"},"(0032,1070)":{tag:"(0032,1070)",vr:"LO",name:"RequestedContrastAgent",vm:"1",version:"DICOM"},"(0038,0004)":{tag:"(0038,0004)",vr:"SQ",name:"ReferencedPatientAliasSequence",vm:"1",version:"DICOM"},"(0038,0008)":{tag:"(0038,0008)",vr:"CS",name:"VisitStatusID",vm:"1",version:"DICOM"},"(0038,0010)":{tag:"(0038,0010)",vr:"LO",name:"AdmissionID",vm:"1",version:"DICOM"},"(0038,0014)":{tag:"(0038,0014)",vr:"SQ",name:"IssuerOfAdmissionIDSequence",vm:"1",version:"DICOM"},"(0038,0016)":{tag:"(0038,0016)",vr:"LO",name:"RouteOfAdmissions",vm:"1",version:"DICOM"},"(0038,0020)":{tag:"(0038,0020)",vr:"DA",name:"AdmittingDate",vm:"1",version:"DICOM"},"(0038,0021)":{tag:"(0038,0021)",vr:"TM",name:"AdmittingTime",vm:"1",version:"DICOM"},"(0038,0050)":{tag:"(0038,0050)",vr:"LO",name:"SpecialNeeds",vm:"1",version:"DICOM"},"(0038,0060)":{tag:"(0038,0060)",vr:"LO",name:"ServiceEpisodeID",vm:"1",version:"DICOM"},"(0038,0062)":{tag:"(0038,0062)",vr:"LO",name:"ServiceEpisodeDescription",vm:"1",version:"DICOM"},"(0038,0064)":{tag:"(0038,0064)",vr:"SQ",name:"IssuerOfServiceEpisodeIDSequence",vm:"1",version:"DICOM"},"(0038,0100)":{tag:"(0038,0100)",vr:"SQ",name:"PertinentDocumentsSequence",vm:"1",version:"DICOM"},"(0038,0101)":{tag:"(0038,0101)",vr:"SQ",name:"PertinentResourcesSequence",vm:"1",version:"DICOM"},"(0038,0102)":{tag:"(0038,0102)",vr:"LO",name:"ResourceDescription",vm:"1",version:"DICOM"},"(0038,0300)":{tag:"(0038,0300)",vr:"LO",name:"CurrentPatientLocation",vm:"1",version:"DICOM"},"(0038,0400)":{tag:"(0038,0400)",vr:"LO",name:"PatientInstitutionResidence",vm:"1",version:"DICOM"},"(0038,0500)":{tag:"(0038,0500)",vr:"LO",name:"PatientState",vm:"1",version:"DICOM"},"(0038,0502)":{tag:"(0038,0502)",vr:"SQ",name:"PatientClinicalTrialParticipationSequence",vm:"1",version:"DICOM"},"(0038,4000)":{tag:"(0038,4000)",vr:"LT",name:"VisitComments",vm:"1",version:"DICOM"},"(003A,0004)":{tag:"(003A,0004)",vr:"CS",name:"WaveformOriginality",vm:"1",version:"DICOM"},"(003A,0005)":{tag:"(003A,0005)",vr:"US",name:"NumberOfWaveformChannels",vm:"1",version:"DICOM"},"(003A,0010)":{tag:"(003A,0010)",vr:"UL",name:"NumberOfWaveformSamples",vm:"1",version:"DICOM"},"(003A,001A)":{tag:"(003A,001A)",vr:"DS",name:"SamplingFrequency",vm:"1",version:"DICOM"},"(003A,0020)":{tag:"(003A,0020)",vr:"SH",name:"MultiplexGroupLabel",vm:"1",version:"DICOM"},"(003A,0200)":{tag:"(003A,0200)",vr:"SQ",name:"ChannelDefinitionSequence",vm:"1",version:"DICOM"},"(003A,0202)":{tag:"(003A,0202)",vr:"IS",name:"WaveformChannelNumber",vm:"1",version:"DICOM"},"(003A,0203)":{tag:"(003A,0203)",vr:"SH",name:"ChannelLabel",vm:"1",version:"DICOM"},"(003A,0205)":{tag:"(003A,0205)",vr:"CS",name:"ChannelStatus",vm:"1-n",version:"DICOM"},"(003A,0208)":{tag:"(003A,0208)",vr:"SQ",name:"ChannelSourceSequence",vm:"1",version:"DICOM"},"(003A,0209)":{tag:"(003A,0209)",vr:"SQ",name:"ChannelSourceModifiersSequence",vm:"1",version:"DICOM"},"(003A,020A)":{tag:"(003A,020A)",vr:"SQ",name:"SourceWaveformSequence",vm:"1",version:"DICOM"},"(003A,020C)":{tag:"(003A,020C)",vr:"LO",name:"ChannelDerivationDescription",vm:"1",version:"DICOM"},"(003A,0210)":{tag:"(003A,0210)",vr:"DS",name:"ChannelSensitivity",vm:"1",version:"DICOM"},"(003A,0211)":{tag:"(003A,0211)",vr:"SQ",name:"ChannelSensitivityUnitsSequence",vm:"1",version:"DICOM"},"(003A,0212)":{tag:"(003A,0212)",vr:"DS",name:"ChannelSensitivityCorrectionFactor",vm:"1",version:"DICOM"},"(003A,0213)":{tag:"(003A,0213)",vr:"DS",name:"ChannelBaseline",vm:"1",version:"DICOM"},"(003A,0214)":{tag:"(003A,0214)",vr:"DS",name:"ChannelTimeSkew",vm:"1",version:"DICOM"},"(003A,0215)":{tag:"(003A,0215)",vr:"DS",name:"ChannelSampleSkew",vm:"1",version:"DICOM"},"(003A,0218)":{tag:"(003A,0218)",vr:"DS",name:"ChannelOffset",vm:"1",version:"DICOM"},"(003A,021A)":{tag:"(003A,021A)",vr:"US",name:"WaveformBitsStored",vm:"1",version:"DICOM"},"(003A,0220)":{tag:"(003A,0220)",vr:"DS",name:"FilterLowFrequency",vm:"1",version:"DICOM"},"(003A,0221)":{tag:"(003A,0221)",vr:"DS",name:"FilterHighFrequency",vm:"1",version:"DICOM"},"(003A,0222)":{tag:"(003A,0222)",vr:"DS",name:"NotchFilterFrequency",vm:"1",version:"DICOM"},"(003A,0223)":{tag:"(003A,0223)",vr:"DS",name:"NotchFilterBandwidth",vm:"1",version:"DICOM"},"(003A,0230)":{tag:"(003A,0230)",vr:"FL",name:"WaveformDataDisplayScale",vm:"1",version:"DICOM"},"(003A,0231)":{tag:"(003A,0231)",vr:"US",name:"WaveformDisplayBackgroundCIELabValue",vm:"3",version:"DICOM"},"(003A,0240)":{tag:"(003A,0240)",vr:"SQ",name:"WaveformPresentationGroupSequence",vm:"1",version:"DICOM"},"(003A,0241)":{tag:"(003A,0241)",vr:"US",name:"PresentationGroupNumber",vm:"1",version:"DICOM"},"(003A,0242)":{tag:"(003A,0242)",vr:"SQ",name:"ChannelDisplaySequence",vm:"1",version:"DICOM"},"(003A,0244)":{tag:"(003A,0244)",vr:"US",name:"ChannelRecommendedDisplayCIELabValue",vm:"3",version:"DICOM"},"(003A,0245)":{tag:"(003A,0245)",vr:"FL",name:"ChannelPosition",vm:"1",version:"DICOM"},"(003A,0246)":{tag:"(003A,0246)",vr:"CS",name:"DisplayShadingFlag",vm:"1",version:"DICOM"},"(003A,0247)":{tag:"(003A,0247)",vr:"FL",name:"FractionalChannelDisplayScale",vm:"1",version:"DICOM"},"(003A,0248)":{tag:"(003A,0248)",vr:"FL",name:"AbsoluteChannelDisplayScale",vm:"1",version:"DICOM"},"(003A,0300)":{tag:"(003A,0300)",vr:"SQ",name:"MultiplexedAudioChannelsDescriptionCodeSequence",vm:"1",version:"DICOM"},"(003A,0301)":{tag:"(003A,0301)",vr:"IS",name:"ChannelIdentificationCode",vm:"1",version:"DICOM"},"(003A,0302)":{tag:"(003A,0302)",vr:"CS",name:"ChannelMode",vm:"1",version:"DICOM"},"(0040,0001)":{tag:"(0040,0001)",vr:"AE",name:"ScheduledStationAETitle",vm:"1-n",version:"DICOM"},"(0040,0002)":{tag:"(0040,0002)",vr:"DA",name:"ScheduledProcedureStepStartDate",vm:"1",version:"DICOM"},"(0040,0003)":{tag:"(0040,0003)",vr:"TM",name:"ScheduledProcedureStepStartTime",vm:"1",version:"DICOM"},"(0040,0004)":{tag:"(0040,0004)",vr:"DA",name:"ScheduledProcedureStepEndDate",vm:"1",version:"DICOM"},"(0040,0005)":{tag:"(0040,0005)",vr:"TM",name:"ScheduledProcedureStepEndTime",vm:"1",version:"DICOM"},"(0040,0006)":{tag:"(0040,0006)",vr:"PN",name:"ScheduledPerformingPhysicianName",vm:"1",version:"DICOM"},"(0040,0007)":{tag:"(0040,0007)",vr:"LO",name:"ScheduledProcedureStepDescription",vm:"1",version:"DICOM"},"(0040,0008)":{tag:"(0040,0008)",vr:"SQ",name:"ScheduledProtocolCodeSequence",vm:"1",version:"DICOM"},"(0040,0009)":{tag:"(0040,0009)",vr:"SH",name:"ScheduledProcedureStepID",vm:"1",version:"DICOM"},"(0040,000A)":{tag:"(0040,000A)",vr:"SQ",name:"StageCodeSequence",vm:"1",version:"DICOM"},"(0040,000B)":{tag:"(0040,000B)",vr:"SQ",name:"ScheduledPerformingPhysicianIdentificationSequence",vm:"1",version:"DICOM"},"(0040,0010)":{tag:"(0040,0010)",vr:"SH",name:"ScheduledStationName",vm:"1-n",version:"DICOM"},"(0040,0011)":{tag:"(0040,0011)",vr:"SH",name:"ScheduledProcedureStepLocation",vm:"1",version:"DICOM"},"(0040,0012)":{tag:"(0040,0012)",vr:"LO",name:"PreMedication",vm:"1",version:"DICOM"},"(0040,0020)":{tag:"(0040,0020)",vr:"CS",name:"ScheduledProcedureStepStatus",vm:"1",version:"DICOM"},"(0040,0026)":{tag:"(0040,0026)",vr:"SQ",name:"OrderPlacerIdentifierSequence",vm:"1",version:"DICOM"},"(0040,0027)":{tag:"(0040,0027)",vr:"SQ",name:"OrderFillerIdentifierSequence",vm:"1",version:"DICOM"},"(0040,0031)":{tag:"(0040,0031)",vr:"UT",name:"LocalNamespaceEntityID",vm:"1",version:"DICOM"},"(0040,0032)":{tag:"(0040,0032)",vr:"UT",name:"UniversalEntityID",vm:"1",version:"DICOM"},"(0040,0033)":{tag:"(0040,0033)",vr:"CS",name:"UniversalEntityIDType",vm:"1",version:"DICOM"},"(0040,0035)":{tag:"(0040,0035)",vr:"CS",name:"IdentifierTypeCode",vm:"1",version:"DICOM"},"(0040,0036)":{tag:"(0040,0036)",vr:"SQ",name:"AssigningFacilitySequence",vm:"1",version:"DICOM"},"(0040,0039)":{tag:"(0040,0039)",vr:"SQ",name:"AssigningJurisdictionCodeSequence",vm:"1",version:"DICOM"},"(0040,003A)":{tag:"(0040,003A)",vr:"SQ",name:"AssigningAgencyOrDepartmentCodeSequence",vm:"1",version:"DICOM"},"(0040,0100)":{tag:"(0040,0100)",vr:"SQ",name:"ScheduledProcedureStepSequence",vm:"1",version:"DICOM"},"(0040,0220)":{tag:"(0040,0220)",vr:"SQ",name:"ReferencedNonImageCompositeSOPInstanceSequence",vm:"1",version:"DICOM"},"(0040,0241)":{tag:"(0040,0241)",vr:"AE",name:"PerformedStationAETitle",vm:"1",version:"DICOM"},"(0040,0242)":{tag:"(0040,0242)",vr:"SH",name:"PerformedStationName",vm:"1",version:"DICOM"},"(0040,0243)":{tag:"(0040,0243)",vr:"SH",name:"PerformedLocation",vm:"1",version:"DICOM"},"(0040,0244)":{tag:"(0040,0244)",vr:"DA",name:"PerformedProcedureStepStartDate",vm:"1",version:"DICOM"},"(0040,0245)":{tag:"(0040,0245)",vr:"TM",name:"PerformedProcedureStepStartTime",vm:"1",version:"DICOM"},"(0040,0250)":{tag:"(0040,0250)",vr:"DA",name:"PerformedProcedureStepEndDate",vm:"1",version:"DICOM"},"(0040,0251)":{tag:"(0040,0251)",vr:"TM",name:"PerformedProcedureStepEndTime",vm:"1",version:"DICOM"},"(0040,0252)":{tag:"(0040,0252)",vr:"CS",name:"PerformedProcedureStepStatus",vm:"1",version:"DICOM"},"(0040,0253)":{tag:"(0040,0253)",vr:"SH",name:"PerformedProcedureStepID",vm:"1",version:"DICOM"},"(0040,0254)":{tag:"(0040,0254)",vr:"LO",name:"PerformedProcedureStepDescription",vm:"1",version:"DICOM"},"(0040,0255)":{tag:"(0040,0255)",vr:"LO",name:"PerformedProcedureTypeDescription",vm:"1",version:"DICOM"},"(0040,0260)":{tag:"(0040,0260)",vr:"SQ",name:"PerformedProtocolCodeSequence",vm:"1",version:"DICOM"},"(0040,0261)":{tag:"(0040,0261)",vr:"CS",name:"PerformedProtocolType",vm:"1",version:"DICOM"},"(0040,0270)":{tag:"(0040,0270)",vr:"SQ",name:"ScheduledStepAttributesSequence",vm:"1",version:"DICOM"},"(0040,0275)":{tag:"(0040,0275)",vr:"SQ",name:"RequestAttributesSequence",vm:"1",version:"DICOM"},"(0040,0280)":{tag:"(0040,0280)",vr:"ST",name:"CommentsOnThePerformedProcedureStep",vm:"1",version:"DICOM"},"(0040,0281)":{tag:"(0040,0281)",vr:"SQ",name:"PerformedProcedureStepDiscontinuationReasonCodeSequence",vm:"1",version:"DICOM"},"(0040,0293)":{tag:"(0040,0293)",vr:"SQ",name:"QuantitySequence",vm:"1",version:"DICOM"},"(0040,0294)":{tag:"(0040,0294)",vr:"DS",name:"Quantity",vm:"1",version:"DICOM"},"(0040,0295)":{tag:"(0040,0295)",vr:"SQ",name:"MeasuringUnitsSequence",vm:"1",version:"DICOM"},"(0040,0296)":{tag:"(0040,0296)",vr:"SQ",name:"BillingItemSequence",vm:"1",version:"DICOM"},"(0040,0300)":{tag:"(0040,0300)",vr:"US",name:"TotalTimeOfFluoroscopy",vm:"1",version:"DICOM"},"(0040,0301)":{tag:"(0040,0301)",vr:"US",name:"TotalNumberOfExposures",vm:"1",version:"DICOM"},"(0040,0302)":{tag:"(0040,0302)",vr:"US",name:"EntranceDose",vm:"1",version:"DICOM"},"(0040,0303)":{tag:"(0040,0303)",vr:"US",name:"ExposedArea",vm:"1-2",version:"DICOM"},"(0040,0306)":{tag:"(0040,0306)",vr:"DS",name:"DistanceSourceToEntrance",vm:"1",version:"DICOM"},"(0040,030E)":{tag:"(0040,030E)",vr:"SQ",name:"ExposureDoseSequence",vm:"1",version:"DICOM"},"(0040,0310)":{tag:"(0040,0310)",vr:"ST",name:"CommentsOnRadiationDose",vm:"1",version:"DICOM"},"(0040,0312)":{tag:"(0040,0312)",vr:"DS",name:"XRayOutput",vm:"1",version:"DICOM"},"(0040,0314)":{tag:"(0040,0314)",vr:"DS",name:"HalfValueLayer",vm:"1",version:"DICOM"},"(0040,0316)":{tag:"(0040,0316)",vr:"DS",name:"OrganDose",vm:"1",version:"DICOM"},"(0040,0318)":{tag:"(0040,0318)",vr:"CS",name:"OrganExposed",vm:"1",version:"DICOM"},"(0040,0320)":{tag:"(0040,0320)",vr:"SQ",name:"BillingProcedureStepSequence",vm:"1",version:"DICOM"},"(0040,0321)":{tag:"(0040,0321)",vr:"SQ",name:"FilmConsumptionSequence",vm:"1",version:"DICOM"},"(0040,0324)":{tag:"(0040,0324)",vr:"SQ",name:"BillingSuppliesAndDevicesSequence",vm:"1",version:"DICOM"},"(0040,0340)":{tag:"(0040,0340)",vr:"SQ",name:"PerformedSeriesSequence",vm:"1",version:"DICOM"},"(0040,0400)":{tag:"(0040,0400)",vr:"LT",name:"CommentsOnTheScheduledProcedureStep",vm:"1",version:"DICOM"},"(0040,0440)":{tag:"(0040,0440)",vr:"SQ",name:"ProtocolContextSequence",vm:"1",version:"DICOM"},"(0040,0441)":{tag:"(0040,0441)",vr:"SQ",name:"ContentItemModifierSequence",vm:"1",version:"DICOM"},"(0040,0500)":{tag:"(0040,0500)",vr:"SQ",name:"ScheduledSpecimenSequence",vm:"1",version:"DICOM"},"(0040,0512)":{tag:"(0040,0512)",vr:"LO",name:"ContainerIdentifier",vm:"1",version:"DICOM"},"(0040,0513)":{tag:"(0040,0513)",vr:"SQ",name:"IssuerOfTheContainerIdentifierSequence",vm:"1",version:"DICOM"},"(0040,0515)":{tag:"(0040,0515)",vr:"SQ",name:"AlternateContainerIdentifierSequence",vm:"1",version:"DICOM"},"(0040,0518)":{tag:"(0040,0518)",vr:"SQ",name:"ContainerTypeCodeSequence",vm:"1",version:"DICOM"},"(0040,051A)":{tag:"(0040,051A)",vr:"LO",name:"ContainerDescription",vm:"1",version:"DICOM"},"(0040,0520)":{tag:"(0040,0520)",vr:"SQ",name:"ContainerComponentSequence",vm:"1",version:"DICOM"},"(0040,0551)":{tag:"(0040,0551)",vr:"LO",name:"SpecimenIdentifier",vm:"1",version:"DICOM"},"(0040,0554)":{tag:"(0040,0554)",vr:"UI",name:"SpecimenUID",vm:"1",version:"DICOM"},"(0040,0555)":{tag:"(0040,0555)",vr:"SQ",name:"AcquisitionContextSequence",vm:"1",version:"DICOM"},"(0040,0556)":{tag:"(0040,0556)",vr:"ST",name:"AcquisitionContextDescription",vm:"1",version:"DICOM"},"(0040,0560)":{tag:"(0040,0560)",vr:"SQ",name:"SpecimenDescriptionSequence",vm:"1",version:"DICOM"},"(0040,0562)":{tag:"(0040,0562)",vr:"SQ",name:"IssuerOfTheSpecimenIdentifierSequence",vm:"1",version:"DICOM"},"(0040,059A)":{tag:"(0040,059A)",vr:"SQ",name:"SpecimenTypeCodeSequence",vm:"1",version:"DICOM"},"(0040,0600)":{tag:"(0040,0600)",vr:"LO",name:"SpecimenShortDescription",vm:"1",version:"DICOM"},"(0040,0602)":{tag:"(0040,0602)",vr:"UT",name:"SpecimenDetailedDescription",vm:"1",version:"DICOM"},"(0040,0610)":{tag:"(0040,0610)",vr:"SQ",name:"SpecimenPreparationSequence",vm:"1",version:"DICOM"},"(0040,0612)":{tag:"(0040,0612)",vr:"SQ",name:"SpecimenPreparationStepContentItemSequence",vm:"1",version:"DICOM"},"(0040,0620)":{tag:"(0040,0620)",vr:"SQ",name:"SpecimenLocalizationContentItemSequence",vm:"1",version:"DICOM"},"(0040,071A)":{tag:"(0040,071A)",vr:"SQ",name:"ImageCenterPointCoordinatesSequence",vm:"1",version:"DICOM"},"(0040,072A)":{tag:"(0040,072A)",vr:"DS",name:"XOffsetInSlideCoordinateSystem",vm:"1",version:"DICOM"},"(0040,073A)":{tag:"(0040,073A)",vr:"DS",name:"YOffsetInSlideCoordinateSystem",vm:"1",version:"DICOM"},"(0040,074A)":{tag:"(0040,074A)",vr:"DS",name:"ZOffsetInSlideCoordinateSystem",vm:"1",version:"DICOM"},"(0040,08EA)":{tag:"(0040,08EA)",vr:"SQ",name:"MeasurementUnitsCodeSequence",vm:"1",version:"DICOM"},"(0040,1001)":{tag:"(0040,1001)",vr:"SH",name:"RequestedProcedureID",vm:"1",version:"DICOM"},"(0040,1002)":{tag:"(0040,1002)",vr:"LO",name:"ReasonForTheRequestedProcedure",vm:"1",version:"DICOM"},"(0040,1003)":{tag:"(0040,1003)",vr:"SH",name:"RequestedProcedurePriority",vm:"1",version:"DICOM"},"(0040,1004)":{tag:"(0040,1004)",vr:"LO",name:"PatientTransportArrangements",vm:"1",version:"DICOM"},"(0040,1005)":{tag:"(0040,1005)",vr:"LO",name:"RequestedProcedureLocation",vm:"1",version:"DICOM"},"(0040,1008)":{tag:"(0040,1008)",vr:"LO",name:"ConfidentialityCode",vm:"1",version:"DICOM"},"(0040,1009)":{tag:"(0040,1009)",vr:"SH",name:"ReportingPriority",vm:"1",version:"DICOM"},"(0040,100A)":{tag:"(0040,100A)",vr:"SQ",name:"ReasonForRequestedProcedureCodeSequence",vm:"1",version:"DICOM"},"(0040,1010)":{tag:"(0040,1010)",vr:"PN",name:"NamesOfIntendedRecipientsOfResults",vm:"1-n",version:"DICOM"},"(0040,1011)":{tag:"(0040,1011)",vr:"SQ",name:"IntendedRecipientsOfResultsIdentificationSequence",vm:"1",version:"DICOM"},"(0040,1012)":{tag:"(0040,1012)",vr:"SQ",name:"ReasonForPerformedProcedureCodeSequence",vm:"1",version:"DICOM"},"(0040,1101)":{tag:"(0040,1101)",vr:"SQ",name:"PersonIdentificationCodeSequence",vm:"1",version:"DICOM"},"(0040,1102)":{tag:"(0040,1102)",vr:"ST",name:"PersonAddress",vm:"1",version:"DICOM"},"(0040,1103)":{tag:"(0040,1103)",vr:"LO",name:"PersonTelephoneNumbers",vm:"1-n",version:"DICOM"},"(0040,1104)":{tag:"(0040,1104)",vr:"LT",name:"PersonTelecomInformation",vm:"1",version:"DICOM"},"(0040,1400)":{tag:"(0040,1400)",vr:"LT",name:"RequestedProcedureComments",vm:"1",version:"DICOM"},"(0040,2004)":{tag:"(0040,2004)",vr:"DA",name:"IssueDateOfImagingServiceRequest",vm:"1",version:"DICOM"},"(0040,2005)":{tag:"(0040,2005)",vr:"TM",name:"IssueTimeOfImagingServiceRequest",vm:"1",version:"DICOM"},"(0040,2008)":{tag:"(0040,2008)",vr:"PN",name:"OrderEnteredBy",vm:"1",version:"DICOM"},"(0040,2009)":{tag:"(0040,2009)",vr:"SH",name:"OrderEntererLocation",vm:"1",version:"DICOM"},"(0040,2010)":{tag:"(0040,2010)",vr:"SH",name:"OrderCallbackPhoneNumber",vm:"1",version:"DICOM"},"(0040,2011)":{tag:"(0040,2011)",vr:"LT",name:"OrderCallbackTelecomInformation",vm:"1",version:"DICOM"},"(0040,2016)":{tag:"(0040,2016)",vr:"LO",name:"PlacerOrderNumberImagingServiceRequest",vm:"1",version:"DICOM"},"(0040,2017)":{tag:"(0040,2017)",vr:"LO",name:"FillerOrderNumberImagingServiceRequest",vm:"1",version:"DICOM"},"(0040,2400)":{tag:"(0040,2400)",vr:"LT",name:"ImagingServiceRequestComments",vm:"1",version:"DICOM"},"(0040,3001)":{tag:"(0040,3001)",vr:"LO",name:"ConfidentialityConstraintOnPatientDataDescription",vm:"1",version:"DICOM"},"(0040,4005)":{tag:"(0040,4005)",vr:"DT",name:"ScheduledProcedureStepStartDateTime",vm:"1",version:"DICOM"},"(0040,4007)":{tag:"(0040,4007)",vr:"SQ",name:"PerformedProcessingApplicationsCodeSequence",vm:"1",version:"DICOM"},"(0040,4009)":{tag:"(0040,4009)",vr:"SQ",name:"HumanPerformerCodeSequence",vm:"1",version:"DICOM"},"(0040,4010)":{tag:"(0040,4010)",vr:"DT",name:"ScheduledProcedureStepModificationDateTime",vm:"1",version:"DICOM"},"(0040,4011)":{tag:"(0040,4011)",vr:"DT",name:"ExpectedCompletionDateTime",vm:"1",version:"DICOM"},"(0040,4018)":{tag:"(0040,4018)",vr:"SQ",name:"ScheduledWorkitemCodeSequence",vm:"1",version:"DICOM"},"(0040,4019)":{tag:"(0040,4019)",vr:"SQ",name:"PerformedWorkitemCodeSequence",vm:"1",version:"DICOM"},"(0040,4020)":{tag:"(0040,4020)",vr:"CS",name:"InputAvailabilityFlag",vm:"1",version:"DICOM"},"(0040,4021)":{tag:"(0040,4021)",vr:"SQ",name:"InputInformationSequence",vm:"1",version:"DICOM"},"(0040,4025)":{tag:"(0040,4025)",vr:"SQ",name:"ScheduledStationNameCodeSequence",vm:"1",version:"DICOM"},"(0040,4026)":{tag:"(0040,4026)",vr:"SQ",name:"ScheduledStationClassCodeSequence",vm:"1",version:"DICOM"},"(0040,4027)":{tag:"(0040,4027)",vr:"SQ",name:"ScheduledStationGeographicLocationCodeSequence",vm:"1",version:"DICOM"},"(0040,4028)":{tag:"(0040,4028)",vr:"SQ",name:"PerformedStationNameCodeSequence",vm:"1",version:"DICOM"},"(0040,4029)":{tag:"(0040,4029)",vr:"SQ",name:"PerformedStationClassCodeSequence",vm:"1",version:"DICOM"},"(0040,4030)":{tag:"(0040,4030)",vr:"SQ",name:"PerformedStationGeographicLocationCodeSequence",vm:"1",version:"DICOM"},"(0040,4033)":{tag:"(0040,4033)",vr:"SQ",name:"OutputInformationSequence",vm:"1",version:"DICOM"},"(0040,4034)":{tag:"(0040,4034)",vr:"SQ",name:"ScheduledHumanPerformersSequence",vm:"1",version:"DICOM"},"(0040,4035)":{tag:"(0040,4035)",vr:"SQ",name:"ActualHumanPerformersSequence",vm:"1",version:"DICOM"},"(0040,4036)":{tag:"(0040,4036)",vr:"LO",name:"HumanPerformerOrganization",vm:"1",version:"DICOM"},"(0040,4037)":{tag:"(0040,4037)",vr:"PN",name:"HumanPerformerName",vm:"1",version:"DICOM"},"(0040,4040)":{tag:"(0040,4040)",vr:"CS",name:"RawDataHandling",vm:"1",version:"DICOM"},"(0040,4041)":{tag:"(0040,4041)",vr:"CS",name:"InputReadinessState",vm:"1",version:"DICOM"},"(0040,4050)":{tag:"(0040,4050)",vr:"DT",name:"PerformedProcedureStepStartDateTime",vm:"1",version:"DICOM"},"(0040,4051)":{tag:"(0040,4051)",vr:"DT",name:"PerformedProcedureStepEndDateTime",vm:"1",version:"DICOM"},"(0040,4052)":{tag:"(0040,4052)",vr:"DT",name:"ProcedureStepCancellationDateTime",vm:"1",version:"DICOM"},"(0040,8302)":{tag:"(0040,8302)",vr:"DS",name:"EntranceDoseInmGy",vm:"1",version:"DICOM"},"(0040,9092)":{tag:"(0040,9092)",vr:"SQ",name:"ParametricMapFrameTypeSequence",vm:"1",version:"DICOM"},"(0040,9094)":{tag:"(0040,9094)",vr:"SQ",name:"ReferencedImageRealWorldValueMappingSequence",vm:"1",version:"DICOM"},"(0040,9096)":{tag:"(0040,9096)",vr:"SQ",name:"RealWorldValueMappingSequence",vm:"1",version:"DICOM"},"(0040,9098)":{tag:"(0040,9098)",vr:"SQ",name:"PixelValueMappingCodeSequence",vm:"1",version:"DICOM"},"(0040,9210)":{tag:"(0040,9210)",vr:"SH",name:"LUTLabel",vm:"1",version:"DICOM"},"(0040,9211)":{tag:"(0040,9211)",vr:"xs",name:"RealWorldValueLastValueMapped",vm:"1",version:"DICOM"},"(0040,9212)":{tag:"(0040,9212)",vr:"FD",name:"RealWorldValueLUTData",vm:"1-n",version:"DICOM"},"(0040,9216)":{tag:"(0040,9216)",vr:"xs",name:"RealWorldValueFirstValueMapped",vm:"1",version:"DICOM"},"(0040,9220)":{tag:"(0040,9220)",vr:"SQ",name:"QuantityDefinitionSequence",vm:"1",version:"DICOM"},"(0040,9224)":{tag:"(0040,9224)",vr:"FD",name:"RealWorldValueIntercept",vm:"1",version:"DICOM"},"(0040,9225)":{tag:"(0040,9225)",vr:"FD",name:"RealWorldValueSlope",vm:"1",version:"DICOM"},"(0040,A010)":{tag:"(0040,A010)",vr:"CS",name:"RelationshipType",vm:"1",version:"DICOM"},"(0040,A027)":{tag:"(0040,A027)",vr:"LO",name:"VerifyingOrganization",vm:"1",version:"DICOM"},"(0040,A030)":{tag:"(0040,A030)",vr:"DT",name:"VerificationDateTime",vm:"1",version:"DICOM"},"(0040,A032)":{tag:"(0040,A032)",vr:"DT",name:"ObservationDateTime",vm:"1",version:"DICOM"},"(0040,A040)":{tag:"(0040,A040)",vr:"CS",name:"ValueType",vm:"1",version:"DICOM"},"(0040,A043)":{tag:"(0040,A043)",vr:"SQ",name:"ConceptNameCodeSequence",vm:"1",version:"DICOM"},"(0040,A050)":{tag:"(0040,A050)",vr:"CS",name:"ContinuityOfContent",vm:"1",version:"DICOM"},"(0040,A073)":{tag:"(0040,A073)",vr:"SQ",name:"VerifyingObserverSequence",vm:"1",version:"DICOM"},"(0040,A075)":{tag:"(0040,A075)",vr:"PN",name:"VerifyingObserverName",vm:"1",version:"DICOM"},"(0040,A078)":{tag:"(0040,A078)",vr:"SQ",name:"AuthorObserverSequence",vm:"1",version:"DICOM"},"(0040,A07A)":{tag:"(0040,A07A)",vr:"SQ",name:"ParticipantSequence",vm:"1",version:"DICOM"},"(0040,A07C)":{tag:"(0040,A07C)",vr:"SQ",name:"CustodialOrganizationSequence",vm:"1",version:"DICOM"},"(0040,A080)":{tag:"(0040,A080)",vr:"CS",name:"ParticipationType",vm:"1",version:"DICOM"},"(0040,A082)":{tag:"(0040,A082)",vr:"DT",name:"ParticipationDateTime",vm:"1",version:"DICOM"},"(0040,A084)":{tag:"(0040,A084)",vr:"CS",name:"ObserverType",vm:"1",version:"DICOM"},"(0040,A088)":{tag:"(0040,A088)",vr:"SQ",name:"VerifyingObserverIdentificationCodeSequence",vm:"1",version:"DICOM"},"(0040,A0B0)":{tag:"(0040,A0B0)",vr:"US",name:"ReferencedWaveformChannels",vm:"2-2n",version:"DICOM"},"(0040,A120)":{tag:"(0040,A120)",vr:"DT",name:"DateTime",vm:"1",version:"DICOM"},"(0040,A121)":{tag:"(0040,A121)",vr:"DA",name:"Date",vm:"1",version:"DICOM"},"(0040,A122)":{tag:"(0040,A122)",vr:"TM",name:"Time",vm:"1",version:"DICOM"},"(0040,A123)":{tag:"(0040,A123)",vr:"PN",name:"PersonName",vm:"1",version:"DICOM"},"(0040,A124)":{tag:"(0040,A124)",vr:"UI",name:"UID",vm:"1",version:"DICOM"},"(0040,A130)":{tag:"(0040,A130)",vr:"CS",name:"TemporalRangeType",vm:"1",version:"DICOM"},"(0040,A132)":{tag:"(0040,A132)",vr:"UL",name:"ReferencedSamplePositions",vm:"1-n",version:"DICOM"},"(0040,A136)":{tag:"(0040,A136)",vr:"US",name:"ReferencedFrameNumbers",vm:"1-n",version:"DICOM"},"(0040,A138)":{tag:"(0040,A138)",vr:"DS",name:"ReferencedTimeOffsets",vm:"1-n",version:"DICOM"},"(0040,A13A)":{tag:"(0040,A13A)",vr:"DT",name:"ReferencedDateTime",vm:"1-n",version:"DICOM"},"(0040,A160)":{tag:"(0040,A160)",vr:"UT",name:"TextValue",vm:"1",version:"DICOM"},"(0040,A161)":{tag:"(0040,A161)",vr:"FD",name:"FloatingPointValue",vm:"1-n",version:"DICOM"},"(0040,A162)":{tag:"(0040,A162)",vr:"SL",name:"RationalNumeratorValue",vm:"1-n",version:"DICOM"},"(0040,A163)":{tag:"(0040,A163)",vr:"UL",name:"RationalDenominatorValue",vm:"1-n",version:"DICOM"},"(0040,A168)":{tag:"(0040,A168)",vr:"SQ",name:"ConceptCodeSequence",vm:"1",version:"DICOM"},"(0040,A170)":{tag:"(0040,A170)",vr:"SQ",name:"PurposeOfReferenceCodeSequence",vm:"1",version:"DICOM"},"(0040,A171)":{tag:"(0040,A171)",vr:"UI",name:"ObservationUID",vm:"1",version:"DICOM"},"(0040,A180)":{tag:"(0040,A180)",vr:"US",name:"AnnotationGroupNumber",vm:"1",version:"DICOM"},"(0040,A195)":{tag:"(0040,A195)",vr:"SQ",name:"ModifierCodeSequence",vm:"1",version:"DICOM"},"(0040,A300)":{tag:"(0040,A300)",vr:"SQ",name:"MeasuredValueSequence",vm:"1",version:"DICOM"},"(0040,A301)":{tag:"(0040,A301)",vr:"SQ",name:"NumericValueQualifierCodeSequence",vm:"1",version:"DICOM"},"(0040,A30A)":{tag:"(0040,A30A)",vr:"DS",name:"NumericValue",vm:"1-n",version:"DICOM"},"(0040,A360)":{tag:"(0040,A360)",vr:"SQ",name:"PredecessorDocumentsSequence",vm:"1",version:"DICOM"},"(0040,A370)":{tag:"(0040,A370)",vr:"SQ",name:"ReferencedRequestSequence",vm:"1",version:"DICOM"},"(0040,A372)":{tag:"(0040,A372)",vr:"SQ",name:"PerformedProcedureCodeSequence",vm:"1",version:"DICOM"},"(0040,A375)":{tag:"(0040,A375)",vr:"SQ",name:"CurrentRequestedProcedureEvidenceSequence",vm:"1",version:"DICOM"},"(0040,A385)":{tag:"(0040,A385)",vr:"SQ",name:"PertinentOtherEvidenceSequence",vm:"1",version:"DICOM"},"(0040,A390)":{tag:"(0040,A390)",vr:"SQ",name:"HL7StructuredDocumentReferenceSequence",vm:"1",version:"DICOM"},"(0040,A491)":{tag:"(0040,A491)",vr:"CS",name:"CompletionFlag",vm:"1",version:"DICOM"},"(0040,A492)":{tag:"(0040,A492)",vr:"LO",name:"CompletionFlagDescription",vm:"1",version:"DICOM"},"(0040,A493)":{tag:"(0040,A493)",vr:"CS",name:"VerificationFlag",vm:"1",version:"DICOM"},"(0040,A494)":{tag:"(0040,A494)",vr:"CS",name:"ArchiveRequested",vm:"1",version:"DICOM"},"(0040,A496)":{tag:"(0040,A496)",vr:"CS",name:"PreliminaryFlag",vm:"1",version:"DICOM"},"(0040,A504)":{tag:"(0040,A504)",vr:"SQ",name:"ContentTemplateSequence",vm:"1",version:"DICOM"},"(0040,A525)":{tag:"(0040,A525)",vr:"SQ",name:"IdenticalDocumentsSequence",vm:"1",version:"DICOM"},"(0040,A730)":{tag:"(0040,A730)",vr:"SQ",name:"ContentSequence",vm:"1",version:"DICOM"},"(0040,B020)":{tag:"(0040,B020)",vr:"SQ",name:"WaveformAnnotationSequence",vm:"1",version:"DICOM"},"(0040,DB00)":{tag:"(0040,DB00)",vr:"CS",name:"TemplateIdentifier",vm:"1",version:"DICOM"},"(0040,DB73)":{tag:"(0040,DB73)",vr:"UL",name:"ReferencedContentItemIdentifier",vm:"1-n",version:"DICOM"},"(0040,E001)":{tag:"(0040,E001)",vr:"ST",name:"HL7InstanceIdentifier",vm:"1",version:"DICOM"},"(0040,E004)":{tag:"(0040,E004)",vr:"DT",name:"HL7DocumentEffectiveTime",vm:"1",version:"DICOM"},"(0040,E006)":{tag:"(0040,E006)",vr:"SQ",name:"HL7DocumentTypeCodeSequence",vm:"1",version:"DICOM"},"(0040,E008)":{tag:"(0040,E008)",vr:"SQ",name:"DocumentClassCodeSequence",vm:"1",version:"DICOM"},"(0040,E010)":{tag:"(0040,E010)",vr:"UR",name:"RetrieveURI",vm:"1",version:"DICOM"},"(0040,E011)":{tag:"(0040,E011)",vr:"UI",name:"RetrieveLocationUID",vm:"1",version:"DICOM"},"(0040,E020)":{tag:"(0040,E020)",vr:"CS",name:"TypeOfInstances",vm:"1",version:"DICOM"},"(0040,E021)":{tag:"(0040,E021)",vr:"SQ",name:"DICOMRetrievalSequence",vm:"1",version:"DICOM"},"(0040,E022)":{tag:"(0040,E022)",vr:"SQ",name:"DICOMMediaRetrievalSequence",vm:"1",version:"DICOM"},"(0040,E023)":{tag:"(0040,E023)",vr:"SQ",name:"WADORetrievalSequence",vm:"1",version:"DICOM"},"(0040,E024)":{tag:"(0040,E024)",vr:"SQ",name:"XDSRetrievalSequence",vm:"1",version:"DICOM"},"(0040,E025)":{tag:"(0040,E025)",vr:"SQ",name:"WADORSRetrievalSequence",vm:"1",version:"DICOM"},"(0040,E030)":{tag:"(0040,E030)",vr:"UI",name:"RepositoryUniqueID",vm:"1",version:"DICOM"},"(0040,E031)":{tag:"(0040,E031)",vr:"UI",name:"HomeCommunityID",vm:"1",version:"DICOM"},"(0042,0010)":{tag:"(0042,0010)",vr:"ST",name:"DocumentTitle",vm:"1",version:"DICOM"},"(0042,0011)":{tag:"(0042,0011)",vr:"OB",name:"EncapsulatedDocument",vm:"1",version:"DICOM"},"(0042,0012)":{tag:"(0042,0012)",vr:"LO",name:"MIMETypeOfEncapsulatedDocument",vm:"1",version:"DICOM"},"(0042,0013)":{tag:"(0042,0013)",vr:"SQ",name:"SourceInstanceSequence",vm:"1",version:"DICOM"},"(0042,0014)":{tag:"(0042,0014)",vr:"LO",name:"ListOfMIMETypes",vm:"1-n",version:"DICOM"},"(0044,0001)":{tag:"(0044,0001)",vr:"ST",name:"ProductPackageIdentifier",vm:"1",version:"DICOM"},"(0044,0002)":{tag:"(0044,0002)",vr:"CS",name:"SubstanceAdministrationApproval",vm:"1",version:"DICOM"},"(0044,0003)":{tag:"(0044,0003)",vr:"LT",name:"ApprovalStatusFurtherDescription",vm:"1",version:"DICOM"},"(0044,0004)":{tag:"(0044,0004)",vr:"DT",name:"ApprovalStatusDateTime",vm:"1",version:"DICOM"},"(0044,0007)":{tag:"(0044,0007)",vr:"SQ",name:"ProductTypeCodeSequence",vm:"1",version:"DICOM"},"(0044,0008)":{tag:"(0044,0008)",vr:"LO",name:"ProductName",vm:"1-n",version:"DICOM"},"(0044,0009)":{tag:"(0044,0009)",vr:"LT",name:"ProductDescription",vm:"1",version:"DICOM"},"(0044,000A)":{tag:"(0044,000A)",vr:"LO",name:"ProductLotIdentifier",vm:"1",version:"DICOM"},"(0044,000B)":{tag:"(0044,000B)",vr:"DT",name:"ProductExpirationDateTime",vm:"1",version:"DICOM"},"(0044,0010)":{tag:"(0044,0010)",vr:"DT",name:"SubstanceAdministrationDateTime",vm:"1",version:"DICOM"},"(0044,0011)":{tag:"(0044,0011)",vr:"LO",name:"SubstanceAdministrationNotes",vm:"1",version:"DICOM"},"(0044,0012)":{tag:"(0044,0012)",vr:"LO",name:"SubstanceAdministrationDeviceID",vm:"1",version:"DICOM"},"(0044,0013)":{tag:"(0044,0013)",vr:"SQ",name:"ProductParameterSequence",vm:"1",version:"DICOM"},"(0044,0019)":{tag:"(0044,0019)",vr:"SQ",name:"SubstanceAdministrationParameterSequence",vm:"1",version:"DICOM"},"(0046,0012)":{tag:"(0046,0012)",vr:"LO",name:"LensDescription",vm:"1",version:"DICOM"},"(0046,0014)":{tag:"(0046,0014)",vr:"SQ",name:"RightLensSequence",vm:"1",version:"DICOM"},"(0046,0015)":{tag:"(0046,0015)",vr:"SQ",name:"LeftLensSequence",vm:"1",version:"DICOM"},"(0046,0016)":{tag:"(0046,0016)",vr:"SQ",name:"UnspecifiedLateralityLensSequence",vm:"1",version:"DICOM"},"(0046,0018)":{tag:"(0046,0018)",vr:"SQ",name:"CylinderSequence",vm:"1",version:"DICOM"},"(0046,0028)":{tag:"(0046,0028)",vr:"SQ",name:"PrismSequence",vm:"1",version:"DICOM"},"(0046,0030)":{tag:"(0046,0030)",vr:"FD",name:"HorizontalPrismPower",vm:"1",version:"DICOM"},"(0046,0032)":{tag:"(0046,0032)",vr:"CS",name:"HorizontalPrismBase",vm:"1",version:"DICOM"},"(0046,0034)":{tag:"(0046,0034)",vr:"FD",name:"VerticalPrismPower",vm:"1",version:"DICOM"},"(0046,0036)":{tag:"(0046,0036)",vr:"CS",name:"VerticalPrismBase",vm:"1",version:"DICOM"},"(0046,0038)":{tag:"(0046,0038)",vr:"CS",name:"LensSegmentType",vm:"1",version:"DICOM"},"(0046,0040)":{tag:"(0046,0040)",vr:"FD",name:"OpticalTransmittance",vm:"1",version:"DICOM"},"(0046,0042)":{tag:"(0046,0042)",vr:"FD",name:"ChannelWidth",vm:"1",version:"DICOM"},"(0046,0044)":{tag:"(0046,0044)",vr:"FD",name:"PupilSize",vm:"1",version:"DICOM"},"(0046,0046)":{tag:"(0046,0046)",vr:"FD",name:"CornealSize",vm:"1",version:"DICOM"},"(0046,0050)":{tag:"(0046,0050)",vr:"SQ",name:"AutorefractionRightEyeSequence",vm:"1",version:"DICOM"},"(0046,0052)":{tag:"(0046,0052)",vr:"SQ",name:"AutorefractionLeftEyeSequence",vm:"1",version:"DICOM"},"(0046,0060)":{tag:"(0046,0060)",vr:"FD",name:"DistancePupillaryDistance",vm:"1",version:"DICOM"},"(0046,0062)":{tag:"(0046,0062)",vr:"FD",name:"NearPupillaryDistance",vm:"1",version:"DICOM"},"(0046,0063)":{tag:"(0046,0063)",vr:"FD",name:"IntermediatePupillaryDistance",vm:"1",version:"DICOM"},"(0046,0064)":{tag:"(0046,0064)",vr:"FD",name:"OtherPupillaryDistance",vm:"1",version:"DICOM"},"(0046,0070)":{tag:"(0046,0070)",vr:"SQ",name:"KeratometryRightEyeSequence",vm:"1",version:"DICOM"},"(0046,0071)":{tag:"(0046,0071)",vr:"SQ",name:"KeratometryLeftEyeSequence",vm:"1",version:"DICOM"},"(0046,0074)":{tag:"(0046,0074)",vr:"SQ",name:"SteepKeratometricAxisSequence",vm:"1",version:"DICOM"},"(0046,0075)":{tag:"(0046,0075)",vr:"FD",name:"RadiusOfCurvature",vm:"1",version:"DICOM"},"(0046,0076)":{tag:"(0046,0076)",vr:"FD",name:"KeratometricPower",vm:"1",version:"DICOM"},"(0046,0077)":{tag:"(0046,0077)",vr:"FD",name:"KeratometricAxis",vm:"1",version:"DICOM"},"(0046,0080)":{tag:"(0046,0080)",vr:"SQ",name:"FlatKeratometricAxisSequence",vm:"1",version:"DICOM"},"(0046,0092)":{tag:"(0046,0092)",vr:"CS",name:"BackgroundColor",vm:"1",version:"DICOM"},"(0046,0094)":{tag:"(0046,0094)",vr:"CS",name:"Optotype",vm:"1",version:"DICOM"},"(0046,0095)":{tag:"(0046,0095)",vr:"CS",name:"OptotypePresentation",vm:"1",version:"DICOM"},"(0046,0097)":{tag:"(0046,0097)",vr:"SQ",name:"SubjectiveRefractionRightEyeSequence",vm:"1",version:"DICOM"},"(0046,0098)":{tag:"(0046,0098)",vr:"SQ",name:"SubjectiveRefractionLeftEyeSequence",vm:"1",version:"DICOM"},"(0046,0100)":{tag:"(0046,0100)",vr:"SQ",name:"AddNearSequence",vm:"1",version:"DICOM"},"(0046,0101)":{tag:"(0046,0101)",vr:"SQ",name:"AddIntermediateSequence",vm:"1",version:"DICOM"},"(0046,0102)":{tag:"(0046,0102)",vr:"SQ",name:"AddOtherSequence",vm:"1",version:"DICOM"},"(0046,0104)":{tag:"(0046,0104)",vr:"FD",name:"AddPower",vm:"1",version:"DICOM"},"(0046,0106)":{tag:"(0046,0106)",vr:"FD",name:"ViewingDistance",vm:"1",version:"DICOM"},"(0046,0121)":{tag:"(0046,0121)",vr:"SQ",name:"VisualAcuityTypeCodeSequence",vm:"1",version:"DICOM"},"(0046,0122)":{tag:"(0046,0122)",vr:"SQ",name:"VisualAcuityRightEyeSequence",vm:"1",version:"DICOM"},"(0046,0123)":{tag:"(0046,0123)",vr:"SQ",name:"VisualAcuityLeftEyeSequence",vm:"1",version:"DICOM"},"(0046,0124)":{tag:"(0046,0124)",vr:"SQ",name:"VisualAcuityBothEyesOpenSequence",vm:"1",version:"DICOM"},"(0046,0125)":{tag:"(0046,0125)",vr:"CS",name:"ViewingDistanceType",vm:"1",version:"DICOM"},"(0046,0135)":{tag:"(0046,0135)",vr:"SS",name:"VisualAcuityModifiers",vm:"2",version:"DICOM"},"(0046,0137)":{tag:"(0046,0137)",vr:"FD",name:"DecimalVisualAcuity",vm:"1",version:"DICOM"},"(0046,0139)":{tag:"(0046,0139)",vr:"LO",name:"OptotypeDetailedDefinition",vm:"1",version:"DICOM"},"(0046,0145)":{tag:"(0046,0145)",vr:"SQ",name:"ReferencedRefractiveMeasurementsSequence",vm:"1",version:"DICOM"},"(0046,0146)":{tag:"(0046,0146)",vr:"FD",name:"SpherePower",vm:"1",version:"DICOM"},"(0046,0147)":{tag:"(0046,0147)",vr:"FD",name:"CylinderPower",vm:"1",version:"DICOM"},"(0046,0201)":{tag:"(0046,0201)",vr:"CS",name:"CornealTopographySurface",vm:"1",version:"DICOM"},"(0046,0202)":{tag:"(0046,0202)",vr:"FL",name:"CornealVertexLocation",vm:"2",version:"DICOM"},"(0046,0203)":{tag:"(0046,0203)",vr:"FL",name:"PupilCentroidXCoordinate",vm:"1",version:"DICOM"},"(0046,0204)":{tag:"(0046,0204)",vr:"FL",name:"PupilCentroidYCoordinate",vm:"1",version:"DICOM"},"(0046,0205)":{tag:"(0046,0205)",vr:"FL",name:"EquivalentPupilRadius",vm:"1",version:"DICOM"},"(0046,0207)":{tag:"(0046,0207)",vr:"SQ",name:"CornealTopographyMapTypeCodeSequence",vm:"1",version:"DICOM"},"(0046,0208)":{tag:"(0046,0208)",vr:"IS",name:"VerticesOfTheOutlineOfPupil",vm:"2-2n",version:"DICOM"},"(0046,0210)":{tag:"(0046,0210)",vr:"SQ",name:"CornealTopographyMappingNormalsSequence",vm:"1",version:"DICOM"},"(0046,0211)":{tag:"(0046,0211)",vr:"SQ",name:"MaximumCornealCurvatureSequence",vm:"1",version:"DICOM"},"(0046,0212)":{tag:"(0046,0212)",vr:"FL",name:"MaximumCornealCurvature",vm:"1",version:"DICOM"},"(0046,0213)":{tag:"(0046,0213)",vr:"FL",name:"MaximumCornealCurvatureLocation",vm:"2",version:"DICOM"},"(0046,0215)":{tag:"(0046,0215)",vr:"SQ",name:"MinimumKeratometricSequence",vm:"1",version:"DICOM"},"(0046,0218)":{tag:"(0046,0218)",vr:"SQ",name:"SimulatedKeratometricCylinderSequence",vm:"1",version:"DICOM"},"(0046,0220)":{tag:"(0046,0220)",vr:"FL",name:"AverageCornealPower",vm:"1",version:"DICOM"},"(0046,0224)":{tag:"(0046,0224)",vr:"FL",name:"CornealISValue",vm:"1",version:"DICOM"},"(0046,0227)":{tag:"(0046,0227)",vr:"FL",name:"AnalyzedArea",vm:"1",version:"DICOM"},"(0046,0230)":{tag:"(0046,0230)",vr:"FL",name:"SurfaceRegularityIndex",vm:"1",version:"DICOM"},"(0046,0232)":{tag:"(0046,0232)",vr:"FL",name:"SurfaceAsymmetryIndex",vm:"1",version:"DICOM"},"(0046,0234)":{tag:"(0046,0234)",vr:"FL",name:"CornealEccentricityIndex",vm:"1",version:"DICOM"},"(0046,0236)":{tag:"(0046,0236)",vr:"FL",name:"KeratoconusPredictionIndex",vm:"1",version:"DICOM"},"(0046,0238)":{tag:"(0046,0238)",vr:"FL",name:"DecimalPotentialVisualAcuity",vm:"1",version:"DICOM"},"(0046,0242)":{tag:"(0046,0242)",vr:"CS",name:"CornealTopographyMapQualityEvaluation",vm:"1",version:"DICOM"},"(0046,0244)":{tag:"(0046,0244)",vr:"SQ",name:"SourceImageCornealProcessedDataSequence",vm:"1",version:"DICOM"},"(0046,0247)":{tag:"(0046,0247)",vr:"FL",name:"CornealPointLocation",vm:"3",version:"DICOM"},"(0046,0248)":{tag:"(0046,0248)",vr:"CS",name:"CornealPointEstimated",vm:"1",version:"DICOM"},"(0046,0249)":{tag:"(0046,0249)",vr:"FL",name:"AxialPower",vm:"1",version:"DICOM"},"(0046,0250)":{tag:"(0046,0250)",vr:"FL",name:"TangentialPower",vm:"1",version:"DICOM"},"(0046,0251)":{tag:"(0046,0251)",vr:"FL",name:"RefractivePower",vm:"1",version:"DICOM"},"(0046,0252)":{tag:"(0046,0252)",vr:"FL",name:"RelativeElevation",vm:"1",version:"DICOM"},"(0046,0253)":{tag:"(0046,0253)",vr:"FL",name:"CornealWavefront",vm:"1",version:"DICOM"},"(0048,0001)":{tag:"(0048,0001)",vr:"FL",name:"ImagedVolumeWidth",vm:"1",version:"DICOM"},"(0048,0002)":{tag:"(0048,0002)",vr:"FL",name:"ImagedVolumeHeight",vm:"1",version:"DICOM"},"(0048,0003)":{tag:"(0048,0003)",vr:"FL",name:"ImagedVolumeDepth",vm:"1",version:"DICOM"},"(0048,0006)":{tag:"(0048,0006)",vr:"UL",name:"TotalPixelMatrixColumns",vm:"1",version:"DICOM"},"(0048,0007)":{tag:"(0048,0007)",vr:"UL",name:"TotalPixelMatrixRows",vm:"1",version:"DICOM"},"(0048,0008)":{tag:"(0048,0008)",vr:"SQ",name:"TotalPixelMatrixOriginSequence",vm:"1",version:"DICOM"},"(0048,0010)":{tag:"(0048,0010)",vr:"CS",name:"SpecimenLabelInImage",vm:"1",version:"DICOM"},"(0048,0011)":{tag:"(0048,0011)",vr:"CS",name:"FocusMethod",vm:"1",version:"DICOM"},"(0048,0012)":{tag:"(0048,0012)",vr:"CS",name:"ExtendedDepthOfField",vm:"1",version:"DICOM"},"(0048,0013)":{tag:"(0048,0013)",vr:"US",name:"NumberOfFocalPlanes",vm:"1",version:"DICOM"},"(0048,0014)":{tag:"(0048,0014)",vr:"FL",name:"DistanceBetweenFocalPlanes",vm:"1",version:"DICOM"},"(0048,0015)":{tag:"(0048,0015)",vr:"US",name:"RecommendedAbsentPixelCIELabValue",vm:"3",version:"DICOM"},"(0048,0100)":{tag:"(0048,0100)",vr:"SQ",name:"IlluminatorTypeCodeSequence",vm:"1",version:"DICOM"},"(0048,0102)":{tag:"(0048,0102)",vr:"DS",name:"ImageOrientationSlide",vm:"6",version:"DICOM"},"(0048,0105)":{tag:"(0048,0105)",vr:"SQ",name:"OpticalPathSequence",vm:"1",version:"DICOM"},"(0048,0106)":{tag:"(0048,0106)",vr:"SH",name:"OpticalPathIdentifier",vm:"1",version:"DICOM"},"(0048,0107)":{tag:"(0048,0107)",vr:"ST",name:"OpticalPathDescription",vm:"1",version:"DICOM"},"(0048,0108)":{tag:"(0048,0108)",vr:"SQ",name:"IlluminationColorCodeSequence",vm:"1",version:"DICOM"},"(0048,0110)":{tag:"(0048,0110)",vr:"SQ",name:"SpecimenReferenceSequence",vm:"1",version:"DICOM"},"(0048,0111)":{tag:"(0048,0111)",vr:"DS",name:"CondenserLensPower",vm:"1",version:"DICOM"},"(0048,0112)":{tag:"(0048,0112)",vr:"DS",name:"ObjectiveLensPower",vm:"1",version:"DICOM"},"(0048,0113)":{tag:"(0048,0113)",vr:"DS",name:"ObjectiveLensNumericalAperture",vm:"1",version:"DICOM"},"(0048,0120)":{tag:"(0048,0120)",vr:"SQ",name:"PaletteColorLookupTableSequence",vm:"1",version:"DICOM"},"(0048,0200)":{tag:"(0048,0200)",vr:"SQ",name:"ReferencedImageNavigationSequence",vm:"1",version:"DICOM"},"(0048,0201)":{tag:"(0048,0201)",vr:"US",name:"TopLeftHandCornerOfLocalizerArea",vm:"2",version:"DICOM"},"(0048,0202)":{tag:"(0048,0202)",vr:"US",name:"BottomRightHandCornerOfLocalizerArea",vm:"2",version:"DICOM"},"(0048,0207)":{tag:"(0048,0207)",vr:"SQ",name:"OpticalPathIdentificationSequence",vm:"1",version:"DICOM"},"(0048,021A)":{tag:"(0048,021A)",vr:"SQ",name:"PlanePositionSlideSequence",vm:"1",version:"DICOM"},"(0048,021E)":{tag:"(0048,021E)",vr:"SL",name:"ColumnPositionInTotalImagePixelMatrix",vm:"1",version:"DICOM"},"(0048,021F)":{tag:"(0048,021F)",vr:"SL",name:"RowPositionInTotalImagePixelMatrix",vm:"1",version:"DICOM"},"(0048,0301)":{tag:"(0048,0301)",vr:"CS",name:"PixelOriginInterpretation",vm:"1",version:"DICOM"},"(0050,0004)":{tag:"(0050,0004)",vr:"CS",name:"CalibrationImage",vm:"1",version:"DICOM"},"(0050,0010)":{tag:"(0050,0010)",vr:"SQ",name:"DeviceSequence",vm:"1",version:"DICOM"},"(0050,0012)":{tag:"(0050,0012)",vr:"SQ",name:"ContainerComponentTypeCodeSequence",vm:"1",version:"DICOM"},"(0050,0013)":{tag:"(0050,0013)",vr:"FD",name:"ContainerComponentThickness",vm:"1",version:"DICOM"},"(0050,0014)":{tag:"(0050,0014)",vr:"DS",name:"DeviceLength",vm:"1",version:"DICOM"},"(0050,0015)":{tag:"(0050,0015)",vr:"FD",name:"ContainerComponentWidth",vm:"1",version:"DICOM"},"(0050,0016)":{tag:"(0050,0016)",vr:"DS",name:"DeviceDiameter",vm:"1",version:"DICOM"},"(0050,0017)":{tag:"(0050,0017)",vr:"CS",name:"DeviceDiameterUnits",vm:"1",version:"DICOM"},"(0050,0018)":{tag:"(0050,0018)",vr:"DS",name:"DeviceVolume",vm:"1",version:"DICOM"},"(0050,0019)":{tag:"(0050,0019)",vr:"DS",name:"InterMarkerDistance",vm:"1",version:"DICOM"},"(0050,001A)":{tag:"(0050,001A)",vr:"CS",name:"ContainerComponentMaterial",vm:"1",version:"DICOM"},"(0050,001B)":{tag:"(0050,001B)",vr:"LO",name:"ContainerComponentID",vm:"1",version:"DICOM"},"(0050,001C)":{tag:"(0050,001C)",vr:"FD",name:"ContainerComponentLength",vm:"1",version:"DICOM"},"(0050,001D)":{tag:"(0050,001D)",vr:"FD",name:"ContainerComponentDiameter",vm:"1",version:"DICOM"},"(0050,001E)":{tag:"(0050,001E)",vr:"LO",name:"ContainerComponentDescription",vm:"1",version:"DICOM"},"(0050,0020)":{tag:"(0050,0020)",vr:"LO",name:"DeviceDescription",vm:"1",version:"DICOM"},"(0052,0001)":{tag:"(0052,0001)",vr:"FL",name:"ContrastBolusIngredientPercentByVolume",vm:"1",version:"DICOM"},"(0052,0002)":{tag:"(0052,0002)",vr:"FD",name:"OCTFocalDistance",vm:"1",version:"DICOM"},"(0052,0003)":{tag:"(0052,0003)",vr:"FD",name:"BeamSpotSize",vm:"1",version:"DICOM"},"(0052,0004)":{tag:"(0052,0004)",vr:"FD",name:"EffectiveRefractiveIndex",vm:"1",version:"DICOM"},"(0052,0006)":{tag:"(0052,0006)",vr:"CS",name:"OCTAcquisitionDomain",vm:"1",version:"DICOM"},"(0052,0007)":{tag:"(0052,0007)",vr:"FD",name:"OCTOpticalCenterWavelength",vm:"1",version:"DICOM"},"(0052,0008)":{tag:"(0052,0008)",vr:"FD",name:"AxialResolution",vm:"1",version:"DICOM"},"(0052,0009)":{tag:"(0052,0009)",vr:"FD",name:"RangingDepth",vm:"1",version:"DICOM"},"(0052,0011)":{tag:"(0052,0011)",vr:"FD",name:"ALineRate",vm:"1",version:"DICOM"},"(0052,0012)":{tag:"(0052,0012)",vr:"US",name:"ALinesPerFrame",vm:"1",version:"DICOM"},"(0052,0013)":{tag:"(0052,0013)",vr:"FD",name:"CatheterRotationalRate",vm:"1",version:"DICOM"},"(0052,0014)":{tag:"(0052,0014)",vr:"FD",name:"ALinePixelSpacing",vm:"1",version:"DICOM"},"(0052,0016)":{tag:"(0052,0016)",vr:"SQ",name:"ModeOfPercutaneousAccessSequence",vm:"1",version:"DICOM"},"(0052,0025)":{tag:"(0052,0025)",vr:"SQ",name:"IntravascularOCTFrameTypeSequence",vm:"1",version:"DICOM"},"(0052,0026)":{tag:"(0052,0026)",vr:"CS",name:"OCTZOffsetApplied",vm:"1",version:"DICOM"},"(0052,0027)":{tag:"(0052,0027)",vr:"SQ",name:"IntravascularFrameContentSequence",vm:"1",version:"DICOM"},"(0052,0028)":{tag:"(0052,0028)",vr:"FD",name:"IntravascularLongitudinalDistance",vm:"1",version:"DICOM"},"(0052,0029)":{tag:"(0052,0029)",vr:"SQ",name:"IntravascularOCTFrameContentSequence",vm:"1",version:"DICOM"},"(0052,0030)":{tag:"(0052,0030)",vr:"SS",name:"OCTZOffsetCorrection",vm:"1",version:"DICOM"},"(0052,0031)":{tag:"(0052,0031)",vr:"CS",name:"CatheterDirectionOfRotation",vm:"1",version:"DICOM"},"(0052,0033)":{tag:"(0052,0033)",vr:"FD",name:"SeamLineLocation",vm:"1",version:"DICOM"},"(0052,0034)":{tag:"(0052,0034)",vr:"FD",name:"FirstALineLocation",vm:"1",version:"DICOM"},"(0052,0036)":{tag:"(0052,0036)",vr:"US",name:"SeamLineIndex",vm:"1",version:"DICOM"},"(0052,0038)":{tag:"(0052,0038)",vr:"US",name:"NumberOfPaddedALines",vm:"1",version:"DICOM"},"(0052,0039)":{tag:"(0052,0039)",vr:"CS",name:"InterpolationType",vm:"1",version:"DICOM"},"(0052,003A)":{tag:"(0052,003A)",vr:"CS",name:"RefractiveIndexApplied",vm:"1",version:"DICOM"},"(0054,0010)":{tag:"(0054,0010)",vr:"US",name:"EnergyWindowVector",vm:"1-n",version:"DICOM"},"(0054,0011)":{tag:"(0054,0011)",vr:"US",name:"NumberOfEnergyWindows",vm:"1",version:"DICOM"},"(0054,0012)":{tag:"(0054,0012)",vr:"SQ",name:"EnergyWindowInformationSequence",vm:"1",version:"DICOM"},"(0054,0013)":{tag:"(0054,0013)",vr:"SQ",name:"EnergyWindowRangeSequence",vm:"1",version:"DICOM"},"(0054,0014)":{tag:"(0054,0014)",vr:"DS",name:"EnergyWindowLowerLimit",vm:"1",version:"DICOM"},"(0054,0015)":{tag:"(0054,0015)",vr:"DS",name:"EnergyWindowUpperLimit",vm:"1",version:"DICOM"},"(0054,0016)":{tag:"(0054,0016)",vr:"SQ",name:"RadiopharmaceuticalInformationSequence",vm:"1",version:"DICOM"},"(0054,0017)":{tag:"(0054,0017)",vr:"IS",name:"ResidualSyringeCounts",vm:"1",version:"DICOM"},"(0054,0018)":{tag:"(0054,0018)",vr:"SH",name:"EnergyWindowName",vm:"1",version:"DICOM"},"(0054,0020)":{tag:"(0054,0020)",vr:"US",name:"DetectorVector",vm:"1-n",version:"DICOM"},"(0054,0021)":{tag:"(0054,0021)",vr:"US",name:"NumberOfDetectors",vm:"1",version:"DICOM"},"(0054,0022)":{tag:"(0054,0022)",vr:"SQ",name:"DetectorInformationSequence",vm:"1",version:"DICOM"},"(0054,0030)":{tag:"(0054,0030)",vr:"US",name:"PhaseVector",vm:"1-n",version:"DICOM"},"(0054,0031)":{tag:"(0054,0031)",vr:"US",name:"NumberOfPhases",vm:"1",version:"DICOM"},"(0054,0032)":{tag:"(0054,0032)",vr:"SQ",name:"PhaseInformationSequence",vm:"1",version:"DICOM"},"(0054,0033)":{tag:"(0054,0033)",vr:"US",name:"NumberOfFramesInPhase",vm:"1",version:"DICOM"},"(0054,0036)":{tag:"(0054,0036)",vr:"IS",name:"PhaseDelay",vm:"1",version:"DICOM"},"(0054,0038)":{tag:"(0054,0038)",vr:"IS",name:"PauseBetweenFrames",vm:"1",version:"DICOM"},"(0054,0039)":{tag:"(0054,0039)",vr:"CS",name:"PhaseDescription",vm:"1",version:"DICOM"},"(0054,0050)":{tag:"(0054,0050)",vr:"US",name:"RotationVector",vm:"1-n",version:"DICOM"},"(0054,0051)":{tag:"(0054,0051)",vr:"US",name:"NumberOfRotations",vm:"1",version:"DICOM"},"(0054,0052)":{tag:"(0054,0052)",vr:"SQ",name:"RotationInformationSequence",vm:"1",version:"DICOM"},"(0054,0053)":{tag:"(0054,0053)",vr:"US",name:"NumberOfFramesInRotation",vm:"1",version:"DICOM"},"(0054,0060)":{tag:"(0054,0060)",vr:"US",name:"RRIntervalVector",vm:"1-n",version:"DICOM"},"(0054,0061)":{tag:"(0054,0061)",vr:"US",name:"NumberOfRRIntervals",vm:"1",version:"DICOM"},"(0054,0062)":{tag:"(0054,0062)",vr:"SQ",name:"GatedInformationSequence",vm:"1",version:"DICOM"},"(0054,0063)":{tag:"(0054,0063)",vr:"SQ",name:"DataInformationSequence",vm:"1",version:"DICOM"},"(0054,0070)":{tag:"(0054,0070)",vr:"US",name:"TimeSlotVector",vm:"1-n",version:"DICOM"},"(0054,0071)":{tag:"(0054,0071)",vr:"US",name:"NumberOfTimeSlots",vm:"1",version:"DICOM"},"(0054,0072)":{tag:"(0054,0072)",vr:"SQ",name:"TimeSlotInformationSequence",vm:"1",version:"DICOM"},"(0054,0073)":{tag:"(0054,0073)",vr:"DS",name:"TimeSlotTime",vm:"1",version:"DICOM"},"(0054,0080)":{tag:"(0054,0080)",vr:"US",name:"SliceVector",vm:"1-n",version:"DICOM"},"(0054,0081)":{tag:"(0054,0081)",vr:"US",name:"NumberOfSlices",vm:"1",version:"DICOM"},"(0054,0090)":{tag:"(0054,0090)",vr:"US",name:"AngularViewVector",vm:"1-n",version:"DICOM"},"(0054,0100)":{tag:"(0054,0100)",vr:"US",name:"TimeSliceVector",vm:"1-n",version:"DICOM"},"(0054,0101)":{tag:"(0054,0101)",vr:"US",name:"NumberOfTimeSlices",vm:"1",version:"DICOM"},"(0054,0200)":{tag:"(0054,0200)",vr:"DS",name:"StartAngle",vm:"1",version:"DICOM"},"(0054,0202)":{tag:"(0054,0202)",vr:"CS",name:"TypeOfDetectorMotion",vm:"1",version:"DICOM"},"(0054,0210)":{tag:"(0054,0210)",vr:"IS",name:"TriggerVector",vm:"1-n",version:"DICOM"},"(0054,0211)":{tag:"(0054,0211)",vr:"US",name:"NumberOfTriggersInPhase",vm:"1",version:"DICOM"},"(0054,0220)":{tag:"(0054,0220)",vr:"SQ",name:"ViewCodeSequence",vm:"1",version:"DICOM"},"(0054,0222)":{tag:"(0054,0222)",vr:"SQ",name:"ViewModifierCodeSequence",vm:"1",version:"DICOM"},"(0054,0300)":{tag:"(0054,0300)",vr:"SQ",name:"RadionuclideCodeSequence",vm:"1",version:"DICOM"},"(0054,0302)":{tag:"(0054,0302)",vr:"SQ",name:"AdministrationRouteCodeSequence",vm:"1",version:"DICOM"},"(0054,0304)":{tag:"(0054,0304)",vr:"SQ",name:"RadiopharmaceuticalCodeSequence",vm:"1",version:"DICOM"},"(0054,0306)":{tag:"(0054,0306)",vr:"SQ",name:"CalibrationDataSequence",vm:"1",version:"DICOM"},"(0054,0308)":{tag:"(0054,0308)",vr:"US",name:"EnergyWindowNumber",vm:"1",version:"DICOM"},"(0054,0400)":{tag:"(0054,0400)",vr:"SH",name:"ImageID",vm:"1",version:"DICOM"},"(0054,0410)":{tag:"(0054,0410)",vr:"SQ",name:"PatientOrientationCodeSequence",vm:"1",version:"DICOM"},"(0054,0412)":{tag:"(0054,0412)",vr:"SQ",name:"PatientOrientationModifierCodeSequence",vm:"1",version:"DICOM"},"(0054,0414)":{tag:"(0054,0414)",vr:"SQ",name:"PatientGantryRelationshipCodeSequence",vm:"1",version:"DICOM"},"(0054,0500)":{tag:"(0054,0500)",vr:"CS",name:"SliceProgressionDirection",vm:"1",version:"DICOM"},"(0054,0501)":{tag:"(0054,0501)",vr:"CS",name:"ScanProgressionDirection",vm:"1",version:"DICOM"},"(0054,1000)":{tag:"(0054,1000)",vr:"CS",name:"SeriesType",vm:"2",version:"DICOM"},"(0054,1001)":{tag:"(0054,1001)",vr:"CS",name:"Units",vm:"1",version:"DICOM"},"(0054,1002)":{tag:"(0054,1002)",vr:"CS",name:"CountsSource",vm:"1",version:"DICOM"},"(0054,1004)":{tag:"(0054,1004)",vr:"CS",name:"ReprojectionMethod",vm:"1",version:"DICOM"},"(0054,1006)":{tag:"(0054,1006)",vr:"CS",name:"SUVType",vm:"1",version:"DICOM"},"(0054,1100)":{tag:"(0054,1100)",vr:"CS",name:"RandomsCorrectionMethod",vm:"1",version:"DICOM"},"(0054,1101)":{tag:"(0054,1101)",vr:"LO",name:"AttenuationCorrectionMethod",vm:"1",version:"DICOM"},"(0054,1102)":{tag:"(0054,1102)",vr:"CS",name:"DecayCorrection",vm:"1",version:"DICOM"},"(0054,1103)":{tag:"(0054,1103)",vr:"LO",name:"ReconstructionMethod",vm:"1",version:"DICOM"},"(0054,1104)":{tag:"(0054,1104)",vr:"LO",name:"DetectorLinesOfResponseUsed",vm:"1",version:"DICOM"},"(0054,1105)":{tag:"(0054,1105)",vr:"LO",name:"ScatterCorrectionMethod",vm:"1",version:"DICOM"},"(0054,1200)":{tag:"(0054,1200)",vr:"DS",name:"AxialAcceptance",vm:"1",version:"DICOM"},"(0054,1201)":{tag:"(0054,1201)",vr:"IS",name:"AxialMash",vm:"2",version:"DICOM"},"(0054,1202)":{tag:"(0054,1202)",vr:"IS",name:"TransverseMash",vm:"1",version:"DICOM"},"(0054,1203)":{tag:"(0054,1203)",vr:"DS",name:"DetectorElementSize",vm:"2",version:"DICOM"},"(0054,1210)":{tag:"(0054,1210)",vr:"DS",name:"CoincidenceWindowWidth",vm:"1",version:"DICOM"},"(0054,1220)":{tag:"(0054,1220)",vr:"CS",name:"SecondaryCountsType",vm:"1-n",version:"DICOM"},"(0054,1300)":{tag:"(0054,1300)",vr:"DS",name:"FrameReferenceTime",vm:"1",version:"DICOM"},"(0054,1310)":{tag:"(0054,1310)",vr:"IS",name:"PrimaryPromptsCountsAccumulated",vm:"1",version:"DICOM"},"(0054,1311)":{tag:"(0054,1311)",vr:"IS",name:"SecondaryCountsAccumulated",vm:"1-n",version:"DICOM"},"(0054,1320)":{tag:"(0054,1320)",vr:"DS",name:"SliceSensitivityFactor",vm:"1",version:"DICOM"},"(0054,1321)":{tag:"(0054,1321)",vr:"DS",name:"DecayFactor",vm:"1",version:"DICOM"},"(0054,1322)":{tag:"(0054,1322)",vr:"DS",name:"DoseCalibrationFactor",vm:"1",version:"DICOM"},"(0054,1323)":{tag:"(0054,1323)",vr:"DS",name:"ScatterFractionFactor",vm:"1",version:"DICOM"},"(0054,1324)":{tag:"(0054,1324)",vr:"DS",name:"DeadTimeFactor",vm:"1",version:"DICOM"},"(0054,1330)":{tag:"(0054,1330)",vr:"US",name:"ImageIndex",vm:"1",version:"DICOM"},"(0060,3000)":{tag:"(0060,3000)",vr:"SQ",name:"HistogramSequence",vm:"1",version:"DICOM"},"(0060,3002)":{tag:"(0060,3002)",vr:"US",name:"HistogramNumberOfBins",vm:"1",version:"DICOM"},"(0060,3004)":{tag:"(0060,3004)",vr:"xs",name:"HistogramFirstBinValue",vm:"1",version:"DICOM"},"(0060,3006)":{tag:"(0060,3006)",vr:"xs",name:"HistogramLastBinValue",vm:"1",version:"DICOM"},"(0060,3008)":{tag:"(0060,3008)",vr:"US",name:"HistogramBinWidth",vm:"1",version:"DICOM"},"(0060,3010)":{tag:"(0060,3010)",vr:"LO",name:"HistogramExplanation",vm:"1",version:"DICOM"},"(0060,3020)":{tag:"(0060,3020)",vr:"UL",name:"HistogramData",vm:"1-n",version:"DICOM"},"(0062,0001)":{tag:"(0062,0001)",vr:"CS",name:"SegmentationType",vm:"1",version:"DICOM"},"(0062,0002)":{tag:"(0062,0002)",vr:"SQ",name:"SegmentSequence",vm:"1",version:"DICOM"},"(0062,0003)":{tag:"(0062,0003)",vr:"SQ",name:"SegmentedPropertyCategoryCodeSequence",vm:"1",version:"DICOM"},"(0062,0004)":{tag:"(0062,0004)",vr:"US",name:"SegmentNumber",vm:"1",version:"DICOM"},"(0062,0005)":{tag:"(0062,0005)",vr:"LO",name:"SegmentLabel",vm:"1",version:"DICOM"},"(0062,0006)":{tag:"(0062,0006)",vr:"ST",name:"SegmentDescription",vm:"1",version:"DICOM"},"(0062,0008)":{tag:"(0062,0008)",vr:"CS",name:"SegmentAlgorithmType",vm:"1",version:"DICOM"},"(0062,0009)":{tag:"(0062,0009)",vr:"LO",name:"SegmentAlgorithmName",vm:"1",version:"DICOM"},"(0062,000A)":{tag:"(0062,000A)",vr:"SQ",name:"SegmentIdentificationSequence",vm:"1",version:"DICOM"},"(0062,000B)":{tag:"(0062,000B)",vr:"US",name:"ReferencedSegmentNumber",vm:"1-n",version:"DICOM"},"(0062,000C)":{tag:"(0062,000C)",vr:"US",name:"RecommendedDisplayGrayscaleValue",vm:"1",version:"DICOM"},"(0062,000D)":{tag:"(0062,000D)",vr:"US",name:"RecommendedDisplayCIELabValue",vm:"3",version:"DICOM"},"(0062,000E)":{tag:"(0062,000E)",vr:"US",name:"MaximumFractionalValue",vm:"1",version:"DICOM"},"(0062,000F)":{tag:"(0062,000F)",vr:"SQ",name:"SegmentedPropertyTypeCodeSequence",vm:"1",version:"DICOM"},"(0062,0010)":{tag:"(0062,0010)",vr:"CS",name:"SegmentationFractionalType",vm:"1",version:"DICOM"},"(0062,0011)":{tag:"(0062,0011)",vr:"SQ",name:"SegmentedPropertyTypeModifierCodeSequence",vm:"1",version:"DICOM"},"(0062,0012)":{tag:"(0062,0012)",vr:"SQ",name:"UsedSegmentsSequence",vm:"1",version:"DICOM"},"(0064,0002)":{tag:"(0064,0002)",vr:"SQ",name:"DeformableRegistrationSequence",vm:"1",version:"DICOM"},"(0064,0003)":{tag:"(0064,0003)",vr:"UI",name:"SourceFrameOfReferenceUID",vm:"1",version:"DICOM"},"(0064,0005)":{tag:"(0064,0005)",vr:"SQ",name:"DeformableRegistrationGridSequence",vm:"1",version:"DICOM"},"(0064,0007)":{tag:"(0064,0007)",vr:"UL",name:"GridDimensions",vm:"3",version:"DICOM"},"(0064,0008)":{tag:"(0064,0008)",vr:"FD",name:"GridResolution",vm:"3",version:"DICOM"},"(0064,0009)":{tag:"(0064,0009)",vr:"OF",name:"VectorGridData",vm:"1",version:"DICOM"},"(0064,000F)":{tag:"(0064,000F)",vr:"SQ",name:"PreDeformationMatrixRegistrationSequence",vm:"1",version:"DICOM"},"(0064,0010)":{tag:"(0064,0010)",vr:"SQ",name:"PostDeformationMatrixRegistrationSequence",vm:"1",version:"DICOM"},"(0066,0001)":{tag:"(0066,0001)",vr:"UL",name:"NumberOfSurfaces",vm:"1",version:"DICOM"},"(0066,0002)":{tag:"(0066,0002)",vr:"SQ",name:"SurfaceSequence",vm:"1",version:"DICOM"},"(0066,0003)":{tag:"(0066,0003)",vr:"UL",name:"SurfaceNumber",vm:"1",version:"DICOM"},"(0066,0004)":{tag:"(0066,0004)",vr:"LT",name:"SurfaceComments",vm:"1",version:"DICOM"},"(0066,0009)":{tag:"(0066,0009)",vr:"CS",name:"SurfaceProcessing",vm:"1",version:"DICOM"},"(0066,000A)":{tag:"(0066,000A)",vr:"FL",name:"SurfaceProcessingRatio",vm:"1",version:"DICOM"},"(0066,000B)":{tag:"(0066,000B)",vr:"LO",name:"SurfaceProcessingDescription",vm:"1",version:"DICOM"},"(0066,000C)":{tag:"(0066,000C)",vr:"FL",name:"RecommendedPresentationOpacity",vm:"1",version:"DICOM"},"(0066,000D)":{tag:"(0066,000D)",vr:"CS",name:"RecommendedPresentationType",vm:"1",version:"DICOM"},"(0066,000E)":{tag:"(0066,000E)",vr:"CS",name:"FiniteVolume",vm:"1",version:"DICOM"},"(0066,0010)":{tag:"(0066,0010)",vr:"CS",name:"Manifold",vm:"1",version:"DICOM"},"(0066,0011)":{tag:"(0066,0011)",vr:"SQ",name:"SurfacePointsSequence",vm:"1",version:"DICOM"},"(0066,0012)":{tag:"(0066,0012)",vr:"SQ",name:"SurfacePointsNormalsSequence",vm:"1",version:"DICOM"},"(0066,0013)":{tag:"(0066,0013)",vr:"SQ",name:"SurfaceMeshPrimitivesSequence",vm:"1",version:"DICOM"},"(0066,0015)":{tag:"(0066,0015)",vr:"UL",name:"NumberOfSurfacePoints",vm:"1",version:"DICOM"},"(0066,0016)":{tag:"(0066,0016)",vr:"OF",name:"PointCoordinatesData",vm:"1",version:"DICOM"},"(0066,0017)":{tag:"(0066,0017)",vr:"FL",name:"PointPositionAccuracy",vm:"3",version:"DICOM"},"(0066,0018)":{tag:"(0066,0018)",vr:"FL",name:"MeanPointDistance",vm:"1",version:"DICOM"},"(0066,0019)":{tag:"(0066,0019)",vr:"FL",name:"MaximumPointDistance",vm:"1",version:"DICOM"},"(0066,001A)":{tag:"(0066,001A)",vr:"FL",name:"PointsBoundingBoxCoordinates",vm:"6",version:"DICOM"},"(0066,001B)":{tag:"(0066,001B)",vr:"FL",name:"AxisOfRotation",vm:"3",version:"DICOM"},"(0066,001C)":{tag:"(0066,001C)",vr:"FL",name:"CenterOfRotation",vm:"3",version:"DICOM"},"(0066,001E)":{tag:"(0066,001E)",vr:"UL",name:"NumberOfVectors",vm:"1",version:"DICOM"},"(0066,001F)":{tag:"(0066,001F)",vr:"US",name:"VectorDimensionality",vm:"1",version:"DICOM"},"(0066,0020)":{tag:"(0066,0020)",vr:"FL",name:"VectorAccuracy",vm:"1-n",version:"DICOM"},"(0066,0021)":{tag:"(0066,0021)",vr:"OF",name:"VectorCoordinateData",vm:"1",version:"DICOM"},"(0066,0023)":{tag:"(0066,0023)",vr:"OW",name:"TrianglePointIndexList",vm:"1",version:"DICOM"},"(0066,0024)":{tag:"(0066,0024)",vr:"OW",name:"EdgePointIndexList",vm:"1",version:"DICOM"},"(0066,0025)":{tag:"(0066,0025)",vr:"OW",name:"VertexPointIndexList",vm:"1",version:"DICOM"},"(0066,0026)":{tag:"(0066,0026)",vr:"SQ",name:"TriangleStripSequence",vm:"1",version:"DICOM"},"(0066,0027)":{tag:"(0066,0027)",vr:"SQ",name:"TriangleFanSequence",vm:"1",version:"DICOM"},"(0066,0028)":{tag:"(0066,0028)",vr:"SQ",name:"LineSequence",vm:"1",version:"DICOM"},"(0066,0029)":{tag:"(0066,0029)",vr:"OW",name:"PrimitivePointIndexList",vm:"1",version:"DICOM"},"(0066,002A)":{tag:"(0066,002A)",vr:"UL",name:"SurfaceCount",vm:"1",version:"DICOM"},"(0066,002B)":{tag:"(0066,002B)",vr:"SQ",name:"ReferencedSurfaceSequence",vm:"1",version:"DICOM"},"(0066,002C)":{tag:"(0066,002C)",vr:"UL",name:"ReferencedSurfaceNumber",vm:"1",version:"DICOM"},"(0066,002D)":{tag:"(0066,002D)",vr:"SQ",name:"SegmentSurfaceGenerationAlgorithmIdentificationSequence",vm:"1",version:"DICOM"},"(0066,002E)":{tag:"(0066,002E)",vr:"SQ",name:"SegmentSurfaceSourceInstanceSequence",vm:"1",version:"DICOM"},"(0066,002F)":{tag:"(0066,002F)",vr:"SQ",name:"AlgorithmFamilyCodeSequence",vm:"1",version:"DICOM"},"(0066,0030)":{tag:"(0066,0030)",vr:"SQ",name:"AlgorithmNameCodeSequence",vm:"1",version:"DICOM"},"(0066,0031)":{tag:"(0066,0031)",vr:"LO",name:"AlgorithmVersion",vm:"1",version:"DICOM"},"(0066,0032)":{tag:"(0066,0032)",vr:"LT",name:"AlgorithmParameters",vm:"1",version:"DICOM"},"(0066,0034)":{tag:"(0066,0034)",vr:"SQ",name:"FacetSequence",vm:"1",version:"DICOM"},"(0066,0035)":{tag:"(0066,0035)",vr:"SQ",name:"SurfaceProcessingAlgorithmIdentificationSequence",vm:"1",version:"DICOM"},"(0066,0036)":{tag:"(0066,0036)",vr:"LO",name:"AlgorithmName",vm:"1",version:"DICOM"},"(0066,0037)":{tag:"(0066,0037)",vr:"FL",name:"RecommendedPointRadius",vm:"1",version:"DICOM"},"(0066,0038)":{tag:"(0066,0038)",vr:"FL",name:"RecommendedLineThickness",vm:"1",version:"DICOM"},"(0066,0040)":{tag:"(0066,0040)",vr:"UL",name:"LongPrimitivePointIndexList",vm:"1-n",version:"DICOM"},"(0066,0041)":{tag:"(0066,0041)",vr:"UL",name:"LongTrianglePointIndexList",vm:"3-3n",version:"DICOM"},"(0066,0042)":{tag:"(0066,0042)",vr:"UL",name:"LongEdgePointIndexList",vm:"2-2n",version:"DICOM"},"(0066,0043)":{tag:"(0066,0043)",vr:"UL",name:"LongVertexPointIndexList",vm:"1-n",version:"DICOM"},"(0068,6210)":{tag:"(0068,6210)",vr:"LO",name:"ImplantSize",vm:"1",version:"DICOM"},"(0068,6221)":{tag:"(0068,6221)",vr:"LO",name:"ImplantTemplateVersion",vm:"1",version:"DICOM"},"(0068,6222)":{tag:"(0068,6222)",vr:"SQ",name:"ReplacedImplantTemplateSequence",vm:"1",version:"DICOM"},"(0068,6223)":{tag:"(0068,6223)",vr:"CS",name:"ImplantType",vm:"1",version:"DICOM"},"(0068,6224)":{tag:"(0068,6224)",vr:"SQ",name:"DerivationImplantTemplateSequence",vm:"1",version:"DICOM"},"(0068,6225)":{tag:"(0068,6225)",vr:"SQ",name:"OriginalImplantTemplateSequence",vm:"1",version:"DICOM"},"(0068,6226)":{tag:"(0068,6226)",vr:"DT",name:"EffectiveDateTime",vm:"1",version:"DICOM"},"(0068,6230)":{tag:"(0068,6230)",vr:"SQ",name:"ImplantTargetAnatomySequence",vm:"1",version:"DICOM"},"(0068,6260)":{tag:"(0068,6260)",vr:"SQ",name:"InformationFromManufacturerSequence",vm:"1",version:"DICOM"},"(0068,6265)":{tag:"(0068,6265)",vr:"SQ",name:"NotificationFromManufacturerSequence",vm:"1",version:"DICOM"},"(0068,6270)":{tag:"(0068,6270)",vr:"DT",name:"InformationIssueDateTime",vm:"1",version:"DICOM"},"(0068,6280)":{tag:"(0068,6280)",vr:"ST",name:"InformationSummary",vm:"1",version:"DICOM"},"(0068,62A0)":{tag:"(0068,62A0)",vr:"SQ",name:"ImplantRegulatoryDisapprovalCodeSequence",vm:"1",version:"DICOM"},"(0068,62A5)":{tag:"(0068,62A5)",vr:"FD",name:"OverallTemplateSpatialTolerance",vm:"1",version:"DICOM"},"(0068,62C0)":{tag:"(0068,62C0)",vr:"SQ",name:"HPGLDocumentSequence",vm:"1",version:"DICOM"},"(0068,62D0)":{tag:"(0068,62D0)",vr:"US",name:"HPGLDocumentID",vm:"1",version:"DICOM"},"(0068,62D5)":{tag:"(0068,62D5)",vr:"LO",name:"HPGLDocumentLabel",vm:"1",version:"DICOM"},"(0068,62E0)":{tag:"(0068,62E0)",vr:"SQ",name:"ViewOrientationCodeSequence",vm:"1",version:"DICOM"},"(0068,62F0)":{tag:"(0068,62F0)",vr:"FD",name:"ViewOrientationModifier",vm:"9",version:"DICOM"},"(0068,62F2)":{tag:"(0068,62F2)",vr:"FD",name:"HPGLDocumentScaling",vm:"1",version:"DICOM"},"(0068,6300)":{tag:"(0068,6300)",vr:"OB",name:"HPGLDocument",vm:"1",version:"DICOM"},"(0068,6310)":{tag:"(0068,6310)",vr:"US",name:"HPGLContourPenNumber",vm:"1",version:"DICOM"},"(0068,6320)":{tag:"(0068,6320)",vr:"SQ",name:"HPGLPenSequence",vm:"1",version:"DICOM"},"(0068,6330)":{tag:"(0068,6330)",vr:"US",name:"HPGLPenNumber",vm:"1",version:"DICOM"},"(0068,6340)":{tag:"(0068,6340)",vr:"LO",name:"HPGLPenLabel",vm:"1",version:"DICOM"},"(0068,6345)":{tag:"(0068,6345)",vr:"ST",name:"HPGLPenDescription",vm:"1",version:"DICOM"},"(0068,6346)":{tag:"(0068,6346)",vr:"FD",name:"RecommendedRotationPoint",vm:"2",version:"DICOM"},"(0068,6347)":{tag:"(0068,6347)",vr:"FD",name:"BoundingRectangle",vm:"4",version:"DICOM"},"(0068,6350)":{tag:"(0068,6350)",vr:"US",name:"ImplantTemplate3DModelSurfaceNumber",vm:"1-n",version:"DICOM"},"(0068,6360)":{tag:"(0068,6360)",vr:"SQ",name:"SurfaceModelDescriptionSequence",vm:"1",version:"DICOM"},"(0068,6380)":{tag:"(0068,6380)",vr:"LO",name:"SurfaceModelLabel",vm:"1",version:"DICOM"},"(0068,6390)":{tag:"(0068,6390)",vr:"FD",name:"SurfaceModelScalingFactor",vm:"1",version:"DICOM"},"(0068,63A0)":{tag:"(0068,63A0)",vr:"SQ",name:"MaterialsCodeSequence",vm:"1",version:"DICOM"},"(0068,63A4)":{tag:"(0068,63A4)",vr:"SQ",name:"CoatingMaterialsCodeSequence",vm:"1",version:"DICOM"},"(0068,63A8)":{tag:"(0068,63A8)",vr:"SQ",name:"ImplantTypeCodeSequence",vm:"1",version:"DICOM"},"(0068,63AC)":{tag:"(0068,63AC)",vr:"SQ",name:"FixationMethodCodeSequence",vm:"1",version:"DICOM"},"(0068,63B0)":{tag:"(0068,63B0)",vr:"SQ",name:"MatingFeatureSetsSequence",vm:"1",version:"DICOM"},"(0068,63C0)":{tag:"(0068,63C0)",vr:"US",name:"MatingFeatureSetID",vm:"1",version:"DICOM"},"(0068,63D0)":{tag:"(0068,63D0)",vr:"LO",name:"MatingFeatureSetLabel",vm:"1",version:"DICOM"},"(0068,63E0)":{tag:"(0068,63E0)",vr:"SQ",name:"MatingFeatureSequence",vm:"1",version:"DICOM"},"(0068,63F0)":{tag:"(0068,63F0)",vr:"US",name:"MatingFeatureID",vm:"1",version:"DICOM"},"(0068,6400)":{tag:"(0068,6400)",vr:"SQ",name:"MatingFeatureDegreeOfFreedomSequence",vm:"1",version:"DICOM"},"(0068,6410)":{tag:"(0068,6410)",vr:"US",name:"DegreeOfFreedomID",vm:"1",version:"DICOM"},"(0068,6420)":{tag:"(0068,6420)",vr:"CS",name:"DegreeOfFreedomType",vm:"1",version:"DICOM"},"(0068,6430)":{tag:"(0068,6430)",vr:"SQ",name:"TwoDMatingFeatureCoordinatesSequence",vm:"1",version:"DICOM"},"(0068,6440)":{tag:"(0068,6440)",vr:"US",name:"ReferencedHPGLDocumentID",vm:"1",version:"DICOM"},"(0068,6450)":{tag:"(0068,6450)",vr:"FD",name:"TwoDMatingPoint",vm:"2",version:"DICOM"},"(0068,6460)":{tag:"(0068,6460)",vr:"FD",name:"TwoDMatingAxes",vm:"4",version:"DICOM"},"(0068,6470)":{tag:"(0068,6470)",vr:"SQ",name:"TwoDDegreeOfFreedomSequence",vm:"1",version:"DICOM"},"(0068,6490)":{tag:"(0068,6490)",vr:"FD",name:"ThreeDDegreeOfFreedomAxis",vm:"3",version:"DICOM"},"(0068,64A0)":{tag:"(0068,64A0)",vr:"FD",name:"RangeOfFreedom",vm:"2",version:"DICOM"},"(0068,64C0)":{tag:"(0068,64C0)",vr:"FD",name:"ThreeDMatingPoint",vm:"3",version:"DICOM"},"(0068,64D0)":{tag:"(0068,64D0)",vr:"FD",name:"ThreeDMatingAxes",vm:"9",version:"DICOM"},"(0068,64F0)":{tag:"(0068,64F0)",vr:"FD",name:"TwoDDegreeOfFreedomAxis",vm:"3",version:"DICOM"},"(0068,6500)":{tag:"(0068,6500)",vr:"SQ",name:"PlanningLandmarkPointSequence",vm:"1",version:"DICOM"},"(0068,6510)":{tag:"(0068,6510)",vr:"SQ",name:"PlanningLandmarkLineSequence",vm:"1",version:"DICOM"},"(0068,6520)":{tag:"(0068,6520)",vr:"SQ",name:"PlanningLandmarkPlaneSequence",vm:"1",version:"DICOM"},"(0068,6530)":{tag:"(0068,6530)",vr:"US",name:"PlanningLandmarkID",vm:"1",version:"DICOM"},"(0068,6540)":{tag:"(0068,6540)",vr:"LO",name:"PlanningLandmarkDescription",vm:"1",version:"DICOM"},"(0068,6545)":{tag:"(0068,6545)",vr:"SQ",name:"PlanningLandmarkIdentificationCodeSequence",vm:"1",version:"DICOM"},"(0068,6550)":{tag:"(0068,6550)",vr:"SQ",name:"TwoDPointCoordinatesSequence",vm:"1",version:"DICOM"},"(0068,6560)":{tag:"(0068,6560)",vr:"FD",name:"TwoDPointCoordinates",vm:"2",version:"DICOM"},"(0068,6590)":{tag:"(0068,6590)",vr:"FD",name:"ThreeDPointCoordinates",vm:"3",version:"DICOM"},"(0068,65A0)":{tag:"(0068,65A0)",vr:"SQ",name:"TwoDLineCoordinatesSequence",vm:"1",version:"DICOM"},"(0068,65B0)":{tag:"(0068,65B0)",vr:"FD",name:"TwoDLineCoordinates",vm:"4",version:"DICOM"},"(0068,65D0)":{tag:"(0068,65D0)",vr:"FD",name:"ThreeDLineCoordinates",vm:"6",version:"DICOM"},"(0068,65E0)":{tag:"(0068,65E0)",vr:"SQ",name:"TwoDPlaneCoordinatesSequence",vm:"1",version:"DICOM"},"(0068,65F0)":{tag:"(0068,65F0)",vr:"FD",name:"TwoDPlaneIntersection",vm:"4",version:"DICOM"},"(0068,6610)":{tag:"(0068,6610)",vr:"FD",name:"ThreeDPlaneOrigin",vm:"3",version:"DICOM"},"(0068,6620)":{tag:"(0068,6620)",vr:"FD",name:"ThreeDPlaneNormal",vm:"3",version:"DICOM"},"(0070,0001)":{tag:"(0070,0001)",vr:"SQ",name:"GraphicAnnotationSequence",vm:"1",version:"DICOM"},"(0070,0002)":{tag:"(0070,0002)",vr:"CS",name:"GraphicLayer",vm:"1",version:"DICOM"},"(0070,0003)":{tag:"(0070,0003)",vr:"CS",name:"BoundingBoxAnnotationUnits",vm:"1",version:"DICOM"},"(0070,0004)":{tag:"(0070,0004)",vr:"CS",name:"AnchorPointAnnotationUnits",vm:"1",version:"DICOM"},"(0070,0005)":{tag:"(0070,0005)",vr:"CS",name:"GraphicAnnotationUnits",vm:"1",version:"DICOM"},"(0070,0006)":{tag:"(0070,0006)",vr:"ST",name:"UnformattedTextValue",vm:"1",version:"DICOM"},"(0070,0008)":{tag:"(0070,0008)",vr:"SQ",name:"TextObjectSequence",vm:"1",version:"DICOM"},"(0070,0009)":{tag:"(0070,0009)",vr:"SQ",name:"GraphicObjectSequence",vm:"1",version:"DICOM"},"(0070,0010)":{tag:"(0070,0010)",vr:"FL",name:"BoundingBoxTopLeftHandCorner",vm:"2",version:"DICOM"},"(0070,0011)":{tag:"(0070,0011)",vr:"FL",name:"BoundingBoxBottomRightHandCorner",vm:"2",version:"DICOM"},"(0070,0012)":{tag:"(0070,0012)",vr:"CS",name:"BoundingBoxTextHorizontalJustification",vm:"1",version:"DICOM"},"(0070,0014)":{tag:"(0070,0014)",vr:"FL",name:"AnchorPoint",vm:"2",version:"DICOM"},"(0070,0015)":{tag:"(0070,0015)",vr:"CS",name:"AnchorPointVisibility",vm:"1",version:"DICOM"},"(0070,0020)":{tag:"(0070,0020)",vr:"US",name:"GraphicDimensions",vm:"1",version:"DICOM"},"(0070,0021)":{tag:"(0070,0021)",vr:"US",name:"NumberOfGraphicPoints",vm:"1",version:"DICOM"},"(0070,0022)":{tag:"(0070,0022)",vr:"FL",name:"GraphicData",vm:"2-n",version:"DICOM"},"(0070,0023)":{tag:"(0070,0023)",vr:"CS",name:"GraphicType",vm:"1",version:"DICOM"},"(0070,0024)":{tag:"(0070,0024)",vr:"CS",name:"GraphicFilled",vm:"1",version:"DICOM"},"(0070,0041)":{tag:"(0070,0041)",vr:"CS",name:"ImageHorizontalFlip",vm:"1",version:"DICOM"},"(0070,0042)":{tag:"(0070,0042)",vr:"US",name:"ImageRotation",vm:"1",version:"DICOM"},"(0070,0052)":{tag:"(0070,0052)",vr:"SL",name:"DisplayedAreaTopLeftHandCorner",vm:"2",version:"DICOM"},"(0070,0053)":{tag:"(0070,0053)",vr:"SL",name:"DisplayedAreaBottomRightHandCorner",vm:"2",version:"DICOM"},"(0070,005A)":{tag:"(0070,005A)",vr:"SQ",name:"DisplayedAreaSelectionSequence",vm:"1",version:"DICOM"},"(0070,0060)":{tag:"(0070,0060)",vr:"SQ",name:"GraphicLayerSequence",vm:"1",version:"DICOM"},"(0070,0062)":{tag:"(0070,0062)",vr:"IS",name:"GraphicLayerOrder",vm:"1",version:"DICOM"},"(0070,0066)":{tag:"(0070,0066)",vr:"US",name:"GraphicLayerRecommendedDisplayGrayscaleValue",vm:"1",version:"DICOM"},"(0070,0068)":{tag:"(0070,0068)",vr:"LO",name:"GraphicLayerDescription",vm:"1",version:"DICOM"},"(0070,0080)":{tag:"(0070,0080)",vr:"CS",name:"ContentLabel",vm:"1",version:"DICOM"},"(0070,0081)":{tag:"(0070,0081)",vr:"LO",name:"ContentDescription",vm:"1",version:"DICOM"},"(0070,0082)":{tag:"(0070,0082)",vr:"DA",name:"PresentationCreationDate",vm:"1",version:"DICOM"},"(0070,0083)":{tag:"(0070,0083)",vr:"TM",name:"PresentationCreationTime",vm:"1",version:"DICOM"},"(0070,0084)":{tag:"(0070,0084)",vr:"PN",name:"ContentCreatorName",vm:"1",version:"DICOM"},"(0070,0086)":{tag:"(0070,0086)",vr:"SQ",name:"ContentCreatorIdentificationCodeSequence",vm:"1",version:"DICOM"},"(0070,0087)":{tag:"(0070,0087)",vr:"SQ",name:"AlternateContentDescriptionSequence",vm:"1",version:"DICOM"},"(0070,0100)":{tag:"(0070,0100)",vr:"CS",name:"PresentationSizeMode",vm:"1",version:"DICOM"},"(0070,0101)":{tag:"(0070,0101)",vr:"DS",name:"PresentationPixelSpacing",vm:"2",version:"DICOM"},"(0070,0102)":{tag:"(0070,0102)",vr:"IS",name:"PresentationPixelAspectRatio",vm:"2",version:"DICOM"},"(0070,0103)":{tag:"(0070,0103)",vr:"FL",name:"PresentationPixelMagnificationRatio",vm:"1",version:"DICOM"},"(0070,0207)":{tag:"(0070,0207)",vr:"LO",name:"GraphicGroupLabel",vm:"1",version:"DICOM"},"(0070,0208)":{tag:"(0070,0208)",vr:"ST",name:"GraphicGroupDescription",vm:"1",version:"DICOM"},"(0070,0209)":{tag:"(0070,0209)",vr:"SQ",name:"CompoundGraphicSequence",vm:"1",version:"DICOM"},"(0070,0226)":{tag:"(0070,0226)",vr:"UL",name:"CompoundGraphicInstanceID",vm:"1",version:"DICOM"},"(0070,0227)":{tag:"(0070,0227)",vr:"LO",name:"FontName",vm:"1",version:"DICOM"},"(0070,0228)":{tag:"(0070,0228)",vr:"CS",name:"FontNameType",vm:"1",version:"DICOM"},"(0070,0229)":{tag:"(0070,0229)",vr:"LO",name:"CSSFontName",vm:"1",version:"DICOM"},"(0070,0230)":{tag:"(0070,0230)",vr:"FD",name:"RotationAngle",vm:"1",version:"DICOM"},"(0070,0231)":{tag:"(0070,0231)",vr:"SQ",name:"TextStyleSequence",vm:"1",version:"DICOM"},"(0070,0232)":{tag:"(0070,0232)",vr:"SQ",name:"LineStyleSequence",vm:"1",version:"DICOM"},"(0070,0233)":{tag:"(0070,0233)",vr:"SQ",name:"FillStyleSequence",vm:"1",version:"DICOM"},"(0070,0234)":{tag:"(0070,0234)",vr:"SQ",name:"GraphicGroupSequence",vm:"1",version:"DICOM"},"(0070,0241)":{tag:"(0070,0241)",vr:"US",name:"TextColorCIELabValue",vm:"3",version:"DICOM"},"(0070,0242)":{tag:"(0070,0242)",vr:"CS",name:"HorizontalAlignment",vm:"1",version:"DICOM"},"(0070,0243)":{tag:"(0070,0243)",vr:"CS",name:"VerticalAlignment",vm:"1",version:"DICOM"},"(0070,0244)":{tag:"(0070,0244)",vr:"CS",name:"ShadowStyle",vm:"1",version:"DICOM"},"(0070,0245)":{tag:"(0070,0245)",vr:"FL",name:"ShadowOffsetX",vm:"1",version:"DICOM"},"(0070,0246)":{tag:"(0070,0246)",vr:"FL",name:"ShadowOffsetY",vm:"1",version:"DICOM"},"(0070,0247)":{tag:"(0070,0247)",vr:"US",name:"ShadowColorCIELabValue",vm:"3",version:"DICOM"},"(0070,0248)":{tag:"(0070,0248)",vr:"CS",name:"Underlined",vm:"1",version:"DICOM"},"(0070,0249)":{tag:"(0070,0249)",vr:"CS",name:"Bold",vm:"1",version:"DICOM"},"(0070,0250)":{tag:"(0070,0250)",vr:"CS",name:"Italic",vm:"1",version:"DICOM"},"(0070,0251)":{tag:"(0070,0251)",vr:"US",name:"PatternOnColorCIELabValue",vm:"3",version:"DICOM"},"(0070,0252)":{tag:"(0070,0252)",vr:"US",name:"PatternOffColorCIELabValue",vm:"3",version:"DICOM"},"(0070,0253)":{tag:"(0070,0253)",vr:"FL",name:"LineThickness",vm:"1",version:"DICOM"},"(0070,0254)":{tag:"(0070,0254)",vr:"CS",name:"LineDashingStyle",vm:"1",version:"DICOM"},"(0070,0255)":{tag:"(0070,0255)",vr:"UL",name:"LinePattern",vm:"1",version:"DICOM"},"(0070,0256)":{tag:"(0070,0256)",vr:"OB",name:"FillPattern",vm:"1",version:"DICOM"},"(0070,0257)":{tag:"(0070,0257)",vr:"CS",name:"FillMode",vm:"1",version:"DICOM"},"(0070,0258)":{tag:"(0070,0258)",vr:"FL",name:"ShadowOpacity",vm:"1",version:"DICOM"},"(0070,0261)":{tag:"(0070,0261)",vr:"FL",name:"GapLength",vm:"1",version:"DICOM"},"(0070,0262)":{tag:"(0070,0262)",vr:"FL",name:"DiameterOfVisibility",vm:"1",version:"DICOM"},"(0070,0273)":{tag:"(0070,0273)",vr:"FL",name:"RotationPoint",vm:"2",version:"DICOM"},"(0070,0274)":{tag:"(0070,0274)",vr:"CS",name:"TickAlignment",vm:"1",version:"DICOM"},"(0070,0278)":{tag:"(0070,0278)",vr:"CS",name:"ShowTickLabel",vm:"1",version:"DICOM"},"(0070,0279)":{tag:"(0070,0279)",vr:"CS",name:"TickLabelAlignment",vm:"1",version:"DICOM"},"(0070,0282)":{tag:"(0070,0282)",vr:"CS",name:"CompoundGraphicUnits",vm:"1",version:"DICOM"},"(0070,0284)":{tag:"(0070,0284)",vr:"FL",name:"PatternOnOpacity",vm:"1",version:"DICOM"},"(0070,0285)":{tag:"(0070,0285)",vr:"FL",name:"PatternOffOpacity",vm:"1",version:"DICOM"},"(0070,0287)":{tag:"(0070,0287)",vr:"SQ",name:"MajorTicksSequence",vm:"1",version:"DICOM"},"(0070,0288)":{tag:"(0070,0288)",vr:"FL",name:"TickPosition",vm:"1",version:"DICOM"},"(0070,0289)":{tag:"(0070,0289)",vr:"SH",name:"TickLabel",vm:"1",version:"DICOM"},"(0070,0294)":{tag:"(0070,0294)",vr:"CS",name:"CompoundGraphicType",vm:"1",version:"DICOM"},"(0070,0295)":{tag:"(0070,0295)",vr:"UL",name:"GraphicGroupID",vm:"1",version:"DICOM"},"(0070,0306)":{tag:"(0070,0306)",vr:"CS",name:"ShapeType",vm:"1",version:"DICOM"},"(0070,0308)":{tag:"(0070,0308)",vr:"SQ",name:"RegistrationSequence",vm:"1",version:"DICOM"},"(0070,0309)":{tag:"(0070,0309)",vr:"SQ",name:"MatrixRegistrationSequence",vm:"1",version:"DICOM"},"(0070,030A)":{tag:"(0070,030A)",vr:"SQ",name:"MatrixSequence",vm:"1",version:"DICOM"},"(0070,030C)":{tag:"(0070,030C)",vr:"CS",name:"FrameOfReferenceTransformationMatrixType",vm:"1",version:"DICOM"},"(0070,030D)":{tag:"(0070,030D)",vr:"SQ",name:"RegistrationTypeCodeSequence",vm:"1",version:"DICOM"},"(0070,030F)":{tag:"(0070,030F)",vr:"ST",name:"FiducialDescription",vm:"1",version:"DICOM"},"(0070,0310)":{tag:"(0070,0310)",vr:"SH",name:"FiducialIdentifier",vm:"1",version:"DICOM"},"(0070,0311)":{tag:"(0070,0311)",vr:"SQ",name:"FiducialIdentifierCodeSequence",vm:"1",version:"DICOM"},"(0070,0312)":{tag:"(0070,0312)",vr:"FD",name:"ContourUncertaintyRadius",vm:"1",version:"DICOM"},"(0070,0314)":{tag:"(0070,0314)",vr:"SQ",name:"UsedFiducialsSequence",vm:"1",version:"DICOM"},"(0070,0318)":{tag:"(0070,0318)",vr:"SQ",name:"GraphicCoordinatesDataSequence",vm:"1",version:"DICOM"},"(0070,031A)":{tag:"(0070,031A)",vr:"UI",name:"FiducialUID",vm:"1",version:"DICOM"},"(0070,031C)":{tag:"(0070,031C)",vr:"SQ",name:"FiducialSetSequence",vm:"1",version:"DICOM"},"(0070,031E)":{tag:"(0070,031E)",vr:"SQ",name:"FiducialSequence",vm:"1",version:"DICOM"},"(0070,0401)":{tag:"(0070,0401)",vr:"US",name:"GraphicLayerRecommendedDisplayCIELabValue",vm:"3",version:"DICOM"},"(0070,0402)":{tag:"(0070,0402)",vr:"SQ",name:"BlendingSequence",vm:"1",version:"DICOM"},"(0070,0403)":{tag:"(0070,0403)",vr:"FL",name:"RelativeOpacity",vm:"1",version:"DICOM"},"(0070,0404)":{tag:"(0070,0404)",vr:"SQ",name:"ReferencedSpatialRegistrationSequence",vm:"1",version:"DICOM"},"(0070,0405)":{tag:"(0070,0405)",vr:"CS",name:"BlendingPosition",vm:"1",version:"DICOM"},"(0072,0002)":{tag:"(0072,0002)",vr:"SH",name:"HangingProtocolName",vm:"1",version:"DICOM"},"(0072,0004)":{tag:"(0072,0004)",vr:"LO",name:"HangingProtocolDescription",vm:"1",version:"DICOM"},"(0072,0006)":{tag:"(0072,0006)",vr:"CS",name:"HangingProtocolLevel",vm:"1",version:"DICOM"},"(0072,0008)":{tag:"(0072,0008)",vr:"LO",name:"HangingProtocolCreator",vm:"1",version:"DICOM"},"(0072,000A)":{tag:"(0072,000A)",vr:"DT",name:"HangingProtocolCreationDateTime",vm:"1",version:"DICOM"},"(0072,000C)":{tag:"(0072,000C)",vr:"SQ",name:"HangingProtocolDefinitionSequence",vm:"1",version:"DICOM"},"(0072,000E)":{tag:"(0072,000E)",vr:"SQ",name:"HangingProtocolUserIdentificationCodeSequence",vm:"1",version:"DICOM"},"(0072,0010)":{tag:"(0072,0010)",vr:"LO",name:"HangingProtocolUserGroupName",vm:"1",version:"DICOM"},"(0072,0012)":{tag:"(0072,0012)",vr:"SQ",name:"SourceHangingProtocolSequence",vm:"1",version:"DICOM"},"(0072,0014)":{tag:"(0072,0014)",vr:"US",name:"NumberOfPriorsReferenced",vm:"1",version:"DICOM"},"(0072,0020)":{tag:"(0072,0020)",vr:"SQ",name:"ImageSetsSequence",vm:"1",version:"DICOM"},"(0072,0022)":{tag:"(0072,0022)",vr:"SQ",name:"ImageSetSelectorSequence",vm:"1",version:"DICOM"},"(0072,0024)":{tag:"(0072,0024)",vr:"CS",name:"ImageSetSelectorUsageFlag",vm:"1",version:"DICOM"},"(0072,0026)":{tag:"(0072,0026)",vr:"AT",name:"SelectorAttribute",vm:"1",version:"DICOM"},"(0072,0028)":{tag:"(0072,0028)",vr:"US",name:"SelectorValueNumber",vm:"1",version:"DICOM"},"(0072,0030)":{tag:"(0072,0030)",vr:"SQ",name:"TimeBasedImageSetsSequence",vm:"1",version:"DICOM"},"(0072,0032)":{tag:"(0072,0032)",vr:"US",name:"ImageSetNumber",vm:"1",version:"DICOM"},"(0072,0034)":{tag:"(0072,0034)",vr:"CS",name:"ImageSetSelectorCategory",vm:"1",version:"DICOM"},"(0072,0038)":{tag:"(0072,0038)",vr:"US",name:"RelativeTime",vm:"2",version:"DICOM"},"(0072,003A)":{tag:"(0072,003A)",vr:"CS",name:"RelativeTimeUnits",vm:"1",version:"DICOM"},"(0072,003C)":{tag:"(0072,003C)",vr:"SS",name:"AbstractPriorValue",vm:"2",version:"DICOM"},"(0072,003E)":{tag:"(0072,003E)",vr:"SQ",name:"AbstractPriorCodeSequence",vm:"1",version:"DICOM"},"(0072,0040)":{tag:"(0072,0040)",vr:"LO",name:"ImageSetLabel",vm:"1",version:"DICOM"},"(0072,0050)":{tag:"(0072,0050)",vr:"CS",name:"SelectorAttributeVR",vm:"1",version:"DICOM"},"(0072,0052)":{tag:"(0072,0052)",vr:"AT",name:"SelectorSequencePointer",vm:"1-n",version:"DICOM"},"(0072,0054)":{tag:"(0072,0054)",vr:"LO",name:"SelectorSequencePointerPrivateCreator",vm:"1-n",version:"DICOM"},"(0072,0056)":{tag:"(0072,0056)",vr:"LO",name:"SelectorAttributePrivateCreator",vm:"1",version:"DICOM"},"(0072,0060)":{tag:"(0072,0060)",vr:"AT",name:"SelectorATValue",vm:"1-n",version:"DICOM"},"(0072,0062)":{tag:"(0072,0062)",vr:"CS",name:"SelectorCSValue",vm:"1-n",version:"DICOM"},"(0072,0064)":{tag:"(0072,0064)",vr:"IS",name:"SelectorISValue",vm:"1-n",version:"DICOM"},"(0072,0066)":{tag:"(0072,0066)",vr:"LO",name:"SelectorLOValue",vm:"1-n",version:"DICOM"},"(0072,0068)":{tag:"(0072,0068)",vr:"LT",name:"SelectorLTValue",vm:"1",version:"DICOM"},"(0072,006A)":{tag:"(0072,006A)",vr:"PN",name:"SelectorPNValue",vm:"1-n",version:"DICOM"},"(0072,006C)":{tag:"(0072,006C)",vr:"SH",name:"SelectorSHValue",vm:"1-n",version:"DICOM"},"(0072,006E)":{tag:"(0072,006E)",vr:"ST",name:"SelectorSTValue",vm:"1",version:"DICOM"},"(0072,0070)":{tag:"(0072,0070)",vr:"UT",name:"SelectorUTValue",vm:"1",version:"DICOM"},"(0072,0072)":{tag:"(0072,0072)",vr:"DS",name:"SelectorDSValue",vm:"1-n",version:"DICOM"},"(0072,0074)":{tag:"(0072,0074)",vr:"FD",name:"SelectorFDValue",vm:"1-n",version:"DICOM"},"(0072,0076)":{tag:"(0072,0076)",vr:"FL",name:"SelectorFLValue",vm:"1-n",version:"DICOM"},"(0072,0078)":{tag:"(0072,0078)",vr:"UL",name:"SelectorULValue",vm:"1-n",version:"DICOM"},"(0072,007A)":{tag:"(0072,007A)",vr:"US",name:"SelectorUSValue",vm:"1-n",version:"DICOM"},"(0072,007C)":{tag:"(0072,007C)",vr:"SL",name:"SelectorSLValue",vm:"1-n",version:"DICOM"},"(0072,007E)":{tag:"(0072,007E)",vr:"SS",name:"SelectorSSValue",vm:"1-n",version:"DICOM"},"(0072,007F)":{tag:"(0072,007F)",vr:"UI",name:"SelectorUIValue",vm:"1-n",version:"DICOM"},"(0072,0080)":{tag:"(0072,0080)",vr:"SQ",name:"SelectorCodeSequenceValue",vm:"1",version:"DICOM"},"(0072,0100)":{tag:"(0072,0100)",vr:"US",name:"NumberOfScreens",vm:"1",version:"DICOM"},"(0072,0102)":{tag:"(0072,0102)",vr:"SQ",name:"NominalScreenDefinitionSequence",vm:"1",version:"DICOM"},"(0072,0104)":{tag:"(0072,0104)",vr:"US",name:"NumberOfVerticalPixels",vm:"1",version:"DICOM"},"(0072,0106)":{tag:"(0072,0106)",vr:"US",name:"NumberOfHorizontalPixels",vm:"1",version:"DICOM"},"(0072,0108)":{tag:"(0072,0108)",vr:"FD",name:"DisplayEnvironmentSpatialPosition",vm:"4",version:"DICOM"},"(0072,010A)":{tag:"(0072,010A)",vr:"US",name:"ScreenMinimumGrayscaleBitDepth",vm:"1",version:"DICOM"},"(0072,010C)":{tag:"(0072,010C)",vr:"US",name:"ScreenMinimumColorBitDepth",vm:"1",version:"DICOM"},"(0072,010E)":{tag:"(0072,010E)",vr:"US",name:"ApplicationMaximumRepaintTime",vm:"1",version:"DICOM"},"(0072,0200)":{tag:"(0072,0200)",vr:"SQ",name:"DisplaySetsSequence",vm:"1",version:"DICOM"},"(0072,0202)":{tag:"(0072,0202)",vr:"US",name:"DisplaySetNumber",vm:"1",version:"DICOM"},"(0072,0203)":{tag:"(0072,0203)",vr:"LO",name:"DisplaySetLabel",vm:"1",version:"DICOM"},"(0072,0204)":{tag:"(0072,0204)",vr:"US",name:"DisplaySetPresentationGroup",vm:"1",version:"DICOM"},"(0072,0206)":{tag:"(0072,0206)",vr:"LO",name:"DisplaySetPresentationGroupDescription",vm:"1",version:"DICOM"},"(0072,0208)":{tag:"(0072,0208)",vr:"CS",name:"PartialDataDisplayHandling",vm:"1",version:"DICOM"},"(0072,0210)":{tag:"(0072,0210)",vr:"SQ",name:"SynchronizedScrollingSequence",vm:"1",version:"DICOM"},"(0072,0212)":{tag:"(0072,0212)",vr:"US",name:"DisplaySetScrollingGroup",vm:"2-n",version:"DICOM"},"(0072,0214)":{tag:"(0072,0214)",vr:"SQ",name:"NavigationIndicatorSequence",vm:"1",version:"DICOM"},"(0072,0216)":{tag:"(0072,0216)",vr:"US",name:"NavigationDisplaySet",vm:"1",version:"DICOM"},"(0072,0218)":{tag:"(0072,0218)",vr:"US",name:"ReferenceDisplaySets",vm:"1-n",version:"DICOM"},"(0072,0300)":{tag:"(0072,0300)",vr:"SQ",name:"ImageBoxesSequence",vm:"1",version:"DICOM"},"(0072,0302)":{tag:"(0072,0302)",vr:"US",name:"ImageBoxNumber",vm:"1",version:"DICOM"},"(0072,0304)":{tag:"(0072,0304)",vr:"CS",name:"ImageBoxLayoutType",vm:"1",version:"DICOM"},"(0072,0306)":{tag:"(0072,0306)",vr:"US",name:"ImageBoxTileHorizontalDimension",vm:"1",version:"DICOM"},"(0072,0308)":{tag:"(0072,0308)",vr:"US",name:"ImageBoxTileVerticalDimension",vm:"1",version:"DICOM"},"(0072,0310)":{tag:"(0072,0310)",vr:"CS",name:"ImageBoxScrollDirection",vm:"1",version:"DICOM"},"(0072,0312)":{tag:"(0072,0312)",vr:"CS",name:"ImageBoxSmallScrollType",vm:"1",version:"DICOM"},"(0072,0314)":{tag:"(0072,0314)",vr:"US",name:"ImageBoxSmallScrollAmount",vm:"1",version:"DICOM"},"(0072,0316)":{tag:"(0072,0316)",vr:"CS",name:"ImageBoxLargeScrollType",vm:"1",version:"DICOM"},"(0072,0318)":{tag:"(0072,0318)",vr:"US",name:"ImageBoxLargeScrollAmount",vm:"1",version:"DICOM"},"(0072,0320)":{tag:"(0072,0320)",vr:"US",name:"ImageBoxOverlapPriority",vm:"1",version:"DICOM"},"(0072,0330)":{tag:"(0072,0330)",vr:"FD",name:"CineRelativeToRealTime",vm:"1",version:"DICOM"},"(0072,0400)":{tag:"(0072,0400)",vr:"SQ",name:"FilterOperationsSequence",vm:"1",version:"DICOM"},"(0072,0402)":{tag:"(0072,0402)",vr:"CS",name:"FilterByCategory",vm:"1",version:"DICOM"},"(0072,0404)":{tag:"(0072,0404)",vr:"CS",name:"FilterByAttributePresence",vm:"1",version:"DICOM"},"(0072,0406)":{tag:"(0072,0406)",vr:"CS",name:"FilterByOperator",vm:"1",version:"DICOM"},"(0072,0420)":{tag:"(0072,0420)",vr:"US",name:"StructuredDisplayBackgroundCIELabValue",vm:"3",version:"DICOM"},"(0072,0421)":{tag:"(0072,0421)",vr:"US",name:"EmptyImageBoxCIELabValue",vm:"3",version:"DICOM"},"(0072,0422)":{tag:"(0072,0422)",vr:"SQ",name:"StructuredDisplayImageBoxSequence",vm:"1",version:"DICOM"},"(0072,0424)":{tag:"(0072,0424)",vr:"SQ",name:"StructuredDisplayTextBoxSequence",vm:"1",version:"DICOM"},"(0072,0427)":{tag:"(0072,0427)",vr:"SQ",name:"ReferencedFirstFrameSequence",vm:"1",version:"DICOM"},"(0072,0430)":{tag:"(0072,0430)",vr:"SQ",name:"ImageBoxSynchronizationSequence",vm:"1",version:"DICOM"},"(0072,0432)":{tag:"(0072,0432)",vr:"US",name:"SynchronizedImageBoxList",vm:"2-n",version:"DICOM"},"(0072,0434)":{tag:"(0072,0434)",vr:"CS",name:"TypeOfSynchronization",vm:"1",version:"DICOM"},"(0072,0500)":{tag:"(0072,0500)",vr:"CS",name:"BlendingOperationType",vm:"1",version:"DICOM"},"(0072,0510)":{tag:"(0072,0510)",vr:"CS",name:"ReformattingOperationType",vm:"1",version:"DICOM"},"(0072,0512)":{tag:"(0072,0512)",vr:"FD",name:"ReformattingThickness",vm:"1",version:"DICOM"},"(0072,0514)":{tag:"(0072,0514)",vr:"FD",name:"ReformattingInterval",vm:"1",version:"DICOM"},"(0072,0516)":{tag:"(0072,0516)",vr:"CS",name:"ReformattingOperationInitialViewDirection",vm:"1",version:"DICOM"},"(0072,0520)":{tag:"(0072,0520)",vr:"CS",name:"ThreeDRenderingType",vm:"1-n",version:"DICOM"},"(0072,0600)":{tag:"(0072,0600)",vr:"SQ",name:"SortingOperationsSequence",vm:"1",version:"DICOM"},"(0072,0602)":{tag:"(0072,0602)",vr:"CS",name:"SortByCategory",vm:"1",version:"DICOM"},"(0072,0604)":{tag:"(0072,0604)",vr:"CS",name:"SortingDirection",vm:"1",version:"DICOM"},"(0072,0700)":{tag:"(0072,0700)",vr:"CS",name:"DisplaySetPatientOrientation",vm:"2",version:"DICOM"},"(0072,0702)":{tag:"(0072,0702)",vr:"CS",name:"VOIType",vm:"1",version:"DICOM"},"(0072,0704)":{tag:"(0072,0704)",vr:"CS",name:"PseudoColorType",vm:"1",version:"DICOM"},"(0072,0705)":{tag:"(0072,0705)",vr:"SQ",name:"PseudoColorPaletteInstanceReferenceSequence",vm:"1",version:"DICOM"},"(0072,0706)":{tag:"(0072,0706)",vr:"CS",name:"ShowGrayscaleInverted",vm:"1",version:"DICOM"},"(0072,0710)":{tag:"(0072,0710)",vr:"CS",name:"ShowImageTrueSizeFlag",vm:"1",version:"DICOM"},"(0072,0712)":{tag:"(0072,0712)",vr:"CS",name:"ShowGraphicAnnotationFlag",vm:"1",version:"DICOM"},"(0072,0714)":{tag:"(0072,0714)",vr:"CS",name:"ShowPatientDemographicsFlag",vm:"1",version:"DICOM"},"(0072,0716)":{tag:"(0072,0716)",vr:"CS",name:"ShowAcquisitionTechniquesFlag",vm:"1",version:"DICOM"},"(0072,0717)":{tag:"(0072,0717)",vr:"CS",name:"DisplaySetHorizontalJustification",vm:"1",version:"DICOM"},"(0072,0718)":{tag:"(0072,0718)",vr:"CS",name:"DisplaySetVerticalJustification",vm:"1",version:"DICOM"},"(0074,0120)":{tag:"(0074,0120)",vr:"FD",name:"ContinuationStartMeterset",vm:"1",version:"DICOM"},"(0074,0121)":{tag:"(0074,0121)",vr:"FD",name:"ContinuationEndMeterset",vm:"1",version:"DICOM"},"(0074,1000)":{tag:"(0074,1000)",vr:"CS",name:"ProcedureStepState",vm:"1",version:"DICOM"},"(0074,1002)":{tag:"(0074,1002)",vr:"SQ",name:"ProcedureStepProgressInformationSequence",vm:"1",version:"DICOM"},"(0074,1004)":{tag:"(0074,1004)",vr:"DS",name:"ProcedureStepProgress",vm:"1",version:"DICOM"},"(0074,1006)":{tag:"(0074,1006)",vr:"ST",name:"ProcedureStepProgressDescription",vm:"1",version:"DICOM"},"(0074,1008)":{tag:"(0074,1008)",vr:"SQ",name:"ProcedureStepCommunicationsURISequence",vm:"1",version:"DICOM"},"(0074,100A)":{tag:"(0074,100A)",vr:"UR",name:"ContactURI",vm:"1",version:"DICOM"},"(0074,100C)":{tag:"(0074,100C)",vr:"LO",name:"ContactDisplayName",vm:"1",version:"DICOM"},"(0074,100E)":{tag:"(0074,100E)",vr:"SQ",name:"ProcedureStepDiscontinuationReasonCodeSequence",vm:"1",version:"DICOM"},"(0074,1020)":{tag:"(0074,1020)",vr:"SQ",name:"BeamTaskSequence",vm:"1",version:"DICOM"},"(0074,1022)":{tag:"(0074,1022)",vr:"CS",name:"BeamTaskType",vm:"1",version:"DICOM"},"(0074,1025)":{tag:"(0074,1025)",vr:"CS",name:"AutosequenceFlag",vm:"1",version:"DICOM"},"(0074,1026)":{tag:"(0074,1026)",vr:"FD",name:"TableTopVerticalAdjustedPosition",vm:"1",version:"DICOM"},"(0074,1027)":{tag:"(0074,1027)",vr:"FD",name:"TableTopLongitudinalAdjustedPosition",vm:"1",version:"DICOM"},"(0074,1028)":{tag:"(0074,1028)",vr:"FD",name:"TableTopLateralAdjustedPosition",vm:"1",version:"DICOM"},"(0074,102A)":{tag:"(0074,102A)",vr:"FD",name:"PatientSupportAdjustedAngle",vm:"1",version:"DICOM"},"(0074,102B)":{tag:"(0074,102B)",vr:"FD",name:"TableTopEccentricAdjustedAngle",vm:"1",version:"DICOM"},"(0074,102C)":{tag:"(0074,102C)",vr:"FD",name:"TableTopPitchAdjustedAngle",vm:"1",version:"DICOM"},"(0074,102D)":{tag:"(0074,102D)",vr:"FD",name:"TableTopRollAdjustedAngle",vm:"1",version:"DICOM"},"(0074,1030)":{tag:"(0074,1030)",vr:"SQ",name:"DeliveryVerificationImageSequence",vm:"1",version:"DICOM"},"(0074,1032)":{tag:"(0074,1032)",vr:"CS",name:"VerificationImageTiming",vm:"1",version:"DICOM"},"(0074,1034)":{tag:"(0074,1034)",vr:"CS",name:"DoubleExposureFlag",vm:"1",version:"DICOM"},"(0074,1036)":{tag:"(0074,1036)",vr:"CS",name:"DoubleExposureOrdering",vm:"1",version:"DICOM"},"(0074,1040)":{tag:"(0074,1040)",vr:"SQ",name:"RelatedReferenceRTImageSequence",vm:"1",version:"DICOM"},"(0074,1042)":{tag:"(0074,1042)",vr:"SQ",name:"GeneralMachineVerificationSequence",vm:"1",version:"DICOM"},"(0074,1044)":{tag:"(0074,1044)",vr:"SQ",name:"ConventionalMachineVerificationSequence",vm:"1",version:"DICOM"},"(0074,1046)":{tag:"(0074,1046)",vr:"SQ",name:"IonMachineVerificationSequence",vm:"1",version:"DICOM"},"(0074,1048)":{tag:"(0074,1048)",vr:"SQ",name:"FailedAttributesSequence",vm:"1",version:"DICOM"},"(0074,104A)":{tag:"(0074,104A)",vr:"SQ",name:"OverriddenAttributesSequence",vm:"1",version:"DICOM"},"(0074,104C)":{tag:"(0074,104C)",vr:"SQ",name:"ConventionalControlPointVerificationSequence",vm:"1",version:"DICOM"},"(0074,104E)":{tag:"(0074,104E)",vr:"SQ",name:"IonControlPointVerificationSequence",vm:"1",version:"DICOM"},"(0074,1050)":{tag:"(0074,1050)",vr:"SQ",name:"AttributeOccurrenceSequence",vm:"1",version:"DICOM"},"(0074,1052)":{tag:"(0074,1052)",vr:"AT",name:"AttributeOccurrencePointer",vm:"1",version:"DICOM"},"(0074,1054)":{tag:"(0074,1054)",vr:"UL",name:"AttributeItemSelector",vm:"1",version:"DICOM"},"(0074,1056)":{tag:"(0074,1056)",vr:"LO",name:"AttributeOccurrencePrivateCreator",vm:"1",version:"DICOM"},"(0074,1057)":{tag:"(0074,1057)",vr:"IS",name:"SelectorSequencePointerItems",vm:"1-n",version:"DICOM"},"(0074,1200)":{tag:"(0074,1200)",vr:"CS",name:"ScheduledProcedureStepPriority",vm:"1",version:"DICOM"},"(0074,1202)":{tag:"(0074,1202)",vr:"LO",name:"WorklistLabel",vm:"1",version:"DICOM"},"(0074,1204)":{tag:"(0074,1204)",vr:"LO",name:"ProcedureStepLabel",vm:"1",version:"DICOM"},"(0074,1210)":{tag:"(0074,1210)",vr:"SQ",name:"ScheduledProcessingParametersSequence",vm:"1",version:"DICOM"},"(0074,1212)":{tag:"(0074,1212)",vr:"SQ",name:"PerformedProcessingParametersSequence",vm:"1",version:"DICOM"},"(0074,1216)":{tag:"(0074,1216)",vr:"SQ",name:"UnifiedProcedureStepPerformedProcedureSequence",vm:"1",version:"DICOM"},"(0074,1224)":{tag:"(0074,1224)",vr:"SQ",name:"ReplacedProcedureStepSequence",vm:"1",version:"DICOM"},"(0074,1230)":{tag:"(0074,1230)",vr:"LO",name:"DeletionLock",vm:"1",version:"DICOM"},"(0074,1234)":{tag:"(0074,1234)",vr:"AE",name:"ReceivingAE",vm:"1",version:"DICOM"},"(0074,1236)":{tag:"(0074,1236)",vr:"AE",name:"RequestingAE",vm:"1",version:"DICOM"},"(0074,1238)":{tag:"(0074,1238)",vr:"LT",name:"ReasonForCancellation",vm:"1",version:"DICOM"},"(0074,1242)":{tag:"(0074,1242)",vr:"CS",name:"SCPStatus",vm:"1",version:"DICOM"},"(0074,1244)":{tag:"(0074,1244)",vr:"CS",name:"SubscriptionListStatus",vm:"1",version:"DICOM"},"(0074,1246)":{tag:"(0074,1246)",vr:"CS",name:"UnifiedProcedureStepListStatus",vm:"1",version:"DICOM"},"(0074,1324)":{tag:"(0074,1324)",vr:"UL",name:"BeamOrderIndex",vm:"1",version:"DICOM"},"(0074,1338)":{tag:"(0074,1338)",vr:"FD",name:"DoubleExposureMeterset",vm:"1",version:"DICOM"},"(0074,133A)":{tag:"(0074,133A)",vr:"FD",name:"DoubleExposureFieldDelta",vm:"4",version:"DICOM"},"(0076,0001)":{tag:"(0076,0001)",vr:"LO",name:"ImplantAssemblyTemplateName",vm:"1",version:"DICOM"},"(0076,0003)":{tag:"(0076,0003)",vr:"LO",name:"ImplantAssemblyTemplateIssuer",vm:"1",version:"DICOM"},"(0076,0006)":{tag:"(0076,0006)",vr:"LO",name:"ImplantAssemblyTemplateVersion",vm:"1",version:"DICOM"},"(0076,0008)":{tag:"(0076,0008)",vr:"SQ",name:"ReplacedImplantAssemblyTemplateSequence",vm:"1",version:"DICOM"},"(0076,000A)":{tag:"(0076,000A)",vr:"CS",name:"ImplantAssemblyTemplateType",vm:"1",version:"DICOM"},"(0076,000C)":{tag:"(0076,000C)",vr:"SQ",name:"OriginalImplantAssemblyTemplateSequence",vm:"1",version:"DICOM"},"(0076,000E)":{tag:"(0076,000E)",vr:"SQ",name:"DerivationImplantAssemblyTemplateSequence",vm:"1",version:"DICOM"},"(0076,0010)":{tag:"(0076,0010)",vr:"SQ",name:"ImplantAssemblyTemplateTargetAnatomySequence",vm:"1",version:"DICOM"},"(0076,0020)":{tag:"(0076,0020)",vr:"SQ",name:"ProcedureTypeCodeSequence",vm:"1",version:"DICOM"},"(0076,0030)":{tag:"(0076,0030)",vr:"LO",name:"SurgicalTechnique",vm:"1",version:"DICOM"},"(0076,0032)":{tag:"(0076,0032)",vr:"SQ",name:"ComponentTypesSequence",vm:"1",version:"DICOM"},"(0076,0034)":{tag:"(0076,0034)",vr:"CS",name:"ComponentTypeCodeSequence",vm:"1",version:"DICOM"},"(0076,0036)":{tag:"(0076,0036)",vr:"CS",name:"ExclusiveComponentType",vm:"1",version:"DICOM"},"(0076,0038)":{tag:"(0076,0038)",vr:"CS",name:"MandatoryComponentType",vm:"1",version:"DICOM"},"(0076,0040)":{tag:"(0076,0040)",vr:"SQ",name:"ComponentSequence",vm:"1",version:"DICOM"},"(0076,0055)":{tag:"(0076,0055)",vr:"US",name:"ComponentID",vm:"1",version:"DICOM"},"(0076,0060)":{tag:"(0076,0060)",vr:"SQ",name:"ComponentAssemblySequence",vm:"1",version:"DICOM"},"(0076,0070)":{tag:"(0076,0070)",vr:"US",name:"Component1ReferencedID",vm:"1",version:"DICOM"},"(0076,0080)":{tag:"(0076,0080)",vr:"US",name:"Component1ReferencedMatingFeatureSetID",vm:"1",version:"DICOM"},"(0076,0090)":{tag:"(0076,0090)",vr:"US",name:"Component1ReferencedMatingFeatureID",vm:"1",version:"DICOM"},"(0076,00A0)":{tag:"(0076,00A0)",vr:"US",name:"Component2ReferencedID",vm:"1",version:"DICOM"},"(0076,00B0)":{tag:"(0076,00B0)",vr:"US",name:"Component2ReferencedMatingFeatureSetID",vm:"1",version:"DICOM"},"(0076,00C0)":{tag:"(0076,00C0)",vr:"US",name:"Component2ReferencedMatingFeatureID",vm:"1",version:"DICOM"},"(0078,0001)":{tag:"(0078,0001)",vr:"LO",name:"ImplantTemplateGroupName",vm:"1",version:"DICOM"},"(0078,0010)":{tag:"(0078,0010)",vr:"ST",name:"ImplantTemplateGroupDescription",vm:"1",version:"DICOM"},"(0078,0020)":{tag:"(0078,0020)",vr:"LO",name:"ImplantTemplateGroupIssuer",vm:"1",version:"DICOM"},"(0078,0024)":{tag:"(0078,0024)",vr:"LO",name:"ImplantTemplateGroupVersion",vm:"1",version:"DICOM"},"(0078,0026)":{tag:"(0078,0026)",vr:"SQ",name:"ReplacedImplantTemplateGroupSequence",vm:"1",version:"DICOM"},"(0078,0028)":{tag:"(0078,0028)",vr:"SQ",name:"ImplantTemplateGroupTargetAnatomySequence",vm:"1",version:"DICOM"},"(0078,002A)":{tag:"(0078,002A)",vr:"SQ",name:"ImplantTemplateGroupMembersSequence",vm:"1",version:"DICOM"},"(0078,002E)":{tag:"(0078,002E)",vr:"US",name:"ImplantTemplateGroupMemberID",vm:"1",version:"DICOM"},"(0078,0050)":{tag:"(0078,0050)",vr:"FD",name:"ThreeDImplantTemplateGroupMemberMatchingPoint",vm:"3",version:"DICOM"},"(0078,0060)":{tag:"(0078,0060)",vr:"FD",name:"ThreeDImplantTemplateGroupMemberMatchingAxes",vm:"9",version:"DICOM"},"(0078,0070)":{tag:"(0078,0070)",vr:"SQ",name:"ImplantTemplateGroupMemberMatching2DCoordinatesSequence",vm:"1",version:"DICOM"},"(0078,0090)":{tag:"(0078,0090)",vr:"FD",name:"TwoDImplantTemplateGroupMemberMatchingPoint",vm:"2",version:"DICOM"},"(0078,00A0)":{tag:"(0078,00A0)",vr:"FD",name:"TwoDImplantTemplateGroupMemberMatchingAxes",vm:"4",version:"DICOM"},"(0078,00B0)":{tag:"(0078,00B0)",vr:"SQ",name:"ImplantTemplateGroupVariationDimensionSequence",vm:"1",version:"DICOM"},"(0078,00B2)":{tag:"(0078,00B2)",vr:"LO",name:"ImplantTemplateGroupVariationDimensionName",vm:"1",version:"DICOM"},"(0078,00B4)":{tag:"(0078,00B4)",vr:"SQ",name:"ImplantTemplateGroupVariationDimensionRankSequence",vm:"1",version:"DICOM"},"(0078,00B6)":{tag:"(0078,00B6)",vr:"US",name:"ReferencedImplantTemplateGroupMemberID",vm:"1",version:"DICOM"},"(0078,00B8)":{tag:"(0078,00B8)",vr:"US",name:"ImplantTemplateGroupVariationDimensionRank",vm:"1",version:"DICOM"},"(0080,0001)":{tag:"(0080,0001)",vr:"SQ",name:"SurfaceScanAcquisitionTypeCodeSequence",vm:"1",version:"DICOM"},"(0080,0002)":{tag:"(0080,0002)",vr:"SQ",name:"SurfaceScanModeCodeSequence",vm:"1",version:"DICOM"},"(0080,0003)":{tag:"(0080,0003)",vr:"SQ",name:"RegistrationMethodCodeSequence",vm:"1",version:"DICOM"},"(0080,0004)":{tag:"(0080,0004)",vr:"FD",name:"ShotDurationTime",vm:"1",version:"DICOM"},"(0080,0005)":{tag:"(0080,0005)",vr:"FD",name:"ShotOffsetTime",vm:"1",version:"DICOM"},"(0080,0006)":{tag:"(0080,0006)",vr:"US",name:"SurfacePointPresentationValueData",vm:"1-n",version:"DICOM"},"(0080,0007)":{tag:"(0080,0007)",vr:"US",name:"SurfacePointColorCIELabValueData",vm:"3-3n",version:"DICOM"},"(0080,0008)":{tag:"(0080,0008)",vr:"SQ",name:"UVMappingSequence",vm:"1",version:"DICOM"},"(0080,0009)":{tag:"(0080,0009)",vr:"SH",name:"TextureLabel",vm:"1",version:"DICOM"},"(0080,0010)":{tag:"(0080,0010)",vr:"OF",name:"UValueData",vm:"1-n",version:"DICOM"},"(0080,0011)":{tag:"(0080,0011)",vr:"OF",name:"VValueData",vm:"1-n",version:"DICOM"},"(0080,0012)":{tag:"(0080,0012)",vr:"SQ",name:"ReferencedTextureSequence",vm:"1",version:"DICOM"},"(0080,0013)":{tag:"(0080,0013)",vr:"SQ",name:"ReferencedSurfaceDataSequence",vm:"1",version:"DICOM"},"(0088,0130)":{tag:"(0088,0130)",vr:"SH",name:"StorageMediaFileSetID",vm:"1",version:"DICOM"},"(0088,0140)":{tag:"(0088,0140)",vr:"UI",name:"StorageMediaFileSetUID",vm:"1",version:"DICOM"},"(0088,0200)":{tag:"(0088,0200)",vr:"SQ",name:"IconImageSequence",vm:"1",version:"DICOM"},"(0100,0410)":{tag:"(0100,0410)",vr:"CS",name:"SOPInstanceStatus",vm:"1",version:"DICOM"},"(0100,0420)":{tag:"(0100,0420)",vr:"DT",name:"SOPAuthorizationDateTime",vm:"1",version:"DICOM"},"(0100,0424)":{tag:"(0100,0424)",vr:"LT",name:"SOPAuthorizationComment",vm:"1",version:"DICOM"},"(0100,0426)":{tag:"(0100,0426)",vr:"LO",name:"AuthorizationEquipmentCertificationNumber",vm:"1",version:"DICOM"},"(0400,0005)":{tag:"(0400,0005)",vr:"US",name:"MACIDNumber",vm:"1",version:"DICOM"},"(0400,0010)":{tag:"(0400,0010)",vr:"UI",name:"MACCalculationTransferSyntaxUID",vm:"1",version:"DICOM"},"(0400,0015)":{tag:"(0400,0015)",vr:"CS",name:"MACAlgorithm",vm:"1",version:"DICOM"},"(0400,0020)":{tag:"(0400,0020)",vr:"AT",name:"DataElementsSigned",vm:"1-n",version:"DICOM"},"(0400,0100)":{tag:"(0400,0100)",vr:"UI",name:"DigitalSignatureUID",vm:"1",version:"DICOM"},"(0400,0105)":{tag:"(0400,0105)",vr:"DT",name:"DigitalSignatureDateTime",vm:"1",version:"DICOM"},"(0400,0110)":{tag:"(0400,0110)",vr:"CS",name:"CertificateType",vm:"1",version:"DICOM"},"(0400,0115)":{tag:"(0400,0115)",vr:"OB",name:"CertificateOfSigner",vm:"1",version:"DICOM"},"(0400,0120)":{tag:"(0400,0120)",vr:"OB",name:"Signature",vm:"1",version:"DICOM"},"(0400,0305)":{tag:"(0400,0305)",vr:"CS",name:"CertifiedTimestampType",vm:"1",version:"DICOM"},"(0400,0310)":{tag:"(0400,0310)",vr:"OB",name:"CertifiedTimestamp",vm:"1",version:"DICOM"},"(0400,0401)":{tag:"(0400,0401)",vr:"SQ",name:"DigitalSignaturePurposeCodeSequence",vm:"1",version:"DICOM"},"(0400,0402)":{tag:"(0400,0402)",vr:"SQ",name:"ReferencedDigitalSignatureSequence",vm:"1",version:"DICOM"},"(0400,0403)":{tag:"(0400,0403)",vr:"SQ",name:"ReferencedSOPInstanceMACSequence",vm:"1",version:"DICOM"},"(0400,0404)":{tag:"(0400,0404)",vr:"OB",name:"MAC",vm:"1",version:"DICOM"},"(0400,0500)":{tag:"(0400,0500)",vr:"SQ",name:"EncryptedAttributesSequence",vm:"1",version:"DICOM"},"(0400,0510)":{tag:"(0400,0510)",vr:"UI",name:"EncryptedContentTransferSyntaxUID",vm:"1",version:"DICOM"},"(0400,0520)":{tag:"(0400,0520)",vr:"OB",name:"EncryptedContent",vm:"1",version:"DICOM"},"(0400,0550)":{tag:"(0400,0550)",vr:"SQ",name:"ModifiedAttributesSequence",vm:"1",version:"DICOM"},"(0400,0561)":{tag:"(0400,0561)",vr:"SQ",name:"OriginalAttributesSequence",vm:"1",version:"DICOM"},"(0400,0562)":{tag:"(0400,0562)",vr:"DT",name:"AttributeModificationDateTime",vm:"1",version:"DICOM"},"(0400,0563)":{tag:"(0400,0563)",vr:"LO",name:"ModifyingSystem",vm:"1",version:"DICOM"},"(0400,0564)":{tag:"(0400,0564)",vr:"LO",name:"SourceOfPreviousValues",vm:"1",version:"DICOM"},"(0400,0565)":{tag:"(0400,0565)",vr:"CS",name:"ReasonForTheAttributeModification",vm:"1",version:"DICOM"},"(2000,0010)":{tag:"(2000,0010)",vr:"IS",name:"NumberOfCopies",vm:"1",version:"DICOM"},"(2000,001E)":{tag:"(2000,001E)",vr:"SQ",name:"PrinterConfigurationSequence",vm:"1",version:"DICOM"},"(2000,0020)":{tag:"(2000,0020)",vr:"CS",name:"PrintPriority",vm:"1",version:"DICOM"},"(2000,0030)":{tag:"(2000,0030)",vr:"CS",name:"MediumType",vm:"1",version:"DICOM"},"(2000,0040)":{tag:"(2000,0040)",vr:"CS",name:"FilmDestination",vm:"1",version:"DICOM"},"(2000,0050)":{tag:"(2000,0050)",vr:"LO",name:"FilmSessionLabel",vm:"1",version:"DICOM"},"(2000,0060)":{tag:"(2000,0060)",vr:"IS",name:"MemoryAllocation",vm:"1",version:"DICOM"},"(2000,0061)":{tag:"(2000,0061)",vr:"IS",name:"MaximumMemoryAllocation",vm:"1",version:"DICOM"},"(2000,00A0)":{tag:"(2000,00A0)",vr:"US",name:"MemoryBitDepth",vm:"1",version:"DICOM"},"(2000,00A1)":{tag:"(2000,00A1)",vr:"US",name:"PrintingBitDepth",vm:"1",version:"DICOM"},"(2000,00A2)":{tag:"(2000,00A2)",vr:"SQ",name:"MediaInstalledSequence",vm:"1",version:"DICOM"},"(2000,00A4)":{tag:"(2000,00A4)",vr:"SQ",name:"OtherMediaAvailableSequence",vm:"1",version:"DICOM"},"(2000,00A8)":{tag:"(2000,00A8)",vr:"SQ",name:"SupportedImageDisplayFormatsSequence",vm:"1",version:"DICOM"},"(2000,0500)":{tag:"(2000,0500)",vr:"SQ",name:"ReferencedFilmBoxSequence",vm:"1",version:"DICOM"},"(2010,0010)":{tag:"(2010,0010)",vr:"ST",name:"ImageDisplayFormat",vm:"1",version:"DICOM"},"(2010,0030)":{tag:"(2010,0030)",vr:"CS",name:"AnnotationDisplayFormatID",vm:"1",version:"DICOM"},"(2010,0040)":{tag:"(2010,0040)",vr:"CS",name:"FilmOrientation",vm:"1",version:"DICOM"},"(2010,0050)":{tag:"(2010,0050)",vr:"CS",name:"FilmSizeID",vm:"1",version:"DICOM"},"(2010,0052)":{tag:"(2010,0052)",vr:"CS",name:"PrinterResolutionID",vm:"1",version:"DICOM"},"(2010,0054)":{tag:"(2010,0054)",vr:"CS",name:"DefaultPrinterResolutionID",vm:"1",version:"DICOM"},"(2010,0060)":{tag:"(2010,0060)",vr:"CS",name:"MagnificationType",vm:"1",version:"DICOM"},"(2010,0080)":{tag:"(2010,0080)",vr:"CS",name:"SmoothingType",vm:"1",version:"DICOM"},"(2010,00A6)":{tag:"(2010,00A6)",vr:"CS",name:"DefaultMagnificationType",vm:"1",version:"DICOM"},"(2010,00A7)":{tag:"(2010,00A7)",vr:"CS",name:"OtherMagnificationTypesAvailable",vm:"1-n",version:"DICOM"},"(2010,00A8)":{tag:"(2010,00A8)",vr:"CS",name:"DefaultSmoothingType",vm:"1",version:"DICOM"},"(2010,00A9)":{tag:"(2010,00A9)",vr:"CS",name:"OtherSmoothingTypesAvailable",vm:"1-n",version:"DICOM"},"(2010,0100)":{tag:"(2010,0100)",vr:"CS",name:"BorderDensity",vm:"1",version:"DICOM"},"(2010,0110)":{tag:"(2010,0110)",vr:"CS",name:"EmptyImageDensity",vm:"1",version:"DICOM"},"(2010,0120)":{tag:"(2010,0120)",vr:"US",name:"MinDensity",vm:"1",version:"DICOM"},"(2010,0130)":{tag:"(2010,0130)",vr:"US",name:"MaxDensity",vm:"1",version:"DICOM"},"(2010,0140)":{tag:"(2010,0140)",vr:"CS",name:"Trim",vm:"1",version:"DICOM"},"(2010,0150)":{tag:"(2010,0150)",vr:"ST",name:"ConfigurationInformation",vm:"1",version:"DICOM"},"(2010,0152)":{tag:"(2010,0152)",vr:"LT",name:"ConfigurationInformationDescription",vm:"1",version:"DICOM"},"(2010,0154)":{tag:"(2010,0154)",vr:"IS",name:"MaximumCollatedFilms",vm:"1",version:"DICOM"},"(2010,015E)":{tag:"(2010,015E)",vr:"US",name:"Illumination",vm:"1",version:"DICOM"},"(2010,0160)":{tag:"(2010,0160)",vr:"US",name:"ReflectedAmbientLight",vm:"1",version:"DICOM"},"(2010,0376)":{tag:"(2010,0376)",vr:"DS",name:"PrinterPixelSpacing",vm:"2",version:"DICOM"},"(2010,0500)":{tag:"(2010,0500)",vr:"SQ",name:"ReferencedFilmSessionSequence",vm:"1",version:"DICOM"},"(2010,0510)":{tag:"(2010,0510)",vr:"SQ",name:"ReferencedImageBoxSequence",vm:"1",version:"DICOM"},"(2010,0520)":{tag:"(2010,0520)",vr:"SQ",name:"ReferencedBasicAnnotationBoxSequence",vm:"1",version:"DICOM"},"(2020,0010)":{tag:"(2020,0010)",vr:"US",name:"ImageBoxPosition",vm:"1",version:"DICOM"},"(2020,0020)":{tag:"(2020,0020)",vr:"CS",name:"Polarity",vm:"1",version:"DICOM"},"(2020,0030)":{tag:"(2020,0030)",vr:"DS",name:"RequestedImageSize",vm:"1",version:"DICOM"},"(2020,0040)":{tag:"(2020,0040)",vr:"CS",name:"RequestedDecimateCropBehavior",vm:"1",version:"DICOM"},"(2020,0050)":{tag:"(2020,0050)",vr:"CS",name:"RequestedResolutionID",vm:"1",version:"DICOM"},"(2020,00A0)":{tag:"(2020,00A0)",vr:"CS",name:"RequestedImageSizeFlag",vm:"1",version:"DICOM"},"(2020,00A2)":{tag:"(2020,00A2)",vr:"CS",name:"DecimateCropResult",vm:"1",version:"DICOM"},"(2020,0110)":{tag:"(2020,0110)",vr:"SQ",name:"BasicGrayscaleImageSequence",vm:"1",version:"DICOM"},"(2020,0111)":{tag:"(2020,0111)",vr:"SQ",name:"BasicColorImageSequence",vm:"1",version:"DICOM"},"(2030,0010)":{tag:"(2030,0010)",vr:"US",name:"AnnotationPosition",vm:"1",version:"DICOM"},"(2030,0020)":{tag:"(2030,0020)",vr:"LO",name:"TextString",vm:"1",version:"DICOM"},"(2050,0010)":{tag:"(2050,0010)",vr:"SQ",name:"PresentationLUTSequence",vm:"1",version:"DICOM"},"(2050,0020)":{tag:"(2050,0020)",vr:"CS",name:"PresentationLUTShape",vm:"1",version:"DICOM"},"(2050,0500)":{tag:"(2050,0500)",vr:"SQ",name:"ReferencedPresentationLUTSequence",vm:"1",version:"DICOM"},"(2100,0020)":{tag:"(2100,0020)",vr:"CS",name:"ExecutionStatus",vm:"1",version:"DICOM"},"(2100,0030)":{tag:"(2100,0030)",vr:"CS",name:"ExecutionStatusInfo",vm:"1",version:"DICOM"},"(2100,0040)":{tag:"(2100,0040)",vr:"DA",name:"CreationDate",vm:"1",version:"DICOM"},"(2100,0050)":{tag:"(2100,0050)",vr:"TM",name:"CreationTime",vm:"1",version:"DICOM"},"(2100,0070)":{tag:"(2100,0070)",vr:"AE",name:"Originator",vm:"1",version:"DICOM"},"(2100,0160)":{tag:"(2100,0160)",vr:"SH",name:"OwnerID",vm:"1",version:"DICOM"},"(2100,0170)":{tag:"(2100,0170)",vr:"IS",name:"NumberOfFilms",vm:"1",version:"DICOM"},"(2110,0010)":{tag:"(2110,0010)",vr:"CS",name:"PrinterStatus",vm:"1",version:"DICOM"},"(2110,0020)":{tag:"(2110,0020)",vr:"CS",name:"PrinterStatusInfo",vm:"1",version:"DICOM"},"(2110,0030)":{tag:"(2110,0030)",vr:"LO",name:"PrinterName",vm:"1",version:"DICOM"},"(2200,0001)":{tag:"(2200,0001)",vr:"CS",name:"LabelUsingInformationExtractedFromInstances",vm:"1",version:"DICOM"},"(2200,0002)":{tag:"(2200,0002)",vr:"UT",name:"LabelText",vm:"1",version:"DICOM"},"(2200,0003)":{tag:"(2200,0003)",vr:"CS",name:"LabelStyleSelection",vm:"1",version:"DICOM"},"(2200,0004)":{tag:"(2200,0004)",vr:"LT",name:"MediaDisposition",vm:"1",version:"DICOM"},"(2200,0005)":{tag:"(2200,0005)",vr:"LT",name:"BarcodeValue",vm:"1",version:"DICOM"},"(2200,0006)":{tag:"(2200,0006)",vr:"CS",name:"BarcodeSymbology",vm:"1",version:"DICOM"},"(2200,0007)":{tag:"(2200,0007)",vr:"CS",name:"AllowMediaSplitting",vm:"1",version:"DICOM"},"(2200,0008)":{tag:"(2200,0008)",vr:"CS",name:"IncludeNonDICOMObjects",vm:"1",version:"DICOM"},"(2200,0009)":{tag:"(2200,0009)",vr:"CS",name:"IncludeDisplayApplication",vm:"1",version:"DICOM"},"(2200,000A)":{tag:"(2200,000A)",vr:"CS",name:"PreserveCompositeInstancesAfterMediaCreation",vm:"1",version:"DICOM"},"(2200,000B)":{tag:"(2200,000B)",vr:"US",name:"TotalNumberOfPiecesOfMediaCreated",vm:"1",version:"DICOM"},"(2200,000C)":{tag:"(2200,000C)",vr:"LO",name:"RequestedMediaApplicationProfile",vm:"1",version:"DICOM"},"(2200,000D)":{tag:"(2200,000D)",vr:"SQ",name:"ReferencedStorageMediaSequence",vm:"1",version:"DICOM"},"(2200,000E)":{tag:"(2200,000E)",vr:"AT",name:"FailureAttributes",vm:"1-n",version:"DICOM"},"(2200,000F)":{tag:"(2200,000F)",vr:"CS",name:"AllowLossyCompression",vm:"1",version:"DICOM"},"(2200,0020)":{tag:"(2200,0020)",vr:"CS",name:"RequestPriority",vm:"1",version:"DICOM"},"(3002,0002)":{tag:"(3002,0002)",vr:"SH",name:"RTImageLabel",vm:"1",version:"DICOM"},"(3002,0003)":{tag:"(3002,0003)",vr:"LO",name:"RTImageName",vm:"1",version:"DICOM"},"(3002,0004)":{tag:"(3002,0004)",vr:"ST",name:"RTImageDescription",vm:"1",version:"DICOM"},"(3002,000A)":{tag:"(3002,000A)",vr:"CS",name:"ReportedValuesOrigin",vm:"1",version:"DICOM"},"(3002,000C)":{tag:"(3002,000C)",vr:"CS",name:"RTImagePlane",vm:"1",version:"DICOM"},"(3002,000D)":{tag:"(3002,000D)",vr:"DS",name:"XRayImageReceptorTranslation",vm:"3",version:"DICOM"},"(3002,000E)":{tag:"(3002,000E)",vr:"DS",name:"XRayImageReceptorAngle",vm:"1",version:"DICOM"},"(3002,0010)":{tag:"(3002,0010)",vr:"DS",name:"RTImageOrientation",vm:"6",version:"DICOM"},"(3002,0011)":{tag:"(3002,0011)",vr:"DS",name:"ImagePlanePixelSpacing",vm:"2",version:"DICOM"},"(3002,0012)":{tag:"(3002,0012)",vr:"DS",name:"RTImagePosition",vm:"2",version:"DICOM"},"(3002,0020)":{tag:"(3002,0020)",vr:"SH",name:"RadiationMachineName",vm:"1",version:"DICOM"},"(3002,0022)":{tag:"(3002,0022)",vr:"DS",name:"RadiationMachineSAD",vm:"1",version:"DICOM"},"(3002,0024)":{tag:"(3002,0024)",vr:"DS",name:"RadiationMachineSSD",vm:"1",version:"DICOM"},"(3002,0026)":{tag:"(3002,0026)",vr:"DS",name:"RTImageSID",vm:"1",version:"DICOM"},"(3002,0028)":{tag:"(3002,0028)",vr:"DS",name:"SourceToReferenceObjectDistance",vm:"1",version:"DICOM"},"(3002,0029)":{tag:"(3002,0029)",vr:"IS",name:"FractionNumber",vm:"1",version:"DICOM"},"(3002,0030)":{tag:"(3002,0030)",vr:"SQ",name:"ExposureSequence",vm:"1",version:"DICOM"},"(3002,0032)":{tag:"(3002,0032)",vr:"DS",name:"MetersetExposure",vm:"1",version:"DICOM"},"(3002,0034)":{tag:"(3002,0034)",vr:"DS",name:"DiaphragmPosition",vm:"4",version:"DICOM"},"(3002,0040)":{tag:"(3002,0040)",vr:"SQ",name:"FluenceMapSequence",vm:"1",version:"DICOM"},"(3002,0041)":{tag:"(3002,0041)",vr:"CS",name:"FluenceDataSource",vm:"1",version:"DICOM"},"(3002,0042)":{tag:"(3002,0042)",vr:"DS",name:"FluenceDataScale",vm:"1",version:"DICOM"},"(3002,0050)":{tag:"(3002,0050)",vr:"SQ",name:"PrimaryFluenceModeSequence",vm:"1",version:"DICOM"},"(3002,0051)":{tag:"(3002,0051)",vr:"CS",name:"FluenceMode",vm:"1",version:"DICOM"},"(3002,0052)":{tag:"(3002,0052)",vr:"SH",name:"FluenceModeID",vm:"1",version:"DICOM"},"(3004,0001)":{tag:"(3004,0001)",vr:"CS",name:"DVHType",vm:"1",version:"DICOM"},"(3004,0002)":{tag:"(3004,0002)",vr:"CS",name:"DoseUnits",vm:"1",version:"DICOM"},"(3004,0004)":{tag:"(3004,0004)",vr:"CS",name:"DoseType",vm:"1",version:"DICOM"},"(3004,0005)":{tag:"(3004,0005)",vr:"CS",name:"SpatialTransformOfDose",vm:"1",version:"DICOM"},"(3004,0006)":{tag:"(3004,0006)",vr:"LO",name:"DoseComment",vm:"1",version:"DICOM"},"(3004,0008)":{tag:"(3004,0008)",vr:"DS",name:"NormalizationPoint",vm:"3",version:"DICOM"},"(3004,000A)":{tag:"(3004,000A)",vr:"CS",name:"DoseSummationType",vm:"1",version:"DICOM"},"(3004,000C)":{tag:"(3004,000C)",vr:"DS",name:"GridFrameOffsetVector",vm:"2-n",version:"DICOM"},"(3004,000E)":{tag:"(3004,000E)",vr:"DS",name:"DoseGridScaling",vm:"1",version:"DICOM"},"(3004,0010)":{tag:"(3004,0010)",vr:"SQ",name:"RTDoseROISequence",vm:"1",version:"DICOM"},"(3004,0012)":{tag:"(3004,0012)",vr:"DS",name:"DoseValue",vm:"1",version:"DICOM"},"(3004,0014)":{tag:"(3004,0014)",vr:"CS",name:"TissueHeterogeneityCorrection",vm:"1-3",version:"DICOM"},"(3004,0040)":{tag:"(3004,0040)",vr:"DS",name:"DVHNormalizationPoint",vm:"3",version:"DICOM"},"(3004,0042)":{tag:"(3004,0042)",vr:"DS",name:"DVHNormalizationDoseValue",vm:"1",version:"DICOM"},"(3004,0050)":{tag:"(3004,0050)",vr:"SQ",name:"DVHSequence",vm:"1",version:"DICOM"},"(3004,0052)":{tag:"(3004,0052)",vr:"DS",name:"DVHDoseScaling",vm:"1",version:"DICOM"},"(3004,0054)":{tag:"(3004,0054)",vr:"CS",name:"DVHVolumeUnits",vm:"1",version:"DICOM"},"(3004,0056)":{tag:"(3004,0056)",vr:"IS",name:"DVHNumberOfBins",vm:"1",version:"DICOM"},"(3004,0058)":{tag:"(3004,0058)",vr:"DS",name:"DVHData",vm:"2-2n",version:"DICOM"},"(3004,0060)":{tag:"(3004,0060)",vr:"SQ",name:"DVHReferencedROISequence",vm:"1",version:"DICOM"},"(3004,0062)":{tag:"(3004,0062)",vr:"CS",name:"DVHROIContributionType",vm:"1",version:"DICOM"},"(3004,0070)":{tag:"(3004,0070)",vr:"DS",name:"DVHMinimumDose",vm:"1",version:"DICOM"},"(3004,0072)":{tag:"(3004,0072)",vr:"DS",name:"DVHMaximumDose",vm:"1",version:"DICOM"},"(3004,0074)":{tag:"(3004,0074)",vr:"DS",name:"DVHMeanDose",vm:"1",version:"DICOM"},"(3006,0002)":{tag:"(3006,0002)",vr:"SH",name:"StructureSetLabel",vm:"1",version:"DICOM"},"(3006,0004)":{tag:"(3006,0004)",vr:"LO",name:"StructureSetName",vm:"1",version:"DICOM"},"(3006,0006)":{tag:"(3006,0006)",vr:"ST",name:"StructureSetDescription",vm:"1",version:"DICOM"},"(3006,0008)":{tag:"(3006,0008)",vr:"DA",name:"StructureSetDate",vm:"1",version:"DICOM"},"(3006,0009)":{tag:"(3006,0009)",vr:"TM",name:"StructureSetTime",vm:"1",version:"DICOM"},"(3006,0010)":{tag:"(3006,0010)",vr:"SQ",name:"ReferencedFrameOfReferenceSequence",vm:"1",version:"DICOM"},"(3006,0012)":{tag:"(3006,0012)",vr:"SQ",name:"RTReferencedStudySequence",vm:"1",version:"DICOM"},"(3006,0014)":{tag:"(3006,0014)",vr:"SQ",name:"RTReferencedSeriesSequence",vm:"1",version:"DICOM"},"(3006,0016)":{tag:"(3006,0016)",vr:"SQ",name:"ContourImageSequence",vm:"1",version:"DICOM"},"(3006,0018)":{tag:"(3006,0018)",vr:"SQ",name:"PredecessorStructureSetSequence",vm:"1",version:"DICOM"},"(3006,0020)":{tag:"(3006,0020)",vr:"SQ",name:"StructureSetROISequence",vm:"1",version:"DICOM"},"(3006,0022)":{tag:"(3006,0022)",vr:"IS",name:"ROINumber",vm:"1",version:"DICOM"},"(3006,0024)":{tag:"(3006,0024)",vr:"UI",name:"ReferencedFrameOfReferenceUID",vm:"1",version:"DICOM"},"(3006,0026)":{tag:"(3006,0026)",vr:"LO",name:"ROIName",vm:"1",version:"DICOM"},"(3006,0028)":{tag:"(3006,0028)",vr:"ST",name:"ROIDescription",vm:"1",version:"DICOM"},"(3006,002A)":{tag:"(3006,002A)",vr:"IS",name:"ROIDisplayColor",vm:"3",version:"DICOM"},"(3006,002C)":{tag:"(3006,002C)",vr:"DS",name:"ROIVolume",vm:"1",version:"DICOM"},"(3006,0030)":{tag:"(3006,0030)",vr:"SQ",name:"RTRelatedROISequence",vm:"1",version:"DICOM"},"(3006,0033)":{tag:"(3006,0033)",vr:"CS",name:"RTROIRelationship",vm:"1",version:"DICOM"},"(3006,0036)":{tag:"(3006,0036)",vr:"CS",name:"ROIGenerationAlgorithm",vm:"1",version:"DICOM"},"(3006,0038)":{tag:"(3006,0038)",vr:"LO",name:"ROIGenerationDescription",vm:"1",version:"DICOM"},"(3006,0039)":{tag:"(3006,0039)",vr:"SQ",name:"ROIContourSequence",vm:"1",version:"DICOM"},"(3006,0040)":{tag:"(3006,0040)",vr:"SQ",name:"ContourSequence",vm:"1",version:"DICOM"},"(3006,0042)":{tag:"(3006,0042)",vr:"CS",name:"ContourGeometricType",vm:"1",version:"DICOM"},"(3006,0044)":{tag:"(3006,0044)",vr:"DS",name:"ContourSlabThickness",vm:"1",version:"DICOM"},"(3006,0045)":{tag:"(3006,0045)",vr:"DS",name:"ContourOffsetVector",vm:"3",version:"DICOM"},"(3006,0046)":{tag:"(3006,0046)",vr:"IS",name:"NumberOfContourPoints",vm:"1",version:"DICOM"},"(3006,0048)":{tag:"(3006,0048)",vr:"IS",name:"ContourNumber",vm:"1",version:"DICOM"},"(3006,0049)":{tag:"(3006,0049)",vr:"IS",name:"AttachedContours",vm:"1-n",version:"DICOM"},"(3006,0050)":{tag:"(3006,0050)",vr:"DS",name:"ContourData",vm:"3-3n",version:"DICOM"},"(3006,0080)":{tag:"(3006,0080)",vr:"SQ",name:"RTROIObservationsSequence",vm:"1",version:"DICOM"},"(3006,0082)":{tag:"(3006,0082)",vr:"IS",name:"ObservationNumber",vm:"1",version:"DICOM"},"(3006,0084)":{tag:"(3006,0084)",vr:"IS",name:"ReferencedROINumber",vm:"1",version:"DICOM"},"(3006,0085)":{tag:"(3006,0085)",vr:"SH",name:"ROIObservationLabel",vm:"1",version:"DICOM"},"(3006,0086)":{tag:"(3006,0086)",vr:"SQ",name:"RTROIIdentificationCodeSequence",vm:"1",version:"DICOM"},"(3006,0088)":{tag:"(3006,0088)",vr:"ST",name:"ROIObservationDescription",vm:"1",version:"DICOM"},"(3006,00A0)":{tag:"(3006,00A0)",vr:"SQ",name:"RelatedRTROIObservationsSequence",vm:"1",version:"DICOM"},"(3006,00A4)":{tag:"(3006,00A4)",vr:"CS",name:"RTROIInterpretedType",vm:"1",version:"DICOM"},"(3006,00A6)":{tag:"(3006,00A6)",vr:"PN",name:"ROIInterpreter",vm:"1",version:"DICOM"},"(3006,00B0)":{tag:"(3006,00B0)",vr:"SQ",name:"ROIPhysicalPropertiesSequence",vm:"1",version:"DICOM"},"(3006,00B2)":{tag:"(3006,00B2)",vr:"CS",name:"ROIPhysicalProperty",vm:"1",version:"DICOM"},"(3006,00B4)":{tag:"(3006,00B4)",vr:"DS",name:"ROIPhysicalPropertyValue",vm:"1",version:"DICOM"},"(3006,00B6)":{tag:"(3006,00B6)",vr:"SQ",name:"ROIElementalCompositionSequence",vm:"1",version:"DICOM"},"(3006,00B7)":{tag:"(3006,00B7)",vr:"US",name:"ROIElementalCompositionAtomicNumber",vm:"1",version:"DICOM"},"(3006,00B8)":{tag:"(3006,00B8)",vr:"FL",name:"ROIElementalCompositionAtomicMassFraction",vm:"1",version:"DICOM"},"(3006,00B9)":{tag:"(3006,00B9)",vr:"SQ",name:"AdditionalRTROIIdentificationCodeSequence",vm:"1",version:"DICOM"},"(3006,00C6)":{tag:"(3006,00C6)",vr:"DS",name:"FrameOfReferenceTransformationMatrix",vm:"16",version:"DICOM"},"(3006,00C8)":{tag:"(3006,00C8)",vr:"LO",name:"FrameOfReferenceTransformationComment",vm:"1",version:"DICOM"},"(3008,0010)":{tag:"(3008,0010)",vr:"SQ",name:"MeasuredDoseReferenceSequence",vm:"1",version:"DICOM"},"(3008,0012)":{tag:"(3008,0012)",vr:"ST",name:"MeasuredDoseDescription",vm:"1",version:"DICOM"},"(3008,0014)":{tag:"(3008,0014)",vr:"CS",name:"MeasuredDoseType",vm:"1",version:"DICOM"},"(3008,0016)":{tag:"(3008,0016)",vr:"DS",name:"MeasuredDoseValue",vm:"1",version:"DICOM"},"(3008,0020)":{tag:"(3008,0020)",vr:"SQ",name:"TreatmentSessionBeamSequence",vm:"1",version:"DICOM"},"(3008,0021)":{tag:"(3008,0021)",vr:"SQ",name:"TreatmentSessionIonBeamSequence",vm:"1",version:"DICOM"},"(3008,0022)":{tag:"(3008,0022)",vr:"IS",name:"CurrentFractionNumber",vm:"1",version:"DICOM"},"(3008,0024)":{tag:"(3008,0024)",vr:"DA",name:"TreatmentControlPointDate",vm:"1",version:"DICOM"},"(3008,0025)":{tag:"(3008,0025)",vr:"TM",name:"TreatmentControlPointTime",vm:"1",version:"DICOM"},"(3008,002A)":{tag:"(3008,002A)",vr:"CS",name:"TreatmentTerminationStatus",vm:"1",version:"DICOM"},"(3008,002B)":{tag:"(3008,002B)",vr:"SH",name:"TreatmentTerminationCode",vm:"1",version:"DICOM"},"(3008,002C)":{tag:"(3008,002C)",vr:"CS",name:"TreatmentVerificationStatus",vm:"1",version:"DICOM"},"(3008,0030)":{tag:"(3008,0030)",vr:"SQ",name:"ReferencedTreatmentRecordSequence",vm:"1",version:"DICOM"},"(3008,0032)":{tag:"(3008,0032)",vr:"DS",name:"SpecifiedPrimaryMeterset",vm:"1",version:"DICOM"},"(3008,0033)":{tag:"(3008,0033)",vr:"DS",name:"SpecifiedSecondaryMeterset",vm:"1",version:"DICOM"},"(3008,0036)":{tag:"(3008,0036)",vr:"DS",name:"DeliveredPrimaryMeterset",vm:"1",version:"DICOM"},"(3008,0037)":{tag:"(3008,0037)",vr:"DS",name:"DeliveredSecondaryMeterset",vm:"1",version:"DICOM"},"(3008,003A)":{tag:"(3008,003A)",vr:"DS",name:"SpecifiedTreatmentTime",vm:"1",version:"DICOM"},"(3008,003B)":{tag:"(3008,003B)",vr:"DS",name:"DeliveredTreatmentTime",vm:"1",version:"DICOM"},"(3008,0040)":{tag:"(3008,0040)",vr:"SQ",name:"ControlPointDeliverySequence",vm:"1",version:"DICOM"},"(3008,0041)":{tag:"(3008,0041)",vr:"SQ",name:"IonControlPointDeliverySequence",vm:"1",version:"DICOM"},"(3008,0042)":{tag:"(3008,0042)",vr:"DS",name:"SpecifiedMeterset",vm:"1",version:"DICOM"},"(3008,0044)":{tag:"(3008,0044)",vr:"DS",name:"DeliveredMeterset",vm:"1",version:"DICOM"},"(3008,0045)":{tag:"(3008,0045)",vr:"FL",name:"MetersetRateSet",vm:"1",version:"DICOM"},"(3008,0046)":{tag:"(3008,0046)",vr:"FL",name:"MetersetRateDelivered",vm:"1",version:"DICOM"},"(3008,0047)":{tag:"(3008,0047)",vr:"FL",name:"ScanSpotMetersetsDelivered",vm:"1-n",version:"DICOM"},"(3008,0048)":{tag:"(3008,0048)",vr:"DS",name:"DoseRateDelivered",vm:"1",version:"DICOM"},"(3008,0050)":{tag:"(3008,0050)",vr:"SQ",name:"TreatmentSummaryCalculatedDoseReferenceSequence",vm:"1",version:"DICOM"},"(3008,0052)":{tag:"(3008,0052)",vr:"DS",name:"CumulativeDoseToDoseReference",vm:"1",version:"DICOM"},"(3008,0054)":{tag:"(3008,0054)",vr:"DA",name:"FirstTreatmentDate",vm:"1",version:"DICOM"},"(3008,0056)":{tag:"(3008,0056)",vr:"DA",name:"MostRecentTreatmentDate",vm:"1",version:"DICOM"},"(3008,005A)":{tag:"(3008,005A)",vr:"IS",name:"NumberOfFractionsDelivered",vm:"1",version:"DICOM"},"(3008,0060)":{tag:"(3008,0060)",vr:"SQ",name:"OverrideSequence",vm:"1",version:"DICOM"},"(3008,0061)":{tag:"(3008,0061)",vr:"AT",name:"ParameterSequencePointer",vm:"1",version:"DICOM"},"(3008,0062)":{tag:"(3008,0062)",vr:"AT",name:"OverrideParameterPointer",vm:"1",version:"DICOM"},"(3008,0063)":{tag:"(3008,0063)",vr:"IS",name:"ParameterItemIndex",vm:"1",version:"DICOM"},"(3008,0064)":{tag:"(3008,0064)",vr:"IS",name:"MeasuredDoseReferenceNumber",vm:"1",version:"DICOM"},"(3008,0065)":{tag:"(3008,0065)",vr:"AT",name:"ParameterPointer",vm:"1",version:"DICOM"},"(3008,0066)":{tag:"(3008,0066)",vr:"ST",name:"OverrideReason",vm:"1",version:"DICOM"},"(3008,0068)":{tag:"(3008,0068)",vr:"SQ",name:"CorrectedParameterSequence",vm:"1",version:"DICOM"},"(3008,006A)":{tag:"(3008,006A)",vr:"FL",name:"CorrectionValue",vm:"1",version:"DICOM"},"(3008,0070)":{tag:"(3008,0070)",vr:"SQ",name:"CalculatedDoseReferenceSequence",vm:"1",version:"DICOM"},"(3008,0072)":{tag:"(3008,0072)",vr:"IS",name:"CalculatedDoseReferenceNumber",vm:"1",version:"DICOM"},"(3008,0074)":{tag:"(3008,0074)",vr:"ST",name:"CalculatedDoseReferenceDescription",vm:"1",version:"DICOM"},"(3008,0076)":{tag:"(3008,0076)",vr:"DS",name:"CalculatedDoseReferenceDoseValue",vm:"1",version:"DICOM"},"(3008,0078)":{tag:"(3008,0078)",vr:"DS",name:"StartMeterset",vm:"1",version:"DICOM"},"(3008,007A)":{tag:"(3008,007A)",vr:"DS",name:"EndMeterset",vm:"1",version:"DICOM"},"(3008,0080)":{tag:"(3008,0080)",vr:"SQ",name:"ReferencedMeasuredDoseReferenceSequence",vm:"1",version:"DICOM"},"(3008,0082)":{tag:"(3008,0082)",vr:"IS",name:"ReferencedMeasuredDoseReferenceNumber",vm:"1",version:"DICOM"},"(3008,0090)":{tag:"(3008,0090)",vr:"SQ",name:"ReferencedCalculatedDoseReferenceSequence",vm:"1",version:"DICOM"},"(3008,0092)":{tag:"(3008,0092)",vr:"IS",name:"ReferencedCalculatedDoseReferenceNumber",vm:"1",version:"DICOM"},"(3008,00A0)":{tag:"(3008,00A0)",vr:"SQ",name:"BeamLimitingDeviceLeafPairsSequence",vm:"1",version:"DICOM"},"(3008,00B0)":{tag:"(3008,00B0)",vr:"SQ",name:"RecordedWedgeSequence",vm:"1",version:"DICOM"},"(3008,00C0)":{tag:"(3008,00C0)",vr:"SQ",name:"RecordedCompensatorSequence",vm:"1",version:"DICOM"},"(3008,00D0)":{tag:"(3008,00D0)",vr:"SQ",name:"RecordedBlockSequence",vm:"1",version:"DICOM"},"(3008,00E0)":{tag:"(3008,00E0)",vr:"SQ",name:"TreatmentSummaryMeasuredDoseReferenceSequence",vm:"1",version:"DICOM"},"(3008,00F0)":{tag:"(3008,00F0)",vr:"SQ",name:"RecordedSnoutSequence",vm:"1",version:"DICOM"},"(3008,00F2)":{tag:"(3008,00F2)",vr:"SQ",name:"RecordedRangeShifterSequence",vm:"1",version:"DICOM"},"(3008,00F4)":{tag:"(3008,00F4)",vr:"SQ",name:"RecordedLateralSpreadingDeviceSequence",vm:"1",version:"DICOM"},"(3008,00F6)":{tag:"(3008,00F6)",vr:"SQ",name:"RecordedRangeModulatorSequence",vm:"1",version:"DICOM"},"(3008,0100)":{tag:"(3008,0100)",vr:"SQ",name:"RecordedSourceSequence",vm:"1",version:"DICOM"},"(3008,0105)":{tag:"(3008,0105)",vr:"LO",name:"SourceSerialNumber",vm:"1",version:"DICOM"},"(3008,0110)":{tag:"(3008,0110)",vr:"SQ",name:"TreatmentSessionApplicationSetupSequence",vm:"1",version:"DICOM"},"(3008,0116)":{tag:"(3008,0116)",vr:"CS",name:"ApplicationSetupCheck",vm:"1",version:"DICOM"},"(3008,0120)":{tag:"(3008,0120)",vr:"SQ",name:"RecordedBrachyAccessoryDeviceSequence",vm:"1",version:"DICOM"},"(3008,0122)":{tag:"(3008,0122)",vr:"IS",name:"ReferencedBrachyAccessoryDeviceNumber",vm:"1",version:"DICOM"},"(3008,0130)":{tag:"(3008,0130)",vr:"SQ",name:"RecordedChannelSequence",vm:"1",version:"DICOM"},"(3008,0132)":{tag:"(3008,0132)",vr:"DS",name:"SpecifiedChannelTotalTime",vm:"1",version:"DICOM"},"(3008,0134)":{tag:"(3008,0134)",vr:"DS",name:"DeliveredChannelTotalTime",vm:"1",version:"DICOM"},"(3008,0136)":{tag:"(3008,0136)",vr:"IS",name:"SpecifiedNumberOfPulses",vm:"1",version:"DICOM"},"(3008,0138)":{tag:"(3008,0138)",vr:"IS",name:"DeliveredNumberOfPulses",vm:"1",version:"DICOM"},"(3008,013A)":{tag:"(3008,013A)",vr:"DS",name:"SpecifiedPulseRepetitionInterval",vm:"1",version:"DICOM"},"(3008,013C)":{tag:"(3008,013C)",vr:"DS",name:"DeliveredPulseRepetitionInterval",vm:"1",version:"DICOM"},"(3008,0140)":{tag:"(3008,0140)",vr:"SQ",name:"RecordedSourceApplicatorSequence",vm:"1",version:"DICOM"},"(3008,0142)":{tag:"(3008,0142)",vr:"IS",name:"ReferencedSourceApplicatorNumber",vm:"1",version:"DICOM"},"(3008,0150)":{tag:"(3008,0150)",vr:"SQ",name:"RecordedChannelShieldSequence",vm:"1",version:"DICOM"},"(3008,0152)":{tag:"(3008,0152)",vr:"IS",name:"ReferencedChannelShieldNumber",vm:"1",version:"DICOM"},"(3008,0160)":{tag:"(3008,0160)",vr:"SQ",name:"BrachyControlPointDeliveredSequence",vm:"1",version:"DICOM"},"(3008,0162)":{tag:"(3008,0162)",vr:"DA",name:"SafePositionExitDate",vm:"1",version:"DICOM"},"(3008,0164)":{tag:"(3008,0164)",vr:"TM",name:"SafePositionExitTime",vm:"1",version:"DICOM"},"(3008,0166)":{tag:"(3008,0166)",vr:"DA",name:"SafePositionReturnDate",vm:"1",version:"DICOM"},"(3008,0168)":{tag:"(3008,0168)",vr:"TM",name:"SafePositionReturnTime",vm:"1",version:"DICOM"},"(3008,0171)":{tag:"(3008,0171)",vr:"SQ",name:"PulseSpecificBrachyControlPointDeliveredSequence",vm:"1",version:"DICOM"},"(3008,0172)":{tag:"(3008,0172)",vr:"US",name:"PulseNumber",vm:"1",version:"DICOM"},"(3008,0173)":{tag:"(3008,0173)",vr:"SQ",name:"BrachyPulseControlPointDeliveredSequence",vm:"1",version:"DICOM"},"(3008,0200)":{tag:"(3008,0200)",vr:"CS",name:"CurrentTreatmentStatus",vm:"1",version:"DICOM"},"(3008,0202)":{tag:"(3008,0202)",vr:"ST",name:"TreatmentStatusComment",vm:"1",version:"DICOM"},"(3008,0220)":{tag:"(3008,0220)",vr:"SQ",name:"FractionGroupSummarySequence",vm:"1",version:"DICOM"},"(3008,0223)":{tag:"(3008,0223)",vr:"IS",name:"ReferencedFractionNumber",vm:"1",version:"DICOM"},"(3008,0224)":{tag:"(3008,0224)",vr:"CS",name:"FractionGroupType",vm:"1",version:"DICOM"},"(3008,0230)":{tag:"(3008,0230)",vr:"CS",name:"BeamStopperPosition",vm:"1",version:"DICOM"},"(3008,0240)":{tag:"(3008,0240)",vr:"SQ",name:"FractionStatusSummarySequence",vm:"1",version:"DICOM"},"(3008,0250)":{tag:"(3008,0250)",vr:"DA",name:"TreatmentDate",vm:"1",version:"DICOM"},"(3008,0251)":{tag:"(3008,0251)",vr:"TM",name:"TreatmentTime",vm:"1",version:"DICOM"},"(300A,0002)":{tag:"(300A,0002)",vr:"SH",name:"RTPlanLabel",vm:"1",version:"DICOM"},"(300A,0003)":{tag:"(300A,0003)",vr:"LO",name:"RTPlanName",vm:"1",version:"DICOM"},"(300A,0004)":{tag:"(300A,0004)",vr:"ST",name:"RTPlanDescription",vm:"1",version:"DICOM"},"(300A,0006)":{tag:"(300A,0006)",vr:"DA",name:"RTPlanDate",vm:"1",version:"DICOM"},"(300A,0007)":{tag:"(300A,0007)",vr:"TM",name:"RTPlanTime",vm:"1",version:"DICOM"},"(300A,0009)":{tag:"(300A,0009)",vr:"LO",name:"TreatmentProtocols",vm:"1-n",version:"DICOM"},"(300A,000A)":{tag:"(300A,000A)",vr:"CS",name:"PlanIntent",vm:"1",version:"DICOM"},"(300A,000B)":{tag:"(300A,000B)",vr:"LO",name:"TreatmentSites",vm:"1-n",version:"DICOM"},"(300A,000C)":{tag:"(300A,000C)",vr:"CS",name:"RTPlanGeometry",vm:"1",version:"DICOM"},"(300A,000E)":{tag:"(300A,000E)",vr:"ST",name:"PrescriptionDescription",vm:"1",version:"DICOM"},"(300A,0010)":{tag:"(300A,0010)",vr:"SQ",name:"DoseReferenceSequence",vm:"1",version:"DICOM"},"(300A,0012)":{tag:"(300A,0012)",vr:"IS",name:"DoseReferenceNumber",vm:"1",version:"DICOM"},"(300A,0013)":{tag:"(300A,0013)",vr:"UI",name:"DoseReferenceUID",vm:"1",version:"DICOM"},"(300A,0014)":{tag:"(300A,0014)",vr:"CS",name:"DoseReferenceStructureType",vm:"1",version:"DICOM"},"(300A,0015)":{tag:"(300A,0015)",vr:"CS",name:"NominalBeamEnergyUnit",vm:"1",version:"DICOM"},"(300A,0016)":{tag:"(300A,0016)",vr:"LO",name:"DoseReferenceDescription",vm:"1",version:"DICOM"},"(300A,0018)":{tag:"(300A,0018)",vr:"DS",name:"DoseReferencePointCoordinates",vm:"3",version:"DICOM"},"(300A,001A)":{tag:"(300A,001A)",vr:"DS",name:"NominalPriorDose",vm:"1",version:"DICOM"},"(300A,0020)":{tag:"(300A,0020)",vr:"CS",name:"DoseReferenceType",vm:"1",version:"DICOM"},"(300A,0021)":{tag:"(300A,0021)",vr:"DS",name:"ConstraintWeight",vm:"1",version:"DICOM"},"(300A,0022)":{tag:"(300A,0022)",vr:"DS",name:"DeliveryWarningDose",vm:"1",version:"DICOM"},"(300A,0023)":{tag:"(300A,0023)",vr:"DS",name:"DeliveryMaximumDose",vm:"1",version:"DICOM"},"(300A,0025)":{tag:"(300A,0025)",vr:"DS",name:"TargetMinimumDose",vm:"1",version:"DICOM"},"(300A,0026)":{tag:"(300A,0026)",vr:"DS",name:"TargetPrescriptionDose",vm:"1",version:"DICOM"},"(300A,0027)":{tag:"(300A,0027)",vr:"DS",name:"TargetMaximumDose",vm:"1",version:"DICOM"},"(300A,0028)":{tag:"(300A,0028)",vr:"DS",name:"TargetUnderdoseVolumeFraction",vm:"1",version:"DICOM"},"(300A,002A)":{tag:"(300A,002A)",vr:"DS",name:"OrganAtRiskFullVolumeDose",vm:"1",version:"DICOM"},"(300A,002B)":{tag:"(300A,002B)",vr:"DS",name:"OrganAtRiskLimitDose",vm:"1",version:"DICOM"},"(300A,002C)":{tag:"(300A,002C)",vr:"DS",name:"OrganAtRiskMaximumDose",vm:"1",version:"DICOM"},"(300A,002D)":{tag:"(300A,002D)",vr:"DS",name:"OrganAtRiskOverdoseVolumeFraction",vm:"1",version:"DICOM"},"(300A,0040)":{tag:"(300A,0040)",vr:"SQ",name:"ToleranceTableSequence",vm:"1",version:"DICOM"},"(300A,0042)":{tag:"(300A,0042)",vr:"IS",name:"ToleranceTableNumber",vm:"1",version:"DICOM"},"(300A,0043)":{tag:"(300A,0043)",vr:"SH",name:"ToleranceTableLabel",vm:"1",version:"DICOM"},"(300A,0044)":{tag:"(300A,0044)",vr:"DS",name:"GantryAngleTolerance",vm:"1",version:"DICOM"},"(300A,0046)":{tag:"(300A,0046)",vr:"DS",name:"BeamLimitingDeviceAngleTolerance",vm:"1",version:"DICOM"},"(300A,0048)":{tag:"(300A,0048)",vr:"SQ",name:"BeamLimitingDeviceToleranceSequence",vm:"1",version:"DICOM"},"(300A,004A)":{tag:"(300A,004A)",vr:"DS",name:"BeamLimitingDevicePositionTolerance",vm:"1",version:"DICOM"},"(300A,004B)":{tag:"(300A,004B)",vr:"FL",name:"SnoutPositionTolerance",vm:"1",version:"DICOM"},"(300A,004C)":{tag:"(300A,004C)",vr:"DS",name:"PatientSupportAngleTolerance",vm:"1",version:"DICOM"},"(300A,004E)":{tag:"(300A,004E)",vr:"DS",name:"TableTopEccentricAngleTolerance",vm:"1",version:"DICOM"},"(300A,004F)":{tag:"(300A,004F)",vr:"FL",name:"TableTopPitchAngleTolerance",vm:"1",version:"DICOM"},"(300A,0050)":{tag:"(300A,0050)",vr:"FL",name:"TableTopRollAngleTolerance",vm:"1",version:"DICOM"},"(300A,0051)":{tag:"(300A,0051)",vr:"DS",name:"TableTopVerticalPositionTolerance",vm:"1",version:"DICOM"},"(300A,0052)":{tag:"(300A,0052)",vr:"DS",name:"TableTopLongitudinalPositionTolerance",vm:"1",version:"DICOM"},"(300A,0053)":{tag:"(300A,0053)",vr:"DS",name:"TableTopLateralPositionTolerance",vm:"1",version:"DICOM"},"(300A,0055)":{tag:"(300A,0055)",vr:"CS",name:"RTPlanRelationship",vm:"1",version:"DICOM"},"(300A,0070)":{tag:"(300A,0070)",vr:"SQ",name:"FractionGroupSequence",vm:"1",version:"DICOM"},"(300A,0071)":{tag:"(300A,0071)",vr:"IS",name:"FractionGroupNumber",vm:"1",version:"DICOM"},"(300A,0072)":{tag:"(300A,0072)",vr:"LO",name:"FractionGroupDescription",vm:"1",version:"DICOM"},"(300A,0078)":{tag:"(300A,0078)",vr:"IS",name:"NumberOfFractionsPlanned",vm:"1",version:"DICOM"},"(300A,0079)":{tag:"(300A,0079)",vr:"IS",name:"NumberOfFractionPatternDigitsPerDay",vm:"1",version:"DICOM"},"(300A,007A)":{tag:"(300A,007A)",vr:"IS",name:"RepeatFractionCycleLength",vm:"1",version:"DICOM"},"(300A,007B)":{tag:"(300A,007B)",vr:"LT",name:"FractionPattern",vm:"1",version:"DICOM"},"(300A,0080)":{tag:"(300A,0080)",vr:"IS",name:"NumberOfBeams",vm:"1",version:"DICOM"},"(300A,0082)":{tag:"(300A,0082)",vr:"DS",name:"BeamDoseSpecificationPoint",vm:"3",version:"DICOM"},"(300A,0084)":{tag:"(300A,0084)",vr:"DS",name:"BeamDose",vm:"1",version:"DICOM"},"(300A,0086)":{tag:"(300A,0086)",vr:"DS",name:"BeamMeterset",vm:"1",version:"DICOM"},"(300A,008B)":{tag:"(300A,008B)",vr:"CS",name:"BeamDoseMeaning",vm:"1",version:"DICOM"},"(300A,008C)":{tag:"(300A,008C)",vr:"SQ",name:"BeamDoseVerificationControlPointSequence",vm:"1",version:"DICOM"},"(300A,008D)":{tag:"(300A,008D)",vr:"FL",name:"AverageBeamDosePointDepth",vm:"1",version:"DICOM"},"(300A,008E)":{tag:"(300A,008E)",vr:"FL",name:"AverageBeamDosePointEquivalentDepth",vm:"1",version:"DICOM"},"(300A,008F)":{tag:"(300A,008F)",vr:"FL",name:"AverageBeamDosePointSSD",vm:"1",version:"DICOM"},"(300A,00A0)":{tag:"(300A,00A0)",vr:"IS",name:"NumberOfBrachyApplicationSetups",vm:"1",version:"DICOM"},"(300A,00A2)":{tag:"(300A,00A2)",vr:"DS",name:"BrachyApplicationSetupDoseSpecificationPoint",vm:"3",version:"DICOM"},"(300A,00A4)":{tag:"(300A,00A4)",vr:"DS",name:"BrachyApplicationSetupDose",vm:"1",version:"DICOM"},"(300A,00B0)":{tag:"(300A,00B0)",vr:"SQ",name:"BeamSequence",vm:"1",version:"DICOM"},"(300A,00B2)":{tag:"(300A,00B2)",vr:"SH",name:"TreatmentMachineName",vm:"1",version:"DICOM"},"(300A,00B3)":{tag:"(300A,00B3)",vr:"CS",name:"PrimaryDosimeterUnit",vm:"1",version:"DICOM"},"(300A,00B4)":{tag:"(300A,00B4)",vr:"DS",name:"SourceAxisDistance",vm:"1",version:"DICOM"},"(300A,00B6)":{tag:"(300A,00B6)",vr:"SQ",name:"BeamLimitingDeviceSequence",vm:"1",version:"DICOM"},"(300A,00B8)":{tag:"(300A,00B8)",vr:"CS",name:"RTBeamLimitingDeviceType",vm:"1",version:"DICOM"},"(300A,00BA)":{tag:"(300A,00BA)",vr:"DS",name:"SourceToBeamLimitingDeviceDistance",vm:"1",version:"DICOM"},"(300A,00BB)":{tag:"(300A,00BB)",vr:"FL",name:"IsocenterToBeamLimitingDeviceDistance",vm:"1",version:"DICOM"},"(300A,00BC)":{tag:"(300A,00BC)",vr:"IS",name:"NumberOfLeafJawPairs",vm:"1",version:"DICOM"},"(300A,00BE)":{tag:"(300A,00BE)",vr:"DS",name:"LeafPositionBoundaries",vm:"3-n",version:"DICOM"},"(300A,00C0)":{tag:"(300A,00C0)",vr:"IS",name:"BeamNumber",vm:"1",version:"DICOM"},"(300A,00C2)":{tag:"(300A,00C2)",vr:"LO",name:"BeamName",vm:"1",version:"DICOM"},"(300A,00C3)":{tag:"(300A,00C3)",vr:"ST",name:"BeamDescription",vm:"1",version:"DICOM"},"(300A,00C4)":{tag:"(300A,00C4)",vr:"CS",name:"BeamType",vm:"1",version:"DICOM"},"(300A,00C5)":{tag:"(300A,00C5)",vr:"FD",name:"BeamDeliveryDurationLimit",vm:"1",version:"DICOM"},"(300A,00C6)":{tag:"(300A,00C6)",vr:"CS",name:"RadiationType",vm:"1",version:"DICOM"},"(300A,00C7)":{tag:"(300A,00C7)",vr:"CS",name:"HighDoseTechniqueType",vm:"1",version:"DICOM"},"(300A,00C8)":{tag:"(300A,00C8)",vr:"IS",name:"ReferenceImageNumber",vm:"1",version:"DICOM"},"(300A,00CA)":{tag:"(300A,00CA)",vr:"SQ",name:"PlannedVerificationImageSequence",vm:"1",version:"DICOM"},"(300A,00CC)":{tag:"(300A,00CC)",vr:"LO",name:"ImagingDeviceSpecificAcquisitionParameters",vm:"1-n",version:"DICOM"},"(300A,00CE)":{tag:"(300A,00CE)",vr:"CS",name:"TreatmentDeliveryType",vm:"1",version:"DICOM"},"(300A,00D0)":{tag:"(300A,00D0)",vr:"IS",name:"NumberOfWedges",vm:"1",version:"DICOM"},"(300A,00D1)":{tag:"(300A,00D1)",vr:"SQ",name:"WedgeSequence",vm:"1",version:"DICOM"},"(300A,00D2)":{tag:"(300A,00D2)",vr:"IS",name:"WedgeNumber",vm:"1",version:"DICOM"},"(300A,00D3)":{tag:"(300A,00D3)",vr:"CS",name:"WedgeType",vm:"1",version:"DICOM"},"(300A,00D4)":{tag:"(300A,00D4)",vr:"SH",name:"WedgeID",vm:"1",version:"DICOM"},"(300A,00D5)":{tag:"(300A,00D5)",vr:"IS",name:"WedgeAngle",vm:"1",version:"DICOM"},"(300A,00D6)":{tag:"(300A,00D6)",vr:"DS",name:"WedgeFactor",vm:"1",version:"DICOM"},"(300A,00D7)":{tag:"(300A,00D7)",vr:"FL",name:"TotalWedgeTrayWaterEquivalentThickness",vm:"1",version:"DICOM"},"(300A,00D8)":{tag:"(300A,00D8)",vr:"DS",name:"WedgeOrientation",vm:"1",version:"DICOM"},"(300A,00D9)":{tag:"(300A,00D9)",vr:"FL",name:"IsocenterToWedgeTrayDistance",vm:"1",version:"DICOM"},"(300A,00DA)":{tag:"(300A,00DA)",vr:"DS",name:"SourceToWedgeTrayDistance",vm:"1",version:"DICOM"},"(300A,00DB)":{tag:"(300A,00DB)",vr:"FL",name:"WedgeThinEdgePosition",vm:"1",version:"DICOM"},"(300A,00DC)":{tag:"(300A,00DC)",vr:"SH",name:"BolusID",vm:"1",version:"DICOM"},"(300A,00DD)":{tag:"(300A,00DD)",vr:"ST",name:"BolusDescription",vm:"1",version:"DICOM"},"(300A,00DE)":{tag:"(300A,00DE)",vr:"DS",name:"EffectiveWedgeAngle",vm:"1",version:"DICOM"},"(300A,00E0)":{tag:"(300A,00E0)",vr:"IS",name:"NumberOfCompensators",vm:"1",version:"DICOM"},"(300A,00E1)":{tag:"(300A,00E1)",vr:"SH",name:"MaterialID",vm:"1",version:"DICOM"},"(300A,00E2)":{tag:"(300A,00E2)",vr:"DS",name:"TotalCompensatorTrayFactor",vm:"1",version:"DICOM"},"(300A,00E3)":{tag:"(300A,00E3)",vr:"SQ",name:"CompensatorSequence",vm:"1",version:"DICOM"},"(300A,00E4)":{tag:"(300A,00E4)",vr:"IS",name:"CompensatorNumber",vm:"1",version:"DICOM"},"(300A,00E5)":{tag:"(300A,00E5)",vr:"SH",name:"CompensatorID",vm:"1",version:"DICOM"},"(300A,00E6)":{tag:"(300A,00E6)",vr:"DS",name:"SourceToCompensatorTrayDistance",vm:"1",version:"DICOM"},"(300A,00E7)":{tag:"(300A,00E7)",vr:"IS",name:"CompensatorRows",vm:"1",version:"DICOM"},"(300A,00E8)":{tag:"(300A,00E8)",vr:"IS",name:"CompensatorColumns",vm:"1",version:"DICOM"},"(300A,00E9)":{tag:"(300A,00E9)",vr:"DS",name:"CompensatorPixelSpacing",vm:"2",version:"DICOM"},"(300A,00EA)":{tag:"(300A,00EA)",vr:"DS",name:"CompensatorPosition",vm:"2",version:"DICOM"},"(300A,00EB)":{tag:"(300A,00EB)",vr:"DS",name:"CompensatorTransmissionData",vm:"1-n",version:"DICOM"},"(300A,00EC)":{tag:"(300A,00EC)",vr:"DS",name:"CompensatorThicknessData",vm:"1-n",version:"DICOM"},"(300A,00ED)":{tag:"(300A,00ED)",vr:"IS",name:"NumberOfBoli",vm:"1",version:"DICOM"},"(300A,00EE)":{tag:"(300A,00EE)",vr:"CS",name:"CompensatorType",vm:"1",version:"DICOM"},"(300A,00EF)":{tag:"(300A,00EF)",vr:"SH",name:"CompensatorTrayID",vm:"1",version:"DICOM"},"(300A,00F0)":{tag:"(300A,00F0)",vr:"IS",name:"NumberOfBlocks",vm:"1",version:"DICOM"},"(300A,00F2)":{tag:"(300A,00F2)",vr:"DS",name:"TotalBlockTrayFactor",vm:"1",version:"DICOM"},"(300A,00F3)":{tag:"(300A,00F3)",vr:"FL",name:"TotalBlockTrayWaterEquivalentThickness",vm:"1",version:"DICOM"},"(300A,00F4)":{tag:"(300A,00F4)",vr:"SQ",name:"BlockSequence",vm:"1",version:"DICOM"},"(300A,00F5)":{tag:"(300A,00F5)",vr:"SH",name:"BlockTrayID",vm:"1",version:"DICOM"},"(300A,00F6)":{tag:"(300A,00F6)",vr:"DS",name:"SourceToBlockTrayDistance",vm:"1",version:"DICOM"},"(300A,00F7)":{tag:"(300A,00F7)",vr:"FL",name:"IsocenterToBlockTrayDistance",vm:"1",version:"DICOM"},"(300A,00F8)":{tag:"(300A,00F8)",vr:"CS",name:"BlockType",vm:"1",version:"DICOM"},"(300A,00F9)":{tag:"(300A,00F9)",vr:"LO",name:"AccessoryCode",vm:"1",version:"DICOM"},"(300A,00FA)":{tag:"(300A,00FA)",vr:"CS",name:"BlockDivergence",vm:"1",version:"DICOM"},"(300A,00FB)":{tag:"(300A,00FB)",vr:"CS",name:"BlockMountingPosition",vm:"1",version:"DICOM"},"(300A,00FC)":{tag:"(300A,00FC)",vr:"IS",name:"BlockNumber",vm:"1",version:"DICOM"},"(300A,00FE)":{tag:"(300A,00FE)",vr:"LO",name:"BlockName",vm:"1",version:"DICOM"},"(300A,0100)":{tag:"(300A,0100)",vr:"DS",name:"BlockThickness",vm:"1",version:"DICOM"},"(300A,0102)":{tag:"(300A,0102)",vr:"DS",name:"BlockTransmission",vm:"1",version:"DICOM"},"(300A,0104)":{tag:"(300A,0104)",vr:"IS",name:"BlockNumberOfPoints",vm:"1",version:"DICOM"},"(300A,0106)":{tag:"(300A,0106)",vr:"DS",name:"BlockData",vm:"2-2n",version:"DICOM"},"(300A,0107)":{tag:"(300A,0107)",vr:"SQ",name:"ApplicatorSequence",vm:"1",version:"DICOM"},"(300A,0108)":{tag:"(300A,0108)",vr:"SH",name:"ApplicatorID",vm:"1",version:"DICOM"},"(300A,0109)":{tag:"(300A,0109)",vr:"CS",name:"ApplicatorType",vm:"1",version:"DICOM"},"(300A,010A)":{tag:"(300A,010A)",vr:"LO",name:"ApplicatorDescription",vm:"1",version:"DICOM"},"(300A,010C)":{tag:"(300A,010C)",vr:"DS",name:"CumulativeDoseReferenceCoefficient",vm:"1",version:"DICOM"},"(300A,010E)":{tag:"(300A,010E)",vr:"DS",name:"FinalCumulativeMetersetWeight",vm:"1",version:"DICOM"},"(300A,0110)":{tag:"(300A,0110)",vr:"IS",name:"NumberOfControlPoints",vm:"1",version:"DICOM"},"(300A,0111)":{tag:"(300A,0111)",vr:"SQ",name:"ControlPointSequence",vm:"1",version:"DICOM"},"(300A,0112)":{tag:"(300A,0112)",vr:"IS",name:"ControlPointIndex",vm:"1",version:"DICOM"},"(300A,0114)":{tag:"(300A,0114)",vr:"DS",name:"NominalBeamEnergy",vm:"1",version:"DICOM"},"(300A,0115)":{tag:"(300A,0115)",vr:"DS",name:"DoseRateSet",vm:"1",version:"DICOM"},"(300A,0116)":{tag:"(300A,0116)",vr:"SQ",name:"WedgePositionSequence",vm:"1",version:"DICOM"},"(300A,0118)":{tag:"(300A,0118)",vr:"CS",name:"WedgePosition",vm:"1",version:"DICOM"},"(300A,011A)":{tag:"(300A,011A)",vr:"SQ",name:"BeamLimitingDevicePositionSequence",vm:"1",version:"DICOM"},"(300A,011C)":{tag:"(300A,011C)",vr:"DS",name:"LeafJawPositions",vm:"2-2n",version:"DICOM"},"(300A,011E)":{tag:"(300A,011E)",vr:"DS",name:"GantryAngle",vm:"1",version:"DICOM"},"(300A,011F)":{tag:"(300A,011F)",vr:"CS",name:"GantryRotationDirection",vm:"1",version:"DICOM"},"(300A,0120)":{tag:"(300A,0120)",vr:"DS",name:"BeamLimitingDeviceAngle",vm:"1",version:"DICOM"},"(300A,0121)":{tag:"(300A,0121)",vr:"CS",name:"BeamLimitingDeviceRotationDirection",vm:"1",version:"DICOM"},"(300A,0122)":{tag:"(300A,0122)",vr:"DS",name:"PatientSupportAngle",vm:"1",version:"DICOM"},"(300A,0123)":{tag:"(300A,0123)",vr:"CS",name:"PatientSupportRotationDirection",vm:"1",version:"DICOM"},"(300A,0124)":{tag:"(300A,0124)",vr:"DS",name:"TableTopEccentricAxisDistance",vm:"1",version:"DICOM"},"(300A,0125)":{tag:"(300A,0125)",vr:"DS",name:"TableTopEccentricAngle",vm:"1",version:"DICOM"},"(300A,0126)":{tag:"(300A,0126)",vr:"CS",name:"TableTopEccentricRotationDirection",vm:"1",version:"DICOM"},"(300A,0128)":{tag:"(300A,0128)",vr:"DS",name:"TableTopVerticalPosition",vm:"1",version:"DICOM"},"(300A,0129)":{tag:"(300A,0129)",vr:"DS",name:"TableTopLongitudinalPosition",vm:"1",version:"DICOM"},"(300A,012A)":{tag:"(300A,012A)",vr:"DS",name:"TableTopLateralPosition",vm:"1",version:"DICOM"},"(300A,012C)":{tag:"(300A,012C)",vr:"DS",name:"IsocenterPosition",vm:"3",version:"DICOM"},"(300A,012E)":{tag:"(300A,012E)",vr:"DS",name:"SurfaceEntryPoint",vm:"3",version:"DICOM"},"(300A,0130)":{tag:"(300A,0130)",vr:"DS",name:"SourceToSurfaceDistance",vm:"1",version:"DICOM"},"(300A,0131)":{tag:"(300A,0131)",vr:"FL",name:"AverageBeamDosePointSourceToExternalContourSurfaceDistance",vm:"1",version:"DICOM"},"(300A,0132)":{tag:"(300A,0132)",vr:"FL",name:"SourceToExternalContourDistance",vm:"1",version:"DICOM"},"(300A,0133)":{tag:"(300A,0133)",vr:"FL",name:"ExternalContourEntryPoint",vm:"3",version:"DICOM"},"(300A,0134)":{tag:"(300A,0134)",vr:"DS",name:"CumulativeMetersetWeight",vm:"1",version:"DICOM"},"(300A,0140)":{tag:"(300A,0140)",vr:"FL",name:"TableTopPitchAngle",vm:"1",version:"DICOM"},"(300A,0142)":{tag:"(300A,0142)",vr:"CS",name:"TableTopPitchRotationDirection",vm:"1",version:"DICOM"},"(300A,0144)":{tag:"(300A,0144)",vr:"FL",name:"TableTopRollAngle",vm:"1",version:"DICOM"},"(300A,0146)":{tag:"(300A,0146)",vr:"CS",name:"TableTopRollRotationDirection",vm:"1",version:"DICOM"},"(300A,0148)":{tag:"(300A,0148)",vr:"FL",name:"HeadFixationAngle",vm:"1",version:"DICOM"},"(300A,014A)":{tag:"(300A,014A)",vr:"FL",name:"GantryPitchAngle",vm:"1",version:"DICOM"},"(300A,014C)":{tag:"(300A,014C)",vr:"CS",name:"GantryPitchRotationDirection",vm:"1",version:"DICOM"},"(300A,014E)":{tag:"(300A,014E)",vr:"FL",name:"GantryPitchAngleTolerance",vm:"1",version:"DICOM"},"(300A,0180)":{tag:"(300A,0180)",vr:"SQ",name:"PatientSetupSequence",vm:"1",version:"DICOM"},"(300A,0182)":{tag:"(300A,0182)",vr:"IS",name:"PatientSetupNumber",vm:"1",version:"DICOM"},"(300A,0183)":{tag:"(300A,0183)",vr:"LO",name:"PatientSetupLabel",vm:"1",version:"DICOM"},"(300A,0184)":{tag:"(300A,0184)",vr:"LO",name:"PatientAdditionalPosition",vm:"1",version:"DICOM"},"(300A,0190)":{tag:"(300A,0190)",vr:"SQ",name:"FixationDeviceSequence",vm:"1",version:"DICOM"},"(300A,0192)":{tag:"(300A,0192)",vr:"CS",name:"FixationDeviceType",vm:"1",version:"DICOM"},"(300A,0194)":{tag:"(300A,0194)",vr:"SH",name:"FixationDeviceLabel",vm:"1",version:"DICOM"},"(300A,0196)":{tag:"(300A,0196)",vr:"ST",name:"FixationDeviceDescription",vm:"1",version:"DICOM"},"(300A,0198)":{tag:"(300A,0198)",vr:"SH",name:"FixationDevicePosition",vm:"1",version:"DICOM"},"(300A,0199)":{tag:"(300A,0199)",vr:"FL",name:"FixationDevicePitchAngle",vm:"1",version:"DICOM"},"(300A,019A)":{tag:"(300A,019A)",vr:"FL",name:"FixationDeviceRollAngle",vm:"1",version:"DICOM"},"(300A,01A0)":{tag:"(300A,01A0)",vr:"SQ",name:"ShieldingDeviceSequence",vm:"1",version:"DICOM"},"(300A,01A2)":{tag:"(300A,01A2)",vr:"CS",name:"ShieldingDeviceType",vm:"1",version:"DICOM"},"(300A,01A4)":{tag:"(300A,01A4)",vr:"SH",name:"ShieldingDeviceLabel",vm:"1",version:"DICOM"},"(300A,01A6)":{tag:"(300A,01A6)",vr:"ST",name:"ShieldingDeviceDescription",vm:"1",version:"DICOM"},"(300A,01A8)":{tag:"(300A,01A8)",vr:"SH",name:"ShieldingDevicePosition",vm:"1",version:"DICOM"},"(300A,01B0)":{tag:"(300A,01B0)",vr:"CS",name:"SetupTechnique",vm:"1",version:"DICOM"},"(300A,01B2)":{tag:"(300A,01B2)",vr:"ST",name:"SetupTechniqueDescription",vm:"1",version:"DICOM"},"(300A,01B4)":{tag:"(300A,01B4)",vr:"SQ",name:"SetupDeviceSequence",vm:"1",version:"DICOM"},"(300A,01B6)":{tag:"(300A,01B6)",vr:"CS",name:"SetupDeviceType",vm:"1",version:"DICOM"},"(300A,01B8)":{tag:"(300A,01B8)",vr:"SH",name:"SetupDeviceLabel",vm:"1",version:"DICOM"},"(300A,01BA)":{tag:"(300A,01BA)",vr:"ST",name:"SetupDeviceDescription",vm:"1",version:"DICOM"},"(300A,01BC)":{tag:"(300A,01BC)",vr:"DS",name:"SetupDeviceParameter",vm:"1",version:"DICOM"},"(300A,01D0)":{tag:"(300A,01D0)",vr:"ST",name:"SetupReferenceDescription",vm:"1",version:"DICOM"},"(300A,01D2)":{tag:"(300A,01D2)",vr:"DS",name:"TableTopVerticalSetupDisplacement",vm:"1",version:"DICOM"},"(300A,01D4)":{tag:"(300A,01D4)",vr:"DS",name:"TableTopLongitudinalSetupDisplacement",vm:"1",version:"DICOM"},"(300A,01D6)":{tag:"(300A,01D6)",vr:"DS",name:"TableTopLateralSetupDisplacement",vm:"1",version:"DICOM"},"(300A,0200)":{tag:"(300A,0200)",vr:"CS",name:"BrachyTreatmentTechnique",vm:"1",version:"DICOM"},"(300A,0202)":{tag:"(300A,0202)",vr:"CS",name:"BrachyTreatmentType",vm:"1",version:"DICOM"},"(300A,0206)":{tag:"(300A,0206)",vr:"SQ",name:"TreatmentMachineSequence",vm:"1",version:"DICOM"},"(300A,0210)":{tag:"(300A,0210)",vr:"SQ",name:"SourceSequence",vm:"1",version:"DICOM"},"(300A,0212)":{tag:"(300A,0212)",vr:"IS",name:"SourceNumber",vm:"1",version:"DICOM"},"(300A,0214)":{tag:"(300A,0214)",vr:"CS",name:"SourceType",vm:"1",version:"DICOM"},"(300A,0216)":{tag:"(300A,0216)",vr:"LO",name:"SourceManufacturer",vm:"1",version:"DICOM"},"(300A,0218)":{tag:"(300A,0218)",vr:"DS",name:"ActiveSourceDiameter",vm:"1",version:"DICOM"},"(300A,021A)":{tag:"(300A,021A)",vr:"DS",name:"ActiveSourceLength",vm:"1",version:"DICOM"},"(300A,021B)":{tag:"(300A,021B)",vr:"SH",name:"SourceModelID",vm:"1",version:"DICOM"},"(300A,021C)":{tag:"(300A,021C)",vr:"LO",name:"SourceDescription",vm:"1",version:"DICOM"},"(300A,0222)":{tag:"(300A,0222)",vr:"DS",name:"SourceEncapsulationNominalThickness",vm:"1",version:"DICOM"},"(300A,0224)":{tag:"(300A,0224)",vr:"DS",name:"SourceEncapsulationNominalTransmission",vm:"1",version:"DICOM"},"(300A,0226)":{tag:"(300A,0226)",vr:"LO",name:"SourceIsotopeName",vm:"1",version:"DICOM"},"(300A,0228)":{tag:"(300A,0228)",vr:"DS",name:"SourceIsotopeHalfLife",vm:"1",version:"DICOM"},"(300A,0229)":{tag:"(300A,0229)",vr:"CS",name:"SourceStrengthUnits",vm:"1",version:"DICOM"},"(300A,022A)":{tag:"(300A,022A)",vr:"DS",name:"ReferenceAirKermaRate",vm:"1",version:"DICOM"},"(300A,022B)":{tag:"(300A,022B)",vr:"DS",name:"SourceStrength",vm:"1",version:"DICOM"},"(300A,022C)":{tag:"(300A,022C)",vr:"DA",name:"SourceStrengthReferenceDate",vm:"1",version:"DICOM"},"(300A,022E)":{tag:"(300A,022E)",vr:"TM",name:"SourceStrengthReferenceTime",vm:"1",version:"DICOM"},"(300A,0230)":{tag:"(300A,0230)",vr:"SQ",name:"ApplicationSetupSequence",vm:"1",version:"DICOM"},"(300A,0232)":{tag:"(300A,0232)",vr:"CS",name:"ApplicationSetupType",vm:"1",version:"DICOM"},"(300A,0234)":{tag:"(300A,0234)",vr:"IS",name:"ApplicationSetupNumber",vm:"1",version:"DICOM"},"(300A,0236)":{tag:"(300A,0236)",vr:"LO",name:"ApplicationSetupName",vm:"1",version:"DICOM"},"(300A,0238)":{tag:"(300A,0238)",vr:"LO",name:"ApplicationSetupManufacturer",vm:"1",version:"DICOM"},"(300A,0240)":{tag:"(300A,0240)",vr:"IS",name:"TemplateNumber",vm:"1",version:"DICOM"},"(300A,0242)":{tag:"(300A,0242)",vr:"SH",name:"TemplateType",vm:"1",version:"DICOM"},"(300A,0244)":{tag:"(300A,0244)",vr:"LO",name:"TemplateName",vm:"1",version:"DICOM"},"(300A,0250)":{tag:"(300A,0250)",vr:"DS",name:"TotalReferenceAirKerma",vm:"1",version:"DICOM"},"(300A,0260)":{tag:"(300A,0260)",vr:"SQ",name:"BrachyAccessoryDeviceSequence",vm:"1",version:"DICOM"},"(300A,0262)":{tag:"(300A,0262)",vr:"IS",name:"BrachyAccessoryDeviceNumber",vm:"1",version:"DICOM"},"(300A,0263)":{tag:"(300A,0263)",vr:"SH",name:"BrachyAccessoryDeviceID",vm:"1",version:"DICOM"},"(300A,0264)":{tag:"(300A,0264)",vr:"CS",name:"BrachyAccessoryDeviceType",vm:"1",version:"DICOM"},"(300A,0266)":{tag:"(300A,0266)",vr:"LO",name:"BrachyAccessoryDeviceName",vm:"1",version:"DICOM"},"(300A,026A)":{tag:"(300A,026A)",vr:"DS",name:"BrachyAccessoryDeviceNominalThickness",vm:"1",version:"DICOM"},"(300A,026C)":{tag:"(300A,026C)",vr:"DS",name:"BrachyAccessoryDeviceNominalTransmission",vm:"1",version:"DICOM"},"(300A,0280)":{tag:"(300A,0280)",vr:"SQ",name:"ChannelSequence",vm:"1",version:"DICOM"},"(300A,0282)":{tag:"(300A,0282)",vr:"IS",name:"ChannelNumber",vm:"1",version:"DICOM"},"(300A,0284)":{tag:"(300A,0284)",vr:"DS",name:"ChannelLength",vm:"1",version:"DICOM"},"(300A,0286)":{tag:"(300A,0286)",vr:"DS",name:"ChannelTotalTime",vm:"1",version:"DICOM"},"(300A,0288)":{tag:"(300A,0288)",vr:"CS",name:"SourceMovementType",vm:"1",version:"DICOM"},"(300A,028A)":{tag:"(300A,028A)",vr:"IS",name:"NumberOfPulses",vm:"1",version:"DICOM"},"(300A,028C)":{tag:"(300A,028C)",vr:"DS",name:"PulseRepetitionInterval",vm:"1",version:"DICOM"},"(300A,0290)":{tag:"(300A,0290)",vr:"IS",name:"SourceApplicatorNumber",vm:"1",version:"DICOM"},"(300A,0291)":{tag:"(300A,0291)",vr:"SH",name:"SourceApplicatorID",vm:"1",version:"DICOM"},"(300A,0292)":{tag:"(300A,0292)",vr:"CS",name:"SourceApplicatorType",vm:"1",version:"DICOM"},"(300A,0294)":{tag:"(300A,0294)",vr:"LO",name:"SourceApplicatorName",vm:"1",version:"DICOM"},"(300A,0296)":{tag:"(300A,0296)",vr:"DS",name:"SourceApplicatorLength",vm:"1",version:"DICOM"},"(300A,0298)":{tag:"(300A,0298)",vr:"LO",name:"SourceApplicatorManufacturer",vm:"1",version:"DICOM"},"(300A,029C)":{tag:"(300A,029C)",vr:"DS",name:"SourceApplicatorWallNominalThickness",vm:"1",version:"DICOM"},"(300A,029E)":{tag:"(300A,029E)",vr:"DS",name:"SourceApplicatorWallNominalTransmission",vm:"1",version:"DICOM"},"(300A,02A0)":{tag:"(300A,02A0)",vr:"DS",name:"SourceApplicatorStepSize",vm:"1",version:"DICOM"},"(300A,02A2)":{tag:"(300A,02A2)",vr:"IS",name:"TransferTubeNumber",vm:"1",version:"DICOM"},"(300A,02A4)":{tag:"(300A,02A4)",vr:"DS",name:"TransferTubeLength",vm:"1",version:"DICOM"},"(300A,02B0)":{tag:"(300A,02B0)",vr:"SQ",name:"ChannelShieldSequence",vm:"1",version:"DICOM"},"(300A,02B2)":{tag:"(300A,02B2)",vr:"IS",name:"ChannelShieldNumber",vm:"1",version:"DICOM"},"(300A,02B3)":{tag:"(300A,02B3)",vr:"SH",name:"ChannelShieldID",vm:"1",version:"DICOM"},"(300A,02B4)":{tag:"(300A,02B4)",vr:"LO",name:"ChannelShieldName",vm:"1",version:"DICOM"},"(300A,02B8)":{tag:"(300A,02B8)",vr:"DS",name:"ChannelShieldNominalThickness",vm:"1",version:"DICOM"},"(300A,02BA)":{tag:"(300A,02BA)",vr:"DS",name:"ChannelShieldNominalTransmission",vm:"1",version:"DICOM"},"(300A,02C8)":{tag:"(300A,02C8)",vr:"DS",name:"FinalCumulativeTimeWeight",vm:"1",version:"DICOM"},"(300A,02D0)":{tag:"(300A,02D0)",vr:"SQ",name:"BrachyControlPointSequence",vm:"1",version:"DICOM"},"(300A,02D2)":{tag:"(300A,02D2)",vr:"DS",name:"ControlPointRelativePosition",vm:"1",version:"DICOM"},"(300A,02D4)":{tag:"(300A,02D4)",vr:"DS",name:"ControlPoint3DPosition",vm:"3",version:"DICOM"},"(300A,02D6)":{tag:"(300A,02D6)",vr:"DS",name:"CumulativeTimeWeight",vm:"1",version:"DICOM"},"(300A,02E0)":{tag:"(300A,02E0)",vr:"CS",name:"CompensatorDivergence",vm:"1",version:"DICOM"},"(300A,02E1)":{tag:"(300A,02E1)",vr:"CS",name:"CompensatorMountingPosition",vm:"1",version:"DICOM"},"(300A,02E2)":{tag:"(300A,02E2)",vr:"DS",name:"SourceToCompensatorDistance",vm:"1-n",version:"DICOM"},"(300A,02E3)":{tag:"(300A,02E3)",vr:"FL",name:"TotalCompensatorTrayWaterEquivalentThickness",vm:"1",version:"DICOM"},"(300A,02E4)":{tag:"(300A,02E4)",vr:"FL",name:"IsocenterToCompensatorTrayDistance",vm:"1",version:"DICOM"},"(300A,02E5)":{tag:"(300A,02E5)",vr:"FL",name:"CompensatorColumnOffset",vm:"1",version:"DICOM"},"(300A,02E6)":{tag:"(300A,02E6)",vr:"FL",name:"IsocenterToCompensatorDistances",vm:"1-n",version:"DICOM"},"(300A,02E7)":{tag:"(300A,02E7)",vr:"FL",name:"CompensatorRelativeStoppingPowerRatio",vm:"1",version:"DICOM"},"(300A,02E8)":{tag:"(300A,02E8)",vr:"FL",name:"CompensatorMillingToolDiameter",vm:"1",version:"DICOM"},"(300A,02EA)":{tag:"(300A,02EA)",vr:"SQ",name:"IonRangeCompensatorSequence",vm:"1",version:"DICOM"},"(300A,02EB)":{tag:"(300A,02EB)",vr:"LT",name:"CompensatorDescription",vm:"1",version:"DICOM"},"(300A,0302)":{tag:"(300A,0302)",vr:"IS",name:"RadiationMassNumber",vm:"1",version:"DICOM"},"(300A,0304)":{tag:"(300A,0304)",vr:"IS",name:"RadiationAtomicNumber",vm:"1",version:"DICOM"},"(300A,0306)":{tag:"(300A,0306)",vr:"SS",name:"RadiationChargeState",vm:"1",version:"DICOM"},"(300A,0308)":{tag:"(300A,0308)",vr:"CS",name:"ScanMode",vm:"1",version:"DICOM"},"(300A,030A)":{tag:"(300A,030A)",vr:"FL",name:"VirtualSourceAxisDistances",vm:"2",version:"DICOM"},"(300A,030C)":{tag:"(300A,030C)",vr:"SQ",name:"SnoutSequence",vm:"1",version:"DICOM"},"(300A,030D)":{tag:"(300A,030D)",vr:"FL",name:"SnoutPosition",vm:"1",version:"DICOM"},"(300A,030F)":{tag:"(300A,030F)",vr:"SH",name:"SnoutID",vm:"1",version:"DICOM"},"(300A,0312)":{tag:"(300A,0312)",vr:"IS",name:"NumberOfRangeShifters",vm:"1",version:"DICOM"},"(300A,0314)":{tag:"(300A,0314)",vr:"SQ",name:"RangeShifterSequence",vm:"1",version:"DICOM"},"(300A,0316)":{tag:"(300A,0316)",vr:"IS",name:"RangeShifterNumber",vm:"1",version:"DICOM"},"(300A,0318)":{tag:"(300A,0318)",vr:"SH",name:"RangeShifterID",vm:"1",version:"DICOM"},"(300A,0320)":{tag:"(300A,0320)",vr:"CS",name:"RangeShifterType",vm:"1",version:"DICOM"},"(300A,0322)":{tag:"(300A,0322)",vr:"LO",name:"RangeShifterDescription",vm:"1",version:"DICOM"},"(300A,0330)":{tag:"(300A,0330)",vr:"IS",name:"NumberOfLateralSpreadingDevices",vm:"1",version:"DICOM"},"(300A,0332)":{tag:"(300A,0332)",vr:"SQ",name:"LateralSpreadingDeviceSequence",vm:"1",version:"DICOM"},"(300A,0334)":{tag:"(300A,0334)",vr:"IS",name:"LateralSpreadingDeviceNumber",vm:"1",version:"DICOM"},"(300A,0336)":{tag:"(300A,0336)",vr:"SH",name:"LateralSpreadingDeviceID",vm:"1",version:"DICOM"},"(300A,0338)":{tag:"(300A,0338)",vr:"CS",name:"LateralSpreadingDeviceType",vm:"1",version:"DICOM"},"(300A,033A)":{tag:"(300A,033A)",vr:"LO",name:"LateralSpreadingDeviceDescription",vm:"1",version:"DICOM"},"(300A,033C)":{tag:"(300A,033C)",vr:"FL",name:"LateralSpreadingDeviceWaterEquivalentThickness",vm:"1",version:"DICOM"},"(300A,0340)":{tag:"(300A,0340)",vr:"IS",name:"NumberOfRangeModulators",vm:"1",version:"DICOM"},"(300A,0342)":{tag:"(300A,0342)",vr:"SQ",name:"RangeModulatorSequence",vm:"1",version:"DICOM"},"(300A,0344)":{tag:"(300A,0344)",vr:"IS",name:"RangeModulatorNumber",vm:"1",version:"DICOM"},"(300A,0346)":{tag:"(300A,0346)",vr:"SH",name:"RangeModulatorID",vm:"1",version:"DICOM"},"(300A,0348)":{tag:"(300A,0348)",vr:"CS",name:"RangeModulatorType",vm:"1",version:"DICOM"},"(300A,034A)":{tag:"(300A,034A)",vr:"LO",name:"RangeModulatorDescription",vm:"1",version:"DICOM"},"(300A,034C)":{tag:"(300A,034C)",vr:"SH",name:"BeamCurrentModulationID",vm:"1",version:"DICOM"},"(300A,0350)":{tag:"(300A,0350)",vr:"CS",name:"PatientSupportType",vm:"1",version:"DICOM"},"(300A,0352)":{tag:"(300A,0352)",vr:"SH",name:"PatientSupportID",vm:"1",version:"DICOM"},"(300A,0354)":{tag:"(300A,0354)",vr:"LO",name:"PatientSupportAccessoryCode",vm:"1",version:"DICOM"},"(300A,0356)":{tag:"(300A,0356)",vr:"FL",name:"FixationLightAzimuthalAngle",vm:"1",version:"DICOM"},"(300A,0358)":{tag:"(300A,0358)",vr:"FL",name:"FixationLightPolarAngle",vm:"1",version:"DICOM"},"(300A,035A)":{tag:"(300A,035A)",vr:"FL",name:"MetersetRate",vm:"1",version:"DICOM"},"(300A,0360)":{tag:"(300A,0360)",vr:"SQ",name:"RangeShifterSettingsSequence",vm:"1",version:"DICOM"},"(300A,0362)":{tag:"(300A,0362)",vr:"LO",name:"RangeShifterSetting",vm:"1",version:"DICOM"},"(300A,0364)":{tag:"(300A,0364)",vr:"FL",name:"IsocenterToRangeShifterDistance",vm:"1",version:"DICOM"},"(300A,0366)":{tag:"(300A,0366)",vr:"FL",name:"RangeShifterWaterEquivalentThickness",vm:"1",version:"DICOM"},"(300A,0370)":{tag:"(300A,0370)",vr:"SQ",name:"LateralSpreadingDeviceSettingsSequence",vm:"1",version:"DICOM"},"(300A,0372)":{tag:"(300A,0372)",vr:"LO",name:"LateralSpreadingDeviceSetting",vm:"1",version:"DICOM"},"(300A,0374)":{tag:"(300A,0374)",vr:"FL",name:"IsocenterToLateralSpreadingDeviceDistance",vm:"1",version:"DICOM"},"(300A,0380)":{tag:"(300A,0380)",vr:"SQ",name:"RangeModulatorSettingsSequence",vm:"1",version:"DICOM"},"(300A,0382)":{tag:"(300A,0382)",vr:"FL",name:"RangeModulatorGatingStartValue",vm:"1",version:"DICOM"},"(300A,0384)":{tag:"(300A,0384)",vr:"FL",name:"RangeModulatorGatingStopValue",vm:"1",version:"DICOM"},"(300A,0386)":{tag:"(300A,0386)",vr:"FL",name:"RangeModulatorGatingStartWaterEquivalentThickness",vm:"1",version:"DICOM"},"(300A,0388)":{tag:"(300A,0388)",vr:"FL",name:"RangeModulatorGatingStopWaterEquivalentThickness",vm:"1",version:"DICOM"},"(300A,038A)":{tag:"(300A,038A)",vr:"FL",name:"IsocenterToRangeModulatorDistance",vm:"1",version:"DICOM"},"(300A,0390)":{tag:"(300A,0390)",vr:"SH",name:"ScanSpotTuneID",vm:"1",version:"DICOM"},"(300A,0392)":{tag:"(300A,0392)",vr:"IS",name:"NumberOfScanSpotPositions",vm:"1",version:"DICOM"},"(300A,0394)":{tag:"(300A,0394)",vr:"FL",name:"ScanSpotPositionMap",vm:"1-n",version:"DICOM"},"(300A,0396)":{tag:"(300A,0396)",vr:"FL",name:"ScanSpotMetersetWeights",vm:"1-n",version:"DICOM"},"(300A,0398)":{tag:"(300A,0398)",vr:"FL",name:"ScanningSpotSize",vm:"2",version:"DICOM"},"(300A,039A)":{tag:"(300A,039A)",vr:"IS",name:"NumberOfPaintings",vm:"1",version:"DICOM"},"(300A,03A0)":{tag:"(300A,03A0)",vr:"SQ",name:"IonToleranceTableSequence",vm:"1",version:"DICOM"},"(300A,03A2)":{tag:"(300A,03A2)",vr:"SQ",name:"IonBeamSequence",vm:"1",version:"DICOM"},"(300A,03A4)":{tag:"(300A,03A4)",vr:"SQ",name:"IonBeamLimitingDeviceSequence",vm:"1",version:"DICOM"},"(300A,03A6)":{tag:"(300A,03A6)",vr:"SQ",name:"IonBlockSequence",vm:"1",version:"DICOM"},"(300A,03A8)":{tag:"(300A,03A8)",vr:"SQ",name:"IonControlPointSequence",vm:"1",version:"DICOM"},"(300A,03AA)":{tag:"(300A,03AA)",vr:"SQ",name:"IonWedgeSequence",vm:"1",version:"DICOM"},"(300A,03AC)":{tag:"(300A,03AC)",vr:"SQ",name:"IonWedgePositionSequence",vm:"1",version:"DICOM"},"(300A,0401)":{tag:"(300A,0401)",vr:"SQ",name:"ReferencedSetupImageSequence",vm:"1",version:"DICOM"},"(300A,0402)":{tag:"(300A,0402)",vr:"ST",name:"SetupImageComment",vm:"1",version:"DICOM"},"(300A,0410)":{tag:"(300A,0410)",vr:"SQ",name:"MotionSynchronizationSequence",vm:"1",version:"DICOM"},"(300A,0412)":{tag:"(300A,0412)",vr:"FL",name:"ControlPointOrientation",vm:"3",version:"DICOM"},"(300A,0420)":{tag:"(300A,0420)",vr:"SQ",name:"GeneralAccessorySequence",vm:"1",version:"DICOM"},"(300A,0421)":{tag:"(300A,0421)",vr:"SH",name:"GeneralAccessoryID",vm:"1",version:"DICOM"},"(300A,0422)":{tag:"(300A,0422)",vr:"ST",name:"GeneralAccessoryDescription",vm:"1",version:"DICOM"},"(300A,0423)":{tag:"(300A,0423)",vr:"CS",name:"GeneralAccessoryType",vm:"1",version:"DICOM"},"(300A,0424)":{tag:"(300A,0424)",vr:"IS",name:"GeneralAccessoryNumber",vm:"1",version:"DICOM"},"(300A,0425)":{tag:"(300A,0425)",vr:"FL",name:"SourceToGeneralAccessoryDistance",vm:"1",version:"DICOM"},"(300A,0431)":{tag:"(300A,0431)",vr:"SQ",name:"ApplicatorGeometrySequence",vm:"1",version:"DICOM"},"(300A,0432)":{tag:"(300A,0432)",vr:"CS",name:"ApplicatorApertureShape",vm:"1",version:"DICOM"},"(300A,0433)":{tag:"(300A,0433)",vr:"FL",name:"ApplicatorOpening",vm:"1",version:"DICOM"},"(300A,0434)":{tag:"(300A,0434)",vr:"FL",name:"ApplicatorOpeningX",vm:"1",version:"DICOM"},"(300A,0435)":{tag:"(300A,0435)",vr:"FL",name:"ApplicatorOpeningY",vm:"1",version:"DICOM"},"(300A,0436)":{tag:"(300A,0436)",vr:"FL",name:"SourceToApplicatorMountingPositionDistance",vm:"1",version:"DICOM"},"(300A,0440)":{tag:"(300A,0440)",vr:"IS",name:"NumberOfBlockSlabItems",vm:"1",version:"DICOM"},"(300A,0441)":{tag:"(300A,0441)",vr:"SQ",name:"BlockSlabSequence",vm:"1",version:"DICOM"},"(300A,0442)":{tag:"(300A,0442)",vr:"DS",name:"BlockSlabThickness",vm:"1",version:"DICOM"},"(300A,0443)":{tag:"(300A,0443)",vr:"US",name:"BlockSlabNumber",vm:"1",version:"DICOM"},"(300A,0450)":{tag:"(300A,0450)",vr:"SQ",name:"DeviceMotionControlSequence",vm:"1",version:"DICOM"},"(300A,0451)":{tag:"(300A,0451)",vr:"CS",name:"DeviceMotionExecutionMode",vm:"1",version:"DICOM"},"(300A,0452)":{tag:"(300A,0452)",vr:"CS",name:"DeviceMotionObservationMode",vm:"1",version:"DICOM"},"(300A,0453)":{tag:"(300A,0453)",vr:"SQ",name:"DeviceMotionParameterCodeSequence",vm:"1",version:"DICOM"},"(300C,0002)":{tag:"(300C,0002)",vr:"SQ",name:"ReferencedRTPlanSequence",vm:"1",version:"DICOM"},"(300C,0004)":{tag:"(300C,0004)",vr:"SQ",name:"ReferencedBeamSequence",vm:"1",version:"DICOM"},"(300C,0006)":{tag:"(300C,0006)",vr:"IS",name:"ReferencedBeamNumber",vm:"1",version:"DICOM"},"(300C,0007)":{tag:"(300C,0007)",vr:"IS",name:"ReferencedReferenceImageNumber",vm:"1",version:"DICOM"},"(300C,0008)":{tag:"(300C,0008)",vr:"DS",name:"StartCumulativeMetersetWeight",vm:"1",version:"DICOM"},"(300C,0009)":{tag:"(300C,0009)",vr:"DS",name:"EndCumulativeMetersetWeight",vm:"1",version:"DICOM"},"(300C,000A)":{tag:"(300C,000A)",vr:"SQ",name:"ReferencedBrachyApplicationSetupSequence",vm:"1",version:"DICOM"},"(300C,000C)":{tag:"(300C,000C)",vr:"IS",name:"ReferencedBrachyApplicationSetupNumber",vm:"1",version:"DICOM"},"(300C,000E)":{tag:"(300C,000E)",vr:"IS",name:"ReferencedSourceNumber",vm:"1",version:"DICOM"},"(300C,0020)":{tag:"(300C,0020)",vr:"SQ",name:"ReferencedFractionGroupSequence",vm:"1",version:"DICOM"},"(300C,0022)":{tag:"(300C,0022)",vr:"IS",name:"ReferencedFractionGroupNumber",vm:"1",version:"DICOM"},"(300C,0040)":{tag:"(300C,0040)",vr:"SQ",name:"ReferencedVerificationImageSequence",vm:"1",version:"DICOM"},"(300C,0042)":{tag:"(300C,0042)",vr:"SQ",name:"ReferencedReferenceImageSequence",vm:"1",version:"DICOM"},"(300C,0050)":{tag:"(300C,0050)",vr:"SQ",name:"ReferencedDoseReferenceSequence",vm:"1",version:"DICOM"},"(300C,0051)":{tag:"(300C,0051)",vr:"IS",name:"ReferencedDoseReferenceNumber",vm:"1",version:"DICOM"},"(300C,0055)":{tag:"(300C,0055)",vr:"SQ",name:"BrachyReferencedDoseReferenceSequence",vm:"1",version:"DICOM"},"(300C,0060)":{tag:"(300C,0060)",vr:"SQ",name:"ReferencedStructureSetSequence",vm:"1",version:"DICOM"},"(300C,006A)":{tag:"(300C,006A)",vr:"IS",name:"ReferencedPatientSetupNumber",vm:"1",version:"DICOM"},"(300C,0080)":{tag:"(300C,0080)",vr:"SQ",name:"ReferencedDoseSequence",vm:"1",version:"DICOM"},"(300C,00A0)":{tag:"(300C,00A0)",vr:"IS",name:"ReferencedToleranceTableNumber",vm:"1",version:"DICOM"},"(300C,00B0)":{tag:"(300C,00B0)",vr:"SQ",name:"ReferencedBolusSequence",vm:"1",version:"DICOM"},"(300C,00C0)":{tag:"(300C,00C0)",vr:"IS",name:"ReferencedWedgeNumber",vm:"1",version:"DICOM"},"(300C,00D0)":{tag:"(300C,00D0)",vr:"IS",name:"ReferencedCompensatorNumber",vm:"1",version:"DICOM"},"(300C,00E0)":{tag:"(300C,00E0)",vr:"IS",name:"ReferencedBlockNumber",vm:"1",version:"DICOM"},"(300C,00F0)":{tag:"(300C,00F0)",vr:"IS",name:"ReferencedControlPointIndex",vm:"1",version:"DICOM"},"(300C,00F2)":{tag:"(300C,00F2)",vr:"SQ",name:"ReferencedControlPointSequence",vm:"1",version:"DICOM"},"(300C,00F4)":{tag:"(300C,00F4)",vr:"IS",name:"ReferencedStartControlPointIndex",vm:"1",version:"DICOM"},"(300C,00F6)":{tag:"(300C,00F6)",vr:"IS",name:"ReferencedStopControlPointIndex",vm:"1",version:"DICOM"},"(300C,0100)":{tag:"(300C,0100)",vr:"IS",name:"ReferencedRangeShifterNumber",vm:"1",version:"DICOM"},"(300C,0102)":{tag:"(300C,0102)",vr:"IS",name:"ReferencedLateralSpreadingDeviceNumber",vm:"1",version:"DICOM"},"(300C,0104)":{tag:"(300C,0104)",vr:"IS",name:"ReferencedRangeModulatorNumber",vm:"1",version:"DICOM"},"(300C,0111)":{tag:"(300C,0111)",vr:"SQ",name:"OmittedBeamTaskSequence",vm:"1",version:"DICOM"},"(300C,0112)":{tag:"(300C,0112)",vr:"CS",name:"ReasonForOmission",vm:"1",version:"DICOM"},"(300C,0113)":{tag:"(300C,0113)",vr:"LO",name:"ReasonForOmissionDescription",vm:"1",version:"DICOM"},"(300E,0002)":{tag:"(300E,0002)",vr:"CS",name:"ApprovalStatus",vm:"1",version:"DICOM"},"(300E,0004)":{tag:"(300E,0004)",vr:"DA",name:"ReviewDate",vm:"1",version:"DICOM"},"(300E,0005)":{tag:"(300E,0005)",vr:"TM",name:"ReviewTime",vm:"1",version:"DICOM"},"(300E,0008)":{tag:"(300E,0008)",vr:"PN",name:"ReviewerName",vm:"1",version:"DICOM"},"(4010,0001)":{tag:"(4010,0001)",vr:"CS",name:"LowEnergyDetectors",vm:"1",version:"DICOM/DICOS"},"(4010,0002)":{tag:"(4010,0002)",vr:"CS",name:"HighEnergyDetectors",vm:"1",version:"DICOM/DICOS"},"(4010,0004)":{tag:"(4010,0004)",vr:"SQ",name:"DetectorGeometrySequence",vm:"1",version:"DICOM/DICOS"},"(4010,1001)":{tag:"(4010,1001)",vr:"SQ",name:"ThreatROIVoxelSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1004)":{tag:"(4010,1004)",vr:"FL",name:"ThreatROIBase",vm:"3",version:"DICOM/DICOS"},"(4010,1005)":{tag:"(4010,1005)",vr:"FL",name:"ThreatROIExtents",vm:"3",version:"DICOM/DICOS"},"(4010,1006)":{tag:"(4010,1006)",vr:"OB",name:"ThreatROIBitmap",vm:"1",version:"DICOM/DICOS"},"(4010,1007)":{tag:"(4010,1007)",vr:"SH",name:"RouteSegmentID",vm:"1",version:"DICOM/DICOS"},"(4010,1008)":{tag:"(4010,1008)",vr:"CS",name:"GantryType",vm:"1",version:"DICOM/DICOS"},"(4010,1009)":{tag:"(4010,1009)",vr:"CS",name:"OOIOwnerType",vm:"1",version:"DICOM/DICOS"},"(4010,100A)":{tag:"(4010,100A)",vr:"SQ",name:"RouteSegmentSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1010)":{tag:"(4010,1010)",vr:"US",name:"PotentialThreatObjectID",vm:"1",version:"DICOM/DICOS"},"(4010,1011)":{tag:"(4010,1011)",vr:"SQ",name:"ThreatSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1012)":{tag:"(4010,1012)",vr:"CS",name:"ThreatCategory",vm:"1",version:"DICOM/DICOS"},"(4010,1013)":{tag:"(4010,1013)",vr:"LT",name:"ThreatCategoryDescription",vm:"1",version:"DICOM/DICOS"},"(4010,1014)":{tag:"(4010,1014)",vr:"CS",name:"ATDAbilityAssessment",vm:"1",version:"DICOM/DICOS"},"(4010,1015)":{tag:"(4010,1015)",vr:"CS",name:"ATDAssessmentFlag",vm:"1",version:"DICOM/DICOS"},"(4010,1016)":{tag:"(4010,1016)",vr:"FL",name:"ATDAssessmentProbability",vm:"1",version:"DICOM/DICOS"},"(4010,1017)":{tag:"(4010,1017)",vr:"FL",name:"Mass",vm:"1",version:"DICOM/DICOS"},"(4010,1018)":{tag:"(4010,1018)",vr:"FL",name:"Density",vm:"1",version:"DICOM/DICOS"},"(4010,1019)":{tag:"(4010,1019)",vr:"FL",name:"ZEffective",vm:"1",version:"DICOM/DICOS"},"(4010,101A)":{tag:"(4010,101A)",vr:"SH",name:"BoardingPassID",vm:"1",version:"DICOM/DICOS"},"(4010,101B)":{tag:"(4010,101B)",vr:"FL",name:"CenterOfMass",vm:"3",version:"DICOM/DICOS"},"(4010,101C)":{tag:"(4010,101C)",vr:"FL",name:"CenterOfPTO",vm:"3",version:"DICOM/DICOS"},"(4010,101D)":{tag:"(4010,101D)",vr:"FL",name:"BoundingPolygon",vm:"6-n",version:"DICOM/DICOS"},"(4010,101E)":{tag:"(4010,101E)",vr:"SH",name:"RouteSegmentStartLocationID",vm:"1",version:"DICOM/DICOS"},"(4010,101F)":{tag:"(4010,101F)",vr:"SH",name:"RouteSegmentEndLocationID",vm:"1",version:"DICOM/DICOS"},"(4010,1020)":{tag:"(4010,1020)",vr:"CS",name:"RouteSegmentLocationIDType",vm:"1",version:"DICOM/DICOS"},"(4010,1021)":{tag:"(4010,1021)",vr:"CS",name:"AbortReason",vm:"1-n",version:"DICOM/DICOS"},"(4010,1023)":{tag:"(4010,1023)",vr:"FL",name:"VolumeOfPTO",vm:"1",version:"DICOM/DICOS"},"(4010,1024)":{tag:"(4010,1024)",vr:"CS",name:"AbortFlag",vm:"1",version:"DICOM/DICOS"},"(4010,1025)":{tag:"(4010,1025)",vr:"DT",name:"RouteSegmentStartTime",vm:"1",version:"DICOM/DICOS"},"(4010,1026)":{tag:"(4010,1026)",vr:"DT",name:"RouteSegmentEndTime",vm:"1",version:"DICOM/DICOS"},"(4010,1027)":{tag:"(4010,1027)",vr:"CS",name:"TDRType",vm:"1",version:"DICOM/DICOS"},"(4010,1028)":{tag:"(4010,1028)",vr:"CS",name:"InternationalRouteSegment",vm:"1",version:"DICOM/DICOS"},"(4010,1029)":{tag:"(4010,1029)",vr:"LO",name:"ThreatDetectionAlgorithmandVersion",vm:"1-n",version:"DICOM/DICOS"},"(4010,102A)":{tag:"(4010,102A)",vr:"SH",name:"AssignedLocation",vm:"1",version:"DICOM/DICOS"},"(4010,102B)":{tag:"(4010,102B)",vr:"DT",name:"AlarmDecisionTime",vm:"1",version:"DICOM/DICOS"},"(4010,1031)":{tag:"(4010,1031)",vr:"CS",name:"AlarmDecision",vm:"1",version:"DICOM/DICOS"},"(4010,1033)":{tag:"(4010,1033)",vr:"US",name:"NumberOfTotalObjects",vm:"1",version:"DICOM/DICOS"},"(4010,1034)":{tag:"(4010,1034)",vr:"US",name:"NumberOfAlarmObjects",vm:"1",version:"DICOM/DICOS"},"(4010,1037)":{tag:"(4010,1037)",vr:"SQ",name:"PTORepresentationSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1038)":{tag:"(4010,1038)",vr:"SQ",name:"ATDAssessmentSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1039)":{tag:"(4010,1039)",vr:"CS",name:"TIPType",vm:"1",version:"DICOM/DICOS"},"(4010,103A)":{tag:"(4010,103A)",vr:"CS",name:"DICOSVersion",vm:"1",version:"DICOM/DICOS"},"(4010,1041)":{tag:"(4010,1041)",vr:"DT",name:"OOIOwnerCreationTime",vm:"1",version:"DICOM/DICOS"},"(4010,1042)":{tag:"(4010,1042)",vr:"CS",name:"OOIType",vm:"1",version:"DICOM/DICOS"},"(4010,1043)":{tag:"(4010,1043)",vr:"FL",name:"OOISize",vm:"3",version:"DICOM/DICOS"},"(4010,1044)":{tag:"(4010,1044)",vr:"CS",name:"AcquisitionStatus",vm:"1",version:"DICOM/DICOS"},"(4010,1045)":{tag:"(4010,1045)",vr:"SQ",name:"BasisMaterialsCodeSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1046)":{tag:"(4010,1046)",vr:"CS",name:"PhantomType",vm:"1",version:"DICOM/DICOS"},"(4010,1047)":{tag:"(4010,1047)",vr:"SQ",name:"OOIOwnerSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1048)":{tag:"(4010,1048)",vr:"CS",name:"ScanType",vm:"1",version:"DICOM/DICOS"},"(4010,1051)":{tag:"(4010,1051)",vr:"LO",name:"ItineraryID",vm:"1",version:"DICOM/DICOS"},"(4010,1052)":{tag:"(4010,1052)",vr:"SH",name:"ItineraryIDType",vm:"1",version:"DICOM/DICOS"},"(4010,1053)":{tag:"(4010,1053)",vr:"LO",name:"ItineraryIDAssigningAuthority",vm:"1",version:"DICOM/DICOS"},"(4010,1054)":{tag:"(4010,1054)",vr:"SH",name:"RouteID",vm:"1",version:"DICOM/DICOS"},"(4010,1055)":{tag:"(4010,1055)",vr:"SH",name:"RouteIDAssigningAuthority",vm:"1",version:"DICOM/DICOS"},"(4010,1056)":{tag:"(4010,1056)",vr:"CS",name:"InboundArrivalType",vm:"1",version:"DICOM/DICOS"},"(4010,1058)":{tag:"(4010,1058)",vr:"SH",name:"CarrierID",vm:"1",version:"DICOM/DICOS"},"(4010,1059)":{tag:"(4010,1059)",vr:"CS",name:"CarrierIDAssigningAuthority",vm:"1",version:"DICOM/DICOS"},"(4010,1060)":{tag:"(4010,1060)",vr:"FL",name:"SourceOrientation",vm:"3",version:"DICOM/DICOS"},"(4010,1061)":{tag:"(4010,1061)",vr:"FL",name:"SourcePosition",vm:"3",version:"DICOM/DICOS"},"(4010,1062)":{tag:"(4010,1062)",vr:"FL",name:"BeltHeight",vm:"1",version:"DICOM/DICOS"},"(4010,1064)":{tag:"(4010,1064)",vr:"SQ",name:"AlgorithmRoutingCodeSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1067)":{tag:"(4010,1067)",vr:"CS",name:"TransportClassification",vm:"1",version:"DICOM/DICOS"},"(4010,1068)":{tag:"(4010,1068)",vr:"LT",name:"OOITypeDescriptor",vm:"1",version:"DICOM/DICOS"},"(4010,1069)":{tag:"(4010,1069)",vr:"FL",name:"TotalProcessingTime",vm:"1",version:"DICOM/DICOS"},"(4010,106C)":{tag:"(4010,106C)",vr:"OB",name:"DetectorCalibrationData",vm:"1",version:"DICOM/DICOS"},"(4010,106D)":{tag:"(4010,106D)",vr:"CS",name:"AdditionalScreeningPerformed",vm:"1",version:"DICOM/DICOS"},"(4010,106E)":{tag:"(4010,106E)",vr:"CS",name:"AdditionalInspectionSelectionCriteria",vm:"1",version:"DICOM/DICOS"},"(4010,106F)":{tag:"(4010,106F)",vr:"SQ",name:"AdditionalInspectionMethodSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1070)":{tag:"(4010,1070)",vr:"CS",name:"AITDeviceType",vm:"1",version:"DICOM/DICOS"},"(4010,1071)":{tag:"(4010,1071)",vr:"SQ",name:"QRMeasurementsSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1072)":{tag:"(4010,1072)",vr:"SQ",name:"TargetMaterialSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1073)":{tag:"(4010,1073)",vr:"FD",name:"SNRThreshold",vm:"1",version:"DICOM/DICOS"},"(4010,1075)":{tag:"(4010,1075)",vr:"DS",name:"ImageScaleRepresentation",vm:"1",version:"DICOM/DICOS"},"(4010,1076)":{tag:"(4010,1076)",vr:"SQ",name:"ReferencedPTOSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1077)":{tag:"(4010,1077)",vr:"SQ",name:"ReferencedTDRInstanceSequence",vm:"1",version:"DICOM/DICOS"},"(4010,1078)":{tag:"(4010,1078)",vr:"ST",name:"PTOLocationDescription",vm:"1",version:"DICOM/DICOS"},"(4010,1079)":{tag:"(4010,1079)",vr:"SQ",name:"AnomalyLocatorIndicatorSequence",vm:"1",version:"DICOM/DICOS"},"(4010,107A)":{tag:"(4010,107A)",vr:"FL",name:"AnomalyLocatorIndicator",vm:"3",version:"DICOM/DICOS"},"(4010,107B)":{tag:"(4010,107B)",vr:"SQ",name:"PTORegionSequence",vm:"1",version:"DICOM/DICOS"},"(4010,107C)":{tag:"(4010,107C)",vr:"CS",name:"InspectionSelectionCriteria",vm:"1",version:"DICOM/DICOS"},"(4010,107D)":{tag:"(4010,107D)",vr:"SQ",name:"SecondaryInspectionMethodSequence",vm:"1",version:"DICOM/DICOS"},"(4010,107E)":{tag:"(4010,107E)",vr:"DS",name:"PRCSToRCSOrientation",vm:"6",version:"DICOM/DICOS"},"(4FFE,0001)":{tag:"(4FFE,0001)",vr:"SQ",name:"MACParametersSequence",vm:"1",version:"DICOM"},"(5200,9229)":{tag:"(5200,9229)",vr:"SQ",name:"SharedFunctionalGroupsSequence",vm:"1",version:"DICOM"},"(5200,9230)":{tag:"(5200,9230)",vr:"SQ",name:"PerFrameFunctionalGroupsSequence",vm:"1",version:"DICOM"},"(5400,0100)":{tag:"(5400,0100)",vr:"SQ",name:"WaveformSequence",vm:"1",version:"DICOM"},"(5400,0110)":{tag:"(5400,0110)",vr:"ox",name:"ChannelMinimumValue",vm:"1",version:"DICOM"},"(5400,0112)":{tag:"(5400,0112)",vr:"ox",name:"ChannelMaximumValue",vm:"1",version:"DICOM"},"(5400,1004)":{tag:"(5400,1004)",vr:"US",name:"WaveformBitsAllocated",vm:"1",version:"DICOM"},"(5400,1006)":{tag:"(5400,1006)",vr:"CS",name:"WaveformSampleInterpretation",vm:"1",version:"DICOM"},"(5400,100A)":{tag:"(5400,100A)",vr:"ox",name:"WaveformPaddingValue",vm:"1",version:"DICOM"},"(5400,1010)":{tag:"(5400,1010)",vr:"ox",name:"WaveformData",vm:"1",version:"DICOM"},"(5600,0010)":{tag:"(5600,0010)",vr:"OF",name:"FirstOrderPhaseCorrectionAngle",vm:"1",version:"DICOM"},"(5600,0020)":{tag:"(5600,0020)",vr:"OF",name:"SpectroscopyData",vm:"1",version:"DICOM"},"(6000-60FF,0010)":{tag:"(6000-60FF,0010)",vr:"US",name:"OverlayRows",vm:"1",version:"DICOM"},"(6000-60FF,0011)":{tag:"(6000-60FF,0011)",vr:"US",name:"OverlayColumns",vm:"1",version:"DICOM"},"(6000-60FF,0015)":{tag:"(6000-60FF,0015)",vr:"IS",name:"NumberOfFramesInOverlay",vm:"1",version:"DICOM"},"(6000-60FF,0022)":{tag:"(6000-60FF,0022)",vr:"LO",name:"OverlayDescription",vm:"1",version:"DICOM"},"(6000-60FF,0040)":{tag:"(6000-60FF,0040)",vr:"CS",name:"OverlayType",vm:"1",version:"DICOM"},"(6000-60FF,0045)":{tag:"(6000-60FF,0045)",vr:"LO",name:"OverlaySubtype",vm:"1",version:"DICOM"},"(6000-60FF,0050)":{tag:"(6000-60FF,0050)",vr:"SS",name:"OverlayOrigin",vm:"2",version:"DICOM"},"(6000-60FF,0051)":{tag:"(6000-60FF,0051)",vr:"US",name:"ImageFrameOrigin",vm:"1",version:"DICOM"},"(6000-60FF,0100)":{tag:"(6000-60FF,0100)",vr:"US",name:"OverlayBitsAllocated",vm:"1",version:"DICOM"},"(6000-60FF,0102)":{tag:"(6000-60FF,0102)",vr:"US",name:"OverlayBitPosition",vm:"1",version:"DICOM"},"(6000-60FF,1001)":{tag:"(6000-60FF,1001)",vr:"CS",name:"OverlayActivationLayer",vm:"1",version:"DICOM"},"(6000-60FF,1301)":{tag:"(6000-60FF,1301)",vr:"IS",name:"ROIArea",vm:"1",version:"DICOM"},"(6000-60FF,1302)":{tag:"(6000-60FF,1302)",vr:"DS",name:"ROIMean",vm:"1",version:"DICOM"},"(6000-60FF,1303)":{tag:"(6000-60FF,1303)",vr:"DS",name:"ROIStandardDeviation",vm:"1",version:"DICOM"},"(6000-60FF,1500)":{tag:"(6000-60FF,1500)",vr:"LO",name:"OverlayLabel",vm:"1",version:"DICOM"},"(6000-60FF,3000)":{tag:"(6000-60FF,3000)",vr:"ox",name:"OverlayData",vm:"1",version:"DICOM"},"(7FE0,0008)":{tag:"(7FE0,0008)",vr:"OF",name:"FloatPixelData",vm:"1",version:"DICOM"},"(7FE0,0009)":{tag:"(7FE0,0009)",vr:"OD",name:"DoubleFloatPixelData",vm:"1",version:"DICOM"},"(7FE0,0010)":{tag:"(7FE0,0010)",vr:"ox",name:"PixelData",vm:"1",version:"DICOM"},"(FFFA,FFFA)":{tag:"(FFFA,FFFA)",vr:"SQ",name:"DigitalSignaturesSequence",vm:"1",version:"DICOM"},"(FFFC,FFFC)":{tag:"(FFFC,FFFC)",vr:"OB",name:"DataSetTrailingPadding",vm:"1",version:"DICOM"},"(FFFE,E000)":{tag:"(FFFE,E000)",vr:"na",name:"Item",vm:"1",version:"DICOM"},"(FFFE,E00D)":{tag:"(FFFE,E00D)",vr:"na",name:"ItemDelimitationItem",vm:"1",version:"DICOM"},"(FFFE,E0DD)":{tag:"(FFFE,E0DD)",vr:"na",name:"SequenceDelimitationItem",vm:"1",version:"DICOM"},"(0028,1224)":{tag:"(0028,1224)",vr:"OW",name:"SegmentedAlphaPaletteColorLookupTableData",vm:"1",version:"Supplement_156"},"(0070,1101)":{tag:"(0070,1101)",vr:"UI",name:"PresentationDisplayCollectionUID",vm:"1",version:"Supplement_156"},"(0070,1102)":{tag:"(0070,1102)",vr:"UI",name:"PresentationSequenceCollectionUID",vm:"1",version:"Supplement_156"},"(0070,1103)":{tag:"(0070,1103)",vr:"US",name:"PresentationSequencePositionIndex",vm:"1",version:"Supplement_156"},"(0070,1104)":{tag:"(0070,1104)",vr:"SQ",name:"RenderedImageReferenceSequence",vm:"1",version:"Supplement_156"},"(0070,1201)":{tag:"(0070,1201)",vr:"SQ",name:"VolumetricPresentationStateInputSequence",vm:"1",version:"Supplement_156"},"(0070,1202)":{tag:"(0070,1202)",vr:"CS",name:"PresentationInputType",vm:"1",version:"Supplement_156"},"(0070,1203)":{tag:"(0070,1203)",vr:"US",name:"InputSequencePositionIndex",vm:"1",version:"Supplement_156"},"(0070,1204)":{tag:"(0070,1204)",vr:"CS",name:"Crop",vm:"1",version:"Supplement_156"},"(0070,1205)":{tag:"(0070,1205)",vr:"US",name:"CroppingSpecificationIndex",vm:"1-n",version:"Supplement_156"},"(0070,1206)":{tag:"(0070,1206)",vr:"CS",name:"CompositingMethod",vm:"1",version:"Supplement_156"},"(0070,1207)":{tag:"(0070,1207)",vr:"US",name:"VolumetricPresentationInputNumber",vm:"1",version:"Supplement_156"},"(0070,1208)":{tag:"(0070,1208)",vr:"CS",name:"ImageVolumeGeometry",vm:"1",version:"Supplement_156"},"(0070,1301)":{tag:"(0070,1301)",vr:"SQ",name:"VolumeCroppingSequence",vm:"1",version:"Supplement_156"},"(0070,1302)":{tag:"(0070,1302)",vr:"CS",name:"VolumeCroppingMethod",vm:"1",version:"Supplement_156"},"(0070,1303)":{tag:"(0070,1303)",vr:"FD",name:"BoundingBoxCrop",vm:"6",version:"Supplement_156"},"(0070,1304)":{tag:"(0070,1304)",vr:"SQ",name:"ObliqueCroppingPlaneSequence",vm:"1",version:"Supplement_156"},"(0070,1305)":{tag:"(0070,1305)",vr:"FD",name:"ObliqueCroppingPlane",vm:"4",version:"Supplement_156"},"(0070,1306)":{tag:"(0070,1306)",vr:"FD",name:"ObliqueCroppingPlaneNormal",vm:"3",version:"Supplement_156"},"(0070,1309)":{tag:"(0070,1309)",vr:"US",name:"CroppingSpecificationNumber",vm:"1",version:"Supplement_156"},"(0070,1501)":{tag:"(0070,1501)",vr:"CS",name:"MultiPlanarReconstructionStyle",vm:"1",version:"Supplement_156"},"(0070,1502)":{tag:"(0070,1502)",vr:"CS",name:"MPRThicknessType",vm:"1",version:"Supplement_156"},"(0070,1503)":{tag:"(0070,1503)",vr:"FD",name:"MPRSlabThickness",vm:"1",version:"Supplement_156"},"(0070,1505)":{tag:"(0070,1505)",vr:"FD",name:"MPRTopLeftHandCorner",vm:"3",version:"Supplement_156"},"(0070,1507)":{tag:"(0070,1507)",vr:"FD",name:"MPRViewWidthDirection",vm:"3",version:"Supplement_156"},"(0070,1508)":{tag:"(0070,1508)",vr:"FD",name:"MPRViewWidth",vm:"1",version:"Supplement_156"},"(0070,150C)":{tag:"(0070,150C)",vr:"FL",name:"NumberOfVolumetricCurvePoints",vm:"1",version:"Supplement_156"},"(0070,150D)":{tag:"(0070,150D)",vr:"OD",name:"VolumetricCurvePoints",vm:"1",version:"Supplement_156"},"(0070,1511)":{tag:"(0070,1511)",vr:"FD",name:"MPRViewHeightDirection",vm:"3",version:"Supplement_156"},"(0070,1512)":{tag:"(0070,1512)",vr:"FD",name:"MPRViewHeight",vm:"1",version:"Supplement_156"},"(0070,1801)":{tag:"(0070,1801)",vr:"SQ",name:"PresentationStateClassificationComponentSequence",vm:"1",version:"Supplement_156"},"(0070,1802)":{tag:"(0070,1802)",vr:"CS",name:"ComponentType",vm:"1",version:"Supplement_156"},"(0070,1803)":{tag:"(0070,1803)",vr:"SQ",name:"ComponentInputSequence",vm:"1",version:"Supplement_156"},"(0070,1804)":{tag:"(0070,1804)",vr:"US",name:"VolumetricPresentationInputIndex",vm:"1",version:"Supplement_156"},"(0070,1805)":{tag:"(0070,1805)",vr:"SQ",name:"PresentationStateCompositorComponentSequence",vm:"1",version:"Supplement_156"},"(0070,1806)":{tag:"(0070,1806)",vr:"SQ",name:"WeightingTransferFunctionSequence",vm:"1",version:"Supplement_156"},"(0070,1807)":{tag:"(0070,1807)",vr:"US",name:"WeightingLookupTableDescriptor",vm:"3",version:"Supplement_156"},"(0070,1808)":{tag:"(0070,1808)",vr:"OB",name:"WeightingLookupTableData",vm:"1",version:"Supplement_156"},"(0070,1901)":{tag:"(0070,1901)",vr:"SQ",name:"VolumetricAnnotationSequence",vm:"1",version:"Supplement_156"},"(0070,1903)":{tag:"(0070,1903)",vr:"SQ",name:"ReferencedStructuredContextSequence",vm:"1",version:"Supplement_156"},"(0070,1904)":{tag:"(0070,1904)",vr:"UI",name:"ReferencedContentItem",vm:"1",version:"Supplement_156"},"(0070,1905)":{tag:"(0070,1905)",vr:"SQ",name:"VolumetricPresentationInputAnnotationSequence",vm:"1",version:"Supplement_156"},"(0070,1907)":{tag:"(0070,1907)",vr:"CS",name:"AnnotationClipping",vm:"1",version:"Supplement_156"},"(0070,1A01)":{tag:"(0070,1A01)",vr:"CS",name:"PresentationAnimationStyle",vm:"1",version:"Supplement_156"},"(0070,1A03)":{tag:"(0070,1A03)",vr:"FD",name:"RecommendedAnimationRate",vm:"1",version:"Supplement_156"},"(0070,1A04)":{tag:"(0070,1A04)",vr:"SQ",name:"AnimationCurveSequence",vm:"1",version:"Supplement_156"},"(0070,1A05)":{tag:"(0070,1A05)",vr:"FD",name:"AnimationStepSize",vm:"1",version:"Supplement_156"},"(0040,4070)":{tag:"(0040,4070)",vr:"SQ",name:"OutputDestinationSequence",vm:"1",version:"CP_1441"},"(0040,4071)":{tag:"(0040,4071)",vr:"SQ",name:"DICOMStorageSequence",vm:"1",version:"CP_1441"},"(0040,4072)":{tag:"(0040,4072)",vr:"SQ",name:"STOWRSStorageSequence",vm:"1",version:"CP_1441"},"(0040,4073)":{tag:"(0040,4073)",vr:"UR",name:"StorageURL",vm:"1",version:"CP_1441"},"(0040,4074)":{tag:"(0040,4074)",vr:"SQ",name:"XDSStorageSequence",vm:"1",version:"CP_1441"},"(0028,2002)":{tag:"(0028,2002)",vr:"CS",name:"ColorSpace",vm:"1",version:"CP_1454"},"(0040,9213)":{tag:"(0040,9213)",vr:"FD",name:"DoubleFloatRealWorldValueLastValueMapped",vm:"1",version:"CP_1458"},"(0040,9214)":{tag:"(0040,9214)",vr:"FD",name:"DoubleFloatRealWorldValueFirstValueMapped",vm:"1",version:"CP_1458"},"(0018,1320)":{tag:"(0018,1320)",vr:"FL",name:"B1rms",vm:"1",version:"CP_1461"},"(0009-o-FFFF,0000)":{tag:"(0009-o-FFFF,0000)",vr:"UL",name:"PrivateGroupLength",vm:"1",version:"PRIVATE"},"(0009-o-FFFF,0010-u-00FF)":{tag:"(0009-o-FFFF,0010-u-00FF)",vr:"LO",name:"PrivateCreator",vm:"1",version:"PRIVATE"},"(0001-o-0007,0000)":{tag:"(0001-o-0007,0000)",vr:"UL",name:"IllegalGroupLength",vm:"1",version:"ILLEGAL"},"(0001-o-0007,0010-u-00FF)":{tag:"(0001-o-0007,0010-u-00FF)",vr:"LO",name:"IllegalPrivateCreator",vm:"1",version:"ILLEGAL"},"(0000-u-FFFF,0000)":{tag:"(0000-u-FFFF,0000)",vr:"UL",name:"GenericGroupLength",vm:"1",version:"GENERIC"},"(0000,0001)":{tag:"(0000,0001)",vr:"UL",name:"RETIRED_CommandLengthToEnd",vm:"1",version:"DICOM/retired"},"(0000,0010)":{tag:"(0000,0010)",vr:"SH",name:"RETIRED_CommandRecognitionCode",vm:"1",version:"DICOM/retired"},"(0000,0200)":{tag:"(0000,0200)",vr:"AE",name:"RETIRED_Initiator",vm:"1",version:"DICOM/retired"},"(0000,0300)":{tag:"(0000,0300)",vr:"AE",name:"RETIRED_Receiver",vm:"1",version:"DICOM/retired"},"(0000,0400)":{tag:"(0000,0400)",vr:"AE",name:"RETIRED_FindLocation",vm:"1",version:"DICOM/retired"},"(0000,0850)":{tag:"(0000,0850)",vr:"US",name:"RETIRED_NumberOfMatches",vm:"1",version:"DICOM/retired"},"(0000,0860)":{tag:"(0000,0860)",vr:"US",name:"RETIRED_ResponseSequenceNumber",vm:"1",version:"DICOM/retired"},"(0000,4000)":{tag:"(0000,4000)",vr:"LT",name:"RETIRED_DialogReceiver",vm:"1",version:"DICOM/retired"},"(0000,4010)":{tag:"(0000,4010)",vr:"LT",name:"RETIRED_TerminalType",vm:"1",version:"DICOM/retired"},"(0000,5010)":{tag:"(0000,5010)",vr:"SH",name:"RETIRED_MessageSetID",vm:"1",version:"DICOM/retired"},"(0000,5020)":{tag:"(0000,5020)",vr:"SH",name:"RETIRED_EndMessageID",vm:"1",version:"DICOM/retired"},"(0000,5110)":{tag:"(0000,5110)",vr:"LT",name:"RETIRED_DisplayFormat",vm:"1",version:"DICOM/retired"},"(0000,5120)":{tag:"(0000,5120)",vr:"LT",name:"RETIRED_PagePositionID",vm:"1",version:"DICOM/retired"},"(0000,5130)":{tag:"(0000,5130)",vr:"CS",name:"RETIRED_TextFormatID",vm:"1",version:"DICOM/retired"},"(0000,5140)":{tag:"(0000,5140)",vr:"CS",name:"RETIRED_NormalReverse",vm:"1",version:"DICOM/retired"},"(0000,5150)":{tag:"(0000,5150)",vr:"CS",name:"RETIRED_AddGrayScale",vm:"1",version:"DICOM/retired"},"(0000,5160)":{tag:"(0000,5160)",vr:"CS",name:"RETIRED_Borders",vm:"1",version:"DICOM/retired"},"(0000,5170)":{tag:"(0000,5170)",vr:"IS",name:"RETIRED_Copies",vm:"1",version:"DICOM/retired"},"(0000,5180)":{tag:"(0000,5180)",vr:"CS",name:"RETIRED_CommandMagnificationType",vm:"1",version:"DICOM/retired"},"(0000,5190)":{tag:"(0000,5190)",vr:"CS",name:"RETIRED_Erase",vm:"1",version:"DICOM/retired"},"(0000,51A0)":{tag:"(0000,51A0)",vr:"CS",name:"RETIRED_Print",vm:"1",version:"DICOM/retired"},"(0000,51B0)":{tag:"(0000,51B0)",vr:"US",name:"RETIRED_Overlays",vm:"1-n",version:"DICOM/retired"},"(0004,1504)":{tag:"(0004,1504)",vr:"up",name:"RETIRED_MRDRDirectoryRecordOffset",vm:"1",version:"DICOM/retired"},"(0004,1600)":{tag:"(0004,1600)",vr:"UL",name:"RETIRED_NumberOfReferences",vm:"1",version:"DICOM/retired"},"(0008,0001)":{tag:"(0008,0001)",vr:"UL",name:"RETIRED_LengthToEnd",vm:"1",version:"DICOM/retired"},"(0008,0010)":{tag:"(0008,0010)",vr:"SH",name:"RETIRED_RecognitionCode",vm:"1",version:"DICOM/retired"},"(0008,0024)":{tag:"(0008,0024)",vr:"DA",name:"RETIRED_OverlayDate",vm:"1",version:"DICOM/retired"},"(0008,0025)":{tag:"(0008,0025)",vr:"DA",name:"RETIRED_CurveDate",vm:"1",version:"DICOM/retired"},"(0008,0034)":{tag:"(0008,0034)",vr:"TM",name:"RETIRED_OverlayTime",vm:"1",version:"DICOM/retired"},"(0008,0035)":{tag:"(0008,0035)",vr:"TM",name:"RETIRED_CurveTime",vm:"1",version:"DICOM/retired"},"(0008,0040)":{tag:"(0008,0040)",vr:"US",name:"RETIRED_DataSetType",vm:"1",version:"DICOM/retired"},"(0008,0041)":{tag:"(0008,0041)",vr:"LO",name:"RETIRED_DataSetSubtype",vm:"1",version:"DICOM/retired"},"(0008,0042)":{tag:"(0008,0042)",vr:"CS",name:"RETIRED_NuclearMedicineSeriesType",vm:"1",version:"DICOM/retired"},"(0008,1000)":{tag:"(0008,1000)",vr:"AE",name:"RETIRED_NetworkID",vm:"1",version:"DICOM/retired"},"(0008,1100)":{tag:"(0008,1100)",vr:"SQ",name:"RETIRED_ReferencedResultsSequence",vm:"1",version:"DICOM/retired"},"(0008,1130)":{tag:"(0008,1130)",vr:"SQ",name:"RETIRED_ReferencedOverlaySequence",vm:"1",version:"DICOM/retired"},"(0008,1145)":{tag:"(0008,1145)",vr:"SQ",name:"RETIRED_ReferencedCurveSequence",vm:"1",version:"DICOM/retired"},"(0008,2110)":{tag:"(0008,2110)",vr:"CS",name:"RETIRED_LossyImageCompressionRetired",vm:"1",version:"DICOM/retired"},"(0008,2200)":{tag:"(0008,2200)",vr:"CS",name:"RETIRED_TransducerPosition",vm:"1",version:"DICOM/retired"},"(0008,2204)":{tag:"(0008,2204)",vr:"CS",name:"RETIRED_TransducerOrientation",vm:"1",version:"DICOM/retired"},"(0008,2208)":{tag:"(0008,2208)",vr:"CS",name:"RETIRED_AnatomicStructure",vm:"1",version:"DICOM/retired"},"(0008,2240)":{tag:"(0008,2240)",vr:"SQ",name:"RETIRED_TransducerPositionSequence",vm:"1",version:"DICOM/retired"},"(0008,2242)":{tag:"(0008,2242)",vr:"SQ",name:"RETIRED_TransducerPositionModifierSequence",vm:"1",version:"DICOM/retired"},"(0008,2244)":{tag:"(0008,2244)",vr:"SQ",name:"RETIRED_TransducerOrientationSequence",vm:"1",version:"DICOM/retired"},"(0008,2246)":{tag:"(0008,2246)",vr:"SQ",name:"RETIRED_TransducerOrientationModifierSequence",vm:"1",version:"DICOM/retired"},"(0008,2251)":{tag:"(0008,2251)",vr:"SQ",name:"RETIRED_AnatomicStructureSpaceOrRegionCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0008,2253)":{tag:"(0008,2253)",vr:"SQ",name:"RETIRED_AnatomicPortalOfEntranceCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0008,2255)":{tag:"(0008,2255)",vr:"SQ",name:"RETIRED_AnatomicApproachDirectionCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0008,2256)":{tag:"(0008,2256)",vr:"ST",name:"RETIRED_AnatomicPerspectiveDescriptionTrial",vm:"1",version:"DICOM/retired"},"(0008,2257)":{tag:"(0008,2257)",vr:"SQ",name:"RETIRED_AnatomicPerspectiveCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0008,2258)":{tag:"(0008,2258)",vr:"ST",name:"RETIRED_AnatomicLocationOfExaminingInstrumentDescriptionTrial",vm:"1",version:"DICOM/retired"},"(0008,2259)":{tag:"(0008,2259)",vr:"SQ",name:"RETIRED_AnatomicLocationOfExaminingInstrumentCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0008,225A)":{tag:"(0008,225A)",vr:"SQ",name:"RETIRED_AnatomicStructureSpaceOrRegionModifierCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0008,225C)":{tag:"(0008,225C)",vr:"SQ",name:"RETIRED_OnAxisBackgroundAnatomicStructureCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0008,4000)":{tag:"(0008,4000)",vr:"LT",name:"RETIRED_IdentifyingComments",vm:"1",version:"DICOM/retired"},"(0010,1050)":{tag:"(0010,1050)",vr:"LO",name:"RETIRED_InsurancePlanIdentification",vm:"1-n",version:"DICOM/retired"},"(0014,0023)":{tag:"(0014,0023)",vr:"ST",name:"RETIRED_CADFileFormat",vm:"1-n",version:"DICOM/retired"},"(0014,0024)":{tag:"(0014,0024)",vr:"ST",name:"RETIRED_ComponentReferenceSystem",vm:"1-n",version:"DICOM/retired"},"(0014,0045)":{tag:"(0014,0045)",vr:"ST",name:"RETIRED_MaterialPropertiesFileFormatRetired",vm:"1-n",version:"DICOM/retired"},"(0018,0030)":{tag:"(0018,0030)",vr:"LO",name:"RETIRED_Radionuclide",vm:"1-n",version:"DICOM/retired"},"(0018,0032)":{tag:"(0018,0032)",vr:"DS",name:"RETIRED_EnergyWindowCenterline",vm:"1",version:"DICOM/retired"},"(0018,0033)":{tag:"(0018,0033)",vr:"DS",name:"RETIRED_EnergyWindowTotalWidth",vm:"1-n",version:"DICOM/retired"},"(0018,0037)":{tag:"(0018,0037)",vr:"CS",name:"RETIRED_TherapyType",vm:"1",version:"DICOM/retired"},"(0018,0039)":{tag:"(0018,0039)",vr:"CS",name:"RETIRED_TherapyDescription",vm:"1",version:"DICOM/retired"},"(0018,1011)":{tag:"(0018,1011)",vr:"LO",name:"RETIRED_HardcopyCreationDeviceID",vm:"1",version:"DICOM/retired"},"(0018,1017)":{tag:"(0018,1017)",vr:"LO",name:"RETIRED_HardcopyDeviceManufacturer",vm:"1",version:"DICOM/retired"},"(0018,101A)":{tag:"(0018,101A)",vr:"LO",name:"RETIRED_HardcopyDeviceSoftwareVersion",vm:"1-n",version:"DICOM/retired"},"(0018,101B)":{tag:"(0018,101B)",vr:"LO",name:"RETIRED_HardcopyDeviceManufacturerModelName",vm:"1",version:"DICOM/retired"},"(0018,1141)":{tag:"(0018,1141)",vr:"DS",name:"RETIRED_AngularPosition",vm:"1",version:"DICOM/retired"},"(0018,1146)":{tag:"(0018,1146)",vr:"DS",name:"RETIRED_RotationOffset",vm:"1-n",version:"DICOM/retired"},"(0018,1240)":{tag:"(0018,1240)",vr:"IS",name:"RETIRED_UpperLowerPixelValues",vm:"1-n",version:"DICOM/retired"},"(0018,4000)":{tag:"(0018,4000)",vr:"LT",name:"RETIRED_AcquisitionComments",vm:"1",version:"DICOM/retired"},"(0018,5021)":{tag:"(0018,5021)",vr:"LO",name:"RETIRED_PostprocessingFunction",vm:"1",version:"DICOM/retired"},"(0018,5030)":{tag:"(0018,5030)",vr:"DS",name:"RETIRED_DynamicRange",vm:"1",version:"DICOM/retired"},"(0018,5040)":{tag:"(0018,5040)",vr:"DS",name:"RETIRED_TotalGain",vm:"1",version:"DICOM/retired"},"(0018,5210)":{tag:"(0018,5210)",vr:"DS",name:"RETIRED_ImageTransformationMatrix",vm:"6",version:"DICOM/retired"},"(0018,5212)":{tag:"(0018,5212)",vr:"DS",name:"RETIRED_ImageTranslationVector",vm:"3",version:"DICOM/retired"},"(0018,6038)":{tag:"(0018,6038)",vr:"UL",name:"RETIRED_DopplerSampleVolumeXPositionRetired",vm:"1",version:"DICOM/retired"},"(0018,603A)":{tag:"(0018,603A)",vr:"UL",name:"RETIRED_DopplerSampleVolumeYPositionRetired",vm:"1",version:"DICOM/retired"},"(0018,603C)":{tag:"(0018,603C)",vr:"UL",name:"RETIRED_TMLinePositionX0Retired",vm:"1",version:"DICOM/retired"},"(0018,603E)":{tag:"(0018,603E)",vr:"UL",name:"RETIRED_TMLinePositionY0Retired",vm:"1",version:"DICOM/retired"},"(0018,6040)":{tag:"(0018,6040)",vr:"UL",name:"RETIRED_TMLinePositionX1Retired",vm:"1",version:"DICOM/retired"},"(0018,6042)":{tag:"(0018,6042)",vr:"UL",name:"RETIRED_TMLinePositionY1Retired",vm:"1",version:"DICOM/retired"},"(0018,9096)":{tag:"(0018,9096)",vr:"FD",name:"RETIRED_ParallelReductionFactorInPlaneRetired",vm:"1",version:"DICOM/retired"},"(0018,9166)":{tag:"(0018,9166)",vr:"CS",name:"RETIRED_BulkMotionStatus",vm:"1",version:"DICOM/retired"},"(0018,9195)":{tag:"(0018,9195)",vr:"FD",name:"RETIRED_ChemicalShiftMinimumIntegrationLimitInHz",vm:"1",version:"DICOM/retired"},"(0018,9196)":{tag:"(0018,9196)",vr:"FD",name:"RETIRED_ChemicalShiftMaximumIntegrationLimitInHz",vm:"1",version:"DICOM/retired"},"(0020,0014)":{tag:"(0020,0014)",vr:"IS",name:"RETIRED_IsotopeNumber",vm:"1",version:"DICOM/retired"},"(0020,0015)":{tag:"(0020,0015)",vr:"IS",name:"RETIRED_PhaseNumber",vm:"1",version:"DICOM/retired"},"(0020,0016)":{tag:"(0020,0016)",vr:"IS",name:"RETIRED_IntervalNumber",vm:"1",version:"DICOM/retired"},"(0020,0017)":{tag:"(0020,0017)",vr:"IS",name:"RETIRED_TimeSlotNumber",vm:"1",version:"DICOM/retired"},"(0020,0018)":{tag:"(0020,0018)",vr:"IS",name:"RETIRED_AngleNumber",vm:"1",version:"DICOM/retired"},"(0020,0022)":{tag:"(0020,0022)",vr:"IS",name:"RETIRED_OverlayNumber",vm:"1",version:"DICOM/retired"},"(0020,0024)":{tag:"(0020,0024)",vr:"IS",name:"RETIRED_CurveNumber",vm:"1",version:"DICOM/retired"},"(0020,0026)":{tag:"(0020,0026)",vr:"IS",name:"RETIRED_LUTNumber",vm:"1",version:"DICOM/retired"},"(0020,0030)":{tag:"(0020,0030)",vr:"DS",name:"RETIRED_ImagePosition",vm:"3",version:"DICOM/retired"},"(0020,0035)":{tag:"(0020,0035)",vr:"DS",name:"RETIRED_ImageOrientation",vm:"6",version:"DICOM/retired"},"(0020,0050)":{tag:"(0020,0050)",vr:"DS",name:"RETIRED_Location",vm:"1",version:"DICOM/retired"},"(0020,0070)":{tag:"(0020,0070)",vr:"LO",name:"RETIRED_ImageGeometryType",vm:"1",version:"DICOM/retired"},"(0020,0080)":{tag:"(0020,0080)",vr:"CS",name:"RETIRED_MaskingImage",vm:"1-n",version:"DICOM/retired"},"(0020,00AA)":{tag:"(0020,00AA)",vr:"IS",name:"RETIRED_ReportNumber",vm:"1",version:"DICOM/retired"},"(0020,1000)":{tag:"(0020,1000)",vr:"IS",name:"RETIRED_SeriesInStudy",vm:"1",version:"DICOM/retired"},"(0020,1001)":{tag:"(0020,1001)",vr:"IS",name:"RETIRED_AcquisitionsInSeries",vm:"1",version:"DICOM/retired"},"(0020,1003)":{tag:"(0020,1003)",vr:"IS",name:"RETIRED_ImagesInSeries",vm:"1",version:"DICOM/retired"},"(0020,1004)":{tag:"(0020,1004)",vr:"IS",name:"RETIRED_AcquisitionsInStudy",vm:"1",version:"DICOM/retired"},"(0020,1005)":{tag:"(0020,1005)",vr:"IS",name:"RETIRED_ImagesInStudy",vm:"1",version:"DICOM/retired"},"(0020,1020)":{tag:"(0020,1020)",vr:"LO",name:"RETIRED_Reference",vm:"1-n",version:"DICOM/retired"},"(0020,1070)":{tag:"(0020,1070)",vr:"IS",name:"RETIRED_OtherStudyNumbers",vm:"1-n",version:"DICOM/retired"},"(0020,3100-31FF)":{tag:"(0020,3100-31FF)",vr:"CS",name:"RETIRED_SourceImageIDs",vm:"1-n",version:"DICOM/retired"},"(0020,3401)":{tag:"(0020,3401)",vr:"CS",name:"RETIRED_ModifyingDeviceID",vm:"1",version:"DICOM/retired"},"(0020,3402)":{tag:"(0020,3402)",vr:"CS",name:"RETIRED_ModifiedImageID",vm:"1",version:"DICOM/retired"},"(0020,3403)":{tag:"(0020,3403)",vr:"DA",name:"RETIRED_ModifiedImageDate",vm:"1",version:"DICOM/retired"},"(0020,3404)":{tag:"(0020,3404)",vr:"LO",name:"RETIRED_ModifyingDeviceManufacturer",vm:"1",version:"DICOM/retired"},"(0020,3405)":{tag:"(0020,3405)",vr:"TM",name:"RETIRED_ModifiedImageTime",vm:"1",version:"DICOM/retired"},"(0020,3406)":{tag:"(0020,3406)",vr:"LO",name:"RETIRED_ModifiedImageDescription",vm:"1",version:"DICOM/retired"},"(0020,5000)":{tag:"(0020,5000)",vr:"AT",name:"RETIRED_OriginalImageIdentification",vm:"1-n",version:"DICOM/retired"},"(0020,5002)":{tag:"(0020,5002)",vr:"LO",name:"RETIRED_OriginalImageIdentificationNomenclature",vm:"1-n",version:"DICOM/retired"},"(0022,1094)":{tag:"(0022,1094)",vr:"LO",name:"RETIRED_LensConstantDescription",vm:"1",version:"DICOM/retired"},"(0022,1153)":{tag:"(0022,1153)",vr:"SQ",name:"RETIRED_OphthalmicAxialLengthAcquisitionMethodCodeSequence",vm:"1",version:"DICOM/retired"},"(0022,1265)":{tag:"(0022,1265)",vr:"SQ",name:"RETIRED_OphthalmicAxialLengthQualityMetricTypeCodeSequence",vm:"1",version:"DICOM/retired"},"(0022,1273)":{tag:"(0022,1273)",vr:"LO",name:"RETIRED_OphthalmicAxialLengthQualityMetricTypeDescription",vm:"1",version:"DICOM/retired"},"(0028,0005)":{tag:"(0028,0005)",vr:"US",name:"RETIRED_ImageDimensions",vm:"1",version:"DICOM/retired"},"(0028,0012)":{tag:"(0028,0012)",vr:"US",name:"RETIRED_Planes",vm:"1",version:"DICOM/retired"},"(0028,0040)":{tag:"(0028,0040)",vr:"CS",name:"RETIRED_ImageFormat",vm:"1",version:"DICOM/retired"},"(0028,0050)":{tag:"(0028,0050)",vr:"LO",name:"RETIRED_ManipulatedImage",vm:"1-n",version:"DICOM/retired"},"(0028,005F)":{tag:"(0028,005F)",vr:"LO",name:"RETIRED_CompressionRecognitionCode",vm:"1",version:"DICOM/retired"},"(0028,0060)":{tag:"(0028,0060)",vr:"CS",name:"RETIRED_CompressionCode",vm:"1",version:"DICOM/retired"},"(0028,0061)":{tag:"(0028,0061)",vr:"SH",name:"RETIRED_CompressionOriginator",vm:"1",version:"DICOM/retired"},"(0028,0062)":{tag:"(0028,0062)",vr:"LO",name:"RETIRED_CompressionLabel",vm:"1",version:"DICOM/retired"},"(0028,0063)":{tag:"(0028,0063)",vr:"SH",name:"RETIRED_CompressionDescription",vm:"1",version:"DICOM/retired"},"(0028,0065)":{tag:"(0028,0065)",vr:"CS",name:"RETIRED_CompressionSequence",vm:"1-n",version:"DICOM/retired"},"(0028,0066)":{tag:"(0028,0066)",vr:"AT",name:"RETIRED_CompressionStepPointers",vm:"1-n",version:"DICOM/retired"},"(0028,0068)":{tag:"(0028,0068)",vr:"US",name:"RETIRED_RepeatInterval",vm:"1",version:"DICOM/retired"},"(0028,0069)":{tag:"(0028,0069)",vr:"US",name:"RETIRED_BitsGrouped",vm:"1",version:"DICOM/retired"},"(0028,0070)":{tag:"(0028,0070)",vr:"US",name:"RETIRED_PerimeterTable",vm:"1-n",version:"DICOM/retired"},"(0028,0071)":{tag:"(0028,0071)",vr:"xs",name:"RETIRED_PerimeterValue",vm:"1",version:"DICOM/retired"},"(0028,0080)":{tag:"(0028,0080)",vr:"US",name:"RETIRED_PredictorRows",vm:"1",version:"DICOM/retired"},"(0028,0081)":{tag:"(0028,0081)",vr:"US",name:"RETIRED_PredictorColumns",vm:"1",version:"DICOM/retired"},"(0028,0082)":{tag:"(0028,0082)",vr:"US",name:"RETIRED_PredictorConstants",vm:"1-n",version:"DICOM/retired"},"(0028,0090)":{tag:"(0028,0090)",vr:"CS",name:"RETIRED_BlockedPixels",vm:"1",version:"DICOM/retired"},"(0028,0091)":{tag:"(0028,0091)",vr:"US",name:"RETIRED_BlockRows",vm:"1",version:"DICOM/retired"},"(0028,0092)":{tag:"(0028,0092)",vr:"US",name:"RETIRED_BlockColumns",vm:"1",version:"DICOM/retired"},"(0028,0093)":{tag:"(0028,0093)",vr:"US",name:"RETIRED_RowOverlap",vm:"1",version:"DICOM/retired"},"(0028,0094)":{tag:"(0028,0094)",vr:"US",name:"RETIRED_ColumnOverlap",vm:"1",version:"DICOM/retired"},"(0028,0104)":{tag:"(0028,0104)",vr:"xs",name:"RETIRED_SmallestValidPixelValue",vm:"1",version:"DICOM/retired"},"(0028,0105)":{tag:"(0028,0105)",vr:"xs",name:"RETIRED_LargestValidPixelValue",vm:"1",version:"DICOM/retired"},"(0028,0110)":{tag:"(0028,0110)",vr:"xs",name:"RETIRED_SmallestImagePixelValueInPlane",vm:"1",version:"DICOM/retired"},"(0028,0111)":{tag:"(0028,0111)",vr:"xs",name:"RETIRED_LargestImagePixelValueInPlane",vm:"1",version:"DICOM/retired"},"(0028,0200)":{tag:"(0028,0200)",vr:"US",name:"RETIRED_ImageLocation",vm:"1",version:"DICOM/retired"},"(0028,0400)":{tag:"(0028,0400)",vr:"LO",name:"RETIRED_TransformLabel",vm:"1",version:"DICOM/retired"},"(0028,0401)":{tag:"(0028,0401)",vr:"LO",name:"RETIRED_TransformVersionNumber",vm:"1",version:"DICOM/retired"},"(0028,0402)":{tag:"(0028,0402)",vr:"US",name:"RETIRED_NumberOfTransformSteps",vm:"1",version:"DICOM/retired"},"(0028,0403)":{tag:"(0028,0403)",vr:"LO",name:"RETIRED_SequenceOfCompressedData",vm:"1-n",version:"DICOM/retired"},"(0028,0404)":{tag:"(0028,0404)",vr:"AT",name:"RETIRED_DetailsOfCoefficients",vm:"1-n",version:"DICOM/retired"},"(0028,0410)":{tag:"(0028,0410)",vr:"US",name:"RETIRED_RowsForNthOrderCoefficients",vm:"1",version:"DICOM/retired"},"(0028,0411)":{tag:"(0028,0411)",vr:"US",name:"RETIRED_ColumnsForNthOrderCoefficients",vm:"1",version:"DICOM/retired"},"(0028,0412)":{tag:"(0028,0412)",vr:"LO",name:"RETIRED_CoefficientCoding",vm:"1-n",version:"DICOM/retired"},"(0028,0413)":{tag:"(0028,0413)",vr:"AT",name:"RETIRED_CoefficientCodingPointers",vm:"1-n",version:"DICOM/retired"},"(0028,0700)":{tag:"(0028,0700)",vr:"LO",name:"RETIRED_DCTLabel",vm:"1",version:"DICOM/retired"},"(0028,0701)":{tag:"(0028,0701)",vr:"CS",name:"RETIRED_DataBlockDescription",vm:"1-n",version:"DICOM/retired"},"(0028,0702)":{tag:"(0028,0702)",vr:"AT",name:"RETIRED_DataBlock",vm:"1-n",version:"DICOM/retired"},"(0028,0710)":{tag:"(0028,0710)",vr:"US",name:"RETIRED_NormalizationFactorFormat",vm:"1",version:"DICOM/retired"},"(0028,0720)":{tag:"(0028,0720)",vr:"US",name:"RETIRED_ZonalMapNumberFormat",vm:"1",version:"DICOM/retired"},"(0028,0721)":{tag:"(0028,0721)",vr:"AT",name:"RETIRED_ZonalMapLocation",vm:"1-n",version:"DICOM/retired"},"(0028,0722)":{tag:"(0028,0722)",vr:"US",name:"RETIRED_ZonalMapFormat",vm:"1",version:"DICOM/retired"},"(0028,0730)":{tag:"(0028,0730)",vr:"US",name:"RETIRED_AdaptiveMapFormat",vm:"1",version:"DICOM/retired"},"(0028,0740)":{tag:"(0028,0740)",vr:"US",name:"RETIRED_CodeNumberFormat",vm:"1",version:"DICOM/retired"},"(0028,0800)":{tag:"(0028,0800)",vr:"CS",name:"RETIRED_CodeLabel",vm:"1-n",version:"DICOM/retired"},"(0028,0802)":{tag:"(0028,0802)",vr:"US",name:"RETIRED_NumberOfTables",vm:"1",version:"DICOM/retired"},"(0028,0803)":{tag:"(0028,0803)",vr:"AT",name:"RETIRED_CodeTableLocation",vm:"1-n",version:"DICOM/retired"},"(0028,0804)":{tag:"(0028,0804)",vr:"US",name:"RETIRED_BitsForCodeWord",vm:"1",version:"DICOM/retired"},"(0028,0808)":{tag:"(0028,0808)",vr:"AT",name:"RETIRED_ImageDataLocation",vm:"1-n",version:"DICOM/retired"},"(0028,1080)":{tag:"(0028,1080)",vr:"CS",name:"RETIRED_GrayScale",vm:"1",version:"DICOM/retired"},"(0028,1100)":{tag:"(0028,1100)",vr:"xs",name:"RETIRED_GrayLookupTableDescriptor",vm:"3",version:"DICOM/retired"},"(0028,1111)":{tag:"(0028,1111)",vr:"xs",name:"RETIRED_LargeRedPaletteColorLookupTableDescriptor",vm:"4",version:"DICOM/retired"},"(0028,1112)":{tag:"(0028,1112)",vr:"xs",name:"RETIRED_LargeGreenPaletteColorLookupTableDescriptor",vm:"4",version:"DICOM/retired"},"(0028,1113)":{tag:"(0028,1113)",vr:"xs",name:"RETIRED_LargeBluePaletteColorLookupTableDescriptor",vm:"4",version:"DICOM/retired"},"(0028,1200)":{tag:"(0028,1200)",vr:"lt",name:"RETIRED_GrayLookupTableData",vm:"1-n",version:"DICOM/retired"},"(0028,1211)":{tag:"(0028,1211)",vr:"OW",name:"RETIRED_LargeRedPaletteColorLookupTableData",vm:"1",version:"DICOM/retired"},"(0028,1212)":{tag:"(0028,1212)",vr:"OW",name:"RETIRED_LargeGreenPaletteColorLookupTableData",vm:"1",version:"DICOM/retired"},"(0028,1213)":{tag:"(0028,1213)",vr:"OW",name:"RETIRED_LargeBluePaletteColorLookupTableData",vm:"1",version:"DICOM/retired"},"(0028,1214)":{tag:"(0028,1214)",vr:"UI",name:"RETIRED_LargePaletteColorLookupTableUID",vm:"1",version:"DICOM/retired"},"(0028,4000)":{tag:"(0028,4000)",vr:"LT",name:"RETIRED_ImagePresentationComments",vm:"1",version:"DICOM/retired"},"(0028,5000)":{tag:"(0028,5000)",vr:"SQ",name:"RETIRED_BiPlaneAcquisitionSequence",vm:"1",version:"DICOM/retired"},"(0028,6030)":{tag:"(0028,6030)",vr:"US",name:"RETIRED_MaskPointers",vm:"1-n",version:"DICOM/retired"},"(0028,9099)":{tag:"(0028,9099)",vr:"US",name:"RETIRED_LargestMonochromePixelValue",vm:"1",version:"DICOM/retired"},"(0032,000A)":{tag:"(0032,000A)",vr:"CS",name:"RETIRED_StudyStatusID",vm:"1",version:"DICOM/retired"},"(0032,000C)":{tag:"(0032,000C)",vr:"CS",name:"RETIRED_StudyPriorityID",vm:"1",version:"DICOM/retired"},"(0032,0012)":{tag:"(0032,0012)",vr:"LO",name:"RETIRED_StudyIDIssuer",vm:"1",version:"DICOM/retired"},"(0032,0032)":{tag:"(0032,0032)",vr:"DA",name:"RETIRED_StudyVerifiedDate",vm:"1",version:"DICOM/retired"},"(0032,0033)":{tag:"(0032,0033)",vr:"TM",name:"RETIRED_StudyVerifiedTime",vm:"1",version:"DICOM/retired"},"(0032,0034)":{tag:"(0032,0034)",vr:"DA",name:"RETIRED_StudyReadDate",vm:"1",version:"DICOM/retired"},"(0032,0035)":{tag:"(0032,0035)",vr:"TM",name:"RETIRED_StudyReadTime",vm:"1",version:"DICOM/retired"},"(0032,1000)":{tag:"(0032,1000)",vr:"DA",name:"RETIRED_ScheduledStudyStartDate",vm:"1",version:"DICOM/retired"},"(0032,1001)":{tag:"(0032,1001)",vr:"TM",name:"RETIRED_ScheduledStudyStartTime",vm:"1",version:"DICOM/retired"},"(0032,1010)":{tag:"(0032,1010)",vr:"DA",name:"RETIRED_ScheduledStudyStopDate",vm:"1",version:"DICOM/retired"},"(0032,1011)":{tag:"(0032,1011)",vr:"TM",name:"RETIRED_ScheduledStudyStopTime",vm:"1",version:"DICOM/retired"},"(0032,1020)":{tag:"(0032,1020)",vr:"LO",name:"RETIRED_ScheduledStudyLocation",vm:"1",version:"DICOM/retired"},"(0032,1021)":{tag:"(0032,1021)",vr:"AE",name:"RETIRED_ScheduledStudyLocationAETitle",vm:"1-n",version:"DICOM/retired"},"(0032,1030)":{tag:"(0032,1030)",vr:"LO",name:"RETIRED_ReasonForStudy",vm:"1",version:"DICOM/retired"},"(0032,1040)":{tag:"(0032,1040)",vr:"DA",name:"RETIRED_StudyArrivalDate",vm:"1",version:"DICOM/retired"},"(0032,1041)":{tag:"(0032,1041)",vr:"TM",name:"RETIRED_StudyArrivalTime",vm:"1",version:"DICOM/retired"},"(0032,1050)":{tag:"(0032,1050)",vr:"DA",name:"RETIRED_StudyCompletionDate",vm:"1",version:"DICOM/retired"},"(0032,1051)":{tag:"(0032,1051)",vr:"TM",name:"RETIRED_StudyCompletionTime",vm:"1",version:"DICOM/retired"},"(0032,1055)":{tag:"(0032,1055)",vr:"CS",name:"RETIRED_StudyComponentStatusID",vm:"1",version:"DICOM/retired"},"(0032,4000)":{tag:"(0032,4000)",vr:"LT",name:"RETIRED_StudyComments",vm:"1",version:"DICOM/retired"},"(0038,0011)":{tag:"(0038,0011)",vr:"LO",name:"RETIRED_IssuerOfAdmissionID",vm:"1",version:"DICOM/retired"},"(0038,001A)":{tag:"(0038,001A)",vr:"DA",name:"RETIRED_ScheduledAdmissionDate",vm:"1",version:"DICOM/retired"},"(0038,001B)":{tag:"(0038,001B)",vr:"TM",name:"RETIRED_ScheduledAdmissionTime",vm:"1",version:"DICOM/retired"},"(0038,001C)":{tag:"(0038,001C)",vr:"DA",name:"RETIRED_ScheduledDischargeDate",vm:"1",version:"DICOM/retired"},"(0038,001D)":{tag:"(0038,001D)",vr:"TM",name:"RETIRED_ScheduledDischargeTime",vm:"1",version:"DICOM/retired"},"(0038,001E)":{tag:"(0038,001E)",vr:"LO",name:"RETIRED_ScheduledPatientInstitutionResidence",vm:"1",version:"DICOM/retired"},"(0038,0030)":{tag:"(0038,0030)",vr:"DA",name:"RETIRED_DischargeDate",vm:"1",version:"DICOM/retired"},"(0038,0032)":{tag:"(0038,0032)",vr:"TM",name:"RETIRED_DischargeTime",vm:"1",version:"DICOM/retired"},"(0038,0040)":{tag:"(0038,0040)",vr:"LO",name:"RETIRED_DischargeDiagnosisDescription",vm:"1",version:"DICOM/retired"},"(0038,0044)":{tag:"(0038,0044)",vr:"SQ",name:"RETIRED_DischargeDiagnosisCodeSequence",vm:"1",version:"DICOM/retired"},"(0038,0061)":{tag:"(0038,0061)",vr:"LO",name:"RETIRED_IssuerOfServiceEpisodeID",vm:"1",version:"DICOM/retired"},"(0040,0307)":{tag:"(0040,0307)",vr:"DS",name:"RETIRED_DistanceSourceToSupport",vm:"1",version:"DICOM/retired"},"(0040,0330)":{tag:"(0040,0330)",vr:"SQ",name:"RETIRED_ReferencedProcedureStepSequence",vm:"1",version:"DICOM/retired"},"(0040,050A)":{tag:"(0040,050A)",vr:"LO",name:"RETIRED_SpecimenAccessionNumber",vm:"1",version:"DICOM/retired"},"(0040,0550)":{tag:"(0040,0550)",vr:"SQ",name:"RETIRED_SpecimenSequence",vm:"1",version:"DICOM/retired"},"(0040,0552)":{tag:"(0040,0552)",vr:"SQ",name:"RETIRED_SpecimenDescriptionSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,0553)":{tag:"(0040,0553)",vr:"ST",name:"RETIRED_SpecimenDescriptionTrial",vm:"1",version:"DICOM/retired"},"(0040,06FA)":{tag:"(0040,06FA)",vr:"LO",name:"RETIRED_SlideIdentifier",vm:"1",version:"DICOM/retired"},"(0040,08D8)":{tag:"(0040,08D8)",vr:"SQ",name:"RETIRED_PixelSpacingSequence",vm:"1",version:"DICOM/retired"},"(0040,08DA)":{tag:"(0040,08DA)",vr:"SQ",name:"RETIRED_CoordinateSystemAxisCodeSequence",vm:"1",version:"DICOM/retired"},"(0040,09F8)":{tag:"(0040,09F8)",vr:"SQ",name:"RETIRED_VitalStainCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,1006)":{tag:"(0040,1006)",vr:"SH",name:"RETIRED_PlacerOrderNumberProcedure",vm:"1",version:"DICOM/retired"},"(0040,1007)":{tag:"(0040,1007)",vr:"SH",name:"RETIRED_FillerOrderNumberProcedure",vm:"1",version:"DICOM/retired"},"(0040,1060)":{tag:"(0040,1060)",vr:"LO",name:"RETIRED_RequestedProcedureDescriptionTrial",vm:"1",version:"DICOM/retired"},"(0040,2001)":{tag:"(0040,2001)",vr:"LO",name:"RETIRED_ReasonForTheImagingServiceRequest",vm:"1",version:"DICOM/retired"},"(0040,2006)":{tag:"(0040,2006)",vr:"SH",name:"RETIRED_PlacerOrderNumberImagingServiceRequestRetired",vm:"1",version:"DICOM/retired"},"(0040,2007)":{tag:"(0040,2007)",vr:"SH",name:"RETIRED_FillerOrderNumberImagingServiceRequestRetired",vm:"1",version:"DICOM/retired"},"(0040,4001)":{tag:"(0040,4001)",vr:"CS",name:"RETIRED_GeneralPurposeScheduledProcedureStepStatus",vm:"1",version:"DICOM/retired"},"(0040,4002)":{tag:"(0040,4002)",vr:"CS",name:"RETIRED_GeneralPurposePerformedProcedureStepStatus",vm:"1",version:"DICOM/retired"},"(0040,4003)":{tag:"(0040,4003)",vr:"CS",name:"RETIRED_GeneralPurposeScheduledProcedureStepPriority",vm:"1",version:"DICOM/retired"},"(0040,4004)":{tag:"(0040,4004)",vr:"SQ",name:"RETIRED_ScheduledProcessingApplicationsCodeSequence",vm:"1",version:"DICOM/retired"},"(0040,4006)":{tag:"(0040,4006)",vr:"CS",name:"RETIRED_MultipleCopiesFlag",vm:"1",version:"DICOM/retired"},"(0040,4015)":{tag:"(0040,4015)",vr:"SQ",name:"RETIRED_ResultingGeneralPurposePerformedProcedureStepsSequence",vm:"1",version:"DICOM/retired"},"(0040,4016)":{tag:"(0040,4016)",vr:"SQ",name:"RETIRED_ReferencedGeneralPurposeScheduledProcedureStepSequence",vm:"1",version:"DICOM/retired"},"(0040,4022)":{tag:"(0040,4022)",vr:"SQ",name:"RETIRED_RelevantInformationSequence",vm:"1",version:"DICOM/retired"},"(0040,4023)":{tag:"(0040,4023)",vr:"UI",name:"RETIRED_ReferencedGeneralPurposeScheduledProcedureStepTransactionUID",vm:"1",version:"DICOM/retired"},"(0040,4031)":{tag:"(0040,4031)",vr:"SQ",name:"RETIRED_RequestedSubsequentWorkitemCodeSequence",vm:"1",version:"DICOM/retired"},"(0040,4032)":{tag:"(0040,4032)",vr:"SQ",name:"RETIRED_NonDICOMOutputCodeSequence",vm:"1",version:"DICOM/retired"},"(0040,A007)":{tag:"(0040,A007)",vr:"CS",name:"RETIRED_FindingsFlagTrial",vm:"1",version:"DICOM/retired"},"(0040,A020)":{tag:"(0040,A020)",vr:"SQ",name:"RETIRED_FindingsSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A021)":{tag:"(0040,A021)",vr:"UI",name:"RETIRED_FindingsGroupUIDTrial",vm:"1",version:"DICOM/retired"},"(0040,A022)":{tag:"(0040,A022)",vr:"UI",name:"RETIRED_ReferencedFindingsGroupUIDTrial",vm:"1",version:"DICOM/retired"},"(0040,A023)":{tag:"(0040,A023)",vr:"DA",name:"RETIRED_FindingsGroupRecordingDateTrial",vm:"1",version:"DICOM/retired"},"(0040,A024)":{tag:"(0040,A024)",vr:"TM",name:"RETIRED_FindingsGroupRecordingTimeTrial",vm:"1",version:"DICOM/retired"},"(0040,A026)":{tag:"(0040,A026)",vr:"SQ",name:"RETIRED_FindingsSourceCategoryCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A028)":{tag:"(0040,A028)",vr:"SQ",name:"RETIRED_DocumentingOrganizationIdentifierCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A047)":{tag:"(0040,A047)",vr:"LO",name:"RETIRED_MeasurementPrecisionDescriptionTrial",vm:"1",version:"DICOM/retired"},"(0040,A057)":{tag:"(0040,A057)",vr:"CS",name:"RETIRED_UrgencyOrPriorityAlertsTrial",vm:"1-n",version:"DICOM/retired"},"(0040,A060)":{tag:"(0040,A060)",vr:"LO",name:"RETIRED_SequencingIndicatorTrial",vm:"1",version:"DICOM/retired"},"(0040,A066)":{tag:"(0040,A066)",vr:"SQ",name:"RETIRED_DocumentIdentifierCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A067)":{tag:"(0040,A067)",vr:"PN",name:"RETIRED_DocumentAuthorTrial",vm:"1",version:"DICOM/retired"},"(0040,A068)":{tag:"(0040,A068)",vr:"SQ",name:"RETIRED_DocumentAuthorIdentifierCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A070)":{tag:"(0040,A070)",vr:"SQ",name:"RETIRED_IdentifierCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A074)":{tag:"(0040,A074)",vr:"OB",name:"RETIRED_ObjectBinaryIdentifierTrial",vm:"1",version:"DICOM/retired"},"(0040,A076)":{tag:"(0040,A076)",vr:"SQ",name:"RETIRED_DocumentingObserverIdentifierCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A085)":{tag:"(0040,A085)",vr:"SQ",name:"RETIRED_ProcedureIdentifierCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A089)":{tag:"(0040,A089)",vr:"OB",name:"RETIRED_ObjectDirectoryBinaryIdentifierTrial",vm:"1",version:"DICOM/retired"},"(0040,A090)":{tag:"(0040,A090)",vr:"SQ",name:"RETIRED_EquivalentCDADocumentSequence",vm:"1",version:"DICOM/retired"},"(0040,A110)":{tag:"(0040,A110)",vr:"DA",name:"RETIRED_DateOfDocumentOrVerbalTransactionTrial",vm:"1",version:"DICOM/retired"},"(0040,A112)":{tag:"(0040,A112)",vr:"TM",name:"RETIRED_TimeOfDocumentCreationOrVerbalTransactionTrial",vm:"1",version:"DICOM/retired"},"(0040,A125)":{tag:"(0040,A125)",vr:"CS",name:"RETIRED_ReportStatusIDTrial",vm:"2",version:"DICOM/retired"},"(0040,A167)":{tag:"(0040,A167)",vr:"SQ",name:"RETIRED_ObservationCategoryCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A16A)":{tag:"(0040,A16A)",vr:"ST",name:"RETIRED_BibliographicCitationTrial",vm:"1",version:"DICOM/retired"},"(0040,A172)":{tag:"(0040,A172)",vr:"UI",name:"RETIRED_ReferencedObservationUIDTrial",vm:"1",version:"DICOM/retired"},"(0040,A173)":{tag:"(0040,A173)",vr:"CS",name:"RETIRED_ReferencedObservationClassTrial",vm:"1",version:"DICOM/retired"},"(0040,A174)":{tag:"(0040,A174)",vr:"CS",name:"RETIRED_ReferencedObjectObservationClassTrial",vm:"1",version:"DICOM/retired"},"(0040,A192)":{tag:"(0040,A192)",vr:"DA",name:"RETIRED_ObservationDateTrial",vm:"1",version:"DICOM/retired"},"(0040,A193)":{tag:"(0040,A193)",vr:"TM",name:"RETIRED_ObservationTimeTrial",vm:"1",version:"DICOM/retired"},"(0040,A194)":{tag:"(0040,A194)",vr:"CS",name:"RETIRED_MeasurementAutomationTrial",vm:"1",version:"DICOM/retired"},"(0040,A224)":{tag:"(0040,A224)",vr:"ST",name:"RETIRED_IdentificationDescriptionTrial",vm:"1",version:"DICOM/retired"},"(0040,A290)":{tag:"(0040,A290)",vr:"CS",name:"RETIRED_CoordinatesSetGeometricTypeTrial",vm:"1",version:"DICOM/retired"},"(0040,A296)":{tag:"(0040,A296)",vr:"SQ",name:"RETIRED_AlgorithmCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A297)":{tag:"(0040,A297)",vr:"ST",name:"RETIRED_AlgorithmDescriptionTrial",vm:"1",version:"DICOM/retired"},"(0040,A29A)":{tag:"(0040,A29A)",vr:"SL",name:"RETIRED_PixelCoordinatesSetTrial",vm:"2-2n",version:"DICOM/retired"},"(0040,A307)":{tag:"(0040,A307)",vr:"PN",name:"RETIRED_CurrentObserverTrial",vm:"1",version:"DICOM/retired"},"(0040,A313)":{tag:"(0040,A313)",vr:"SQ",name:"RETIRED_ReferencedAccessionSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A33A)":{tag:"(0040,A33A)",vr:"ST",name:"RETIRED_ReportStatusCommentTrial",vm:"1",version:"DICOM/retired"},"(0040,A340)":{tag:"(0040,A340)",vr:"SQ",name:"RETIRED_ProcedureContextSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A352)":{tag:"(0040,A352)",vr:"PN",name:"RETIRED_VerbalSourceTrial",vm:"1",version:"DICOM/retired"},"(0040,A353)":{tag:"(0040,A353)",vr:"ST",name:"RETIRED_AddressTrial",vm:"1",version:"DICOM/retired"},"(0040,A354)":{tag:"(0040,A354)",vr:"LO",name:"RETIRED_TelephoneNumberTrial",vm:"1",version:"DICOM/retired"},"(0040,A358)":{tag:"(0040,A358)",vr:"SQ",name:"RETIRED_VerbalSourceIdentifierCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A380)":{tag:"(0040,A380)",vr:"SQ",name:"RETIRED_ReportDetailSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A402)":{tag:"(0040,A402)",vr:"UI",name:"RETIRED_ObservationSubjectUIDTrial",vm:"1",version:"DICOM/retired"},"(0040,A403)":{tag:"(0040,A403)",vr:"CS",name:"RETIRED_ObservationSubjectClassTrial",vm:"1",version:"DICOM/retired"},"(0040,A404)":{tag:"(0040,A404)",vr:"SQ",name:"RETIRED_ObservationSubjectTypeCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A600)":{tag:"(0040,A600)",vr:"CS",name:"RETIRED_ObservationSubjectContextFlagTrial",vm:"1",version:"DICOM/retired"},"(0040,A601)":{tag:"(0040,A601)",vr:"CS",name:"RETIRED_ObserverContextFlagTrial",vm:"1",version:"DICOM/retired"},"(0040,A603)":{tag:"(0040,A603)",vr:"CS",name:"RETIRED_ProcedureContextFlagTrial",vm:"1",version:"DICOM/retired"},"(0040,A731)":{tag:"(0040,A731)",vr:"SQ",name:"RETIRED_RelationshipSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A732)":{tag:"(0040,A732)",vr:"SQ",name:"RETIRED_RelationshipTypeCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A744)":{tag:"(0040,A744)",vr:"SQ",name:"RETIRED_LanguageCodeSequenceTrial",vm:"1",version:"DICOM/retired"},"(0040,A992)":{tag:"(0040,A992)",vr:"ST",name:"RETIRED_UniformResourceLocatorTrial",vm:"1",version:"DICOM/retired"},"(0040,DB06)":{tag:"(0040,DB06)",vr:"DT",name:"RETIRED_TemplateVersion",vm:"1",version:"DICOM/retired"},"(0040,DB07)":{tag:"(0040,DB07)",vr:"DT",name:"RETIRED_TemplateLocalVersion",vm:"1",version:"DICOM/retired"},"(0040,DB0B)":{tag:"(0040,DB0B)",vr:"CS",name:"RETIRED_TemplateExtensionFlag",vm:"1",version:"DICOM/retired"},"(0040,DB0C)":{tag:"(0040,DB0C)",vr:"UI",name:"RETIRED_TemplateExtensionOrganizationUID",vm:"1",version:"DICOM/retired"},"(0040,DB0D)":{tag:"(0040,DB0D)",vr:"UI",name:"RETIRED_TemplateExtensionCreatorUID",vm:"1",version:"DICOM/retired"},"(0054,1400)":{tag:"(0054,1400)",vr:"CS",name:"RETIRED_CountsIncluded",vm:"1-n",version:"DICOM/retired"},"(0054,1401)":{tag:"(0054,1401)",vr:"CS",name:"RETIRED_DeadTimeCorrectionFlag",vm:"1",version:"DICOM/retired"},"(0070,0040)":{tag:"(0070,0040)",vr:"IS",name:"RETIRED_ImageRotationRetired",vm:"1",version:"DICOM/retired"},"(0070,0050)":{tag:"(0070,0050)",vr:"US",name:"RETIRED_DisplayedAreaTopLeftHandCornerTrial",vm:"2",version:"DICOM/retired"},"(0070,0051)":{tag:"(0070,0051)",vr:"US",name:"RETIRED_DisplayedAreaBottomRightHandCornerTrial",vm:"2",version:"DICOM/retired"},"(0070,0067)":{tag:"(0070,0067)",vr:"US",name:"RETIRED_GraphicLayerRecommendedDisplayRGBValue",vm:"3",version:"DICOM/retired"},"(0074,1024)":{tag:"(0074,1024)",vr:"IS",name:"RETIRED_BeamOrderIndexTrial",vm:"1",version:"DICOM/retired"},"(0074,1038)":{tag:"(0074,1038)",vr:"DS",name:"RETIRED_DoubleExposureMetersetTrial",vm:"1",version:"DICOM/retired"},"(0074,103A)":{tag:"(0074,103A)",vr:"DS",name:"RETIRED_DoubleExposureFieldDeltaTrial",vm:"4",version:"DICOM/retired"},"(0074,1220)":{tag:"(0074,1220)",vr:"SQ",name:"RETIRED_RelatedProcedureStepSequence",vm:"1",version:"DICOM/retired"},"(0074,1222)":{tag:"(0074,1222)",vr:"LO",name:"RETIRED_ProcedureStepRelationshipType",vm:"1",version:"DICOM/retired"},"(0088,0904)":{tag:"(0088,0904)",vr:"LO",name:"RETIRED_TopicTitle",vm:"1",version:"DICOM/retired"},"(0088,0906)":{tag:"(0088,0906)",vr:"ST",name:"RETIRED_TopicSubject",vm:"1",version:"DICOM/retired"},"(0088,0910)":{tag:"(0088,0910)",vr:"LO",name:"RETIRED_TopicAuthor",vm:"1",version:"DICOM/retired"},"(0088,0912)":{tag:"(0088,0912)",vr:"LO",name:"RETIRED_TopicKeywords",vm:"1-32",version:"DICOM/retired"},"(1000,0010)":{tag:"(1000,0010)",vr:"US",name:"RETIRED_EscapeTriplet",vm:"3",version:"DICOM/retired"},"(1000,0011)":{tag:"(1000,0011)",vr:"US",name:"RETIRED_RunLengthTriplet",vm:"3",version:"DICOM/retired"},"(1000,0012)":{tag:"(1000,0012)",vr:"US",name:"RETIRED_HuffmanTableSize",vm:"1",version:"DICOM/retired"},"(1000,0013)":{tag:"(1000,0013)",vr:"US",name:"RETIRED_HuffmanTableTriplet",vm:"3",version:"DICOM/retired"},"(1000,0014)":{tag:"(1000,0014)",vr:"US",name:"RETIRED_ShiftTableSize",vm:"1",version:"DICOM/retired"},"(1000,0015)":{tag:"(1000,0015)",vr:"US",name:"RETIRED_ShiftTableTriplet",vm:"3",version:"DICOM/retired"},"(1010,0004)":{tag:"(1010,0004)",vr:"US",name:"RETIRED_ZonalMap",vm:"1-n",version:"DICOM/retired"},"(2000,0062)":{tag:"(2000,0062)",vr:"CS",name:"RETIRED_ColorImagePrintingFlag",vm:"1",version:"DICOM/retired"},"(2000,0063)":{tag:"(2000,0063)",vr:"CS",name:"RETIRED_CollationFlag",vm:"1",version:"DICOM/retired"},"(2000,0065)":{tag:"(2000,0065)",vr:"CS",name:"RETIRED_AnnotationFlag",vm:"1",version:"DICOM/retired"},"(2000,0067)":{tag:"(2000,0067)",vr:"CS",name:"RETIRED_ImageOverlayFlag",vm:"1",version:"DICOM/retired"},"(2000,0069)":{tag:"(2000,0069)",vr:"CS",name:"RETIRED_PresentationLUTFlag",vm:"1",version:"DICOM/retired"},"(2000,006A)":{tag:"(2000,006A)",vr:"CS",name:"RETIRED_ImageBoxPresentationLUTFlag",vm:"1",version:"DICOM/retired"},"(2000,0510)":{tag:"(2000,0510)",vr:"SQ",name:"RETIRED_ReferencedStoredPrintSequence",vm:"1",version:"DICOM/retired"},"(2020,0130)":{tag:"(2020,0130)",vr:"SQ",name:"RETIRED_ReferencedImageOverlayBoxSequence",vm:"1",version:"DICOM/retired"},"(2020,0140)":{tag:"(2020,0140)",vr:"SQ",name:"RETIRED_ReferencedVOILUTBoxSequence",vm:"1",version:"DICOM/retired"},"(2040,0010)":{tag:"(2040,0010)",vr:"SQ",name:"RETIRED_ReferencedOverlayPlaneSequence",vm:"1",version:"DICOM/retired"},"(2040,0011)":{tag:"(2040,0011)",vr:"US",name:"RETIRED_ReferencedOverlayPlaneGroups",vm:"1-99",version:"DICOM/retired"},"(2040,0020)":{tag:"(2040,0020)",vr:"SQ",name:"RETIRED_OverlayPixelDataSequence",vm:"1",version:"DICOM/retired"},"(2040,0060)":{tag:"(2040,0060)",vr:"CS",name:"RETIRED_OverlayMagnificationType",vm:"1",version:"DICOM/retired"},"(2040,0070)":{tag:"(2040,0070)",vr:"CS",name:"RETIRED_OverlaySmoothingType",vm:"1",version:"DICOM/retired"},"(2040,0072)":{tag:"(2040,0072)",vr:"CS",name:"RETIRED_OverlayOrImageMagnification",vm:"1",version:"DICOM/retired"},"(2040,0074)":{tag:"(2040,0074)",vr:"US",name:"RETIRED_MagnifyToNumberOfColumns",vm:"1",version:"DICOM/retired"},"(2040,0080)":{tag:"(2040,0080)",vr:"CS",name:"RETIRED_OverlayForegroundDensity",vm:"1",version:"DICOM/retired"},"(2040,0082)":{tag:"(2040,0082)",vr:"CS",name:"RETIRED_OverlayBackgroundDensity",vm:"1",version:"DICOM/retired"},"(2040,0090)":{tag:"(2040,0090)",vr:"CS",name:"RETIRED_OverlayMode",vm:"1",version:"DICOM/retired"},"(2040,0100)":{tag:"(2040,0100)",vr:"CS",name:"RETIRED_ThresholdDensity",vm:"1",version:"DICOM/retired"},"(2040,0500)":{tag:"(2040,0500)",vr:"SQ",name:"RETIRED_ReferencedImageBoxSequenceRetired",vm:"1",version:"DICOM/retired"},"(2100,0010)":{tag:"(2100,0010)",vr:"SH",name:"RETIRED_PrintJobID",vm:"1",version:"DICOM/retired"},"(2100,0140)":{tag:"(2100,0140)",vr:"AE",name:"RETIRED_DestinationAE",vm:"1",version:"DICOM/retired"},"(2100,0500)":{tag:"(2100,0500)",vr:"SQ",name:"RETIRED_ReferencedPrintJobSequencePullStoredPrint",vm:"1",version:"DICOM/retired"},"(2110,0099)":{tag:"(2110,0099)",vr:"SH",name:"RETIRED_PrintQueueID",vm:"1",version:"DICOM/retired"},"(2120,0010)":{tag:"(2120,0010)",vr:"CS",name:"RETIRED_QueueStatus",vm:"1",version:"DICOM/retired"},"(2120,0050)":{tag:"(2120,0050)",vr:"SQ",name:"RETIRED_PrintJobDescriptionSequence",vm:"1",version:"DICOM/retired"},"(2120,0070)":{tag:"(2120,0070)",vr:"SQ",name:"RETIRED_ReferencedPrintJobSequence",vm:"1",version:"DICOM/retired"},"(2130,0010)":{tag:"(2130,0010)",vr:"SQ",name:"RETIRED_PrintManagementCapabilitiesSequence",vm:"1",version:"DICOM/retired"},"(2130,0015)":{tag:"(2130,0015)",vr:"SQ",name:"RETIRED_PrinterCharacteristicsSequence",vm:"1",version:"DICOM/retired"},"(2130,0030)":{tag:"(2130,0030)",vr:"SQ",name:"RETIRED_FilmBoxContentSequence",vm:"1",version:"DICOM/retired"},"(2130,0040)":{tag:"(2130,0040)",vr:"SQ",name:"RETIRED_ImageBoxContentSequence",vm:"1",version:"DICOM/retired"},"(2130,0050)":{tag:"(2130,0050)",vr:"SQ",name:"RETIRED_AnnotationContentSequence",vm:"1",version:"DICOM/retired"},"(2130,0060)":{tag:"(2130,0060)",vr:"SQ",name:"RETIRED_ImageOverlayBoxContentSequence",vm:"1",version:"DICOM/retired"},"(2130,0080)":{tag:"(2130,0080)",vr:"SQ",name:"RETIRED_PresentationLUTContentSequence",vm:"1",version:"DICOM/retired"},"(2130,00A0)":{tag:"(2130,00A0)",vr:"SQ",name:"RETIRED_ProposedStudySequence",vm:"1",version:"DICOM/retired"},"(2130,00C0)":{tag:"(2130,00C0)",vr:"SQ",name:"RETIRED_OriginalImageSequence",vm:"1",version:"DICOM/retired"},"(3006,00C0)":{tag:"(3006,00C0)",vr:"SQ",name:"RETIRED_FrameOfReferenceRelationshipSequence",vm:"1",version:"DICOM/retired"},"(3006,00C2)":{tag:"(3006,00C2)",vr:"UI",name:"RETIRED_RelatedFrameOfReferenceUID",vm:"1",version:"DICOM/retired"},"(3006,00C4)":{tag:"(3006,00C4)",vr:"CS",name:"RETIRED_FrameOfReferenceTransformationType",vm:"1",version:"DICOM/retired"},"(300A,0088)":{tag:"(300A,0088)",vr:"FL",name:"RETIRED_BeamDosePointDepth",vm:"1",version:"DICOM/retired"},"(300A,0089)":{tag:"(300A,0089)",vr:"FL",name:"RETIRED_BeamDosePointEquivalentDepth",vm:"1",version:"DICOM/retired"},"(300A,008A)":{tag:"(300A,008A)",vr:"FL",name:"RETIRED_BeamDosePointSSD",vm:"1",version:"DICOM/retired"},"(4000,0010)":{tag:"(4000,0010)",vr:"LT",name:"RETIRED_Arbitrary",vm:"1",version:"DICOM/retired"},"(4000,4000)":{tag:"(4000,4000)",vr:"LT",name:"RETIRED_TextComments",vm:"1",version:"DICOM/retired"},"(4008,0040)":{tag:"(4008,0040)",vr:"SH",name:"RETIRED_ResultsID",vm:"1",version:"DICOM/retired"},"(4008,0042)":{tag:"(4008,0042)",vr:"LO",name:"RETIRED_ResultsIDIssuer",vm:"1",version:"DICOM/retired"},"(4008,0050)":{tag:"(4008,0050)",vr:"SQ",name:"RETIRED_ReferencedInterpretationSequence",vm:"1",version:"DICOM/retired"},"(4008,00FF)":{tag:"(4008,00FF)",vr:"CS",name:"RETIRED_ReportProductionStatusTrial",vm:"1",version:"DICOM/retired"},"(4008,0100)":{tag:"(4008,0100)",vr:"DA",name:"RETIRED_InterpretationRecordedDate",vm:"1",version:"DICOM/retired"},"(4008,0101)":{tag:"(4008,0101)",vr:"TM",name:"RETIRED_InterpretationRecordedTime",vm:"1",version:"DICOM/retired"},"(4008,0102)":{tag:"(4008,0102)",vr:"PN",name:"RETIRED_InterpretationRecorder",vm:"1",version:"DICOM/retired"},"(4008,0103)":{tag:"(4008,0103)",vr:"LO",name:"RETIRED_ReferenceToRecordedSound",vm:"1",version:"DICOM/retired"},"(4008,0108)":{tag:"(4008,0108)",vr:"DA",name:"RETIRED_InterpretationTranscriptionDate",vm:"1",version:"DICOM/retired"},"(4008,0109)":{tag:"(4008,0109)",vr:"TM",name:"RETIRED_InterpretationTranscriptionTime",vm:"1",version:"DICOM/retired"},"(4008,010A)":{tag:"(4008,010A)",vr:"PN",name:"RETIRED_InterpretationTranscriber",vm:"1",version:"DICOM/retired"},"(4008,010B)":{tag:"(4008,010B)",vr:"ST",name:"RETIRED_InterpretationText",vm:"1",version:"DICOM/retired"},"(4008,010C)":{tag:"(4008,010C)",vr:"PN",name:"RETIRED_InterpretationAuthor",vm:"1",version:"DICOM/retired"},"(4008,0111)":{tag:"(4008,0111)",vr:"SQ",name:"RETIRED_InterpretationApproverSequence",vm:"1",version:"DICOM/retired"},"(4008,0112)":{tag:"(4008,0112)",vr:"DA",name:"RETIRED_InterpretationApprovalDate",vm:"1",version:"DICOM/retired"},"(4008,0113)":{tag:"(4008,0113)",vr:"TM",name:"RETIRED_InterpretationApprovalTime",vm:"1",version:"DICOM/retired"},"(4008,0114)":{tag:"(4008,0114)",vr:"PN",name:"RETIRED_PhysicianApprovingInterpretation",vm:"1",version:"DICOM/retired"},"(4008,0115)":{tag:"(4008,0115)",vr:"LT",name:"RETIRED_InterpretationDiagnosisDescription",vm:"1",version:"DICOM/retired"},"(4008,0117)":{tag:"(4008,0117)",vr:"SQ",name:"RETIRED_InterpretationDiagnosisCodeSequence",vm:"1",version:"DICOM/retired"},"(4008,0118)":{tag:"(4008,0118)",vr:"SQ",name:"RETIRED_ResultsDistributionListSequence",vm:"1",version:"DICOM/retired"},"(4008,0119)":{tag:"(4008,0119)",vr:"PN",name:"RETIRED_DistributionName",vm:"1",version:"DICOM/retired"},"(4008,011A)":{tag:"(4008,011A)",vr:"LO",name:"RETIRED_DistributionAddress",vm:"1",version:"DICOM/retired"},"(4008,0200)":{tag:"(4008,0200)",vr:"SH",name:"RETIRED_InterpretationID",vm:"1",version:"DICOM/retired"},"(4008,0202)":{tag:"(4008,0202)",vr:"LO",name:"RETIRED_InterpretationIDIssuer",vm:"1",version:"DICOM/retired"},"(4008,0210)":{tag:"(4008,0210)",vr:"CS",name:"RETIRED_InterpretationTypeID",vm:"1",version:"DICOM/retired"},"(4008,0212)":{tag:"(4008,0212)",vr:"CS",name:"RETIRED_InterpretationStatusID",vm:"1",version:"DICOM/retired"},"(4008,0300)":{tag:"(4008,0300)",vr:"ST",name:"RETIRED_Impressions",vm:"1",version:"DICOM/retired"},"(4008,4000)":{tag:"(4008,4000)",vr:"ST",name:"RETIRED_ResultsComments",vm:"1",version:"DICOM/retired"},"(5000-50FF,0005)":{tag:"(5000-50FF,0005)",vr:"US",name:"RETIRED_CurveDimensions",vm:"1",version:"DICOM/retired"},"(5000-50FF,0010)":{tag:"(5000-50FF,0010)",vr:"US",name:"RETIRED_NumberOfPoints",vm:"1",version:"DICOM/retired"},"(5000-50FF,0020)":{tag:"(5000-50FF,0020)",vr:"CS",name:"RETIRED_TypeOfData",vm:"1",version:"DICOM/retired"},"(5000-50FF,0022)":{tag:"(5000-50FF,0022)",vr:"LO",name:"RETIRED_CurveDescription",vm:"1",version:"DICOM/retired"},"(5000-50FF,0030)":{tag:"(5000-50FF,0030)",vr:"SH",name:"RETIRED_AxisUnits",vm:"1-n",version:"DICOM/retired"},"(5000-50FF,0040)":{tag:"(5000-50FF,0040)",vr:"SH",name:"RETIRED_AxisLabels",vm:"1-n",version:"DICOM/retired"},"(5000-50FF,0103)":{tag:"(5000-50FF,0103)",vr:"US",name:"RETIRED_DataValueRepresentation",vm:"1",version:"DICOM/retired"},"(5000-50FF,0104)":{tag:"(5000-50FF,0104)",vr:"US",name:"RETIRED_MinimumCoordinateValue",vm:"1-n",version:"DICOM/retired"},"(5000-50FF,0105)":{tag:"(5000-50FF,0105)",vr:"US",name:"RETIRED_MaximumCoordinateValue",vm:"1-n",version:"DICOM/retired"},"(5000-50FF,0106)":{tag:"(5000-50FF,0106)",vr:"SH",name:"RETIRED_CurveRange",vm:"1-n",version:"DICOM/retired"},"(5000-50FF,0110)":{tag:"(5000-50FF,0110)",vr:"US",name:"RETIRED_CurveDataDescriptor",vm:"1-n",version:"DICOM/retired"},"(5000-50FF,0112)":{tag:"(5000-50FF,0112)",vr:"US",name:"RETIRED_CoordinateStartValue",vm:"1-n",version:"DICOM/retired"},"(5000-50FF,0114)":{tag:"(5000-50FF,0114)",vr:"US",name:"RETIRED_CoordinateStepValue",vm:"1-n",version:"DICOM/retired"},"(5000-50FF,1001)":{tag:"(5000-50FF,1001)",vr:"CS",name:"RETIRED_CurveActivationLayer",vm:"1",version:"DICOM/retired"},"(5000-50FF,2000)":{tag:"(5000-50FF,2000)",vr:"US",name:"RETIRED_AudioType",vm:"1",version:"DICOM/retired"},"(5000-50FF,2002)":{tag:"(5000-50FF,2002)",vr:"US",name:"RETIRED_AudioSampleFormat",vm:"1",version:"DICOM/retired"},"(5000-50FF,2004)":{tag:"(5000-50FF,2004)",vr:"US",name:"RETIRED_NumberOfChannels",vm:"1",version:"DICOM/retired"},"(5000-50FF,2006)":{tag:"(5000-50FF,2006)",vr:"UL",name:"RETIRED_NumberOfSamples",vm:"1",version:"DICOM/retired"},"(5000-50FF,2008)":{tag:"(5000-50FF,2008)",vr:"UL",name:"RETIRED_SampleRate",vm:"1",version:"DICOM/retired"},"(5000-50FF,200A)":{tag:"(5000-50FF,200A)",vr:"UL",name:"RETIRED_TotalTime",vm:"1",version:"DICOM/retired"},"(5000-50FF,200C)":{tag:"(5000-50FF,200C)",vr:"ox",name:"RETIRED_AudioSampleData",vm:"1",version:"DICOM/retired"},"(5000-50FF,200E)":{tag:"(5000-50FF,200E)",vr:"LT",name:"RETIRED_AudioComments",vm:"1",version:"DICOM/retired"},"(5000-50FF,2500)":{tag:"(5000-50FF,2500)",vr:"LO",name:"RETIRED_CurveLabel",vm:"1",version:"DICOM/retired"},"(5000-50FF,2600)":{tag:"(5000-50FF,2600)",vr:"SQ",name:"RETIRED_CurveReferencedOverlaySequence",vm:"1",version:"DICOM/retired"},"(5000-50FF,2610)":{tag:"(5000-50FF,2610)",vr:"US",name:"RETIRED_CurveReferencedOverlayGroup",vm:"1",version:"DICOM/retired"},"(5000-50FF,3000)":{tag:"(5000-50FF,3000)",vr:"ox",name:"RETIRED_CurveData",vm:"1",version:"DICOM/retired"},"(6000-60FF,0012)":{tag:"(6000-60FF,0012)",vr:"US",name:"RETIRED_OverlayPlanes",vm:"1",version:"DICOM/retired"},"(6000-60FF,0052)":{tag:"(6000-60FF,0052)",vr:"US",name:"RETIRED_OverlayPlaneOrigin",vm:"1",version:"DICOM/retired"},"(6000-60FF,0060)":{tag:"(6000-60FF,0060)",vr:"CS",name:"RETIRED_OverlayCompressionCode",vm:"1",version:"DICOM/retired"},"(6000-60FF,0061)":{tag:"(6000-60FF,0061)",vr:"SH",name:"RETIRED_OverlayCompressionOriginator",vm:"1",version:"DICOM/retired"},"(6000-60FF,0062)":{tag:"(6000-60FF,0062)",vr:"SH",name:"RETIRED_OverlayCompressionLabel",vm:"1",version:"DICOM/retired"},"(6000-60FF,0063)":{tag:"(6000-60FF,0063)",vr:"CS",name:"RETIRED_OverlayCompressionDescription",vm:"1",version:"DICOM/retired"},"(6000-60FF,0066)":{tag:"(6000-60FF,0066)",vr:"AT",name:"RETIRED_OverlayCompressionStepPointers",vm:"1-n",version:"DICOM/retired"},"(6000-60FF,0068)":{tag:"(6000-60FF,0068)",vr:"US",name:"RETIRED_OverlayRepeatInterval",vm:"1",version:"DICOM/retired"},"(6000-60FF,0069)":{tag:"(6000-60FF,0069)",vr:"US",name:"RETIRED_OverlayBitsGrouped",vm:"1",version:"DICOM/retired"},"(6000-60FF,0110)":{tag:"(6000-60FF,0110)",vr:"CS",name:"RETIRED_OverlayFormat",vm:"1",version:"DICOM/retired"},"(6000-60FF,0200)":{tag:"(6000-60FF,0200)",vr:"US",name:"RETIRED_OverlayLocation",vm:"1",version:"DICOM/retired"},"(6000-60FF,0800)":{tag:"(6000-60FF,0800)",vr:"CS",name:"RETIRED_OverlayCodeLabel",vm:"1-n",version:"DICOM/retired"},"(6000-60FF,0802)":{tag:"(6000-60FF,0802)",vr:"US",name:"RETIRED_OverlayNumberOfTables",vm:"1",version:"DICOM/retired"},"(6000-60FF,0803)":{tag:"(6000-60FF,0803)",vr:"AT",name:"RETIRED_OverlayCodeTableLocation",vm:"1-n",version:"DICOM/retired"},"(6000-60FF,0804)":{tag:"(6000-60FF,0804)",vr:"US",name:"RETIRED_OverlayBitsForCodeWord",vm:"1",version:"DICOM/retired"},"(6000-60FF,1100)":{tag:"(6000-60FF,1100)",vr:"US",name:"RETIRED_OverlayDescriptorGray",vm:"1",version:"DICOM/retired"},"(6000-60FF,1101)":{tag:"(6000-60FF,1101)",vr:"US",name:"RETIRED_OverlayDescriptorRed",vm:"1",version:"DICOM/retired"},"(6000-60FF,1102)":{tag:"(6000-60FF,1102)",vr:"US",name:"RETIRED_OverlayDescriptorGreen",vm:"1",version:"DICOM/retired"},"(6000-60FF,1103)":{tag:"(6000-60FF,1103)",vr:"US",name:"RETIRED_OverlayDescriptorBlue",vm:"1",version:"DICOM/retired"},"(6000-60FF,1200)":{tag:"(6000-60FF,1200)",vr:"US",name:"RETIRED_OverlaysGray",vm:"1-n",version:"DICOM/retired"},"(6000-60FF,1201)":{tag:"(6000-60FF,1201)",vr:"US",name:"RETIRED_OverlaysRed",vm:"1-n",version:"DICOM/retired"},"(6000-60FF,1202)":{tag:"(6000-60FF,1202)",vr:"US",name:"RETIRED_OverlaysGreen",vm:"1-n",version:"DICOM/retired"},"(6000-60FF,1203)":{tag:"(6000-60FF,1203)",vr:"US",name:"RETIRED_OverlaysBlue",vm:"1-n",version:"DICOM/retired"},"(6000-60FF,4000)":{tag:"(6000-60FF,4000)",vr:"LT",name:"RETIRED_OverlayComments",vm:"1",version:"DICOM/retired"},"(7FE0,0020)":{tag:"(7FE0,0020)",vr:"OW",name:"RETIRED_CoefficientsSDVN",vm:"1",version:"DICOM/retired"},"(7FE0,0030)":{tag:"(7FE0,0030)",vr:"OW",name:"RETIRED_CoefficientsSDHN",vm:"1",version:"DICOM/retired"},"(7FE0,0040)":{tag:"(7FE0,0040)",vr:"OW",name:"RETIRED_CoefficientsSDDN",vm:"1",version:"DICOM/retired"},"(7F00-7FFF,0010)":{tag:"(7F00-7FFF,0010)",vr:"ox",name:"RETIRED_VariablePixelData",vm:"1",version:"DICOM/retired"},"(7F00-7FFF,0011)":{tag:"(7F00-7FFF,0011)",vr:"US",name:"RETIRED_VariableNextDataGroup",vm:"1",version:"DICOM/retired"},"(7F00-7FFF,0020)":{tag:"(7F00-7FFF,0020)",vr:"OW",name:"RETIRED_VariableCoefficientsSDVN",vm:"1",version:"DICOM/retired"},"(7F00-7FFF,0030)":{tag:"(7F00-7FFF,0030)",vr:"OW",name:"RETIRED_VariableCoefficientsSDHN",vm:"1",version:"DICOM/retired"},"(7F00-7FFF,0040)":{tag:"(7F00-7FFF,0040)",vr:"OW",name:"RETIRED_VariableCoefficientsSDDN",vm:"1",version:"DICOM/retired"},"":{tag:""},'(0019,"1.2.840.113681",10)':{tag:'(0019,"1.2.840.113681",10)',vr:"ST",name:"CRImageParamsCommon",vm:"1",version:"PrivateTag"},'(0019,"1.2.840.113681",11)':{tag:'(0019,"1.2.840.113681",11)',vr:"ST",name:"CRImageIPParamsSingle",vm:"1",version:"PrivateTag"},'(0019,"1.2.840.113681",12)':{tag:'(0019,"1.2.840.113681",12)',vr:"ST",name:"CRImageIPParamsLeft",vm:"1",version:"PrivateTag"},'(0019,"1.2.840.113681",13)':{tag:'(0019,"1.2.840.113681",13)',vr:"ST",name:"CRImageIPParamsRight",vm:"1",version:"PrivateTag"},'(0087,"1.2.840.113708.794.1.1.2.0",10)':{tag:'(0087,"1.2.840.113708.794.1.1.2.0",10)',vr:"CS",name:"MediaType",vm:"1",version:"PrivateTag"},'(0087,"1.2.840.113708.794.1.1.2.0",20)':{tag:'(0087,"1.2.840.113708.794.1.1.2.0",20)',vr:"CS",name:"MediaLocation",vm:"1",version:"PrivateTag"},'(0087,"1.2.840.113708.794.1.1.2.0",50)':{tag:'(0087,"1.2.840.113708.794.1.1.2.0",50)',vr:"IS",name:"EstimatedRetrieveTime",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",00)':{tag:'(0009,"ACUSON",00)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",01)':{tag:'(0009,"ACUSON",01)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",02)':{tag:'(0009,"ACUSON",02)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",03)':{tag:'(0009,"ACUSON",03)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",04)':{tag:'(0009,"ACUSON",04)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",05)':{tag:'(0009,"ACUSON",05)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",06)':{tag:'(0009,"ACUSON",06)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",07)':{tag:'(0009,"ACUSON",07)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",08)':{tag:'(0009,"ACUSON",08)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",09)':{tag:'(0009,"ACUSON",09)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",0a)':{tag:'(0009,"ACUSON",0a)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",0b)':{tag:'(0009,"ACUSON",0b)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",0c)':{tag:'(0009,"ACUSON",0c)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",0d)':{tag:'(0009,"ACUSON",0d)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",0e)':{tag:'(0009,"ACUSON",0e)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",0f)':{tag:'(0009,"ACUSON",0f)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",10)':{tag:'(0009,"ACUSON",10)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",11)':{tag:'(0009,"ACUSON",11)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",12)':{tag:'(0009,"ACUSON",12)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",13)':{tag:'(0009,"ACUSON",13)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",14)':{tag:'(0009,"ACUSON",14)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ACUSON",15)':{tag:'(0009,"ACUSON",15)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0003,"AEGIS_DICOM_2.00",00)':{tag:'(0003,"AEGIS_DICOM_2.00",00)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0005,"AEGIS_DICOM_2.00",00)':{tag:'(0005,"AEGIS_DICOM_2.00",00)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0009,"AEGIS_DICOM_2.00",00)':{tag:'(0009,"AEGIS_DICOM_2.00",00)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"AEGIS_DICOM_2.00",00)':{tag:'(0019,"AEGIS_DICOM_2.00",00)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0029,"AEGIS_DICOM_2.00",00)':{tag:'(0029,"AEGIS_DICOM_2.00",00)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(1369,"AEGIS_DICOM_2.00",00)':{tag:'(1369,"AEGIS_DICOM_2.00",00)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0009,"AGFA",10)':{tag:'(0009,"AGFA",10)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"AGFA",11)':{tag:'(0009,"AGFA",11)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"AGFA",13)':{tag:'(0009,"AGFA",13)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"AGFA",14)':{tag:'(0009,"AGFA",14)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"AGFA",15)':{tag:'(0009,"AGFA",15)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0031,"AGFA PACS Archive Mirroring 1.0",00)':{tag:'(0031,"AGFA PACS Archive Mirroring 1.0",00)',vr:"CS",name:"StudyStatus",vm:"1",version:"PrivateTag"},'(0031,"AGFA PACS Archive Mirroring 1.0",01)':{tag:'(0031,"AGFA PACS Archive Mirroring 1.0",01)',vr:"UL",name:"DateTimeVerified",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS IP",10)':{tag:'(0029,"CAMTRONICS IP",10)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS IP",20)':{tag:'(0029,"CAMTRONICS IP",20)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS IP",30)':{tag:'(0029,"CAMTRONICS IP",30)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS IP",40)':{tag:'(0029,"CAMTRONICS IP",40)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS",10)':{tag:'(0029,"CAMTRONICS",10)',vr:"LT",name:"Commentline",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS",20)':{tag:'(0029,"CAMTRONICS",20)',vr:"DS",name:"EdgeEnhancementCoefficient",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS",50)':{tag:'(0029,"CAMTRONICS",50)',vr:"LT",name:"SceneText",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS",60)':{tag:'(0029,"CAMTRONICS",60)',vr:"LT",name:"ImageText",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS",70)':{tag:'(0029,"CAMTRONICS",70)',vr:"IS",name:"PixelShiftHorizontal",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS",80)':{tag:'(0029,"CAMTRONICS",80)',vr:"IS",name:"PixelShiftVertical",vm:"1",version:"PrivateTag"},'(0029,"CAMTRONICS",90)':{tag:'(0029,"CAMTRONICS",90)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"CARDIO-D.R. 1.0",00)':{tag:'(0009,"CARDIO-D.R. 1.0",00)',vr:"UL",name:"FileLocation",vm:"1",version:"PrivateTag"},'(0009,"CARDIO-D.R. 1.0",01)':{tag:'(0009,"CARDIO-D.R. 1.0",01)',vr:"UL",name:"FileSize",vm:"1",version:"PrivateTag"},'(0009,"CARDIO-D.R. 1.0",40)':{tag:'(0009,"CARDIO-D.R. 1.0",40)',vr:"SQ",name:"AlternateImageSequence",vm:"1",version:"PrivateTag"},'(0019,"CARDIO-D.R. 1.0",00)':{tag:'(0019,"CARDIO-D.R. 1.0",00)',vr:"CS",name:"ImageBlankingShape",vm:"1",version:"PrivateTag"},'(0019,"CARDIO-D.R. 1.0",02)':{tag:'(0019,"CARDIO-D.R. 1.0",02)',vr:"IS",name:"ImageBlankingLeftVerticalEdge",vm:"1",version:"PrivateTag"},'(0019,"CARDIO-D.R. 1.0",04)':{tag:'(0019,"CARDIO-D.R. 1.0",04)',vr:"IS",name:"ImageBlankingRightVerticalEdge",vm:"1",version:"PrivateTag"},'(0019,"CARDIO-D.R. 1.0",06)':{tag:'(0019,"CARDIO-D.R. 1.0",06)',vr:"IS",name:"ImageBlankingUpperHorizontalEdge",vm:"1",version:"PrivateTag"},'(0019,"CARDIO-D.R. 1.0",08)':{tag:'(0019,"CARDIO-D.R. 1.0",08)',vr:"IS",name:"ImageBlankingLowerHorizontalEdge",vm:"1",version:"PrivateTag"},'(0019,"CARDIO-D.R. 1.0",10)':{tag:'(0019,"CARDIO-D.R. 1.0",10)',vr:"IS",name:"CenterOfCircularImageBlanking",vm:"1",version:"PrivateTag"},'(0019,"CARDIO-D.R. 1.0",12)':{tag:'(0019,"CARDIO-D.R. 1.0",12)',vr:"IS",name:"RadiusOfCircularImageBlanking",vm:"1",version:"PrivateTag"},'(0019,"CARDIO-D.R. 1.0",30)':{tag:'(0019,"CARDIO-D.R. 1.0",30)',vr:"UL",name:"MaximumImageFrameSize",vm:"1",version:"PrivateTag"},'(0021,"CARDIO-D.R. 1.0",13)':{tag:'(0021,"CARDIO-D.R. 1.0",13)',vr:"IS",name:"ImageSequenceNumber",vm:"1",version:"PrivateTag"},'(0029,"CARDIO-D.R. 1.0",00)':{tag:'(0029,"CARDIO-D.R. 1.0",00)',vr:"SQ",name:"EdgeEnhancementSequence",vm:"1",version:"PrivateTag"},'(0029,"CARDIO-D.R. 1.0",01)':{tag:'(0029,"CARDIO-D.R. 1.0",01)',vr:"US",name:"ConvolutionKernelSize",vm:"2",version:"PrivateTag"},'(0029,"CARDIO-D.R. 1.0",02)':{tag:'(0029,"CARDIO-D.R. 1.0",02)',vr:"DS",name:"ConvolutionKernelCoefficients",vm:"1-n",version:"PrivateTag"},'(0029,"CARDIO-D.R. 1.0",03)':{tag:'(0029,"CARDIO-D.R. 1.0",03)',vr:"DS",name:"EdgeEnhancementGain",vm:"1",version:"PrivateTag"},'(0025,"CMR42 CIRCLECVI",1010)':{tag:'(0025,"CMR42 CIRCLECVI",1010)',vr:"LO",name:"WorkspaceID",vm:"1",version:"PrivateTag"},'(0025,"CMR42 CIRCLECVI",1020)':{tag:'(0025,"CMR42 CIRCLECVI",1020)',vr:"LO",name:"WorkspaceTimeString",vm:"1",version:"PrivateTag"},'(0025,"CMR42 CIRCLECVI",1030)':{tag:'(0025,"CMR42 CIRCLECVI",1030)',vr:"OB",name:"WorkspaceStream",vm:"1",version:"PrivateTag"},'(0009,"DCMTK_ANONYMIZER",00)':{tag:'(0009,"DCMTK_ANONYMIZER",00)',vr:"SQ",name:"AnonymizerUIDMap",vm:"1",version:"PrivateTag"},'(0009,"DCMTK_ANONYMIZER",10)':{tag:'(0009,"DCMTK_ANONYMIZER",10)',vr:"UI",name:"AnonymizerUIDKey",vm:"1",version:"PrivateTag"},'(0009,"DCMTK_ANONYMIZER",20)':{tag:'(0009,"DCMTK_ANONYMIZER",20)',vr:"UI",name:"AnonymizerUIDValue",vm:"1",version:"PrivateTag"},'(0009,"DCMTK_ANONYMIZER",30)':{tag:'(0009,"DCMTK_ANONYMIZER",30)',vr:"SQ",name:"AnonymizerPatientIDMap",vm:"1",version:"PrivateTag"},'(0009,"DCMTK_ANONYMIZER",40)':{tag:'(0009,"DCMTK_ANONYMIZER",40)',vr:"LO",name:"AnonymizerPatientIDKey",vm:"1",version:"PrivateTag"},'(0009,"DCMTK_ANONYMIZER",50)':{tag:'(0009,"DCMTK_ANONYMIZER",50)',vr:"LO",name:"AnonymizerPatientIDValue",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",22)':{tag:'(0019,"DIDI TO PCR 1.1",22)',vr:"UN",name:"RouteAET",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",23)':{tag:'(0019,"DIDI TO PCR 1.1",23)',vr:"DS",name:"PCRPrintScale",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",24)':{tag:'(0019,"DIDI TO PCR 1.1",24)',vr:"UN",name:"PCRPrintJobEnd",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",25)':{tag:'(0019,"DIDI TO PCR 1.1",25)',vr:"IS",name:"PCRNoFilmCopies",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",26)':{tag:'(0019,"DIDI TO PCR 1.1",26)',vr:"IS",name:"PCRFilmLayoutPosition",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",27)':{tag:'(0019,"DIDI TO PCR 1.1",27)',vr:"UN",name:"PCRPrintReportName",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",70)':{tag:'(0019,"DIDI TO PCR 1.1",70)',vr:"UN",name:"RADProtocolPrinter",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",71)':{tag:'(0019,"DIDI TO PCR 1.1",71)',vr:"UN",name:"RADProtocolMedium",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",90)':{tag:'(0019,"DIDI TO PCR 1.1",90)',vr:"LO",name:"UnprocessedFlag",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",91)':{tag:'(0019,"DIDI TO PCR 1.1",91)',vr:"UN",name:"KeyValues",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",92)':{tag:'(0019,"DIDI TO PCR 1.1",92)',vr:"UN",name:"DestinationPostprocessingFunction",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A0)':{tag:'(0019,"DIDI TO PCR 1.1",A0)',vr:"UN",name:"Version",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A1)':{tag:'(0019,"DIDI TO PCR 1.1",A1)',vr:"UN",name:"RangingMode",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A2)':{tag:'(0019,"DIDI TO PCR 1.1",A2)',vr:"UN",name:"AbdomenBrightness",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A3)':{tag:'(0019,"DIDI TO PCR 1.1",A3)',vr:"UN",name:"FixedBrightness",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A4)':{tag:'(0019,"DIDI TO PCR 1.1",A4)',vr:"UN",name:"DetailContrast",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A5)':{tag:'(0019,"DIDI TO PCR 1.1",A5)',vr:"UN",name:"ContrastBalance",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A6)':{tag:'(0019,"DIDI TO PCR 1.1",A6)',vr:"UN",name:"StructureBoost",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A7)':{tag:'(0019,"DIDI TO PCR 1.1",A7)',vr:"UN",name:"StructurePreference",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A8)':{tag:'(0019,"DIDI TO PCR 1.1",A8)',vr:"UN",name:"NoiseRobustness",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",A9)':{tag:'(0019,"DIDI TO PCR 1.1",A9)',vr:"UN",name:"NoiseDoseLimit",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",AA)':{tag:'(0019,"DIDI TO PCR 1.1",AA)',vr:"UN",name:"NoiseDoseStep",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",AB)':{tag:'(0019,"DIDI TO PCR 1.1",AB)',vr:"UN",name:"NoiseFrequencyLimit",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",AC)':{tag:'(0019,"DIDI TO PCR 1.1",AC)',vr:"UN",name:"WeakContrastLimit",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",AD)':{tag:'(0019,"DIDI TO PCR 1.1",AD)',vr:"UN",name:"StrongContrastLimit",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",AE)':{tag:'(0019,"DIDI TO PCR 1.1",AE)',vr:"UN",name:"StructureBoostOffset",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",AF)':{tag:'(0019,"DIDI TO PCR 1.1",AF)',vr:"UN",name:"SmoothGain",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",B0)':{tag:'(0019,"DIDI TO PCR 1.1",B0)',vr:"UN",name:"MeasureField1",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",B1)':{tag:'(0019,"DIDI TO PCR 1.1",B1)',vr:"UN",name:"MeasureField2",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",B2)':{tag:'(0019,"DIDI TO PCR 1.1",B2)',vr:"UN",name:"KeyPercentile1",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",B3)':{tag:'(0019,"DIDI TO PCR 1.1",B3)',vr:"UN",name:"KeyPercentile2",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",B4)':{tag:'(0019,"DIDI TO PCR 1.1",B4)',vr:"UN",name:"DensityLUT",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",B5)':{tag:'(0019,"DIDI TO PCR 1.1",B5)',vr:"UN",name:"Brightness",vm:"1",version:"PrivateTag"},'(0019,"DIDI TO PCR 1.1",B6)':{tag:'(0019,"DIDI TO PCR 1.1",B6)',vr:"UN",name:"Gamma",vm:"1",version:"PrivateTag"},'(0089,"DIDI TO PCR 1.1",10)':{tag:'(0089,"DIDI TO PCR 1.1",10)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"DIGISCAN IMAGE",31)':{tag:'(0029,"DIGISCAN IMAGE",31)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0029,"DIGISCAN IMAGE",32)':{tag:'(0029,"DIGISCAN IMAGE",32)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0029,"DIGISCAN IMAGE",33)':{tag:'(0029,"DIGISCAN IMAGE",33)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"DIGISCAN IMAGE",34)':{tag:'(0029,"DIGISCAN IMAGE",34)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(7001-o-70ff,"DLX_ANNOT_01",04)':{tag:'(7001-o-70ff,"DLX_ANNOT_01",04)',vr:"ST",name:"TextAnnotation",vm:"1",version:"PrivateTag"},'(7001-o-70ff,"DLX_ANNOT_01",05)':{tag:'(7001-o-70ff,"DLX_ANNOT_01",05)',vr:"IS",name:"Box",vm:"2",version:"PrivateTag"},'(7001-o-70ff,"DLX_ANNOT_01",07)':{tag:'(7001-o-70ff,"DLX_ANNOT_01",07)',vr:"IS",name:"ArrowEnd",vm:"2",version:"PrivateTag"},'(0015,"DLX_EXAMS_01",01)':{tag:'(0015,"DLX_EXAMS_01",01)',vr:"DS",name:"StenosisCalibrationRatio",vm:"1",version:"PrivateTag"},'(0015,"DLX_EXAMS_01",02)':{tag:'(0015,"DLX_EXAMS_01",02)',vr:"DS",name:"StenosisMagnification",vm:"1",version:"PrivateTag"},'(0015,"DLX_EXAMS_01",03)':{tag:'(0015,"DLX_EXAMS_01",03)',vr:"DS",name:"CardiacCalibrationRatio",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"DLX_LKUP_01",01)':{tag:'(6001-o-60ff,"DLX_LKUP_01",01)',vr:"US",name:"GrayPaletteColorLookupTableDescriptor",vm:"3",version:"PrivateTag"},'(6001-o-60ff,"DLX_LKUP_01",02)':{tag:'(6001-o-60ff,"DLX_LKUP_01",02)',vr:"US",name:"GrayPaletteColorLookupTableData",vm:"1",version:"PrivateTag"},'(0011,"DLX_PATNT_01",01)':{tag:'(0011,"DLX_PATNT_01",01)',vr:"LT",name:"PatientDOB",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",01)':{tag:'(0019,"DLX_SERIE_01",01)',vr:"DS",name:"AngleValueLArm",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",02)':{tag:'(0019,"DLX_SERIE_01",02)',vr:"DS",name:"AngleValuePArm",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",03)':{tag:'(0019,"DLX_SERIE_01",03)',vr:"DS",name:"AngleValueCArm",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",04)':{tag:'(0019,"DLX_SERIE_01",04)',vr:"CS",name:"AngleLabelLArm",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",05)':{tag:'(0019,"DLX_SERIE_01",05)',vr:"CS",name:"AngleLabelPArm",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",06)':{tag:'(0019,"DLX_SERIE_01",06)',vr:"CS",name:"AngleLabelCArm",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",07)':{tag:'(0019,"DLX_SERIE_01",07)',vr:"ST",name:"ProcedureName",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",08)':{tag:'(0019,"DLX_SERIE_01",08)',vr:"ST",name:"ExamName",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",09)':{tag:'(0019,"DLX_SERIE_01",09)',vr:"SH",name:"PatientSize",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",0a)':{tag:'(0019,"DLX_SERIE_01",0a)',vr:"IS",name:"RecordView",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",10)':{tag:'(0019,"DLX_SERIE_01",10)',vr:"DS",name:"InjectorDelay",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",11)':{tag:'(0019,"DLX_SERIE_01",11)',vr:"CS",name:"AutoInject",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",14)':{tag:'(0019,"DLX_SERIE_01",14)',vr:"IS",name:"AcquisitionMode",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",15)':{tag:'(0019,"DLX_SERIE_01",15)',vr:"CS",name:"CameraRotationEnabled",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",16)':{tag:'(0019,"DLX_SERIE_01",16)',vr:"CS",name:"ReverseSweep",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",17)':{tag:'(0019,"DLX_SERIE_01",17)',vr:"IS",name:"SpatialFilterStrength",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",18)':{tag:'(0019,"DLX_SERIE_01",18)',vr:"IS",name:"ZoomFactor",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",19)':{tag:'(0019,"DLX_SERIE_01",19)',vr:"IS",name:"XZoomCenter",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",1a)':{tag:'(0019,"DLX_SERIE_01",1a)',vr:"IS",name:"YZoomCenter",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",1b)':{tag:'(0019,"DLX_SERIE_01",1b)',vr:"DS",name:"Focus",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",1c)':{tag:'(0019,"DLX_SERIE_01",1c)',vr:"CS",name:"Dose",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",1d)':{tag:'(0019,"DLX_SERIE_01",1d)',vr:"IS",name:"SideMark",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",1e)':{tag:'(0019,"DLX_SERIE_01",1e)',vr:"IS",name:"PercentageLandscape",vm:"1",version:"PrivateTag"},'(0019,"DLX_SERIE_01",1f)':{tag:'(0019,"DLX_SERIE_01",1f)',vr:"DS",name:"ExposureDuration",vm:"1",version:"PrivateTag"},'(00E1,"ELSCINT1",01)':{tag:'(00E1,"ELSCINT1",01)',vr:"US",name:"DataDictionaryVersion",vm:"1",version:"PrivateTag"},'(00E1,"ELSCINT1",14)':{tag:'(00E1,"ELSCINT1",14)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(00E1,"ELSCINT1",22)':{tag:'(00E1,"ELSCINT1",22)',vr:"DS",name:"Unknown",vm:"2",version:"PrivateTag"},'(00E1,"ELSCINT1",23)':{tag:'(00E1,"ELSCINT1",23)',vr:"DS",name:"Unknown",vm:"2",version:"PrivateTag"},'(00E1,"ELSCINT1",24)':{tag:'(00E1,"ELSCINT1",24)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(00E1,"ELSCINT1",25)':{tag:'(00E1,"ELSCINT1",25)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(00E1,"ELSCINT1",40)':{tag:'(00E1,"ELSCINT1",40)',vr:"SH",name:"OffsetFromCTMRImages",vm:"1",version:"PrivateTag"},'(0601,"ELSCINT1",00)':{tag:'(0601,"ELSCINT1",00)',vr:"SH",name:"ImplementationVersion",vm:"1",version:"PrivateTag"},'(0601,"ELSCINT1",20)':{tag:'(0601,"ELSCINT1",20)',vr:"DS",name:"RelativeTablePosition",vm:"1",version:"PrivateTag"},'(0601,"ELSCINT1",21)':{tag:'(0601,"ELSCINT1",21)',vr:"DS",name:"RelativeTableHeight",vm:"1",version:"PrivateTag"},'(0601,"ELSCINT1",30)':{tag:'(0601,"ELSCINT1",30)',vr:"SH",name:"SurviewDirection",vm:"1",version:"PrivateTag"},'(0601,"ELSCINT1",31)':{tag:'(0601,"ELSCINT1",31)',vr:"DS",name:"SurviewLength",vm:"1",version:"PrivateTag"},'(0601,"ELSCINT1",50)':{tag:'(0601,"ELSCINT1",50)',vr:"SH",name:"ImageViewType",vm:"1",version:"PrivateTag"},'(0601,"ELSCINT1",70)':{tag:'(0601,"ELSCINT1",70)',vr:"DS",name:"BatchNumber",vm:"1",version:"PrivateTag"},'(0601,"ELSCINT1",71)':{tag:'(0601,"ELSCINT1",71)',vr:"DS",name:"BatchSize",vm:"1",version:"PrivateTag"},'(0601,"ELSCINT1",72)':{tag:'(0601,"ELSCINT1",72)',vr:"DS",name:"BatchSliceNumber",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",04)':{tag:'(0009,"FDMS 1.0",04)',vr:"SH",name:"ImageControlUnit",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",05)':{tag:'(0009,"FDMS 1.0",05)',vr:"OW",name:"ImageUID",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",06)':{tag:'(0009,"FDMS 1.0",06)',vr:"OW",name:"RouteImageUID",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",08)':{tag:'(0009,"FDMS 1.0",08)',vr:"UL",name:"ImageDisplayInformationVersionNo",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",09)':{tag:'(0009,"FDMS 1.0",09)',vr:"UL",name:"PatientInformationVersionNo",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",0C)':{tag:'(0009,"FDMS 1.0",0C)',vr:"OW",name:"FilmUID",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",10)':{tag:'(0009,"FDMS 1.0",10)',vr:"CS",name:"ExposureUnitTypeCode",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",80)':{tag:'(0009,"FDMS 1.0",80)',vr:"LO",name:"KanjiHospitalName",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",90)':{tag:'(0009,"FDMS 1.0",90)',vr:"ST",name:"DistributionCode",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",92)':{tag:'(0009,"FDMS 1.0",92)',vr:"SH",name:"KanjiDepartmentName",vm:"1",version:"PrivateTag"},'(0009,"FDMS 1.0",F0)':{tag:'(0009,"FDMS 1.0",F0)',vr:"CS",name:"BlackeningProcessFlag",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",15)':{tag:'(0019,"FDMS 1.0",15)',vr:"LO",name:"KanjiBodyPartForExposure",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",32)':{tag:'(0019,"FDMS 1.0",32)',vr:"LO",name:"KanjiMenuName",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",40)':{tag:'(0019,"FDMS 1.0",40)',vr:"CS",name:"ImageProcessingType",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",50)':{tag:'(0019,"FDMS 1.0",50)',vr:"CS",name:"EDRMode",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",60)':{tag:'(0019,"FDMS 1.0",60)',vr:"SH",name:"RadiographersCode",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",70)':{tag:'(0019,"FDMS 1.0",70)',vr:"IS",name:"SplitExposureFormat",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",71)':{tag:'(0019,"FDMS 1.0",71)',vr:"IS",name:"NoOfSplitExposureFrames",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",80)':{tag:'(0019,"FDMS 1.0",80)',vr:"IS",name:"ReadingPositionSpecification",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",81)':{tag:'(0019,"FDMS 1.0",81)',vr:"IS",name:"ReadingSensitivityCenter",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",90)':{tag:'(0019,"FDMS 1.0",90)',vr:"SH",name:"FilmAnnotationCharacterString1",vm:"1",version:"PrivateTag"},'(0019,"FDMS 1.0",91)':{tag:'(0019,"FDMS 1.0",91)',vr:"SH",name:"FilmAnnotationCharacterString2",vm:"1",version:"PrivateTag"},'(0021,"FDMS 1.0",10)':{tag:'(0021,"FDMS 1.0",10)',vr:"CS",name:"FCRImageID",vm:"1",version:"PrivateTag"},'(0021,"FDMS 1.0",30)':{tag:'(0021,"FDMS 1.0",30)',vr:"CS",name:"SetNo",vm:"1",version:"PrivateTag"},'(0021,"FDMS 1.0",40)':{tag:'(0021,"FDMS 1.0",40)',vr:"IS",name:"ImageNoInTheSet",vm:"1",version:"PrivateTag"},'(0021,"FDMS 1.0",50)':{tag:'(0021,"FDMS 1.0",50)',vr:"CS",name:"PairProcessingInformation",vm:"1",version:"PrivateTag"},'(0021,"FDMS 1.0",80)':{tag:'(0021,"FDMS 1.0",80)',vr:"OB",name:"EquipmentTypeSpecificInformation",vm:"1",version:"PrivateTag"},'(0023,"FDMS 1.0",10)':{tag:'(0023,"FDMS 1.0",10)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0023,"FDMS 1.0",20)':{tag:'(0023,"FDMS 1.0",20)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0023,"FDMS 1.0",30)':{tag:'(0023,"FDMS 1.0",30)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",10)':{tag:'(0025,"FDMS 1.0",10)',vr:"US",name:"RelativeLightEmissionAmountSk",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",11)':{tag:'(0025,"FDMS 1.0",11)',vr:"US",name:"TermOfCorrectionForEachIPTypeSt",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",12)':{tag:'(0025,"FDMS 1.0",12)',vr:"US",name:"ReadingGainGp",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",13)':{tag:'(0025,"FDMS 1.0",13)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",15)':{tag:'(0025,"FDMS 1.0",15)',vr:"CS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",20)':{tag:'(0025,"FDMS 1.0",20)',vr:"US",name:"Unknown",vm:"2",version:"PrivateTag"},'(0025,"FDMS 1.0",21)':{tag:'(0025,"FDMS 1.0",21)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",30)':{tag:'(0025,"FDMS 1.0",30)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",31)':{tag:'(0025,"FDMS 1.0",31)',vr:"SS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",32)':{tag:'(0025,"FDMS 1.0",32)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",33)':{tag:'(0025,"FDMS 1.0",33)',vr:"SS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",34)':{tag:'(0025,"FDMS 1.0",34)',vr:"SS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",40)':{tag:'(0025,"FDMS 1.0",40)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",41)':{tag:'(0025,"FDMS 1.0",41)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",42)':{tag:'(0025,"FDMS 1.0",42)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",43)':{tag:'(0025,"FDMS 1.0",43)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",50)':{tag:'(0025,"FDMS 1.0",50)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",51)':{tag:'(0025,"FDMS 1.0",51)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",52)':{tag:'(0025,"FDMS 1.0",52)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",53)':{tag:'(0025,"FDMS 1.0",53)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",60)':{tag:'(0025,"FDMS 1.0",60)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",61)':{tag:'(0025,"FDMS 1.0",61)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",62)':{tag:'(0025,"FDMS 1.0",62)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",63)':{tag:'(0025,"FDMS 1.0",63)',vr:"CS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",70)':{tag:'(0025,"FDMS 1.0",70)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",71)':{tag:'(0025,"FDMS 1.0",71)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",72)':{tag:'(0025,"FDMS 1.0",72)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",73)':{tag:'(0025,"FDMS 1.0",73)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0025,"FDMS 1.0",74)':{tag:'(0025,"FDMS 1.0",74)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0025,"FDMS 1.0",80)':{tag:'(0025,"FDMS 1.0",80)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",81)':{tag:'(0025,"FDMS 1.0",81)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",82)':{tag:'(0025,"FDMS 1.0",82)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",83)':{tag:'(0025,"FDMS 1.0",83)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0025,"FDMS 1.0",84)':{tag:'(0025,"FDMS 1.0",84)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0025,"FDMS 1.0",90)':{tag:'(0025,"FDMS 1.0",90)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",91)':{tag:'(0025,"FDMS 1.0",91)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",92)':{tag:'(0025,"FDMS 1.0",92)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",93)':{tag:'(0025,"FDMS 1.0",93)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",94)':{tag:'(0025,"FDMS 1.0",94)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",95)':{tag:'(0025,"FDMS 1.0",95)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",96)':{tag:'(0025,"FDMS 1.0",96)',vr:"CS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",a0)':{tag:'(0025,"FDMS 1.0",a0)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",a1)':{tag:'(0025,"FDMS 1.0",a1)',vr:"SS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",a2)':{tag:'(0025,"FDMS 1.0",a2)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0025,"FDMS 1.0",a3)':{tag:'(0025,"FDMS 1.0",a3)',vr:"SS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",10)':{tag:'(0027,"FDMS 1.0",10)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",20)':{tag:'(0027,"FDMS 1.0",20)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",30)':{tag:'(0027,"FDMS 1.0",30)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",40)':{tag:'(0027,"FDMS 1.0",40)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",50)':{tag:'(0027,"FDMS 1.0",50)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",60)':{tag:'(0027,"FDMS 1.0",60)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",70)':{tag:'(0027,"FDMS 1.0",70)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",80)':{tag:'(0027,"FDMS 1.0",80)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",a0)':{tag:'(0027,"FDMS 1.0",a0)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"FDMS 1.0",a1)':{tag:'(0027,"FDMS 1.0",a1)',vr:"CS",name:"Unknown",vm:"2",version:"PrivateTag"},'(0027,"FDMS 1.0",a2)':{tag:'(0027,"FDMS 1.0",a2)',vr:"CS",name:"Unknown",vm:"2",version:"PrivateTag"},'(0027,"FDMS 1.0",a3)':{tag:'(0027,"FDMS 1.0",a3)',vr:"SS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0029,"FDMS 1.0",20)':{tag:'(0029,"FDMS 1.0",20)',vr:"CS",name:"ImageScanningDirection",vm:"1",version:"PrivateTag"},'(0029,"FDMS 1.0",30)':{tag:'(0029,"FDMS 1.0",30)',vr:"CS",name:"ExtendedReadingSizeValue",vm:"1",version:"PrivateTag"},'(0029,"FDMS 1.0",34)':{tag:'(0029,"FDMS 1.0",34)',vr:"US",name:"MagnificationReductionRatio",vm:"1",version:"PrivateTag"},'(0029,"FDMS 1.0",44)':{tag:'(0029,"FDMS 1.0",44)',vr:"CS",name:"LineDensityCode",vm:"1",version:"PrivateTag"},'(0029,"FDMS 1.0",50)':{tag:'(0029,"FDMS 1.0",50)',vr:"CS",name:"DataCompressionCode",vm:"1",version:"PrivateTag"},'(2011,"FDMS 1.0",11)':{tag:'(2011,"FDMS 1.0",11)',vr:"CS",name:"ImagePosition SpecifyingFlag",vm:"1",version:"PrivateTag"},'(50F1,"FDMS 1.0",06)':{tag:'(50F1,"FDMS 1.0",06)',vr:"CS",name:"EnergySubtractionParam",vm:"1",version:"PrivateTag"},'(50F1,"FDMS 1.0",07)':{tag:'(50F1,"FDMS 1.0",07)',vr:"CS",name:"SubtractionRegistrationResult",vm:"1",version:"PrivateTag"},'(50F1,"FDMS 1.0",08)':{tag:'(50F1,"FDMS 1.0",08)',vr:"CS",name:"EnergySubtractionParam2",vm:"1",version:"PrivateTag"},'(50F1,"FDMS 1.0",09)':{tag:'(50F1,"FDMS 1.0",09)',vr:"SL",name:"AfinConversionCoefficient",vm:"1",version:"PrivateTag"},'(50F1,"FDMS 1.0",10)':{tag:'(50F1,"FDMS 1.0",10)',vr:"CS",name:"FilmOutputFormat",vm:"1",version:"PrivateTag"},'(50F1,"FDMS 1.0",20)':{tag:'(50F1,"FDMS 1.0",20)',vr:"CS",name:"ImageProcessingModificationFlag",vm:"1",version:"PrivateTag"},'(0009,"FFP DATA",01)':{tag:'(0009,"FFP DATA",01)',vr:"UN",name:"CRHeaderInformation",vm:"1",version:"PrivateTag"},'(0019,"GE ??? From Adantage Review CS",30)':{tag:'(0019,"GE ??? From Adantage Review CS",30)',vr:"LO",name:"CREDRMode",vm:"1",version:"PrivateTag"},'(0019,"GE ??? From Adantage Review CS",40)':{tag:'(0019,"GE ??? From Adantage Review CS",40)',vr:"LO",name:"CRLatitude",vm:"1",version:"PrivateTag"},'(0019,"GE ??? From Adantage Review CS",50)':{tag:'(0019,"GE ??? From Adantage Review CS",50)',vr:"LO",name:"CRGroupNumber",vm:"1",version:"PrivateTag"},'(0019,"GE ??? From Adantage Review CS",70)':{tag:'(0019,"GE ??? From Adantage Review CS",70)',vr:"LO",name:"CRImageSerialNumber",vm:"1",version:"PrivateTag"},'(0019,"GE ??? From Adantage Review CS",80)':{tag:'(0019,"GE ??? From Adantage Review CS",80)',vr:"LO",name:"CRBarCodeNumber",vm:"1",version:"PrivateTag"},'(0019,"GE ??? From Adantage Review CS",90)':{tag:'(0019,"GE ??? From Adantage Review CS",90)',vr:"LO",name:"CRFilmOutputExposures",vm:"1",version:"PrivateTag"},'(0009,"GEMS_ACQU_01",24)':{tag:'(0009,"GEMS_ACQU_01",24)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_ACQU_01",25)':{tag:'(0009,"GEMS_ACQU_01",25)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_ACQU_01",3e)':{tag:'(0009,"GEMS_ACQU_01",3e)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_ACQU_01",3f)':{tag:'(0009,"GEMS_ACQU_01",3f)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_ACQU_01",42)':{tag:'(0009,"GEMS_ACQU_01",42)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_ACQU_01",43)':{tag:'(0009,"GEMS_ACQU_01",43)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_ACQU_01",f8)':{tag:'(0009,"GEMS_ACQU_01",f8)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_ACQU_01",fb)':{tag:'(0009,"GEMS_ACQU_01",fb)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",01)':{tag:'(0019,"GEMS_ACQU_01",01)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",02)':{tag:'(0019,"GEMS_ACQU_01",02)',vr:"SL",name:"NumberOfCellsInDetector",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",03)':{tag:'(0019,"GEMS_ACQU_01",03)',vr:"DS",name:"CellNumberAtTheta",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",04)':{tag:'(0019,"GEMS_ACQU_01",04)',vr:"DS",name:"CellSpacing",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",05)':{tag:'(0019,"GEMS_ACQU_01",05)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",06)':{tag:'(0019,"GEMS_ACQU_01",06)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",0e)':{tag:'(0019,"GEMS_ACQU_01",0e)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",0f)':{tag:'(0019,"GEMS_ACQU_01",0f)',vr:"DS",name:"HorizontalFrameOfReference",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",11)':{tag:'(0019,"GEMS_ACQU_01",11)',vr:"SS",name:"SeriesContrast",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",12)':{tag:'(0019,"GEMS_ACQU_01",12)',vr:"SS",name:"LastPseq",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",13)':{tag:'(0019,"GEMS_ACQU_01",13)',vr:"SS",name:"StartNumberForBaseline",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",14)':{tag:'(0019,"GEMS_ACQU_01",14)',vr:"SS",name:"End NumberForBaseline",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",15)':{tag:'(0019,"GEMS_ACQU_01",15)',vr:"SS",name:"StartNumberForEnhancedScans",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",16)':{tag:'(0019,"GEMS_ACQU_01",16)',vr:"SS",name:"EndNumberForEnhancedScans",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",17)':{tag:'(0019,"GEMS_ACQU_01",17)',vr:"SS",name:"SeriesPlane",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",18)':{tag:'(0019,"GEMS_ACQU_01",18)',vr:"LO",name:"FirstScanRAS",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",19)':{tag:'(0019,"GEMS_ACQU_01",19)',vr:"DS",name:"FirstScanLocation",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",1a)':{tag:'(0019,"GEMS_ACQU_01",1a)',vr:"LO",name:"LastScanRAS",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",1b)':{tag:'(0019,"GEMS_ACQU_01",1b)',vr:"DS",name:"LastScanLocation",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",1e)':{tag:'(0019,"GEMS_ACQU_01",1e)',vr:"DS",name:"DisplayFieldOfView",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",20)':{tag:'(0019,"GEMS_ACQU_01",20)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",22)':{tag:'(0019,"GEMS_ACQU_01",22)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",23)':{tag:'(0019,"GEMS_ACQU_01",23)',vr:"DS",name:"TableSpeed",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",24)':{tag:'(0019,"GEMS_ACQU_01",24)',vr:"DS",name:"MidScanTime",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",25)':{tag:'(0019,"GEMS_ACQU_01",25)',vr:"SS",name:"MidScanFlag",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",26)':{tag:'(0019,"GEMS_ACQU_01",26)',vr:"SL",name:"DegreesOfAzimuth",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",27)':{tag:'(0019,"GEMS_ACQU_01",27)',vr:"DS",name:"GantryPeriod",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",2a)':{tag:'(0019,"GEMS_ACQU_01",2a)',vr:"DS",name:"XrayOnPosition",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",2b)':{tag:'(0019,"GEMS_ACQU_01",2b)',vr:"DS",name:"XrayOffPosition",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",2c)':{tag:'(0019,"GEMS_ACQU_01",2c)',vr:"SL",name:"NumberOfTriggers",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",2d)':{tag:'(0019,"GEMS_ACQU_01",2d)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",2e)':{tag:'(0019,"GEMS_ACQU_01",2e)',vr:"DS",name:"AngleOfFirstView",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",2f)':{tag:'(0019,"GEMS_ACQU_01",2f)',vr:"DS",name:"TriggerFrequency",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",39)':{tag:'(0019,"GEMS_ACQU_01",39)',vr:"SS",name:"ScanFOVType",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",3a)':{tag:'(0019,"GEMS_ACQU_01",3a)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",3b)':{tag:'(0019,"GEMS_ACQU_01",3b)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",3c)':{tag:'(0019,"GEMS_ACQU_01",3c)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",3e)':{tag:'(0019,"GEMS_ACQU_01",3e)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",3f)':{tag:'(0019,"GEMS_ACQU_01",3f)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",40)':{tag:'(0019,"GEMS_ACQU_01",40)',vr:"SS",name:"StatReconFlag",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",41)':{tag:'(0019,"GEMS_ACQU_01",41)',vr:"SS",name:"ComputeType",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",42)':{tag:'(0019,"GEMS_ACQU_01",42)',vr:"SS",name:"SegmentNumber",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",43)':{tag:'(0019,"GEMS_ACQU_01",43)',vr:"SS",name:"TotalSegmentsRequested",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",44)':{tag:'(0019,"GEMS_ACQU_01",44)',vr:"DS",name:"InterscanDelay",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",47)':{tag:'(0019,"GEMS_ACQU_01",47)',vr:"SS",name:"ViewCompressionFactor",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",48)':{tag:'(0019,"GEMS_ACQU_01",48)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",49)':{tag:'(0019,"GEMS_ACQU_01",49)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",4a)':{tag:'(0019,"GEMS_ACQU_01",4a)',vr:"SS",name:"TotalNumberOfRefChannels",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",4b)':{tag:'(0019,"GEMS_ACQU_01",4b)',vr:"SL",name:"DataSizeForScanData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",52)':{tag:'(0019,"GEMS_ACQU_01",52)',vr:"SS",name:"ReconPostProcessingFlag",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",54)':{tag:'(0019,"GEMS_ACQU_01",54)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",57)':{tag:'(0019,"GEMS_ACQU_01",57)',vr:"SS",name:"CTWaterNumber",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",58)':{tag:'(0019,"GEMS_ACQU_01",58)',vr:"SS",name:"CTBoneNumber",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",5a)':{tag:'(0019,"GEMS_ACQU_01",5a)',vr:"FL",name:"AcquisitionDuration",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",5d)':{tag:'(0019,"GEMS_ACQU_01",5d)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",5e)':{tag:'(0019,"GEMS_ACQU_01",5e)',vr:"SL",name:"NumberOfChannels1To512",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",5f)':{tag:'(0019,"GEMS_ACQU_01",5f)',vr:"SL",name:"IncrementBetweenChannels",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",60)':{tag:'(0019,"GEMS_ACQU_01",60)',vr:"SL",name:"StartingView",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",61)':{tag:'(0019,"GEMS_ACQU_01",61)',vr:"SL",name:"NumberOfViews",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",62)':{tag:'(0019,"GEMS_ACQU_01",62)',vr:"SL",name:"IncrementBetweenViews",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",6a)':{tag:'(0019,"GEMS_ACQU_01",6a)',vr:"SS",name:"DependantOnNumberOfViewsProcessed",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",6b)':{tag:'(0019,"GEMS_ACQU_01",6b)',vr:"SS",name:"FieldOfViewInDetectorCells",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",70)':{tag:'(0019,"GEMS_ACQU_01",70)',vr:"SS",name:"ValueOfBackProjectionButton",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",71)':{tag:'(0019,"GEMS_ACQU_01",71)',vr:"SS",name:"SetIfFatqEstimatesWereUsed",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",72)':{tag:'(0019,"GEMS_ACQU_01",72)',vr:"DS",name:"ZChannelAvgOverViews",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",73)':{tag:'(0019,"GEMS_ACQU_01",73)',vr:"DS",name:"AvgOfLeftRefChannelsOverViews",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",74)':{tag:'(0019,"GEMS_ACQU_01",74)',vr:"DS",name:"MaxLeftChannelOverViews",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",75)':{tag:'(0019,"GEMS_ACQU_01",75)',vr:"DS",name:"AvgOfRightRefChannelsOverViews",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",76)':{tag:'(0019,"GEMS_ACQU_01",76)',vr:"DS",name:"MaxRightChannelOverViews",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",7d)':{tag:'(0019,"GEMS_ACQU_01",7d)',vr:"DS",name:"SecondEcho",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",7e)':{tag:'(0019,"GEMS_ACQU_01",7e)',vr:"SS",name:"NumberOfEchos",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",7f)':{tag:'(0019,"GEMS_ACQU_01",7f)',vr:"DS",name:"TableDelta",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",81)':{tag:'(0019,"GEMS_ACQU_01",81)',vr:"SS",name:"Contiguous",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",82)':{tag:'(0019,"GEMS_ACQU_01",82)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",83)':{tag:'(0019,"GEMS_ACQU_01",83)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",84)':{tag:'(0019,"GEMS_ACQU_01",84)',vr:"DS",name:"PeakSAR",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",85)':{tag:'(0019,"GEMS_ACQU_01",85)',vr:"SS",name:"MonitorSAR",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",86)':{tag:'(0019,"GEMS_ACQU_01",86)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",87)':{tag:'(0019,"GEMS_ACQU_01",87)',vr:"DS",name:"CardiacRepetition Time",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",88)':{tag:'(0019,"GEMS_ACQU_01",88)',vr:"SS",name:"ImagesPerCardiacCycle",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",8a)':{tag:'(0019,"GEMS_ACQU_01",8a)',vr:"SS",name:"ActualReceiveGainAnalog",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",8b)':{tag:'(0019,"GEMS_ACQU_01",8b)',vr:"SS",name:"ActualReceiveGainDigital",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",8d)':{tag:'(0019,"GEMS_ACQU_01",8d)',vr:"DS",name:"DelayAfterTrigger",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",8f)':{tag:'(0019,"GEMS_ACQU_01",8f)',vr:"SS",name:"SwapPhaseFrequency",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",90)':{tag:'(0019,"GEMS_ACQU_01",90)',vr:"SS",name:"PauseInterval",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",91)':{tag:'(0019,"GEMS_ACQU_01",91)',vr:"DS",name:"PulseTime",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",92)':{tag:'(0019,"GEMS_ACQU_01",92)',vr:"SL",name:"SliceOffsetOnFrequencyAxis",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",93)':{tag:'(0019,"GEMS_ACQU_01",93)',vr:"DS",name:"CenterFrequency",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",94)':{tag:'(0019,"GEMS_ACQU_01",94)',vr:"SS",name:"TransmitGain",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",95)':{tag:'(0019,"GEMS_ACQU_01",95)',vr:"SS",name:"AnalogReceiverGain",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",96)':{tag:'(0019,"GEMS_ACQU_01",96)',vr:"SS",name:"DigitalReceiverGain",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",97)':{tag:'(0019,"GEMS_ACQU_01",97)',vr:"SL",name:"BitmapDefiningCVs",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",98)':{tag:'(0019,"GEMS_ACQU_01",98)',vr:"SS",name:"CenterFrequencyMethod",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",99)':{tag:'(0019,"GEMS_ACQU_01",99)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",9b)':{tag:'(0019,"GEMS_ACQU_01",9b)',vr:"SS",name:"PulseSequenceMode",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",9c)':{tag:'(0019,"GEMS_ACQU_01",9c)',vr:"LO",name:"PulseSequenceName",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",9d)':{tag:'(0019,"GEMS_ACQU_01",9d)',vr:"DT",name:"PulseSequenceDate",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",9e)':{tag:'(0019,"GEMS_ACQU_01",9e)',vr:"LO",name:"InternalPulseSequenceName",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",9f)':{tag:'(0019,"GEMS_ACQU_01",9f)',vr:"SS",name:"TransmittingCoil",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",a0)':{tag:'(0019,"GEMS_ACQU_01",a0)',vr:"SS",name:"SurfaceCoilType",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",a1)':{tag:'(0019,"GEMS_ACQU_01",a1)',vr:"SS",name:"ExtremityCoilFlag",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",a2)':{tag:'(0019,"GEMS_ACQU_01",a2)',vr:"SL",name:"RawDataRunNumber",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",a3)':{tag:'(0019,"GEMS_ACQU_01",a3)',vr:"UL",name:"CalibratedFieldStrength",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",a4)':{tag:'(0019,"GEMS_ACQU_01",a4)',vr:"SS",name:"SATFatWaterBone",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",a5)':{tag:'(0019,"GEMS_ACQU_01",a5)',vr:"DS",name:"ReceiveBandwidth",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",a7)':{tag:'(0019,"GEMS_ACQU_01",a7)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",a8)':{tag:'(0019,"GEMS_ACQU_01",a8)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",a9)':{tag:'(0019,"GEMS_ACQU_01",a9)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",aa)':{tag:'(0019,"GEMS_ACQU_01",aa)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",ab)':{tag:'(0019,"GEMS_ACQU_01",ab)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",ac)':{tag:'(0019,"GEMS_ACQU_01",ac)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",ad)':{tag:'(0019,"GEMS_ACQU_01",ad)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",ae)':{tag:'(0019,"GEMS_ACQU_01",ae)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",af)':{tag:'(0019,"GEMS_ACQU_01",af)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b0)':{tag:'(0019,"GEMS_ACQU_01",b0)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b1)':{tag:'(0019,"GEMS_ACQU_01",b1)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b2)':{tag:'(0019,"GEMS_ACQU_01",b2)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b3)':{tag:'(0019,"GEMS_ACQU_01",b3)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b4)':{tag:'(0019,"GEMS_ACQU_01",b4)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b5)':{tag:'(0019,"GEMS_ACQU_01",b5)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b6)':{tag:'(0019,"GEMS_ACQU_01",b6)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b7)':{tag:'(0019,"GEMS_ACQU_01",b7)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b8)':{tag:'(0019,"GEMS_ACQU_01",b8)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",b9)':{tag:'(0019,"GEMS_ACQU_01",b9)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",ba)':{tag:'(0019,"GEMS_ACQU_01",ba)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",bb)':{tag:'(0019,"GEMS_ACQU_01",bb)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",bc)':{tag:'(0019,"GEMS_ACQU_01",bc)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",bd)':{tag:'(0019,"GEMS_ACQU_01",bd)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",be)':{tag:'(0019,"GEMS_ACQU_01",be)',vr:"DS",name:"ProjectionAngle",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c0)':{tag:'(0019,"GEMS_ACQU_01",c0)',vr:"SS",name:"SaturationPlanes",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c1)':{tag:'(0019,"GEMS_ACQU_01",c1)',vr:"SS",name:"SurfaceCoilIntensityCorrectionFlag",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c2)':{tag:'(0019,"GEMS_ACQU_01",c2)',vr:"SS",name:"SATLocationR",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c3)':{tag:'(0019,"GEMS_ACQU_01",c3)',vr:"SS",name:"SATLocationL",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c4)':{tag:'(0019,"GEMS_ACQU_01",c4)',vr:"SS",name:"SATLocationA",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c5)':{tag:'(0019,"GEMS_ACQU_01",c5)',vr:"SS",name:"SATLocationP",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c6)':{tag:'(0019,"GEMS_ACQU_01",c6)',vr:"SS",name:"SATLocationH",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c7)':{tag:'(0019,"GEMS_ACQU_01",c7)',vr:"SS",name:"SATLocationF",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c8)':{tag:'(0019,"GEMS_ACQU_01",c8)',vr:"SS",name:"SATThicknessRL",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",c9)':{tag:'(0019,"GEMS_ACQU_01",c9)',vr:"SS",name:"SATThicknessAP",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",ca)':{tag:'(0019,"GEMS_ACQU_01",ca)',vr:"SS",name:"SATThicknessHF",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",cb)':{tag:'(0019,"GEMS_ACQU_01",cb)',vr:"SS",name:"PrescribedFlowAxis",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",cc)':{tag:'(0019,"GEMS_ACQU_01",cc)',vr:"SS",name:"VelocityEncoding",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",cd)':{tag:'(0019,"GEMS_ACQU_01",cd)',vr:"SS",name:"ThicknessDisclaimer",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",ce)':{tag:'(0019,"GEMS_ACQU_01",ce)',vr:"SS",name:"PrescanType",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",cf)':{tag:'(0019,"GEMS_ACQU_01",cf)',vr:"SS",name:"PrescanStatus",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",d0)':{tag:'(0019,"GEMS_ACQU_01",d0)',vr:"SH",name:"RawDataType",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",d2)':{tag:'(0019,"GEMS_ACQU_01",d2)',vr:"SS",name:"ProjectionAlgorithm",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",d3)':{tag:'(0019,"GEMS_ACQU_01",d3)',vr:"SH",name:"ProjectionAlgorithm",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",d4)':{tag:'(0019,"GEMS_ACQU_01",d4)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",d5)':{tag:'(0019,"GEMS_ACQU_01",d5)',vr:"SS",name:"FractionalEcho",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",d6)':{tag:'(0019,"GEMS_ACQU_01",d6)',vr:"SS",name:"PrepPulse",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",d7)':{tag:'(0019,"GEMS_ACQU_01",d7)',vr:"SS",name:"CardiacPhases",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",d8)':{tag:'(0019,"GEMS_ACQU_01",d8)',vr:"SS",name:"VariableEchoFlag",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",d9)':{tag:'(0019,"GEMS_ACQU_01",d9)',vr:"DS",name:"ConcatenatedSAT",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",da)':{tag:'(0019,"GEMS_ACQU_01",da)',vr:"SS",name:"ReferenceChannelUsed",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",db)':{tag:'(0019,"GEMS_ACQU_01",db)',vr:"DS",name:"BackProjectorCoefficient",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",dc)':{tag:'(0019,"GEMS_ACQU_01",dc)',vr:"SS",name:"PrimarySpeedCorrectionUsed",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",dd)':{tag:'(0019,"GEMS_ACQU_01",dd)',vr:"SS",name:"OverrangeCorrectionUsed",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",de)':{tag:'(0019,"GEMS_ACQU_01",de)',vr:"DS",name:"DynamicZAlphaValue",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",df)':{tag:'(0019,"GEMS_ACQU_01",df)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",e0)':{tag:'(0019,"GEMS_ACQU_01",e0)',vr:"DS",name:"UserData",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",e1)':{tag:'(0019,"GEMS_ACQU_01",e1)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",e2)':{tag:'(0019,"GEMS_ACQU_01",e2)',vr:"DS",name:"VelocityEncodeScale",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",e3)':{tag:'(0019,"GEMS_ACQU_01",e3)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",e4)':{tag:'(0019,"GEMS_ACQU_01",e4)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",e5)':{tag:'(0019,"GEMS_ACQU_01",e5)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",e6)':{tag:'(0019,"GEMS_ACQU_01",e6)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",e8)':{tag:'(0019,"GEMS_ACQU_01",e8)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",e9)':{tag:'(0019,"GEMS_ACQU_01",e9)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",eb)':{tag:'(0019,"GEMS_ACQU_01",eb)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",ec)':{tag:'(0019,"GEMS_ACQU_01",ec)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",f0)':{tag:'(0019,"GEMS_ACQU_01",f0)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",f1)':{tag:'(0019,"GEMS_ACQU_01",f1)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",f2)':{tag:'(0019,"GEMS_ACQU_01",f2)',vr:"SS",name:"FastPhases",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",f3)':{tag:'(0019,"GEMS_ACQU_01",f3)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",f4)':{tag:'(0019,"GEMS_ACQU_01",f4)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GEMS_ACQU_01",f9)':{tag:'(0019,"GEMS_ACQU_01",f9)',vr:"DS",name:"TransmitGain",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",00)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",00)',vr:"LO",name:"CRExposureMenuCode",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",10)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",10)',vr:"LO",name:"CRExposureMenuString",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",20)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",20)',vr:"LO",name:"CREDRMode",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",30)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",30)',vr:"LO",name:"CRLatitude",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",40)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",40)',vr:"LO",name:"CRGroupNumber",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",50)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",50)',vr:"US",name:"CRImageSerialNumber",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",60)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",60)',vr:"LO",name:"CRBarCodeNumber",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",70)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",70)',vr:"LO",name:"CRFilmOutputExposure",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",80)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",80)',vr:"LO",name:"CRFilmFormat",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK1",90)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK1",90)',vr:"LO",name:"CRSShiftString",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",00)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",00)',vr:"US",name:"CRSShift",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",10)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",10)',vr:"DS",name:"CRCShift",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",20)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",20)',vr:"DS",name:"CRGT",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",30)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",30)',vr:"DS",name:"CRGA",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",40)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",40)',vr:"DS",name:"CRGC",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",50)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",50)',vr:"DS",name:"CRGS",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",60)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",60)',vr:"DS",name:"CRRT",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",70)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",70)',vr:"DS",name:"CRRE",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",80)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",80)',vr:"US",name:"CRRN",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK2",90)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK2",90)',vr:"DS",name:"CRDRT",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",00)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",00)',vr:"DS",name:"CRDRE",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",10)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",10)',vr:"US",name:"CRDRN",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",20)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",20)',vr:"DS",name:"CRORE",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",30)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",30)',vr:"US",name:"CRORN",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",40)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",40)',vr:"US",name:"CRORD",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",50)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",50)',vr:"LO",name:"CRCassetteSize",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",60)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",60)',vr:"LO",name:"CRMachineID",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",70)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",70)',vr:"LO",name:"CRMachineType",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",80)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",80)',vr:"LO",name:"CRTechnicianCode",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_1.0 BLOCK3",90)':{tag:'(0023,"GEMS_ACRQA_1.0 BLOCK3",90)',vr:"LO",name:"CREnergySubtractionParameters",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",00)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",00)',vr:"LO",name:"CRExposureMenuCode",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",10)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",10)',vr:"LO",name:"CRExposureMenuString",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",20)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",20)',vr:"LO",name:"CREDRMode",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",30)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",30)',vr:"LO",name:"CRLatitude",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",40)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",40)',vr:"LO",name:"CRGroupNumber",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",50)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",50)',vr:"US",name:"CRImageSerialNumber",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",60)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",60)',vr:"LO",name:"CRBarCodeNumber",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",70)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",70)',vr:"LO",name:"CRFilmOutputExposure",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",80)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",80)',vr:"LO",name:"CRFilmFormat",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK1",90)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK1",90)',vr:"LO",name:"CRSShiftString",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",00)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",00)',vr:"US",name:"CRSShift",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",10)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",10)',vr:"LO",name:"CRCShift",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",20)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",20)',vr:"LO",name:"CRGT",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",30)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",30)',vr:"DS",name:"CRGA",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",40)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",40)',vr:"DS",name:"CRGC",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",50)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",50)',vr:"DS",name:"CRGS",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",60)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",60)',vr:"LO",name:"CRRT",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",70)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",70)',vr:"DS",name:"CRRE",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",80)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",80)',vr:"US",name:"CRRN",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK2",90)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK2",90)',vr:"DS",name:"CRDRT",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",00)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",00)',vr:"DS",name:"CRDRE",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",10)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",10)',vr:"US",name:"CRDRN",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",20)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",20)',vr:"DS",name:"CRORE",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",30)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",30)',vr:"US",name:"CRORN",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",40)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",40)',vr:"US",name:"CRORD",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",50)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",50)',vr:"LO",name:"CRCassetteSize",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",60)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",60)',vr:"LO",name:"CRMachineID",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",70)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",70)',vr:"LO",name:"CRMachineType",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",80)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",80)',vr:"LO",name:"CRTechnicianCode",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",90)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",90)',vr:"LO",name:"CREnergySubtractionParameters",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",f0)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",f0)',vr:"LO",name:"CRDistributionCode",vm:"1",version:"PrivateTag"},'(0023,"GEMS_ACRQA_2.0 BLOCK3",ff)':{tag:'(0023,"GEMS_ACRQA_2.0 BLOCK3",ff)',vr:"US",name:"CRShuttersApplied",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",01)':{tag:'(0047,"GEMS_ADWSoft_3D1",01)',vr:"SQ",name:"Reconstruction Parameters Sequence",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",50)':{tag:'(0047,"GEMS_ADWSoft_3D1",50)',vr:"UL",name:"VolumeVoxelCount",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",51)':{tag:'(0047,"GEMS_ADWSoft_3D1",51)',vr:"UL",name:"VolumeSegmentCount",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",53)':{tag:'(0047,"GEMS_ADWSoft_3D1",53)',vr:"US",name:"VolumeSliceSize",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",54)':{tag:'(0047,"GEMS_ADWSoft_3D1",54)',vr:"US",name:"VolumeSliceCount",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",55)':{tag:'(0047,"GEMS_ADWSoft_3D1",55)',vr:"SL",name:"VolumeThresholdValue",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",57)':{tag:'(0047,"GEMS_ADWSoft_3D1",57)',vr:"DS",name:"VolumeVoxelRatio",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",58)':{tag:'(0047,"GEMS_ADWSoft_3D1",58)',vr:"DS",name:"VolumeVoxelSize",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",59)':{tag:'(0047,"GEMS_ADWSoft_3D1",59)',vr:"US",name:"VolumeZPositionSize",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",60)':{tag:'(0047,"GEMS_ADWSoft_3D1",60)',vr:"DS",name:"VolumeBaseLine",vm:"9",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",61)':{tag:'(0047,"GEMS_ADWSoft_3D1",61)',vr:"DS",name:"VolumeCenterPoint",vm:"3",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",63)':{tag:'(0047,"GEMS_ADWSoft_3D1",63)',vr:"SL",name:"VolumeSkewBase",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",64)':{tag:'(0047,"GEMS_ADWSoft_3D1",64)',vr:"DS",name:"VolumeRegistrationTransformRotationMatrix",vm:"9",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",65)':{tag:'(0047,"GEMS_ADWSoft_3D1",65)',vr:"DS",name:"VolumeRegistrationTransformTranslationVector",vm:"3",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",70)':{tag:'(0047,"GEMS_ADWSoft_3D1",70)',vr:"DS",name:"KVPList",vm:"1-n",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",71)':{tag:'(0047,"GEMS_ADWSoft_3D1",71)',vr:"IS",name:"XRayTubeCurrentList",vm:"1-n",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",72)':{tag:'(0047,"GEMS_ADWSoft_3D1",72)',vr:"IS",name:"ExposureList",vm:"1-n",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",80)':{tag:'(0047,"GEMS_ADWSoft_3D1",80)',vr:"LO",name:"AcquisitionDLXIdentifier",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",85)':{tag:'(0047,"GEMS_ADWSoft_3D1",85)',vr:"SQ",name:"AcquisitionDLX2DSeriesSequence",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",89)':{tag:'(0047,"GEMS_ADWSoft_3D1",89)',vr:"DS",name:"ContrastAgentVolumeList",vm:"1-n",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",8A)':{tag:'(0047,"GEMS_ADWSoft_3D1",8A)',vr:"US",name:"NumberOfInjections",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",8B)':{tag:'(0047,"GEMS_ADWSoft_3D1",8B)',vr:"US",name:"FrameCount",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",91)':{tag:'(0047,"GEMS_ADWSoft_3D1",91)',vr:"LO",name:"XA3DReconstructionAlgorithmName",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",92)':{tag:'(0047,"GEMS_ADWSoft_3D1",92)',vr:"CS",name:"XA3DReconstructionAlgorithmVersion",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",93)':{tag:'(0047,"GEMS_ADWSoft_3D1",93)',vr:"DA",name:"DLXCalibrationDate",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",94)':{tag:'(0047,"GEMS_ADWSoft_3D1",94)',vr:"TM",name:"DLXCalibrationTime",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",95)':{tag:'(0047,"GEMS_ADWSoft_3D1",95)',vr:"CS",name:"DLXCalibrationStatus",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",96)':{tag:'(0047,"GEMS_ADWSoft_3D1",96)',vr:"IS",name:"UsedFrames",vm:"1-n",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",98)':{tag:'(0047,"GEMS_ADWSoft_3D1",98)',vr:"US",name:"TransformCount",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",99)':{tag:'(0047,"GEMS_ADWSoft_3D1",99)',vr:"SQ",name:"TransformSequence",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",9A)':{tag:'(0047,"GEMS_ADWSoft_3D1",9A)',vr:"DS",name:"TransformRotationMatrix",vm:"9",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",9B)':{tag:'(0047,"GEMS_ADWSoft_3D1",9B)',vr:"DS",name:"TransformTranslationVector",vm:"3",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",9C)':{tag:'(0047,"GEMS_ADWSoft_3D1",9C)',vr:"LO",name:"TransformLabel",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",B0)':{tag:'(0047,"GEMS_ADWSoft_3D1",B0)',vr:"SQ",name:"WireframeList",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",B1)':{tag:'(0047,"GEMS_ADWSoft_3D1",B1)',vr:"US",name:"WireframeCount",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",B2)':{tag:'(0047,"GEMS_ADWSoft_3D1",B2)',vr:"US",name:"LocationSystem",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",B5)':{tag:'(0047,"GEMS_ADWSoft_3D1",B5)',vr:"LO",name:"WireframeName",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",B6)':{tag:'(0047,"GEMS_ADWSoft_3D1",B6)',vr:"LO",name:"WireframeGroupName",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",B7)':{tag:'(0047,"GEMS_ADWSoft_3D1",B7)',vr:"LO",name:"WireframeColor",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",B8)':{tag:'(0047,"GEMS_ADWSoft_3D1",B8)',vr:"SL",name:"WireframeAttributes",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",B9)':{tag:'(0047,"GEMS_ADWSoft_3D1",B9)',vr:"SL",name:"WireframePointCount",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",BA)':{tag:'(0047,"GEMS_ADWSoft_3D1",BA)',vr:"SL",name:"WireframeTimestamp",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",BB)':{tag:'(0047,"GEMS_ADWSoft_3D1",BB)',vr:"SQ",name:"WireframePointList",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",BC)':{tag:'(0047,"GEMS_ADWSoft_3D1",BC)',vr:"DS",name:"WireframePointsCoordinates",vm:"3",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",C0)':{tag:'(0047,"GEMS_ADWSoft_3D1",C0)',vr:"DS",name:"VolumeUpperLeftHighCornerRAS",vm:"3",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",C1)':{tag:'(0047,"GEMS_ADWSoft_3D1",C1)',vr:"DS",name:"VolumeSliceToRASRotationMatrix",vm:"9",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",C2)':{tag:'(0047,"GEMS_ADWSoft_3D1",C2)',vr:"DS",name:"VolumeUpperLeftHighCornerTLOC",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",D1)':{tag:'(0047,"GEMS_ADWSoft_3D1",D1)',vr:"OB",name:"VolumeSegmentList",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",D2)':{tag:'(0047,"GEMS_ADWSoft_3D1",D2)',vr:"OB",name:"VolumeGradientList",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",D3)':{tag:'(0047,"GEMS_ADWSoft_3D1",D3)',vr:"OB",name:"VolumeDensityList",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",D4)':{tag:'(0047,"GEMS_ADWSoft_3D1",D4)',vr:"OB",name:"VolumeZPositionList",vm:"1",version:"PrivateTag"},'(0047,"GEMS_ADWSoft_3D1",D5)':{tag:'(0047,"GEMS_ADWSoft_3D1",D5)',vr:"OB",name:"VolumeOriginalIndexList",vm:"1",version:"PrivateTag"},'(0039,"GEMS_ADWSoft_DPO",80)':{tag:'(0039,"GEMS_ADWSoft_DPO",80)',vr:"IS",name:"PrivateEntityNumber",vm:"1",version:"PrivateTag"},'(0039,"GEMS_ADWSoft_DPO",85)':{tag:'(0039,"GEMS_ADWSoft_DPO",85)',vr:"DA",name:"PrivateEntityDate",vm:"1",version:"PrivateTag"},'(0039,"GEMS_ADWSoft_DPO",90)':{tag:'(0039,"GEMS_ADWSoft_DPO",90)',vr:"TM",name:"PrivateEntityTime",vm:"1",version:"PrivateTag"},'(0039,"GEMS_ADWSoft_DPO",95)':{tag:'(0039,"GEMS_ADWSoft_DPO",95)',vr:"LO",name:"PrivateEntityLaunchCommand",vm:"1",version:"PrivateTag"},'(0039,"GEMS_ADWSoft_DPO",AA)':{tag:'(0039,"GEMS_ADWSoft_DPO",AA)',vr:"CS",name:"PrivateEntityType",vm:"1",version:"PrivateTag"},'(0033,"GEMS_CTHD_01",02)':{tag:'(0033,"GEMS_CTHD_01",02)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0037,"GEMS_DRS_1",10)':{tag:'(0037,"GEMS_DRS_1",10)',vr:"LO",name:"ReferringDepartment",vm:"1",version:"PrivateTag"},'(0037,"GEMS_DRS_1",20)':{tag:'(0037,"GEMS_DRS_1",20)',vr:"US",name:"ScreenNumber",vm:"1",version:"PrivateTag"},'(0037,"GEMS_DRS_1",40)':{tag:'(0037,"GEMS_DRS_1",40)',vr:"SH",name:"LeftOrientation",vm:"1",version:"PrivateTag"},'(0037,"GEMS_DRS_1",42)':{tag:'(0037,"GEMS_DRS_1",42)',vr:"SH",name:"RightOrientation",vm:"1",version:"PrivateTag"},'(0037,"GEMS_DRS_1",50)':{tag:'(0037,"GEMS_DRS_1",50)',vr:"CS",name:"Inversion",vm:"1",version:"PrivateTag"},'(0037,"GEMS_DRS_1",60)':{tag:'(0037,"GEMS_DRS_1",60)',vr:"US",name:"DSA",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",10)':{tag:'(0009,"GEMS_GENIE_1",10)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",11)':{tag:'(0009,"GEMS_GENIE_1",11)',vr:"SL",name:"StudyFlags",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",12)':{tag:'(0009,"GEMS_GENIE_1",12)',vr:"SL",name:"StudyType",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",1e)':{tag:'(0009,"GEMS_GENIE_1",1e)',vr:"UI",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",20)':{tag:'(0009,"GEMS_GENIE_1",20)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",21)':{tag:'(0009,"GEMS_GENIE_1",21)',vr:"SL",name:"SeriesFlags",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",22)':{tag:'(0009,"GEMS_GENIE_1",22)',vr:"SH",name:"UserOrientation",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",23)':{tag:'(0009,"GEMS_GENIE_1",23)',vr:"SL",name:"InitiationType",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",24)':{tag:'(0009,"GEMS_GENIE_1",24)',vr:"SL",name:"InitiationDelay",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",25)':{tag:'(0009,"GEMS_GENIE_1",25)',vr:"SL",name:"InitiationCountRate",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",26)':{tag:'(0009,"GEMS_GENIE_1",26)',vr:"SL",name:"NumberEnergySets",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",27)':{tag:'(0009,"GEMS_GENIE_1",27)',vr:"SL",name:"NumberDetectors",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",29)':{tag:'(0009,"GEMS_GENIE_1",29)',vr:"SL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",2a)':{tag:'(0009,"GEMS_GENIE_1",2a)',vr:"SL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",2c)':{tag:'(0009,"GEMS_GENIE_1",2c)',vr:"LO",name:"SeriesComments",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",2d)':{tag:'(0009,"GEMS_GENIE_1",2d)',vr:"SL",name:"TrackBeatAverage",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",2e)':{tag:'(0009,"GEMS_GENIE_1",2e)',vr:"FD",name:"DistancePrescribed",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",30)':{tag:'(0009,"GEMS_GENIE_1",30)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",35)':{tag:'(0009,"GEMS_GENIE_1",35)',vr:"SL",name:"GantryLocusType",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",37)':{tag:'(0009,"GEMS_GENIE_1",37)',vr:"SL",name:"StartingHeartRate",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",38)':{tag:'(0009,"GEMS_GENIE_1",38)',vr:"SL",name:"RRWindowWidth",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",39)':{tag:'(0009,"GEMS_GENIE_1",39)',vr:"SL",name:"RRWindowOffset",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",3a)':{tag:'(0009,"GEMS_GENIE_1",3a)',vr:"SL",name:"PercentCycleImaged",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",40)':{tag:'(0009,"GEMS_GENIE_1",40)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",41)':{tag:'(0009,"GEMS_GENIE_1",41)',vr:"SL",name:"PatientFlags",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",42)':{tag:'(0009,"GEMS_GENIE_1",42)',vr:"DA",name:"PatientCreationDate",vm:"1",version:"PrivateTag"},'(0009,"GEMS_GENIE_1",43)':{tag:'(0009,"GEMS_GENIE_1",43)',vr:"TM",name:"PatientCreationTime",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",0a)':{tag:'(0011,"GEMS_GENIE_1",0a)',vr:"SL",name:"SeriesType",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",0b)':{tag:'(0011,"GEMS_GENIE_1",0b)',vr:"SL",name:"EffectiveSeriesDuration",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",0c)':{tag:'(0011,"GEMS_GENIE_1",0c)',vr:"SL",name:"NumBeats",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",0d)':{tag:'(0011,"GEMS_GENIE_1",0d)',vr:"LO",name:"RadioNuclideName",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",10)':{tag:'(0011,"GEMS_GENIE_1",10)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",12)':{tag:'(0011,"GEMS_GENIE_1",12)',vr:"LO",name:"DatasetName",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",13)':{tag:'(0011,"GEMS_GENIE_1",13)',vr:"SL",name:"DatasetType",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",15)':{tag:'(0011,"GEMS_GENIE_1",15)',vr:"SL",name:"DetectorNumber",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",16)':{tag:'(0011,"GEMS_GENIE_1",16)',vr:"SL",name:"EnergyNumber",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",17)':{tag:'(0011,"GEMS_GENIE_1",17)',vr:"SL",name:"RRIntervalWindowNumber",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",18)':{tag:'(0011,"GEMS_GENIE_1",18)',vr:"SL",name:"MGBinNumber",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",19)':{tag:'(0011,"GEMS_GENIE_1",19)',vr:"FD",name:"RadiusOfRotation",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",1a)':{tag:'(0011,"GEMS_GENIE_1",1a)',vr:"SL",name:"DetectorCountZone",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",1b)':{tag:'(0011,"GEMS_GENIE_1",1b)',vr:"SL",name:"NumEnergyWindows",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",1c)':{tag:'(0011,"GEMS_GENIE_1",1c)',vr:"SL",name:"EnergyOffset",vm:"4",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",1d)':{tag:'(0011,"GEMS_GENIE_1",1d)',vr:"SL",name:"EnergyRange",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",1f)':{tag:'(0011,"GEMS_GENIE_1",1f)',vr:"SL",name:"ImageOrientation",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",23)':{tag:'(0011,"GEMS_GENIE_1",23)',vr:"SL",name:"UseFOVMask",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",24)':{tag:'(0011,"GEMS_GENIE_1",24)',vr:"SL",name:"FOVMaskYCutoffAngle",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",25)':{tag:'(0011,"GEMS_GENIE_1",25)',vr:"SL",name:"FOVMaskCutoffAngle",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",26)':{tag:'(0011,"GEMS_GENIE_1",26)',vr:"SL",name:"TableOrientation",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",27)':{tag:'(0011,"GEMS_GENIE_1",27)',vr:"SL",name:"ROITopLeft",vm:"2",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",28)':{tag:'(0011,"GEMS_GENIE_1",28)',vr:"SL",name:"ROIBottomRight",vm:"2",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",30)':{tag:'(0011,"GEMS_GENIE_1",30)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",33)':{tag:'(0011,"GEMS_GENIE_1",33)',vr:"LO",name:"EnergyCorrectName",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",34)':{tag:'(0011,"GEMS_GENIE_1",34)',vr:"LO",name:"SpatialCorrectName",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",35)':{tag:'(0011,"GEMS_GENIE_1",35)',vr:"LO",name:"TuningCalibName",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",36)':{tag:'(0011,"GEMS_GENIE_1",36)',vr:"LO",name:"UniformityCorrectName",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",37)':{tag:'(0011,"GEMS_GENIE_1",37)',vr:"LO",name:"AcquisitionSpecificCorrectName",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",38)':{tag:'(0011,"GEMS_GENIE_1",38)',vr:"SL",name:"ByteOrder",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",3a)':{tag:'(0011,"GEMS_GENIE_1",3a)',vr:"SL",name:"PictureFormat",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",3b)':{tag:'(0011,"GEMS_GENIE_1",3b)',vr:"FD",name:"PixelScale",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",3c)':{tag:'(0011,"GEMS_GENIE_1",3c)',vr:"FD",name:"PixelOffset",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",3e)':{tag:'(0011,"GEMS_GENIE_1",3e)',vr:"SL",name:"FOVShape",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",3f)':{tag:'(0011,"GEMS_GENIE_1",3f)',vr:"SL",name:"DatasetFlags",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",44)':{tag:'(0011,"GEMS_GENIE_1",44)',vr:"FD",name:"ThresholdCenter",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",45)':{tag:'(0011,"GEMS_GENIE_1",45)',vr:"FD",name:"ThresholdWidth",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",46)':{tag:'(0011,"GEMS_GENIE_1",46)',vr:"SL",name:"InterpolationType",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",55)':{tag:'(0011,"GEMS_GENIE_1",55)',vr:"FD",name:"Period",vm:"1",version:"PrivateTag"},'(0011,"GEMS_GENIE_1",56)':{tag:'(0011,"GEMS_GENIE_1",56)',vr:"FD",name:"ElapsedTime",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",10)':{tag:'(0013,"GEMS_GENIE_1",10)',vr:"FD",name:"DigitalFOV",vm:"2",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",11)':{tag:'(0013,"GEMS_GENIE_1",11)',vr:"SL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",12)':{tag:'(0013,"GEMS_GENIE_1",12)',vr:"SL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",16)':{tag:'(0013,"GEMS_GENIE_1",16)',vr:"SL",name:"AutoTrackPeak",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",17)':{tag:'(0013,"GEMS_GENIE_1",17)',vr:"SL",name:"AutoTrackWidth",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",18)':{tag:'(0013,"GEMS_GENIE_1",18)',vr:"FD",name:"TransmissionScanTime",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",19)':{tag:'(0013,"GEMS_GENIE_1",19)',vr:"FD",name:"TransmissionMaskWidth",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",1a)':{tag:'(0013,"GEMS_GENIE_1",1a)',vr:"FD",name:"CopperAttenuatorThickness",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",1c)':{tag:'(0013,"GEMS_GENIE_1",1c)',vr:"FD",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",1d)':{tag:'(0013,"GEMS_GENIE_1",1d)',vr:"FD",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",1e)':{tag:'(0013,"GEMS_GENIE_1",1e)',vr:"FD",name:"TomoViewOffset",vm:"1-n",version:"PrivateTag"},'(0013,"GEMS_GENIE_1",26)':{tag:'(0013,"GEMS_GENIE_1",26)',vr:"LT",name:"StudyComments",vm:"1",version:"PrivateTag"},'(0033,"GEMS_GNHD_01",01)':{tag:'(0033,"GEMS_GNHD_01",01)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0033,"GEMS_GNHD_01",02)':{tag:'(0033,"GEMS_GNHD_01",02)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",01)':{tag:'(0009,"GEMS_IDEN_01",01)',vr:"LO",name:"FullFidelity",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",02)':{tag:'(0009,"GEMS_IDEN_01",02)',vr:"SH",name:"SuiteId",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",04)':{tag:'(0009,"GEMS_IDEN_01",04)',vr:"SH",name:"ProductId",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",17)':{tag:'(0009,"GEMS_IDEN_01",17)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",1a)':{tag:'(0009,"GEMS_IDEN_01",1a)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",20)':{tag:'(0009,"GEMS_IDEN_01",20)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",27)':{tag:'(0009,"GEMS_IDEN_01",27)',vr:"SL",name:"ImageActualDate",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",2f)':{tag:'(0009,"GEMS_IDEN_01",2f)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",30)':{tag:'(0009,"GEMS_IDEN_01",30)',vr:"SH",name:"ServiceId",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",31)':{tag:'(0009,"GEMS_IDEN_01",31)',vr:"SH",name:"MobileLocationNumber",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",e2)':{tag:'(0009,"GEMS_IDEN_01",e2)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",e3)':{tag:'(0009,"GEMS_IDEN_01",e3)',vr:"UI",name:"EquipmentUID",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",e6)':{tag:'(0009,"GEMS_IDEN_01",e6)',vr:"SH",name:"GenesisVersionNow",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",e7)':{tag:'(0009,"GEMS_IDEN_01",e7)',vr:"UL",name:"ExamRecordChecksum",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",e8)':{tag:'(0009,"GEMS_IDEN_01",e8)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"GEMS_IDEN_01",e9)':{tag:'(0009,"GEMS_IDEN_01",e9)',vr:"SL",name:"ActualSeriesDataTimeStamp",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",06)':{tag:'(0027,"GEMS_IMAG_01",06)',vr:"SL",name:"ImageArchiveFlag",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",10)':{tag:'(0027,"GEMS_IMAG_01",10)',vr:"SS",name:"ScoutType",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",1c)':{tag:'(0027,"GEMS_IMAG_01",1c)',vr:"SL",name:"VmaMamp",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",1d)':{tag:'(0027,"GEMS_IMAG_01",1d)',vr:"SS",name:"VmaPhase",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",1e)':{tag:'(0027,"GEMS_IMAG_01",1e)',vr:"SL",name:"VmaMod",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",1f)':{tag:'(0027,"GEMS_IMAG_01",1f)',vr:"SL",name:"VmaClip",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",20)':{tag:'(0027,"GEMS_IMAG_01",20)',vr:"SS",name:"SmartScanOnOffFlag",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",30)':{tag:'(0027,"GEMS_IMAG_01",30)',vr:"SH",name:"ForeignImageRevision",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",31)':{tag:'(0027,"GEMS_IMAG_01",31)',vr:"SS",name:"ImagingMode",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",32)':{tag:'(0027,"GEMS_IMAG_01",32)',vr:"SS",name:"PulseSequence",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",33)':{tag:'(0027,"GEMS_IMAG_01",33)',vr:"SL",name:"ImagingOptions",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",35)':{tag:'(0027,"GEMS_IMAG_01",35)',vr:"SS",name:"PlaneType",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",36)':{tag:'(0027,"GEMS_IMAG_01",36)',vr:"SL",name:"ObliquePlane",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",40)':{tag:'(0027,"GEMS_IMAG_01",40)',vr:"SH",name:"RASLetterOfImageLocation",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",41)':{tag:'(0027,"GEMS_IMAG_01",41)',vr:"FL",name:"ImageLocation",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",42)':{tag:'(0027,"GEMS_IMAG_01",42)',vr:"FL",name:"CenterRCoordOfPlaneImage",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",43)':{tag:'(0027,"GEMS_IMAG_01",43)',vr:"FL",name:"CenterACoordOfPlaneImage",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",44)':{tag:'(0027,"GEMS_IMAG_01",44)',vr:"FL",name:"CenterSCoordOfPlaneImage",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",45)':{tag:'(0027,"GEMS_IMAG_01",45)',vr:"FL",name:"NormalRCoord",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",46)':{tag:'(0027,"GEMS_IMAG_01",46)',vr:"FL",name:"NormalACoord",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",47)':{tag:'(0027,"GEMS_IMAG_01",47)',vr:"FL",name:"NormalSCoord",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",48)':{tag:'(0027,"GEMS_IMAG_01",48)',vr:"FL",name:"RCoordOfTopRightCorner",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",49)':{tag:'(0027,"GEMS_IMAG_01",49)',vr:"FL",name:"ACoordOfTopRightCorner",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",4a)':{tag:'(0027,"GEMS_IMAG_01",4a)',vr:"FL",name:"SCoordOfTopRightCorner",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",4b)':{tag:'(0027,"GEMS_IMAG_01",4b)',vr:"FL",name:"RCoordOfBottomRightCorner",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",4c)':{tag:'(0027,"GEMS_IMAG_01",4c)',vr:"FL",name:"ACoordOfBottomRightCorner",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",4d)':{tag:'(0027,"GEMS_IMAG_01",4d)',vr:"FL",name:"SCoordOfBottomRightCorner",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",50)':{tag:'(0027,"GEMS_IMAG_01",50)',vr:"FL",name:"TableStartLocation",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",51)':{tag:'(0027,"GEMS_IMAG_01",51)',vr:"FL",name:"TableEndLocation",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",52)':{tag:'(0027,"GEMS_IMAG_01",52)',vr:"SH",name:"RASLetterForSideOfImage",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",53)':{tag:'(0027,"GEMS_IMAG_01",53)',vr:"SH",name:"RASLetterForAnteriorPosterior",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",54)':{tag:'(0027,"GEMS_IMAG_01",54)',vr:"SH",name:"RASLetterForScoutStartLoc",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",55)':{tag:'(0027,"GEMS_IMAG_01",55)',vr:"SH",name:"RASLetterForScoutEndLoc",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",60)':{tag:'(0027,"GEMS_IMAG_01",60)',vr:"FL",name:"ImageDimensionX",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",61)':{tag:'(0027,"GEMS_IMAG_01",61)',vr:"FL",name:"ImageDimensionY",vm:"1",version:"PrivateTag"},'(0027,"GEMS_IMAG_01",62)':{tag:'(0027,"GEMS_IMAG_01",62)',vr:"FL",name:"NumberOfExcitations",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",04)':{tag:'(0029,"GEMS_IMPS_01",04)',vr:"SL",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",05)':{tag:'(0029,"GEMS_IMPS_01",05)',vr:"DS",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",06)':{tag:'(0029,"GEMS_IMPS_01",06)',vr:"DS",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",07)':{tag:'(0029,"GEMS_IMPS_01",07)',vr:"SL",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",08)':{tag:'(0029,"GEMS_IMPS_01",08)',vr:"SH",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",09)':{tag:'(0029,"GEMS_IMPS_01",09)',vr:"SH",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",0a)':{tag:'(0029,"GEMS_IMPS_01",0a)',vr:"SS",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",15)':{tag:'(0029,"GEMS_IMPS_01",15)',vr:"SL",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",16)':{tag:'(0029,"GEMS_IMPS_01",16)',vr:"SL",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",17)':{tag:'(0029,"GEMS_IMPS_01",17)',vr:"SL",name:"LowerRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",18)':{tag:'(0029,"GEMS_IMPS_01",18)',vr:"SL",name:"UpperRangeOfPixels",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",1a)':{tag:'(0029,"GEMS_IMPS_01",1a)',vr:"SL",name:"LengthOfTotalHeaderInBytes",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",26)':{tag:'(0029,"GEMS_IMPS_01",26)',vr:"SS",name:"VersionOfHeaderStructure",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",34)':{tag:'(0029,"GEMS_IMPS_01",34)',vr:"SL",name:"AdvantageCompOverflow",vm:"1",version:"PrivateTag"},'(0029,"GEMS_IMPS_01",35)':{tag:'(0029,"GEMS_IMPS_01",35)',vr:"SL",name:"AdvantageCompUnderflow",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",01)':{tag:'(0043,"GEMS_PARM_01",01)',vr:"SS",name:"BitmapOfPrescanOptions",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",02)':{tag:'(0043,"GEMS_PARM_01",02)',vr:"SS",name:"GradientOffsetInX",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",03)':{tag:'(0043,"GEMS_PARM_01",03)',vr:"SS",name:"GradientOffsetInY",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",04)':{tag:'(0043,"GEMS_PARM_01",04)',vr:"SS",name:"GradientOffsetInZ",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",05)':{tag:'(0043,"GEMS_PARM_01",05)',vr:"SS",name:"ImageIsOriginalOrUnoriginal",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",06)':{tag:'(0043,"GEMS_PARM_01",06)',vr:"SS",name:"NumberOfEPIShots",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",07)':{tag:'(0043,"GEMS_PARM_01",07)',vr:"SS",name:"ViewsPerSegment",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",08)':{tag:'(0043,"GEMS_PARM_01",08)',vr:"SS",name:"RespiratoryRateInBPM",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",09)':{tag:'(0043,"GEMS_PARM_01",09)',vr:"SS",name:"RespiratoryTriggerPoint",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",0a)':{tag:'(0043,"GEMS_PARM_01",0a)',vr:"SS",name:"TypeOfReceiverUsed",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",0b)':{tag:'(0043,"GEMS_PARM_01",0b)',vr:"DS",name:"PeakRateOfChangeOfGradientField",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",0c)':{tag:'(0043,"GEMS_PARM_01",0c)',vr:"DS",name:"LimitsInUnitsOfPercent",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",0d)':{tag:'(0043,"GEMS_PARM_01",0d)',vr:"DS",name:"PSDEstimatedLimit",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",0e)':{tag:'(0043,"GEMS_PARM_01",0e)',vr:"DS",name:"PSDEstimatedLimitInTeslaPerSecond",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",0f)':{tag:'(0043,"GEMS_PARM_01",0f)',vr:"DS",name:"SARAvgHead",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",10)':{tag:'(0043,"GEMS_PARM_01",10)',vr:"US",name:"WindowValue",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",11)':{tag:'(0043,"GEMS_PARM_01",11)',vr:"US",name:"TotalInputViews",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",12)':{tag:'(0043,"GEMS_PARM_01",12)',vr:"SS",name:"XrayChain",vm:"3",version:"PrivateTag"},'(0043,"GEMS_PARM_01",13)':{tag:'(0043,"GEMS_PARM_01",13)',vr:"SS",name:"ReconKernelParameters",vm:"5",version:"PrivateTag"},'(0043,"GEMS_PARM_01",14)':{tag:'(0043,"GEMS_PARM_01",14)',vr:"SS",name:"CalibrationParameters",vm:"3",version:"PrivateTag"},'(0043,"GEMS_PARM_01",15)':{tag:'(0043,"GEMS_PARM_01",15)',vr:"SS",name:"TotalOutputViews",vm:"3",version:"PrivateTag"},'(0043,"GEMS_PARM_01",16)':{tag:'(0043,"GEMS_PARM_01",16)',vr:"SS",name:"NumberOfOverranges",vm:"5",version:"PrivateTag"},'(0043,"GEMS_PARM_01",17)':{tag:'(0043,"GEMS_PARM_01",17)',vr:"DS",name:"IBHImageScaleFactors",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",18)':{tag:'(0043,"GEMS_PARM_01",18)',vr:"DS",name:"BBHCoefficients",vm:"3",version:"PrivateTag"},'(0043,"GEMS_PARM_01",19)':{tag:'(0043,"GEMS_PARM_01",19)',vr:"SS",name:"NumberOfBBHChainsToBlend",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",1a)':{tag:'(0043,"GEMS_PARM_01",1a)',vr:"SL",name:"StartingChannelNumber",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",1b)':{tag:'(0043,"GEMS_PARM_01",1b)',vr:"SS",name:"PPScanParameters",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",1c)':{tag:'(0043,"GEMS_PARM_01",1c)',vr:"SS",name:"GEImageIntegrity",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",1d)':{tag:'(0043,"GEMS_PARM_01",1d)',vr:"SS",name:"LevelValue",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",1e)':{tag:'(0043,"GEMS_PARM_01",1e)',vr:"DS",name:"DeltaStartTime",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",1f)':{tag:'(0043,"GEMS_PARM_01",1f)',vr:"SL",name:"MaxOverrangesInAView",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",20)':{tag:'(0043,"GEMS_PARM_01",20)',vr:"DS",name:"AvgOverrangesAllViews",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",21)':{tag:'(0043,"GEMS_PARM_01",21)',vr:"SS",name:"CorrectedAfterglowTerms",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",25)':{tag:'(0043,"GEMS_PARM_01",25)',vr:"SS",name:"ReferenceChannels",vm:"6",version:"PrivateTag"},'(0043,"GEMS_PARM_01",26)':{tag:'(0043,"GEMS_PARM_01",26)',vr:"US",name:"NoViewsRefChannelsBlocked",vm:"6",version:"PrivateTag"},'(0043,"GEMS_PARM_01",27)':{tag:'(0043,"GEMS_PARM_01",27)',vr:"SH",name:"ScanPitchRatio",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",28)':{tag:'(0043,"GEMS_PARM_01",28)',vr:"OB",name:"UniqueImageIdentifier",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",29)':{tag:'(0043,"GEMS_PARM_01",29)',vr:"OB",name:"HistogramTables",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",2a)':{tag:'(0043,"GEMS_PARM_01",2a)',vr:"OB",name:"UserDefinedData",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",2b)':{tag:'(0043,"GEMS_PARM_01",2b)',vr:"SS",name:"PrivateScanOptions",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",2c)':{tag:'(0043,"GEMS_PARM_01",2c)',vr:"SS",name:"EffectiveEchoSpacing",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",2d)':{tag:'(0043,"GEMS_PARM_01",2d)',vr:"SH",name:"StringSlopField1",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",2e)':{tag:'(0043,"GEMS_PARM_01",2e)',vr:"SH",name:"StringSlopField2",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",2f)':{tag:'(0043,"GEMS_PARM_01",2f)',vr:"SS",name:"RawDataType",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",30)':{tag:'(0043,"GEMS_PARM_01",30)',vr:"SS",name:"RawDataType",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",31)':{tag:'(0043,"GEMS_PARM_01",31)',vr:"DS",name:"RACoordOfTargetReconCentre",vm:"2",version:"PrivateTag"},'(0043,"GEMS_PARM_01",32)':{tag:'(0043,"GEMS_PARM_01",32)',vr:"SS",name:"RawDataType",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",33)':{tag:'(0043,"GEMS_PARM_01",33)',vr:"FL",name:"NegScanSpacing",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",34)':{tag:'(0043,"GEMS_PARM_01",34)',vr:"IS",name:"OffsetFrequency",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",35)':{tag:'(0043,"GEMS_PARM_01",35)',vr:"UL",name:"UserUsageTag",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",36)':{tag:'(0043,"GEMS_PARM_01",36)',vr:"UL",name:"UserFillMapMSW",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",37)':{tag:'(0043,"GEMS_PARM_01",37)',vr:"UL",name:"UserFillMapLSW",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",38)':{tag:'(0043,"GEMS_PARM_01",38)',vr:"FL",name:"User25ToUser48",vm:"24",version:"PrivateTag"},'(0043,"GEMS_PARM_01",39)':{tag:'(0043,"GEMS_PARM_01",39)',vr:"IS",name:"SlopInteger6ToSlopInteger9",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",40)':{tag:'(0043,"GEMS_PARM_01",40)',vr:"FL",name:"TriggerOnPosition",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",41)':{tag:'(0043,"GEMS_PARM_01",41)',vr:"FL",name:"DegreeOfRotation",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",42)':{tag:'(0043,"GEMS_PARM_01",42)',vr:"SL",name:"DASTriggerSource",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",43)':{tag:'(0043,"GEMS_PARM_01",43)',vr:"SL",name:"DASFpaGain",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",44)':{tag:'(0043,"GEMS_PARM_01",44)',vr:"SL",name:"DASOutputSource",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",45)':{tag:'(0043,"GEMS_PARM_01",45)',vr:"SL",name:"DASAdInput",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",46)':{tag:'(0043,"GEMS_PARM_01",46)',vr:"SL",name:"DASCalMode",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",47)':{tag:'(0043,"GEMS_PARM_01",47)',vr:"SL",name:"DASCalFrequency",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",48)':{tag:'(0043,"GEMS_PARM_01",48)',vr:"SL",name:"DASRegXm",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",49)':{tag:'(0043,"GEMS_PARM_01",49)',vr:"SL",name:"DASAutoZero",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",4a)':{tag:'(0043,"GEMS_PARM_01",4a)',vr:"SS",name:"StartingChannelOfView",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",4b)':{tag:'(0043,"GEMS_PARM_01",4b)',vr:"SL",name:"DASXmPattern",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",4c)':{tag:'(0043,"GEMS_PARM_01",4c)',vr:"SS",name:"TGGCTriggerMode",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",4d)':{tag:'(0043,"GEMS_PARM_01",4d)',vr:"FL",name:"StartScanToXrayOnDelay",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",4e)':{tag:'(0043,"GEMS_PARM_01",4e)',vr:"FL",name:"DurationOfXrayOn",vm:"4",version:"PrivateTag"},'(0043,"GEMS_PARM_01",60)':{tag:'(0043,"GEMS_PARM_01",60)',vr:"IS",name:"SlopInteger10ToSlopInteger17",vm:"8",version:"PrivateTag"},'(0043,"GEMS_PARM_01",61)':{tag:'(0043,"GEMS_PARM_01",61)',vr:"UI",name:"ScannerStudyEntityUID",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",62)':{tag:'(0043,"GEMS_PARM_01",62)',vr:"SH",name:"ScannerStudyID",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",6f)':{tag:'(0043,"GEMS_PARM_01",6f)',vr:"DS",name:"ScannerTableEntry",vm:"3",version:"PrivateTag"},'(0043,"GEMS_PARM_01",70)':{tag:'(0043,"GEMS_PARM_01",70)',vr:"LO",name:"ParadigmName",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",71)':{tag:'(0043,"GEMS_PARM_01",71)',vr:"ST",name:"ParadigmDescription",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",72)':{tag:'(0043,"GEMS_PARM_01",72)',vr:"UI",name:"ParadigmUID",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",73)':{tag:'(0043,"GEMS_PARM_01",73)',vr:"US",name:"ExperimentType",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",74)':{tag:'(0043,"GEMS_PARM_01",74)',vr:"US",name:"NumberOfRestVolumes",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",75)':{tag:'(0043,"GEMS_PARM_01",75)',vr:"US",name:"NumberOfActiveVolumes",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",76)':{tag:'(0043,"GEMS_PARM_01",76)',vr:"US",name:"NumberOfDummyScans",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",77)':{tag:'(0043,"GEMS_PARM_01",77)',vr:"SH",name:"ApplicationName",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",78)':{tag:'(0043,"GEMS_PARM_01",78)',vr:"SH",name:"ApplicationVersion",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",79)':{tag:'(0043,"GEMS_PARM_01",79)',vr:"US",name:"SlicesPerVolume",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",7a)':{tag:'(0043,"GEMS_PARM_01",7a)',vr:"US",name:"ExpectedTimePoints",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",7b)':{tag:'(0043,"GEMS_PARM_01",7b)',vr:"FL",name:"RegressorValues",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",7c)':{tag:'(0043,"GEMS_PARM_01",7c)',vr:"FL",name:"DelayAfterSliceGroup",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",7d)':{tag:'(0043,"GEMS_PARM_01",7d)',vr:"US",name:"ReconModeFlagWord",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",7e)':{tag:'(0043,"GEMS_PARM_01",7e)',vr:"LO",name:"PACCSpecificInformation",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",7f)':{tag:'(0043,"GEMS_PARM_01",7f)',vr:"DS",name:"EDWIScaleFactor",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",80)':{tag:'(0043,"GEMS_PARM_01",80)',vr:"LO",name:"CoilIDData",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",81)':{tag:'(0043,"GEMS_PARM_01",81)',vr:"LO",name:"GECoilName",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",82)':{tag:'(0043,"GEMS_PARM_01",82)',vr:"LO",name:"SystemConfigurationInformation",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",83)':{tag:'(0043,"GEMS_PARM_01",83)',vr:"DS",name:"AssetRFactors",vm:"1-2",version:"PrivateTag"},'(0043,"GEMS_PARM_01",84)':{tag:'(0043,"GEMS_PARM_01",84)',vr:"LO",name:"AdditionalAssetData",vm:"5-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",85)':{tag:'(0043,"GEMS_PARM_01",85)',vr:"UT",name:"DebugDataTextFormat",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",86)':{tag:'(0043,"GEMS_PARM_01",86)',vr:"OB",name:"DebugDataBinaryFormat",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",87)':{tag:'(0043,"GEMS_PARM_01",87)',vr:"UT",name:"ScannerSoftwareVersionLongForm",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",88)':{tag:'(0043,"GEMS_PARM_01",88)',vr:"UI",name:"PUREAcquisitionCalibrationSeriesUID",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",89)':{tag:'(0043,"GEMS_PARM_01",89)',vr:"LO",name:"GoverningBodydBdtAndSARDefinition",vm:"3",version:"PrivateTag"},'(0043,"GEMS_PARM_01",8a)':{tag:'(0043,"GEMS_PARM_01",8a)',vr:"CS",name:"PrivateInPlanePhaseEncodingDirection",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",8b)':{tag:'(0043,"GEMS_PARM_01",8b)',vr:"OB",name:"FMRIBinaryDataBlock",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",8c)':{tag:'(0043,"GEMS_PARM_01",8c)',vr:"DS",name:"VoxelLocation",vm:"6",version:"PrivateTag"},'(0043,"GEMS_PARM_01",8d)':{tag:'(0043,"GEMS_PARM_01",8d)',vr:"DS",name:"SATBandLocations",vm:"7-7n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",8e)':{tag:'(0043,"GEMS_PARM_01",8e)',vr:"DS",name:"SpectroPrescanValues",vm:"3",version:"PrivateTag"},'(0043,"GEMS_PARM_01",8f)':{tag:'(0043,"GEMS_PARM_01",8f)',vr:"DS",name:"SpectroParameters",vm:"3",version:"PrivateTag"},'(0043,"GEMS_PARM_01",90)':{tag:'(0043,"GEMS_PARM_01",90)',vr:"LO",name:"SARDefinition",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",91)':{tag:'(0043,"GEMS_PARM_01",91)',vr:"DS",name:"SARValue",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",92)':{tag:'(0043,"GEMS_PARM_01",92)',vr:"LO",name:"ImageErrorText",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",93)':{tag:'(0043,"GEMS_PARM_01",93)',vr:"DS",name:"SpectroQuantitationValues",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",94)':{tag:'(0043,"GEMS_PARM_01",94)',vr:"DS",name:"SpectroRatioValues",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",95)':{tag:'(0043,"GEMS_PARM_01",95)',vr:"LO",name:"PrescanReuseString",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",96)':{tag:'(0043,"GEMS_PARM_01",96)',vr:"CS",name:"ContentQualification",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",97)':{tag:'(0043,"GEMS_PARM_01",97)',vr:"LO",name:"ImageFilteringParameters",vm:"9",version:"PrivateTag"},'(0043,"GEMS_PARM_01",98)':{tag:'(0043,"GEMS_PARM_01",98)',vr:"UI",name:"ASSETAcquisitionCalibrationSeriesUID",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",99)':{tag:'(0043,"GEMS_PARM_01",99)',vr:"LO",name:"ExtendedOptions",vm:"1-n",version:"PrivateTag"},'(0043,"GEMS_PARM_01",9a)':{tag:'(0043,"GEMS_PARM_01",9a)',vr:"IS",name:"RxStackIdentification",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",9b)':{tag:'(0043,"GEMS_PARM_01",9b)',vr:"DS",name:"NPWFactor",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",9c)':{tag:'(0043,"GEMS_PARM_01",9c)',vr:"OB",name:"ResearchTag1",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",9d)':{tag:'(0043,"GEMS_PARM_01",9d)',vr:"OB",name:"ResearchTag2",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",9e)':{tag:'(0043,"GEMS_PARM_01",9e)',vr:"OB",name:"ResearchTag3",vm:"1",version:"PrivateTag"},'(0043,"GEMS_PARM_01",9f)':{tag:'(0043,"GEMS_PARM_01",9f)',vr:"OB",name:"ResearchTag4",vm:"1",version:"PrivateTag"},'(0011,"GEMS_PATI_01",10)':{tag:'(0011,"GEMS_PATI_01",10)',vr:"SS",name:"PatientStatus",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",03)':{tag:'(0021,"GEMS_RELA_01",03)',vr:"SS",name:"SeriesFromWhichPrescribed",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",05)':{tag:'(0021,"GEMS_RELA_01",05)',vr:"SH",name:"GenesisVersionNow",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",07)':{tag:'(0021,"GEMS_RELA_01",07)',vr:"UL",name:"SeriesRecordChecksum",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",15)':{tag:'(0021,"GEMS_RELA_01",15)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",16)':{tag:'(0021,"GEMS_RELA_01",16)',vr:"SS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",18)':{tag:'(0021,"GEMS_RELA_01",18)',vr:"SH",name:"GenesisVersionNow",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",19)':{tag:'(0021,"GEMS_RELA_01",19)',vr:"UL",name:"AcqReconRecordChecksum",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",20)':{tag:'(0021,"GEMS_RELA_01",20)',vr:"DS",name:"TableStartLocation",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",35)':{tag:'(0021,"GEMS_RELA_01",35)',vr:"SS",name:"SeriesFromWhichPrescribed",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",36)':{tag:'(0021,"GEMS_RELA_01",36)',vr:"SS",name:"ImageFromWhichPrescribed",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",37)':{tag:'(0021,"GEMS_RELA_01",37)',vr:"SS",name:"ScreenFormat",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",4a)':{tag:'(0021,"GEMS_RELA_01",4a)',vr:"LO",name:"AnatomicalReferenceForScout",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",4e)':{tag:'(0021,"GEMS_RELA_01",4e)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",4f)':{tag:'(0021,"GEMS_RELA_01",4f)',vr:"SS",name:"LocationsInAcquisition",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",50)':{tag:'(0021,"GEMS_RELA_01",50)',vr:"SS",name:"GraphicallyPrescribed",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",51)':{tag:'(0021,"GEMS_RELA_01",51)',vr:"DS",name:"RotationFromSourceXRot",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",52)':{tag:'(0021,"GEMS_RELA_01",52)',vr:"DS",name:"RotationFromSourceYRot",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",53)':{tag:'(0021,"GEMS_RELA_01",53)',vr:"DS",name:"RotationFromSourceZRot",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",54)':{tag:'(0021,"GEMS_RELA_01",54)',vr:"SH",name:"ImagePosition",vm:"3",version:"PrivateTag"},'(0021,"GEMS_RELA_01",55)':{tag:'(0021,"GEMS_RELA_01",55)',vr:"SH",name:"ImageOrientation",vm:"6",version:"PrivateTag"},'(0021,"GEMS_RELA_01",56)':{tag:'(0021,"GEMS_RELA_01",56)',vr:"SL",name:"IntegerSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",57)':{tag:'(0021,"GEMS_RELA_01",57)',vr:"SL",name:"IntegerSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",58)':{tag:'(0021,"GEMS_RELA_01",58)',vr:"SL",name:"IntegerSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",59)':{tag:'(0021,"GEMS_RELA_01",59)',vr:"SL",name:"IntegerSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",5a)':{tag:'(0021,"GEMS_RELA_01",5a)',vr:"SL",name:"IntegerSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",5b)':{tag:'(0021,"GEMS_RELA_01",5b)',vr:"DS",name:"FloatSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",5c)':{tag:'(0021,"GEMS_RELA_01",5c)',vr:"DS",name:"FloatSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",5d)':{tag:'(0021,"GEMS_RELA_01",5d)',vr:"DS",name:"FloatSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",5e)':{tag:'(0021,"GEMS_RELA_01",5e)',vr:"DS",name:"FloatSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",5f)':{tag:'(0021,"GEMS_RELA_01",5f)',vr:"DS",name:"FloatSlop",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",70)':{tag:'(0021,"GEMS_RELA_01",70)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",71)':{tag:'(0021,"GEMS_RELA_01",71)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",81)':{tag:'(0021,"GEMS_RELA_01",81)',vr:"DS",name:"AutoWindowLevelAlpha",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",82)':{tag:'(0021,"GEMS_RELA_01",82)',vr:"DS",name:"AutoWindowLevelBeta",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",83)':{tag:'(0021,"GEMS_RELA_01",83)',vr:"DS",name:"AutoWindowLevelWindow",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",84)':{tag:'(0021,"GEMS_RELA_01",84)',vr:"DS",name:"AutoWindowLevelLevel",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",90)':{tag:'(0021,"GEMS_RELA_01",90)',vr:"SS",name:"TubeFocalSpotPosition",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",91)':{tag:'(0021,"GEMS_RELA_01",91)',vr:"SS",name:"BiopsyPosition",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",92)':{tag:'(0021,"GEMS_RELA_01",92)',vr:"FL",name:"BiopsyTLocation",vm:"1",version:"PrivateTag"},'(0021,"GEMS_RELA_01",93)':{tag:'(0021,"GEMS_RELA_01",93)',vr:"FL",name:"BiopsyRefLocation",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",04)':{tag:'(0045,"GEMS_SENO_02",04)',vr:"CS",name:"AES",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",06)':{tag:'(0045,"GEMS_SENO_02",06)',vr:"DS",name:"Angulation",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",09)':{tag:'(0045,"GEMS_SENO_02",09)',vr:"DS",name:"RealMagnificationFactor",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",0b)':{tag:'(0045,"GEMS_SENO_02",0b)',vr:"CS",name:"SenographType",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",0c)':{tag:'(0045,"GEMS_SENO_02",0c)',vr:"DS",name:"IntegrationTime",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",0d)':{tag:'(0045,"GEMS_SENO_02",0d)',vr:"DS",name:"ROIOriginXY",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",11)':{tag:'(0045,"GEMS_SENO_02",11)',vr:"DS",name:"ReceptorSizeCmXY",vm:"2",version:"PrivateTag"},'(0045,"GEMS_SENO_02",12)':{tag:'(0045,"GEMS_SENO_02",12)',vr:"IS",name:"ReceptorSizePixelsXY",vm:"2",version:"PrivateTag"},'(0045,"GEMS_SENO_02",13)':{tag:'(0045,"GEMS_SENO_02",13)',vr:"ST",name:"Screen",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",14)':{tag:'(0045,"GEMS_SENO_02",14)',vr:"DS",name:"PixelPitchMicrons",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",15)':{tag:'(0045,"GEMS_SENO_02",15)',vr:"IS",name:"PixelDepthBits",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",16)':{tag:'(0045,"GEMS_SENO_02",16)',vr:"IS",name:"BinningFactorXY",vm:"2",version:"PrivateTag"},'(0045,"GEMS_SENO_02",1B)':{tag:'(0045,"GEMS_SENO_02",1B)',vr:"CS",name:"ClinicalView",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",1D)':{tag:'(0045,"GEMS_SENO_02",1D)',vr:"DS",name:"MeanOfRawGrayLevels",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",1E)':{tag:'(0045,"GEMS_SENO_02",1E)',vr:"DS",name:"MeanOfOffsetGrayLevels",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",1F)':{tag:'(0045,"GEMS_SENO_02",1F)',vr:"DS",name:"MeanOfCorrectedGrayLevels",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",20)':{tag:'(0045,"GEMS_SENO_02",20)',vr:"DS",name:"MeanOfRegionGrayLevels",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",21)':{tag:'(0045,"GEMS_SENO_02",21)',vr:"DS",name:"MeanOfLogRegionGrayLevels",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",22)':{tag:'(0045,"GEMS_SENO_02",22)',vr:"DS",name:"StandardDeviationOfRawGrayLevels",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",23)':{tag:'(0045,"GEMS_SENO_02",23)',vr:"DS",name:"StandardDeviationOfCorrectedGrayLevels",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",24)':{tag:'(0045,"GEMS_SENO_02",24)',vr:"DS",name:"StandardDeviationOfRegionGrayLevels",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",25)':{tag:'(0045,"GEMS_SENO_02",25)',vr:"DS",name:"StandardDeviationOfLogRegionGrayLevels",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",26)':{tag:'(0045,"GEMS_SENO_02",26)',vr:"OB",name:"MAOBuffer",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",27)':{tag:'(0045,"GEMS_SENO_02",27)',vr:"IS",name:"SetNumber",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",28)':{tag:'(0045,"GEMS_SENO_02",28)',vr:"CS",name:"WindowingType",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",29)':{tag:'(0045,"GEMS_SENO_02",29)',vr:"DS",name:"WindowingParameters",vm:"1-n",version:"PrivateTag"},'(0045,"GEMS_SENO_02",2a)':{tag:'(0045,"GEMS_SENO_02",2a)',vr:"IS",name:"CrosshairCursorXCoordinates",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",2b)':{tag:'(0045,"GEMS_SENO_02",2b)',vr:"IS",name:"CrosshairCursorYCoordinates",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",39)':{tag:'(0045,"GEMS_SENO_02",39)',vr:"US",name:"VignetteRows",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",3a)':{tag:'(0045,"GEMS_SENO_02",3a)',vr:"US",name:"VignetteColumns",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",3b)':{tag:'(0045,"GEMS_SENO_02",3b)',vr:"US",name:"VignetteBitsAllocated",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",3c)':{tag:'(0045,"GEMS_SENO_02",3c)',vr:"US",name:"VignetteBitsStored",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",3d)':{tag:'(0045,"GEMS_SENO_02",3d)',vr:"US",name:"VignetteHighBit",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",3e)':{tag:'(0045,"GEMS_SENO_02",3e)',vr:"US",name:"VignettePixelRepresentation",vm:"1",version:"PrivateTag"},'(0045,"GEMS_SENO_02",3f)':{tag:'(0045,"GEMS_SENO_02",3f)',vr:"OB",name:"VignettePixelData",vm:"1",version:"PrivateTag"},'(0025,"GEMS_SERS_01",06)':{tag:'(0025,"GEMS_SERS_01",06)',vr:"SS",name:"LastPulseSequenceUsed",vm:"1",version:"PrivateTag"},'(0025,"GEMS_SERS_01",07)':{tag:'(0025,"GEMS_SERS_01",07)',vr:"SL",name:"ImagesInSeries",vm:"1",version:"PrivateTag"},'(0025,"GEMS_SERS_01",10)':{tag:'(0025,"GEMS_SERS_01",10)',vr:"SL",name:"LandmarkCounter",vm:"1",version:"PrivateTag"},'(0025,"GEMS_SERS_01",11)':{tag:'(0025,"GEMS_SERS_01",11)',vr:"SS",name:"NumberOfAcquisitions",vm:"1",version:"PrivateTag"},'(0025,"GEMS_SERS_01",14)':{tag:'(0025,"GEMS_SERS_01",14)',vr:"SL",name:"IndicatesNumberOfUpdatesToHeader",vm:"1",version:"PrivateTag"},'(0025,"GEMS_SERS_01",17)':{tag:'(0025,"GEMS_SERS_01",17)',vr:"SL",name:"SeriesCompleteFlag",vm:"1",version:"PrivateTag"},'(0025,"GEMS_SERS_01",18)':{tag:'(0025,"GEMS_SERS_01",18)',vr:"SL",name:"NumberOfImagesArchived",vm:"1",version:"PrivateTag"},'(0025,"GEMS_SERS_01",19)':{tag:'(0025,"GEMS_SERS_01",19)',vr:"SL",name:"LastImageNumberUsed",vm:"1",version:"PrivateTag"},'(0025,"GEMS_SERS_01",1a)':{tag:'(0025,"GEMS_SERS_01",1a)',vr:"SH",name:"PrimaryReceiverSuiteAndHost",vm:"1",version:"PrivateTag"},'(0023,"GEMS_STDY_01",01)':{tag:'(0023,"GEMS_STDY_01",01)',vr:"SL",name:"NumberOfSeriesInStudy",vm:"1",version:"PrivateTag"},'(0023,"GEMS_STDY_01",02)':{tag:'(0023,"GEMS_STDY_01",02)',vr:"SL",name:"NumberOfUnarchivedSeries",vm:"1",version:"PrivateTag"},'(0023,"GEMS_STDY_01",10)':{tag:'(0023,"GEMS_STDY_01",10)',vr:"SS",name:"ReferenceImageField",vm:"1",version:"PrivateTag"},'(0023,"GEMS_STDY_01",50)':{tag:'(0023,"GEMS_STDY_01",50)',vr:"SS",name:"SummaryImage",vm:"1",version:"PrivateTag"},'(0023,"GEMS_STDY_01",70)':{tag:'(0023,"GEMS_STDY_01",70)',vr:"FD",name:"StartTimeSecsInFirstAxial",vm:"1",version:"PrivateTag"},'(0023,"GEMS_STDY_01",74)':{tag:'(0023,"GEMS_STDY_01",74)',vr:"SL",name:"NumberOfUpdatesToHeader",vm:"1",version:"PrivateTag"},'(0023,"GEMS_STDY_01",7d)':{tag:'(0023,"GEMS_STDY_01",7d)',vr:"SS",name:"IndicatesIfStudyHasCompleteInfo",vm:"1",version:"PrivateTag"},'(0033,"GEMS_YMHD_01",05)':{tag:'(0033,"GEMS_YMHD_01",05)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0033,"GEMS_YMHD_01",06)':{tag:'(0033,"GEMS_YMHD_01",06)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",39)':{tag:'(0019,"GE_GENESIS_REV3.0",39)',vr:"SS",name:"AxialType",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",8f)':{tag:'(0019,"GE_GENESIS_REV3.0",8f)',vr:"SS",name:"SwapPhaseFrequency",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",9c)':{tag:'(0019,"GE_GENESIS_REV3.0",9c)',vr:"SS",name:"PulseSequenceName",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",9f)':{tag:'(0019,"GE_GENESIS_REV3.0",9f)',vr:"SS",name:"CoilType",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",a4)':{tag:'(0019,"GE_GENESIS_REV3.0",a4)',vr:"SS",name:"SATFatWaterBone",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",c0)':{tag:'(0019,"GE_GENESIS_REV3.0",c0)',vr:"SS",name:"BitmapOfSATSelections",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",c1)':{tag:'(0019,"GE_GENESIS_REV3.0",c1)',vr:"SS",name:"SurfaceCoilIntensityCorrectionFlag",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",cb)':{tag:'(0019,"GE_GENESIS_REV3.0",cb)',vr:"SS",name:"PhaseContrastFlowAxis",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",cc)':{tag:'(0019,"GE_GENESIS_REV3.0",cc)',vr:"SS",name:"PhaseContrastVelocityEncoding",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",d5)':{tag:'(0019,"GE_GENESIS_REV3.0",d5)',vr:"SS",name:"FractionalEcho",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",d8)':{tag:'(0019,"GE_GENESIS_REV3.0",d8)',vr:"SS",name:"VariableEchoFlag",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",d9)':{tag:'(0019,"GE_GENESIS_REV3.0",d9)',vr:"DS",name:"ConcatenatedSat",vm:"1",version:"PrivateTag"},'(0019,"GE_GENESIS_REV3.0",f2)':{tag:'(0019,"GE_GENESIS_REV3.0",f2)',vr:"SS",name:"NumberOfPhases",vm:"1",version:"PrivateTag"},'(0043,"GE_GENESIS_REV3.0",1e)':{tag:'(0043,"GE_GENESIS_REV3.0",1e)',vr:"DS",name:"DeltaStartTime",vm:"1",version:"PrivateTag"},'(0043,"GE_GENESIS_REV3.0",27)':{tag:'(0043,"GE_GENESIS_REV3.0",27)',vr:"SH",name:"ScanPitchRatio",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",01)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",01)',vr:"FD",name:"ImageCompressionFraction",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",02)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",02)',vr:"FD",name:"ImageQuality",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",03)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",03)',vr:"FD",name:"ImageBytesTransferred",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",10)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",10)',vr:"SH",name:"J2cParameterType",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",11)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",11)',vr:"US",name:"J2cPixelRepresentation",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",12)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",12)',vr:"US",name:"J2cBitsAllocated",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",13)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",13)',vr:"US",name:"J2cPixelShiftValue",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",14)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",14)',vr:"US",name:"J2cPlanarConfiguration",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",15)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",15)',vr:"DS",name:"J2cRescaleIntercept",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",20)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",20)',vr:"LO",name:"PixelDataMD5SumPerFrame",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",21)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",21)',vr:"US",name:"HistogramPercentileLabels",vm:"1",version:"PrivateTag"},'(0029,"INTELERAD MEDICAL SYSTEMS",22)':{tag:'(0029,"INTELERAD MEDICAL SYSTEMS",22)',vr:"FD",name:"HistogramPercentileValues",vm:"1",version:"PrivateTag"},'(3f01,"INTELERAD MEDICAL SYSTEMS",01)':{tag:'(3f01,"INTELERAD MEDICAL SYSTEMS",01)',vr:"LO",name:"InstitutionCode",vm:"1",version:"PrivateTag"},'(3f01,"INTELERAD MEDICAL SYSTEMS",02)':{tag:'(3f01,"INTELERAD MEDICAL SYSTEMS",02)',vr:"LO",name:"RoutedTransferAE",vm:"1",version:"PrivateTag"},'(3f01,"INTELERAD MEDICAL SYSTEMS",03)':{tag:'(3f01,"INTELERAD MEDICAL SYSTEMS",03)',vr:"LO",name:"SourceAE",vm:"1",version:"PrivateTag"},'(3f01,"INTELERAD MEDICAL SYSTEMS",04)':{tag:'(3f01,"INTELERAD MEDICAL SYSTEMS",04)',vr:"SH",name:"DeferredValidation",vm:"1",version:"PrivateTag"},'(3f01,"INTELERAD MEDICAL SYSTEMS",05)':{tag:'(3f01,"INTELERAD MEDICAL SYSTEMS",05)',vr:"LO",name:"SeriesOwner",vm:"1",version:"PrivateTag"},'(3f01,"INTELERAD MEDICAL SYSTEMS",06)':{tag:'(3f01,"INTELERAD MEDICAL SYSTEMS",06)',vr:"LO",name:"OrderGroupNumber",vm:"1",version:"PrivateTag"},'(3f01,"INTELERAD MEDICAL SYSTEMS",07)':{tag:'(3f01,"INTELERAD MEDICAL SYSTEMS",07)',vr:"SH",name:"StrippedPixelData",vm:"1",version:"PrivateTag"},'(3f01,"INTELERAD MEDICAL SYSTEMS",08)':{tag:'(3f01,"INTELERAD MEDICAL SYSTEMS",08)',vr:"SH",name:"PendingMoveRequest",vm:"1",version:"PrivateTag"},'(0041,"INTEGRIS 1.0",20)':{tag:'(0041,"INTEGRIS 1.0",20)',vr:"FL",name:"AccumulatedFluoroscopyDose",vm:"1",version:"PrivateTag"},'(0041,"INTEGRIS 1.0",30)':{tag:'(0041,"INTEGRIS 1.0",30)',vr:"FL",name:"AccumulatedExposureDose",vm:"1",version:"PrivateTag"},'(0041,"INTEGRIS 1.0",40)':{tag:'(0041,"INTEGRIS 1.0",40)',vr:"FL",name:"TotalDose",vm:"1",version:"PrivateTag"},'(0041,"INTEGRIS 1.0",41)':{tag:'(0041,"INTEGRIS 1.0",41)',vr:"FL",name:"TotalNumberOfFrames",vm:"1",version:"PrivateTag"},'(0041,"INTEGRIS 1.0",50)':{tag:'(0041,"INTEGRIS 1.0",50)',vr:"SQ",name:"ExposureInformationSequence",vm:"1",version:"PrivateTag"},'(0009,"INTEGRIS 1.0",08)':{tag:'(0009,"INTEGRIS 1.0",08)',vr:"CS",name:"ExposureChannel",vm:"1-n",version:"PrivateTag"},'(0009,"INTEGRIS 1.0",32)':{tag:'(0009,"INTEGRIS 1.0",32)',vr:"TM",name:"ExposureStartTime",vm:"1",version:"PrivateTag"},'(0019,"INTEGRIS 1.0",00)':{tag:'(0019,"INTEGRIS 1.0",00)',vr:"LO",name:"APRName",vm:"1",version:"PrivateTag"},'(0019,"INTEGRIS 1.0",40)':{tag:'(0019,"INTEGRIS 1.0",40)',vr:"DS",name:"FrameRate",vm:"1",version:"PrivateTag"},'(0021,"INTEGRIS 1.0",12)':{tag:'(0021,"INTEGRIS 1.0",12)',vr:"IS",name:"ExposureNumber",vm:"1",version:"PrivateTag"},'(0029,"INTEGRIS 1.0",08)':{tag:'(0029,"INTEGRIS 1.0",08)',vr:"IS",name:"NumberOfExposureResults",vm:"1",version:"PrivateTag"},'(0029,"ISG shadow",70)':{tag:'(0029,"ISG shadow",70)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"ISG shadow",80)':{tag:'(0029,"ISG shadow",80)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"ISG shadow",90)':{tag:'(0029,"ISG shadow",90)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"ISI",01)':{tag:'(0009,"ISI",01)',vr:"UN",name:"SIENETGeneralPurposeIMGEF",vm:"1",version:"PrivateTag"},'(0009,"MERGE TECHNOLOGIES, INC.",00)':{tag:'(0009,"MERGE TECHNOLOGIES, INC.",00)',vr:"OB",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"OCULUS Optikgeraete GmbH",1010)':{tag:'(0029,"OCULUS Optikgeraete GmbH",1010)',vr:"OB",name:"OriginalMeasuringData",vm:"1",version:"PrivateTag"},'(0029,"OCULUS Optikgeraete GmbH",1012)':{tag:'(0029,"OCULUS Optikgeraete GmbH",1012)',vr:"UL",name:"OriginalMeasuringDataLength",vm:"1",version:"PrivateTag"},'(0029,"OCULUS Optikgeraete GmbH",1020)':{tag:'(0029,"OCULUS Optikgeraete GmbH",1020)',vr:"OB",name:"OriginalMeasuringRawData",vm:"1",version:"PrivateTag"},'(0029,"OCULUS Optikgeraete GmbH",1022)':{tag:'(0029,"OCULUS Optikgeraete GmbH",1022)',vr:"UL",name:"OriginalMeasuringRawDataLength",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",00)':{tag:'(0041,"PAPYRUS 3.0",00)',vr:"LT",name:"PapyrusComments",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",10)':{tag:'(0041,"PAPYRUS 3.0",10)',vr:"SQ",name:"PointerSequence",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",11)':{tag:'(0041,"PAPYRUS 3.0",11)',vr:"UL",name:"ImagePointer",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",12)':{tag:'(0041,"PAPYRUS 3.0",12)',vr:"UL",name:"PixelOffset",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",13)':{tag:'(0041,"PAPYRUS 3.0",13)',vr:"SQ",name:"ImageIdentifierSequence",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",14)':{tag:'(0041,"PAPYRUS 3.0",14)',vr:"SQ",name:"ExternalFileReferenceSequence",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",15)':{tag:'(0041,"PAPYRUS 3.0",15)',vr:"US",name:"NumberOfImages",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",21)':{tag:'(0041,"PAPYRUS 3.0",21)',vr:"UI",name:"ReferencedSOPClassUID",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",22)':{tag:'(0041,"PAPYRUS 3.0",22)',vr:"UI",name:"ReferencedSOPInstanceUID",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",31)':{tag:'(0041,"PAPYRUS 3.0",31)',vr:"LT",name:"ReferencedFileName",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",32)':{tag:'(0041,"PAPYRUS 3.0",32)',vr:"LT",name:"ReferencedFilePath",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",41)':{tag:'(0041,"PAPYRUS 3.0",41)',vr:"UI",name:"ReferencedImageSOPClassUID",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",42)':{tag:'(0041,"PAPYRUS 3.0",42)',vr:"UI",name:"ReferencedImageSOPInstanceUID",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS 3.0",50)':{tag:'(0041,"PAPYRUS 3.0",50)',vr:"SQ",name:"ImageSequence",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",00)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",00)',vr:"IS",name:"OverlayID",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",01)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",01)',vr:"LT",name:"LinkedOverlays",vm:"1-n",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",10)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",10)',vr:"US",name:"OverlayRows",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",11)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",11)',vr:"US",name:"OverlayColumns",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",40)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",40)',vr:"LO",name:"OverlayType",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",50)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",50)',vr:"US",name:"OverlayOrigin",vm:"1-n",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",60)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",60)',vr:"LO",name:"Editable",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",70)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",70)',vr:"LO",name:"OverlayFont",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",72)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",72)',vr:"LO",name:"OverlayStyle",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",74)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",74)',vr:"US",name:"OverlayFontSize",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",76)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",76)',vr:"LO",name:"OverlayColor",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",78)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",78)',vr:"US",name:"ShadowSize",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",80)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",80)',vr:"LO",name:"FillPattern",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",82)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",82)',vr:"US",name:"OverlayPenSize",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",a0)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",a0)',vr:"LO",name:"Label",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",a2)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",a2)',vr:"LT",name:"PostItText",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",a4)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",a4)',vr:"US",name:"AnchorPoint",vm:"2",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",b0)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",b0)',vr:"LO",name:"ROIType",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",b2)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",b2)',vr:"LT",name:"AttachedAnnotation",vm:"1",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",ba)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",ba)',vr:"US",name:"ContourPoints",vm:"1-n",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",bc)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",bc)',vr:"US",name:"MaskData",vm:"1-n",version:"PrivateTag"},'(6001-o-60ff,"PAPYRUS 3.0",c0)':{tag:'(6001-o-60ff,"PAPYRUS 3.0",c0)',vr:"SQ",name:"UINOverlaySequence",vm:"1",version:"PrivateTag"},'(0009,"PAPYRUS",00)':{tag:'(0009,"PAPYRUS",00)',vr:"LT",name:"OriginalFileName",vm:"1",version:"PrivateTag"},'(0009,"PAPYRUS",10)':{tag:'(0009,"PAPYRUS",10)',vr:"LT",name:"OriginalFileLocation",vm:"1",version:"PrivateTag"},'(0009,"PAPYRUS",18)':{tag:'(0009,"PAPYRUS",18)',vr:"LT",name:"DataSetIdentifier",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",00)':{tag:'(0041,"PAPYRUS",00)',vr:"LT",name:"PapyrusComments",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS",10)':{tag:'(0041,"PAPYRUS",10)',vr:"US",name:"FolderType",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",11)':{tag:'(0041,"PAPYRUS",11)',vr:"LT",name:"PatientFolderDataSetID",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",20)':{tag:'(0041,"PAPYRUS",20)',vr:"LT",name:"FolderName",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",30)':{tag:'(0041,"PAPYRUS",30)',vr:"DA",name:"CreationDate",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",32)':{tag:'(0041,"PAPYRUS",32)',vr:"TM",name:"CreationTime",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",34)':{tag:'(0041,"PAPYRUS",34)',vr:"DA",name:"ModifiedDate",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",36)':{tag:'(0041,"PAPYRUS",36)',vr:"TM",name:"ModifiedTime",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",40)':{tag:'(0041,"PAPYRUS",40)',vr:"LT",name:"OwnerName",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS",50)':{tag:'(0041,"PAPYRUS",50)',vr:"LT",name:"FolderStatus",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",60)':{tag:'(0041,"PAPYRUS",60)',vr:"UL",name:"NumberOfImages",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",62)':{tag:'(0041,"PAPYRUS",62)',vr:"UL",name:"NumberOfOther",vm:"1",version:"PrivateTag"},'(0041,"PAPYRUS",a0)':{tag:'(0041,"PAPYRUS",a0)',vr:"LT",name:"ExternalFolderElementDSID",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS",a1)':{tag:'(0041,"PAPYRUS",a1)',vr:"US",name:"ExternalFolderElementDataSetType",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS",a2)':{tag:'(0041,"PAPYRUS",a2)',vr:"LT",name:"ExternalFolderElementFileLocation",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS",a3)':{tag:'(0041,"PAPYRUS",a3)',vr:"UL",name:"ExternalFolderElementLength",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS",b0)':{tag:'(0041,"PAPYRUS",b0)',vr:"LT",name:"InternalFolderElementDSID",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS",b1)':{tag:'(0041,"PAPYRUS",b1)',vr:"US",name:"InternalFolderElementDataSetType",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS",b2)':{tag:'(0041,"PAPYRUS",b2)',vr:"UL",name:"InternalOffsetToDataSet",vm:"1-n",version:"PrivateTag"},'(0041,"PAPYRUS",b3)':{tag:'(0041,"PAPYRUS",b3)',vr:"UL",name:"InternalOffsetToImage",vm:"1-n"},'(2001,"Philips Imaging DD 001",01)':{tag:'(2001,"Philips Imaging DD 001",01)',vr:"FL",name:"ChemicalShift",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",02)':{tag:'(2001,"Philips Imaging DD 001",02)',vr:"IS",name:"ChemicalShiftNumberMR",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",03)':{tag:'(2001,"Philips Imaging DD 001",03)',vr:"FL",name:"DiffusionBFactor",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",04)':{tag:'(2001,"Philips Imaging DD 001",04)',vr:"CS",name:"DiffusionDirection",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",06)':{tag:'(2001,"Philips Imaging DD 001",06)',vr:"CS",name:"ImageEnhanced",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",07)':{tag:'(2001,"Philips Imaging DD 001",07)',vr:"CS",name:"ImageTypeEDES",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",08)':{tag:'(2001,"Philips Imaging DD 001",08)',vr:"IS",name:"PhaseNumber",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",09)':{tag:'(2001,"Philips Imaging DD 001",09)',vr:"FL",name:"ImagePrepulseDelay",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",0a)':{tag:'(2001,"Philips Imaging DD 001",0a)',vr:"IS",name:"SliceNumberMR",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",0b)':{tag:'(2001,"Philips Imaging DD 001",0b)',vr:"CS",name:"SliceOrientation",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",0c)':{tag:'(2001,"Philips Imaging DD 001",0c)',vr:"CS",name:"ArrhythmiaRejection",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",0e)':{tag:'(2001,"Philips Imaging DD 001",0e)',vr:"CS",name:"CardiacCycled",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",0f)':{tag:'(2001,"Philips Imaging DD 001",0f)',vr:"SS",name:"CardiacGateWidth",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",10)':{tag:'(2001,"Philips Imaging DD 001",10)',vr:"CS",name:"CardiacSync",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",11)':{tag:'(2001,"Philips Imaging DD 001",11)',vr:"FL",name:"DiffusionEchoTime",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",12)':{tag:'(2001,"Philips Imaging DD 001",12)',vr:"CS",name:"DynamicSeries",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",13)':{tag:'(2001,"Philips Imaging DD 001",13)',vr:"SL",name:"EPIFactor",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",14)':{tag:'(2001,"Philips Imaging DD 001",14)',vr:"SL",name:"NumberOfEchoes",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",15)':{tag:'(2001,"Philips Imaging DD 001",15)',vr:"SS",name:"NumberOfLocations",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",16)':{tag:'(2001,"Philips Imaging DD 001",16)',vr:"SS",name:"NumberOfPCDirections",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",17)':{tag:'(2001,"Philips Imaging DD 001",17)',vr:"SL",name:"NumberOfPhasesMR",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",18)':{tag:'(2001,"Philips Imaging DD 001",18)',vr:"SL",name:"NumberOfSlicesMR",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",19)':{tag:'(2001,"Philips Imaging DD 001",19)',vr:"CS",name:"PartialMatrixScanned",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",1a)':{tag:'(2001,"Philips Imaging DD 001",1a)',vr:"FL",name:"PCVelocity",vm:"1-n",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",1b)':{tag:'(2001,"Philips Imaging DD 001",1b)',vr:"FL",name:"PrepulseDelay",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",1c)':{tag:'(2001,"Philips Imaging DD 001",1c)',vr:"CS",name:"PrepulseType",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",1d)':{tag:'(2001,"Philips Imaging DD 001",1d)',vr:"IS",name:"ReconstructionNumberMR",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",1f)':{tag:'(2001,"Philips Imaging DD 001",1f)',vr:"CS",name:"RespirationSync",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",20)':{tag:'(2001,"Philips Imaging DD 001",20)',vr:"LO",name:"ScanningTechnique",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",21)':{tag:'(2001,"Philips Imaging DD 001",21)',vr:"CS",name:"SPIR",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",22)':{tag:'(2001,"Philips Imaging DD 001",22)',vr:"FL",name:"WaterFatShift",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",23)':{tag:'(2001,"Philips Imaging DD 001",23)',vr:"DS",name:"FlipAnglePhilips",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",24)':{tag:'(2001,"Philips Imaging DD 001",24)',vr:"CS",name:"SeriesIsInteractive",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",25)':{tag:'(2001,"Philips Imaging DD 001",25)',vr:"SH",name:"EchoTimeDisplayMR",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",26)':{tag:'(2001,"Philips Imaging DD 001",26)',vr:"CS",name:"PresentationStateSubtractionActive",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",2d)':{tag:'(2001,"Philips Imaging DD 001",2d)',vr:"SS",name:"StackNumberOfSlices",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",32)':{tag:'(2001,"Philips Imaging DD 001",32)',vr:"FL",name:"StackRadialAngle",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",33)':{tag:'(2001,"Philips Imaging DD 001",33)',vr:"CS",name:"StackRadialAxis",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",35)':{tag:'(2001,"Philips Imaging DD 001",35)',vr:"SS",name:"StackSliceNumber",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",36)':{tag:'(2001,"Philips Imaging DD 001",36)',vr:"CS",name:"StackType",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",3f)':{tag:'(2001,"Philips Imaging DD 001",3f)',vr:"CS",name:"ZoomMode",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",58)':{tag:'(2001,"Philips Imaging DD 001",58)',vr:"UL",name:"ContrastTransferTaste",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",5f)':{tag:'(2001,"Philips Imaging DD 001",5f)',vr:"SQ",name:"StackSequence",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",60)':{tag:'(2001,"Philips Imaging DD 001",60)',vr:"SL",name:"NumberOfStacks",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",61)':{tag:'(2001,"Philips Imaging DD 001",61)',vr:"CS",name:"SeriesTransmitted",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",62)':{tag:'(2001,"Philips Imaging DD 001",62)',vr:"CS",name:"SeriesCommitted",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",63)':{tag:'(2001,"Philips Imaging DD 001",63)',vr:"CS",name:"ExaminationSource",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",67)':{tag:'(2001,"Philips Imaging DD 001",67)',vr:"CS",name:"LinearPresentationGLTrafoShapeSub",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",77)':{tag:'(2001,"Philips Imaging DD 001",77)',vr:"CS",name:"GLTrafoType",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",7b)':{tag:'(2001,"Philips Imaging DD 001",7b)',vr:"IS",name:"AcquisitionNumber",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",81)':{tag:'(2001,"Philips Imaging DD 001",81)',vr:"IS",name:"NumberOfDynamicScans",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",9f)':{tag:'(2001,"Philips Imaging DD 001",9f)',vr:"US",name:"PixelProcessingKernelSize",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",a1)':{tag:'(2001,"Philips Imaging DD 001",a1)',vr:"CS",name:"IsRawImage",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",f1)':{tag:'(2001,"Philips Imaging DD 001",f1)',vr:"FL",name:"ProspectiveMotionCorrection",vm:"1",version:"PrivateTag"},'(2001,"Philips Imaging DD 001",f2)':{tag:'(2001,"Philips Imaging DD 001",f2)',vr:"FL",name:"RetrospectiveMotionCorrection",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",01)':{tag:'(2001,"PHILIPS IMAGING DD 001",01)',vr:"FL",name:"ChemicalShift",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",02)':{tag:'(2001,"PHILIPS IMAGING DD 001",02)',vr:"IS",name:"ChemicalShiftNumberMR",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",03)':{tag:'(2001,"PHILIPS IMAGING DD 001",03)',vr:"FL",name:"DiffusionBFactor",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",04)':{tag:'(2001,"PHILIPS IMAGING DD 001",04)',vr:"CS",name:"DiffusionDirection",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",06)':{tag:'(2001,"PHILIPS IMAGING DD 001",06)',vr:"CS",name:"ImageEnhanced",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",07)':{tag:'(2001,"PHILIPS IMAGING DD 001",07)',vr:"CS",name:"ImageTypeEDES",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",08)':{tag:'(2001,"PHILIPS IMAGING DD 001",08)',vr:"IS",name:"PhaseNumber",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",09)':{tag:'(2001,"PHILIPS IMAGING DD 001",09)',vr:"FL",name:"ImagePrepulseDelay",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",0a)':{tag:'(2001,"PHILIPS IMAGING DD 001",0a)',vr:"IS",name:"SliceNumberMR",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",0b)':{tag:'(2001,"PHILIPS IMAGING DD 001",0b)',vr:"CS",name:"SliceOrientation",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",0c)':{tag:'(2001,"PHILIPS IMAGING DD 001",0c)',vr:"CS",name:"ArrhythmiaRejection",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",0e)':{tag:'(2001,"PHILIPS IMAGING DD 001",0e)',vr:"CS",name:"CardiacCycled",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",0f)':{tag:'(2001,"PHILIPS IMAGING DD 001",0f)',vr:"SS",name:"CardiacGateWidth",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",10)':{tag:'(2001,"PHILIPS IMAGING DD 001",10)',vr:"CS",name:"CardiacSync",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",11)':{tag:'(2001,"PHILIPS IMAGING DD 001",11)',vr:"FL",name:"DiffusionEchoTime",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",12)':{tag:'(2001,"PHILIPS IMAGING DD 001",12)',vr:"CS",name:"DynamicSeries",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",13)':{tag:'(2001,"PHILIPS IMAGING DD 001",13)',vr:"SL",name:"EPIFactor",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",14)':{tag:'(2001,"PHILIPS IMAGING DD 001",14)',vr:"SL",name:"NumberOfEchoes",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",15)':{tag:'(2001,"PHILIPS IMAGING DD 001",15)',vr:"SS",name:"NumberOfLocations",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",16)':{tag:'(2001,"PHILIPS IMAGING DD 001",16)',vr:"SS",name:"NumberOfPCDirections",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",17)':{tag:'(2001,"PHILIPS IMAGING DD 001",17)',vr:"SL",name:"NumberOfPhasesMR",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",18)':{tag:'(2001,"PHILIPS IMAGING DD 001",18)',vr:"SL",name:"NumberOfSlicesMR",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",19)':{tag:'(2001,"PHILIPS IMAGING DD 001",19)',vr:"CS",name:"PartialMatrixScanned",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",1a)':{tag:'(2001,"PHILIPS IMAGING DD 001",1a)',vr:"FL",name:"PCVelocity",vm:"1-n",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",1b)':{tag:'(2001,"PHILIPS IMAGING DD 001",1b)',vr:"FL",name:"PrepulseDelay",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",1c)':{tag:'(2001,"PHILIPS IMAGING DD 001",1c)',vr:"CS",name:"PrepulseType",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",1d)':{tag:'(2001,"PHILIPS IMAGING DD 001",1d)',vr:"IS",name:"ReconstructionNumberMR",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",1f)':{tag:'(2001,"PHILIPS IMAGING DD 001",1f)',vr:"CS",name:"RespirationSync",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",20)':{tag:'(2001,"PHILIPS IMAGING DD 001",20)',vr:"LO",name:"ScanningTechnique",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",21)':{tag:'(2001,"PHILIPS IMAGING DD 001",21)',vr:"CS",name:"SPIR",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",22)':{tag:'(2001,"PHILIPS IMAGING DD 001",22)',vr:"FL",name:"WaterFatShift",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",23)':{tag:'(2001,"PHILIPS IMAGING DD 001",23)',vr:"DS",name:"FlipAnglePhilips",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",24)':{tag:'(2001,"PHILIPS IMAGING DD 001",24)',vr:"CS",name:"SeriesIsInteractive",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",25)':{tag:'(2001,"PHILIPS IMAGING DD 001",25)',vr:"SH",name:"EchoTimeDisplayMR",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",26)':{tag:'(2001,"PHILIPS IMAGING DD 001",26)',vr:"CS",name:"PresentationStateSubtractionActive",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",2d)':{tag:'(2001,"PHILIPS IMAGING DD 001",2d)',vr:"SS",name:"StackNumberOfSlices",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",32)':{tag:'(2001,"PHILIPS IMAGING DD 001",32)',vr:"FL",name:"StackRadialAngle",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",33)':{tag:'(2001,"PHILIPS IMAGING DD 001",33)',vr:"CS",name:"StackRadialAxis",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",35)':{tag:'(2001,"PHILIPS IMAGING DD 001",35)',vr:"SS",name:"StackSliceNumber",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",36)':{tag:'(2001,"PHILIPS IMAGING DD 001",36)',vr:"CS",name:"StackType",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",3f)':{tag:'(2001,"PHILIPS IMAGING DD 001",3f)',vr:"CS",name:"ZoomMode",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",58)':{tag:'(2001,"PHILIPS IMAGING DD 001",58)',vr:"UL",name:"ContrastTransferTaste",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",5f)':{tag:'(2001,"PHILIPS IMAGING DD 001",5f)',vr:"SQ",name:"StackSequence",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",60)':{tag:'(2001,"PHILIPS IMAGING DD 001",60)',vr:"SL",name:"NumberOfStacks",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",61)':{tag:'(2001,"PHILIPS IMAGING DD 001",61)',vr:"CS",name:"SeriesTransmitted",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",62)':{tag:'(2001,"PHILIPS IMAGING DD 001",62)',vr:"CS",name:"SeriesCommitted",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",63)':{tag:'(2001,"PHILIPS IMAGING DD 001",63)',vr:"CS",name:"ExaminationSource",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",67)':{tag:'(2001,"PHILIPS IMAGING DD 001",67)',vr:"CS",name:"LinearPresentationGLTrafoShapeSub",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",77)':{tag:'(2001,"PHILIPS IMAGING DD 001",77)',vr:"CS",name:"GLTrafoType",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",7b)':{tag:'(2001,"PHILIPS IMAGING DD 001",7b)',vr:"IS",name:"AcquisitionNumber",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",81)':{tag:'(2001,"PHILIPS IMAGING DD 001",81)',vr:"IS",name:"NumberOfDynamicScans",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",9f)':{tag:'(2001,"PHILIPS IMAGING DD 001",9f)',vr:"US",name:"PixelProcessingKernelSize",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",a1)':{tag:'(2001,"PHILIPS IMAGING DD 001",a1)',vr:"CS",name:"IsRawImage",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",f1)':{tag:'(2001,"PHILIPS IMAGING DD 001",f1)',vr:"FL",name:"ProspectiveMotionCorrection",vm:"1",version:"PrivateTag"},'(2001,"PHILIPS IMAGING DD 001",f2)':{tag:'(2001,"PHILIPS IMAGING DD 001",f2)',vr:"FL",name:"RetrospectiveMotionCorrection",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",05)':{tag:'(2005,"Philips MR Imaging DD 001",05)',vr:"CS",name:"SynergyReconstructionType",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",1e)':{tag:'(2005,"Philips MR Imaging DD 001",1e)',vr:"SH",name:"MIPProtocol",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",1f)':{tag:'(2005,"Philips MR Imaging DD 001",1f)',vr:"SH",name:"MPRProtocol",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",20)':{tag:'(2005,"Philips MR Imaging DD 001",20)',vr:"SL",name:"NumberOfChemicalShifts",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",2d)':{tag:'(2005,"Philips MR Imaging DD 001",2d)',vr:"SS",name:"NumberOfStackSlices",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",83)':{tag:'(2005,"Philips MR Imaging DD 001",83)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",a1)':{tag:'(2005,"Philips MR Imaging DD 001",a1)',vr:"CS",name:"SyncraScanType",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",b0)':{tag:'(2005,"Philips MR Imaging DD 001",b0)',vr:"FL",name:"DiffusionDirectionRL",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",b1)':{tag:'(2005,"Philips MR Imaging DD 001",b1)',vr:"FL",name:"DiffusionDirectionAP",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 001",b2)':{tag:'(2005,"Philips MR Imaging DD 001",b2)',vr:"FL",name:"DiffusionDirectionFH",vm:"1",version:"PrivateTag"},'(2005,"Philips MR Imaging DD 005",02)':{tag:'(2005,"Philips MR Imaging DD 005",02)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",05)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",05)',vr:"CS",name:"SynergyReconstructionType",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",1e)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",1e)',vr:"SH",name:"MIPProtocol",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",1f)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",1f)',vr:"SH",name:"MPRProtocol",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",20)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",20)',vr:"SL",name:"NumberOfChemicalShifts",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",2d)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",2d)',vr:"SS",name:"NumberOfStackSlices",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",83)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",83)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",a1)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",a1)',vr:"CS",name:"SyncraScanType",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",b0)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",b0)',vr:"FL",name:"DiffusionDirectionRL",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",b1)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",b1)',vr:"FL",name:"DiffusionDirectionAP",vm:"1",version:"PrivateTag"},'(2005,"PHILIPS MR IMAGING DD 001",b2)':{tag:'(2005,"PHILIPS MR IMAGING DD 001",b2)',vr:"FL",name:"DiffusionDirectionFH",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR R5.5/PART",1000)':{tag:'(0019,"PHILIPS MR R5.5/PART",1000)',vr:"DS",name:"FieldOfView",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR R5.6/PART",1000)':{tag:'(0019,"PHILIPS MR R5.6/PART",1000)',vr:"DS",name:"FieldOfView",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",01)':{tag:'(0019,"PHILIPS MR SPECTRO;1",01)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",02)':{tag:'(0019,"PHILIPS MR SPECTRO;1",02)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",03)':{tag:'(0019,"PHILIPS MR SPECTRO;1",03)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",04)':{tag:'(0019,"PHILIPS MR SPECTRO;1",04)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",05)':{tag:'(0019,"PHILIPS MR SPECTRO;1",05)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",06)':{tag:'(0019,"PHILIPS MR SPECTRO;1",06)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",07)':{tag:'(0019,"PHILIPS MR SPECTRO;1",07)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",08)':{tag:'(0019,"PHILIPS MR SPECTRO;1",08)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",09)':{tag:'(0019,"PHILIPS MR SPECTRO;1",09)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",10)':{tag:'(0019,"PHILIPS MR SPECTRO;1",10)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",12)':{tag:'(0019,"PHILIPS MR SPECTRO;1",12)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",13)':{tag:'(0019,"PHILIPS MR SPECTRO;1",13)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",14)':{tag:'(0019,"PHILIPS MR SPECTRO;1",14)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",15)':{tag:'(0019,"PHILIPS MR SPECTRO;1",15)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",16)':{tag:'(0019,"PHILIPS MR SPECTRO;1",16)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",17)':{tag:'(0019,"PHILIPS MR SPECTRO;1",17)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",18)':{tag:'(0019,"PHILIPS MR SPECTRO;1",18)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",20)':{tag:'(0019,"PHILIPS MR SPECTRO;1",20)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",21)':{tag:'(0019,"PHILIPS MR SPECTRO;1",21)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",22)':{tag:'(0019,"PHILIPS MR SPECTRO;1",22)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",23)':{tag:'(0019,"PHILIPS MR SPECTRO;1",23)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",24)':{tag:'(0019,"PHILIPS MR SPECTRO;1",24)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",25)':{tag:'(0019,"PHILIPS MR SPECTRO;1",25)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",26)':{tag:'(0019,"PHILIPS MR SPECTRO;1",26)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",27)':{tag:'(0019,"PHILIPS MR SPECTRO;1",27)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",28)':{tag:'(0019,"PHILIPS MR SPECTRO;1",28)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",29)':{tag:'(0019,"PHILIPS MR SPECTRO;1",29)',vr:"IS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",31)':{tag:'(0019,"PHILIPS MR SPECTRO;1",31)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",32)':{tag:'(0019,"PHILIPS MR SPECTRO;1",32)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",41)':{tag:'(0019,"PHILIPS MR SPECTRO;1",41)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",42)':{tag:'(0019,"PHILIPS MR SPECTRO;1",42)',vr:"IS",name:"Unknown",vm:"2",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",43)':{tag:'(0019,"PHILIPS MR SPECTRO;1",43)',vr:"IS",name:"Unknown",vm:"2",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",45)':{tag:'(0019,"PHILIPS MR SPECTRO;1",45)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",46)':{tag:'(0019,"PHILIPS MR SPECTRO;1",46)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",47)':{tag:'(0019,"PHILIPS MR SPECTRO;1",47)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",48)':{tag:'(0019,"PHILIPS MR SPECTRO;1",48)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",49)':{tag:'(0019,"PHILIPS MR SPECTRO;1",49)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",50)':{tag:'(0019,"PHILIPS MR SPECTRO;1",50)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",60)':{tag:'(0019,"PHILIPS MR SPECTRO;1",60)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",61)':{tag:'(0019,"PHILIPS MR SPECTRO;1",61)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",70)':{tag:'(0019,"PHILIPS MR SPECTRO;1",70)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",71)':{tag:'(0019,"PHILIPS MR SPECTRO;1",71)',vr:"IS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",72)':{tag:'(0019,"PHILIPS MR SPECTRO;1",72)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",73)':{tag:'(0019,"PHILIPS MR SPECTRO;1",73)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",74)':{tag:'(0019,"PHILIPS MR SPECTRO;1",74)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",76)':{tag:'(0019,"PHILIPS MR SPECTRO;1",76)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",77)':{tag:'(0019,"PHILIPS MR SPECTRO;1",77)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",78)':{tag:'(0019,"PHILIPS MR SPECTRO;1",78)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",79)':{tag:'(0019,"PHILIPS MR SPECTRO;1",79)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR SPECTRO;1",80)':{tag:'(0019,"PHILIPS MR SPECTRO;1",80)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"PHILIPS MR",10)':{tag:'(0009,"PHILIPS MR",10)',vr:"LO",name:"SPIRelease",vm:"1",version:"PrivateTag"},'(0009,"PHILIPS MR",12)':{tag:'(0009,"PHILIPS MR",12)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",09)':{tag:'(0019,"PHILIPS MR/LAST",09)',vr:"DS",name:"MainMagneticField",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",0e)':{tag:'(0019,"PHILIPS MR/LAST",0e)',vr:"IS",name:"FlowCompensation",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",b1)':{tag:'(0019,"PHILIPS MR/LAST",b1)',vr:"IS",name:"MinimumRRInterval",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",b2)':{tag:'(0019,"PHILIPS MR/LAST",b2)',vr:"IS",name:"MaximumRRInterval",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",b3)':{tag:'(0019,"PHILIPS MR/LAST",b3)',vr:"IS",name:"NumberOfRejections",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",b4)':{tag:'(0019,"PHILIPS MR/LAST",b4)',vr:"IS",name:"NumberOfRRIntervals",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",b5)':{tag:'(0019,"PHILIPS MR/LAST",b5)',vr:"IS",name:"ArrhythmiaRejection",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",c0)':{tag:'(0019,"PHILIPS MR/LAST",c0)',vr:"DS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",c6)':{tag:'(0019,"PHILIPS MR/LAST",c6)',vr:"IS",name:"CycledMultipleSlice",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",ce)':{tag:'(0019,"PHILIPS MR/LAST",ce)',vr:"IS",name:"REST",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",d5)':{tag:'(0019,"PHILIPS MR/LAST",d5)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",d6)':{tag:'(0019,"PHILIPS MR/LAST",d6)',vr:"IS",name:"FourierInterpolation",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",d9)':{tag:'(0019,"PHILIPS MR/LAST",d9)',vr:"IS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",e0)':{tag:'(0019,"PHILIPS MR/LAST",e0)',vr:"IS",name:"Prepulse",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",e1)':{tag:'(0019,"PHILIPS MR/LAST",e1)',vr:"DS",name:"PrepulseDelay",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",e2)':{tag:'(0019,"PHILIPS MR/LAST",e2)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",e3)':{tag:'(0019,"PHILIPS MR/LAST",e3)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",f0)':{tag:'(0019,"PHILIPS MR/LAST",f0)',vr:"LT",name:"WSProtocolString1",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",f1)':{tag:'(0019,"PHILIPS MR/LAST",f1)',vr:"LT",name:"WSProtocolString2",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",f2)':{tag:'(0019,"PHILIPS MR/LAST",f2)',vr:"LT",name:"WSProtocolString3",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/LAST",f3)':{tag:'(0019,"PHILIPS MR/LAST",f3)',vr:"LT",name:"WSProtocolString4",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/LAST",00)':{tag:'(0021,"PHILIPS MR/LAST",00)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/LAST",10)':{tag:'(0021,"PHILIPS MR/LAST",10)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/LAST",20)':{tag:'(0021,"PHILIPS MR/LAST",20)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/LAST",21)':{tag:'(0021,"PHILIPS MR/LAST",21)',vr:"DS",name:"SliceGap",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/LAST",22)':{tag:'(0021,"PHILIPS MR/LAST",22)',vr:"DS",name:"StackRadialAngle",vm:"1",version:"PrivateTag"},'(0027,"PHILIPS MR/LAST",00)':{tag:'(0027,"PHILIPS MR/LAST",00)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"PHILIPS MR/LAST",11)':{tag:'(0027,"PHILIPS MR/LAST",11)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0027,"PHILIPS MR/LAST",12)':{tag:'(0027,"PHILIPS MR/LAST",12)',vr:"DS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0027,"PHILIPS MR/LAST",13)':{tag:'(0027,"PHILIPS MR/LAST",13)',vr:"DS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0027,"PHILIPS MR/LAST",14)':{tag:'(0027,"PHILIPS MR/LAST",14)',vr:"DS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0027,"PHILIPS MR/LAST",15)':{tag:'(0027,"PHILIPS MR/LAST",15)',vr:"DS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0027,"PHILIPS MR/LAST",16)':{tag:'(0027,"PHILIPS MR/LAST",16)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",10)':{tag:'(0029,"PHILIPS MR/LAST",10)',vr:"DS",name:"FPMin",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",20)':{tag:'(0029,"PHILIPS MR/LAST",20)',vr:"DS",name:"FPMax",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",30)':{tag:'(0029,"PHILIPS MR/LAST",30)',vr:"DS",name:"ScaledMinimum",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",40)':{tag:'(0029,"PHILIPS MR/LAST",40)',vr:"DS",name:"ScaledMaximum",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",50)':{tag:'(0029,"PHILIPS MR/LAST",50)',vr:"DS",name:"WindowMinimum",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",60)':{tag:'(0029,"PHILIPS MR/LAST",60)',vr:"DS",name:"WindowMaximum",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",61)':{tag:'(0029,"PHILIPS MR/LAST",61)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",70)':{tag:'(0029,"PHILIPS MR/LAST",70)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",71)':{tag:'(0029,"PHILIPS MR/LAST",71)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",72)':{tag:'(0029,"PHILIPS MR/LAST",72)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",80)':{tag:'(0029,"PHILIPS MR/LAST",80)',vr:"IS",name:"ViewCenter",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",81)':{tag:'(0029,"PHILIPS MR/LAST",81)',vr:"IS",name:"ViewSize",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",82)':{tag:'(0029,"PHILIPS MR/LAST",82)',vr:"IS",name:"ViewZoom",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/LAST",83)':{tag:'(0029,"PHILIPS MR/LAST",83)',vr:"IS",name:"ViewTransform",vm:"1",version:"PrivateTag"},'(6001,"PHILIPS MR/LAST",00)':{tag:'(6001,"PHILIPS MR/LAST",00)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1000)':{tag:'(0019,"PHILIPS MR/PART",1000)',vr:"DS",name:"FieldOfView",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1005)':{tag:'(0019,"PHILIPS MR/PART",1005)',vr:"DS",name:"CCAngulation",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1006)':{tag:'(0019,"PHILIPS MR/PART",1006)',vr:"DS",name:"APAngulation",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1007)':{tag:'(0019,"PHILIPS MR/PART",1007)',vr:"DS",name:"LRAngulation",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1008)':{tag:'(0019,"PHILIPS MR/PART",1008)',vr:"IS",name:"PatientPosition",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1009)':{tag:'(0019,"PHILIPS MR/PART",1009)',vr:"IS",name:"PatientOrientation",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",100a)':{tag:'(0019,"PHILIPS MR/PART",100a)',vr:"IS",name:"SliceOrientation",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",100b)':{tag:'(0019,"PHILIPS MR/PART",100b)',vr:"DS",name:"LROffcenter",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",100c)':{tag:'(0019,"PHILIPS MR/PART",100c)',vr:"DS",name:"CCOffcenter",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",100d)':{tag:'(0019,"PHILIPS MR/PART",100d)',vr:"DS",name:"APOffcenter",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",100e)':{tag:'(0019,"PHILIPS MR/PART",100e)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",100f)':{tag:'(0019,"PHILIPS MR/PART",100f)',vr:"IS",name:"NumberOfSlices",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1010)':{tag:'(0019,"PHILIPS MR/PART",1010)',vr:"DS",name:"SliceFactor",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1011)':{tag:'(0019,"PHILIPS MR/PART",1011)',vr:"DS",name:"EchoTimes",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1015)':{tag:'(0019,"PHILIPS MR/PART",1015)',vr:"IS",name:"DynamicStudy",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1018)':{tag:'(0019,"PHILIPS MR/PART",1018)',vr:"DS",name:"HeartbeatInterval",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1019)':{tag:'(0019,"PHILIPS MR/PART",1019)',vr:"DS",name:"RepetitionTimeFFE",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",101a)':{tag:'(0019,"PHILIPS MR/PART",101a)',vr:"DS",name:"FFEFlipAngle",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",101b)':{tag:'(0019,"PHILIPS MR/PART",101b)',vr:"IS",name:"NumberOfScans",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1021)':{tag:'(0019,"PHILIPS MR/PART",1021)',vr:"DS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1022)':{tag:'(0019,"PHILIPS MR/PART",1022)',vr:"DS",name:"DynamicScanTimeBegin",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1024)':{tag:'(0019,"PHILIPS MR/PART",1024)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1064)':{tag:'(0019,"PHILIPS MR/PART",1064)',vr:"DS",name:"RepetitionTimeSE",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1065)':{tag:'(0019,"PHILIPS MR/PART",1065)',vr:"DS",name:"RepetitionTimeIR",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1069)':{tag:'(0019,"PHILIPS MR/PART",1069)',vr:"IS",name:"NumberOfPhases",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",106a)':{tag:'(0019,"PHILIPS MR/PART",106a)',vr:"IS",name:"CardiacFrequency",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",106b)':{tag:'(0019,"PHILIPS MR/PART",106b)',vr:"DS",name:"InversionDelay",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",106c)':{tag:'(0019,"PHILIPS MR/PART",106c)',vr:"DS",name:"GateDelay",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",106d)':{tag:'(0019,"PHILIPS MR/PART",106d)',vr:"DS",name:"GateWidth",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",106e)':{tag:'(0019,"PHILIPS MR/PART",106e)',vr:"DS",name:"TriggerDelayTime",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1080)':{tag:'(0019,"PHILIPS MR/PART",1080)',vr:"IS",name:"NumberOfChemicalShifts",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1081)':{tag:'(0019,"PHILIPS MR/PART",1081)',vr:"DS",name:"ChemicalShift",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1084)':{tag:'(0019,"PHILIPS MR/PART",1084)',vr:"IS",name:"NumberOfRows",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1085)':{tag:'(0019,"PHILIPS MR/PART",1085)',vr:"IS",name:"NumberOfSamples",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1094)':{tag:'(0019,"PHILIPS MR/PART",1094)',vr:"LO",name:"MagnetizationTransferContrast",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1095)':{tag:'(0019,"PHILIPS MR/PART",1095)',vr:"LO",name:"SpectralPresaturationWithInversionRecovery",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1096)':{tag:'(0019,"PHILIPS MR/PART",1096)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1097)':{tag:'(0019,"PHILIPS MR/PART",1097)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10a0)':{tag:'(0019,"PHILIPS MR/PART",10a0)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10a1)':{tag:'(0019,"PHILIPS MR/PART",10a1)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10a3)':{tag:'(0019,"PHILIPS MR/PART",10a3)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10a4)':{tag:'(0019,"PHILIPS MR/PART",10a4)',vr:"CS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10c8)':{tag:'(0019,"PHILIPS MR/PART",10c8)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10c9)':{tag:'(0019,"PHILIPS MR/PART",10c9)',vr:"IS",name:"FoldoverDirectionTransverse",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10ca)':{tag:'(0019,"PHILIPS MR/PART",10ca)',vr:"IS",name:"FoldoverDirectionSagittal",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10cb)':{tag:'(0019,"PHILIPS MR/PART",10cb)',vr:"IS",name:"FoldoverDirectionCoronal",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10cc)':{tag:'(0019,"PHILIPS MR/PART",10cc)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10cd)':{tag:'(0019,"PHILIPS MR/PART",10cd)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10ce)':{tag:'(0019,"PHILIPS MR/PART",10ce)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10cf)':{tag:'(0019,"PHILIPS MR/PART",10cf)',vr:"IS",name:"NumberOfEchoes",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10d0)':{tag:'(0019,"PHILIPS MR/PART",10d0)',vr:"IS",name:"ScanResolution",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10d2)':{tag:'(0019,"PHILIPS MR/PART",10d2)',vr:"LO",name:"WaterFatShift",vm:"2",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10d4)':{tag:'(0019,"PHILIPS MR/PART",10d4)',vr:"IS",name:"ArtifactReduction",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10d5)':{tag:'(0019,"PHILIPS MR/PART",10d5)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10d6)':{tag:'(0019,"PHILIPS MR/PART",10d6)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10d7)':{tag:'(0019,"PHILIPS MR/PART",10d7)',vr:"DS",name:"ScanPercentage",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10d8)':{tag:'(0019,"PHILIPS MR/PART",10d8)',vr:"IS",name:"Halfscan",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10d9)':{tag:'(0019,"PHILIPS MR/PART",10d9)',vr:"IS",name:"EPIFactor",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10da)':{tag:'(0019,"PHILIPS MR/PART",10da)',vr:"IS",name:"TurboFactor",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10db)':{tag:'(0019,"PHILIPS MR/PART",10db)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10e0)':{tag:'(0019,"PHILIPS MR/PART",10e0)',vr:"IS",name:"PercentageOfScanCompleted",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",10e1)':{tag:'(0019,"PHILIPS MR/PART",10e1)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1100)':{tag:'(0019,"PHILIPS MR/PART",1100)',vr:"IS",name:"NumberOfStacks",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1101)':{tag:'(0019,"PHILIPS MR/PART",1101)',vr:"IS",name:"StackType",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1102)':{tag:'(0019,"PHILIPS MR/PART",1102)',vr:"IS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",110b)':{tag:'(0019,"PHILIPS MR/PART",110b)',vr:"DS",name:"LROffcenter",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",110c)':{tag:'(0019,"PHILIPS MR/PART",110c)',vr:"DS",name:"CCOffcenter",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",110d)':{tag:'(0019,"PHILIPS MR/PART",110d)',vr:"DS",name:"APOffcenter",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",1145)':{tag:'(0019,"PHILIPS MR/PART",1145)',vr:"IS",name:"ReconstructionResolution",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",11fc)':{tag:'(0019,"PHILIPS MR/PART",11fc)',vr:"IS",name:"ResonanceFrequency",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",12c0)':{tag:'(0019,"PHILIPS MR/PART",12c0)',vr:"DS",name:"TriggerDelayTimes",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",12e0)':{tag:'(0019,"PHILIPS MR/PART",12e0)',vr:"IS",name:"PrepulseType",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",12e1)':{tag:'(0019,"PHILIPS MR/PART",12e1)',vr:"DS",name:"PrepulseDelay",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS MR/PART",12e3)':{tag:'(0019,"PHILIPS MR/PART",12e3)',vr:"DS",name:"PhaseContrastVelocity",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1000)':{tag:'(0021,"PHILIPS MR/PART",1000)',vr:"IS",name:"ReconstructionNumber",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1010)':{tag:'(0021,"PHILIPS MR/PART",1010)',vr:"IS",name:"ImageType",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1020)':{tag:'(0021,"PHILIPS MR/PART",1020)',vr:"IS",name:"SliceNumber",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1030)':{tag:'(0021,"PHILIPS MR/PART",1030)',vr:"IS",name:"EchoNumber",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1031)':{tag:'(0021,"PHILIPS MR/PART",1031)',vr:"DS",name:"PatientReferenceID",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1035)':{tag:'(0021,"PHILIPS MR/PART",1035)',vr:"IS",name:"ChemicalShiftNumber",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1040)':{tag:'(0021,"PHILIPS MR/PART",1040)',vr:"IS",name:"PhaseNumber",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1050)':{tag:'(0021,"PHILIPS MR/PART",1050)',vr:"IS",name:"DynamicScanNumber",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1060)':{tag:'(0021,"PHILIPS MR/PART",1060)',vr:"IS",name:"NumberOfRowsInObject",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1061)':{tag:'(0021,"PHILIPS MR/PART",1061)',vr:"IS",name:"RowNumber",vm:"1-n",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1062)':{tag:'(0021,"PHILIPS MR/PART",1062)',vr:"IS",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1100)':{tag:'(0021,"PHILIPS MR/PART",1100)',vr:"DA",name:"ScanDate",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1110)':{tag:'(0021,"PHILIPS MR/PART",1110)',vr:"TM",name:"ScanTime",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS MR/PART",1221)':{tag:'(0021,"PHILIPS MR/PART",1221)',vr:"IS",name:"SliceGap",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",00)':{tag:'(0029,"PHILIPS MR/PART",00)',vr:"DS",name:"Unknown",vm:"2",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",04)':{tag:'(0029,"PHILIPS MR/PART",04)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",10)':{tag:'(0029,"PHILIPS MR/PART",10)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",11)':{tag:'(0029,"PHILIPS MR/PART",11)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",20)':{tag:'(0029,"PHILIPS MR/PART",20)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",31)':{tag:'(0029,"PHILIPS MR/PART",31)',vr:"DS",name:"Unknown",vm:"2",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",32)':{tag:'(0029,"PHILIPS MR/PART",32)',vr:"DS",name:"Unknown",vm:"2",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",c3)':{tag:'(0029,"PHILIPS MR/PART",c3)',vr:"IS",name:"ScanResolution",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",c4)':{tag:'(0029,"PHILIPS MR/PART",c4)',vr:"IS",name:"FieldOfView",vm:"1",version:"PrivateTag"},'(0029,"PHILIPS MR/PART",d5)':{tag:'(0029,"PHILIPS MR/PART",d5)',vr:"LT",name:"SliceThickness",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS-MR-1",11)':{tag:'(0019,"PHILIPS-MR-1",11)',vr:"IS",name:"ChemicalShiftNumber",vm:"1",version:"PrivateTag"},'(0019,"PHILIPS-MR-1",12)':{tag:'(0019,"PHILIPS-MR-1",12)',vr:"IS",name:"PhaseNumber",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS-MR-1",01)':{tag:'(0021,"PHILIPS-MR-1",01)',vr:"IS",name:"ReconstructionNumber",vm:"1",version:"PrivateTag"},'(0021,"PHILIPS-MR-1",02)':{tag:'(0021,"PHILIPS-MR-1",02)',vr:"IS",name:"SliceNumber",vm:"1",version:"PrivateTag"},'(7001,"Picker NM Private Group",01)':{tag:'(7001,"Picker NM Private Group",01)',vr:"UI",name:"Unknown",vm:"1",version:"PrivateTag"},'(7001,"Picker NM Private Group",02)':{tag:'(7001,"Picker NM Private Group",02)',vr:"OB",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  ACQU",10)':{tag:'(0019,"SIEMENS CM VA0  ACQU",10)',vr:"LT",name:"ParameterFileName",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  ACQU",11)':{tag:'(0019,"SIEMENS CM VA0  ACQU",11)',vr:"LO",name:"SequenceFileName",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  ACQU",12)':{tag:'(0019,"SIEMENS CM VA0  ACQU",12)',vr:"LT",name:"SequenceFileOwner",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  ACQU",13)':{tag:'(0019,"SIEMENS CM VA0  ACQU",13)',vr:"LT",name:"SequenceDescription",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  ACQU",14)':{tag:'(0019,"SIEMENS CM VA0  ACQU",14)',vr:"LT",name:"EPIFileName",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  CMS",00)':{tag:'(0009,"SIEMENS CM VA0  CMS",00)',vr:"DS",name:"NumberOfMeasurements",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  CMS",10)':{tag:'(0009,"SIEMENS CM VA0  CMS",10)',vr:"LT",name:"StorageMode",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  CMS",12)':{tag:'(0009,"SIEMENS CM VA0  CMS",12)',vr:"UL",name:"EvaluationMaskImage",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  CMS",26)':{tag:'(0009,"SIEMENS CM VA0  CMS",26)',vr:"DA",name:"LastMoveDate",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  CMS",27)':{tag:'(0009,"SIEMENS CM VA0  CMS",27)',vr:"TM",name:"LastMoveTime",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS CM VA0  CMS",0a)':{tag:'(0011,"SIEMENS CM VA0  CMS",0a)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS CM VA0  CMS",10)':{tag:'(0011,"SIEMENS CM VA0  CMS",10)',vr:"DA",name:"RegistrationDate",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS CM VA0  CMS",11)':{tag:'(0011,"SIEMENS CM VA0  CMS",11)',vr:"TM",name:"RegistrationTime",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS CM VA0  CMS",22)':{tag:'(0011,"SIEMENS CM VA0  CMS",22)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS CM VA0  CMS",23)':{tag:'(0011,"SIEMENS CM VA0  CMS",23)',vr:"DS",name:"UsedPatientWeight",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS CM VA0  CMS",40)':{tag:'(0011,"SIEMENS CM VA0  CMS",40)',vr:"IS",name:"OrganCode",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",00)':{tag:'(0013,"SIEMENS CM VA0  CMS",00)',vr:"LT",name:"ModifyingPhysician",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",10)':{tag:'(0013,"SIEMENS CM VA0  CMS",10)',vr:"DA",name:"ModificationDate",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",12)':{tag:'(0013,"SIEMENS CM VA0  CMS",12)',vr:"TM",name:"ModificationTime",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",20)':{tag:'(0013,"SIEMENS CM VA0  CMS",20)',vr:"LO",name:"PatientName",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",22)':{tag:'(0013,"SIEMENS CM VA0  CMS",22)',vr:"LO",name:"PatientId",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",30)':{tag:'(0013,"SIEMENS CM VA0  CMS",30)',vr:"DA",name:"PatientBirthdate",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",31)':{tag:'(0013,"SIEMENS CM VA0  CMS",31)',vr:"DS",name:"PatientWeight",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",32)':{tag:'(0013,"SIEMENS CM VA0  CMS",32)',vr:"LT",name:"PatientsMaidenName",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",33)':{tag:'(0013,"SIEMENS CM VA0  CMS",33)',vr:"LT",name:"ReferringPhysician",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",34)':{tag:'(0013,"SIEMENS CM VA0  CMS",34)',vr:"LT",name:"AdmittingDiagnosis",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",35)':{tag:'(0013,"SIEMENS CM VA0  CMS",35)',vr:"LO",name:"PatientSex",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",40)':{tag:'(0013,"SIEMENS CM VA0  CMS",40)',vr:"LO",name:"ProcedureDescription",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",42)':{tag:'(0013,"SIEMENS CM VA0  CMS",42)',vr:"LO",name:"RestDirection",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",44)':{tag:'(0013,"SIEMENS CM VA0  CMS",44)',vr:"LO",name:"PatientPosition",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",46)':{tag:'(0013,"SIEMENS CM VA0  CMS",46)',vr:"LT",name:"ViewDirection",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",50)':{tag:'(0013,"SIEMENS CM VA0  CMS",50)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",51)':{tag:'(0013,"SIEMENS CM VA0  CMS",51)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",52)':{tag:'(0013,"SIEMENS CM VA0  CMS",52)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",53)':{tag:'(0013,"SIEMENS CM VA0  CMS",53)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",54)':{tag:'(0013,"SIEMENS CM VA0  CMS",54)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",55)':{tag:'(0013,"SIEMENS CM VA0  CMS",55)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0013,"SIEMENS CM VA0  CMS",56)':{tag:'(0013,"SIEMENS CM VA0  CMS",56)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  CMS",10)':{tag:'(0019,"SIEMENS CM VA0  CMS",10)',vr:"DS",name:"NetFrequency",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  CMS",20)':{tag:'(0019,"SIEMENS CM VA0  CMS",20)',vr:"LT",name:"MeasurementMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  CMS",30)':{tag:'(0019,"SIEMENS CM VA0  CMS",30)',vr:"LT",name:"CalculationMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  CMS",50)':{tag:'(0019,"SIEMENS CM VA0  CMS",50)',vr:"IS",name:"NoiseLevel",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CM VA0  CMS",60)':{tag:'(0019,"SIEMENS CM VA0  CMS",60)',vr:"IS",name:"NumberOfDataBytes",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",20)':{tag:'(0021,"SIEMENS CM VA0  CMS",20)',vr:"DS",name:"FoV",vm:"2",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",22)':{tag:'(0021,"SIEMENS CM VA0  CMS",22)',vr:"DS",name:"ImageMagnificationFactor",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",24)':{tag:'(0021,"SIEMENS CM VA0  CMS",24)',vr:"DS",name:"ImageScrollOffset",vm:"2",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",26)':{tag:'(0021,"SIEMENS CM VA0  CMS",26)',vr:"IS",name:"ImagePixelOffset",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",30)':{tag:'(0021,"SIEMENS CM VA0  CMS",30)',vr:"LT",name:"ViewDirection",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",32)':{tag:'(0021,"SIEMENS CM VA0  CMS",32)',vr:"CS",name:"PatientRestDirection",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",60)':{tag:'(0021,"SIEMENS CM VA0  CMS",60)',vr:"DS",name:"ImagePosition",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",61)':{tag:'(0021,"SIEMENS CM VA0  CMS",61)',vr:"DS",name:"ImageNormal",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",63)':{tag:'(0021,"SIEMENS CM VA0  CMS",63)',vr:"DS",name:"ImageDistance",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",65)':{tag:'(0021,"SIEMENS CM VA0  CMS",65)',vr:"US",name:"ImagePositioningHistoryMask",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",6a)':{tag:'(0021,"SIEMENS CM VA0  CMS",6a)',vr:"DS",name:"ImageRow",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",6b)':{tag:'(0021,"SIEMENS CM VA0  CMS",6b)',vr:"DS",name:"ImageColumn",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",70)':{tag:'(0021,"SIEMENS CM VA0  CMS",70)',vr:"LT",name:"PatientOrientationSet1",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",71)':{tag:'(0021,"SIEMENS CM VA0  CMS",71)',vr:"LT",name:"PatientOrientationSet2",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",80)':{tag:'(0021,"SIEMENS CM VA0  CMS",80)',vr:"LT",name:"StudyName",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CM VA0  CMS",82)':{tag:'(0021,"SIEMENS CM VA0  CMS",82)',vr:"LT",name:"StudyType",vm:"3",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",10)':{tag:'(0029,"SIEMENS CM VA0  CMS",10)',vr:"LT",name:"WindowStyle",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",11)':{tag:'(0029,"SIEMENS CM VA0  CMS",11)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",13)':{tag:'(0029,"SIEMENS CM VA0  CMS",13)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",20)':{tag:'(0029,"SIEMENS CM VA0  CMS",20)',vr:"LT",name:"PixelQualityCode",vm:"3",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",22)':{tag:'(0029,"SIEMENS CM VA0  CMS",22)',vr:"IS",name:"PixelQualityValue",vm:"3",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",50)':{tag:'(0029,"SIEMENS CM VA0  CMS",50)',vr:"LT",name:"ArchiveCode",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",51)':{tag:'(0029,"SIEMENS CM VA0  CMS",51)',vr:"LT",name:"ExposureCode",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",52)':{tag:'(0029,"SIEMENS CM VA0  CMS",52)',vr:"LT",name:"SortCode",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",53)':{tag:'(0029,"SIEMENS CM VA0  CMS",53)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CM VA0  CMS",60)':{tag:'(0029,"SIEMENS CM VA0  CMS",60)',vr:"LT",name:"Splash",vm:"1",version:"PrivateTag"},'(0051,"SIEMENS CM VA0  CMS",10)':{tag:'(0051,"SIEMENS CM VA0  CMS",10)',vr:"LT",name:"ImageText",vm:"1-n",version:"PrivateTag"},'(6021,"SIEMENS CM VA0  CMS",00)':{tag:'(6021,"SIEMENS CM VA0  CMS",00)',vr:"LT",name:"ImageGraphicsFormatCode",vm:"1",version:"PrivateTag"},'(6021,"SIEMENS CM VA0  CMS",10)':{tag:'(6021,"SIEMENS CM VA0  CMS",10)',vr:"LT",name:"ImageGraphics",vm:"1",version:"PrivateTag"},'(7fe1,"SIEMENS CM VA0  CMS",00)':{tag:'(7fe1,"SIEMENS CM VA0  CMS",00)',vr:"OB",name:"BinaryData",vm:"1-n",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  LAB",10)':{tag:'(0009,"SIEMENS CM VA0  LAB",10)',vr:"LT",name:"GeneratorIdentificationLabel",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  LAB",11)':{tag:'(0009,"SIEMENS CM VA0  LAB",11)',vr:"LT",name:"GantryIdentificationLabel",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  LAB",12)':{tag:'(0009,"SIEMENS CM VA0  LAB",12)',vr:"LT",name:"X-RayTubeIdentificationLabel",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  LAB",13)':{tag:'(0009,"SIEMENS CM VA0  LAB",13)',vr:"LT",name:"DetectorIdentificationLabel",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  LAB",14)':{tag:'(0009,"SIEMENS CM VA0  LAB",14)',vr:"LT",name:"DASIdentificationLabel",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  LAB",15)':{tag:'(0009,"SIEMENS CM VA0  LAB",15)',vr:"LT",name:"SMIIdentificationLabel",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  LAB",16)':{tag:'(0009,"SIEMENS CM VA0  LAB",16)',vr:"LT",name:"CPUIdentificationLabel",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CM VA0  LAB",20)':{tag:'(0009,"SIEMENS CM VA0  LAB",20)',vr:"LT",name:"HeaderVersion",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CSA HEADER",08)':{tag:'(0029,"SIEMENS CSA HEADER",08)',vr:"CS",name:"CSAImageHeaderType",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CSA HEADER",09)':{tag:'(0029,"SIEMENS CSA HEADER",09)',vr:"LO",name:"CSAImageHeaderVersion",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CSA HEADER",10)':{tag:'(0029,"SIEMENS CSA HEADER",10)',vr:"OB",name:"CSAImageHeaderInfo",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CSA HEADER",18)':{tag:'(0029,"SIEMENS CSA HEADER",18)',vr:"CS",name:"CSASeriesHeaderType",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CSA HEADER",19)':{tag:'(0029,"SIEMENS CSA HEADER",19)',vr:"LO",name:"CSASeriesHeaderVersion",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CSA HEADER",20)':{tag:'(0029,"SIEMENS CSA HEADER",20)',vr:"OB",name:"CSASeriesHeaderInfo",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CSA NON-IMAGE",08)':{tag:'(0029,"SIEMENS CSA NON-IMAGE",08)',vr:"CS",name:"CSADataType",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CSA NON-IMAGE",09)':{tag:'(0029,"SIEMENS CSA NON-IMAGE",09)',vr:"LO",name:"CSADataVersion",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS CSA NON-IMAGE",10)':{tag:'(0029,"SIEMENS CSA NON-IMAGE",10)',vr:"OB",name:"CSADataInfo",vm:"1",version:"PrivateTag"},'(7FE1,"SIEMENS CSA NON-IMAGE",10)':{tag:'(7FE1,"SIEMENS CSA NON-IMAGE",10)',vr:"OB",name:"CSAData",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",10)':{tag:'(0019,"SIEMENS CT VA0  COAD",10)',vr:"DS",name:"DistanceSourceToSourceSideCollimator",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",11)':{tag:'(0019,"SIEMENS CT VA0  COAD",11)',vr:"DS",name:"DistanceSourceToDetectorSideCollimator",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",20)':{tag:'(0019,"SIEMENS CT VA0  COAD",20)',vr:"IS",name:"NumberOfPossibleChannels",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",21)':{tag:'(0019,"SIEMENS CT VA0  COAD",21)',vr:"IS",name:"MeanChannelNumber",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",22)':{tag:'(0019,"SIEMENS CT VA0  COAD",22)',vr:"DS",name:"DetectorSpacing",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",23)':{tag:'(0019,"SIEMENS CT VA0  COAD",23)',vr:"DS",name:"DetectorCenter",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",24)':{tag:'(0019,"SIEMENS CT VA0  COAD",24)',vr:"DS",name:"ReadingIntegrationTime",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",50)':{tag:'(0019,"SIEMENS CT VA0  COAD",50)',vr:"DS",name:"DetectorAlignment",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",52)':{tag:'(0019,"SIEMENS CT VA0  COAD",52)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",54)':{tag:'(0019,"SIEMENS CT VA0  COAD",54)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",60)':{tag:'(0019,"SIEMENS CT VA0  COAD",60)',vr:"DS",name:"FocusAlignment",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",65)':{tag:'(0019,"SIEMENS CT VA0  COAD",65)',vr:"UL",name:"FocalSpotDeflectionAmplitude",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",66)':{tag:'(0019,"SIEMENS CT VA0  COAD",66)',vr:"UL",name:"FocalSpotDeflectionPhase",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",67)':{tag:'(0019,"SIEMENS CT VA0  COAD",67)',vr:"UL",name:"FocalSpotDeflectionOffset",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",70)':{tag:'(0019,"SIEMENS CT VA0  COAD",70)',vr:"DS",name:"WaterScalingFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",71)':{tag:'(0019,"SIEMENS CT VA0  COAD",71)',vr:"DS",name:"InterpolationFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",80)':{tag:'(0019,"SIEMENS CT VA0  COAD",80)',vr:"LT",name:"PatientRegion",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",82)':{tag:'(0019,"SIEMENS CT VA0  COAD",82)',vr:"LT",name:"PatientPhaseOfLife",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",90)':{tag:'(0019,"SIEMENS CT VA0  COAD",90)',vr:"DS",name:"OsteoOffset",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",92)':{tag:'(0019,"SIEMENS CT VA0  COAD",92)',vr:"DS",name:"OsteoRegressionLineSlope",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",93)':{tag:'(0019,"SIEMENS CT VA0  COAD",93)',vr:"DS",name:"OsteoRegressionLineIntercept",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",94)':{tag:'(0019,"SIEMENS CT VA0  COAD",94)',vr:"DS",name:"OsteoStandardizationCode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",96)':{tag:'(0019,"SIEMENS CT VA0  COAD",96)',vr:"IS",name:"OsteoPhantomNumber",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",A3)':{tag:'(0019,"SIEMENS CT VA0  COAD",A3)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",A4)':{tag:'(0019,"SIEMENS CT VA0  COAD",A4)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",A5)':{tag:'(0019,"SIEMENS CT VA0  COAD",A5)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",A6)':{tag:'(0019,"SIEMENS CT VA0  COAD",A6)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",A7)':{tag:'(0019,"SIEMENS CT VA0  COAD",A7)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",A8)':{tag:'(0019,"SIEMENS CT VA0  COAD",A8)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",A9)':{tag:'(0019,"SIEMENS CT VA0  COAD",A9)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",AA)':{tag:'(0019,"SIEMENS CT VA0  COAD",AA)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",AB)':{tag:'(0019,"SIEMENS CT VA0  COAD",AB)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",AC)':{tag:'(0019,"SIEMENS CT VA0  COAD",AC)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",AD)':{tag:'(0019,"SIEMENS CT VA0  COAD",AD)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",AE)':{tag:'(0019,"SIEMENS CT VA0  COAD",AE)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",AF)':{tag:'(0019,"SIEMENS CT VA0  COAD",AF)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",B0)':{tag:'(0019,"SIEMENS CT VA0  COAD",B0)',vr:"DS",name:"FeedPerRotation",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",BD)':{tag:'(0019,"SIEMENS CT VA0  COAD",BD)',vr:"IS",name:"PulmoTriggerLevel",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",BE)':{tag:'(0019,"SIEMENS CT VA0  COAD",BE)',vr:"DS",name:"ExpiratoricReserveVolume",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",BF)':{tag:'(0019,"SIEMENS CT VA0  COAD",BF)',vr:"DS",name:"VitalCapacity",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",C0)':{tag:'(0019,"SIEMENS CT VA0  COAD",C0)',vr:"DS",name:"PulmoWater",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",C1)':{tag:'(0019,"SIEMENS CT VA0  COAD",C1)',vr:"DS",name:"PulmoAir",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",C2)':{tag:'(0019,"SIEMENS CT VA0  COAD",C2)',vr:"DA",name:"PulmoDate",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  COAD",C3)':{tag:'(0019,"SIEMENS CT VA0  COAD",C3)',vr:"TM",name:"PulmoTime",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",10)':{tag:'(0019,"SIEMENS CT VA0  GEN",10)',vr:"DS",name:"SourceSideCollimatorAperture",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",11)':{tag:'(0019,"SIEMENS CT VA0  GEN",11)',vr:"DS",name:"DetectorSideCollimatorAperture",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",20)':{tag:'(0019,"SIEMENS CT VA0  GEN",20)',vr:"DS",name:"ExposureTime",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",21)':{tag:'(0019,"SIEMENS CT VA0  GEN",21)',vr:"DS",name:"ExposureCurrent",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",25)':{tag:'(0019,"SIEMENS CT VA0  GEN",25)',vr:"DS",name:"KVPGeneratorPowerCurrent",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",26)':{tag:'(0019,"SIEMENS CT VA0  GEN",26)',vr:"DS",name:"GeneratorVoltage",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",40)':{tag:'(0019,"SIEMENS CT VA0  GEN",40)',vr:"UL",name:"MasterControlMask",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",42)':{tag:'(0019,"SIEMENS CT VA0  GEN",42)',vr:"US",name:"ProcessingMask",vm:"5",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",44)':{tag:'(0019,"SIEMENS CT VA0  GEN",44)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",45)':{tag:'(0019,"SIEMENS CT VA0  GEN",45)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",62)':{tag:'(0019,"SIEMENS CT VA0  GEN",62)',vr:"IS",name:"NumberOfVirtuellChannels",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",70)':{tag:'(0019,"SIEMENS CT VA0  GEN",70)',vr:"IS",name:"NumberOfReadings",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",71)':{tag:'(0019,"SIEMENS CT VA0  GEN",71)',vr:"LT",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",74)':{tag:'(0019,"SIEMENS CT VA0  GEN",74)',vr:"IS",name:"NumberOfProjections",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",75)':{tag:'(0019,"SIEMENS CT VA0  GEN",75)',vr:"IS",name:"NumberOfBytes",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",80)':{tag:'(0019,"SIEMENS CT VA0  GEN",80)',vr:"LT",name:"ReconstructionAlgorithmSet",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",81)':{tag:'(0019,"SIEMENS CT VA0  GEN",81)',vr:"LT",name:"ReconstructionAlgorithmIndex",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",82)':{tag:'(0019,"SIEMENS CT VA0  GEN",82)',vr:"LT",name:"RegenerationSoftwareVersion",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS CT VA0  GEN",88)':{tag:'(0019,"SIEMENS CT VA0  GEN",88)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",10)':{tag:'(0021,"SIEMENS CT VA0  GEN",10)',vr:"IS",name:"RotationAngle",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",11)':{tag:'(0021,"SIEMENS CT VA0  GEN",11)',vr:"IS",name:"StartAngle",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",20)':{tag:'(0021,"SIEMENS CT VA0  GEN",20)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",30)':{tag:'(0021,"SIEMENS CT VA0  GEN",30)',vr:"IS",name:"TopogramTubePosition",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",32)':{tag:'(0021,"SIEMENS CT VA0  GEN",32)',vr:"DS",name:"LengthOfTopogram",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",34)':{tag:'(0021,"SIEMENS CT VA0  GEN",34)',vr:"DS",name:"TopogramCorrectionFactor",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",36)':{tag:'(0021,"SIEMENS CT VA0  GEN",36)',vr:"DS",name:"MaximumTablePosition",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",40)':{tag:'(0021,"SIEMENS CT VA0  GEN",40)',vr:"IS",name:"TableMoveDirectionCode",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",45)':{tag:'(0021,"SIEMENS CT VA0  GEN",45)',vr:"IS",name:"VOIStartRow",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",46)':{tag:'(0021,"SIEMENS CT VA0  GEN",46)',vr:"IS",name:"VOIStopRow",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",47)':{tag:'(0021,"SIEMENS CT VA0  GEN",47)',vr:"IS",name:"VOIStartColumn",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",48)':{tag:'(0021,"SIEMENS CT VA0  GEN",48)',vr:"IS",name:"VOIStopColumn",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",49)':{tag:'(0021,"SIEMENS CT VA0  GEN",49)',vr:"IS",name:"VOIStartSlice",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",4a)':{tag:'(0021,"SIEMENS CT VA0  GEN",4a)',vr:"IS",name:"VOIStopSlice",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",50)':{tag:'(0021,"SIEMENS CT VA0  GEN",50)',vr:"IS",name:"VectorStartRow",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",51)':{tag:'(0021,"SIEMENS CT VA0  GEN",51)',vr:"IS",name:"VectorRowStep",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",52)':{tag:'(0021,"SIEMENS CT VA0  GEN",52)',vr:"IS",name:"VectorStartColumn",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",53)':{tag:'(0021,"SIEMENS CT VA0  GEN",53)',vr:"IS",name:"VectorColumnStep",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",60)':{tag:'(0021,"SIEMENS CT VA0  GEN",60)',vr:"IS",name:"RangeTypeCode",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",62)':{tag:'(0021,"SIEMENS CT VA0  GEN",62)',vr:"IS",name:"ReferenceTypeCode",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",70)':{tag:'(0021,"SIEMENS CT VA0  GEN",70)',vr:"DS",name:"ObjectOrientation",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",72)':{tag:'(0021,"SIEMENS CT VA0  GEN",72)',vr:"DS",name:"LightOrientation",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",75)':{tag:'(0021,"SIEMENS CT VA0  GEN",75)',vr:"DS",name:"LightBrightness",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",76)':{tag:'(0021,"SIEMENS CT VA0  GEN",76)',vr:"DS",name:"LightContrast",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",7a)':{tag:'(0021,"SIEMENS CT VA0  GEN",7a)',vr:"IS",name:"OverlayThreshold",vm:"2",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",7b)':{tag:'(0021,"SIEMENS CT VA0  GEN",7b)',vr:"IS",name:"SurfaceThreshold",vm:"2",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",7c)':{tag:'(0021,"SIEMENS CT VA0  GEN",7c)',vr:"IS",name:"GreyScaleThreshold",vm:"2",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",a0)':{tag:'(0021,"SIEMENS CT VA0  GEN",a0)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",a2)':{tag:'(0021,"SIEMENS CT VA0  GEN",a2)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  GEN",a7)':{tag:'(0021,"SIEMENS CT VA0  GEN",a7)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  IDE",10)':{tag:'(0009,"SIEMENS CT VA0  IDE",10)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  IDE",30)':{tag:'(0009,"SIEMENS CT VA0  IDE",30)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  IDE",31)':{tag:'(0009,"SIEMENS CT VA0  IDE",31)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  IDE",32)':{tag:'(0009,"SIEMENS CT VA0  IDE",32)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  IDE",34)':{tag:'(0009,"SIEMENS CT VA0  IDE",34)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  IDE",40)':{tag:'(0009,"SIEMENS CT VA0  IDE",40)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  IDE",42)':{tag:'(0009,"SIEMENS CT VA0  IDE",42)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  IDE",50)':{tag:'(0009,"SIEMENS CT VA0  IDE",50)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  IDE",51)':{tag:'(0009,"SIEMENS CT VA0  IDE",51)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  ORI",20)':{tag:'(0009,"SIEMENS CT VA0  ORI",20)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS CT VA0  ORI",30)':{tag:'(0009,"SIEMENS CT VA0  ORI",30)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(6021,"SIEMENS CT VA0  OST",00)':{tag:'(6021,"SIEMENS CT VA0  OST",00)',vr:"LT",name:"OsteoContourComment",vm:"1",version:"PrivateTag"},'(6021,"SIEMENS CT VA0  OST",10)':{tag:'(6021,"SIEMENS CT VA0  OST",10)',vr:"US",name:"OsteoContourBuffer",vm:"256",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  RAW",10)':{tag:'(0021,"SIEMENS CT VA0  RAW",10)',vr:"UL",name:"CreationMask",vm:"2",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  RAW",20)':{tag:'(0021,"SIEMENS CT VA0  RAW",20)',vr:"UL",name:"EvaluationMask",vm:"2",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  RAW",30)':{tag:'(0021,"SIEMENS CT VA0  RAW",30)',vr:"US",name:"ExtendedProcessingMask",vm:"7",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  RAW",40)':{tag:'(0021,"SIEMENS CT VA0  RAW",40)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  RAW",41)':{tag:'(0021,"SIEMENS CT VA0  RAW",41)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  RAW",42)':{tag:'(0021,"SIEMENS CT VA0  RAW",42)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  RAW",43)':{tag:'(0021,"SIEMENS CT VA0  RAW",43)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  RAW",44)':{tag:'(0021,"SIEMENS CT VA0  RAW",44)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"SIEMENS CT VA0  RAW",50)':{tag:'(0021,"SIEMENS CT VA0  RAW",50)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS DICOM",10)':{tag:'(0009,"SIEMENS DICOM",10)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS DICOM",12)':{tag:'(0009,"SIEMENS DICOM",12)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",10)':{tag:'(0019,"SIEMENS DLR.01",10)',vr:"LT",name:"MeasurementMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",11)':{tag:'(0019,"SIEMENS DLR.01",11)',vr:"LT",name:"ImageType",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",15)':{tag:'(0019,"SIEMENS DLR.01",15)',vr:"LT",name:"SoftwareVersion",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",20)':{tag:'(0019,"SIEMENS DLR.01",20)',vr:"LT",name:"MPMCode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",21)':{tag:'(0019,"SIEMENS DLR.01",21)',vr:"LT",name:"Latitude",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",22)':{tag:'(0019,"SIEMENS DLR.01",22)',vr:"LT",name:"Sensitivity",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",23)':{tag:'(0019,"SIEMENS DLR.01",23)',vr:"LT",name:"EDR",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",24)':{tag:'(0019,"SIEMENS DLR.01",24)',vr:"LT",name:"LFix",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",25)':{tag:'(0019,"SIEMENS DLR.01",25)',vr:"LT",name:"SFix",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",26)':{tag:'(0019,"SIEMENS DLR.01",26)',vr:"LT",name:"PresetMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",27)':{tag:'(0019,"SIEMENS DLR.01",27)',vr:"LT",name:"Region",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",28)':{tag:'(0019,"SIEMENS DLR.01",28)',vr:"LT",name:"Subregion",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",30)':{tag:'(0019,"SIEMENS DLR.01",30)',vr:"LT",name:"Orientation",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",31)':{tag:'(0019,"SIEMENS DLR.01",31)',vr:"LT",name:"MarkOnFilm",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",32)':{tag:'(0019,"SIEMENS DLR.01",32)',vr:"LT",name:"RotationOnDRC",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",40)':{tag:'(0019,"SIEMENS DLR.01",40)',vr:"LT",name:"ReaderType",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",41)':{tag:'(0019,"SIEMENS DLR.01",41)',vr:"LT",name:"SubModality",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",42)':{tag:'(0019,"SIEMENS DLR.01",42)',vr:"LT",name:"ReaderSerialNumber",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",50)':{tag:'(0019,"SIEMENS DLR.01",50)',vr:"LT",name:"CassetteScale",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",51)':{tag:'(0019,"SIEMENS DLR.01",51)',vr:"LT",name:"CassetteMatrix",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",52)':{tag:'(0019,"SIEMENS DLR.01",52)',vr:"LT",name:"CassetteSubmatrix",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",53)':{tag:'(0019,"SIEMENS DLR.01",53)',vr:"LT",name:"Barcode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",60)':{tag:'(0019,"SIEMENS DLR.01",60)',vr:"LT",name:"ContrastType",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",61)':{tag:'(0019,"SIEMENS DLR.01",61)',vr:"LT",name:"RotationAmount",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",62)':{tag:'(0019,"SIEMENS DLR.01",62)',vr:"LT",name:"RotationCenter",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",63)':{tag:'(0019,"SIEMENS DLR.01",63)',vr:"LT",name:"DensityShift",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",64)':{tag:'(0019,"SIEMENS DLR.01",64)',vr:"US",name:"FrequencyRank",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",65)':{tag:'(0019,"SIEMENS DLR.01",65)',vr:"LT",name:"FrequencyEnhancement",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",66)':{tag:'(0019,"SIEMENS DLR.01",66)',vr:"LT",name:"FrequencyType",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",67)':{tag:'(0019,"SIEMENS DLR.01",67)',vr:"LT",name:"KernelLength",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",68)':{tag:'(0019,"SIEMENS DLR.01",68)',vr:"UL",name:"KernelMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",69)':{tag:'(0019,"SIEMENS DLR.01",69)',vr:"UL",name:"ConvolutionMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",70)':{tag:'(0019,"SIEMENS DLR.01",70)',vr:"LT",name:"PLASource",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",71)':{tag:'(0019,"SIEMENS DLR.01",71)',vr:"LT",name:"PLADestination",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",75)':{tag:'(0019,"SIEMENS DLR.01",75)',vr:"LT",name:"UIDOriginalImage",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",76)':{tag:'(0019,"SIEMENS DLR.01",76)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",80)':{tag:'(0019,"SIEMENS DLR.01",80)',vr:"LT",name:"ReaderHeader",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",90)':{tag:'(0019,"SIEMENS DLR.01",90)',vr:"LT",name:"PLAOfSecondaryDestination",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",a0)':{tag:'(0019,"SIEMENS DLR.01",a0)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS DLR.01",a1)':{tag:'(0019,"SIEMENS DLR.01",a1)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0041,"SIEMENS DLR.01",10)':{tag:'(0041,"SIEMENS DLR.01",10)',vr:"US",name:"NumberOfHardcopies",vm:"1",version:"PrivateTag"},'(0041,"SIEMENS DLR.01",20)':{tag:'(0041,"SIEMENS DLR.01",20)',vr:"LT",name:"FilmFormat",vm:"1",version:"PrivateTag"},'(0041,"SIEMENS DLR.01",30)':{tag:'(0041,"SIEMENS DLR.01",30)',vr:"LT",name:"FilmSize",vm:"1",version:"PrivateTag"},'(0041,"SIEMENS DLR.01",31)':{tag:'(0041,"SIEMENS DLR.01",31)',vr:"LT",name:"FullFilmFormat",vm:"1",version:"PrivateTag"},'(0003,"SIEMENS ISI",08)':{tag:'(0003,"SIEMENS ISI",08)',vr:"US",name:"ISICommandField",vm:"1",version:"PrivateTag"},'(0003,"SIEMENS ISI",11)':{tag:'(0003,"SIEMENS ISI",11)',vr:"US",name:"AttachIDApplicationCode",vm:"1",version:"PrivateTag"},'(0003,"SIEMENS ISI",12)':{tag:'(0003,"SIEMENS ISI",12)',vr:"UL",name:"AttachIDMessageCount",vm:"1",version:"PrivateTag"},'(0003,"SIEMENS ISI",13)':{tag:'(0003,"SIEMENS ISI",13)',vr:"DA",name:"AttachIDDate",vm:"1",version:"PrivateTag"},'(0003,"SIEMENS ISI",14)':{tag:'(0003,"SIEMENS ISI",14)',vr:"TM",name:"AttachIDTime",vm:"1",version:"PrivateTag"},'(0003,"SIEMENS ISI",20)':{tag:'(0003,"SIEMENS ISI",20)',vr:"US",name:"MessageType",vm:"1",version:"PrivateTag"},'(0003,"SIEMENS ISI",30)':{tag:'(0003,"SIEMENS ISI",30)',vr:"DA",name:"MaxWaitingDate",vm:"1",version:"PrivateTag"},'(0003,"SIEMENS ISI",31)':{tag:'(0003,"SIEMENS ISI",31)',vr:"TM",name:"MaxWaitingTime",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS ISI",01)':{tag:'(0009,"SIEMENS ISI",01)',vr:"UN",name:"RISPatientInfoIMGEF",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",03)':{tag:'(0011,"SIEMENS ISI",03)',vr:"LT",name:"PatientUID",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",04)':{tag:'(0011,"SIEMENS ISI",04)',vr:"LT",name:"PatientID",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",0a)':{tag:'(0011,"SIEMENS ISI",0a)',vr:"LT",name:"CaseID",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",22)':{tag:'(0011,"SIEMENS ISI",22)',vr:"LT",name:"RequestID",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",23)':{tag:'(0011,"SIEMENS ISI",23)',vr:"LT",name:"ExaminationUID",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",a1)':{tag:'(0011,"SIEMENS ISI",a1)',vr:"DA",name:"PatientRegistrationDate",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",a2)':{tag:'(0011,"SIEMENS ISI",a2)',vr:"TM",name:"PatientRegistrationTime",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",b0)':{tag:'(0011,"SIEMENS ISI",b0)',vr:"LT",name:"PatientLastName",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",b2)':{tag:'(0011,"SIEMENS ISI",b2)',vr:"LT",name:"PatientFirstName",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",b4)':{tag:'(0011,"SIEMENS ISI",b4)',vr:"LT",name:"PatientHospitalStatus",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",bc)':{tag:'(0011,"SIEMENS ISI",bc)',vr:"TM",name:"CurrentLocationTime",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",c0)':{tag:'(0011,"SIEMENS ISI",c0)',vr:"LT",name:"PatientInsuranceStatus",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",d0)':{tag:'(0011,"SIEMENS ISI",d0)',vr:"LT",name:"PatientBillingType",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS ISI",d2)':{tag:'(0011,"SIEMENS ISI",d2)',vr:"LT",name:"PatientBillingAddress",vm:"1",version:"PrivateTag"},'(0031,"SIEMENS ISI",12)':{tag:'(0031,"SIEMENS ISI",12)',vr:"LT",name:"ExaminationReason",vm:"1",version:"PrivateTag"},'(0031,"SIEMENS ISI",30)':{tag:'(0031,"SIEMENS ISI",30)',vr:"DA",name:"RequestedDate",vm:"1",version:"PrivateTag"},'(0031,"SIEMENS ISI",32)':{tag:'(0031,"SIEMENS ISI",32)',vr:"TM",name:"WorklistRequestStartTime",vm:"1",version:"PrivateTag"},'(0031,"SIEMENS ISI",33)':{tag:'(0031,"SIEMENS ISI",33)',vr:"TM",name:"WorklistRequestEndTime",vm:"1",version:"PrivateTag"},'(0031,"SIEMENS ISI",4a)':{tag:'(0031,"SIEMENS ISI",4a)',vr:"TM",name:"RequestedTime",vm:"1",version:"PrivateTag"},'(0031,"SIEMENS ISI",80)':{tag:'(0031,"SIEMENS ISI",80)',vr:"LT",name:"RequestedLocation",vm:"1",version:"PrivateTag"},'(0055,"SIEMENS ISI",46)':{tag:'(0055,"SIEMENS ISI",46)',vr:"LT",name:"CurrentWard",vm:"1",version:"PrivateTag"},'(0193,"SIEMENS ISI",02)':{tag:'(0193,"SIEMENS ISI",02)',vr:"DS",name:"RISKey",vm:"1",version:"PrivateTag"},'(0307,"SIEMENS ISI",01)':{tag:'(0307,"SIEMENS ISI",01)',vr:"UN",name:"RISWorklistIMGEF",vm:"1",version:"PrivateTag"},'(0309,"SIEMENS ISI",01)':{tag:'(0309,"SIEMENS ISI",01)',vr:"UN",name:"RISReportIMGEF",vm:"1",version:"PrivateTag"},'(4009,"SIEMENS ISI",01)':{tag:'(4009,"SIEMENS ISI",01)',vr:"LT",name:"ReportID",vm:"1",version:"PrivateTag"},'(4009,"SIEMENS ISI",20)':{tag:'(4009,"SIEMENS ISI",20)',vr:"LT",name:"ReportStatus",vm:"1",version:"PrivateTag"},'(4009,"SIEMENS ISI",30)':{tag:'(4009,"SIEMENS ISI",30)',vr:"DA",name:"ReportCreationDate",vm:"1",version:"PrivateTag"},'(4009,"SIEMENS ISI",70)':{tag:'(4009,"SIEMENS ISI",70)',vr:"LT",name:"ReportApprovingPhysician",vm:"1",version:"PrivateTag"},'(4009,"SIEMENS ISI",e0)':{tag:'(4009,"SIEMENS ISI",e0)',vr:"LT",name:"ReportText",vm:"1",version:"PrivateTag"},'(4009,"SIEMENS ISI",e1)':{tag:'(4009,"SIEMENS ISI",e1)',vr:"LT",name:"ReportAuthor",vm:"1",version:"PrivateTag"},'(4009,"SIEMENS ISI",e3)':{tag:'(4009,"SIEMENS ISI",e3)',vr:"LT",name:"ReportingRadiologist",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",04)':{tag:'(0029,"SIEMENS MED DISPLAY",04)',vr:"LT",name:"PhotometricInterpretation",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",10)':{tag:'(0029,"SIEMENS MED DISPLAY",10)',vr:"US",name:"RowsOfSubmatrix",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",11)':{tag:'(0029,"SIEMENS MED DISPLAY",11)',vr:"US",name:"ColumnsOfSubmatrix",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",20)':{tag:'(0029,"SIEMENS MED DISPLAY",20)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",21)':{tag:'(0029,"SIEMENS MED DISPLAY",21)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",50)':{tag:'(0029,"SIEMENS MED DISPLAY",50)',vr:"US",name:"OriginOfSubmatrix",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",99)':{tag:'(0029,"SIEMENS MED DISPLAY",99)',vr:"LT",name:"ShutterType",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",a0)':{tag:'(0029,"SIEMENS MED DISPLAY",a0)',vr:"US",name:"RowsOfRectangularShutter",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",a1)':{tag:'(0029,"SIEMENS MED DISPLAY",a1)',vr:"US",name:"ColumnsOfRectangularShutter",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",a2)':{tag:'(0029,"SIEMENS MED DISPLAY",a2)',vr:"US",name:"OriginOfRectangularShutter",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",b0)':{tag:'(0029,"SIEMENS MED DISPLAY",b0)',vr:"US",name:"RadiusOfCircularShutter",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",b2)':{tag:'(0029,"SIEMENS MED DISPLAY",b2)',vr:"US",name:"OriginOfCircularShutter",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED DISPLAY",c1)':{tag:'(0029,"SIEMENS MED DISPLAY",c1)',vr:"US",name:"ContourOfIrregularShutter",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED HG",10)':{tag:'(0029,"SIEMENS MED HG",10)',vr:"US",name:"ListOfGroupNumbers",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED HG",15)':{tag:'(0029,"SIEMENS MED HG",15)',vr:"LT",name:"ListOfShadowOwnerCodes",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED HG",20)':{tag:'(0029,"SIEMENS MED HG",20)',vr:"US",name:"ListOfElementNumbers",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED HG",30)':{tag:'(0029,"SIEMENS MED HG",30)',vr:"US",name:"ListOfTotalDisplayLength",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED HG",40)':{tag:'(0029,"SIEMENS MED HG",40)',vr:"LT",name:"ListOfDisplayPrefix",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED HG",50)':{tag:'(0029,"SIEMENS MED HG",50)',vr:"LT",name:"ListOfDisplayPostfix",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED HG",60)':{tag:'(0029,"SIEMENS MED HG",60)',vr:"US",name:"ListOfTextPosition",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED HG",70)':{tag:'(0029,"SIEMENS MED HG",70)',vr:"LT",name:"ListOfTextConcatenation",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED MG",10)':{tag:'(0029,"SIEMENS MED MG",10)',vr:"US",name:"ListOfGroupNumbers",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED MG",15)':{tag:'(0029,"SIEMENS MED MG",15)',vr:"LT",name:"ListOfShadowOwnerCodes",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED MG",20)':{tag:'(0029,"SIEMENS MED MG",20)',vr:"US",name:"ListOfElementNumbers",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED MG",30)':{tag:'(0029,"SIEMENS MED MG",30)',vr:"US",name:"ListOfTotalDisplayLength",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED MG",40)':{tag:'(0029,"SIEMENS MED MG",40)',vr:"LT",name:"ListOfDisplayPrefix",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED MG",50)':{tag:'(0029,"SIEMENS MED MG",50)',vr:"LT",name:"ListOfDisplayPostfix",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED MG",60)':{tag:'(0029,"SIEMENS MED MG",60)',vr:"US",name:"ListOfTextPosition",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MED MG",70)':{tag:'(0029,"SIEMENS MED MG",70)',vr:"LT",name:"ListOfTextConcatenation",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS MED",10)':{tag:'(0009,"SIEMENS MED",10)',vr:"LO",name:"RecognitionCode",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS MED",30)':{tag:'(0009,"SIEMENS MED",30)',vr:"UL",name:"ByteOffsetOfOriginalHeader",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS MED",31)':{tag:'(0009,"SIEMENS MED",31)',vr:"UL",name:"LengthOfOriginalHeader",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS MED",40)':{tag:'(0009,"SIEMENS MED",40)',vr:"UL",name:"ByteOffsetOfPixelmatrix",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS MED",41)':{tag:'(0009,"SIEMENS MED",41)',vr:"UL",name:"LengthOfPixelmatrixInBytes",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS MED",50)':{tag:'(0009,"SIEMENS MED",50)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS MED",51)':{tag:'(0009,"SIEMENS MED",51)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS MED",f5)':{tag:'(0009,"SIEMENS MED",f5)',vr:"LT",name:"PDMEFIDPlaceholder",vm:"1",version:"PrivateTag"},'(0009,"SIEMENS MED",f6)':{tag:'(0009,"SIEMENS MED",f6)',vr:"LT",name:"PDMDataObjectTypeExtension",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MED",10)':{tag:'(0021,"SIEMENS MED",10)',vr:"DS",name:"Zoom",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MED",11)':{tag:'(0021,"SIEMENS MED",11)',vr:"DS",name:"Target",vm:"2",version:"PrivateTag"},'(0021,"SIEMENS MED",12)':{tag:'(0021,"SIEMENS MED",12)',vr:"IS",name:"TubeAngle",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MED",20)':{tag:'(0021,"SIEMENS MED",20)',vr:"US",name:"ROIMask",vm:"1",version:"PrivateTag"},'(7001,"SIEMENS MED",10)':{tag:'(7001,"SIEMENS MED",10)',vr:"LT",name:"Dummy",vm:"1",version:"PrivateTag"},'(7003,"SIEMENS MED",10)':{tag:'(7003,"SIEMENS MED",10)',vr:"LT",name:"Header",vm:"1",version:"PrivateTag"},'(7005,"SIEMENS MED",10)':{tag:'(7005,"SIEMENS MED",10)',vr:"LT",name:"Dummy",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",08)':{tag:'(0029,"SIEMENS MEDCOM HEADER",08)',vr:"CS",name:"MedComHeaderType",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",09)':{tag:'(0029,"SIEMENS MEDCOM HEADER",09)',vr:"LO",name:"MedComHeaderVersion",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",10)':{tag:'(0029,"SIEMENS MEDCOM HEADER",10)',vr:"OB",name:"MedComHeaderInfo",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",20)':{tag:'(0029,"SIEMENS MEDCOM HEADER",20)',vr:"OB",name:"MedComHistoryInformation",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",31)':{tag:'(0029,"SIEMENS MEDCOM HEADER",31)',vr:"LO",name:"PMTFInformation1",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",32)':{tag:'(0029,"SIEMENS MEDCOM HEADER",32)',vr:"UL",name:"PMTFInformation2",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",33)':{tag:'(0029,"SIEMENS MEDCOM HEADER",33)',vr:"UL",name:"PMTFInformation3",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",34)':{tag:'(0029,"SIEMENS MEDCOM HEADER",34)',vr:"CS",name:"PMTFInformation4",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",35)':{tag:'(0029,"SIEMENS MEDCOM HEADER",35)',vr:"UL",name:"PMTFInformation5",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",40)':{tag:'(0029,"SIEMENS MEDCOM HEADER",40)',vr:"SQ",name:"ApplicationHeaderSequence",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",41)':{tag:'(0029,"SIEMENS MEDCOM HEADER",41)',vr:"CS",name:"ApplicationHeaderType",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",42)':{tag:'(0029,"SIEMENS MEDCOM HEADER",42)',vr:"LO",name:"ApplicationHeaderID",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",43)':{tag:'(0029,"SIEMENS MEDCOM HEADER",43)',vr:"LO",name:"ApplicationHeaderVersion",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",44)':{tag:'(0029,"SIEMENS MEDCOM HEADER",44)',vr:"OB",name:"ApplicationHeaderInfo",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",50)':{tag:'(0029,"SIEMENS MEDCOM HEADER",50)',vr:"LO",name:"WorkflowControlFlags",vm:"8",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",51)':{tag:'(0029,"SIEMENS MEDCOM HEADER",51)',vr:"CS",name:"ArchiveManagementFlagKeepOnline",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",52)':{tag:'(0029,"SIEMENS MEDCOM HEADER",52)',vr:"CS",name:"ArchiveManagementFlagDoNotArchive",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",53)':{tag:'(0029,"SIEMENS MEDCOM HEADER",53)',vr:"CS",name:"ImageLocationStatus",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",54)':{tag:'(0029,"SIEMENS MEDCOM HEADER",54)',vr:"DS",name:"EstimatedRetrieveTime",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",55)':{tag:'(0029,"SIEMENS MEDCOM HEADER",55)',vr:"DS",name:"DataSizeOfRetrievedImages",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",70)':{tag:'(0029,"SIEMENS MEDCOM HEADER",70)',vr:"SQ",name:"SiemensLinkSequence",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",71)':{tag:'(0029,"SIEMENS MEDCOM HEADER",71)',vr:"AT",name:"ReferencedTag",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",72)':{tag:'(0029,"SIEMENS MEDCOM HEADER",72)',vr:"CS",name:"ReferencedTagType",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",73)':{tag:'(0029,"SIEMENS MEDCOM HEADER",73)',vr:"UL",name:"ReferencedValueLength",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",74)':{tag:'(0029,"SIEMENS MEDCOM HEADER",74)',vr:"CS",name:"ReferencedObjectDeviceType",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",75)':{tag:'(0029,"SIEMENS MEDCOM HEADER",75)',vr:"OB",name:"ReferencedObjectDeviceLocation",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER",76)':{tag:'(0029,"SIEMENS MEDCOM HEADER",76)',vr:"OB",name:"ReferencedObjectDeviceID",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM HEADER2",60)':{tag:'(0029,"SIEMENS MEDCOM HEADER2",60)',vr:"LO",name:"SeriesWorkflowStatus",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM OOG",08)':{tag:'(0029,"SIEMENS MEDCOM OOG",08)',vr:"CS",name:"MEDCOMOOGType",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM OOG",09)':{tag:'(0029,"SIEMENS MEDCOM OOG",09)',vr:"LO",name:"MEDCOMOOGVersion",vm:"1",version:"PrivateTag"},'(0029,"SIEMENS MEDCOM OOG",10)':{tag:'(0029,"SIEMENS MEDCOM OOG",10)',vr:"OB",name:"MEDCOMOOGInfo",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",12)':{tag:'(0019,"SIEMENS MR VA0  COAD",12)',vr:"DS",name:"MagneticFieldStrength",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",14)':{tag:'(0019,"SIEMENS MR VA0  COAD",14)',vr:"DS",name:"ADCVoltage",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",16)':{tag:'(0019,"SIEMENS MR VA0  COAD",16)',vr:"DS",name:"ADCOffset",vm:"2",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",20)':{tag:'(0019,"SIEMENS MR VA0  COAD",20)',vr:"DS",name:"TransmitterAmplitude",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",21)':{tag:'(0019,"SIEMENS MR VA0  COAD",21)',vr:"IS",name:"NumberOfTransmitterAmplitudes",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",22)':{tag:'(0019,"SIEMENS MR VA0  COAD",22)',vr:"DS",name:"TransmitterAttenuator",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",24)':{tag:'(0019,"SIEMENS MR VA0  COAD",24)',vr:"DS",name:"TransmitterCalibration",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",26)':{tag:'(0019,"SIEMENS MR VA0  COAD",26)',vr:"DS",name:"TransmitterReference",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",50)':{tag:'(0019,"SIEMENS MR VA0  COAD",50)',vr:"DS",name:"ReceiverTotalGain",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",51)':{tag:'(0019,"SIEMENS MR VA0  COAD",51)',vr:"DS",name:"ReceiverAmplifierGain",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",52)':{tag:'(0019,"SIEMENS MR VA0  COAD",52)',vr:"DS",name:"ReceiverPreamplifierGain",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",54)':{tag:'(0019,"SIEMENS MR VA0  COAD",54)',vr:"DS",name:"ReceiverCableAttenuation",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",55)':{tag:'(0019,"SIEMENS MR VA0  COAD",55)',vr:"DS",name:"ReceiverReferenceGain",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",56)':{tag:'(0019,"SIEMENS MR VA0  COAD",56)',vr:"DS",name:"ReceiverFilterFrequency",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",60)':{tag:'(0019,"SIEMENS MR VA0  COAD",60)',vr:"DS",name:"ReconstructionScaleFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",62)':{tag:'(0019,"SIEMENS MR VA0  COAD",62)',vr:"DS",name:"ReferenceScaleFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",70)':{tag:'(0019,"SIEMENS MR VA0  COAD",70)',vr:"DS",name:"PhaseGradientAmplitude",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",71)':{tag:'(0019,"SIEMENS MR VA0  COAD",71)',vr:"DS",name:"ReadoutGradientAmplitude",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",72)':{tag:'(0019,"SIEMENS MR VA0  COAD",72)',vr:"DS",name:"SelectionGradientAmplitude",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",80)':{tag:'(0019,"SIEMENS MR VA0  COAD",80)',vr:"DS",name:"GradientDelayTime",vm:"3",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",82)':{tag:'(0019,"SIEMENS MR VA0  COAD",82)',vr:"DS",name:"TotalGradientDelayTime",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",90)':{tag:'(0019,"SIEMENS MR VA0  COAD",90)',vr:"LT",name:"SensitivityCorrectionLabel",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",91)':{tag:'(0019,"SIEMENS MR VA0  COAD",91)',vr:"DS",name:"SaturationPhaseEncodingVectorCoronalComponent",vm:"6",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",92)':{tag:'(0019,"SIEMENS MR VA0  COAD",92)',vr:"DS",name:"SaturationReadoutVectorCoronalComponent",vm:"6",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",a0)':{tag:'(0019,"SIEMENS MR VA0  COAD",a0)',vr:"US",name:"RFWatchdogMask",vm:"3",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",a1)':{tag:'(0019,"SIEMENS MR VA0  COAD",a1)',vr:"DS",name:"EPIReconstructionSlope",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",a2)':{tag:'(0019,"SIEMENS MR VA0  COAD",a2)',vr:"DS",name:"RFPowerErrorIndicator",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",a5)':{tag:'(0019,"SIEMENS MR VA0  COAD",a5)',vr:"DS",name:"SpecificAbsorptionRateWholeBody",vm:"3",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",a6)':{tag:'(0019,"SIEMENS MR VA0  COAD",a6)',vr:"DS",name:"SpecificEnergyDose",vm:"3",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",b0)':{tag:'(0019,"SIEMENS MR VA0  COAD",b0)',vr:"UL",name:"AdjustmentStatusMask",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",c1)':{tag:'(0019,"SIEMENS MR VA0  COAD",c1)',vr:"DS",name:"EPICapacity",vm:"6",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",c2)':{tag:'(0019,"SIEMENS MR VA0  COAD",c2)',vr:"DS",name:"EPIInductance",vm:"3",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",c3)':{tag:'(0019,"SIEMENS MR VA0  COAD",c3)',vr:"IS",name:"EPISwitchConfigurationCode",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",c4)':{tag:'(0019,"SIEMENS MR VA0  COAD",c4)',vr:"IS",name:"EPISwitchHardwareCode",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",c5)':{tag:'(0019,"SIEMENS MR VA0  COAD",c5)',vr:"DS",name:"EPISwitchDelayTime",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",d1)':{tag:'(0019,"SIEMENS MR VA0  COAD",d1)',vr:"DS",name:"FlowSensitivity",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",d2)':{tag:'(0019,"SIEMENS MR VA0  COAD",d2)',vr:"LT",name:"CalculationSubmode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",d3)':{tag:'(0019,"SIEMENS MR VA0  COAD",d3)',vr:"DS",name:"FieldOfViewRatio",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",d4)':{tag:'(0019,"SIEMENS MR VA0  COAD",d4)',vr:"IS",name:"BaseRawMatrixSize",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",d5)':{tag:'(0019,"SIEMENS MR VA0  COAD",d5)',vr:"IS",name:"2DOversamplingLines",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",d6)':{tag:'(0019,"SIEMENS MR VA0  COAD",d6)',vr:"IS",name:"3DPhaseOversamplingPartitions",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",d7)':{tag:'(0019,"SIEMENS MR VA0  COAD",d7)',vr:"IS",name:"EchoLinePosition",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",d8)':{tag:'(0019,"SIEMENS MR VA0  COAD",d8)',vr:"IS",name:"EchoColumnPosition",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",d9)':{tag:'(0019,"SIEMENS MR VA0  COAD",d9)',vr:"IS",name:"LinesPerSegment",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  COAD",da)':{tag:'(0019,"SIEMENS MR VA0  COAD",da)',vr:"LT",name:"PhaseCodingDirection",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",10)':{tag:'(0019,"SIEMENS MR VA0  GEN",10)',vr:"DS",name:"TotalMeasurementTimeNominal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",11)':{tag:'(0019,"SIEMENS MR VA0  GEN",11)',vr:"DS",name:"TotalMeasurementTimeCurrent",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",12)':{tag:'(0019,"SIEMENS MR VA0  GEN",12)',vr:"DS",name:"StartDelayTime",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",13)':{tag:'(0019,"SIEMENS MR VA0  GEN",13)',vr:"DS",name:"DwellTime",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",14)':{tag:'(0019,"SIEMENS MR VA0  GEN",14)',vr:"IS",name:"NumberOfPhases",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",16)':{tag:'(0019,"SIEMENS MR VA0  GEN",16)',vr:"UL",name:"SequenceControlMask",vm:"2",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",18)':{tag:'(0019,"SIEMENS MR VA0  GEN",18)',vr:"UL",name:"MeasurementStatusMask",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",20)':{tag:'(0019,"SIEMENS MR VA0  GEN",20)',vr:"IS",name:"NumberOfFourierLinesNominal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",21)':{tag:'(0019,"SIEMENS MR VA0  GEN",21)',vr:"IS",name:"NumberOfFourierLinesCurrent",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",26)':{tag:'(0019,"SIEMENS MR VA0  GEN",26)',vr:"IS",name:"NumberOfFourierLinesAfterZero",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",28)':{tag:'(0019,"SIEMENS MR VA0  GEN",28)',vr:"IS",name:"FirstMeasuredFourierLine",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",30)':{tag:'(0019,"SIEMENS MR VA0  GEN",30)',vr:"IS",name:"AcquisitionColumns",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",31)':{tag:'(0019,"SIEMENS MR VA0  GEN",31)',vr:"IS",name:"ReconstructionColumns",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",40)':{tag:'(0019,"SIEMENS MR VA0  GEN",40)',vr:"IS",name:"ArrayCoilElementNumber",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",41)':{tag:'(0019,"SIEMENS MR VA0  GEN",41)',vr:"UL",name:"ArrayCoilElementSelectMask",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",42)':{tag:'(0019,"SIEMENS MR VA0  GEN",42)',vr:"UL",name:"ArrayCoilElementDataMask",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",43)':{tag:'(0019,"SIEMENS MR VA0  GEN",43)',vr:"IS",name:"ArrayCoilElementToADCConnect",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",44)':{tag:'(0019,"SIEMENS MR VA0  GEN",44)',vr:"DS",name:"ArrayCoilElementNoiseLevel",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",45)':{tag:'(0019,"SIEMENS MR VA0  GEN",45)',vr:"IS",name:"ArrayCoilADCPairNumber",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",46)':{tag:'(0019,"SIEMENS MR VA0  GEN",46)',vr:"UL",name:"ArrayCoilCombinationMask",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",50)':{tag:'(0019,"SIEMENS MR VA0  GEN",50)',vr:"IS",name:"NumberOfAverages",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",60)':{tag:'(0019,"SIEMENS MR VA0  GEN",60)',vr:"DS",name:"FlipAngle",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",70)':{tag:'(0019,"SIEMENS MR VA0  GEN",70)',vr:"IS",name:"NumberOfPrescans",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",81)':{tag:'(0019,"SIEMENS MR VA0  GEN",81)',vr:"LT",name:"FilterTypeForRawData",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",82)':{tag:'(0019,"SIEMENS MR VA0  GEN",82)',vr:"DS",name:"FilterParameterForRawData",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",83)':{tag:'(0019,"SIEMENS MR VA0  GEN",83)',vr:"LT",name:"FilterTypeForImageData",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",84)':{tag:'(0019,"SIEMENS MR VA0  GEN",84)',vr:"DS",name:"FilterParameterForImageData",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",85)':{tag:'(0019,"SIEMENS MR VA0  GEN",85)',vr:"LT",name:"FilterTypeForPhaseCorrection",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",86)':{tag:'(0019,"SIEMENS MR VA0  GEN",86)',vr:"DS",name:"FilterParameterForPhaseCorrection",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",87)':{tag:'(0019,"SIEMENS MR VA0  GEN",87)',vr:"LT",name:"NormalizationFilterTypeForImageData",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",88)':{tag:'(0019,"SIEMENS MR VA0  GEN",88)',vr:"DS",name:"NormalizationFilterParameterForImageData",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",90)':{tag:'(0019,"SIEMENS MR VA0  GEN",90)',vr:"IS",name:"NumberOfSaturationRegions",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",91)':{tag:'(0019,"SIEMENS MR VA0  GEN",91)',vr:"DS",name:"SaturationPhaseEncodingVectorSagittalComponent",vm:"6",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",92)':{tag:'(0019,"SIEMENS MR VA0  GEN",92)',vr:"DS",name:"SaturationReadoutVectorSagittalComponent",vm:"6",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",93)':{tag:'(0019,"SIEMENS MR VA0  GEN",93)',vr:"DS",name:"EPIStimulationMonitorMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",94)':{tag:'(0019,"SIEMENS MR VA0  GEN",94)',vr:"DS",name:"ImageRotationAngle",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",96)':{tag:'(0019,"SIEMENS MR VA0  GEN",96)',vr:"UL",name:"CoilIDMask",vm:"3",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",97)':{tag:'(0019,"SIEMENS MR VA0  GEN",97)',vr:"UL",name:"CoilClassMask",vm:"2",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",98)':{tag:'(0019,"SIEMENS MR VA0  GEN",98)',vr:"DS",name:"CoilPosition",vm:"3",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",a0)':{tag:'(0019,"SIEMENS MR VA0  GEN",a0)',vr:"DS",name:"EPIReconstructionPhase",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS MR VA0  GEN",a1)':{tag:'(0019,"SIEMENS MR VA0  GEN",a1)',vr:"DS",name:"EPIReconstructionSlope",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",20)':{tag:'(0021,"SIEMENS MR VA0  GEN",20)',vr:"IS",name:"PhaseCorrectionRowsSequence",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",21)':{tag:'(0021,"SIEMENS MR VA0  GEN",21)',vr:"IS",name:"PhaseCorrectionColumnsSequence",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",22)':{tag:'(0021,"SIEMENS MR VA0  GEN",22)',vr:"IS",name:"PhaseCorrectionRowsReconstruction",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",24)':{tag:'(0021,"SIEMENS MR VA0  GEN",24)',vr:"IS",name:"PhaseCorrectionColumnsReconstruction",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",30)':{tag:'(0021,"SIEMENS MR VA0  GEN",30)',vr:"IS",name:"NumberOf3DRawPartitionsNominal",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",31)':{tag:'(0021,"SIEMENS MR VA0  GEN",31)',vr:"IS",name:"NumberOf3DRawPartitionsCurrent",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",34)':{tag:'(0021,"SIEMENS MR VA0  GEN",34)',vr:"IS",name:"NumberOf3DImagePartitions",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",36)':{tag:'(0021,"SIEMENS MR VA0  GEN",36)',vr:"IS",name:"Actual3DImagePartitionNumber",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",39)':{tag:'(0021,"SIEMENS MR VA0  GEN",39)',vr:"DS",name:"SlabThickness",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",40)':{tag:'(0021,"SIEMENS MR VA0  GEN",40)',vr:"IS",name:"NumberOfSlicesNominal",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",41)':{tag:'(0021,"SIEMENS MR VA0  GEN",41)',vr:"IS",name:"NumberOfSlicesCurrent",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",42)':{tag:'(0021,"SIEMENS MR VA0  GEN",42)',vr:"IS",name:"CurrentSliceNumber",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",43)':{tag:'(0021,"SIEMENS MR VA0  GEN",43)',vr:"IS",name:"CurrentGroupNumber",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",44)':{tag:'(0021,"SIEMENS MR VA0  GEN",44)',vr:"DS",name:"CurrentSliceDistanceFactor",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",45)':{tag:'(0021,"SIEMENS MR VA0  GEN",45)',vr:"IS",name:"MIPStartRow",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",46)':{tag:'(0021,"SIEMENS MR VA0  GEN",46)',vr:"IS",name:"MIPStopRow",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",47)':{tag:'(0021,"SIEMENS MR VA0  GEN",47)',vr:"IS",name:"MIPStartColumn",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",48)':{tag:'(0021,"SIEMENS MR VA0  GEN",48)',vr:"IS",name:"MIPStartColumn",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",49)':{tag:'(0021,"SIEMENS MR VA0  GEN",49)',vr:"IS",name:"MIPStartSlice Name=",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",4a)':{tag:'(0021,"SIEMENS MR VA0  GEN",4a)',vr:"IS",name:"MIPStartSlice",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",4f)':{tag:'(0021,"SIEMENS MR VA0  GEN",4f)',vr:"LT",name:"OrderofSlices",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",50)':{tag:'(0021,"SIEMENS MR VA0  GEN",50)',vr:"US",name:"SignalMask",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",52)':{tag:'(0021,"SIEMENS MR VA0  GEN",52)',vr:"DS",name:"DelayAfterTrigger",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",53)':{tag:'(0021,"SIEMENS MR VA0  GEN",53)',vr:"IS",name:"RRInterval",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",54)':{tag:'(0021,"SIEMENS MR VA0  GEN",54)',vr:"DS",name:"NumberOfTriggerPulses",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",56)':{tag:'(0021,"SIEMENS MR VA0  GEN",56)',vr:"DS",name:"RepetitionTimeEffective",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",57)':{tag:'(0021,"SIEMENS MR VA0  GEN",57)',vr:"LT",name:"GatePhase",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",58)':{tag:'(0021,"SIEMENS MR VA0  GEN",58)',vr:"DS",name:"GateThreshold",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",59)':{tag:'(0021,"SIEMENS MR VA0  GEN",59)',vr:"DS",name:"GatedRatio",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",60)':{tag:'(0021,"SIEMENS MR VA0  GEN",60)',vr:"IS",name:"NumberOfInterpolatedImages",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",70)':{tag:'(0021,"SIEMENS MR VA0  GEN",70)',vr:"IS",name:"NumberOfEchoes",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",72)':{tag:'(0021,"SIEMENS MR VA0  GEN",72)',vr:"DS",name:"SecondEchoTime",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",73)':{tag:'(0021,"SIEMENS MR VA0  GEN",73)',vr:"DS",name:"SecondRepetitionTime",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",80)':{tag:'(0021,"SIEMENS MR VA0  GEN",80)',vr:"IS",name:"CardiacCode",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",91)':{tag:'(0021,"SIEMENS MR VA0  GEN",91)',vr:"DS",name:"SaturationPhaseEncodingVectorTransverseComponent",vm:"6",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",92)':{tag:'(0021,"SIEMENS MR VA0  GEN",92)',vr:"DS",name:"SaturationReadoutVectorTransverseComponent",vm:"6",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",93)':{tag:'(0021,"SIEMENS MR VA0  GEN",93)',vr:"DS",name:"EPIChangeValueOfMagnitude",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",94)':{tag:'(0021,"SIEMENS MR VA0  GEN",94)',vr:"DS",name:"EPIChangeValueOfXComponent",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",95)':{tag:'(0021,"SIEMENS MR VA0  GEN",95)',vr:"DS",name:"EPIChangeValueOfYComponent",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  GEN",96)':{tag:'(0021,"SIEMENS MR VA0  GEN",96)',vr:"DS",name:"EPIChangeValueOfZComponent",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",00)':{tag:'(0021,"SIEMENS MR VA0  RAW",00)',vr:"LT",name:"SequenceType",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",01)':{tag:'(0021,"SIEMENS MR VA0  RAW",01)',vr:"IS",name:"VectorSizeOriginal",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",02)':{tag:'(0021,"SIEMENS MR VA0  RAW",02)',vr:"IS",name:"VectorSizeExtended",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",03)':{tag:'(0021,"SIEMENS MR VA0  RAW",03)',vr:"DS",name:"AcquiredSpectralRange",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",04)':{tag:'(0021,"SIEMENS MR VA0  RAW",04)',vr:"DS",name:"VOIPosition",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",05)':{tag:'(0021,"SIEMENS MR VA0  RAW",05)',vr:"DS",name:"VOISize",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",06)':{tag:'(0021,"SIEMENS MR VA0  RAW",06)',vr:"IS",name:"CSIMatrixSizeOriginal",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",07)':{tag:'(0021,"SIEMENS MR VA0  RAW",07)',vr:"IS",name:"CSIMatrixSizeExtended",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",08)':{tag:'(0021,"SIEMENS MR VA0  RAW",08)',vr:"DS",name:"SpatialGridShift",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",09)':{tag:'(0021,"SIEMENS MR VA0  RAW",09)',vr:"DS",name:"SignalLimitsMinimum",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",10)':{tag:'(0021,"SIEMENS MR VA0  RAW",10)',vr:"DS",name:"SignalLimitsMaximum",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",11)':{tag:'(0021,"SIEMENS MR VA0  RAW",11)',vr:"DS",name:"SpecInfoMask",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",12)':{tag:'(0021,"SIEMENS MR VA0  RAW",12)',vr:"DS",name:"EPITimeRateOfChangeOfMagnitude",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",13)':{tag:'(0021,"SIEMENS MR VA0  RAW",13)',vr:"DS",name:"EPITimeRateOfChangeOfXComponent",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",14)':{tag:'(0021,"SIEMENS MR VA0  RAW",14)',vr:"DS",name:"EPITimeRateOfChangeOfYComponent",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",15)':{tag:'(0021,"SIEMENS MR VA0  RAW",15)',vr:"DS",name:"EPITimeRateOfChangeOfZComponent",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",16)':{tag:'(0021,"SIEMENS MR VA0  RAW",16)',vr:"DS",name:"EPITimeRateOfChangeLegalLimit1",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",17)':{tag:'(0021,"SIEMENS MR VA0  RAW",17)',vr:"DS",name:"EPIOperationModeFlag",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",18)':{tag:'(0021,"SIEMENS MR VA0  RAW",18)',vr:"DS",name:"EPIFieldCalculationSafetyFactor",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",19)':{tag:'(0021,"SIEMENS MR VA0  RAW",19)',vr:"DS",name:"EPILegalLimit1OfChangeValue",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",20)':{tag:'(0021,"SIEMENS MR VA0  RAW",20)',vr:"DS",name:"EPILegalLimit2OfChangeValue",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",21)':{tag:'(0021,"SIEMENS MR VA0  RAW",21)',vr:"DS",name:"EPIRiseTime",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",30)':{tag:'(0021,"SIEMENS MR VA0  RAW",30)',vr:"DS",name:"ArrayCoilADCOffset",vm:"16",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",31)':{tag:'(0021,"SIEMENS MR VA0  RAW",31)',vr:"DS",name:"ArrayCoilPreamplifierGain",vm:"16",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",50)':{tag:'(0021,"SIEMENS MR VA0  RAW",50)',vr:"LT",name:"SaturationType",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",51)':{tag:'(0021,"SIEMENS MR VA0  RAW",51)',vr:"DS",name:"SaturationNormalVector",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",52)':{tag:'(0021,"SIEMENS MR VA0  RAW",52)',vr:"DS",name:"SaturationPositionVector",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",53)':{tag:'(0021,"SIEMENS MR VA0  RAW",53)',vr:"DS",name:"SaturationThickness",vm:"6",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",54)':{tag:'(0021,"SIEMENS MR VA0  RAW",54)',vr:"DS",name:"SaturationWidth",vm:"6",version:"PrivateTag"},'(0021,"SIEMENS MR VA0  RAW",55)':{tag:'(0021,"SIEMENS MR VA0  RAW",55)',vr:"DS",name:"SaturationDistance",vm:"6",version:"PrivateTag"},'(7fe3,"SIEMENS NUMARIS II",00)':{tag:'(7fe3,"SIEMENS NUMARIS II",00)',vr:"LT",name:"ImageGraphicsFormatCode",vm:"1",version:"PrivateTag"},'(7fe3,"SIEMENS NUMARIS II",10)':{tag:'(7fe3,"SIEMENS NUMARIS II",10)',vr:"OB",name:"ImageGraphics",vm:"1",version:"PrivateTag"},'(7fe3,"SIEMENS NUMARIS II",20)':{tag:'(7fe3,"SIEMENS NUMARIS II",20)',vr:"OB",name:"ImageGraphicsDummy",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA GEN",20)':{tag:'(0011,"SIEMENS RA GEN",20)',vr:"SL",name:"FluoroTimer",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA GEN",25)':{tag:'(0011,"SIEMENS RA GEN",25)',vr:"SL",name:"PtopDoseAreaProduct",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA GEN",26)':{tag:'(0011,"SIEMENS RA GEN",26)',vr:"SL",name:"PtopTotalSkinDose",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA GEN",30)':{tag:'(0011,"SIEMENS RA GEN",30)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA GEN",35)':{tag:'(0011,"SIEMENS RA GEN",35)',vr:"LO",name:"PatientInitialPuckCounter",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA GEN",40)':{tag:'(0011,"SIEMENS RA GEN",40)',vr:"SS",name:"SPIDataObjectType",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",15)':{tag:'(0019,"SIEMENS RA GEN",15)',vr:"LO",name:"AcquiredPlane",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",1f)':{tag:'(0019,"SIEMENS RA GEN",1f)',vr:"SS",name:"DefaultTableIsoCenterHeight",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",20)':{tag:'(0019,"SIEMENS RA GEN",20)',vr:"SL",name:"SceneFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",22)':{tag:'(0019,"SIEMENS RA GEN",22)',vr:"SL",name:"RefPhotofileFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",24)':{tag:'(0019,"SIEMENS RA GEN",24)',vr:"LO",name:"SceneName",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",26)':{tag:'(0019,"SIEMENS RA GEN",26)',vr:"SS",name:"AcquisitionIndex",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",28)':{tag:'(0019,"SIEMENS RA GEN",28)',vr:"SS",name:"MixedPulseMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",2a)':{tag:'(0019,"SIEMENS RA GEN",2a)',vr:"SS",name:"NoOfPositions",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",2c)':{tag:'(0019,"SIEMENS RA GEN",2c)',vr:"SS",name:"NoOfPhases",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",2e)':{tag:'(0019,"SIEMENS RA GEN",2e)',vr:"SS",name:"FrameRateForPositions",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",30)':{tag:'(0019,"SIEMENS RA GEN",30)',vr:"SS",name:"NoOfFramesForPositions",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",32)':{tag:'(0019,"SIEMENS RA GEN",32)',vr:"SS",name:"SteppingDirection",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",34)':{tag:'(0019,"SIEMENS RA GEN",34)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",36)':{tag:'(0019,"SIEMENS RA GEN",36)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",38)':{tag:'(0019,"SIEMENS RA GEN",38)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",3a)':{tag:'(0019,"SIEMENS RA GEN",3a)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",3c)':{tag:'(0019,"SIEMENS RA GEN",3c)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",3e)':{tag:'(0019,"SIEMENS RA GEN",3e)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",40)':{tag:'(0019,"SIEMENS RA GEN",40)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",42)':{tag:'(0019,"SIEMENS RA GEN",42)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",44)':{tag:'(0019,"SIEMENS RA GEN",44)',vr:"SS",name:"ImageTransferDelay",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",46)':{tag:'(0019,"SIEMENS RA GEN",46)',vr:"SL",name:"InversFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",48)':{tag:'(0019,"SIEMENS RA GEN",48)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",4a)':{tag:'(0019,"SIEMENS RA GEN",4a)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",4c)':{tag:'(0019,"SIEMENS RA GEN",4c)',vr:"SS",name:"BlankingCircleDiameter",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",50)':{tag:'(0019,"SIEMENS RA GEN",50)',vr:"SL",name:"StandDataValid",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",52)':{tag:'(0019,"SIEMENS RA GEN",52)',vr:"SS",name:"TableTilt",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",54)':{tag:'(0019,"SIEMENS RA GEN",54)',vr:"SS",name:"TableAxisRotation",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",56)':{tag:'(0019,"SIEMENS RA GEN",56)',vr:"SS",name:"TableLongitudalPosition",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",58)':{tag:'(0019,"SIEMENS RA GEN",58)',vr:"SS",name:"TableSideOffset",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",5a)':{tag:'(0019,"SIEMENS RA GEN",5a)',vr:"SS",name:"TableIsoCenterHeight",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",5c)':{tag:'(0019,"SIEMENS RA GEN",5c)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",5e)':{tag:'(0019,"SIEMENS RA GEN",5e)',vr:"SL",name:"CollimationDataValid",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",60)':{tag:'(0019,"SIEMENS RA GEN",60)',vr:"SL",name:"PeriSequenceNo",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",62)':{tag:'(0019,"SIEMENS RA GEN",62)',vr:"SL",name:"PeriTotalScenes",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",64)':{tag:'(0019,"SIEMENS RA GEN",64)',vr:"SL",name:"PeriOverlapTop",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",66)':{tag:'(0019,"SIEMENS RA GEN",66)',vr:"SL",name:"PeriOverlapBottom",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",68)':{tag:'(0019,"SIEMENS RA GEN",68)',vr:"SL",name:"RawImageNumber",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",6a)':{tag:'(0019,"SIEMENS RA GEN",6a)',vr:"SL",name:"XRayDataValid",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",70)':{tag:'(0019,"SIEMENS RA GEN",70)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",72)':{tag:'(0019,"SIEMENS RA GEN",72)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",74)':{tag:'(0019,"SIEMENS RA GEN",74)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",76)':{tag:'(0019,"SIEMENS RA GEN",76)',vr:"SL",name:"FillingAverageFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",78)':{tag:'(0019,"SIEMENS RA GEN",78)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",7a)':{tag:'(0019,"SIEMENS RA GEN",7a)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",7c)':{tag:'(0019,"SIEMENS RA GEN",7c)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",7e)':{tag:'(0019,"SIEMENS RA GEN",7e)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",80)':{tag:'(0019,"SIEMENS RA GEN",80)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",82)':{tag:'(0019,"SIEMENS RA GEN",82)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",84)':{tag:'(0019,"SIEMENS RA GEN",84)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",86)':{tag:'(0019,"SIEMENS RA GEN",86)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",88)':{tag:'(0019,"SIEMENS RA GEN",88)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",8a)':{tag:'(0019,"SIEMENS RA GEN",8a)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",8c)':{tag:'(0019,"SIEMENS RA GEN",8c)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",8e)':{tag:'(0019,"SIEMENS RA GEN",8e)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",92)':{tag:'(0019,"SIEMENS RA GEN",92)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",94)':{tag:'(0019,"SIEMENS RA GEN",94)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",96)':{tag:'(0019,"SIEMENS RA GEN",96)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",98)':{tag:'(0019,"SIEMENS RA GEN",98)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",9a)':{tag:'(0019,"SIEMENS RA GEN",9a)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",9c)':{tag:'(0019,"SIEMENS RA GEN",9c)',vr:"SL",name:"IntensifierLevelCalibrationFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",9e)':{tag:'(0019,"SIEMENS RA GEN",9e)',vr:"SL",name:"NativeReviewFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",a2)':{tag:'(0019,"SIEMENS RA GEN",a2)',vr:"SL",name:"SceneNumber",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",a4)':{tag:'(0019,"SIEMENS RA GEN",a4)',vr:"SS",name:"AcquisitionMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",a5)':{tag:'(0019,"SIEMENS RA GEN",a5)',vr:"SS",name:"AcquisitonFrameRate",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",a6)':{tag:'(0019,"SIEMENS RA GEN",a6)',vr:"SL",name:"ECGFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",a7)':{tag:'(0019,"SIEMENS RA GEN",a7)',vr:"SL",name:"AdditionalSceneData",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",a8)':{tag:'(0019,"SIEMENS RA GEN",a8)',vr:"SL",name:"FileCopyFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",a9)':{tag:'(0019,"SIEMENS RA GEN",a9)',vr:"SL",name:"PhlebovisionFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",aa)':{tag:'(0019,"SIEMENS RA GEN",aa)',vr:"SL",name:"Co2Flag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",ab)':{tag:'(0019,"SIEMENS RA GEN",ab)',vr:"SS",name:"MaxSpeed",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",ac)':{tag:'(0019,"SIEMENS RA GEN",ac)',vr:"SS",name:"StepWidth",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",ad)':{tag:'(0019,"SIEMENS RA GEN",ad)',vr:"SL",name:"DigitalAcquisitionZoom",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA GEN",ff)':{tag:'(0019,"SIEMENS RA GEN",ff)',vr:"SS",name:"Internal",vm:"1-n",version:"PrivateTag"},'(0021,"SIEMENS RA GEN",15)':{tag:'(0021,"SIEMENS RA GEN",15)',vr:"SS",name:"ImagesInStudy",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS RA GEN",20)':{tag:'(0021,"SIEMENS RA GEN",20)',vr:"SS",name:"ScenesInStudy",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS RA GEN",25)':{tag:'(0021,"SIEMENS RA GEN",25)',vr:"SS",name:"ImagesInPhotofile",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS RA GEN",27)':{tag:'(0021,"SIEMENS RA GEN",27)',vr:"SS",name:"PlaneBImagesExist",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS RA GEN",28)':{tag:'(0021,"SIEMENS RA GEN",28)',vr:"SS",name:"NoOf2MBChunks",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS RA GEN",30)':{tag:'(0021,"SIEMENS RA GEN",30)',vr:"SS",name:"ImagesInAllScenes",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS RA GEN",40)':{tag:'(0021,"SIEMENS RA GEN",40)',vr:"SS",name:"ArchiveSWInternalVersion",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE A",28)':{tag:'(0011,"SIEMENS RA PLANE A",28)',vr:"SL",name:"FluoroTimerA",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE A",29)':{tag:'(0011,"SIEMENS RA PLANE A",29)',vr:"SL",name:"FluoroSkinDoseA",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE A",2a)':{tag:'(0011,"SIEMENS RA PLANE A",2a)',vr:"SL",name:"TotalSkinDoseA",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE A",2b)':{tag:'(0011,"SIEMENS RA PLANE A",2b)',vr:"SL",name:"FluoroDoseAreaProductA",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE A",2c)':{tag:'(0011,"SIEMENS RA PLANE A",2c)',vr:"SL",name:"TotalDoseAreaProductA",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",15)':{tag:'(0019,"SIEMENS RA PLANE A",15)',vr:"LT",name:"OfflineUID",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",18)':{tag:'(0019,"SIEMENS RA PLANE A",18)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",19)':{tag:'(0019,"SIEMENS RA PLANE A",19)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",1a)':{tag:'(0019,"SIEMENS RA PLANE A",1a)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",1b)':{tag:'(0019,"SIEMENS RA PLANE A",1b)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",1c)':{tag:'(0019,"SIEMENS RA PLANE A",1c)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",1d)':{tag:'(0019,"SIEMENS RA PLANE A",1d)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",1e)':{tag:'(0019,"SIEMENS RA PLANE A",1e)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",1f)':{tag:'(0019,"SIEMENS RA PLANE A",1f)',vr:"SS",name:"Internal",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",20)':{tag:'(0019,"SIEMENS RA PLANE A",20)',vr:"SS",name:"SystemCalibFactorPlaneA",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",22)':{tag:'(0019,"SIEMENS RA PLANE A",22)',vr:"SS",name:"XRayParameterSetNo",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",24)':{tag:'(0019,"SIEMENS RA PLANE A",24)',vr:"SS",name:"XRaySystem",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",26)':{tag:'(0019,"SIEMENS RA PLANE A",26)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",28)':{tag:'(0019,"SIEMENS RA PLANE A",28)',vr:"SS",name:"AcquiredDisplayMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",2a)':{tag:'(0019,"SIEMENS RA PLANE A",2a)',vr:"SS",name:"AcquisitionDelay",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",2c)':{tag:'(0019,"SIEMENS RA PLANE A",2c)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",2e)':{tag:'(0019,"SIEMENS RA PLANE A",2e)',vr:"SS",name:"MaxFramesLimit",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",30)':{tag:'(0019,"SIEMENS RA PLANE A",30)',vr:"US",name:"MaximumFrameSizeNIU",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",32)':{tag:'(0019,"SIEMENS RA PLANE A",32)',vr:"SS",name:"SubtractedFilterType",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",34)':{tag:'(0019,"SIEMENS RA PLANE A",34)',vr:"SS",name:"FilterFactorNative",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",36)':{tag:'(0019,"SIEMENS RA PLANE A",36)',vr:"SS",name:"AnatomicBackgroundFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",38)':{tag:'(0019,"SIEMENS RA PLANE A",38)',vr:"SS",name:"WindowUpperLimitNative",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",3a)':{tag:'(0019,"SIEMENS RA PLANE A",3a)',vr:"SS",name:"WindowLowerLimitNative",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",3c)':{tag:'(0019,"SIEMENS RA PLANE A",3c)',vr:"SS",name:"WindowBrightnessPhase1",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",3e)':{tag:'(0019,"SIEMENS RA PLANE A",3e)',vr:"SS",name:"WindowBrightnessPhase2",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",40)':{tag:'(0019,"SIEMENS RA PLANE A",40)',vr:"SS",name:"WindowContrastPhase1",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",42)':{tag:'(0019,"SIEMENS RA PLANE A",42)',vr:"SS",name:"WindowContrastPhase2",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",44)':{tag:'(0019,"SIEMENS RA PLANE A",44)',vr:"SS",name:"FilterFactorSub",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",46)':{tag:'(0019,"SIEMENS RA PLANE A",46)',vr:"SS",name:"PeakOpacified",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",48)':{tag:'(0019,"SIEMENS RA PLANE A",48)',vr:"SL",name:"MaskFrame",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",4a)':{tag:'(0019,"SIEMENS RA PLANE A",4a)',vr:"SL",name:"BIHFrame",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",4c)':{tag:'(0019,"SIEMENS RA PLANE A",4c)',vr:"SS",name:"CentBeamAngulationCaudCran",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",4e)':{tag:'(0019,"SIEMENS RA PLANE A",4e)',vr:"SS",name:"CentBeamAngulationLRAnterior",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",50)':{tag:'(0019,"SIEMENS RA PLANE A",50)',vr:"SS",name:"LongitudinalPosition",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",52)':{tag:'(0019,"SIEMENS RA PLANE A",52)',vr:"SS",name:"SideOffset",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",54)':{tag:'(0019,"SIEMENS RA PLANE A",54)',vr:"SS",name:"IsoCenterHeight",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",56)':{tag:'(0019,"SIEMENS RA PLANE A",56)',vr:"SS",name:"ImageTwist",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",58)':{tag:'(0019,"SIEMENS RA PLANE A",58)',vr:"SS",name:"SourceImageDistance",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",5a)':{tag:'(0019,"SIEMENS RA PLANE A",5a)',vr:"SS",name:"MechanicalMagnificationFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",5c)':{tag:'(0019,"SIEMENS RA PLANE A",5c)',vr:"SL",name:"CalibrationFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",5e)':{tag:'(0019,"SIEMENS RA PLANE A",5e)',vr:"SL",name:"CalibrationAngleCranCaud",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",60)':{tag:'(0019,"SIEMENS RA PLANE A",60)',vr:"SL",name:"CalibrationAngleRAOLAO",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",62)':{tag:'(0019,"SIEMENS RA PLANE A",62)',vr:"SL",name:"CalibrationTableToFloorDist",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",64)':{tag:'(0019,"SIEMENS RA PLANE A",64)',vr:"SL",name:"CalibrationIsocenterToFloorDist",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",66)':{tag:'(0019,"SIEMENS RA PLANE A",66)',vr:"SL",name:"CalibrationIsocenterToSourceDist",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",68)':{tag:'(0019,"SIEMENS RA PLANE A",68)',vr:"SL",name:"CalibrationSourceToII",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",6a)':{tag:'(0019,"SIEMENS RA PLANE A",6a)',vr:"SL",name:"CalibrationIIZoom",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",6c)':{tag:'(0019,"SIEMENS RA PLANE A",6c)',vr:"SL",name:"CalibrationIIField",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",6e)':{tag:'(0019,"SIEMENS RA PLANE A",6e)',vr:"SL",name:"CalibrationFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",70)':{tag:'(0019,"SIEMENS RA PLANE A",70)',vr:"SL",name:"CalibrationObjectToImageDistance",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",72)':{tag:'(0019,"SIEMENS RA PLANE A",72)',vr:"SL",name:"CalibrationSystemFactor",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",74)':{tag:'(0019,"SIEMENS RA PLANE A",74)',vr:"SL",name:"CalibrationSystemCorrection",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",76)':{tag:'(0019,"SIEMENS RA PLANE A",76)',vr:"SL",name:"CalibrationSystemIIFormats",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",78)':{tag:'(0019,"SIEMENS RA PLANE A",78)',vr:"SL",name:"CalibrationGantryDataValid",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",7a)':{tag:'(0019,"SIEMENS RA PLANE A",7a)',vr:"SS",name:"CollimatorSquareBreadth",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",7c)':{tag:'(0019,"SIEMENS RA PLANE A",7c)',vr:"SS",name:"CollimatorSquareHeight",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",7e)':{tag:'(0019,"SIEMENS RA PLANE A",7e)',vr:"SS",name:"CollimatorSquareDiameter",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",80)':{tag:'(0019,"SIEMENS RA PLANE A",80)',vr:"SS",name:"CollimaterFingerTurnAngle",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",82)':{tag:'(0019,"SIEMENS RA PLANE A",82)',vr:"SS",name:"CollimaterFingerPosition",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",84)':{tag:'(0019,"SIEMENS RA PLANE A",84)',vr:"SS",name:"CollimaterDiaphragmTurnAngle",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",86)':{tag:'(0019,"SIEMENS RA PLANE A",86)',vr:"SS",name:"CollimaterDiaphragmPosition1",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",88)':{tag:'(0019,"SIEMENS RA PLANE A",88)',vr:"SS",name:"CollimaterDiaphragmPosition2",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",8a)':{tag:'(0019,"SIEMENS RA PLANE A",8a)',vr:"SS",name:"CollimaterDiaphragmMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",8c)':{tag:'(0019,"SIEMENS RA PLANE A",8c)',vr:"SS",name:"CollimaterBeamLimitBreadth",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",8e)':{tag:'(0019,"SIEMENS RA PLANE A",8e)',vr:"SS",name:"CollimaterBeamLimitHeight",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",90)':{tag:'(0019,"SIEMENS RA PLANE A",90)',vr:"SS",name:"CollimaterBeamLimitDiameter",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",92)':{tag:'(0019,"SIEMENS RA PLANE A",92)',vr:"SS",name:"X-RayControlMOde",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",94)':{tag:'(0019,"SIEMENS RA PLANE A",94)',vr:"SS",name:"X-RaySystem",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",96)':{tag:'(0019,"SIEMENS RA PLANE A",96)',vr:"SS",name:"FocalSpot",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",98)':{tag:'(0019,"SIEMENS RA PLANE A",98)',vr:"SS",name:"ExposureControl",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",9a)':{tag:'(0019,"SIEMENS RA PLANE A",9a)',vr:"SL",name:"XRayVoltage",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",9c)':{tag:'(0019,"SIEMENS RA PLANE A",9c)',vr:"SL",name:"XRayCurrent",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",9e)':{tag:'(0019,"SIEMENS RA PLANE A",9e)',vr:"SL",name:"XRayCurrentTimeProduct",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",a0)':{tag:'(0019,"SIEMENS RA PLANE A",a0)',vr:"SL",name:"XRayPulseTime",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",a2)':{tag:'(0019,"SIEMENS RA PLANE A",a2)',vr:"SL",name:"XRaySceneTimeFluoroClock",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",a4)':{tag:'(0019,"SIEMENS RA PLANE A",a4)',vr:"SS",name:"MaximumPulseRate",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",a6)':{tag:'(0019,"SIEMENS RA PLANE A",a6)',vr:"SS",name:"PulsesPerScene",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",a8)':{tag:'(0019,"SIEMENS RA PLANE A",a8)',vr:"SL",name:"DoseAreaProductOfScene",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",aa)':{tag:'(0019,"SIEMENS RA PLANE A",aa)',vr:"SS",name:"Dose",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",ac)':{tag:'(0019,"SIEMENS RA PLANE A",ac)',vr:"SS",name:"DoseRate",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",ae)':{tag:'(0019,"SIEMENS RA PLANE A",ae)',vr:"SL",name:"IIToCoverDistance",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b0)':{tag:'(0019,"SIEMENS RA PLANE A",b0)',vr:"SS",name:"LastFramePhase1",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b1)':{tag:'(0019,"SIEMENS RA PLANE A",b1)',vr:"SS",name:"FrameRatePhase1",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b2)':{tag:'(0019,"SIEMENS RA PLANE A",b2)',vr:"SS",name:"LastFramePhase2",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b3)':{tag:'(0019,"SIEMENS RA PLANE A",b3)',vr:"SS",name:"FrameRatePhase2",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b4)':{tag:'(0019,"SIEMENS RA PLANE A",b4)',vr:"SS",name:"LastFramePhase3",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b5)':{tag:'(0019,"SIEMENS RA PLANE A",b5)',vr:"SS",name:"FrameRatePhase3",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b6)':{tag:'(0019,"SIEMENS RA PLANE A",b6)',vr:"SS",name:"LastFramePhase4",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b7)':{tag:'(0019,"SIEMENS RA PLANE A",b7)',vr:"SS",name:"FrameRatePhase4",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b8)':{tag:'(0019,"SIEMENS RA PLANE A",b8)',vr:"SS",name:"GammaOfNativeImage",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",b9)':{tag:'(0019,"SIEMENS RA PLANE A",b9)',vr:"SS",name:"GammaOfTVSystem",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",bb)':{tag:'(0019,"SIEMENS RA PLANE A",bb)',vr:"SL",name:"PixelshiftX",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",bc)':{tag:'(0019,"SIEMENS RA PLANE A",bc)',vr:"SL",name:"PixelshiftY",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",bd)':{tag:'(0019,"SIEMENS RA PLANE A",bd)',vr:"SL",name:"MaskAverageFactor",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",be)':{tag:'(0019,"SIEMENS RA PLANE A",be)',vr:"SL",name:"BlankingCircleFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",bf)':{tag:'(0019,"SIEMENS RA PLANE A",bf)',vr:"SL",name:"CircleRowStart",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c0)':{tag:'(0019,"SIEMENS RA PLANE A",c0)',vr:"SL",name:"CircleRowEnd",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c1)':{tag:'(0019,"SIEMENS RA PLANE A",c1)',vr:"SL",name:"CircleColumnStart",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c2)':{tag:'(0019,"SIEMENS RA PLANE A",c2)',vr:"SL",name:"CircleColumnEnd",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c3)':{tag:'(0019,"SIEMENS RA PLANE A",c3)',vr:"SL",name:"CircleDiameter",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c4)':{tag:'(0019,"SIEMENS RA PLANE A",c4)',vr:"SL",name:"RectangularCollimaterFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c5)':{tag:'(0019,"SIEMENS RA PLANE A",c5)',vr:"SL",name:"RectangleRowStart",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c6)':{tag:'(0019,"SIEMENS RA PLANE A",c6)',vr:"SL",name:"RectangleRowEnd",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c7)':{tag:'(0019,"SIEMENS RA PLANE A",c7)',vr:"SL",name:"RectangleColumnStart",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c8)':{tag:'(0019,"SIEMENS RA PLANE A",c8)',vr:"SL",name:"RectangleColumnEnd",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",c9)':{tag:'(0019,"SIEMENS RA PLANE A",c9)',vr:"SL",name:"RectangleAngulation",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",ca)':{tag:'(0019,"SIEMENS RA PLANE A",ca)',vr:"SL",name:"IrisCollimatorFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",cb)':{tag:'(0019,"SIEMENS RA PLANE A",cb)',vr:"SL",name:"IrisRowStart",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",cc)':{tag:'(0019,"SIEMENS RA PLANE A",cc)',vr:"SL",name:"IrisRowEnd",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",cd)':{tag:'(0019,"SIEMENS RA PLANE A",cd)',vr:"SL",name:"IrisColumnStart",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",ce)':{tag:'(0019,"SIEMENS RA PLANE A",ce)',vr:"SL",name:"IrisColumnEnd",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",cf)':{tag:'(0019,"SIEMENS RA PLANE A",cf)',vr:"SL",name:"IrisAngulation",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",d1)':{tag:'(0019,"SIEMENS RA PLANE A",d1)',vr:"SS",name:"NumberOfFramesPlane",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",d2)':{tag:'(0019,"SIEMENS RA PLANE A",d2)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",d3)':{tag:'(0019,"SIEMENS RA PLANE A",d3)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",d4)':{tag:'(0019,"SIEMENS RA PLANE A",d4)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",d5)':{tag:'(0019,"SIEMENS RA PLANE A",d5)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",d6)':{tag:'(0019,"SIEMENS RA PLANE A",d6)',vr:"SS",name:"Internal",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",d7)':{tag:'(0019,"SIEMENS RA PLANE A",d7)',vr:"SS",name:"Internal",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",d8)':{tag:'(0019,"SIEMENS RA PLANE A",d8)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",d9)':{tag:'(0019,"SIEMENS RA PLANE A",d9)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",da)':{tag:'(0019,"SIEMENS RA PLANE A",da)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",db)':{tag:'(0019,"SIEMENS RA PLANE A",db)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",dc)':{tag:'(0019,"SIEMENS RA PLANE A",dc)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",dd)':{tag:'(0019,"SIEMENS RA PLANE A",dd)',vr:"SL",name:"AnatomicBackground",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",de)':{tag:'(0019,"SIEMENS RA PLANE A",de)',vr:"SL",name:"AutoWindowBase",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",df)':{tag:'(0019,"SIEMENS RA PLANE A",df)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE A",e0)':{tag:'(0019,"SIEMENS RA PLANE A",e0)',vr:"SL",name:"Internal",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE B",28)':{tag:'(0011,"SIEMENS RA PLANE B",28)',vr:"SL",name:"FluoroTimerB",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE B",29)':{tag:'(0011,"SIEMENS RA PLANE B",29)',vr:"SL",name:"FluoroSkinDoseB",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE B",2a)':{tag:'(0011,"SIEMENS RA PLANE B",2a)',vr:"SL",name:"TotalSkinDoseB",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE B",2b)':{tag:'(0011,"SIEMENS RA PLANE B",2b)',vr:"SL",name:"FluoroDoseAreaProductB",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RA PLANE B",2c)':{tag:'(0011,"SIEMENS RA PLANE B",2c)',vr:"SL",name:"TotalDoseAreaProductB",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",18)':{tag:'(0019,"SIEMENS RA PLANE B",18)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",19)':{tag:'(0019,"SIEMENS RA PLANE B",19)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",1a)':{tag:'(0019,"SIEMENS RA PLANE B",1a)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",1b)':{tag:'(0019,"SIEMENS RA PLANE B",1b)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",1c)':{tag:'(0019,"SIEMENS RA PLANE B",1c)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",1d)':{tag:'(0019,"SIEMENS RA PLANE B",1d)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",1e)':{tag:'(0019,"SIEMENS RA PLANE B",1e)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",1f)':{tag:'(0019,"SIEMENS RA PLANE B",1f)',vr:"SS",name:"Internal",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",20)':{tag:'(0019,"SIEMENS RA PLANE B",20)',vr:"SL",name:"SystemCalibFactorPlaneB",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",22)':{tag:'(0019,"SIEMENS RA PLANE B",22)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",24)':{tag:'(0019,"SIEMENS RA PLANE B",24)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",26)':{tag:'(0019,"SIEMENS RA PLANE B",26)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",28)':{tag:'(0019,"SIEMENS RA PLANE B",28)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",2a)':{tag:'(0019,"SIEMENS RA PLANE B",2a)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",2c)':{tag:'(0019,"SIEMENS RA PLANE B",2c)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",2e)':{tag:'(0019,"SIEMENS RA PLANE B",2e)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",30)':{tag:'(0019,"SIEMENS RA PLANE B",30)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",32)':{tag:'(0019,"SIEMENS RA PLANE B",32)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",34)':{tag:'(0019,"SIEMENS RA PLANE B",34)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",36)':{tag:'(0019,"SIEMENS RA PLANE B",36)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",38)':{tag:'(0019,"SIEMENS RA PLANE B",38)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",3a)':{tag:'(0019,"SIEMENS RA PLANE B",3a)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",3c)':{tag:'(0019,"SIEMENS RA PLANE B",3c)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",3e)':{tag:'(0019,"SIEMENS RA PLANE B",3e)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",40)':{tag:'(0019,"SIEMENS RA PLANE B",40)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",42)':{tag:'(0019,"SIEMENS RA PLANE B",42)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",44)':{tag:'(0019,"SIEMENS RA PLANE B",44)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",46)':{tag:'(0019,"SIEMENS RA PLANE B",46)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",48)':{tag:'(0019,"SIEMENS RA PLANE B",48)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",4a)':{tag:'(0019,"SIEMENS RA PLANE B",4a)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",4c)':{tag:'(0019,"SIEMENS RA PLANE B",4c)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",4e)':{tag:'(0019,"SIEMENS RA PLANE B",4e)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",50)':{tag:'(0019,"SIEMENS RA PLANE B",50)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",52)':{tag:'(0019,"SIEMENS RA PLANE B",52)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",54)':{tag:'(0019,"SIEMENS RA PLANE B",54)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",56)':{tag:'(0019,"SIEMENS RA PLANE B",56)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",58)':{tag:'(0019,"SIEMENS RA PLANE B",58)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",5a)':{tag:'(0019,"SIEMENS RA PLANE B",5a)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",5c)':{tag:'(0019,"SIEMENS RA PLANE B",5c)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",5e)':{tag:'(0019,"SIEMENS RA PLANE B",5e)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",60)':{tag:'(0019,"SIEMENS RA PLANE B",60)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",62)':{tag:'(0019,"SIEMENS RA PLANE B",62)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",64)':{tag:'(0019,"SIEMENS RA PLANE B",64)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",66)':{tag:'(0019,"SIEMENS RA PLANE B",66)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",68)':{tag:'(0019,"SIEMENS RA PLANE B",68)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",6a)':{tag:'(0019,"SIEMENS RA PLANE B",6a)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",6c)':{tag:'(0019,"SIEMENS RA PLANE B",6c)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",6e)':{tag:'(0019,"SIEMENS RA PLANE B",6e)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",70)':{tag:'(0019,"SIEMENS RA PLANE B",70)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",72)':{tag:'(0019,"SIEMENS RA PLANE B",72)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",74)':{tag:'(0019,"SIEMENS RA PLANE B",74)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",76)':{tag:'(0019,"SIEMENS RA PLANE B",76)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",78)':{tag:'(0019,"SIEMENS RA PLANE B",78)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",7a)':{tag:'(0019,"SIEMENS RA PLANE B",7a)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",7c)':{tag:'(0019,"SIEMENS RA PLANE B",7c)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",7e)':{tag:'(0019,"SIEMENS RA PLANE B",7e)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",80)':{tag:'(0019,"SIEMENS RA PLANE B",80)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",82)':{tag:'(0019,"SIEMENS RA PLANE B",82)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",84)':{tag:'(0019,"SIEMENS RA PLANE B",84)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",86)':{tag:'(0019,"SIEMENS RA PLANE B",86)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",88)':{tag:'(0019,"SIEMENS RA PLANE B",88)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",8a)':{tag:'(0019,"SIEMENS RA PLANE B",8a)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",8c)':{tag:'(0019,"SIEMENS RA PLANE B",8c)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",8e)':{tag:'(0019,"SIEMENS RA PLANE B",8e)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",90)':{tag:'(0019,"SIEMENS RA PLANE B",90)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",92)':{tag:'(0019,"SIEMENS RA PLANE B",92)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",94)':{tag:'(0019,"SIEMENS RA PLANE B",94)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",96)':{tag:'(0019,"SIEMENS RA PLANE B",96)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",98)':{tag:'(0019,"SIEMENS RA PLANE B",98)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",9a)':{tag:'(0019,"SIEMENS RA PLANE B",9a)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",9c)':{tag:'(0019,"SIEMENS RA PLANE B",9c)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",9e)':{tag:'(0019,"SIEMENS RA PLANE B",9e)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",a0)':{tag:'(0019,"SIEMENS RA PLANE B",a0)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",a2)':{tag:'(0019,"SIEMENS RA PLANE B",a2)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",a4)':{tag:'(0019,"SIEMENS RA PLANE B",a4)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",a6)':{tag:'(0019,"SIEMENS RA PLANE B",a6)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",a8)':{tag:'(0019,"SIEMENS RA PLANE B",a8)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",aa)':{tag:'(0019,"SIEMENS RA PLANE B",aa)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS RA PLANE B",ac)':{tag:'(0019,"SIEMENS RA PLANE B",ac)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RIS",10)':{tag:'(0011,"SIEMENS RIS",10)',vr:"LT",name:"PatientUID",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RIS",11)':{tag:'(0011,"SIEMENS RIS",11)',vr:"LT",name:"PatientID",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RIS",20)':{tag:'(0011,"SIEMENS RIS",20)',vr:"DA",name:"PatientRegistrationDate",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RIS",21)':{tag:'(0011,"SIEMENS RIS",21)',vr:"TM",name:"PatientRegistrationTime",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RIS",30)':{tag:'(0011,"SIEMENS RIS",30)',vr:"LT",name:"PatientnameRIS",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RIS",31)':{tag:'(0011,"SIEMENS RIS",31)',vr:"LT",name:"PatientprenameRIS",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RIS",40)':{tag:'(0011,"SIEMENS RIS",40)',vr:"LT",name:"PatientHospitalStatus",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RIS",41)':{tag:'(0011,"SIEMENS RIS",41)',vr:"LT",name:"MedicalAlerts",vm:"1",version:"PrivateTag"},'(0011,"SIEMENS RIS",42)':{tag:'(0011,"SIEMENS RIS",42)',vr:"LT",name:"ContrastAllergies",vm:"1",version:"PrivateTag"},'(0031,"SIEMENS RIS",10)':{tag:'(0031,"SIEMENS RIS",10)',vr:"LT",name:"RequestUID",vm:"1",version:"PrivateTag"},'(0031,"SIEMENS RIS",45)':{tag:'(0031,"SIEMENS RIS",45)',vr:"LT",name:"RequestingPhysician",vm:"1",version:"PrivateTag"},'(0031,"SIEMENS RIS",50)':{tag:'(0031,"SIEMENS RIS",50)',vr:"LT",name:"RequestedPhysician",vm:"1",version:"PrivateTag"},'(0033,"SIEMENS RIS",10)':{tag:'(0033,"SIEMENS RIS",10)',vr:"LT",name:"PatientStudyUID",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",00)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",00)',vr:"US",name:"AcquisitionType",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",01)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",01)',vr:"US",name:"AcquisitionMode",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",02)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",02)',vr:"US",name:"FootswitchIndex",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",03)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",03)',vr:"US",name:"AcquisitionRoom",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",04)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",04)',vr:"SL",name:"CurrentTimeProduct",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",05)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",05)',vr:"SL",name:"Dose",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",06)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",06)',vr:"SL",name:"SkinDosePercent",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",07)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",07)',vr:"SL",name:"SkinDoseAccumulation",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",08)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",08)',vr:"SL",name:"SkinDoseRate",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",0A)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",0A)',vr:"UL",name:"CopperFilter",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",0B)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",0B)',vr:"US",name:"MeasuringField",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",0C)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",0C)',vr:"SS",name:"PostBlankingCircle",vm:"3",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",0D)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",0D)',vr:"SS",name:"DynaAngles",vm:"2-2n",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",0E)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",0E)',vr:"SS",name:"TotalSteps",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",0F)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",0F)',vr:"SL",name:"DynaXRayInfo",vm:"3-3n",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",10)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",10)',vr:"US",name:"ModalityLUTInputGamma",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",11)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",11)',vr:"US",name:"ModalityLUTOutputGamma",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",12)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",12)',vr:"OB",name:"SH_STPAR",vm:"1-n",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",13)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",13)',vr:"US",name:"AcquisitionZoom",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",14)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",14)',vr:"SS",name:"DynaAngulationStepWidth",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",15)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",15)',vr:"US",name:"Harmonization",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",16)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",16)',vr:"US",name:"DRSingleFlag",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",17)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",17)',vr:"SL",name:"SourceToIsocenter",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",18)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",18)',vr:"US",name:"PressureData",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",19)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",19)',vr:"SL",name:"ECGIndexArray",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",1A)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",1A)',vr:"US",name:"FDFlag",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",1B)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",1B)',vr:"OB",name:"SH_ZOOM",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",1C)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",1C)',vr:"OB",name:"SH_COLPAR",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",1D)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",1D)',vr:"US",name:"K_Factor",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",1E)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",1E)',vr:"US",name:"EVE",vm:"8",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",1F)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",1F)',vr:"SL",name:"TotalSceneTime",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",20)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",20)',vr:"US",name:"RestoreFlag",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",21)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",21)',vr:"US",name:"StandMovementFlag",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",22)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",22)',vr:"US",name:"FDRows",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",23)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",23)',vr:"US",name:"FDColumns",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",24)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",24)',vr:"US",name:"TableMovementFlag",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",25)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",25)',vr:"LO",name:"OriginalOrganProgramName",vm:"1",version:"PrivateTag"},'(0021,"SIEMENS SMS-AX  ACQ 1.0",26)':{tag:'(0021,"SIEMENS SMS-AX  ACQ 1.0",26)',vr:"DS",name:"CrispyXPIFilter",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",00)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",00)',vr:"US",name:"ViewNative",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",01)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",01)',vr:"US",name:"OriginalSeriesNumber",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",02)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",02)',vr:"US",name:"OriginalImageNumber",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",03)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",03)',vr:"US",name:"WinCenter",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",04)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",04)',vr:"US",name:"WinWidth",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",05)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",05)',vr:"US",name:"WinBrightness",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",06)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",06)',vr:"US",name:"WinContrast",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",07)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",07)',vr:"US",name:"OriginalFrameNumber",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",08)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",08)',vr:"US",name:"OriginalMaskFrameNumber",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",09)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",09)',vr:"US",name:"Opac",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0A)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0A)',vr:"US",name:"OriginalNumberOfFrames",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0B)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0B)',vr:"DS",name:"OriginalSceneDuration",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0C)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0C)',vr:"LO",name:"IdentifierLOID",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0D)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0D)',vr:"SS",name:"OriginalSceneVFRInfo",vm:"1-n",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0E)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0E)',vr:"SS",name:"OriginalFrameECGPosition",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0F)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",0F)',vr:"SS",name:"OriginalECG1stFrameOffset_retired",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",10)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",10)',vr:"SS",name:"ZoomFlag",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",11)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",11)',vr:"US",name:"Flex",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",12)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",12)',vr:"US",name:"NumberOfMaskFrames",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",13)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",13)',vr:"US",name:"NumberOfFillFrames",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",14)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",14)',vr:"US",name:"SeriesNumber",vm:"1",version:"PrivateTag"},'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",15)':{tag:'(0025,"SIEMENS SMS-AX  ORIGINAL IMAGE INFO 1.0",15)',vr:"IS",name:"ImageNumber",vm:"1",version:"PrivateTag"},'(0023,"SIEMENS SMS-AX  QUANT 1.0",00)':{tag:'(0023,"SIEMENS SMS-AX  QUANT 1.0",00)',vr:"DS",name:"HorizontalCalibrationPixelSize",vm:"2",version:"PrivateTag"},'(0023,"SIEMENS SMS-AX  QUANT 1.0",01)':{tag:'(0023,"SIEMENS SMS-AX  QUANT 1.0",01)',vr:"DS",name:"VerticalCalibrationPixelSize",vm:"2",version:"PrivateTag"},'(0023,"SIEMENS SMS-AX  QUANT 1.0",02)':{tag:'(0023,"SIEMENS SMS-AX  QUANT 1.0",02)',vr:"LO",name:"CalibrationObject",vm:"1",version:"PrivateTag"},'(0023,"SIEMENS SMS-AX  QUANT 1.0",03)':{tag:'(0023,"SIEMENS SMS-AX  QUANT 1.0",03)',vr:"DS",name:"CalibrationObjectSize",vm:"1",version:"PrivateTag"},'(0023,"SIEMENS SMS-AX  QUANT 1.0",04)':{tag:'(0023,"SIEMENS SMS-AX  QUANT 1.0",04)',vr:"LO",name:"CalibrationMethod",vm:"1",version:"PrivateTag"},'(0023,"SIEMENS SMS-AX  QUANT 1.0",05)':{tag:'(0023,"SIEMENS SMS-AX  QUANT 1.0",05)',vr:"ST",name:"Filename",vm:"1",version:"PrivateTag"},'(0023,"SIEMENS SMS-AX  QUANT 1.0",06)':{tag:'(0023,"SIEMENS SMS-AX  QUANT 1.0",06)',vr:"IS",name:"FrameNumber",vm:"1",version:"PrivateTag"},'(0023,"SIEMENS SMS-AX  QUANT 1.0",07)':{tag:'(0023,"SIEMENS SMS-AX  QUANT 1.0",07)',vr:"IS",name:"CalibrationFactorMultiplicity",vm:"2",version:"PrivateTag"},'(0023,"SIEMENS SMS-AX  QUANT 1.0",08)':{tag:'(0023,"SIEMENS SMS-AX  QUANT 1.0",08)',vr:"IS",name:"CalibrationTODValue",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",00)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",00)',vr:"US",name:"ReviewMode",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",01)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",01)',vr:"US",name:"AnatomicalBackgroundPercent",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",02)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",02)',vr:"US",name:"NumberOfPhases",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",03)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",03)',vr:"US",name:"ApplyAnatomicalBackground",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",04)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",04)',vr:"SS",name:"PixelShiftArray",vm:"4-4n",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",05)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",05)',vr:"US",name:"Brightness",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",06)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",06)',vr:"US",name:"Contrast",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",07)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",07)',vr:"US",name:"Enabled",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",08)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",08)',vr:"US",name:"NativeEdgeEnhancementPercentGain",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",09)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",09)',vr:"SS",name:"NativeEdgeEnhancementLUTIndex",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",0A)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",0A)',vr:"SS",name:"NativeEdgeEnhancementKernelSize",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",0B)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",0B)',vr:"US",name:"SubtrEdgeEnhancementPercentGain",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",0C)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",0C)',vr:"SS",name:"SubtrEdgeEnhancementLUTIndex",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",0D)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",0D)',vr:"SS",name:"SubtrEdgeEnhancementKernelSize",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",0E)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",0E)',vr:"US",name:"FadePercent",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",0F)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",0F)',vr:"US",name:"FlippedBeforeLateralityApplied",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",10)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",10)',vr:"US",name:"ApplyFade",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",12)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",12)',vr:"US",name:"Zoom",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",13)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",13)',vr:"SS",name:"PanX",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",14)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",14)',vr:"SS",name:"PanY",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",15)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",15)',vr:"SS",name:"NativeEdgeEnhancementAdvPercGain",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",16)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",16)',vr:"SS",name:"SubtrEdgeEnhancementAdvPercGain",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",17)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",17)',vr:"US",name:"InvertFlag",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",1A)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",1A)',vr:"OB",name:"Quant1KOverlay",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",1B)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",1B)',vr:"US",name:"OriginalResolution",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",1C)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",1C)',vr:"DS",name:"AutoWindowCenter",vm:"1",version:"PrivateTag"},'(0019,"SIEMENS SMS-AX  VIEW 1.0",1D)':{tag:'(0019,"SIEMENS SMS-AX  VIEW 1.0",1D)',vr:"DS",name:"AutoWindowWidth",vm:"1",version:"PrivateTag"},'(0009,"SIENET",01)':{tag:'(0009,"SIENET",01)',vr:"US",name:"SIENETCommandField",vm:"1",version:"PrivateTag"},'(0009,"SIENET",14)':{tag:'(0009,"SIENET",14)',vr:"LT",name:"ReceiverPLA",vm:"1",version:"PrivateTag"},'(0009,"SIENET",16)':{tag:'(0009,"SIENET",16)',vr:"US",name:"TransferPriority",vm:"1",version:"PrivateTag"},'(0009,"SIENET",29)':{tag:'(0009,"SIENET",29)',vr:"LT",name:"ActualUser",vm:"1",version:"PrivateTag"},'(0095,"SIENET",01)':{tag:'(0095,"SIENET",01)',vr:"LT",name:"ExaminationFolderID",vm:"1",version:"PrivateTag"},'(0095,"SIENET",04)':{tag:'(0095,"SIENET",04)',vr:"UL",name:"FolderReportedStatus",vm:"1",version:"PrivateTag"},'(0095,"SIENET",05)':{tag:'(0095,"SIENET",05)',vr:"LT",name:"FolderReportingRadiologist",vm:"1",version:"PrivateTag"},'(0095,"SIENET",07)':{tag:'(0095,"SIENET",07)',vr:"LT",name:"SIENETISAPLA",vm:"1",version:"PrivateTag"},'(0099,"SIENET",02)':{tag:'(0099,"SIENET",02)',vr:"UL",name:"DataObjectAttributes",vm:"1",version:"PrivateTag"},'(0009,"SPI RELEASE 1",10)':{tag:'(0009,"SPI RELEASE 1",10)',vr:"LT",name:"Comments",vm:"1",version:"PrivateTag"},'(0009,"SPI RELEASE 1",15)':{tag:'(0009,"SPI RELEASE 1",15)',vr:"LO",name:"SPIImageUID",vm:"1",version:"PrivateTag"},'(0009,"SPI RELEASE 1",40)':{tag:'(0009,"SPI RELEASE 1",40)',vr:"US",name:"DataObjectType",vm:"1",version:"PrivateTag"},'(0009,"SPI RELEASE 1",41)':{tag:'(0009,"SPI RELEASE 1",41)',vr:"LO",name:"DataObjectSubtype",vm:"1",version:"PrivateTag"},'(0011,"SPI RELEASE 1",10)':{tag:'(0011,"SPI RELEASE 1",10)',vr:"LO",name:"Organ",vm:"1",version:"PrivateTag"},'(0011,"SPI RELEASE 1",15)':{tag:'(0011,"SPI RELEASE 1",15)',vr:"LO",name:"AllergyIndication",vm:"1",version:"PrivateTag"},'(0011,"SPI RELEASE 1",20)':{tag:'(0011,"SPI RELEASE 1",20)',vr:"LO",name:"Pregnancy",vm:"1",version:"PrivateTag"},'(0029,"SPI RELEASE 1",60)':{tag:'(0029,"SPI RELEASE 1",60)',vr:"LT",name:"CompressionAlgorithm",vm:"1",version:"PrivateTag"},'(0009,"SPI Release 1",10)':{tag:'(0009,"SPI Release 1",10)',vr:"LT",name:"Comments",vm:"1",version:"PrivateTag"},'(0009,"SPI Release 1",15)':{tag:'(0009,"SPI Release 1",15)',vr:"LO",name:"SPIImageUID",vm:"1",version:"PrivateTag"},'(0009,"SPI Release 1",40)':{tag:'(0009,"SPI Release 1",40)',vr:"US",name:"DataObjectType",vm:"1",version:"PrivateTag"},'(0009,"SPI Release 1",41)':{tag:'(0009,"SPI Release 1",41)',vr:"LO",name:"DataObjectSubtype",vm:"1",version:"PrivateTag"},'(0011,"SPI Release 1",10)':{tag:'(0011,"SPI Release 1",10)',vr:"LO",name:"Organ",vm:"1",version:"PrivateTag"},'(0011,"SPI Release 1",15)':{tag:'(0011,"SPI Release 1",15)',vr:"LO",name:"AllergyIndication",vm:"1",version:"PrivateTag"},'(0011,"SPI Release 1",20)':{tag:'(0011,"SPI Release 1",20)',vr:"LO",name:"Pregnancy",vm:"1",version:"PrivateTag"},'(0029,"SPI Release 1",60)':{tag:'(0029,"SPI Release 1",60)',vr:"LT",name:"CompressionAlgorithm",vm:"1",version:"PrivateTag"},'(0009,"SPI",10)':{tag:'(0009,"SPI",10)',vr:"LO",name:"Comments",vm:"1",version:"PrivateTag"},'(0009,"SPI",15)':{tag:'(0009,"SPI",15)',vr:"LO",name:"SPIImageUID",vm:"1",version:"PrivateTag"},'(0009,"SPI",40)':{tag:'(0009,"SPI",40)',vr:"US",name:"DataObjectType",vm:"1",version:"PrivateTag"},'(0009,"SPI",41)':{tag:'(0009,"SPI",41)',vr:"LT",name:"DataObjectSubtype",vm:"1",version:"PrivateTag"},'(0011,"SPI",10)':{tag:'(0011,"SPI",10)',vr:"LT",name:"Organ",vm:"1",version:"PrivateTag"},'(0011,"SPI",15)':{tag:'(0011,"SPI",15)',vr:"LT",name:"AllergyIndication",vm:"1",version:"PrivateTag"},'(0011,"SPI",20)':{tag:'(0011,"SPI",20)',vr:"LT",name:"Pregnancy",vm:"1",version:"PrivateTag"},'(0029,"SPI",60)':{tag:'(0029,"SPI",60)',vr:"LT",name:"CompressionAlgorithm",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",00)':{tag:'(0009,"SPI-P Release 1",00)',vr:"LT",name:"DataObjectRecognitionCode",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",04)':{tag:'(0009,"SPI-P Release 1",04)',vr:"LO",name:"ImageDataConsistence",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",08)':{tag:'(0009,"SPI-P Release 1",08)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",12)':{tag:'(0009,"SPI-P Release 1",12)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",15)':{tag:'(0009,"SPI-P Release 1",15)',vr:"LO",name:"UniqueIdentifier",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",16)':{tag:'(0009,"SPI-P Release 1",16)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",18)':{tag:'(0009,"SPI-P Release 1",18)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",21)':{tag:'(0009,"SPI-P Release 1",21)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",31)':{tag:'(0009,"SPI-P Release 1",31)',vr:"LT",name:"PACSUniqueIdentifier",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",34)':{tag:'(0009,"SPI-P Release 1",34)',vr:"LT",name:"ClusterUniqueIdentifier",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",38)':{tag:'(0009,"SPI-P Release 1",38)',vr:"LT",name:"SystemUniqueIdentifier",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",39)':{tag:'(0009,"SPI-P Release 1",39)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",51)':{tag:'(0009,"SPI-P Release 1",51)',vr:"LT",name:"StudyUniqueIdentifier",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",61)':{tag:'(0009,"SPI-P Release 1",61)',vr:"LT",name:"SeriesUniqueIdentifier",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",91)':{tag:'(0009,"SPI-P Release 1",91)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",f2)':{tag:'(0009,"SPI-P Release 1",f2)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",f3)':{tag:'(0009,"SPI-P Release 1",f3)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",f4)':{tag:'(0009,"SPI-P Release 1",f4)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",f5)':{tag:'(0009,"SPI-P Release 1",f5)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1",f7)':{tag:'(0009,"SPI-P Release 1",f7)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"SPI-P Release 1",10)':{tag:'(0011,"SPI-P Release 1",10)',vr:"LT",name:"PatientEntryID",vm:"1",version:"PrivateTag"},'(0011,"SPI-P Release 1",21)':{tag:'(0011,"SPI-P Release 1",21)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"SPI-P Release 1",22)':{tag:'(0011,"SPI-P Release 1",22)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"SPI-P Release 1",31)':{tag:'(0011,"SPI-P Release 1",31)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"SPI-P Release 1",32)':{tag:'(0011,"SPI-P Release 1",32)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",00)':{tag:'(0019,"SPI-P Release 1",00)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",01)':{tag:'(0019,"SPI-P Release 1",01)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",02)':{tag:'(0019,"SPI-P Release 1",02)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",10)':{tag:'(0019,"SPI-P Release 1",10)',vr:"US",name:"MainsFrequency",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",25)':{tag:'(0019,"SPI-P Release 1",25)',vr:"LT",name:"OriginalPixelDataQuality",vm:"1-n",version:"PrivateTag"},'(0019,"SPI-P Release 1",30)':{tag:'(0019,"SPI-P Release 1",30)',vr:"US",name:"ECGTriggering",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",31)':{tag:'(0019,"SPI-P Release 1",31)',vr:"UN",name:"ECG1Offset",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",32)':{tag:'(0019,"SPI-P Release 1",32)',vr:"UN",name:"ECG2Offset1",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",33)':{tag:'(0019,"SPI-P Release 1",33)',vr:"UN",name:"ECG2Offset2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",50)':{tag:'(0019,"SPI-P Release 1",50)',vr:"US",name:"VideoScanMode",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",51)':{tag:'(0019,"SPI-P Release 1",51)',vr:"US",name:"VideoLineRate",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",60)':{tag:'(0019,"SPI-P Release 1",60)',vr:"US",name:"XrayTechnique",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",61)':{tag:'(0019,"SPI-P Release 1",61)',vr:"DS",name:"ImageIdentifierFromat",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",62)':{tag:'(0019,"SPI-P Release 1",62)',vr:"US",name:"IrisDiaphragm",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",63)':{tag:'(0019,"SPI-P Release 1",63)',vr:"CS",name:"Filter",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",64)':{tag:'(0019,"SPI-P Release 1",64)',vr:"CS",name:"CineParallel",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",65)':{tag:'(0019,"SPI-P Release 1",65)',vr:"CS",name:"CineMaster",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",70)':{tag:'(0019,"SPI-P Release 1",70)',vr:"US",name:"ExposureChannel",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",71)':{tag:'(0019,"SPI-P Release 1",71)',vr:"UN",name:"ExposureChannelFirstImage",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",72)':{tag:'(0019,"SPI-P Release 1",72)',vr:"US",name:"ProcessingChannel",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",80)':{tag:'(0019,"SPI-P Release 1",80)',vr:"DS",name:"AcquisitionDelay",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",81)':{tag:'(0019,"SPI-P Release 1",81)',vr:"UN",name:"RelativeImageTime",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",90)':{tag:'(0019,"SPI-P Release 1",90)',vr:"CS",name:"VideoWhiteCompression",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",a0)':{tag:'(0019,"SPI-P Release 1",a0)',vr:"US",name:"Angulation",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1",a1)':{tag:'(0019,"SPI-P Release 1",a1)',vr:"US",name:"Rotation",vm:"1",version:"PrivateTag"},'(0021,"SPI-P Release 1",12)':{tag:'(0021,"SPI-P Release 1",12)',vr:"LT",name:"SeriesUniqueIdentifier",vm:"1",version:"PrivateTag"},'(0021,"SPI-P Release 1",14)':{tag:'(0021,"SPI-P Release 1",14)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",00)':{tag:'(0029,"SPI-P Release 1",00)',vr:"DS",name:"Unknown",vm:"4",version:"PrivateTag"},'(0029,"SPI-P Release 1",20)':{tag:'(0029,"SPI-P Release 1",20)',vr:"DS",name:"PixelAspectRatio",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",25)':{tag:'(0029,"SPI-P Release 1",25)',vr:"LO",name:"ProcessedPixelDataQuality",vm:"1-n",version:"PrivateTag"},'(0029,"SPI-P Release 1",30)':{tag:'(0029,"SPI-P Release 1",30)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",38)':{tag:'(0029,"SPI-P Release 1",38)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",60)':{tag:'(0029,"SPI-P Release 1",60)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",61)':{tag:'(0029,"SPI-P Release 1",61)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",67)':{tag:'(0029,"SPI-P Release 1",67)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",70)':{tag:'(0029,"SPI-P Release 1",70)',vr:"LT",name:"WindowID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",71)':{tag:'(0029,"SPI-P Release 1",71)',vr:"CS",name:"VideoInvertSubtracted",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",72)':{tag:'(0029,"SPI-P Release 1",72)',vr:"CS",name:"VideoInvertNonsubtracted",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",77)':{tag:'(0029,"SPI-P Release 1",77)',vr:"CS",name:"WindowSelectStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",78)':{tag:'(0029,"SPI-P Release 1",78)',vr:"LT",name:"ECGDisplayPrintingID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",79)':{tag:'(0029,"SPI-P Release 1",79)',vr:"CS",name:"ECGDisplayPrinting",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",7e)':{tag:'(0029,"SPI-P Release 1",7e)',vr:"CS",name:"ECGDisplayPrintingEnableStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",7f)':{tag:'(0029,"SPI-P Release 1",7f)',vr:"CS",name:"ECGDisplayPrintingSelectStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",80)':{tag:'(0029,"SPI-P Release 1",80)',vr:"LT",name:"PhysiologicalDisplayID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",81)':{tag:'(0029,"SPI-P Release 1",81)',vr:"US",name:"PreferredPhysiologicalChannelDisplay",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",8e)':{tag:'(0029,"SPI-P Release 1",8e)',vr:"CS",name:"PhysiologicalDisplayEnableStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",8f)':{tag:'(0029,"SPI-P Release 1",8f)',vr:"CS",name:"PhysiologicalDisplaySelectStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",c0)':{tag:'(0029,"SPI-P Release 1",c0)',vr:"LT",name:"FunctionalShutterID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",c1)':{tag:'(0029,"SPI-P Release 1",c1)',vr:"US",name:"FieldOfShutter",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",c5)':{tag:'(0029,"SPI-P Release 1",c5)',vr:"LT",name:"FieldOfShutterRectangle",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",ce)':{tag:'(0029,"SPI-P Release 1",ce)',vr:"CS",name:"ShutterEnableStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1",cf)':{tag:'(0029,"SPI-P Release 1",cf)',vr:"CS",name:"ShutterSelectStatus",vm:"1",version:"PrivateTag"},'(7FE1,"SPI-P Release 1",10)':{tag:'(7FE1,"SPI-P Release 1",10)',vr:"ox",name:"PixelData",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1;1",c0)':{tag:'(0009,"SPI-P Release 1;1",c0)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P Release 1;1",c1)':{tag:'(0009,"SPI-P Release 1;1",c1)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",00)':{tag:'(0019,"SPI-P Release 1;1",00)',vr:"UN",name:"PhysiologicalDataType",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",01)':{tag:'(0019,"SPI-P Release 1;1",01)',vr:"UN",name:"PhysiologicalDataChannelAndKind",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",02)':{tag:'(0019,"SPI-P Release 1;1",02)',vr:"US",name:"SampleBitsAllocated",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",03)':{tag:'(0019,"SPI-P Release 1;1",03)',vr:"US",name:"SampleBitsStored",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",04)':{tag:'(0019,"SPI-P Release 1;1",04)',vr:"US",name:"SampleHighBit",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",05)':{tag:'(0019,"SPI-P Release 1;1",05)',vr:"US",name:"SampleRepresentation",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",06)':{tag:'(0019,"SPI-P Release 1;1",06)',vr:"UN",name:"SmallestSampleValue",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",07)':{tag:'(0019,"SPI-P Release 1;1",07)',vr:"UN",name:"LargestSampleValue",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",08)':{tag:'(0019,"SPI-P Release 1;1",08)',vr:"UN",name:"NumberOfSamples",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",09)':{tag:'(0019,"SPI-P Release 1;1",09)',vr:"UN",name:"SampleData",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",0a)':{tag:'(0019,"SPI-P Release 1;1",0a)',vr:"UN",name:"SampleRate",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",10)':{tag:'(0019,"SPI-P Release 1;1",10)',vr:"UN",name:"PhysiologicalDataType2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",11)':{tag:'(0019,"SPI-P Release 1;1",11)',vr:"UN",name:"PhysiologicalDataChannelAndKind2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",12)':{tag:'(0019,"SPI-P Release 1;1",12)',vr:"US",name:"SampleBitsAllocated2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",13)':{tag:'(0019,"SPI-P Release 1;1",13)',vr:"US",name:"SampleBitsStored2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",14)':{tag:'(0019,"SPI-P Release 1;1",14)',vr:"US",name:"SampleHighBit2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",15)':{tag:'(0019,"SPI-P Release 1;1",15)',vr:"US",name:"SampleRepresentation2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",16)':{tag:'(0019,"SPI-P Release 1;1",16)',vr:"UN",name:"SmallestSampleValue2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",17)':{tag:'(0019,"SPI-P Release 1;1",17)',vr:"UN",name:"LargestSampleValue2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",18)':{tag:'(0019,"SPI-P Release 1;1",18)',vr:"UN",name:"NumberOfSamples2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",19)':{tag:'(0019,"SPI-P Release 1;1",19)',vr:"UN",name:"SampleData2",vm:"1",version:"PrivateTag"},'(0019,"SPI-P Release 1;1",1a)':{tag:'(0019,"SPI-P Release 1;1",1a)',vr:"UN",name:"SampleRate2",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",00)':{tag:'(0029,"SPI-P Release 1;1",00)',vr:"LT",name:"ZoomID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",01)':{tag:'(0029,"SPI-P Release 1;1",01)',vr:"DS",name:"ZoomRectangle",vm:"1-n",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",03)':{tag:'(0029,"SPI-P Release 1;1",03)',vr:"DS",name:"ZoomFactor",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",04)':{tag:'(0029,"SPI-P Release 1;1",04)',vr:"US",name:"ZoomFunction",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",0e)':{tag:'(0029,"SPI-P Release 1;1",0e)',vr:"CS",name:"ZoomEnableStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",0f)':{tag:'(0029,"SPI-P Release 1;1",0f)',vr:"CS",name:"ZoomSelectStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",40)':{tag:'(0029,"SPI-P Release 1;1",40)',vr:"LT",name:"MagnifyingGlassID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",41)':{tag:'(0029,"SPI-P Release 1;1",41)',vr:"DS",name:"MagnifyingGlassRectangle",vm:"1-n",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",43)':{tag:'(0029,"SPI-P Release 1;1",43)',vr:"DS",name:"MagnifyingGlassFactor",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",44)':{tag:'(0029,"SPI-P Release 1;1",44)',vr:"US",name:"MagnifyingGlassFunction",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",4e)':{tag:'(0029,"SPI-P Release 1;1",4e)',vr:"CS",name:"MagnifyingGlassEnableStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;1",4f)':{tag:'(0029,"SPI-P Release 1;1",4f)',vr:"CS",name:"MagnifyingGlassSelectStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;2",00)':{tag:'(0029,"SPI-P Release 1;2",00)',vr:"LT",name:"SubtractionMaskID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;2",04)':{tag:'(0029,"SPI-P Release 1;2",04)',vr:"UN",name:"MaskingFunction",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;2",0c)':{tag:'(0029,"SPI-P Release 1;2",0c)',vr:"UN",name:"ProprietaryMaskingParameters",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;2",1e)':{tag:'(0029,"SPI-P Release 1;2",1e)',vr:"CS",name:"SubtractionMaskEnableStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;2",1f)':{tag:'(0029,"SPI-P Release 1;2",1f)',vr:"CS",name:"SubtractionMaskSelectStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",00)':{tag:'(0029,"SPI-P Release 1;3",00)',vr:"LT",name:"ImageEnhancementID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",01)':{tag:'(0029,"SPI-P Release 1;3",01)',vr:"LT",name:"ImageEnhancement",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",02)':{tag:'(0029,"SPI-P Release 1;3",02)',vr:"LT",name:"ConvolutionID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",03)':{tag:'(0029,"SPI-P Release 1;3",03)',vr:"LT",name:"ConvolutionType",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",04)':{tag:'(0029,"SPI-P Release 1;3",04)',vr:"LT",name:"ConvolutionKernelSizeID",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",05)':{tag:'(0029,"SPI-P Release 1;3",05)',vr:"US",name:"ConvolutionKernelSize",vm:"2",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",06)':{tag:'(0029,"SPI-P Release 1;3",06)',vr:"US",name:"ConvolutionKernel",vm:"1-n",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",0c)':{tag:'(0029,"SPI-P Release 1;3",0c)',vr:"DS",name:"EnhancementGain",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",1e)':{tag:'(0029,"SPI-P Release 1;3",1e)',vr:"CS",name:"ImageEnhancementEnableStatus",vm:"1",version:"PrivateTag"},'(0029,"SPI-P Release 1;3",1f)':{tag:'(0029,"SPI-P Release 1;3",1f)',vr:"CS",name:"ImageEnhancementSelectStatus",vm:"1",version:"PrivateTag"},'(0011,"SPI-P Release 2;1",18)':{tag:'(0011,"SPI-P Release 2;1",18)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0023,"SPI-P Release 2;1",0d)':{tag:'(0023,"SPI-P Release 2;1",0d)',vr:"UI",name:"Unknown",vm:"1",version:"PrivateTag"},'(0023,"SPI-P Release 2;1",0e)':{tag:'(0023,"SPI-P Release 2;1",0e)',vr:"UI",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",00)':{tag:'(0009,"SPI-P-GV-CT Release 1",00)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",10)':{tag:'(0009,"SPI-P-GV-CT Release 1",10)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",20)':{tag:'(0009,"SPI-P-GV-CT Release 1",20)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",30)':{tag:'(0009,"SPI-P-GV-CT Release 1",30)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",40)':{tag:'(0009,"SPI-P-GV-CT Release 1",40)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",50)':{tag:'(0009,"SPI-P-GV-CT Release 1",50)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",60)':{tag:'(0009,"SPI-P-GV-CT Release 1",60)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",70)':{tag:'(0009,"SPI-P-GV-CT Release 1",70)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",75)':{tag:'(0009,"SPI-P-GV-CT Release 1",75)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",80)':{tag:'(0009,"SPI-P-GV-CT Release 1",80)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"SPI-P-GV-CT Release 1",90)':{tag:'(0009,"SPI-P-GV-CT Release 1",90)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",08)':{tag:'(0019,"SPI-P-GV-CT Release 1",08)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",09)':{tag:'(0019,"SPI-P-GV-CT Release 1",09)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",0a)':{tag:'(0019,"SPI-P-GV-CT Release 1",0a)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",10)':{tag:'(0019,"SPI-P-GV-CT Release 1",10)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",20)':{tag:'(0019,"SPI-P-GV-CT Release 1",20)',vr:"TM",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",50)':{tag:'(0019,"SPI-P-GV-CT Release 1",50)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",60)':{tag:'(0019,"SPI-P-GV-CT Release 1",60)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",61)':{tag:'(0019,"SPI-P-GV-CT Release 1",61)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",63)':{tag:'(0019,"SPI-P-GV-CT Release 1",63)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",64)':{tag:'(0019,"SPI-P-GV-CT Release 1",64)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",65)':{tag:'(0019,"SPI-P-GV-CT Release 1",65)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",70)':{tag:'(0019,"SPI-P-GV-CT Release 1",70)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",80)':{tag:'(0019,"SPI-P-GV-CT Release 1",80)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",81)':{tag:'(0019,"SPI-P-GV-CT Release 1",81)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",90)':{tag:'(0019,"SPI-P-GV-CT Release 1",90)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",a0)':{tag:'(0019,"SPI-P-GV-CT Release 1",a0)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",a1)':{tag:'(0019,"SPI-P-GV-CT Release 1",a1)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",a2)':{tag:'(0019,"SPI-P-GV-CT Release 1",a2)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",a3)':{tag:'(0019,"SPI-P-GV-CT Release 1",a3)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",b0)':{tag:'(0019,"SPI-P-GV-CT Release 1",b0)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-GV-CT Release 1",b1)':{tag:'(0019,"SPI-P-GV-CT Release 1",b1)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",20)':{tag:'(0021,"SPI-P-GV-CT Release 1",20)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",30)':{tag:'(0021,"SPI-P-GV-CT Release 1",30)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",40)':{tag:'(0021,"SPI-P-GV-CT Release 1",40)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",50)':{tag:'(0021,"SPI-P-GV-CT Release 1",50)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",60)':{tag:'(0021,"SPI-P-GV-CT Release 1",60)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",70)':{tag:'(0021,"SPI-P-GV-CT Release 1",70)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",80)':{tag:'(0021,"SPI-P-GV-CT Release 1",80)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",90)':{tag:'(0021,"SPI-P-GV-CT Release 1",90)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",a0)':{tag:'(0021,"SPI-P-GV-CT Release 1",a0)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",a1)':{tag:'(0021,"SPI-P-GV-CT Release 1",a1)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",a2)':{tag:'(0021,"SPI-P-GV-CT Release 1",a2)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",a3)':{tag:'(0021,"SPI-P-GV-CT Release 1",a3)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",a4)':{tag:'(0021,"SPI-P-GV-CT Release 1",a4)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",b0)':{tag:'(0021,"SPI-P-GV-CT Release 1",b0)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-GV-CT Release 1",c0)':{tag:'(0021,"SPI-P-GV-CT Release 1",c0)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-GV-CT Release 1",10)':{tag:'(0029,"SPI-P-GV-CT Release 1",10)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-GV-CT Release 1",30)':{tag:'(0029,"SPI-P-GV-CT Release 1",30)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-GV-CT Release 1",31)':{tag:'(0029,"SPI-P-GV-CT Release 1",31)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-GV-CT Release 1",32)':{tag:'(0029,"SPI-P-GV-CT Release 1",32)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-GV-CT Release 1",33)':{tag:'(0029,"SPI-P-GV-CT Release 1",33)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-GV-CT Release 1",80)':{tag:'(0029,"SPI-P-GV-CT Release 1",80)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-GV-CT Release 1",90)':{tag:'(0029,"SPI-P-GV-CT Release 1",90)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-GV-CT Release 1",d0)':{tag:'(0029,"SPI-P-GV-CT Release 1",d0)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-GV-CT Release 1",d1)':{tag:'(0029,"SPI-P-GV-CT Release 1",d1)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-PCR Release 2",30)':{tag:'(0019,"SPI-P-PCR Release 2",30)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-Private-CWS Release 1",00)':{tag:'(0021,"SPI-P-Private-CWS Release 1",00)',vr:"LT",name:"WindowOfImagesID",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-Private-CWS Release 1",01)':{tag:'(0021,"SPI-P-Private-CWS Release 1",01)',vr:"CS",name:"WindowOfImagesType",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-Private-CWS Release 1",02)':{tag:'(0021,"SPI-P-Private-CWS Release 1",02)',vr:"IS",name:"WindowOfImagesScope",vm:"1-n",version:"PrivateTag"},'(0019,"SPI-P-Private-DCI Release 1",10)':{tag:'(0019,"SPI-P-Private-DCI Release 1",10)',vr:"UN",name:"ECGTimeMapDataBitsAllocated",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-Private-DCI Release 1",11)':{tag:'(0019,"SPI-P-Private-DCI Release 1",11)',vr:"UN",name:"ECGTimeMapDataBitsStored",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-Private-DCI Release 1",12)':{tag:'(0019,"SPI-P-Private-DCI Release 1",12)',vr:"UN",name:"ECGTimeMapDataHighBit",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-Private-DCI Release 1",13)':{tag:'(0019,"SPI-P-Private-DCI Release 1",13)',vr:"UN",name:"ECGTimeMapDataRepresentation",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-Private-DCI Release 1",14)':{tag:'(0019,"SPI-P-Private-DCI Release 1",14)',vr:"UN",name:"ECGTimeMapDataSmallestDataValue",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-Private-DCI Release 1",15)':{tag:'(0019,"SPI-P-Private-DCI Release 1",15)',vr:"UN",name:"ECGTimeMapDataLargestDataValue",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-Private-DCI Release 1",16)':{tag:'(0019,"SPI-P-Private-DCI Release 1",16)',vr:"UN",name:"ECGTimeMapDataNumberOfDataValues",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-Private-DCI Release 1",17)':{tag:'(0019,"SPI-P-Private-DCI Release 1",17)',vr:"UN",name:"ECGTimeMapData",vm:"1",version:"PrivateTag"},'(0021,"SPI-P-Private_CDS Release 1",40)':{tag:'(0021,"SPI-P-Private_CDS Release 1",40)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_CDS Release 1",00)':{tag:'(0029,"SPI-P-Private_CDS Release 1",00)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-Private_ICS Release 1",30)':{tag:'(0019,"SPI-P-Private_ICS Release 1",30)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-Private_ICS Release 1",31)':{tag:'(0019,"SPI-P-Private_ICS Release 1",31)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",08)':{tag:'(0029,"SPI-P-Private_ICS Release 1",08)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",0f)':{tag:'(0029,"SPI-P-Private_ICS Release 1",0f)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",10)':{tag:'(0029,"SPI-P-Private_ICS Release 1",10)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",1b)':{tag:'(0029,"SPI-P-Private_ICS Release 1",1b)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",1c)':{tag:'(0029,"SPI-P-Private_ICS Release 1",1c)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",21)':{tag:'(0029,"SPI-P-Private_ICS Release 1",21)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",43)':{tag:'(0029,"SPI-P-Private_ICS Release 1",43)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",44)':{tag:'(0029,"SPI-P-Private_ICS Release 1",44)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",4C)':{tag:'(0029,"SPI-P-Private_ICS Release 1",4C)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",67)':{tag:'(0029,"SPI-P-Private_ICS Release 1",67)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",68)':{tag:'(0029,"SPI-P-Private_ICS Release 1",68)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",6A)':{tag:'(0029,"SPI-P-Private_ICS Release 1",6A)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1",6B)':{tag:'(0029,"SPI-P-Private_ICS Release 1",6B)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;1",00)':{tag:'(0029,"SPI-P-Private_ICS Release 1;1",00)',vr:"SL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;1",05)':{tag:'(0029,"SPI-P-Private_ICS Release 1;1",05)',vr:"FL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;1",06)':{tag:'(0029,"SPI-P-Private_ICS Release 1;1",06)',vr:"FL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;1",20)':{tag:'(0029,"SPI-P-Private_ICS Release 1;1",20)',vr:"FL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;1",21)':{tag:'(0029,"SPI-P-Private_ICS Release 1;1",21)',vr:"FL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;1",CD)':{tag:'(0029,"SPI-P-Private_ICS Release 1;1",CD)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;2",00)':{tag:'(0029,"SPI-P-Private_ICS Release 1;2",00)',vr:"FD",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;2",01)':{tag:'(0029,"SPI-P-Private_ICS Release 1;2",01)',vr:"FD",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;2",02)':{tag:'(0029,"SPI-P-Private_ICS Release 1;2",02)',vr:"FD",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;2",03)':{tag:'(0029,"SPI-P-Private_ICS Release 1;2",03)',vr:"SL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;2",04)':{tag:'(0029,"SPI-P-Private_ICS Release 1;2",04)',vr:"SL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;2",05)':{tag:'(0029,"SPI-P-Private_ICS Release 1;2",05)',vr:"SL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;3",C0)':{tag:'(0029,"SPI-P-Private_ICS Release 1;3",C0)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;3",C1)':{tag:'(0029,"SPI-P-Private_ICS Release 1;3",C1)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;3",C2)':{tag:'(0029,"SPI-P-Private_ICS Release 1;3",C2)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;3",C3)':{tag:'(0029,"SPI-P-Private_ICS Release 1;3",C3)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;3",C4)':{tag:'(0029,"SPI-P-Private_ICS Release 1;3",C4)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;3",C5)':{tag:'(0029,"SPI-P-Private_ICS Release 1;3",C5)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;4",02)':{tag:'(0029,"SPI-P-Private_ICS Release 1;4",02)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;4",9A)':{tag:'(0029,"SPI-P-Private_ICS Release 1;4",9A)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;4",E0)':{tag:'(0029,"SPI-P-Private_ICS Release 1;4",E0)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;5",50)':{tag:'(0029,"SPI-P-Private_ICS Release 1;5",50)',vr:"CS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"SPI-P-Private_ICS Release 1;5",55)':{tag:'(0029,"SPI-P-Private_ICS Release 1;5",55)',vr:"CS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-XSB-DCI Release 1",10)':{tag:'(0019,"SPI-P-XSB-DCI Release 1",10)',vr:"LT",name:"VideoBeamBoost",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-XSB-DCI Release 1",11)':{tag:'(0019,"SPI-P-XSB-DCI Release 1",11)',vr:"US",name:"ChannelGeneratingVideoSync",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-XSB-DCI Release 1",12)':{tag:'(0019,"SPI-P-XSB-DCI Release 1",12)',vr:"US",name:"VideoGain",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-XSB-DCI Release 1",13)':{tag:'(0019,"SPI-P-XSB-DCI Release 1",13)',vr:"US",name:"VideoOffset",vm:"1",version:"PrivateTag"},'(0019,"SPI-P-XSB-DCI Release 1",20)':{tag:'(0019,"SPI-P-XSB-DCI Release 1",20)',vr:"DS",name:"RTDDataCompressionFactor",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",11)':{tag:'(0029,"Silhouette Annot V1.0",11)',vr:"IS",name:"AnnotationName",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",12)':{tag:'(0029,"Silhouette Annot V1.0",12)',vr:"LT",name:"AnnotationFont",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",13)':{tag:'(0029,"Silhouette Annot V1.0",13)',vr:"LT",name:"AnnotationTextForegroundColor",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",14)':{tag:'(0029,"Silhouette Annot V1.0",14)',vr:"LT",name:"AnnotationTextBackgroundColor",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",15)':{tag:'(0029,"Silhouette Annot V1.0",15)',vr:"UL",name:"AnnotationTextBackingMode",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",16)':{tag:'(0029,"Silhouette Annot V1.0",16)',vr:"UL",name:"AnnotationTextJustification",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",17)':{tag:'(0029,"Silhouette Annot V1.0",17)',vr:"UL",name:"AnnotationTextLocation",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",18)':{tag:'(0029,"Silhouette Annot V1.0",18)',vr:"LT",name:"AnnotationTextString",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",19)':{tag:'(0029,"Silhouette Annot V1.0",19)',vr:"UL",name:"AnnotationTextAttachMode",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",20)':{tag:'(0029,"Silhouette Annot V1.0",20)',vr:"UL",name:"AnnotationTextCursorMode",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",21)':{tag:'(0029,"Silhouette Annot V1.0",21)',vr:"UL",name:"AnnotationTextShadowOffsetX",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",22)':{tag:'(0029,"Silhouette Annot V1.0",22)',vr:"UL",name:"AnnotationTextShadowOffsetY",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",23)':{tag:'(0029,"Silhouette Annot V1.0",23)',vr:"LT",name:"AnnotationLineColor",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",24)':{tag:'(0029,"Silhouette Annot V1.0",24)',vr:"UL",name:"AnnotationLineThickness",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",25)':{tag:'(0029,"Silhouette Annot V1.0",25)',vr:"UL",name:"AnnotationLineType",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",26)':{tag:'(0029,"Silhouette Annot V1.0",26)',vr:"UL",name:"AnnotationLineStyle",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",27)':{tag:'(0029,"Silhouette Annot V1.0",27)',vr:"UL",name:"AnnotationLineDashLength",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",28)':{tag:'(0029,"Silhouette Annot V1.0",28)',vr:"UL",name:"AnnotationLineAttachMode",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",29)':{tag:'(0029,"Silhouette Annot V1.0",29)',vr:"UL",name:"AnnotationLinePointCount",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",30)':{tag:'(0029,"Silhouette Annot V1.0",30)',vr:"FD",name:"AnnotationLinePoints",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",31)':{tag:'(0029,"Silhouette Annot V1.0",31)',vr:"UL",name:"AnnotationLineControlSize",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",32)':{tag:'(0029,"Silhouette Annot V1.0",32)',vr:"LT",name:"AnnotationMarkerColor",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",33)':{tag:'(0029,"Silhouette Annot V1.0",33)',vr:"UL",name:"AnnotationMarkerType",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",34)':{tag:'(0029,"Silhouette Annot V1.0",34)',vr:"UL",name:"AnnotationMarkerSize",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",35)':{tag:'(0029,"Silhouette Annot V1.0",35)',vr:"FD",name:"AnnotationMarkerLocation",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",36)':{tag:'(0029,"Silhouette Annot V1.0",36)',vr:"UL",name:"AnnotationMarkerAttachMode",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",37)':{tag:'(0029,"Silhouette Annot V1.0",37)',vr:"LT",name:"AnnotationGeomColor",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",38)':{tag:'(0029,"Silhouette Annot V1.0",38)',vr:"UL",name:"AnnotationGeomThickness",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",39)':{tag:'(0029,"Silhouette Annot V1.0",39)',vr:"UL",name:"AnnotationGeomLineStyle",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",40)':{tag:'(0029,"Silhouette Annot V1.0",40)',vr:"UL",name:"AnnotationGeomDashLength",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",41)':{tag:'(0029,"Silhouette Annot V1.0",41)',vr:"UL",name:"AnnotationGeomFillPattern",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",42)':{tag:'(0029,"Silhouette Annot V1.0",42)',vr:"UL",name:"AnnotationInteractivity",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",43)':{tag:'(0029,"Silhouette Annot V1.0",43)',vr:"FD",name:"AnnotationArrowLength",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",44)':{tag:'(0029,"Silhouette Annot V1.0",44)',vr:"FD",name:"AnnotationArrowAngle",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Annot V1.0",45)':{tag:'(0029,"Silhouette Annot V1.0",45)',vr:"UL",name:"AnnotationDontSave",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Graphics Export V1.0",00)':{tag:'(0029,"Silhouette Graphics Export V1.0",00)',vr:"UI",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",11)':{tag:'(0029,"Silhouette Line V1.0",11)',vr:"IS",name:"LineName",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",12)':{tag:'(0029,"Silhouette Line V1.0",12)',vr:"LT",name:"LineNameFont",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",13)':{tag:'(0029,"Silhouette Line V1.0",13)',vr:"UL",name:"LineNameDisplay",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",14)':{tag:'(0029,"Silhouette Line V1.0",14)',vr:"LT",name:"LineNormalColor",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",15)':{tag:'(0029,"Silhouette Line V1.0",15)',vr:"UL",name:"LineType",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",16)':{tag:'(0029,"Silhouette Line V1.0",16)',vr:"UL",name:"LineThickness",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",17)':{tag:'(0029,"Silhouette Line V1.0",17)',vr:"UL",name:"LineStyle",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",18)':{tag:'(0029,"Silhouette Line V1.0",18)',vr:"UL",name:"LineDashLength",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",19)':{tag:'(0029,"Silhouette Line V1.0",19)',vr:"UL",name:"LineInteractivity",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",20)':{tag:'(0029,"Silhouette Line V1.0",20)',vr:"LT",name:"LineMeasurementColor",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",21)':{tag:'(0029,"Silhouette Line V1.0",21)',vr:"LT",name:"LineMeasurementFont",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",22)':{tag:'(0029,"Silhouette Line V1.0",22)',vr:"UL",name:"LineMeasurementDashLength",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",23)':{tag:'(0029,"Silhouette Line V1.0",23)',vr:"UL",name:"LinePointSpace",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",24)':{tag:'(0029,"Silhouette Line V1.0",24)',vr:"FD",name:"LinePoints",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",25)':{tag:'(0029,"Silhouette Line V1.0",25)',vr:"UL",name:"LineControlPointSize",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",26)':{tag:'(0029,"Silhouette Line V1.0",26)',vr:"UL",name:"LineControlPointSpace",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",27)':{tag:'(0029,"Silhouette Line V1.0",27)',vr:"FD",name:"LineControlPoints",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",28)':{tag:'(0029,"Silhouette Line V1.0",28)',vr:"LT",name:"LineLabel",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Line V1.0",29)':{tag:'(0029,"Silhouette Line V1.0",29)',vr:"UL",name:"LineDontSave",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",11)':{tag:'(0029,"Silhouette ROI V1.0",11)',vr:"IS",name:"ROIName",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",12)':{tag:'(0029,"Silhouette ROI V1.0",12)',vr:"LT",name:"ROINameFont",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",13)':{tag:'(0029,"Silhouette ROI V1.0",13)',vr:"LT",name:"ROINormalColor",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",14)':{tag:'(0029,"Silhouette ROI V1.0",14)',vr:"UL",name:"ROIFillPattern",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",15)':{tag:'(0029,"Silhouette ROI V1.0",15)',vr:"UL",name:"ROIBpSeg",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",16)':{tag:'(0029,"Silhouette ROI V1.0",16)',vr:"UN",name:"ROIBpSegPairs",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",17)':{tag:'(0029,"Silhouette ROI V1.0",17)',vr:"UL",name:"ROISeedSpace",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",18)':{tag:'(0029,"Silhouette ROI V1.0",18)',vr:"UN",name:"ROISeeds",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",19)':{tag:'(0029,"Silhouette ROI V1.0",19)',vr:"UL",name:"ROILineThickness",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",20)':{tag:'(0029,"Silhouette ROI V1.0",20)',vr:"UL",name:"ROILineStyle",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",21)':{tag:'(0029,"Silhouette ROI V1.0",21)',vr:"UL",name:"ROILineDashLength",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",22)':{tag:'(0029,"Silhouette ROI V1.0",22)',vr:"UL",name:"ROIInteractivity",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",23)':{tag:'(0029,"Silhouette ROI V1.0",23)',vr:"UL",name:"ROINamePosition",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",24)':{tag:'(0029,"Silhouette ROI V1.0",24)',vr:"UL",name:"ROINameDisplay",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",25)':{tag:'(0029,"Silhouette ROI V1.0",25)',vr:"LT",name:"ROILabel",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",26)':{tag:'(0029,"Silhouette ROI V1.0",26)',vr:"UL",name:"ROIShape",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",27)':{tag:'(0029,"Silhouette ROI V1.0",27)',vr:"FD",name:"ROIShapeTilt",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",28)':{tag:'(0029,"Silhouette ROI V1.0",28)',vr:"UL",name:"ROIShapePointsCount",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",29)':{tag:'(0029,"Silhouette ROI V1.0",29)',vr:"UL",name:"ROIShapePointsSpace",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",30)':{tag:'(0029,"Silhouette ROI V1.0",30)',vr:"FD",name:"ROIShapePoints",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",31)':{tag:'(0029,"Silhouette ROI V1.0",31)',vr:"UL",name:"ROIShapeControlPointsCount",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",32)':{tag:'(0029,"Silhouette ROI V1.0",32)',vr:"UL",name:"ROIShapeControlPointsSpace",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",33)':{tag:'(0029,"Silhouette ROI V1.0",33)',vr:"FD",name:"ROIShapeControlPoints",vm:"1",version:"PrivateTag"},'(0029,"Silhouette ROI V1.0",34)':{tag:'(0029,"Silhouette ROI V1.0",34)',vr:"UL",name:"ROIDontSave",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Sequence Ids V1.0",41)':{tag:'(0029,"Silhouette Sequence Ids V1.0",41)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Sequence Ids V1.0",42)':{tag:'(0029,"Silhouette Sequence Ids V1.0",42)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette Sequence Ids V1.0",43)':{tag:'(0029,"Silhouette Sequence Ids V1.0",43)',vr:"SQ",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",13)':{tag:'(0029,"Silhouette V1.0",13)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",14)':{tag:'(0029,"Silhouette V1.0",14)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",17)':{tag:'(0029,"Silhouette V1.0",17)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",18)':{tag:'(0029,"Silhouette V1.0",18)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",19)':{tag:'(0029,"Silhouette V1.0",19)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",1a)':{tag:'(0029,"Silhouette V1.0",1a)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",1b)':{tag:'(0029,"Silhouette V1.0",1b)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",1c)':{tag:'(0029,"Silhouette V1.0",1c)',vr:"UL",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",1d)':{tag:'(0029,"Silhouette V1.0",1d)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",1e)':{tag:'(0029,"Silhouette V1.0",1e)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",21)':{tag:'(0029,"Silhouette V1.0",21)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",22)':{tag:'(0029,"Silhouette V1.0",22)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",23)':{tag:'(0029,"Silhouette V1.0",23)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",24)':{tag:'(0029,"Silhouette V1.0",24)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",25)':{tag:'(0029,"Silhouette V1.0",25)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",27)':{tag:'(0029,"Silhouette V1.0",27)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",28)':{tag:'(0029,"Silhouette V1.0",28)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",29)':{tag:'(0029,"Silhouette V1.0",29)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",30)':{tag:'(0029,"Silhouette V1.0",30)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",52)':{tag:'(0029,"Silhouette V1.0",52)',vr:"US",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",53)':{tag:'(0029,"Silhouette V1.0",53)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",54)':{tag:'(0029,"Silhouette V1.0",54)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",55)':{tag:'(0029,"Silhouette V1.0",55)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",56)':{tag:'(0029,"Silhouette V1.0",56)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0029,"Silhouette V1.0",57)':{tag:'(0029,"Silhouette V1.0",57)',vr:"UN",name:"Unknown",vm:"1",version:"PrivateTag"},'(0135,"SONOWAND AS",10)':{tag:'(0135,"SONOWAND AS",10)',vr:"LO",name:"UltrasoundScannerName",vm:"1",version:"PrivateTag"},'(0135,"SONOWAND AS",11)':{tag:'(0135,"SONOWAND AS",11)',vr:"LO",name:"TransducerSerial",vm:"1",version:"PrivateTag"},'(0135,"SONOWAND AS",12)':{tag:'(0135,"SONOWAND AS",12)',vr:"LO",name:"ProbeApplication",vm:"1",version:"PrivateTag"},'(0017,"SVISION",00)':{tag:'(0017,"SVISION",00)',vr:"LO",name:"ExtendedBodyPart",vm:"1",version:"PrivateTag"},'(0017,"SVISION",10)':{tag:'(0017,"SVISION",10)',vr:"LO",name:"ExtendedViewPosition",vm:"1",version:"PrivateTag"},'(0017,"SVISION",F0)':{tag:'(0017,"SVISION",F0)',vr:"IS",name:"ImagesSOPClass",vm:"1",version:"PrivateTag"},'(0019,"SVISION",00)':{tag:'(0019,"SVISION",00)',vr:"IS",name:"AECField",vm:"1",version:"PrivateTag"},'(0019,"SVISION",01)':{tag:'(0019,"SVISION",01)',vr:"IS",name:"AECFilmScreen",vm:"1",version:"PrivateTag"},'(0019,"SVISION",02)':{tag:'(0019,"SVISION",02)',vr:"IS",name:"AECDensity",vm:"1",version:"PrivateTag"},'(0019,"SVISION",10)':{tag:'(0019,"SVISION",10)',vr:"IS",name:"PatientThickness",vm:"1",version:"PrivateTag"},'(0019,"SVISION",18)':{tag:'(0019,"SVISION",18)',vr:"IS",name:"BeamDistance",vm:"1",version:"PrivateTag"},'(0019,"SVISION",20)':{tag:'(0019,"SVISION",20)',vr:"IS",name:"WorkstationNumber",vm:"1",version:"PrivateTag"},'(0019,"SVISION",28)':{tag:'(0019,"SVISION",28)',vr:"IS",name:"TubeNumber",vm:"1",version:"PrivateTag"},'(0019,"SVISION",30)':{tag:'(0019,"SVISION",30)',vr:"IS",name:"BuckyGrid",vm:"1",version:"PrivateTag"},'(0019,"SVISION",34)':{tag:'(0019,"SVISION",34)',vr:"IS",name:"Focus",vm:"1",version:"PrivateTag"},'(0019,"SVISION",38)':{tag:'(0019,"SVISION",38)',vr:"IS",name:"Child",vm:"1",version:"PrivateTag"},'(0019,"SVISION",40)':{tag:'(0019,"SVISION",40)',vr:"IS",name:"CollimatorDistanceX",vm:"1",version:"PrivateTag"},'(0019,"SVISION",41)':{tag:'(0019,"SVISION",41)',vr:"IS",name:"CollimatorDistanceY",vm:"1",version:"PrivateTag"},'(0019,"SVISION",50)':{tag:'(0019,"SVISION",50)',vr:"IS",name:"CentralBeamHeight",vm:"1",version:"PrivateTag"},'(0019,"SVISION",60)':{tag:'(0019,"SVISION",60)',vr:"IS",name:"BuckyAngle",vm:"1",version:"PrivateTag"},'(0019,"SVISION",68)':{tag:'(0019,"SVISION",68)',vr:"IS",name:"CArmAngle",vm:"1",version:"PrivateTag"},'(0019,"SVISION",69)':{tag:'(0019,"SVISION",69)',vr:"IS",name:"CollimatorAngle",vm:"1",version:"PrivateTag"},'(0019,"SVISION",70)':{tag:'(0019,"SVISION",70)',vr:"IS",name:"FilterNumber",vm:"1",version:"PrivateTag"},'(0019,"SVISION",74)':{tag:'(0019,"SVISION",74)',vr:"LO",name:"FilterMaterial1",vm:"1",version:"PrivateTag"},'(0019,"SVISION",75)':{tag:'(0019,"SVISION",75)',vr:"LO",name:"FilterMaterial2",vm:"1",version:"PrivateTag"},'(0019,"SVISION",78)':{tag:'(0019,"SVISION",78)',vr:"DS",name:"FilterThickness1",vm:"1",version:"PrivateTag"},'(0019,"SVISION",79)':{tag:'(0019,"SVISION",79)',vr:"DS",name:"FilterThickness2",vm:"1",version:"PrivateTag"},'(0019,"SVISION",80)':{tag:'(0019,"SVISION",80)',vr:"IS",name:"BuckyFormat",vm:"1",version:"PrivateTag"},'(0019,"SVISION",81)':{tag:'(0019,"SVISION",81)',vr:"IS",name:"ObjectPosition",vm:"1",version:"PrivateTag"},'(0019,"SVISION",90)':{tag:'(0019,"SVISION",90)',vr:"LO",name:"DeskCommand",vm:"1",version:"PrivateTag"},'(0019,"SVISION",A0)':{tag:'(0019,"SVISION",A0)',vr:"DS",name:"ExtendedExposureTime",vm:"1",version:"PrivateTag"},'(0019,"SVISION",A1)':{tag:'(0019,"SVISION",A1)',vr:"DS",name:"ActualExposureTime",vm:"1",version:"PrivateTag"},'(0019,"SVISION",A8)':{tag:'(0019,"SVISION",A8)',vr:"DS",name:"ExtendedXRayTubeCurrent",vm:"1",version:"PrivateTag"},'(0021,"SVISION",00)':{tag:'(0021,"SVISION",00)',vr:"DS",name:"NoiseReduction",vm:"1",version:"PrivateTag"},'(0021,"SVISION",01)':{tag:'(0021,"SVISION",01)',vr:"DS",name:"ContrastAmplification",vm:"1",version:"PrivateTag"},'(0021,"SVISION",02)':{tag:'(0021,"SVISION",02)',vr:"DS",name:"EdgeContrastBoosting",vm:"1",version:"PrivateTag"},'(0021,"SVISION",03)':{tag:'(0021,"SVISION",03)',vr:"DS",name:"LatitudeReduction",vm:"1",version:"PrivateTag"},'(0021,"SVISION",10)':{tag:'(0021,"SVISION",10)',vr:"LO",name:"FindRangeAlgorithm",vm:"1",version:"PrivateTag"},'(0021,"SVISION",11)':{tag:'(0021,"SVISION",11)',vr:"DS",name:"ThresholdCAlgorithm",vm:"1",version:"PrivateTag"},'(0021,"SVISION",20)':{tag:'(0021,"SVISION",20)',vr:"LO",name:"SensometricCurve",vm:"1",version:"PrivateTag"},'(0021,"SVISION",30)':{tag:'(0021,"SVISION",30)',vr:"DS",name:"LowerWindowOffset",vm:"1",version:"PrivateTag"},'(0021,"SVISION",31)':{tag:'(0021,"SVISION",31)',vr:"DS",name:"UpperWindowOffset",vm:"1",version:"PrivateTag"},'(0021,"SVISION",40)':{tag:'(0021,"SVISION",40)',vr:"DS",name:"MinPrintableDensity",vm:"1",version:"PrivateTag"},'(0021,"SVISION",41)':{tag:'(0021,"SVISION",41)',vr:"DS",name:"MaxPrintableDensity",vm:"1",version:"PrivateTag"},'(0021,"SVISION",90)':{tag:'(0021,"SVISION",90)',vr:"DS",name:"Brightness",vm:"1",version:"PrivateTag"},'(0021,"SVISION",91)':{tag:'(0021,"SVISION",91)',vr:"DS",name:"Contrast",vm:"1",version:"PrivateTag"},'(0021,"SVISION",92)':{tag:'(0021,"SVISION",92)',vr:"DS",name:"ShapeFactor",vm:"1",version:"PrivateTag"},'(0023,"SVISION",00)':{tag:'(0023,"SVISION",00)',vr:"LO",name:"ImageLaterality",vm:"1",version:"PrivateTag"},'(0023,"SVISION",01)':{tag:'(0023,"SVISION",01)',vr:"IS",name:"LetterPosition",vm:"1",version:"PrivateTag"},'(0023,"SVISION",02)':{tag:'(0023,"SVISION",02)',vr:"IS",name:"BurnedInAnnotation",vm:"1",version:"PrivateTag"},'(0023,"SVISION",03)':{tag:'(0023,"SVISION",03)',vr:"LO",name:"Unknown",vm:"1",version:"PrivateTag"},'(0023,"SVISION",F0)':{tag:'(0023,"SVISION",F0)',vr:"IS",name:"ImageSOPClass",vm:"1",version:"PrivateTag"},'(0025,"SVISION",00)':{tag:'(0025,"SVISION",00)',vr:"IS",name:"OriginalImage",vm:"1",version:"PrivateTag"},'(0025,"SVISION",01)':{tag:'(0025,"SVISION",01)',vr:"IS",name:"NotProcessedImage",vm:"1",version:"PrivateTag"},'(0025,"SVISION",02)':{tag:'(0025,"SVISION",02)',vr:"IS",name:"CutOutImage",vm:"1",version:"PrivateTag"},'(0025,"SVISION",03)':{tag:'(0025,"SVISION",03)',vr:"IS",name:"DuplicatedImage",vm:"1",version:"PrivateTag"},'(0025,"SVISION",04)':{tag:'(0025,"SVISION",04)',vr:"IS",name:"StoredImage",vm:"1",version:"PrivateTag"},'(0025,"SVISION",05)':{tag:'(0025,"SVISION",05)',vr:"IS",name:"RetrievedImage",vm:"1",version:"PrivateTag"},'(0025,"SVISION",06)':{tag:'(0025,"SVISION",06)',vr:"IS",name:"RemoteImage",vm:"1",version:"PrivateTag"},'(0025,"SVISION",07)':{tag:'(0025,"SVISION",07)',vr:"IS",name:"MediaStoredImage",vm:"1",version:"PrivateTag"},'(0025,"SVISION",08)':{tag:'(0025,"SVISION",08)',vr:"IS",name:"ImageState",vm:"1",version:"PrivateTag"},'(0025,"SVISION",20)':{tag:'(0025,"SVISION",20)',vr:"LO",name:"SourceImageFile",vm:"1",version:"PrivateTag"},'(0025,"SVISION",21)':{tag:'(0025,"SVISION",21)',vr:"UI",name:"Unknown",vm:"1",version:"PrivateTag"},'(0027,"SVISION",00)':{tag:'(0027,"SVISION",00)',vr:"IS",name:"NumberOfSeries",vm:"1",version:"PrivateTag"},'(0027,"SVISION",01)':{tag:'(0027,"SVISION",01)',vr:"IS",name:"NumberOfStudies",vm:"1",version:"PrivateTag"},'(0027,"SVISION",10)':{tag:'(0027,"SVISION",10)',vr:"DT",name:"OldestSeries",vm:"1",version:"PrivateTag"},'(0027,"SVISION",11)':{tag:'(0027,"SVISION",11)',vr:"DT",name:"NewestSeries",vm:"1",version:"PrivateTag"},'(0027,"SVISION",12)':{tag:'(0027,"SVISION",12)',vr:"DT",name:"OldestStudy",vm:"1",version:"PrivateTag"},'(0027,"SVISION",13)':{tag:'(0027,"SVISION",13)',vr:"DT",name:"NewestStudy",vm:"1",version:"PrivateTag"},'(0009,"TOSHIBA_MEC_1.0",01)':{tag:'(0009,"TOSHIBA_MEC_1.0",01)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0009,"TOSHIBA_MEC_1.0",02)':{tag:'(0009,"TOSHIBA_MEC_1.0",02)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0009,"TOSHIBA_MEC_1.0",03)':{tag:'(0009,"TOSHIBA_MEC_1.0",03)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0009,"TOSHIBA_MEC_1.0",04)':{tag:'(0009,"TOSHIBA_MEC_1.0",04)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0011,"TOSHIBA_MEC_1.0",01)':{tag:'(0011,"TOSHIBA_MEC_1.0",01)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0011,"TOSHIBA_MEC_1.0",02)':{tag:'(0011,"TOSHIBA_MEC_1.0",02)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_1.0",01)':{tag:'(0019,"TOSHIBA_MEC_1.0",01)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_1.0",02)':{tag:'(0019,"TOSHIBA_MEC_1.0",02)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"TOSHIBA_MEC_1.0",01)':{tag:'(0021,"TOSHIBA_MEC_1.0",01)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"TOSHIBA_MEC_1.0",02)':{tag:'(0021,"TOSHIBA_MEC_1.0",02)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0021,"TOSHIBA_MEC_1.0",03)':{tag:'(0021,"TOSHIBA_MEC_1.0",03)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_1.0",01)':{tag:'(7ff1,"TOSHIBA_MEC_1.0",01)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_1.0",02)':{tag:'(7ff1,"TOSHIBA_MEC_1.0",02)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_1.0",03)':{tag:'(7ff1,"TOSHIBA_MEC_1.0",03)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_1.0",10)':{tag:'(7ff1,"TOSHIBA_MEC_1.0",10)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",01)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",01)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",02)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",02)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",03)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",03)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",04)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",04)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",05)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",05)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",06)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",06)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",07)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",07)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",08)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",08)',vr:"LT",name:"OrientationHeadFeet",vm:"1",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",09)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",09)',vr:"LT",name:"ViewDirection",vm:"1",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",0a)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",0a)',vr:"LT",name:"OrientationSupineProne",vm:"1",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",0b)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",0b)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",0c)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",0c)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",0d)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",0d)',vr:"TM",name:"Time",vm:"1",version:"PrivateTag"},'(0019,"TOSHIBA_MEC_CT_1.0",0e)':{tag:'(0019,"TOSHIBA_MEC_CT_1.0",0e)',vr:"DS",name:"Unknown",vm:"1",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",01)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",01)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",02)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",02)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",03)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",03)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",04)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",04)',vr:"IS",name:"Unknown",vm:"1",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",05)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",05)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",07)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",07)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",08)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",08)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",09)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",09)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",0a)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",0a)',vr:"LT",name:"Unknown",vm:"1",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",0b)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",0b)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",0c)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",0c)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"},'(7ff1,"TOSHIBA_MEC_CT_1.0",0d)':{tag:'(7ff1,"TOSHIBA_MEC_CT_1.0",0d)',vr:"US",name:"Unknown",vm:"1-n",version:"PrivateTag"}};

	var DicomMetaDictionary =
	/*#__PURE__*/
	function () {
	  function DicomMetaDictionary() {
	    _classCallCheck(this, DicomMetaDictionary);
	  }

	  _createClass(DicomMetaDictionary, null, [{
	    key: "punctuateTag",
	    value: function punctuateTag(rawTag) {
	      if (rawTag.indexOf(",") !== -1) {
	        return rawTag;
	      }

	      if (rawTag.length === 8 && rawTag === rawTag.match(/[0-9a-fA-F]*/)[0]) {
	        var tag = rawTag.toUpperCase();
	        return "(" + tag.substring(0, 4) + "," + tag.substring(4, 8) + ")";
	      }
	    }
	  }, {
	    key: "unpunctuateTag",
	    value: function unpunctuateTag(tag) {
	      if (tag.indexOf(",") === -1) {
	        return tag;
	      }

	      return tag.substring(1, 10).replace(",", "");
	    } // fixes some common errors in VRs
	    // TODO: if this gets longer it could go in ValueRepresentation.js
	    // or in a dedicated class

	  }, {
	    key: "cleanDataset",
	    value: function cleanDataset(dataset) {
	      var cleanedDataset = {};
	      Object.keys(dataset).forEach(function (tag) {
	        var data = dataset[tag];

	        if (data.vr === "SQ") {
	          var cleanedValues = [];
	          Object.keys(data.Value).forEach(function (index) {
	            cleanedValues.push(DicomMetaDictionary.cleanDataset(data.Value[index]));
	          });
	          data.Value = cleanedValues;
	        } else {
	          // remove null characters from strings
	          Object.keys(data.Value).forEach(function (index) {
	            var dataItem = data.Value[index];

	            if (dataItem.constructor.name === "String") {
	              data.Value[index] = dataItem.replace(/\0/, "");
	            }
	          });
	        }

	        cleanedDataset[tag] = data;
	      });
	      return cleanedDataset;
	    } // unlike naturalizeDataset, this only
	    // changes the names of the member variables
	    // but leaves the values intact

	  }, {
	    key: "namifyDataset",
	    value: function namifyDataset(dataset) {
	      var namedDataset = {};
	      Object.keys(dataset).forEach(function (tag) {
	        var data = dataset[tag];

	        if (data.vr === "SQ") {
	          var namedValues = [];
	          Object.keys(data.Value).forEach(function (index) {
	            namedValues.push(DicomMetaDictionary.namifyDataset(data.Value[index]));
	          });
	          data.Value = namedValues;
	        }

	        var punctuatedTag = DicomMetaDictionary.punctuateTag(tag);
	        var entry = DicomMetaDictionary.dictionary[punctuatedTag];
	        var name = tag;

	        if (entry) {
	          name = entry.name;
	        }

	        namedDataset[name] = data;
	      });
	      return namedDataset;
	    } // converts from DICOM JSON Model dataset
	    // to a natural dataset
	    // - sequences become lists
	    // - single element lists are replaced by their first element
	    // - object member names are dictionary, not group/element tag

	  }, {
	    key: "naturalizeDataset",
	    value: function naturalizeDataset(dataset) {
	      var naturalDataset = {
	        _vrMap: {}
	      };
	      Object.keys(dataset).forEach(function (tag) {
	        var data = dataset[tag];

	        if (data.vr === "SQ") {
	          // convert sequence to list of values
	          var naturalValues = [];
	          Object.keys(data.Value).forEach(function (index) {
	            naturalValues.push(DicomMetaDictionary.naturalizeDataset(data.Value[index]));
	          });
	          data.Value = naturalValues;
	        }

	        var punctuatedTag = DicomMetaDictionary.punctuateTag(tag);
	        var entry = DicomMetaDictionary.dictionary[punctuatedTag];
	        var naturalName = tag;

	        if (entry) {
	          naturalName = entry.name;

	          if (entry.vr === "ox") {
	            // when the vr is data-dependent, keep track of the original type
	            naturalDataset._vrMap[naturalName] = data.vr;
	          }
	        }

	        naturalDataset[naturalName] = data.Value;

	        if (naturalDataset[naturalName].length === 1) {
	          // only one value is not a list
	          naturalDataset[naturalName] = naturalDataset[naturalName][0];
	        }
	      });
	      return naturalDataset;
	    }
	  }, {
	    key: "denaturalizeValue",
	    value: function denaturalizeValue(naturalValue) {
	      var value = naturalValue;

	      if (!Array.isArray(value)) {
	        value = [value];
	      } else {
	        var thereIsUndefinedValues = naturalValue.some(function (item) {
	          return item === undefined;
	        });

	        if (thereIsUndefinedValues) {
	          throw new Error("There are undefined values at the array naturalValue in DicomMetaDictionary.denaturalizeValue");
	        }
	      }

	      value = value.map(function (entry) {
	        return entry.constructor.name === "Number" ? String(entry) : entry;
	      });
	      return value;
	    }
	  }, {
	    key: "denaturalizeDataset",
	    value: function denaturalizeDataset(dataset) {
	      var unnaturalDataset = {};
	      Object.keys(dataset).forEach(function (naturalName) {
	        // check if it's a sequence
	        var name = naturalName;
	        var entry = DicomMetaDictionary.nameMap[name];

	        if (entry) {
	          var dataValue = dataset[naturalName];

	          if (dataValue === undefined || dataValue === null) {
	            // handle the case where it was deleted from the object but is in keys
	            return;
	          } // process this one entry


	          var dataItem = {
	            vr: entry.vr,
	            Value: dataset[naturalName]
	          };

	          if (entry.vr === "ox") {
	            if (dataset._vrMap && dataset._vrMap[naturalName]) {
	              dataItem.vr = dataset._vrMap[naturalName];
	            } else {
	              lib.error("No value representation given for", naturalName);
	            }
	          }

	          dataItem.Value = DicomMetaDictionary.denaturalizeValue(dataItem.Value);

	          if (entry.vr === "SQ") {
	            var unnaturalValues = [];

	            for (var datasetIndex = 0; datasetIndex < dataItem.Value.length; datasetIndex++) {
	              var nestedDataset = dataItem.Value[datasetIndex];
	              unnaturalValues.push(DicomMetaDictionary.denaturalizeDataset(nestedDataset));
	            }

	            dataItem.Value = unnaturalValues;
	          }

	          var vr = ValueRepresentation.createByTypeString(dataItem.vr);

	          if (!vr.isBinary() && vr.maxLength) {
	            dataItem.Value = dataItem.Value.map(function (value) {
	              if (value.length > vr.maxLength) {
	                lib.warn("Truncating value ".concat(value, " of ").concat(naturalName, " because it is longer than ").concat(vr.maxLength));
	                return value.slice(0, vr.maxLength);
	              } else {
	                return value;
	              }
	            });
	          }

	          var tag = DicomMetaDictionary.unpunctuateTag(entry.tag);
	          unnaturalDataset[tag] = dataItem;
	        } else {
	          var validMetaNames = ["_vrMap", "_meta"];

	          if (validMetaNames.indexOf(name) === -1) {
	            lib.warn("Unknown name in dataset", name, ":", dataset[name]);
	          }
	        }
	      });
	      return unnaturalDataset;
	    }
	  }, {
	    key: "uid",
	    value: function uid() {
	      var uid = "2.25." + Math.floor(1 + Math.random() * 9);

	      for (var index = 0; index < 38; index++) {
	        uid = uid + Math.floor(Math.random() * 10);
	      }

	      return uid;
	    } // date and time in UTC

	  }, {
	    key: "date",
	    value: function date() {
	      var now = new Date();
	      return now.toISOString().replace(/-/g, "").slice(0, 8);
	    }
	  }, {
	    key: "time",
	    value: function time() {
	      var now = new Date();
	      return now.toISOString().replace(/:/g, "").slice(11, 17);
	    }
	  }, {
	    key: "dateTime",
	    value: function dateTime() {
	      // "2017-07-07T16:09:18.079Z" -> "20170707160918.079"
	      var now = new Date();
	      return now.toISOString().replace(/[:\-TZ]/g, "");
	    }
	  }, {
	    key: "_generateNameMap",
	    value: function _generateNameMap() {
	      DicomMetaDictionary.nameMap = {};
	      Object.keys(DicomMetaDictionary.dictionary).forEach(function (tag) {
	        var dict = DicomMetaDictionary.dictionary[tag];

	        if (dict.version !== "PrivateTag") {
	          DicomMetaDictionary.nameMap[dict.name] = dict;
	        }
	      });
	    }
	  }, {
	    key: "_generateUIDMap",
	    value: function _generateUIDMap() {
	      DicomMetaDictionary.sopClassUIDsByName = {};
	      Object.keys(DicomMetaDictionary.sopClassNamesByUID).forEach(function (uid) {
	        var name = DicomMetaDictionary.sopClassNamesByUID[uid];
	        DicomMetaDictionary.sopClassUIDsByName[name] = uid;
	      });
	    }
	  }]);

	  return DicomMetaDictionary;
	}(); // Subset of those listed at:
	// http://dicom.nema.org/medical/dicom/current/output/html/part04.html#sect_B.5


	DicomMetaDictionary.sopClassNamesByUID = {
	  "1.2.840.10008.5.1.4.1.1.2": "CTImage",
	  "1.2.840.10008.5.1.4.1.1.2.1": "EnhancedCTImage",
	  "1.2.840.10008.5.1.4.1.1.2.2": "LegacyConvertedEnhancedCTImage",
	  "1.2.840.10008.5.1.4.1.1.3.1": "USMultiframeImage",
	  "1.2.840.10008.5.1.4.1.1.4": "MRImage",
	  "1.2.840.10008.5.1.4.1.1.4.1": "EnhancedMRImage",
	  "1.2.840.10008.5.1.4.1.1.4.2": "MRSpectroscopy",
	  "1.2.840.10008.5.1.4.1.1.4.3": "EnhancedMRColorImage",
	  "1.2.840.10008.5.1.4.1.1.4.4": "LegacyConvertedEnhancedMRImage",
	  "1.2.840.10008.5.1.4.1.1.6.1": "USImage",
	  "1.2.840.10008.5.1.4.1.1.6.2": "EnhancedUSVolume",
	  "1.2.840.10008.5.1.4.1.1.7": "SecondaryCaptureImage",
	  "1.2.840.10008.5.1.4.1.1.30": "ParametricMapStorage",
	  "1.2.840.10008.5.1.4.1.1.66": "RawData",
	  "1.2.840.10008.5.1.4.1.1.66.1": "SpatialRegistration",
	  "1.2.840.10008.5.1.4.1.1.66.2": "SpatialFiducials",
	  "1.2.840.10008.5.1.4.1.1.66.3": "DeformableSpatialRegistration",
	  "1.2.840.10008.5.1.4.1.1.66.4": "Segmentation",
	  "1.2.840.10008.5.1.4.1.1.67": "RealWorldValueMapping",
	  "1.2.840.10008.5.1.4.1.1.88.11": "BasicTextSR",
	  "1.2.840.10008.5.1.4.1.1.88.22": "EnhancedSR",
	  "1.2.840.10008.5.1.4.1.1.88.33": "ComprehensiveSR",
	  "1.2.840.10008.5.1.4.1.1.128": "PETImage",
	  "1.2.840.10008.5.1.4.1.1.130": "EnhancedPETImage",
	  "1.2.840.10008.5.1.4.1.1.128.1": "LegacyConvertedEnhancedPETImage"
	};
	DicomMetaDictionary.dictionary = dictionary;

	DicomMetaDictionary._generateNameMap();

	DicomMetaDictionary._generateUIDMap();

	var IMPLICIT_LITTLE_ENDIAN$1 = "1.2.840.10008.1.2";
	var EXPLICIT_LITTLE_ENDIAN$1 = "1.2.840.10008.1.2.1";
	var EXPLICIT_BIG_ENDIAN = "1.2.840.10008.1.2.2";
	var singleVRs$1 = ["SQ", "OF", "OW", "OB", "UN", "LT"];
	var encapsulatedSyntaxes = ["1.2.840.10008.1.2.4.50", "1.2.840.10008.1.2.4.51", "1.2.840.10008.1.2.4.57", "1.2.840.10008.1.2.4.70", "1.2.840.10008.1.2.4.80", "1.2.840.10008.1.2.4.81", "1.2.840.10008.1.2.4.90", "1.2.840.10008.1.2.4.91", "1.2.840.10008.1.2.4.92", "1.2.840.10008.1.2.4.93", "1.2.840.10008.1.2.4.94", "1.2.840.10008.1.2.4.95", "1.2.840.10008.1.2.5", "1.2.840.10008.1.2.6.1", "1.2.840.10008.1.2.4.100", "1.2.840.10008.1.2.4.102", "1.2.840.10008.1.2.4.103"];

	var DicomMessage =
	/*#__PURE__*/
	function () {
	  function DicomMessage() {
	    _classCallCheck(this, DicomMessage);
	  }

	  _createClass(DicomMessage, null, [{
	    key: "read",
	    value: function read(bufferStream, syntax, ignoreErrors) {
	      var dict = {};

	      try {
	        while (!bufferStream.end()) {
	          var readInfo = DicomMessage.readTag(bufferStream, syntax);
	          dict[readInfo.tag.toCleanString()] = {
	            vr: readInfo.vr.type,
	            Value: readInfo.values
	          };
	        }

	        return dict;
	      } catch (err) {
	        if (ignoreErrors) {
	          console.warn("WARN:", err);
	          return dict;
	        }

	        throw err;
	      }
	    }
	  }, {
	    key: "_normalizeSyntax",
	    value: function _normalizeSyntax(syntax) {
	      if (syntax === IMPLICIT_LITTLE_ENDIAN$1 || syntax === EXPLICIT_LITTLE_ENDIAN$1 || syntax === EXPLICIT_BIG_ENDIAN) {
	        return syntax;
	      } else {
	        return EXPLICIT_LITTLE_ENDIAN$1;
	      }
	    }
	  }, {
	    key: "isEncapsulated",
	    value: function isEncapsulated(syntax) {
	      return encapsulatedSyntaxes.indexOf(syntax) !== -1;
	    }
	  }, {
	    key: "readFile",
	    value: function readFile(buffer) {
	      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
	        ignoreErrors: false
	      };
	      var ignoreErrors = options.ignoreErrors;
	      var stream = new ReadBufferStream(buffer),
	          useSyntax = EXPLICIT_LITTLE_ENDIAN$1;
	      stream.reset();
	      stream.increment(128);

	      if (stream.readString(4) !== "DICM") {
	        throw new Error("Invalid dicom file");
	      }

	      var el = DicomMessage.readTag(stream, useSyntax),
	          metaLength = el.values[0]; //read header buffer

	      var metaStream = stream.more(metaLength);
	      var metaHeader = DicomMessage.read(metaStream, useSyntax, ignoreErrors); //get the syntax

	      var mainSyntax = metaHeader["00020010"].Value[0];
	      mainSyntax = DicomMessage._normalizeSyntax(mainSyntax);
	      var objects = DicomMessage.read(stream, mainSyntax, ignoreErrors);
	      var dicomDict = new DicomDict(metaHeader);
	      dicomDict.dict = objects;
	      return dicomDict;
	    }
	  }, {
	    key: "writeTagObject",
	    value: function writeTagObject(stream, tagString, vr, values, syntax) {
	      var tag = Tag.fromString(tagString);
	      tag.write(stream, vr, values, syntax);
	    }
	  }, {
	    key: "write",
	    value: function write(jsonObjects, useStream, syntax) {
	      var written = 0;
	      var sortedTags = Object.keys(jsonObjects).sort();
	      sortedTags.forEach(function (tagString) {
	        var tag = Tag.fromString(tagString),
	            tagObject = jsonObjects[tagString],
	            vrType = tagObject.vr,
	            values = tagObject.Value;
	        written += tag.write(useStream, vrType, values, syntax);
	      });
	      return written;
	    }
	  }, {
	    key: "readTag",
	    value: function readTag(stream, syntax) {
	      var implicit = syntax === IMPLICIT_LITTLE_ENDIAN$1,
	          isLittleEndian = syntax === IMPLICIT_LITTLE_ENDIAN$1 || syntax === EXPLICIT_LITTLE_ENDIAN$1;
	      var oldEndian = stream.isLittleEndian;
	      stream.setEndian(isLittleEndian);
	      var group = stream.readUint16(),
	          element = stream.readUint16(),
	          tag = tagFromNumbers(group, element);
	      var length = null,
	          vr = null,
	          vrType;

	      if (implicit) {
	        length = stream.readUint32();
	        var elementData = DicomMessage.lookupTag(tag);

	        if (elementData) {
	          vrType = elementData.vr;
	        } else {
	          //unknown tag
	          if (length === 0xffffffff) {
	            vrType = "SQ";
	          } else if (tag.isPixelDataTag()) {
	            vrType = "OW"; // } else if (vrType === "xs") { // TODO fix unreachable code if necessary
	            //     vrType = "US";
	          } else {
	            vrType = "UN";
	          }
	        }

	        vr = ValueRepresentation.createByTypeString(vrType);
	      } else {
	        vrType = stream.readString(2);
	        vr = ValueRepresentation.createByTypeString(vrType);

	        if (vr.isExplicit()) {
	          stream.increment(2);
	          length = stream.readUint32();
	        } else {
	          length = stream.readUint16();
	        }
	      }

	      var values = [];

	      if (vr.isBinary() && length > vr.maxLength && !vr.noMultiple) {
	        var times = length / vr.maxLength,
	            i = 0;

	        while (i++ < times) {
	          values.push(vr.read(stream, vr.maxLength, syntax));
	        }
	      } else {
	        var val = vr.read(stream, length, syntax);

	        if (!vr.isBinary() && singleVRs$1.indexOf(vr.type) === -1) {
	          values = val.split(String.fromCharCode(0x5c)); // split on backslash
	        } else if (["SQ", "OW", "OB", "UN"].includes(vr.type)) {
	          values = val;
	        } else {
	          values.push(val);
	        }
	      }

	      stream.setEndian(oldEndian);
	      return {
	        tag: tag,
	        vr: vr,
	        values: values
	      };
	    }
	  }, {
	    key: "lookupTag",
	    value: function lookupTag(tag) {
	      return DicomMetaDictionary.dictionary[tag.toString()];
	    }
	  }]);

	  return DicomMessage;
	}();

	var EXPLICIT_LITTLE_ENDIAN$2 = "1.2.840.10008.1.2.1";

	var DicomDict =
	/*#__PURE__*/
	function () {
	  function DicomDict(meta) {
	    _classCallCheck(this, DicomDict);

	    this.meta = meta;
	    this.dict = {};
	  }

	  _createClass(DicomDict, [{
	    key: "upsertTag",
	    value: function upsertTag(tag, vr, values) {
	      if (this.dict[tag]) {
	        this.dict[tag].Value = values;
	      } else {
	        this.dict[tag] = {
	          vr: vr,
	          Value: values
	        };
	      }
	    }
	  }, {
	    key: "write",
	    value: function write() {
	      var metaSyntax = EXPLICIT_LITTLE_ENDIAN$2;
	      var fileStream = new WriteBufferStream(4096, true);
	      fileStream.writeHex("00".repeat(128));
	      fileStream.writeString("DICM");
	      var metaStream = new WriteBufferStream(1024);

	      if (!this.meta["00020010"]) {
	        this.meta["00020010"] = {
	          vr: "UI",
	          Value: [EXPLICIT_LITTLE_ENDIAN$2]
	        };
	      }

	      DicomMessage.write(this.meta, metaStream, metaSyntax);
	      DicomMessage.writeTagObject(fileStream, "00020000", "UL", metaStream.size, metaSyntax);
	      fileStream.concat(metaStream);
	      var useSyntax = this.meta["00020010"].Value[0];
	      DicomMessage.write(this.dict, fileStream, useSyntax);
	      return fileStream.getBuffer();
	    }
	  }]);

	  return DicomDict;
	}();

	var DICOMWEB =
	/*#__PURE__*/
	function () {
	  /*
	  JavaScript DICOMweb REST API for browser use.
	   Design:
	  * map rest api to high-level code with modern conventions
	  ** ES6: classes, arrow functions, let...
	  ** promises
	  ** json converted to objects
	  examples: see tests() method below.
	  */
	  function DICOMWEB() {
	    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

	    _classCallCheck(this, DICOMWEB);

	    this.rootURL = options.rootURL;
	    this.progressCallback = options.progressCallback;
	  }

	  _createClass(DICOMWEB, [{
	    key: "request",
	    value: function request(endpoint) {
	      var parameters = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	      var payload = arguments.length > 2 ? arguments[2] : undefined;
	      var responseType = DICOMWEB.responseType(endpoint);
	      var service = DICOMWEB.endpointService(endpoint);
	      var url = this.rootURL + "/" + service + endpoint;
	      var firstParameter = true;
	      Object.keys(parameters).forEach(function (parameter) {
	        if (firstParameter) {
	          url += "?";
	          firstParameter = false;
	        } else {
	          url += "&";
	        }

	        url += parameter + "=" + encodeURIComponent(parameters[parameter]);
	      });

	      function promiseHandler(resolve, reject) {
	        var request = new XMLHttpRequest();
	        request.open("GET", url);
	        request.responseType = responseType;

	        request.onload = function () {
	          resolve(request.response);
	        };

	        request.onprogress = this.progressCallback;

	        request.onerror = function (error) {
	          lib.error(request.response);
	          reject(error);
	        };

	        request.send(payload);
	      }

	      var promise = new Promise(promiseHandler.bind(this));
	      return promise;
	    }
	  }, {
	    key: "patients",
	    value: function patients() {
	      return this.request("patients");
	    }
	  }, {
	    key: "studies",
	    value: function studies(patientID) {
	      return this.request("studies", {
	        PatientID: patientID
	      });
	    }
	  }, {
	    key: "series",
	    value: function series(studyInstanceUID) {
	      return this.request("series", {
	        StudyInstanceUID: studyInstanceUID
	      });
	    }
	  }, {
	    key: "instances",
	    value: function instances(studyInstanceUID, seriesInstanceUID) {
	      return this.request("instances", {
	        StudyInstanceUID: studyInstanceUID,
	        SeriesInstanceUID: seriesInstanceUID
	      });
	    }
	  }, {
	    key: "instance",
	    value: function instance(studyInstanceUID, seriesInstanceUID, sopInstanceUID) {
	      return this.request("wado", {
	        requestType: "WADO",
	        studyUID: studyInstanceUID,
	        seriesUID: seriesInstanceUID,
	        objectUID: sopInstanceUID,
	        contentType: "application/dicom"
	      });
	    }
	  }, {
	    key: "tests",
	    value: function tests() {
	      var testingServerURL = "http://quantome.org:4242/dcm4chee-arc/aets/DCM4CHEE";
	      var testOptions = {
	        rootURL: testingServerURL
	      };
	      new DICOMWEB(testOptions).patients().then(function (responses) {
	        responses.forEach(function (patient) {
	          lib.log(patient);
	        });
	      });
	    }
	  }], [{
	    key: "responseType",
	    value: function responseType(endpoint) {
	      var types = {
	        wado: "arraybuffer"
	      };
	      return types[endpoint] ? types[endpoint] : "json";
	    } // which URL service to use for each of the high level services

	  }, {
	    key: "endpointService",
	    value: function endpointService(endpoint) {
	      var services = {
	        wado: ""
	      };
	      return Object.keys(services).indexOf(endpoint) != -1 ? services[endpoint] : "rs/";
	    }
	  }, {
	    key: "randomEntry",
	    value: function randomEntry(array) {
	      return array[Math.floor(Math.random() * array.length)];
	    }
	  }]);

	  return DICOMWEB;
	}();

	//
	// Handle DICOM and CIELAB colors
	// based on:
	// https://github.com/michaelonken/dcmtk/blob/3c68f0e882e22e6d9e2a42f836332c0ca21b3e7f/dcmiod/libsrc/cielabutil.cc
	//
	// RGB here refers to sRGB 0-1 per component.
	// dicomlab is CIELAB values as defined in the dicom standard
	// XYZ is CIEXYZ convention
	//
	// TODO: needs a test suite
	// TODO: only dicomlab2RGB tested on real data
	//
	//
	var Colors =
	/*#__PURE__*/
	function () {
	  function Colors() {
	    _classCallCheck(this, Colors);
	  }

	  _createClass(Colors, null, [{
	    key: "d65WhitePointXYZ",
	    value: function d65WhitePointXYZ() {
	      // white points of D65 light point (CIELAB standard white point)
	      return [0.950456, 1.0, 1.088754];
	    }
	  }, {
	    key: "dicomlab2RGB",
	    value: function dicomlab2RGB(dicomlab) {
	      return Colors.lab2RGB(Colors.dicomlab2LAB(dicomlab));
	    }
	  }, {
	    key: "rgb2DICOMLAB",
	    value: function rgb2DICOMLAB(rgb) {
	      return Colors.lab2DICOMLAB(Colors.rgb2LAB(rgb));
	    }
	  }, {
	    key: "dicomlab2LAB",
	    value: function dicomlab2LAB(dicomlab) {
	      return [dicomlab[0] * 100.0 / 65535.0, // results in 0 <= L <= 100
	      dicomlab[1] * 255.0 / 65535.0 - 128, // results in -128 <= a <= 127
	      dicomlab[2] * 255.0 / 65535.0 - 128 // results in -128 <= b <= 127
	      ];
	    }
	  }, {
	    key: "lab2DICOMLAB",
	    value: function lab2DICOMLAB(lab) {
	      return [lab[0] * 65535.0 / 100.0, // results in 0 <= L <= 65535
	      (lab[1] + 128) * 65535.0 / 255.0, // results in 0 <= a <= 65535
	      (lab[2] + 128) * 65535.0 / 255.0 // results in 0 <= b <= 65535
	      ];
	    }
	  }, {
	    key: "rgb2LAB",
	    value: function rgb2LAB(rgb) {
	      return Colors.xyz2LAB(Colors.rgb2XYZ(rgb));
	    }
	  }, {
	    key: "gammaCorrection",
	    value: function gammaCorrection(n) {
	      if (n <= 0.0031306684425005883) {
	        return 12.92 * n;
	      } else {
	        return 1.055 * Math.pow(n, 0.416666666666666667) - 0.055;
	      }
	    }
	  }, {
	    key: "invGammaCorrection",
	    value: function invGammaCorrection(n) {
	      if (n <= 0.0404482362771076) {
	        return n / 12.92;
	      } else {
	        return Math.pow((n + 0.055) / 1.055, 2.4);
	      }
	    }
	  }, {
	    key: "rgb2XYZ",
	    value: function rgb2XYZ(rgb) {
	      var R = Colors.invGammaCorrection(rgb[0]);
	      var G = Colors.invGammaCorrection(rgb[1]);
	      var B = Colors.invGammaCorrection(rgb[2]);
	      return [0.4123955889674142161 * R + 0.3575834307637148171 * G + 0.1804926473817015735 * B, 0.2125862307855955516 * R + 0.7151703037034108499 * G + 0.07220049864333622685 * B, 0.01929721549174694484 * R + 0.1191838645808485318 * G + 0.950497125131579766 * B];
	    }
	  }, {
	    key: "xyz2LAB",
	    value: function xyz2LAB(xyz) {
	      var whitePoint = Colors.d65WhitePointXYZ();
	      var X = xyz[0] / whitePoint[0];
	      var Y = xyz[1] / whitePoint[1];
	      var Z = xyz[2] / whitePoint[2];
	      X = Colors.labf(X);
	      Y = Colors.labf(Y);
	      Z = Colors.labf(Z);
	      return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
	    }
	  }, {
	    key: "lab2RGB",
	    value: function lab2RGB(lab) {
	      return Colors.xyz2RGB(Colors.lab2XYZ(lab));
	    }
	  }, {
	    key: "lab2XYZ",
	    value: function lab2XYZ(lab) {
	      var L = (lab[0] + 16) / 116;
	      var a = L + lab[1] / 500;
	      var b = L - lab[2] / 200;
	      var whitePoint = Colors.d65WhitePointXYZ();
	      return [whitePoint[0] * Colors.labfInv(a), whitePoint[1] * Colors.labfInv(L), whitePoint[2] * Colors.labfInv(b)];
	    }
	  }, {
	    key: "xyz2RGB",
	    value: function xyz2RGB(xyz) {
	      var R1 = 3.2406 * xyz[0] - 1.5372 * xyz[1] - 0.4986 * xyz[2];
	      var G1 = -0.9689 * xyz[0] + 1.8758 * xyz[1] + 0.0415 * xyz[2];
	      var B1 = 0.0557 * xyz[0] - 0.204 * xyz[1] + 1.057 * xyz[2];
	      /* Force nonnegative values so that gamma correction is well-defined. */

	      var minimumComponent = Math.min(R1, G1);
	      minimumComponent = Math.min(minimumComponent, B1);

	      if (minimumComponent < 0) {
	        R1 -= minimumComponent;
	        G1 -= minimumComponent;
	        B1 -= minimumComponent;
	      }
	      /* Transform from RGB to R'G'B' */


	      return [Colors.gammaCorrection(R1), Colors.gammaCorrection(G1), Colors.gammaCorrection(B1)];
	    }
	  }, {
	    key: "labf",
	    value: function labf(n) {
	      if (n >= 8.85645167903563082e-3) {
	        return Math.pow(n, 0.333333333333333);
	      } else {
	        return 841.0 / 108.0 * n + 4.0 / 29.0;
	      }
	    }
	  }, {
	    key: "labfInv",
	    value: function labfInv(n) {
	      if (n >= 0.206896551724137931) {
	        return n * n * n;
	      } else {
	        return 108.0 / 841.0 * (n - 4.0 / 29.0);
	      }
	    }
	  }]);

	  return Colors;
	}();

	function datasetToDict(dataset) {
	  var meta = {
	    FileMetaInformationVersion: dataset._meta.FileMetaInformationVersion.Value,
	    MediaStorageSOPClassUID: dataset.SOPClassUID,
	    MediaStorageSOPInstanceUID: dataset.SOPInstanceUID,
	    TransferSyntaxUID: "1.2.840.10008.1.2",
	    ImplementationClassUID: DicomMetaDictionary.uid(),
	    ImplementationVersionName: "dcmjs-0.0"
	  }; // TODO: Clean this up later

	  if (!meta.FileMetaInformationVersion) {
	    meta.FileMetaInformationVersion = dataset._meta.FileMetaInformationVersion.Value[0];
	  }

	  var denaturalized = DicomMetaDictionary.denaturalizeDataset(meta);
	  var dicomDict = new DicomDict(denaturalized);
	  dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(dataset);
	  return dicomDict;
	}

	function datasetToBuffer(dataset) {
	  return Buffer.from(datasetToDict(dataset).write());
	}

	function datasetToBlob(dataset) {
	  var buffer = datasetToBuffer(dataset);
	  return new Blob([buffer], {
	    type: "application/dicom"
	  });
	}

	var DerivedDataset =
	/*#__PURE__*/
	function () {
	  function DerivedDataset(datasets) {
	    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	    _classCallCheck(this, DerivedDataset);

	    this.options = JSON.parse(JSON.stringify(options));
	    var o = this.options;
	    o.Manufacturer = options.Manufacturer || "Unspecified";
	    o.ManufacturerModelName = options.ManufacturerModelName || "Unspecified";
	    o.SeriesDescription = options.SeriesDescription || "Research Derived series";
	    o.SeriesNumber = options.SeriesNumber || "99";
	    o.SoftwareVersions = options.SoftwareVersions || "0";
	    o.DeviceSerialNumber = options.DeviceSerialNumber || "1";
	    var date = DicomMetaDictionary.date();
	    var time = DicomMetaDictionary.time();
	    o.SeriesDate = options.SeriesDate || date;
	    o.SeriesTime = options.SeriesTime || time;
	    o.ContentDate = options.ContentDate || date;
	    o.ContentTime = options.ContentTime || time;
	    o.SOPInstanceUID = options.SOPInstanceUID || DicomMetaDictionary.uid();
	    o.SeriesInstanceUID = options.SeriesInstanceUID || DicomMetaDictionary.uid();
	    o.ClinicalTrialTimePointID = options.ClinicalTrialTimePointID || "";
	    o.ClinicalTrialCoordinatingCenterName = options.ClinicalTrialCoordinatingCenterName || "";
	    o.ClinicalTrialSeriesID = options.ClinicalTrialSeriesID || "";
	    o.ImageComments = options.ImageComments || "NOT FOR CLINICAL USE";
	    o.ContentQualification = "RESEARCH";
	    this.referencedDatasets = datasets; // list of one or more dicom-like object instances

	    this.referencedDataset = this.referencedDatasets[0];
	    this.dataset = {
	      _vrMap: this.referencedDataset._vrMap,
	      _meta: this.referencedDataset._meta
	    };
	    this.derive();
	  }

	  _createClass(DerivedDataset, [{
	    key: "assignToDataset",
	    value: function assignToDataset(data) {
	      var _this = this;

	      Object.keys(data).forEach(function (key) {
	        return _this.dataset[key] = data[key];
	      });
	    }
	  }, {
	    key: "assignFromReference",
	    value: function assignFromReference(tags) {
	      var _this2 = this;

	      tags.forEach(function (tag) {
	        return _this2.dataset[tag] = _this2.referencedDataset[tag] || "";
	      });
	    }
	  }, {
	    key: "assignFromOptions",
	    value: function assignFromOptions(tags) {
	      var _this3 = this;

	      tags.forEach(function (tag) {
	        return _this3.dataset[tag] = _this3.options[tag] || "";
	      });
	    }
	  }, {
	    key: "derive",
	    value: function derive() {
	      // common for all instances in study
	      this.assignFromReference(["AccessionNumber", "ReferringPhysicianName", "StudyDate", "StudyID", "StudyTime", "PatientName", "PatientID", "PatientBirthDate", "PatientSex", "PatientAge", "StudyInstanceUID", "StudyID"]);
	      this.assignFromOptions(["Manufacturer", "SoftwareVersions", "DeviceSerialNumber", "ManufacturerModelName", "SeriesDescription", "SeriesNumber", "ImageComments", "SeriesDate", "SeriesTime", "ContentDate", "ContentTime", "ContentQualification", "SOPInstanceUID", "SeriesInstanceUID"]);
	    }
	  }], [{
	    key: "copyDataset",
	    value: function copyDataset(dataset) {
	      // copies everything but the buffers
	      return JSON.parse(JSON.stringify(dataset));
	    }
	  }]);

	  return DerivedDataset;
	}();

	var DerivedPixels =
	/*#__PURE__*/
	function (_DerivedDataset) {
	  _inherits(DerivedPixels, _DerivedDataset);

	  function DerivedPixels(datasets) {
	    var _this;

	    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	    _classCallCheck(this, DerivedPixels);

	    _this = _possibleConstructorReturn(this, _getPrototypeOf(DerivedPixels).call(this, datasets, options));
	    var o = _this.options;
	    o.ContentLabel = options.ContentLabel || "";
	    o.ContentDescription = options.ContentDescription || "";
	    o.ContentCreatorName = options.ContentCreatorName || "";
	    return _this;
	  } // this assumes a normalized multiframe input and will create
	  // a multiframe derived image


	  _createClass(DerivedPixels, [{
	    key: "derive",
	    value: function derive() {
	      _get(_getPrototypeOf(DerivedPixels.prototype), "derive", this).call(this);

	      this.assignToDataset({
	        ImageType: ["DERIVED", "PRIMARY"],
	        LossyImageCompression: "00",
	        InstanceNumber: "1"
	      });
	      this.assignFromReference(["SOPClassUID", "Modality", "FrameOfReferenceUID", "PositionReferenceIndicator", "NumberOfFrames", "Rows", "Columns", "SamplesPerPixel", "PhotometricInterpretation", "BitsStored", "HighBit"]);
	      this.assignFromOptions(["ContentLabel", "ContentDescription", "ContentCreatorName"]); //
	      // TODO: more carefully copy only PixelMeasures and related
	      // TODO: add derivation references
	      //

	      if (this.referencedDataset.SharedFunctionalGroupsSequence) {
	        this.dataset.SharedFunctionalGroupsSequence = DerivedDataset.copyDataset(this.referencedDataset.SharedFunctionalGroupsSequence);
	      }

	      if (this.referencedDataset.PerFrameFunctionalGroupsSequence) {
	        this.dataset.PerFrameFunctionalGroupsSequence = DerivedDataset.copyDataset(this.referencedDataset.PerFrameFunctionalGroupsSequence);
	      } // make an array of zeros for the pixels


	      this.dataset.PixelData = new ArrayBuffer(this.referencedDataset.PixelData.byteLength);
	    }
	  }]);

	  return DerivedPixels;
	}(DerivedDataset);

	var DerivedImage =
	/*#__PURE__*/
	function (_DerivedPixels) {
	  _inherits(DerivedImage, _DerivedPixels);

	  function DerivedImage(datasets) {
	    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	    _classCallCheck(this, DerivedImage);

	    return _possibleConstructorReturn(this, _getPrototypeOf(DerivedImage).call(this, datasets, options));
	  }

	  _createClass(DerivedImage, [{
	    key: "derive",
	    value: function derive() {
	      _get(_getPrototypeOf(DerivedImage.prototype), "derive", this).call(this);

	      this.assignFromReference(["WindowCenter", "WindowWidth", "BitsAllocated", "PixelRepresentation", "BodyPartExamined", "Laterality", "PatientPosition", "RescaleSlope", "RescaleIntercept", "PixelPresentation", "VolumetricProperties", "VolumeBasedCalculationTechnique", "PresentationLUTShape"]);
	    }
	  }]);

	  return DerivedImage;
	}(DerivedPixels);

	var Normalizer =
	/*#__PURE__*/
	function () {
	  function Normalizer(datasets) {
	    _classCallCheck(this, Normalizer);

	    this.datasets = datasets; // one or more dicom-like object instances

	    this.dataset = undefined; // a normalized multiframe dicom object instance
	  }

	  _createClass(Normalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      return "No normalization defined";
	    }
	  }], [{
	    key: "consistentSOPClassUIDs",
	    value: function consistentSOPClassUIDs(datasets) {
	      // return sopClassUID if all exist and match, otherwise undefined
	      var sopClassUID;
	      datasets.forEach(function (dataset) {
	        if (!dataset.SOPClassUID) {
	          return undefined;
	        }

	        if (!sopClassUID) {
	          sopClassUID = dataset.SOPClassUID;
	        }

	        if (dataset.SOPClassUID !== sopClassUID) {
	          lib.error("inconsistent sopClassUIDs: ", dataset.SOPClassUID, sopClassUID);
	          return undefined;
	        }
	      });
	      return sopClassUID;
	    }
	  }, {
	    key: "normalizerForSOPClassUID",
	    value: function normalizerForSOPClassUID(sopClassUID) {
	      sopClassUID = sopClassUID.replace(/[^0-9.]/g, ""); // TODO: clean all VRs as part of normalizing

	      var toUID = DicomMetaDictionary.sopClassUIDsByName;
	      var sopClassUIDMap = {};
	      sopClassUIDMap[toUID.CTImage] = CTImageNormalizer;
	      sopClassUIDMap[toUID.ParametricMapStorage] = PMImageNormalizer;
	      sopClassUIDMap[toUID.MRImage] = MRImageNormalizer;
	      sopClassUIDMap[toUID.EnhancedCTImage] = EnhancedCTImageNormalizer;
	      sopClassUIDMap[toUID.LegacyConvertedEnhancedCTImage] = EnhancedCTImageNormalizer;
	      sopClassUIDMap[toUID.EnhancedMRImage] = EnhancedMRImageNormalizer;
	      sopClassUIDMap[toUID.LegacyConvertedEnhancedMRImage] = EnhancedMRImageNormalizer;
	      sopClassUIDMap[toUID.EnhancedUSVolume] = EnhancedUSVolumeNormalizer;
	      sopClassUIDMap[toUID.PETImage] = PETImageNormalizer;
	      sopClassUIDMap[toUID.EnhancedPETImage] = PETImageNormalizer;
	      sopClassUIDMap[toUID.LegacyConvertedEnhancedPETImage] = PETImageNormalizer;
	      sopClassUIDMap[toUID.Segmentation] = SEGImageNormalizer;
	      sopClassUIDMap[toUID.DeformableSpatialRegistration] = DSRNormalizer;
	      return sopClassUIDMap[sopClassUID];
	    }
	  }, {
	    key: "isMultiframeSOPClassUID",
	    value: function isMultiframeSOPClassUID(sopClassUID) {
	      var toUID = DicomMetaDictionary.sopClassUIDsByName;
	      var multiframeSOPClasses = [toUID.EnhancedMRImage, toUID.LegacyConvertedEnhancedMRImage, toUID.EnhancedCTImage, toUID.LegacyConvertedEnhancedCTImage, toUID.EnhancedUSVolume, toUID.EnhancedPETImage, toUID.LegacyConvertedEnhancedPETImage, toUID.Segmentation, toUID.ParametricMapStorage];
	      return multiframeSOPClasses.indexOf(sopClassUID) !== -1;
	    }
	  }, {
	    key: "isMultiframeDataset",
	    value: function isMultiframeDataset() {
	      var ds = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.dataset;
	      var sopClassUID = ds.SOPClassUID.replace(/[^0-9.]/g, ""); // TODO: clean all VRs as part of normalizing

	      return Normalizer.isMultiframeSOPClassUID(sopClassUID);
	    }
	  }, {
	    key: "normalizeToDataset",
	    value: function normalizeToDataset(datasets) {
	      var sopClassUID = Normalizer.consistentSOPClassUIDs(datasets);
	      var normalizerClass = Normalizer.normalizerForSOPClassUID(sopClassUID);

	      if (!normalizerClass) {
	        lib.error("no normalizerClass for ", sopClassUID);
	        return undefined;
	      }

	      var normalizer = new normalizerClass(datasets);
	      normalizer.normalize();
	      return normalizer.dataset;
	    }
	  }]);

	  return Normalizer;
	}();

	var ImageNormalizer =
	/*#__PURE__*/
	function (_Normalizer) {
	  _inherits(ImageNormalizer, _Normalizer);

	  function ImageNormalizer() {
	    _classCallCheck(this, ImageNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(ImageNormalizer).apply(this, arguments));
	  }

	  _createClass(ImageNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      this.convertToMultiframe();
	      this.normalizeMultiframe();
	    }
	  }, {
	    key: "convertToMultiframe",
	    value: function convertToMultiframe() {
	      if (this.datasets.length === 1 && Normalizer.isMultiframeDataset(this.datasets[0])) {
	        // already a multiframe, so just use it
	        this.dataset = this.datasets[0];
	        return;
	      }

	      this.derivation = new DerivedImage(this.datasets);
	      this.dataset = this.derivation.dataset;
	      var ds = this.dataset; // create a new multiframe from the source datasets
	      // fill in only those elements required to make a valid image
	      // for volumetric processing

	      var referenceDataset = this.datasets[0];
	      ds.NumberOfFrames = this.datasets.length; // TODO: develop sets of elements to copy over in loops

	      ds.SOPClassUID = referenceDataset.SOPClassUID;
	      ds.Rows = referenceDataset.Rows;
	      ds.Columns = referenceDataset.Columns;
	      ds.BitsAllocated = referenceDataset.BitsAllocated;
	      ds.PixelRepresentation = referenceDataset.PixelRepresentation;
	      ds.RescaleSlope = referenceDataset.RescaleSlope || "1";
	      ds.RescaleIntercept = referenceDataset.RescaleIntercept || "0"; //ds.BurnedInAnnotation = referenceDataset.BurnedInAnnotation || "YES";
	      // sort
	      // https://github.com/pieper/Slicer3/blob/master/Base/GUI/Tcl/LoadVolume.tcl
	      // TODO: add spacing checks:
	      // https://github.com/Slicer/Slicer/blob/master/Modules/Scripted/DICOMPlugins/DICOMScalarVolumePlugin.py#L228-L250
	      // TODO: put this information into the Shared and PerFrame functional groups
	      // TODO: sorting of frames could happen in normalizeMultiframe instead, since other
	      // multiframe converters may not sort the images
	      // TODO: sorting can be seen as part of generation of the Dimension Multiframe Dimension Module
	      // and should really be done in an acquisition-specific way (e.g. for DCE)

	      var referencePosition = referenceDataset.ImagePositionPatient;
	      var rowVector = referenceDataset.ImageOrientationPatient.slice(0, 3);
	      var columnVector = referenceDataset.ImageOrientationPatient.slice(3, 6);
	      var scanAxis = ImageNormalizer.vec3CrossProduct(rowVector, columnVector);
	      var distanceDatasetPairs = [];
	      this.datasets.forEach(function (dataset) {
	        var position = dataset.ImagePositionPatient.slice();
	        var positionVector = ImageNormalizer.vec3Subtract(position, referencePosition);
	        var distance = ImageNormalizer.vec3Dot(positionVector, scanAxis);
	        distanceDatasetPairs.push([distance, dataset]);
	      });
	      distanceDatasetPairs.sort(function (a, b) {
	        return b[0] - a[0];
	      }); // assign array buffers

	      if (ds.BitsAllocated !== 16) {
	        lib.error("Only works with 16 bit data, not " + String(this.dataset.BitsAllocated));
	      }

	      if (referenceDataset._vrMap && !referenceDataset._vrMap.PixelData) {
	        lib.warn("No vr map given for pixel data, using OW");
	        ds._vrMap = {
	          PixelData: "OW"
	        };
	      } else {
	        ds._vrMap = {
	          PixelData: referenceDataset._vrMap.PixelData
	        };
	      }

	      var frameSize = referenceDataset.PixelData.byteLength;
	      ds.PixelData = new ArrayBuffer(ds.NumberOfFrames * frameSize);
	      var frame = 0;
	      distanceDatasetPairs.forEach(function (pair) {
	        var dataset = pair[1];
	        var pixels = new Uint16Array(dataset.PixelData);
	        var frameView = new Uint16Array(ds.PixelData, frame * frameSize, frameSize / 2);

	        try {
	          frameView.set(pixels);
	        } catch (e) {
	          if (e instanceof RangeError) {
	            lib.error("Error inserting pixels in PixelData");
	            lib.error("frameSize", frameSize);
	            lib.error("NumberOfFrames", ds.NumberOfFrames);
	            lib.error("pair", pair);
	            lib.error("dataset PixelData size", dataset.PixelData.length);
	          }
	        }

	        frame++;
	      });

	      if (ds.NumberOfFrames < 2) {
	        // TODO
	        lib.error("Cannot populate shared groups uniquely without multiple frames");
	      }

	      var _distanceDatasetPairs = _slicedToArray(distanceDatasetPairs[0], 2),
	          distance0 = _distanceDatasetPairs[0],
	          dataset0 = _distanceDatasetPairs[1];

	      var distance1 = distanceDatasetPairs[1][0]; //
	      // make the functional groups
	      //
	      // shared

	      var SpacingBetweenSlices = Math.abs(distance1 - distance0);
	      ds.SharedFunctionalGroupsSequence = {
	        PlaneOrientationSequence: {
	          ImageOrientationPatient: dataset0.ImageOrientationPatient
	        },
	        PixelMeasuresSequence: {
	          PixelSpacing: dataset0.PixelSpacing,
	          SpacingBetweenSlices: SpacingBetweenSlices,
	          SliceThickness: SpacingBetweenSlices
	        }
	      };
	      ds.ReferencedSeriesSequence = {
	        SeriesInstanceUID: dataset0.SeriesInstanceUID,
	        ReferencedInstanceSequence: []
	      }; // per-frame

	      ds.PerFrameFunctionalGroupsSequence = []; // copy over each datasets window/level into the per-frame groups
	      // and set the referenced series uid

	      this.datasets.forEach(function (dataset, datasetIndex) {
	        ds.PerFrameFunctionalGroupsSequence.push({
	          PlanePositionSequence: {
	            ImagePositionPatient: distanceDatasetPairs[datasetIndex][1].ImagePositionPatient
	          },
	          FrameVOILUTSequence: {
	            WindowCenter: dataset.WindowCenter,
	            WindowWidth: dataset.WindowWidth
	          }
	        });
	        ds.ReferencedSeriesSequence.ReferencedInstanceSequence.push({
	          ReferencedSOPClassUID: dataset.SOPClassUID,
	          ReferencedSOPInstanceUID: dataset.SOPInstanceUID
	        });
	      });
	      var dimensionUID = DicomMetaDictionary.uid();
	      this.dataset.DimensionOrganizationSequence = {
	        DimensionOrganizationUID: dimensionUID
	      };
	      this.dataset.DimensionIndexSequence = [{
	        DimensionOrganizationUID: dimensionUID,
	        DimensionIndexPointer: 2097202,
	        FunctionalGroupPointer: 2134291,
	        // PlanePositionSequence
	        DimensionDescriptionLabel: "ImagePositionPatient"
	      }];
	    }
	  }, {
	    key: "normalizeMultiframe",
	    value: function normalizeMultiframe() {
	      var ds = this.dataset;

	      if (!ds.NumberOfFrames) {
	        lib.error("Missing number or frames not supported");
	        return;
	      }

	      if (Number(ds.NumberOfFrames) === 1) {
	        lib.error("Single frame instance of multiframe class not supported");
	        return;
	      }

	      if (!ds.PixelRepresentation) {
	        // Required tag: guess signed
	        ds.PixelRepresentation = 1;
	      }

	      if (!ds.StudyID || ds.StudyID === "") {
	        // Required tag: fill in if needed
	        ds.StudyID = "No Study ID";
	      }

	      var validLateralities = ["R", "L"];

	      if (validLateralities.indexOf(ds.Laterality) === -1) {
	        delete ds.Laterality;
	      }

	      if (!ds.PresentationLUTShape) {
	        ds.PresentationLUTShape = "IDENTITY";
	      }

	      if (!ds.SharedFunctionalGroupsSequence) {
	        lib.error("Can only process multiframe data with SharedFunctionalGroupsSequence");
	      } // TODO: special case!


	      if (ds.BodyPartExamined === "PROSTATE") {
	        ds.SharedFunctionalGroupsSequence.FrameAnatomySequence = {
	          AnatomicRegionSequence: {
	            CodeValue: "T-9200B",
	            CodingSchemeDesignator: "SRT",
	            CodeMeaning: "Prostate"
	          },
	          FrameLaterality: "U"
	        };
	      }

	      var rescaleIntercept = ds.RescaleIntercept || 0;
	      var rescaleSlope = ds.RescaleSlope || 1;
	      ds.SharedFunctionalGroupsSequence.PixelValueTransformationSequence = {
	        RescaleIntercept: rescaleIntercept,
	        RescaleSlope: rescaleSlope,
	        RescaleType: "US"
	      };
	      var frameNumber = 1;
	      this.datasets.forEach(function (dataset) {
	        ds.PerFrameFunctionalGroupsSequence[frameNumber - 1].FrameContentSequence = {
	          FrameAcquisitionDuration: 0,
	          StackID: 1,
	          InStackPositionNumber: frameNumber,
	          DimensionIndexValues: frameNumber
	        };
	        var frameTime = dataset.AcquisitionDate + dataset.AcquisitionTime;

	        if (!isNaN(frameTime)) {
	          var frameContentSequence = ds.PerFrameFunctionalGroupsSequence[frameNumber - 1].FrameContentSequence;
	          frameContentSequence.FrameAcquisitionDateTime = frameTime;
	          frameContentSequence.FrameReferenceDateTime = frameTime;
	        }

	        frameNumber++;
	      }); //
	      // TODO: convert this to shared functional group not top level element
	      //

	      if (ds.WindowCenter && ds.WindowWidth) {
	        // if they exist as single values, make them lists for consistency
	        if (!Array.isArray(ds.WindowCenter)) {
	          ds.WindowCenter = [ds.WindowCenter];
	        }

	        if (!Array.isArray(ds.WindowWidth)) {
	          ds.WindowWidth = [ds.WindowWidth];
	        }
	      }

	      if (!ds.WindowCenter || !ds.WindowWidth) {
	        // if they don't exist, make them empty lists and try to initialize them
	        ds.WindowCenter = []; // both must exist and be the same length

	        ds.WindowWidth = []; // provide a volume-level window/level guess (mean of per-frame)

	        if (ds.PerFrameFunctionalGroupsSequence) {
	          var wcww = {
	            center: 0,
	            width: 0,
	            count: 0
	          };
	          ds.PerFrameFunctionalGroupsSequence.forEach(function (functionalGroup) {
	            if (functionalGroup.FrameVOILUT) {
	              var wc = functionalGroup.FrameVOILUTSequence.WindowCenter;
	              var ww = functionalGroup.FrameVOILUTSequence.WindowWidth;

	              if (functionalGroup.FrameVOILUTSequence && wc && ww) {
	                if (Array.isArray(wc)) {
	                  wc = wc[0];
	                }

	                if (Array.isArray(ww)) {
	                  ww = ww[0];
	                }

	                wcww.center += Number(wc);
	                wcww.width += Number(ww);
	                wcww.count++;
	              }
	            }
	          });

	          if (wcww.count > 0) {
	            ds.WindowCenter.push(String(wcww.center / wcww.count));
	            ds.WindowWidth.push(String(wcww.width / wcww.count));
	          }
	        }
	      } // last gasp, pick an arbitrary default


	      if (ds.WindowCenter.length === 0) {
	        ds.WindowCenter = [300];
	      }

	      if (ds.WindowWidth.length === 0) {
	        ds.WindowWidth = [500];
	      }
	    }
	  }], [{
	    key: "vec3CrossProduct",
	    value: function vec3CrossProduct(a, b) {
	      var ax = a[0],
	          ay = a[1],
	          az = a[2],
	          bx = b[0],
	          by = b[1],
	          bz = b[2];
	      var out = [];
	      out[0] = ay * bz - az * by;
	      out[1] = az * bx - ax * bz;
	      out[2] = ax * by - ay * bx;
	      return out;
	    }
	  }, {
	    key: "vec3Subtract",
	    value: function vec3Subtract(a, b) {
	      var out = [];
	      out[0] = a[0] - b[0];
	      out[1] = a[1] - b[1];
	      out[2] = a[2] - b[2];
	      return out;
	    }
	  }, {
	    key: "vec3Dot",
	    value: function vec3Dot(a, b) {
	      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	    }
	  }]);

	  return ImageNormalizer;
	}(Normalizer);

	var MRImageNormalizer =
	/*#__PURE__*/
	function (_ImageNormalizer) {
	  _inherits(MRImageNormalizer, _ImageNormalizer);

	  function MRImageNormalizer() {
	    _classCallCheck(this, MRImageNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(MRImageNormalizer).apply(this, arguments));
	  }

	  _createClass(MRImageNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      _get(_getPrototypeOf(MRImageNormalizer.prototype), "normalize", this).call(this); // TODO: make specialization for LegacyConverted vs normal EnhanceMRImage
	      //let toUID = DicomMetaDictionary.sopClassUIDsByName;


	      this.dataset.SOPClassUID = "LegacyConvertedEnhancedMRImage"; //this.dataset.SOPClassUID = toUID.EnhancedMRImage;
	    }
	  }, {
	    key: "normalizeMultiframe",
	    value: function normalizeMultiframe() {
	      _get(_getPrototypeOf(MRImageNormalizer.prototype), "normalizeMultiframe", this).call(this);

	      var ds = this.dataset;

	      if (!ds.ImageType || !ds.ImageType.constructor || ds.ImageType.constructor.name != "Array" || ds.ImageType.length != 4) {
	        ds.ImageType = ["ORIGINAL", "PRIMARY", "OTHER", "NONE"];
	      }

	      ds.SharedFunctionalGroupsSequence.MRImageFrameType = {
	        FrameType: ds.ImageType,
	        PixelPresentation: "MONOCHROME",
	        VolumetricProperties: "VOLUME",
	        VolumeBasedCalculationTechnique: "NONE",
	        ComplexImageComponent: "MAGNITUDE",
	        AcquisitionContrast: "UNKNOWN"
	      };
	    }
	  }]);

	  return MRImageNormalizer;
	}(ImageNormalizer);

	var EnhancedCTImageNormalizer =
	/*#__PURE__*/
	function (_ImageNormalizer2) {
	  _inherits(EnhancedCTImageNormalizer, _ImageNormalizer2);

	  function EnhancedCTImageNormalizer() {
	    _classCallCheck(this, EnhancedCTImageNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(EnhancedCTImageNormalizer).apply(this, arguments));
	  }

	  _createClass(EnhancedCTImageNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      _get(_getPrototypeOf(EnhancedCTImageNormalizer.prototype), "normalize", this).call(this);
	    }
	  }]);

	  return EnhancedCTImageNormalizer;
	}(ImageNormalizer);

	var EnhancedMRImageNormalizer =
	/*#__PURE__*/
	function (_ImageNormalizer3) {
	  _inherits(EnhancedMRImageNormalizer, _ImageNormalizer3);

	  function EnhancedMRImageNormalizer() {
	    _classCallCheck(this, EnhancedMRImageNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(EnhancedMRImageNormalizer).apply(this, arguments));
	  }

	  _createClass(EnhancedMRImageNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      _get(_getPrototypeOf(EnhancedMRImageNormalizer.prototype), "normalize", this).call(this);
	    }
	  }]);

	  return EnhancedMRImageNormalizer;
	}(ImageNormalizer);

	var EnhancedUSVolumeNormalizer =
	/*#__PURE__*/
	function (_ImageNormalizer4) {
	  _inherits(EnhancedUSVolumeNormalizer, _ImageNormalizer4);

	  function EnhancedUSVolumeNormalizer() {
	    _classCallCheck(this, EnhancedUSVolumeNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(EnhancedUSVolumeNormalizer).apply(this, arguments));
	  }

	  _createClass(EnhancedUSVolumeNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      _get(_getPrototypeOf(EnhancedUSVolumeNormalizer.prototype), "normalize", this).call(this);
	    }
	  }]);

	  return EnhancedUSVolumeNormalizer;
	}(ImageNormalizer);

	var CTImageNormalizer =
	/*#__PURE__*/
	function (_ImageNormalizer5) {
	  _inherits(CTImageNormalizer, _ImageNormalizer5);

	  function CTImageNormalizer() {
	    _classCallCheck(this, CTImageNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(CTImageNormalizer).apply(this, arguments));
	  }

	  _createClass(CTImageNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      _get(_getPrototypeOf(CTImageNormalizer.prototype), "normalize", this).call(this); // TODO: provide option at export to swap in LegacyConverted UID


	      var toUID = DicomMetaDictionary.sopClassUIDsByName; //this.dataset.SOPClassUID = "LegacyConvertedEnhancedCTImage";

	      this.dataset.SOPClassUID = toUID.EnhancedCTImage;
	    }
	  }]);

	  return CTImageNormalizer;
	}(ImageNormalizer);

	var PETImageNormalizer =
	/*#__PURE__*/
	function (_ImageNormalizer6) {
	  _inherits(PETImageNormalizer, _ImageNormalizer6);

	  function PETImageNormalizer() {
	    _classCallCheck(this, PETImageNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(PETImageNormalizer).apply(this, arguments));
	  }

	  _createClass(PETImageNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      _get(_getPrototypeOf(PETImageNormalizer.prototype), "normalize", this).call(this); // TODO: provide option at export to swap in LegacyConverted UID


	      var toUID = DicomMetaDictionary.sopClassUIDsByName; //this.dataset.SOPClassUID = "LegacyConvertedEnhancedPETImage";

	      this.dataset.SOPClassUID = toUID.EnhancedPETImage;
	    }
	  }]);

	  return PETImageNormalizer;
	}(ImageNormalizer);

	var SEGImageNormalizer =
	/*#__PURE__*/
	function (_ImageNormalizer7) {
	  _inherits(SEGImageNormalizer, _ImageNormalizer7);

	  function SEGImageNormalizer() {
	    _classCallCheck(this, SEGImageNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(SEGImageNormalizer).apply(this, arguments));
	  }

	  _createClass(SEGImageNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      _get(_getPrototypeOf(SEGImageNormalizer.prototype), "normalize", this).call(this);
	    }
	  }]);

	  return SEGImageNormalizer;
	}(ImageNormalizer);

	var PMImageNormalizer =
	/*#__PURE__*/
	function (_ImageNormalizer8) {
	  _inherits(PMImageNormalizer, _ImageNormalizer8);

	  function PMImageNormalizer() {
	    _classCallCheck(this, PMImageNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(PMImageNormalizer).apply(this, arguments));
	  }

	  _createClass(PMImageNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      _get(_getPrototypeOf(PMImageNormalizer.prototype), "normalize", this).call(this);

	      var ds = this.datasets[0];

	      if (ds.BitsAllocated !== 32) {
	        lib.error("Only works with 32 bit data, not " + String(ds.BitsAllocated));
	      }
	    }
	  }]);

	  return PMImageNormalizer;
	}(ImageNormalizer);

	var DSRNormalizer =
	/*#__PURE__*/
	function (_Normalizer2) {
	  _inherits(DSRNormalizer, _Normalizer2);

	  function DSRNormalizer() {
	    _classCallCheck(this, DSRNormalizer);

	    return _possibleConstructorReturn(this, _getPrototypeOf(DSRNormalizer).apply(this, arguments));
	  }

	  _createClass(DSRNormalizer, [{
	    key: "normalize",
	    value: function normalize() {
	      this.dataset = this.datasets[0]; // only one dataset per series and for now we assume it is normalized
	    }
	  }]);

	  return DSRNormalizer;
	}(Normalizer);

	var Segmentation =
	/*#__PURE__*/
	function (_DerivedPixels) {
	  _inherits(Segmentation, _DerivedPixels);

	  function Segmentation(datasets) {
	    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
	      includeSliceSpacing: true
	    };

	    _classCallCheck(this, Segmentation);

	    return _possibleConstructorReturn(this, _getPrototypeOf(Segmentation).call(this, datasets, options));
	  }

	  _createClass(Segmentation, [{
	    key: "derive",
	    value: function derive() {
	      _get(_getPrototypeOf(Segmentation.prototype), "derive", this).call(this);

	      this.assignToDataset({
	        SOPClassUID: DicomMetaDictionary.sopClassUIDsByName.Segmentation,
	        Modality: "SEG",
	        SamplesPerPixel: "1",
	        PhotometricInterpretation: "MONOCHROME2",
	        BitsAllocated: "1",
	        BitsStored: "1",
	        HighBit: "0",
	        PixelRepresentation: "0",
	        LossyImageCompression: "00",
	        SegmentationType: "BINARY",
	        ContentLabel: "SEGMENTATION"
	      });
	      var dimensionUID = DicomMetaDictionary.uid();
	      this.dataset.DimensionOrganizationSequence = {
	        DimensionOrganizationUID: dimensionUID
	      };
	      this.dataset.DimensionIndexSequence = [{
	        DimensionOrganizationUID: dimensionUID,
	        DimensionIndexPointer: 6422539,
	        FunctionalGroupPointer: 6422538,
	        // SegmentIdentificationSequence
	        DimensionDescriptionLabel: "ReferencedSegmentNumber"
	      }, {
	        DimensionOrganizationUID: dimensionUID,
	        DimensionIndexPointer: 2097202,
	        FunctionalGroupPointer: 2134291,
	        // PlanePositionSequence
	        DimensionDescriptionLabel: "ImagePositionPatient"
	      }];
	      this.dataset.SegmentSequence = []; // TODO: check logic here.
	      // If the referenced dataset itself references a series, then copy.
	      // Otherwise, reference the dataset itself.
	      // This should allow Slicer and others to get the correct original
	      // images when loading Legacy Converted Images, but it's a workaround
	      // that really doesn't belong here.

	      if (this.referencedDataset.ReferencedSeriesSequence) {
	        this.dataset.ReferencedSeriesSequence = DerivedDataset.copyDataset(this.referencedDataset.ReferencedSeriesSequence);
	      } else {
	        var ReferencedInstanceSequence = [];

	        for (var i = 0; i < this.referencedDatasets.length; i++) {
	          ReferencedInstanceSequence.push({
	            ReferencedSOPClassUID: this.referencedDatasets[i].SOPClassUID,
	            ReferencedSOPInstanceUID: this.referencedDatasets[i].SOPInstanceUID
	          });
	        }

	        this.dataset.ReferencedSeriesSequence = {
	          SeriesInstanceUID: this.referencedDataset.SeriesInstanceUID,
	          StudyInstanceUID: this.referencedDataset.StudyInstanceUID,
	          ReferencedInstanceSequence: ReferencedInstanceSequence
	        };
	      }

	      if (!this.options.includeSliceSpacing) {
	        // per dciodvfy this should not be included, but dcmqi/Slicer requires it
	        delete this.dataset.SharedFunctionalGroupsSequence.PixelMeasuresSequence.SpacingBetweenSlices;
	      } // make an array of zeros for the pixels assuming bit packing (one bit per short)
	      // TODO: handle different packing and non-multiple of 8/16 rows and columns
	      // The pixelData array needs to be defined once you know how many frames you'll have.


	      this.dataset.PixelData = undefined;
	      this.dataset.NumberOfFrames = 0;
	      this.dataset.PerFrameFunctionalGroupsSequence = [];
	    }
	    /**
	     * setNumberOfFrames - Sets the number of frames of the segmentation object
	     * and allocates memory for the PixelData.
	     *
	     * @param  {type} NumberOfFrames The number of segmentation frames.
	     */

	  }, {
	    key: "setNumberOfFrames",
	    value: function setNumberOfFrames(NumberOfFrames) {
	      var dataset = this.dataset;
	      dataset.NumberOfFrames = NumberOfFrames;
	      dataset.PixelData = new ArrayBuffer(dataset.Rows * dataset.Columns * NumberOfFrames / 8);
	    }
	    /**
	     * addSegment - Adds a segment to the dataset.
	     *
	     * @param  {type} Segment   The segment metadata.
	     * @param  {Uint8Array} pixelData The pixelData array containing all
	     *                          frames of segmentation.
	     * @param  {Number[]} InStackPositionNumbers  The frames that the
	     *                                            segmentation references.
	     * @param  {Boolean} [isBitPacked = false]    Whether the suplied pixelData
	     *                                            is already bitPacked.
	     *
	     */

	  }, {
	    key: "addSegment",
	    value: function addSegment(Segment, pixelData, InStackPositionNumbers) {
	      var isBitPacked = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

	      if (this.dataset.NumberOfFrames === 0) {
	        throw new Error("Must set the total number of frames via setNumberOfFrames() before adding segments to the segmentation.");
	      }

	      var bitPackedPixelData;

	      if (isBitPacked) {
	        bitPackedPixelData = pixelData;
	      } else {
	        bitPackedPixelData = BitArray.pack(pixelData);
	      }

	      this._addSegmentPixelData(bitPackedPixelData, isBitPacked);

	      var ReferencedSegmentNumber = this._addSegmentMetadata(Segment);

	      this._addPerFrameFunctionalGroups(ReferencedSegmentNumber, InStackPositionNumbers);
	    }
	  }, {
	    key: "_addSegmentPixelData",
	    value: function _addSegmentPixelData(bitPackedPixelData) {
	      var dataset = this.dataset;
	      var pixelDataUint8View = new Uint8Array(dataset.PixelData);
	      var existingFrames = dataset.PerFrameFunctionalGroupsSequence.length;
	      var offset = existingFrames * dataset.Rows * dataset.Columns / 8;

	      for (var i = 0; i < bitPackedPixelData.length; i++) {
	        pixelDataUint8View[offset + i] = bitPackedPixelData[i];
	      }
	    }
	  }, {
	    key: "_addPerFrameFunctionalGroups",
	    value: function _addPerFrameFunctionalGroups(ReferencedSegmentNumber, InStackPositionNumbers) {
	      var PerFrameFunctionalGroupsSequence = this.dataset.PerFrameFunctionalGroupsSequence;
	      var ReferencedSeriesSequence = this.referencedDataset.ReferencedSeriesSequence;

	      for (var i = 0; i < InStackPositionNumbers.length; i++) {
	        var frameNumber = InStackPositionNumbers[i];
	        var perFrameFunctionalGroups = {};
	        perFrameFunctionalGroups.PlanePositionSequence = DerivedDataset.copyDataset(this.referencedDataset.PerFrameFunctionalGroupsSequence[frameNumber - 1].PlanePositionSequence); // If the PlaneOrientationSequence is not in the SharedFunctionalGroupsSequence,
	        // extract it from the PerFrameFunctionalGroupsSequence.

	        if (!this.dataset.SharedFunctionalGroupsSequence.PlaneOrientationSequence) {
	          perFrameFunctionalGroups.PlaneOrientationSequence = DerivedDataset.copyDataset(this.referencedDataset.PerFrameFunctionalGroupsSequence[frameNumber - 1].PlaneOrientationSequence);
	        }

	        perFrameFunctionalGroups.FrameContentSequence = {
	          DimensionIndexValues: [ReferencedSegmentNumber, frameNumber]
	        };
	        perFrameFunctionalGroups.SegmentIdentificationSequence = {
	          ReferencedSegmentNumber: ReferencedSegmentNumber
	        };
	        var ReferencedSOPClassUID = void 0;
	        var ReferencedSOPInstanceUID = void 0;
	        var ReferencedFrameNumber = void 0;

	        if (ReferencedSeriesSequence) {
	          var referencedInstanceSequenceI = ReferencedSeriesSequence.ReferencedInstanceSequence[frameNumber - 1];
	          ReferencedSOPClassUID = referencedInstanceSequenceI.ReferencedSOPClassUID;
	          ReferencedSOPInstanceUID = referencedInstanceSequenceI.ReferencedSOPInstanceUID;

	          if (Normalizer.isMultiframeSOPClassUID(ReferencedSOPClassUID)) {
	            ReferencedFrameNumber = frameNumber;
	          }
	        } else {
	          ReferencedSOPClassUID = this.referencedDataset.SOPClassUID;
	          ReferencedSOPInstanceUID = this.referencedDataset.SOPInstanceUID;
	          ReferencedFrameNumber = frameNumber;
	        }

	        if (ReferencedFrameNumber) {
	          perFrameFunctionalGroups.DerivationImageSequence = {
	            SourceImageSequence: {
	              ReferencedSOPClassUID: ReferencedSOPClassUID,
	              ReferencedSOPInstanceUID: ReferencedSOPInstanceUID,
	              ReferencedFrameNumber: ReferencedFrameNumber,
	              PurposeOfReferenceCodeSequence: {
	                CodeValue: "121322",
	                CodingSchemeDesignator: "DCM",
	                CodeMeaning: "Source image for image processing operation"
	              }
	            },
	            DerivationCodeSequence: {
	              CodeValue: "113076",
	              CodingSchemeDesignator: "DCM",
	              CodeMeaning: "Segmentation"
	            }
	          };
	        } else {
	          perFrameFunctionalGroups.DerivationImageSequence = {
	            SourceImageSequence: {
	              ReferencedSOPClassUID: ReferencedSOPClassUID,
	              ReferencedSOPInstanceUID: ReferencedSOPInstanceUID,
	              PurposeOfReferenceCodeSequence: {
	                CodeValue: "121322",
	                CodingSchemeDesignator: "DCM",
	                CodeMeaning: "Source image for image processing operation"
	              }
	            },
	            DerivationCodeSequence: {
	              CodeValue: "113076",
	              CodingSchemeDesignator: "DCM",
	              CodeMeaning: "Segmentation"
	            }
	          };
	        }

	        PerFrameFunctionalGroupsSequence.push(perFrameFunctionalGroups);
	      }
	    }
	  }, {
	    key: "_addSegmentMetadata",
	    value: function _addSegmentMetadata(Segment) {
	      if (!Segment.SegmentLabel || !Segment.SegmentedPropertyCategoryCodeSequence || !Segment.SegmentedPropertyTypeCodeSequence || !Segment.SegmentAlgorithmType) {
	        throw new Error("Segment does not contain all the required fields.");
	      } // Capitalise the SegmentAlgorithmType if it happens to be given in
	      // Lower/mixed case.


	      Segment.SegmentAlgorithmType = Segment.SegmentAlgorithmType.toUpperCase(); // Check SegmentAlgorithmType and SegmentAlgorithmName if necessary.

	      switch (Segment.SegmentAlgorithmType) {
	        case "AUTOMATIC":
	        case "SEMIAUTOMATIC":
	          if (!Segment.SegmentAlgorithmName) {
	            throw new Error("If the SegmentAlgorithmType is SEMIAUTOMATIC or AUTOMATIC,\n          SegmentAlgorithmName must be provided");
	          }

	          break;

	        case "MANUAL":
	          break;

	        default:
	          throw new Error("SegmentAlgorithmType ".concat(Segment.SegmentAlgorithmType, " invalid."));
	      }

	      var SegmentSequence = this.dataset.SegmentSequence;
	      Segment.SegmentNumber = SegmentSequence.length + 1;
	      SegmentSequence.push(Segment);
	      return Segment.SegmentNumber;
	    }
	  }]);

	  return Segmentation;
	}(DerivedPixels);

	var ParametricMap =
	/*#__PURE__*/
	function (_DerivedDataset) {
	  _inherits(ParametricMap, _DerivedDataset);

	  function ParametricMap(datasets) {
	    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	    _classCallCheck(this, ParametricMap);

	    return _possibleConstructorReturn(this, _getPrototypeOf(ParametricMap).call(this, datasets, options));
	  } // this assumes a normalized multiframe input and will create
	  // a multiframe derived image


	  _createClass(ParametricMap, [{
	    key: "derive",
	    value: function derive() {
	      _get(_getPrototypeOf(ParametricMap.prototype), "derive", this).call(this);

	      this.assignToDataset({// TODO: ???
	      });
	      this.assignFromReference([]);
	    }
	  }]);

	  return ParametricMap;
	}(DerivedDataset);

	var StructuredReport =
	/*#__PURE__*/
	function (_DerivedDataset) {
	  _inherits(StructuredReport, _DerivedDataset);

	  function StructuredReport(datasets) {
	    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	    _classCallCheck(this, StructuredReport);

	    return _possibleConstructorReturn(this, _getPrototypeOf(StructuredReport).call(this, datasets, options));
	  } // this assumes a normalized multiframe input and will create
	  // a multiframe derived image


	  _createClass(StructuredReport, [{
	    key: "derive",
	    value: function derive() {
	      _get(_getPrototypeOf(StructuredReport.prototype), "derive", this).call(this);

	      this.assignToDataset({
	        SOPClassUID: DicomMetaDictionary.sopClassUIDsByName.EnhancedSR,
	        Modality: "SR",
	        ValueType: "CONTAINER"
	      });
	      this.assignFromReference([]);
	    }
	  }]);

	  return StructuredReport;
	}(DerivedDataset);

	var TID1500MeasurementReport =
	/*#__PURE__*/
	function () {
	  function TID1500MeasurementReport(TID1501MeasurementGroups) {
	    _classCallCheck(this, TID1500MeasurementReport);

	    this.TID1501MeasurementGroups = TID1501MeasurementGroups;
	  }

	  _createClass(TID1500MeasurementReport, [{
	    key: "validate",
	    value: function validate() {}
	  }, {
	    key: "contentItem",
	    value: function contentItem(derivationSourceDataset) {
	      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
	      // Add the Measurement Groups to the Measurement Report
	      var ContentSequence = [];
	      this.TID1501MeasurementGroups.forEach(function (child) {
	        ContentSequence = ContentSequence.concat(child.contentItem());
	      }); // For each measurement that is referenced, add a link to the
	      // Image Library Group and the Current Requested Procedure Evidence
	      // with the proper ReferencedSOPSequence

	      var ImageLibraryContentSequence = [];
	      var CurrentRequestedProcedureEvidenceSequence = [];
	      this.TID1501MeasurementGroups.forEach(function (measurementGroup) {
	        measurementGroup.TID300Measurements.forEach(function (measurement) {
	          ImageLibraryContentSequence.push({
	            RelationshipType: "CONTAINS",
	            ValueType: "IMAGE",
	            ReferencedSOPSequence: measurement.ReferencedSOPSequence
	          });
	          CurrentRequestedProcedureEvidenceSequence.push({
	            StudyInstanceUID: derivationSourceDataset.StudyInstanceUID,
	            ReferencedSeriesSequence: {
	              SeriesInstanceUID: derivationSourceDataset.SeriesInstanceUID,
	              ReferencedSOPSequence: measurement.ReferencedSOPSequence
	            }
	          });
	        });
	      });
	      return {
	        ConceptNameCodeSequence: {
	          CodeValue: "126000",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Imaging Measurement Report"
	        },
	        ContinuityOfContent: "SEPARATE",
	        PerformedProcedureCodeSequence: [],
	        CompletionFlag: "COMPLETE",
	        VerificationFlag: "UNVERIFIED",
	        ReferencedPerformedProcedureStepSequence: [],
	        InstanceNumber: 1,
	        CurrentRequestedProcedureEvidenceSequence: CurrentRequestedProcedureEvidenceSequence,
	        CodingSchemeIdentificationSequence: {
	          CodingSchemeDesignator: "99dcmjs",
	          CodingSchemeName: "Codes used for dcmjs",
	          CodingSchemeVersion: "0",
	          CodingSchemeResponsibleOrganization: "https://github.com/dcmjs-org/dcmjs"
	        },
	        ContentTemplateSequence: {
	          MappingResource: "DCMR",
	          TemplateIdentifier: "1500"
	        },
	        ContentSequence: [{
	          RelationshipType: "HAS CONCEPT MOD",
	          ValueType: "CODE",
	          ConceptNameCodeSequence: {
	            CodeValue: "121049",
	            CodingSchemeDesignator: "DCM",
	            CodeMeaning: "Language of Content Item and Descendants"
	          },
	          ConceptCodeSequence: {
	            CodeValue: "eng",
	            CodingSchemeDesignator: "RFC5646",
	            CodeMeaning: "English"
	          },
	          ContentSequence: {
	            RelationshipType: "HAS CONCEPT MOD",
	            ValueType: "CODE",
	            ConceptNameCodeSequence: {
	              CodeValue: "121046",
	              CodingSchemeDesignator: "DCM",
	              CodeMeaning: "Country of Language"
	            },
	            ConceptCodeSequence: {
	              CodeValue: "US",
	              CodingSchemeDesignator: "ISO3166_1",
	              CodeMeaning: "United States"
	            }
	          }
	        }, {
	          RelationshipType: "HAS OBS CONTEXT",
	          ValueType: "PNAME",
	          ConceptNameCodeSequence: {
	            CodeValue: "121008",
	            CodingSchemeDesignator: "DCM",
	            CodeMeaning: "Person Observer Name"
	          },
	          PersonName: options.PersonName || "unknown^unknown"
	        }, {
	          RelationshipType: "HAS CONCEPT MOD",
	          ValueType: "CODE",
	          ConceptNameCodeSequence: {
	            CodeValue: "121058",
	            CodingSchemeDesignator: "DCM",
	            CodeMeaning: "Procedure reported"
	          },
	          ConceptCodeSequence: {
	            CodeValue: "1",
	            CodingSchemeDesignator: "99dcmjs",
	            CodeMeaning: "Unknown procedure"
	          }
	        }, {
	          RelationshipType: "CONTAINS",
	          ValueType: "CONTAINER",
	          ConceptNameCodeSequence: {
	            CodeValue: "111028",
	            CodingSchemeDesignator: "DCM",
	            CodeMeaning: "Image Library"
	          },
	          ContinuityOfContent: "SEPARATE",
	          ContentSequence: {
	            RelationshipType: "CONTAINS",
	            ValueType: "CONTAINER",
	            ConceptNameCodeSequence: {
	              CodeValue: "126200",
	              CodingSchemeDesignator: "DCM",
	              CodeMeaning: "Image Library Group"
	            },
	            ContinuityOfContent: "SEPARATE",
	            ContentSequence: ImageLibraryContentSequence
	          }
	        }, {
	          RelationshipType: "CONTAINS",
	          ValueType: "CONTAINER",
	          ConceptNameCodeSequence: {
	            CodeValue: "126010",
	            CodingSchemeDesignator: "DCM",
	            CodeMeaning: "Imaging Measurements" // TODO: would be nice to abstract the code sequences (in a dictionary? a service?)

	          },
	          ContinuityOfContent: "SEPARATE",
	          ContentSequence: {
	            RelationshipType: "CONTAINS",
	            ValueType: "CONTAINER",
	            ConceptNameCodeSequence: {
	              CodeValue: "125007",
	              CodingSchemeDesignator: "DCM",
	              CodeMeaning: "Measurement Group"
	            },
	            ContinuityOfContent: "SEPARATE",
	            ContentSequence: ContentSequence
	          }
	        }]
	      };
	    }
	  }]);

	  return TID1500MeasurementReport;
	}();

	var TID1501MeasurementGroup =
	/*#__PURE__*/
	function () {
	  function TID1501MeasurementGroup(TID300Measurements) {
	    _classCallCheck(this, TID1501MeasurementGroup);

	    this.TID300Measurements = TID300Measurements;
	  }

	  _createClass(TID1501MeasurementGroup, [{
	    key: "contentItem",
	    value: function contentItem() {
	      var TID300Measurements = this.TID300Measurements; // TODO: Is there nothing else in this group?

	      var contentItem = [];
	      var measurements = [];
	      TID300Measurements.forEach(function (TID300Measurement) {
	        measurements = measurements.concat(TID300Measurement.contentItem());
	      });
	      contentItem = contentItem.concat(measurements);
	      return contentItem;
	    }
	  }]);

	  return TID1501MeasurementGroup;
	}();

	var toArray = function toArray(x) {
	  return x.constructor.name === "Array" ? x : [x];
	};

	var codeMeaningEquals = function codeMeaningEquals(codeMeaningName) {
	  return function (contentItem) {
	    return contentItem.ConceptNameCodeSequence.CodeMeaning === codeMeaningName;
	  };
	};

	var graphicTypeEquals = function graphicTypeEquals(graphicType) {
	  return function (contentItem) {
	    return contentItem.ContentSequence !== undefined && contentItem.ContentSequence.GraphicType === graphicType;
	  };
	};

	function getTID300ContentItem(tool, toolType, ReferencedSOPSequence, toolClass) {
	  var args = toolClass.getTID300RepresentationArguments(tool);
	  args.ReferencedSOPSequence = ReferencedSOPSequence;
	  var TID300Measurement = new toolClass.TID300Representation(args);
	  return TID300Measurement;
	}

	function getMeasurementGroup(toolType, toolData, ReferencedSOPSequence) {
	  var toolTypeData = toolData[toolType];
	  var toolClass = MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_TOOL_TYPE[toolType];

	  if (!toolTypeData || !toolTypeData.data || !toolTypeData.data.length) {
	    return;
	  } // Loop through the array of tool instances
	  // for this tool


	  var Measurements = toolTypeData.data.map(function (tool) {
	    return getTID300ContentItem(tool, toolType, ReferencedSOPSequence, toolClass);
	  });
	  return new TID1501MeasurementGroup(Measurements);
	}

	var MeasurementReport =
	/*#__PURE__*/
	function () {
	  function MeasurementReport() {
	    _classCallCheck(this, MeasurementReport);
	  }

	  _createClass(MeasurementReport, null, [{
	    key: "generateReport",
	    value: function generateReport(toolState, metadataProvider, options) {
	      // ToolState for array of imageIDs to a Report
	      // Assume Cornerstone metadata provider has access to Study / Series / Sop Instance UID
	      var allMeasurementGroups = [];
	      var firstImageId = Object.keys(toolState)[0];

	      if (!firstImageId) {
	        throw new Error("No measurements provided.");
	      }
	      /* Patient ID
	      Warning - Missing attribute or value that would be needed to build DICOMDIR - Patient ID
	      Warning - Missing attribute or value that would be needed to build DICOMDIR - Study Date
	      Warning - Missing attribute or value that would be needed to build DICOMDIR - Study Time
	      Warning - Missing attribute or value that would be needed to build DICOMDIR - Study ID */


	      var generalSeriesModule = metadataProvider.get("generalSeriesModule", firstImageId); //const sopCommonModule = metadataProvider.get('sopCommonModule', firstImageId);

	      var studyInstanceUID = generalSeriesModule.studyInstanceUID,
	          seriesInstanceUID = generalSeriesModule.seriesInstanceUID; // Loop through each image in the toolData

	      Object.keys(toolState).forEach(function (imageId) {
	        var sopCommonModule = metadataProvider.get("sopCommonModule", imageId);
	        var frameNumber = metadataProvider.get("frameNumber", imageId);
	        var toolData = toolState[imageId];
	        var toolTypes = Object.keys(toolData);
	        var ReferencedSOPSequence = {
	          ReferencedSOPClassUID: sopCommonModule.sopClassUID,
	          ReferencedSOPInstanceUID: sopCommonModule.sopInstanceUID
	        };

	        if (Normalizer.isMultiframeSOPClassUID(sopCommonModule.sopClassUID)) {
	          ReferencedSOPSequence.ReferencedFrameNumber = frameNumber;
	        } // Loop through each tool type for the image


	        var measurementGroups = [];
	        toolTypes.forEach(function (toolType) {
	          var group = getMeasurementGroup(toolType, toolData, ReferencedSOPSequence);

	          if (group) {
	            measurementGroups.push(group);
	          }
	        });
	        allMeasurementGroups = allMeasurementGroups.concat(measurementGroups);
	      });
	      var MeasurementReport = new TID1500MeasurementReport(allMeasurementGroups, options); // TODO: what is the correct metaheader
	      // http://dicom.nema.org/medical/Dicom/current/output/chtml/part10/chapter_7.html
	      // TODO: move meta creation to happen in derivations.js

	      var fileMetaInformationVersionArray = new Uint8Array(2);
	      fileMetaInformationVersionArray[1] = 1;
	      var derivationSourceDataset = {
	        StudyInstanceUID: studyInstanceUID,
	        SeriesInstanceUID: seriesInstanceUID //SOPInstanceUID: sopInstanceUID, // TODO: Necessary?
	        //SOPClassUID: sopClassUID,

	      };
	      var _meta = {
	        FileMetaInformationVersion: {
	          Value: [fileMetaInformationVersionArray.buffer],
	          vr: "OB"
	        },
	        //MediaStorageSOPClassUID
	        //MediaStorageSOPInstanceUID: sopCommonModule.sopInstanceUID,
	        TransferSyntaxUID: {
	          Value: ["1.2.840.10008.1.2.1"],
	          vr: "UI"
	        },
	        ImplementationClassUID: {
	          Value: [DicomMetaDictionary.uid()],
	          // TODO: could be git hash or other valid id
	          vr: "UI"
	        },
	        ImplementationVersionName: {
	          Value: ["dcmjs"],
	          vr: "SH"
	        }
	      };
	      var _vrMap = {
	        PixelData: "OW"
	      };
	      derivationSourceDataset._meta = _meta;
	      derivationSourceDataset._vrMap = _vrMap;
	      var report = new StructuredReport([derivationSourceDataset]);
	      var contentItem = MeasurementReport.contentItem(derivationSourceDataset); // Merge the derived dataset with the content from the Measurement Report

	      report.dataset = Object.assign(report.dataset, contentItem);
	      report.dataset._meta = _meta;
	      return report;
	    }
	  }, {
	    key: "generateToolState",
	    value: function generateToolState(dataset) {
	      // For now, bail out if the dataset is not a TID1500 SR with length measurements
	      if (dataset.ContentTemplateSequence.TemplateIdentifier !== "1500") {
	        throw new Error("This package can currently only interpret DICOM SR TID 1500");
	      }

	      var REPORT = "Imaging Measurements";
	      var GROUP = "Measurement Group"; // Identify the Imaging Measurements

	      var imagingMeasurementContent = toArray(dataset.ContentSequence).find(codeMeaningEquals(REPORT)); // Retrieve the Measurements themselves

	      var measurementGroupContent = toArray(imagingMeasurementContent.ContentSequence).find(codeMeaningEquals(GROUP)); // For each of the supported measurement types, compute the measurement data

	      var measurementData = {};
	      Object.keys(MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE).forEach(function (measurementType) {
	        // Filter to find supported measurement types in the Structured Report
	        var measurementGroups = toArray(measurementGroupContent.ContentSequence);
	        var measurementContent = measurementGroups.filter(codeMeaningEquals(measurementType));

	        if (!measurementContent) {
	          return;
	        }

	        var toolClass = MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE[measurementType];
	        var toolType = toolClass.toolType;

	        if (!toolClass.getMeasurementData) {
	          throw new Error("Cornerstone Tool Adapters must define a getMeasurementData static method.");
	        } // Retrieve Length Measurement Data


	        measurementData[toolType] = toolClass.getMeasurementData(measurementContent);
	      }); // TODO: Find a way to define 'how' to get an imageId ?
	      // Need to provide something to generate imageId from Study / Series / Sop Instance UID
	      // combine / reorganize all the toolData into the expected toolState format for Cornerstone Tools

	      return measurementData;
	    }
	  }, {
	    key: "registerTool",
	    value: function registerTool(toolClass) {
	      MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE[toolClass.utilityToolType] = toolClass;
	      MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_TOOL_TYPE[toolClass.toolType] = toolClass;
	      MeasurementReport.MEASUREMENT_BY_TOOLTYPE[toolClass.toolType] = toolClass.utilityToolType;
	    }
	  }]);

	  return MeasurementReport;
	}();
	MeasurementReport.MEASUREMENT_BY_TOOLTYPE = {};
	MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_UTILITY_TYPE = {};
	MeasurementReport.CORNERSTONE_TOOL_CLASSES_BY_TOOL_TYPE = {};

	var TID300Measurement = function TID300Measurement() {
	  _classCallCheck(this, TID300Measurement);
	};

	var Length =
	/*#__PURE__*/
	function (_TID300Measurement) {
	  _inherits(Length, _TID300Measurement);

	  function Length(_ref) {
	    var _this;

	    var point1 = _ref.point1,
	        point2 = _ref.point2,
	        distance = _ref.distance,
	        ReferencedSOPSequence = _ref.ReferencedSOPSequence;

	    _classCallCheck(this, Length);

	    _this = _possibleConstructorReturn(this, _getPrototypeOf(Length).call(this));
	    _this.point1 = point1;
	    _this.point2 = point2;
	    _this.distance = distance;
	    _this.ReferencedSOPSequence = ReferencedSOPSequence;
	    return _this;
	  }

	  _createClass(Length, [{
	    key: "contentItem",
	    value: function contentItem() {
	      var point1 = this.point1,
	          point2 = this.point2,
	          distance = this.distance,
	          ReferencedSOPSequence = this.ReferencedSOPSequence;
	      return [{
	        RelationshipType: "HAS OBS CONTEXT",
	        ValueType: "TEXT",
	        ConceptNameCodeSequence: {
	          CodeValue: "112039",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Tracking Identifier"
	        },
	        TextValue: "web annotation"
	      }, {
	        RelationshipType: "HAS OBS CONTEXT",
	        ValueType: "UIDREF",
	        ConceptNameCodeSequence: {
	          CodeValue: "112040",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Tracking Unique Identifier"
	        },
	        UID: DicomMetaDictionary.uid()
	      }, {
	        RelationshipType: "CONTAINS",
	        ValueType: "CODE",
	        ConceptNameCodeSequence: {
	          CodeValue: "121071",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Finding"
	        },
	        ConceptCodeSequence: {
	          CodeValue: "SAMPLEFINDING",
	          CodingSchemeDesignator: "99dcmjs",
	          CodeMeaning: "Sample Finding"
	        }
	      }, {
	        RelationshipType: "CONTAINS",
	        ValueType: "NUM",
	        ConceptNameCodeSequence: {
	          CodeValue: "G-D7FE",
	          CodingSchemeDesignator: "SRT",
	          CodeMeaning: "Length"
	        },
	        MeasuredValueSequence: {
	          MeasurementUnitsCodeSequence: {
	            CodeValue: "mm",
	            CodingSchemeDesignator: "UCUM",
	            CodingSchemeVersion: "1.4",
	            CodeMeaning: "millimeter"
	          },
	          NumericValue: distance
	        },
	        ContentSequence: {
	          RelationshipType: "INFERRED FROM",
	          ValueType: "SCOORD",
	          GraphicType: "POLYLINE",
	          GraphicData: [point1.x, point1.y, point2.x, point2.y],
	          ContentSequence: {
	            RelationshipType: "SELECTED FROM",
	            ValueType: "IMAGE",
	            ReferencedSOPSequence: ReferencedSOPSequence
	          }
	        }
	      }];
	    }
	  }]);

	  return Length;
	}(TID300Measurement);

	var Length$1 =
	/*#__PURE__*/
	function () {
	  function Length$$1() {
	    _classCallCheck(this, Length$$1);
	  }

	  _createClass(Length$$1, null, [{
	    key: "measurementContentToLengthState",
	    value: function measurementContentToLengthState(groupItemContent) {
	      var lengthContent = groupItemContent.ContentSequence;
	      var ReferencedSOPSequence = lengthContent.ContentSequence.ReferencedSOPSequence;
	      var ReferencedSOPInstanceUID = ReferencedSOPSequence.ReferencedSOPInstanceUID,
	          ReferencedFrameNumber = ReferencedSOPSequence.ReferencedFrameNumber;
	      var lengthState = {
	        sopInstanceUid: ReferencedSOPInstanceUID,
	        frameIndex: ReferencedFrameNumber || 0,
	        length: groupItemContent.MeasuredValueSequence.NumericValue,
	        toolType: Length$$1.toolType
	      };
	      lengthState.handles = {
	        start: {},
	        end: {}
	      };

	      var _lengthContent$Graphi = _slicedToArray(lengthContent.GraphicData, 4);

	      lengthState.handles.start.x = _lengthContent$Graphi[0];
	      lengthState.handles.start.y = _lengthContent$Graphi[1];
	      lengthState.handles.end.x = _lengthContent$Graphi[2];
	      lengthState.handles.end.y = _lengthContent$Graphi[3];
	      // TODO: Save textbox position in GraphicData
	      lengthState.handles.textBox = {
	        hasMoved: false,
	        movesIndependently: false,
	        drawnIndependently: true,
	        allowedOutsideImage: true,
	        hasBoundingBox: true
	      };
	      return lengthState;
	    } // TODO: this function is required for all Cornerstone Tool Adapters, since it is called by MeasurementReport.

	  }, {
	    key: "getMeasurementData",
	    value: function getMeasurementData(measurementContent) {
	      return measurementContent.map(Length$$1.measurementContentToLengthState);
	    }
	  }, {
	    key: "getTID300RepresentationArguments",
	    value: function getTID300RepresentationArguments(tool) {
	      var point1 = tool.handles.start;
	      var point2 = tool.handles.end;
	      var distance = tool.length;
	      return {
	        point1: point1,
	        point2: point2,
	        distance: distance
	      };
	    }
	  }]);

	  return Length$$1;
	}();

	Length$1.toolType = "Length";
	Length$1.utilityToolType = "Length";
	Length$1.TID300Representation = Length;
	MeasurementReport.registerTool(Length$1);

	/**
	 * Expand an array of points stored as objects into
	 * a flattened array of points
	 *
	 * @param points [{x: 0, y: 1}, {x: 1, y: 2}] or [{x: 0, y: 1, z: 0}, {x: 1, y: 2, z: 0}]
	 * @return {Array} [point1x, point1y, point2x, point2y] or [point1x, point1y, point1z, point2x, point2y, point2z]
	 */

	function expandPoints(points) {
	  var allPoints = [];
	  points.forEach(function (point) {
	    allPoints.push(point[0]);
	    allPoints.push(point[1]);

	    if (point[2] !== undefined) {
	      allPoints.push(point[2]);
	    }
	  });
	  return allPoints;
	}

	var Polyline =
	/*#__PURE__*/
	function (_TID300Measurement) {
	  _inherits(Polyline, _TID300Measurement);

	  // Note: the last point should be equal to the first point to indicate that the polyline is closed.
	  function Polyline(_ref) {
	    var _this;

	    var points = _ref.points,
	        lengths = _ref.lengths,
	        ReferencedSOPSequence = _ref.ReferencedSOPSequence,
	        _ref$use3DSpatialCoor = _ref.use3DSpatialCoordinates,
	        use3DSpatialCoordinates = _ref$use3DSpatialCoor === void 0 ? false : _ref$use3DSpatialCoor;

	    _classCallCheck(this, Polyline);

	    _this = _possibleConstructorReturn(this, _getPrototypeOf(Polyline).call(this));
	    _this.points = points;
	    _this.lengths = lengths; // Array of lengths between each point

	    _this.ReferencedSOPSequence = ReferencedSOPSequence;
	    _this.use3DSpatialCoordinates = use3DSpatialCoordinates;
	    return _this;
	  }

	  _createClass(Polyline, [{
	    key: "contentItem",
	    value: function contentItem() {
	      var points = this.points,
	          ReferencedSOPSequence = this.ReferencedSOPSequence,
	          _this$use3DSpatialCoo = this.use3DSpatialCoordinates,
	          use3DSpatialCoordinates = _this$use3DSpatialCoo === void 0 ? false : _this$use3DSpatialCoo; // Combine all lengths to save the perimeter
	      // @ToDO The permiter has to be implemented
	      // const reducer = (accumulator, currentValue) => accumulator + currentValue;
	      // const perimeter = lengths.reduce(reducer);

	      var perimeter = {};
	      var GraphicData = expandPoints(points); // TODO: Add Mean and STDev value of (modality?) pixels

	      return [{
	        RelationshipType: "HAS OBS CONTEXT",
	        ValueType: "TEXT",
	        ConceptNameCodeSequence: {
	          CodeValue: "112039",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Tracking Identifier"
	        },
	        TextValue: "web annotation"
	      }, {
	        RelationshipType: "HAS OBS CONTEXT",
	        ValueType: "UIDREF",
	        ConceptNameCodeSequence: {
	          CodeValue: "112040",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Tracking Unique Identifier"
	        },
	        UID: DicomMetaDictionary.uid()
	      }, {
	        RelationshipType: "CONTAINS",
	        ValueType: "CODE",
	        ConceptNameCodeSequence: {
	          CodeValue: "121071",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Finding"
	        },
	        ConceptCodeSequence: {
	          CodeValue: "SAMPLEFINDING",
	          CodingSchemeDesignator: "99dcmjs",
	          CodeMeaning: "Sample Finding"
	        }
	      }, {
	        RelationshipType: "CONTAINS",
	        ValueType: "NUM",
	        ConceptNameCodeSequence: {
	          CodeValue: "G-A197",
	          CodingSchemeDesignator: "SRT",
	          CodeMeaning: "Perimeter" // TODO: Look this up from a Code Meaning dictionary

	        },
	        MeasuredValueSequence: {
	          MeasurementUnitsCodeSequence: {
	            CodeValue: "mm",
	            CodingSchemeDesignator: "UCUM",
	            CodingSchemeVersion: "1.4",
	            CodeMeaning: "millimeter"
	          },
	          NumericValue: perimeter
	        },
	        ContentSequence: {
	          RelationshipType: "INFERRED FROM",
	          ValueType: use3DSpatialCoordinates ? "SCOORD3D" : "SCOORD",
	          GraphicType: "POLYLINE",
	          GraphicData: GraphicData,
	          ContentSequence: use3DSpatialCoordinates ? undefined : {
	            RelationshipType: "SELECTED FROM",
	            ValueType: "IMAGE",
	            ReferencedSOPSequence: ReferencedSOPSequence
	          }
	        }
	      }, {
	        // TODO: This feels weird to repeat the GraphicData
	        RelationshipType: "CONTAINS",
	        ValueType: "NUM",
	        ConceptNameCodeSequence: {
	          CodeValue: "G-A166",
	          CodingSchemeDesignator: "SRT",
	          CodeMeaning: "Area" // TODO: Look this up from a Code Meaning dictionary

	        },
	        MeasuredValueSequence: {
	          MeasurementUnitsCodeSequence: {
	            CodeValue: "mm2",
	            CodingSchemeDesignator: "UCUM",
	            CodingSchemeVersion: "1.4",
	            CodeMeaning: "SquareMilliMeter"
	          },
	          NumericValue: perimeter
	        },
	        ContentSequence: {
	          RelationshipType: "INFERRED FROM",
	          ValueType: use3DSpatialCoordinates ? "SCOORD3D" : "SCOORD",
	          GraphicType: "POLYLINE",
	          GraphicData: GraphicData,
	          ContentSequence: use3DSpatialCoordinates ? undefined : {
	            RelationshipType: "SELECTED FROM",
	            ValueType: "IMAGE",
	            ReferencedSOPSequence: ReferencedSOPSequence
	          }
	        }
	      }];
	    }
	  }]);

	  return Polyline;
	}(TID300Measurement);

	var Freehand =
	/*#__PURE__*/
	function () {
	  function Freehand() {
	    _classCallCheck(this, Freehand);
	  }

	  _createClass(Freehand, null, [{
	    key: "measurementContentToLengthState",
	    value: function measurementContentToLengthState(groupItemContent) {
	      var content = groupItemContent.ContentSequence;
	      var ReferencedSOPSequence = content.ContentSequence.ReferencedSOPSequence;
	      var ReferencedSOPInstanceUID = ReferencedSOPSequence.ReferencedSOPInstanceUID,
	          ReferencedFrameNumber = ReferencedSOPSequence.ReferencedFrameNumber;
	      var state = {
	        sopInstanceUid: ReferencedSOPInstanceUID,
	        frameIndex: ReferencedFrameNumber || 0,
	        toolType: Freehand.toolType
	      }; // TODO: To be implemented!
	      // Needs to add points, lengths

	      return state;
	    } // TODO: this function is required for all Cornerstone Tool Adapters, since it is called by MeasurementReport.

	  }, {
	    key: "getMeasurementData",
	    value: function getMeasurementData(measurementContent) {
	      return measurementContent.map(Freehand.measurementContentToLengthState);
	    }
	  }, {
	    key: "getTID300RepresentationArguments",
	    value: function getTID300RepresentationArguments()
	    /*tool*/
	    {
	      // TO BE IMPLEMENTED
	      return {
	        /*points, lengths*/
	      };
	    }
	  }]);

	  return Freehand;
	}();

	Freehand.toolType = 'Freehand';
	Freehand.utilityToolType = 'Polyline';
	Freehand.TID300Representation = Polyline;
	MeasurementReport.registerTool(Freehand);

	var Bidirectional =
	/*#__PURE__*/
	function (_TID300Measurement) {
	  _inherits(Bidirectional, _TID300Measurement);

	  function Bidirectional(_ref) {
	    var _this;

	    var longAxis = _ref.longAxis,
	        shortAxis = _ref.shortAxis,
	        longAxisLength = _ref.longAxisLength,
	        shortAxisLength = _ref.shortAxisLength,
	        ReferencedSOPSequence = _ref.ReferencedSOPSequence;

	    _classCallCheck(this, Bidirectional);

	    _this = _possibleConstructorReturn(this, _getPrototypeOf(Bidirectional).call(this));
	    _this.longAxis = longAxis;
	    _this.shortAxis = shortAxis;
	    _this.longAxisLength = longAxisLength;
	    _this.shortAxisLength = shortAxisLength;
	    _this.ReferencedSOPSequence = ReferencedSOPSequence;
	    return _this;
	  }

	  _createClass(Bidirectional, [{
	    key: "contentItem",
	    value: function contentItem() {
	      var longAxis = this.longAxis,
	          shortAxis = this.shortAxis,
	          longAxisLength = this.longAxisLength,
	          shortAxisLength = this.shortAxisLength,
	          ReferencedSOPSequence = this.ReferencedSOPSequence;
	      return [{
	        RelationshipType: "HAS OBS CONTEXT",
	        ValueType: "TEXT",
	        ConceptNameCodeSequence: {
	          CodeValue: "112039",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Tracking Identifier"
	        },
	        TextValue: "web annotation"
	      }, {
	        RelationshipType: "HAS OBS CONTEXT",
	        ValueType: "UIDREF",
	        ConceptNameCodeSequence: {
	          CodeValue: "112040",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Tracking Unique Identifier"
	        },
	        UID: DicomMetaDictionary.uid()
	      }, {
	        RelationshipType: "CONTAINS",
	        ValueType: "CODE",
	        ConceptNameCodeSequence: {
	          CodeValue: "121071",
	          CodingSchemeDesignator: "DCM",
	          CodeMeaning: "Finding"
	        },
	        ConceptCodeSequence: {
	          CodeValue: "SAMPLEFINDING",
	          CodingSchemeDesignator: "99dcmjs",
	          CodeMeaning: "Sample Finding"
	        }
	      }, {
	        RelationshipType: "CONTAINS",
	        ValueType: "NUM",
	        ConceptNameCodeSequence: {
	          CodeValue: "G-A185",
	          CodingSchemeDesignator: "SRT",
	          CodeMeaning: "Long Axis"
	        },
	        MeasuredValueSequence: {
	          MeasurementUnitsCodeSequence: {
	            CodeValue: "mm",
	            CodingSchemeDesignator: "UCUM",
	            CodingSchemeVersion: "1.4",
	            CodeMeaning: "millimeter"
	          },
	          NumericValue: longAxisLength
	        },
	        ContentSequence: {
	          RelationshipType: "INFERRED FROM",
	          ValueType: "SCOORD",
	          GraphicType: "POLYLINE",
	          GraphicData: [longAxis.point1.x, longAxis.point1.y, longAxis.point2.x, longAxis.point2.y],
	          ContentSequence: {
	            RelationshipType: "SELECTED FROM",
	            ValueType: "IMAGE",
	            ReferencedSOPSequence: ReferencedSOPSequence
	          }
	        }
	      }, {
	        RelationshipType: "CONTAINS",
	        ValueType: "NUM",
	        ConceptNameCodeSequence: {
	          CodeValue: "G-A186",
	          CodingSchemeDesignator: "SRT",
	          CodeMeaning: "Short Axis"
	        },
	        MeasuredValueSequence: {
	          MeasurementUnitsCodeSequence: {
	            CodeValue: "mm",
	            CodingSchemeDesignator: "UCUM",
	            CodingSchemeVersion: "1.4",
	            CodeMeaning: "millimeter"
	          },
	          NumericValue: shortAxisLength
	        },
	        ContentSequence: {
	          RelationshipType: "INFERRED FROM",
	          ValueType: "SCOORD",
	          GraphicType: "POLYLINE",
	          GraphicData: [shortAxis.point1.x, shortAxis.point1.y, shortAxis.point2.x, shortAxis.point2.y],
	          ContentSequence: {
	            RelationshipType: "SELECTED FROM",
	            ValueType: "IMAGE",
	            ReferencedSOPSequence: ReferencedSOPSequence
	          }
	        }
	      }];
	    }
	  }]);

	  return Bidirectional;
	}(TID300Measurement);

	var Bidirectional$1 =
	/*#__PURE__*/
	function () {
	  function Bidirectional$$1() {
	    _classCallCheck(this, Bidirectional$$1);
	  }

	  _createClass(Bidirectional$$1, null, [{
	    key: "measurementContentToLengthState",
	    value: function measurementContentToLengthState(groupItemContent) {
	      var content = groupItemContent.ContentSequence;
	      var ReferencedSOPSequence = content.ContentSequence.ReferencedSOPSequence;
	      var ReferencedSOPInstanceUID = ReferencedSOPSequence.ReferencedSOPInstanceUID,
	          ReferencedFrameNumber = ReferencedSOPSequence.ReferencedFrameNumber;
	      var state = {
	        sopInstanceUid: ReferencedSOPInstanceUID,
	        frameIndex: ReferencedFrameNumber || 0,
	        toolType: Bidirectional$$1.toolType
	      }; // TODO: To be implemented!
	      // Needs to add longAxis, shortAxis, longAxisLength, shortAxisLength

	      return state;
	    } // TODO: this function is required for all Cornerstone Tool Adapters, since it is called by MeasurementReport.

	  }, {
	    key: "getMeasurementData",
	    value: function getMeasurementData(measurementContent) {
	      return measurementContent.map(Bidirectional$$1.measurementContentToLengthState);
	    }
	  }, {
	    key: "getTID300RepresentationArguments",
	    value: function getTID300RepresentationArguments(tool) {
	      var _tool$handles = tool.handles,
	          start = _tool$handles.start,
	          end = _tool$handles.end,
	          perpendicularStart = _tool$handles.perpendicularStart,
	          perpendicularEnd = _tool$handles.perpendicularEnd;
	      var shortestDiameter = tool.shortestDiameter,
	          longestDiameter = tool.longestDiameter;
	      return {
	        longAxis: {
	          point1: start,
	          point2: end
	        },
	        shortAxis: {
	          point1: perpendicularStart,
	          point2: perpendicularEnd
	        },
	        longAxisLength: longestDiameter,
	        shortAxisLength: shortestDiameter
	      };
	    }
	  }]);

	  return Bidirectional$$1;
	}();

	Bidirectional$1.toolType = "Bidirectional";
	Bidirectional$1.utilityToolType = "Bidirectional";
	Bidirectional$1.TID300Representation = Bidirectional;
	MeasurementReport.registerTool(Bidirectional$1);

	function iota(n) {
	  var result = new Array(n);
	  for(var i=0; i<n; ++i) {
	    result[i] = i;
	  }
	  return result
	}

	var iota_1 = iota;

	/*!
	 * Determine if an object is a Buffer
	 *
	 * @author   Feross Aboukhadijeh <https://feross.org>
	 * @license  MIT
	 */

	// The _isBuffer check is for Safari 5-7 support, because it's missing
	// Object.prototype.constructor. Remove this eventually
	var isBuffer_1 = function (obj) {
	  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
	};

	function isBuffer (obj) {
	  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
	}

	// For Node v0.10 support. Remove this eventually.
	function isSlowBuffer (obj) {
	  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
	}

	var hasTypedArrays  = ((typeof Float64Array) !== "undefined");

	function compare1st(a, b) {
	  return a[0] - b[0]
	}

	function order() {
	  var stride = this.stride;
	  var terms = new Array(stride.length);
	  var i;
	  for(i=0; i<terms.length; ++i) {
	    terms[i] = [Math.abs(stride[i]), i];
	  }
	  terms.sort(compare1st);
	  var result = new Array(terms.length);
	  for(i=0; i<result.length; ++i) {
	    result[i] = terms[i][1];
	  }
	  return result
	}

	function compileConstructor(dtype, dimension) {
	  var className = ["View", dimension, "d", dtype].join("");
	  if(dimension < 0) {
	    className = "View_Nil" + dtype;
	  }
	  var useGetters = (dtype === "generic");

	  if(dimension === -1) {
	    //Special case for trivial arrays
	    var code =
	      "function "+className+"(a){this.data=a;};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return -1};\
proto.size=0;\
proto.dimension=-1;\
proto.shape=proto.stride=proto.order=[];\
proto.lo=proto.hi=proto.transpose=proto.step=\
function(){return new "+className+"(this.data);};\
proto.get=proto.set=function(){};\
proto.pick=function(){return null};\
return function construct_"+className+"(a){return new "+className+"(a);}";
	    var procedure = new Function(code);
	    return procedure()
	  } else if(dimension === 0) {
	    //Special case for 0d arrays
	    var code =
	      "function "+className+"(a,d) {\
this.data = a;\
this.offset = d\
};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return this.offset};\
proto.dimension=0;\
proto.size=1;\
proto.shape=\
proto.stride=\
proto.order=[];\
proto.lo=\
proto.hi=\
proto.transpose=\
proto.step=function "+className+"_copy() {\
return new "+className+"(this.data,this.offset)\
};\
proto.pick=function "+className+"_pick(){\
return TrivialArray(this.data);\
};\
proto.valueOf=proto.get=function "+className+"_get(){\
return "+(useGetters ? "this.data.get(this.offset)" : "this.data[this.offset]")+
	"};\
proto.set=function "+className+"_set(v){\
return "+(useGetters ? "this.data.set(this.offset,v)" : "this.data[this.offset]=v")+"\
};\
return function construct_"+className+"(a,b,c,d){return new "+className+"(a,d)}";
	    var procedure = new Function("TrivialArray", code);
	    return procedure(CACHED_CONSTRUCTORS[dtype][0])
	  }

	  var code = ["'use strict'"];

	  //Create constructor for view
	  var indices = iota_1(dimension);
	  var args = indices.map(function(i) { return "i"+i });
	  var index_str = "this.offset+" + indices.map(function(i) {
	        return "this.stride[" + i + "]*i" + i
	      }).join("+");
	  var shapeArg = indices.map(function(i) {
	      return "b"+i
	    }).join(",");
	  var strideArg = indices.map(function(i) {
	      return "c"+i
	    }).join(",");
	  code.push(
	    "function "+className+"(a," + shapeArg + "," + strideArg + ",d){this.data=a",
	      "this.shape=[" + shapeArg + "]",
	      "this.stride=[" + strideArg + "]",
	      "this.offset=d|0}",
	    "var proto="+className+".prototype",
	    "proto.dtype='"+dtype+"'",
	    "proto.dimension="+dimension);

	  //view.size:
	  code.push("Object.defineProperty(proto,'size',{get:function "+className+"_size(){\
return "+indices.map(function(i) { return "this.shape["+i+"]" }).join("*"),
	"}})");

	  //view.order:
	  if(dimension === 1) {
	    code.push("proto.order=[0]");
	  } else {
	    code.push("Object.defineProperty(proto,'order',{get:");
	    if(dimension < 4) {
	      code.push("function "+className+"_order(){");
	      if(dimension === 2) {
	        code.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})");
	      } else if(dimension === 3) {
	        code.push(
	"var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);\
if(s0>s1){\
if(s1>s2){\
return [2,1,0];\
}else if(s0>s2){\
return [1,2,0];\
}else{\
return [1,0,2];\
}\
}else if(s0>s2){\
return [2,0,1];\
}else if(s2>s1){\
return [0,1,2];\
}else{\
return [0,2,1];\
}}})");
	      }
	    } else {
	      code.push("ORDER})");
	    }
	  }

	  //view.set(i0, ..., v):
	  code.push(
	"proto.set=function "+className+"_set("+args.join(",")+",v){");
	  if(useGetters) {
	    code.push("return this.data.set("+index_str+",v)}");
	  } else {
	    code.push("return this.data["+index_str+"]=v}");
	  }

	  //view.get(i0, ...):
	  code.push("proto.get=function "+className+"_get("+args.join(",")+"){");
	  if(useGetters) {
	    code.push("return this.data.get("+index_str+")}");
	  } else {
	    code.push("return this.data["+index_str+"]}");
	  }

	  //view.index:
	  code.push(
	    "proto.index=function "+className+"_index(", args.join(), "){return "+index_str+"}");

	  //view.hi():
	  code.push("proto.hi=function "+className+"_hi("+args.join(",")+"){return new "+className+"(this.data,"+
	    indices.map(function(i) {
	      return ["(typeof i",i,"!=='number'||i",i,"<0)?this.shape[", i, "]:i", i,"|0"].join("")
	    }).join(",")+","+
	    indices.map(function(i) {
	      return "this.stride["+i + "]"
	    }).join(",")+",this.offset)}");

	  //view.lo():
	  var a_vars = indices.map(function(i) { return "a"+i+"=this.shape["+i+"]" });
	  var c_vars = indices.map(function(i) { return "c"+i+"=this.stride["+i+"]" });
	  code.push("proto.lo=function "+className+"_lo("+args.join(",")+"){var b=this.offset,d=0,"+a_vars.join(",")+","+c_vars.join(","));
	  for(var i=0; i<dimension; ++i) {
	    code.push(
	"if(typeof i"+i+"==='number'&&i"+i+">=0){\
d=i"+i+"|0;\
b+=c"+i+"*d;\
a"+i+"-=d}");
	  }
	  code.push("return new "+className+"(this.data,"+
	    indices.map(function(i) {
	      return "a"+i
	    }).join(",")+","+
	    indices.map(function(i) {
	      return "c"+i
	    }).join(",")+",b)}");

	  //view.step():
	  code.push("proto.step=function "+className+"_step("+args.join(",")+"){var "+
	    indices.map(function(i) {
	      return "a"+i+"=this.shape["+i+"]"
	    }).join(",")+","+
	    indices.map(function(i) {
	      return "b"+i+"=this.stride["+i+"]"
	    }).join(",")+",c=this.offset,d=0,ceil=Math.ceil");
	  for(var i=0; i<dimension; ++i) {
	    code.push(
	"if(typeof i"+i+"==='number'){\
d=i"+i+"|0;\
if(d<0){\
c+=b"+i+"*(a"+i+"-1);\
a"+i+"=ceil(-a"+i+"/d)\
}else{\
a"+i+"=ceil(a"+i+"/d)\
}\
b"+i+"*=d\
}");
	  }
	  code.push("return new "+className+"(this.data,"+
	    indices.map(function(i) {
	      return "a" + i
	    }).join(",")+","+
	    indices.map(function(i) {
	      return "b" + i
	    }).join(",")+",c)}");

	  //view.transpose():
	  var tShape = new Array(dimension);
	  var tStride = new Array(dimension);
	  for(var i=0; i<dimension; ++i) {
	    tShape[i] = "a[i"+i+"]";
	    tStride[i] = "b[i"+i+"]";
	  }
	  code.push("proto.transpose=function "+className+"_transpose("+args+"){"+
	    args.map(function(n,idx) { return n + "=(" + n + "===undefined?" + idx + ":" + n + "|0)"}).join(";"),
	    "var a=this.shape,b=this.stride;return new "+className+"(this.data,"+tShape.join(",")+","+tStride.join(",")+",this.offset)}");

	  //view.pick():
	  code.push("proto.pick=function "+className+"_pick("+args+"){var a=[],b=[],c=this.offset");
	  for(var i=0; i<dimension; ++i) {
	    code.push("if(typeof i"+i+"==='number'&&i"+i+">=0){c=(c+this.stride["+i+"]*i"+i+")|0}else{a.push(this.shape["+i+"]);b.push(this.stride["+i+"])}");
	  }
	  code.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}");

	  //Add return statement
	  code.push("return function construct_"+className+"(data,shape,stride,offset){return new "+className+"(data,"+
	    indices.map(function(i) {
	      return "shape["+i+"]"
	    }).join(",")+","+
	    indices.map(function(i) {
	      return "stride["+i+"]"
	    }).join(",")+",offset)}");

	  //Compile procedure
	  var procedure = new Function("CTOR_LIST", "ORDER", code.join("\n"));
	  return procedure(CACHED_CONSTRUCTORS[dtype], order)
	}

	function arrayDType(data) {
	  if(isBuffer_1(data)) {
	    return "buffer"
	  }
	  if(hasTypedArrays) {
	    switch(Object.prototype.toString.call(data)) {
	      case "[object Float64Array]":
	        return "float64"
	      case "[object Float32Array]":
	        return "float32"
	      case "[object Int8Array]":
	        return "int8"
	      case "[object Int16Array]":
	        return "int16"
	      case "[object Int32Array]":
	        return "int32"
	      case "[object Uint8Array]":
	        return "uint8"
	      case "[object Uint16Array]":
	        return "uint16"
	      case "[object Uint32Array]":
	        return "uint32"
	      case "[object Uint8ClampedArray]":
	        return "uint8_clamped"
	    }
	  }
	  if(Array.isArray(data)) {
	    return "array"
	  }
	  return "generic"
	}

	var CACHED_CONSTRUCTORS = {
	  "float32":[],
	  "float64":[],
	  "int8":[],
	  "int16":[],
	  "int32":[],
	  "uint8":[],
	  "uint16":[],
	  "uint32":[],
	  "array":[],
	  "uint8_clamped":[],
	  "buffer":[],
	  "generic":[]
	}

	;
	function wrappedNDArrayCtor(data, shape, stride, offset) {
	  if(data === undefined) {
	    var ctor = CACHED_CONSTRUCTORS.array[0];
	    return ctor([])
	  } else if(typeof data === "number") {
	    data = [data];
	  }
	  if(shape === undefined) {
	    shape = [ data.length ];
	  }
	  var d = shape.length;
	  if(stride === undefined) {
	    stride = new Array(d);
	    for(var i=d-1, sz=1; i>=0; --i) {
	      stride[i] = sz;
	      sz *= shape[i];
	    }
	  }
	  if(offset === undefined) {
	    offset = 0;
	    for(var i=0; i<d; ++i) {
	      if(stride[i] < 0) {
	        offset -= (shape[i]-1)*stride[i];
	      }
	    }
	  }
	  var dtype = arrayDType(data);
	  var ctor_list = CACHED_CONSTRUCTORS[dtype];
	  while(ctor_list.length <= d+1) {
	    ctor_list.push(compileConstructor(dtype, ctor_list.length-1));
	  }
	  var ctor = ctor_list[d+1];
	  return ctor(data, shape, stride, offset)
	}

	var ndarray = wrappedNDArrayCtor;

	/**
	 * crossProduct3D - Returns the cross product of a and b.
	 *
	 * @param  {Number[3]} a Vector a.
	 * @param  {Number[3]} b Vector b.
	 * @return {Number[3]}   The cross product.
	 */
	function crossProduct3D (a, b) {
	  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
	}

	var flipImageOrientationPatient = {
	  /**
	   * h: Flips ImageOrientationPatient in the horizontal direction.
	   * @param {Number[6]} iop - ImageOrientationPatient
	   * @returns {Number[6]} The transformed ImageOrientationPatient
	   */
	  h: function h(iop) {
	    return [iop[0], iop[1], iop[2], -iop[3], -iop[4], -iop[5]];
	  },

	  /**
	   * v: Flips ImageOrientationPatient in the vertical direction.
	   * @param {Number[6]} iop - ImageOrientationPatient
	   * @returns {Number[6]} The transformed ImageOrientationPatient
	   */
	  v: function v(iop) {
	    return [-iop[0], -iop[1], -iop[2], iop[3], iop[4], iop[5]];
	  },

	  /**
	   * hv: Flips ImageOrientationPatient in the horizontal and vertical directions.
	   * @param {Number[6]} iop - ImageOrientationPatient
	   * @returns {Number[6]} The transformed ImageOrientationPatient
	   */
	  hv: function hv(iop) {
	    return [-iop[0], -iop[1], -iop[2], -iop[3], -iop[4], -iop[5]];
	  }
	};

	/**
	 * rotateVectorAroundUnitVector - Rotates vector v around unit vector k using
	 *                                Rodrigues' rotation formula.
	 *
	 * @param  {Number[3]} v     The vector to rotate.
	 * @param  {Number[3]} k     The unit vector of the axis of rotation.
	 * @param  {Number} theta    The rotation magnitude in radians.
	 * @return {Number[3]}       The rotated v vector.
	 */

	function rotateVectorAroundUnitVector (v, k, theta) {
	  var cosTheta = Math.cos(theta);
	  var sinTheta = Math.sin(theta);
	  var oneMinusCosTheta = 1.0 - cosTheta;
	  var kdotv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
	  var vRot = [];
	  var kxv = crossProduct3D(k, v);

	  for (var i = 0; i <= 2; i++) {
	    vRot[i] = v[i] * cosTheta + kxv[i] * sinTheta + k[i] * kdotv * oneMinusCosTheta;
	  }

	  return vRot;
	}

	/**
	 * rotateDirectionCosinesInPlane - rotates the row and column cosines around
	 * their normal by angle theta.
	 *
	 * @param  {Number[6]} iop   The row (0..2) an column (3..5) direction cosines.
	 * @param  {Number} theta The rotation magnitude in radians.
	 * @return {Number[6]}       The rotate row (0..2) and column (3..5) direction cosines.
	 */

	function rotateDirectionCosinesInPlane (iop, theta) {
	  var r = [iop[0], iop[1], iop[2]];
	  var c = [iop[3], iop[4], iop[5]];
	  var rxc = crossProduct3D(r, c);
	  var rRot = rotateVectorAroundUnitVector(r, rxc, theta);
	  var cRot = crossProduct3D(rxc, rRot);

	  for (var i = 0; i < 2; i++) {
	    cRot[i] *= -1.0;
	  }

	  return [].concat(_toConsumableArray(rRot), _toConsumableArray(cRot));
	}

	var flipMatrix2D = {
	  h: h,
	  v: v
	};
	/**
	 * flipMatrix2D.h - Flips a 2D matrix in the horizontal direction.
	 *
	 * @param  {Ndarry} matrix The matrix to flip.
	 * @return {Ndarry}   The flipped matrix.
	 */

	function h(matrix) {
	  var _matrix$shape = _slicedToArray(matrix.shape, 2),
	      rows = _matrix$shape[0],
	      cols = _matrix$shape[1];

	  var result = ndarray(new Uint8Array(rows * cols), [rows, cols]);

	  for (var i = 0; i < rows; i++) {
	    for (var j = 0; j < cols; j++) {
	      result.set(i, j, matrix.get(i, cols - 1 - j));
	    }
	  }

	  return result;
	}
	/**
	 * flipMatrix2D.h - Flips a 2D matrix in the vertical direction.
	 *
	 * @param  {Ndarry} matrix The matrix to flip.
	 * @return {Ndarry}   The flipped matrix.
	 */


	function v(matrix) {
	  var _matrix$shape2 = _slicedToArray(matrix.shape, 2),
	      rows = _matrix$shape2[0],
	      cols = _matrix$shape2[1];

	  var result = ndarray(new Uint8Array(rows * cols), [rows, cols]);

	  for (var j = 0; j < cols; j++) {
	    for (var i = 0; i < rows; i++) {
	      result.set(i, j, matrix.get(rows - 1 - i, j));
	    }
	  }

	  return result;
	}

	/**
	 * anonymous function - Rotates a matrix by 90 degrees.
	 *
	 * @param  {Ndarray} matrix The matrix to rotate.
	 * @return {Ndarry}        The rotated matrix.
	 */

	function rotateMatrix902D (matrix) {
	  var _matrix$shape = _slicedToArray(matrix.shape, 2),
	      rows = _matrix$shape[0],
	      cols = _matrix$shape[1]; //debugPrintMatrix(matrix);


	  var result = ndarray(new Uint8Array(rows * cols), [cols, rows]);
	  var resultColsMinus1 = result.shape[1] - 1;

	  for (var i = 0; i < rows; i++) {
	    for (var j = 0; j < cols; j++) {
	      result.set(j, resultColsMinus1 - i, matrix.get(i, j));
	    }
	  } //debugPrintMatrix(result);


	  return result;
	}

	var Segmentation$1 = {
	  generateSegmentation: generateSegmentation,
	  generateToolState: generateToolState
	};
	/**
	 *
	 * @typedef {Object} BrushData
	 * @property {Object} toolState - The cornerstoneTools global toolState.
	 * @property {Object[]} segments - The cornerstoneTools segment metadata that corresponds to the
	 *                                 seriesInstanceUid.
	 */

	/**
	 * generateSegmentation - Generates cornerstoneTools brush data, given a stack of
	 * imageIds, images and the cornerstoneTools brushData.
	 *
	 * @param  {object[]} images    An array of the cornerstone image objects.
	 * @param  {BrushData} brushData and object containing the brushData.
	 * @returns {type}           description
	 */

	function generateSegmentation(images, brushData) {
	  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
	    includeSliceSpacing: true
	  };
	  // NOTE: Currently if a brush has been used and then erased,
	  // This will flag up as a segmentation, even though its full of zeros.
	  // Fixing this cleanly requires an update of cornerstoneTools. Soon (TM).
	  var toolState = brushData.toolState,
	      segments = brushData.segments; // Calculate the dimensions of the data cube.

	  var image0 = images[0];
	  var dims = {
	    x: image0.columns,
	    y: image0.rows,
	    z: images.length
	  };
	  dims.xy = dims.x * dims.y;

	  var numSegments = _getSegCount(seg, segments);

	  if (!numSegments) {
	    throw new Error("No segments to export!");
	  }

	  var isMultiframe = image0.imageId.includes("?frame");

	  var seg = _createSegFromImages(images, isMultiframe, options);

	  var _getNumberOfFramesPer = _getNumberOfFramesPerSegment(toolState, images, segments),
	      referencedFramesPerSegment = _getNumberOfFramesPer.referencedFramesPerSegment,
	      segmentIndicies = _getNumberOfFramesPer.segmentIndicies;

	  var NumberOfFrames = 0;

	  for (var i = 0; i < referencedFramesPerSegment.length; i++) {
	    NumberOfFrames += referencedFramesPerSegment[i].length;
	  }

	  seg.setNumberOfFrames(NumberOfFrames);

	  for (var _i = 0; _i < segmentIndicies.length; _i++) {
	    var segmentIndex = segmentIndicies[_i];
	    var referencedFrameIndicies = referencedFramesPerSegment[_i]; // Frame numbers start from 1.

	    var referencedFrameNumbers = referencedFrameIndicies.map(function (element) {
	      return element + 1;
	    });
	    var segment = segments[segmentIndex];
	    seg.addSegment(segment, _extractCornerstoneToolsPixelData(segmentIndex, referencedFrameIndicies, toolState, images, dims), referencedFrameNumbers);
	  }

	  var segBlob = datasetToBlob(seg.dataset);
	  return segBlob;
	}

	function _extractCornerstoneToolsPixelData(segmentIndex, referencedFrames, toolState, images, dims) {
	  var pixelData = new Uint8Array(dims.xy * referencedFrames.length);
	  var pixelDataIndex = 0;

	  for (var i = 0; i < referencedFrames.length; i++) {
	    var frame = referencedFrames[i];
	    var imageId = images[frame].imageId;
	    var imageIdSpecificToolState = toolState[imageId];
	    var brushPixelData = imageIdSpecificToolState.brush.data[segmentIndex].pixelData;

	    for (var p = 0; p < brushPixelData.length; p++) {
	      pixelData[pixelDataIndex] = brushPixelData[p];
	      pixelDataIndex++;
	    }
	  }

	  return pixelData;
	}

	function _getNumberOfFramesPerSegment(toolState, images, segments) {
	  var segmentIndicies = [];
	  var referencedFramesPerSegment = [];

	  for (var i = 0; i < segments.length; i++) {
	    if (segments[i]) {
	      segmentIndicies.push(i);
	      referencedFramesPerSegment.push([]);
	    }
	  }

	  for (var z = 0; z < images.length; z++) {
	    var imageId = images[z].imageId;
	    var imageIdSpecificToolState = toolState[imageId];

	    for (var _i2 = 0; _i2 < segmentIndicies.length; _i2++) {
	      var segIdx = segmentIndicies[_i2];

	      if (imageIdSpecificToolState && imageIdSpecificToolState.brush && imageIdSpecificToolState.brush.data && imageIdSpecificToolState.brush.data[segIdx] && imageIdSpecificToolState.brush.data[segIdx].pixelData) {
	        referencedFramesPerSegment[_i2].push(z);
	      }
	    }
	  }

	  return {
	    referencedFramesPerSegment: referencedFramesPerSegment,
	    segmentIndicies: segmentIndicies
	  };
	}

	function _getSegCount(seg, segments) {
	  var numSegments = 0;

	  for (var i = 0; i < segments.length; i++) {
	    if (segments[i]) {
	      numSegments++;
	    }
	  }

	  return numSegments;
	}
	/**
	 * _createSegFromImages - description
	 *
	 * @param  {Object[]} images    An array of the cornerstone image objects.
	 * @param  {Boolean} isMultiframe Whether the images are multiframe.
	 * @returns {Object}              The Seg derived dataSet.
	 */


	function _createSegFromImages(images, isMultiframe, options) {
	  var datasets = [];

	  if (isMultiframe) {
	    var image = images[0];
	    var arrayBuffer = image.data.byteArray.buffer;
	    var dicomData = DicomMessage.readFile(arrayBuffer);
	    var dataset = DicomMetaDictionary.naturalizeDataset(dicomData.dict);
	    dataset._meta = DicomMetaDictionary.namifyDataset(dicomData.meta);
	    datasets.push(dataset);
	  } else {
	    for (var i = 0; i < images.length; i++) {
	      var _image = images[i];
	      var _arrayBuffer = _image.data.byteArray.buffer;

	      var _dicomData = DicomMessage.readFile(_arrayBuffer);

	      var _dataset = DicomMetaDictionary.naturalizeDataset(_dicomData.dict);

	      _dataset._meta = DicomMetaDictionary.namifyDataset(_dicomData.meta);
	      datasets.push(_dataset);
	    }
	  }

	  var multiframe = Normalizer.normalizeToDataset(datasets);
	  return new Segmentation([multiframe], options);
	}
	/**
	 * generateToolState - Given a set of cornrstoneTools imageIds and a Segmentation buffer,
	 * derive cornerstoneTools toolState and brush metadata.
	 *
	 * @param  {string[]} imageIds    An array of the imageIds.
	 * @param  {ArrayBuffer} arrayBuffer The SEG arrayBuffer.
	 * @param {*} metadataProvider
	 * @returns {Object}  The toolState and an object from which the
	 *                    segment metadata can be derived.
	 */


	function generateToolState(imageIds, arrayBuffer, metadataProvider) {
	  var dicomData = DicomMessage.readFile(arrayBuffer);
	  var dataset = DicomMetaDictionary.naturalizeDataset(dicomData.dict);
	  dataset._meta = DicomMetaDictionary.namifyDataset(dicomData.meta);
	  var multiframe = Normalizer.normalizeToDataset([dataset]);
	  var imagePlaneModule = metadataProvider.get("imagePlaneModule", imageIds[0]);

	  if (!imagePlaneModule) {
	    console.warn("Insufficient metadata, imagePlaneModule missing.");
	  }

	  var ImageOrientationPatient = Array.isArray(imagePlaneModule.rowCosines) ? [].concat(_toConsumableArray(imagePlaneModule.rowCosines), _toConsumableArray(imagePlaneModule.columnCosines)) : [imagePlaneModule.rowCosines.x, imagePlaneModule.rowCosines.y, imagePlaneModule.rowCosines.z, imagePlaneModule.columnCosines.x, imagePlaneModule.columnCosines.y, imagePlaneModule.columnCosines.z]; // Get IOP from ref series, compute supported orientations:

	  var validOrientations = getValidOrientations(ImageOrientationPatient);
	  var SharedFunctionalGroupsSequence = multiframe.SharedFunctionalGroupsSequence;
	  var sharedImageOrientationPatient = SharedFunctionalGroupsSequence.PlaneOrientationSequence ? SharedFunctionalGroupsSequence.PlaneOrientationSequence.ImageOrientationPatient : undefined;
	  var sliceLength = multiframe.Columns * multiframe.Rows;
	  var segMetadata = getSegmentMetadata(multiframe);
	  var pixelData = unpackPixelData(multiframe);
	  var PerFrameFunctionalGroupsSequence = multiframe.PerFrameFunctionalGroupsSequence;
	  var toolState = {};
	  var inPlane = true;

	  for (var i = 0; i < PerFrameFunctionalGroupsSequence.length; i++) {
	    var PerFrameFunctionalGroups = PerFrameFunctionalGroupsSequence[i];
	    var ImageOrientationPatientI = sharedImageOrientationPatient || PerFrameFunctionalGroups.PlaneOrientationSequence.ImageOrientationPatient;
	    var pixelDataI2D = ndarray(new Uint8Array(pixelData.buffer, i * sliceLength, sliceLength), [multiframe.Rows, multiframe.Columns]);
	    var alignedPixelDataI = alignPixelDataWithSourceData(pixelDataI2D, ImageOrientationPatientI, validOrientations);

	    if (!alignedPixelDataI) {
	      console.warn("This segmentation object is not in-plane with the source data. Bailing out of IO. It'd be better to render this with vtkjs. ");
	      inPlane = false;
	      break;
	    }

	    var segmentIndex = PerFrameFunctionalGroups.SegmentIdentificationSequence.ReferencedSegmentNumber - 1;
	    var SourceImageSequence = void 0;

	    if (SharedFunctionalGroupsSequence.DerivationImageSequence && SharedFunctionalGroupsSequence.DerivationImageSequence.SourceImageSequence) {
	      SourceImageSequence = SharedFunctionalGroupsSequence.DerivationImageSequence.SourceImageSequence[i];
	    } else {
	      SourceImageSequence = PerFrameFunctionalGroups.DerivationImageSequence.SourceImageSequence;
	    }

	    var imageId = getImageIdOfSourceImage(SourceImageSequence, imageIds, metadataProvider);
	    addImageIdSpecificBrushToolState(toolState, imageId, segmentIndex, alignedPixelDataI);
	  }

	  if (!inPlane) {
	    return;
	  }

	  return {
	    toolState: toolState,
	    segMetadata: segMetadata
	  };
	}
	/**
	 * unpackPixelData - Unpacks bitpacked pixelData if the Segmentation is BINARY.
	 *
	 * @param  {Object} multiframe The multiframe dataset.
	 * @return {Uint8Array}      The unpacked pixelData.
	 */


	function unpackPixelData(multiframe) {
	  var segType = multiframe.SegmentationType;

	  if (segType === "BINARY") {
	    return BitArray.unpack(multiframe.PixelData);
	  }

	  var pixelData = new Uint8Array(multiframe.PixelData);
	  var max = multiframe.MaximumFractionalValue;
	  var onlyMaxAndZero = pixelData.find(function (element) {
	    return element !== 0 && element !== max;
	  }) === undefined;

	  if (!onlyMaxAndZero) {
	    lib.warn("This is a fractional segmentation, which is not currently supported.");
	    return;
	  }

	  lib.warn("This segmentation object is actually binary... processing as such.");
	  return pixelData;
	}
	/**
	 * addImageIdSpecificBrushToolState - Adds brush pixel data to cornerstoneTools
	 * formatted toolState object.
	 *
	 * @param  {Object} toolState    The toolState object to modify
	 * @param  {String} imageId      The imageId of the toolState to add the data.
	 * @param  {Number} segmentIndex The index of the segment data being added.
	 * @param  {Ndarray} pixelData2D  The pixelData in Ndarry 2D format.
	 */


	function addImageIdSpecificBrushToolState(toolState, imageId, segmentIndex, pixelData2D) {
	  if (!toolState[imageId]) {
	    toolState[imageId] = {};
	    toolState[imageId].brush = {};
	    toolState[imageId].brush.data = [];
	  } else if (!toolState[imageId].brush) {
	    toolState[imageId].brush = {};
	    toolState[imageId].brush.data = [];
	  } else if (!toolState[imageId].brush.data) {
	    toolState[imageId].brush.data = [];
	  }

	  toolState[imageId].brush.data[segmentIndex] = {};
	  var brushDataI = toolState[imageId].brush.data[segmentIndex];
	  brushDataI.pixelData = new Uint8Array(pixelData2D.data.length);
	  var cToolsPixelData = brushDataI.pixelData;

	  var _pixelData2D$shape = _slicedToArray(pixelData2D.shape, 2),
	      rows = _pixelData2D$shape[0],
	      cols = _pixelData2D$shape[1];

	  for (var p = 0; p < cToolsPixelData.length; p++) {
	    if (pixelData2D.data[p]) {
	      cToolsPixelData[p] = 1;
	    } else {
	      cToolsPixelData[p] = 0;
	    }
	  }
	}
	/**
	 * getImageIdOfSourceImage - Returns the Cornerstone imageId of the source image.
	 *
	 * @param  {Object} SourceImageSequence Sequence describing the source image.
	 * @param  {String[]} imageIds          A list of imageIds.
	 * @param  {Object} metadataProvider    A Cornerstone metadataProvider to query
	 *                                      metadata from imageIds.
	 * @return {String}                     The corresponding imageId.
	 */


	function getImageIdOfSourceImage(SourceImageSequence, imageIds, metadataProvider) {
	  var ReferencedSOPInstanceUID = SourceImageSequence.ReferencedSOPInstanceUID,
	      ReferencedFrameNumber = SourceImageSequence.ReferencedFrameNumber;
	  return ReferencedFrameNumber ? getImageIdOfReferencedFrame(ReferencedSOPInstanceUID, ReferencedFrameNumber, imageIds, metadataProvider) : getImageIdOfReferencedSingleFramedSOPInstance(ReferencedSOPInstanceUID, imageIds, metadataProvider);
	}
	/**
	 * getImageIdOfReferencedSingleFramedSOPInstance - Returns the imageId
	 * corresponding to the specified sopInstanceUid for single-frame images.
	 *
	 * @param  {String} sopInstanceUid   The sopInstanceUid of the desired image.
	 * @param  {String[]} imageIds         The list of imageIds.
	 * @param  {Object} metadataProvider The metadataProvider to obtain sopInstanceUids
	 *                                 from the cornerstone imageIds.
	 * @return {String}                  The imageId that corresponds to the sopInstanceUid.
	 */


	function getImageIdOfReferencedSingleFramedSOPInstance(sopInstanceUid, imageIds, metadataProvider) {
	  return imageIds.find(function (imageId) {
	    var sopCommonModule = metadataProvider.get("sopCommonModule", imageId);

	    if (!sopCommonModule) {
	      return;
	    }

	    return sopCommonModule.sopInstanceUID === sopInstanceUid;
	  });
	}
	/**
	 * getImageIdOfReferencedFrame - Returns the imageId corresponding to the
	 * specified sopInstanceUid and frameNumber for multi-frame images.
	 *
	 * @param  {String} sopInstanceUid   The sopInstanceUid of the desired image.
	 * @param  {Number} frameNumber      The frame number.
	 * @param  {String} imageIds         The list of imageIds.
	 * @param  {Object} metadataProvider The metadataProvider to obtain sopInstanceUids
	 *                                   from the cornerstone imageIds.
	 * @return {String}                  The imageId that corresponds to the sopInstanceUid.
	 */


	function getImageIdOfReferencedFrame(sopInstanceUid, frameNumber, imageIds, metadataProvider) {
	  var imageId = imageIds.find(function (imageId) {
	    var sopCommonModule = metadataProvider.get("sopCommonModule", imageId);

	    if (!sopCommonModule) {
	      return;
	    }

	    var imageIdFrameNumber = Number(imageId.split("frame=")[1]);
	    return (//frameNumber is zero indexed for cornerstoneWADOImageLoader image Ids.
	      sopCommonModule.sopInstanceUID === sopInstanceUid && imageIdFrameNumber === frameNumber - 1
	    );
	  });
	  return imageId;
	}
	/**
	 * getValidOrientations - returns an array of valid orientations.
	 *
	 * @param  {Number[6]} iop The row (0..2) an column (3..5) direction cosines.
	 * @return {Number[8][6]} An array of valid orientations.
	 */


	function getValidOrientations(iop) {
	  var orientations = []; // [0,  1,  2]: 0,   0hf,   0vf
	  // [3,  4,  5]: 90,  90hf,  90vf
	  // [6, 7]:      180, 270

	  orientations[0] = iop;
	  orientations[1] = flipImageOrientationPatient.h(iop);
	  orientations[2] = flipImageOrientationPatient.v(iop);
	  var iop90 = rotateDirectionCosinesInPlane(iop, Math.PI / 2);
	  orientations[3] = iop90;
	  orientations[4] = flipImageOrientationPatient.h(iop90);
	  orientations[5] = flipImageOrientationPatient.v(iop90);
	  orientations[6] = rotateDirectionCosinesInPlane(iop, Math.PI);
	  orientations[7] = rotateDirectionCosinesInPlane(iop, 1.5 * Math.PI);
	  return orientations;
	}
	/**
	 * alignPixelDataWithSourceData -
	 *
	 * @param {Ndarray} pixelData2D The data to align.
	 * @param  {Number[6]} iop The orientation of the image slice.
	 * @param  {Number[8][6]} orientations   An array of valid imageOrientationPatient values.
	 * @return {Ndarray}                         The aligned pixelData.
	 */


	function alignPixelDataWithSourceData(pixelData2D, iop, orientations) {
	  if (compareIOP(iop, orientations[0])) {
	    //Same orientation.
	    return pixelData2D;
	  } else if (compareIOP(iop, orientations[1])) {
	    //Flipped vertically.
	    return flipMatrix2D.v(pixelData2D);
	  } else if (compareIOP(iop, orientations[2])) {
	    //Flipped horizontally.
	    return flipMatrix2D.h(pixelData2D);
	  } else if (compareIOP(iop, orientations[3])) {
	    //Rotated 90 degrees.
	    return rotateMatrix902D(pixelData2D);
	  } else if (compareIOP(iop, orientations[4])) {
	    //Rotated 90 degrees and fliped horizontally.
	    return flipMatrix2D.h(rotateMatrix902D(pixelData2D));
	  } else if (compareIOP(iop, orientations[5])) {
	    //Rotated 90 degrees and fliped vertically.
	    return flipMatrix2D.v(rotateMatrix902D(pixelData2D));
	  } else if (compareIOP(iop, orientations[6])) {
	    //Rotated 180 degrees. // TODO -> Do this more effeciently, there is a 1:1 mapping like 90 degree rotation.
	    return rotateMatrix902D(rotateMatrix902D(pixelData2D));
	  } else if (compareIOP(iop, orientations[7])) {
	    //Rotated 270 degrees.  // TODO -> Do this more effeciently, there is a 1:1 mapping like 90 degree rotation.
	    return rotateMatrix902D(rotateMatrix902D(rotateMatrix902D(pixelData2D)));
	  }
	}

	var dx = 1e-5;
	/**
	 * compareIOP - Returns true if iop1 and iop2 are equal
	 * within a tollerance, dx.
	 *
	 * @param  {Number[6]} iop1 An ImageOrientationPatient array.
	 * @param  {Number[6]} iop2 An ImageOrientationPatient array.
	 * @return {Boolean}      True if iop1 and iop2 are equal.
	 */

	function compareIOP(iop1, iop2) {
	  return Math.abs(iop1[0] - iop2[0]) < dx && Math.abs(iop1[1] - iop2[1]) < dx && Math.abs(iop1[2] - iop2[2]) < dx && Math.abs(iop1[3] - iop2[3]) < dx && Math.abs(iop1[4] - iop2[4]) < dx && Math.abs(iop1[5] - iop2[5]) < dx;
	}

	function getSegmentMetadata(multiframe) {
	  var data = [];
	  var segmentSequence = multiframe.SegmentSequence;

	  if (Array.isArray(segmentSequence)) {
	    for (var segIdx = 0; segIdx < segmentSequence.length; segIdx++) {
	      data.push(segmentSequence[segIdx]);
	    }
	  } else {
	    // Only one segment, will be stored as an object.
	    data.push(segmentSequence);
	  }

	  return {
	    seriesInstanceUid: multiframe.ReferencedSeriesSequence.SeriesInstanceUID,
	    data: data
	  };
	}

	var Cornerstone = {
	  Length: Length$1,
	  Freehand: Freehand,
	  Bidirectional: Bidirectional$1,
	  MeasurementReport: MeasurementReport,
	  Segmentation: Segmentation$1
	};

	// Should we move it to Colors.js

	function dicomlab2RGBA(cielab) {
	  var rgba = Colors.dicomlab2RGB(cielab).map(function (x) {
	    return Math.round(x * 255);
	  });
	  rgba.push(255);
	  return rgba;
	} // TODO: Copied these functions in from VTK Math so we don't need a dependency.
	// I guess we should put them somewhere
	// https://github.com/Kitware/vtk-js/blob/master/Sources/Common/Core/Math/index.js


	function cross(x, y, out) {
	  var Zx = x[1] * y[2] - x[2] * y[1];
	  var Zy = x[2] * y[0] - x[0] * y[2];
	  var Zz = x[0] * y[1] - x[1] * y[0];
	  out[0] = Zx;
	  out[1] = Zy;
	  out[2] = Zz;
	}

	function norm(x) {
	  var n = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 3;

	  switch (n) {
	    case 1:
	      return Math.abs(x);

	    case 2:
	      return Math.sqrt(x[0] * x[0] + x[1] * x[1]);

	    case 3:
	      return Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);

	    default:
	      {
	        var sum = 0;

	        for (var i = 0; i < n; i++) {
	          sum += x[i] * x[i];
	        }

	        return Math.sqrt(sum);
	      }
	  }
	}

	function normalize(x) {
	  var den = norm(x);

	  if (den !== 0.0) {
	    x[0] /= den;
	    x[1] /= den;
	    x[2] /= den;
	  }

	  return den;
	}

	function subtract(a, b, out) {
	  out[0] = a[0] - b[0];
	  out[1] = a[1] - b[1];
	  out[2] = a[2] - b[2];
	} // TODO: This is a useful utility on its own. We should move it somewhere?
	// dcmjs.adapters.vtk.Multiframe? dcmjs.utils?


	function geometryFromFunctionalGroups(dataset, PerFrameFunctionalGroups) {
	  var geometry = {};
	  var pixelMeasures = dataset.SharedFunctionalGroupsSequence.PixelMeasuresSequence;
	  var planeOrientation = dataset.SharedFunctionalGroupsSequence.PlaneOrientationSequence; // Find the origin of the volume from the PerFrameFunctionalGroups' ImagePositionPatient values
	  //
	  // TODO: assumes sorted frames. This should read the ImagePositionPatient from each frame and
	  // sort them to obtain the first and last position along the acquisition axis.

	  var firstFunctionalGroup = PerFrameFunctionalGroups[0];
	  var lastFunctionalGroup = PerFrameFunctionalGroups[PerFrameFunctionalGroups.length - 1];
	  var firstPosition = firstFunctionalGroup.PlanePositionSequence.ImagePositionPatient.map(Number);
	  var lastPosition = lastFunctionalGroup.PlanePositionSequence.ImagePositionPatient.map(Number);
	  geometry.origin = firstPosition; // NB: DICOM PixelSpacing is defined as Row then Column,
	  // unlike ImageOrientationPatient

	  geometry.spacing = [pixelMeasures.PixelSpacing[1], pixelMeasures.PixelSpacing[0], pixelMeasures.SpacingBetweenSlices].map(Number);
	  geometry.dimensions = [dataset.Columns, dataset.Rows, PerFrameFunctionalGroups.length].map(Number);
	  var orientation = planeOrientation.ImageOrientationPatient.map(Number);
	  var columnStepToPatient = orientation.slice(0, 3);
	  var rowStepToPatient = orientation.slice(3, 6);
	  geometry.planeNormal = [];
	  cross(columnStepToPatient, rowStepToPatient, geometry.planeNormal);
	  geometry.sliceStep = [];
	  subtract(lastPosition, firstPosition, geometry.sliceStep);
	  normalize(geometry.sliceStep);
	  geometry.direction = columnStepToPatient.concat(rowStepToPatient).concat(geometry.sliceStep);
	  return geometry;
	}

	var Segmentation$2 =
	/*#__PURE__*/
	function () {
	  function Segmentation() {
	    _classCallCheck(this, Segmentation);
	  }
	  /**
	   * Produces an array of Segments from an input DICOM Segmentation dataset
	   *
	   * Segments are returned with Geometry values that can be used to create
	   * VTK Image Data objects.
	   *
	   * @example Example usage to create VTK Volume actors from each segment:
	   *
	   * const actors = [];
	   * const segments = generateToolState(dataset);
	   * segments.forEach(segment => {
	   *   // now make actors using the segment information
	   *   const scalarArray = vtk.Common.Core.vtkDataArray.newInstance({
	   *        name: "Scalars",
	   *        numberOfComponents: 1,
	   *        values: segment.pixelData,
	   *    });
	   *
	   *    const imageData = vtk.Common.DataModel.vtkImageData.newInstance();
	   *    imageData.getPointData().setScalars(scalarArray);
	   *    imageData.setDimensions(geometry.dimensions);
	   *    imageData.setSpacing(geometry.spacing);
	   *    imageData.setOrigin(geometry.origin);
	   *    imageData.setDirection(geometry.direction);
	   *
	   *    const mapper = vtk.Rendering.Core.vtkVolumeMapper.newInstance();
	   *    mapper.setInputData(imageData);
	   *    mapper.setSampleDistance(2.);
	   *
	   *    const actor = vtk.Rendering.Core.vtkVolume.newInstance();
	   *    actor.setMapper(mapper);
	   *
	   *    actors.push(actor);
	   * });
	   *
	   * @param dataset
	   * @return {{}}
	   */


	  _createClass(Segmentation, null, [{
	    key: "generateSegments",
	    value: function generateSegments(dataset) {
	      if (dataset.SegmentSequence.constructor.name !== "Array") {
	        dataset.SegmentSequence = [dataset.SegmentSequence];
	      }

	      dataset.SegmentSequence.forEach(function (segment) {
	        // TODO: other interesting fields could be extracted from the segment
	        // TODO: Read SegmentsOverlay field
	        // http://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.8.20.2.html
	        // TODO: Looks like vtkColor only wants RGB in 0-1 values.
	        // Why was this example converting to RGBA with 0-255 values?
	        var color = dicomlab2RGBA(segment.RecommendedDisplayCIELabValue);
	        segments[segment.SegmentNumber] = {
	          color: color,
	          functionalGroups: [],
	          offset: null,
	          size: null,
	          pixelData: null
	        };
	      }); // make a list of functional groups per segment

	      dataset.PerFrameFunctionalGroupsSequence.forEach(function (functionalGroup) {
	        var segmentNumber = functionalGroup.SegmentIdentificationSequence.ReferencedSegmentNumber;
	        segments[segmentNumber].functionalGroups.push(functionalGroup);
	      }); // determine per-segment index into the pixel data
	      // TODO: only handles one-bit-per pixel

	      var frameSize = Math.ceil(dataset.Rows * dataset.Columns / 8);
	      var nextOffset = 0;
	      Object.keys(segments).forEach(function (segmentNumber) {
	        var segment = segments[segmentNumber];
	        segment.numberOfFrames = segment.functionalGroups.length;
	        segment.size = segment.numberOfFrames * frameSize;
	        segment.offset = nextOffset;
	        nextOffset = segment.offset + segment.size;
	        var packedSegment = dataset.PixelData.slice(segment.offset, nextOffset);
	        segment.pixelData = BitArray.unpack(packedSegment);
	        var geometry = geometryFromFunctionalGroups(dataset, segment.functionalGroups);
	        segment.geometry = geometry;
	      });
	      return segments;
	    }
	  }]);

	  return Segmentation;
	}();

	var VTKjs = {
	  Segmentation: Segmentation$2
	};

	function getTID300ContentItem$1(tool, toolClass) {
	  var args = toolClass.getTID300RepresentationArguments(tool);
	  args.use3DSpatialCoordinates = true;
	  return new toolClass.TID300Representation(args);
	}

	function getMeasurementGroup$1(graphicType, measurements) {
	  var toolClass = MeasurementReport$1.MICROSCOPY_TOOL_CLASSES_BY_TOOL_TYPE[graphicType]; // Loop through the array of tool instances
	  // for this tool

	  var Measurements = measurements.map(function (tool) {
	    return getTID300ContentItem$1(tool, toolClass);
	  });
	  return new TID1501MeasurementGroup(Measurements);
	}

	var MeasurementReport$1 =
	/*#__PURE__*/
	function () {
	  function MeasurementReport() {
	    _classCallCheck(this, MeasurementReport);
	  }

	  _createClass(MeasurementReport, null, [{
	    key: "generateReport",
	    value: function generateReport(rois, metadataProvider, options) {
	      // Input is all ROIS returned via viewer.getALLROIs()
	      // let report = MeasurementReport.generateReport(viewer.getAllROIs());
	      // Sort and split into arrays by scoord3d.graphicType
	      var measurementsByGraphicType = {};
	      rois.forEach(function (roi) {
	        var graphicType = roi.scoord3d.graphicType;

	        if (graphicType !== "POINT") {
	          // adding z coord as 0
	          roi.scoord3d.graphicData.map(function (coord) {
	            return coord.push(0);
	          });
	        }

	        if (!measurementsByGraphicType[graphicType]) {
	          measurementsByGraphicType[graphicType] = [];
	        }

	        measurementsByGraphicType[graphicType].push(roi.scoord3d);
	      }); // For each measurement, get the utility arguments using the adapter, and create TID300 Measurement
	      // Group these TID300 Measurements into a TID1501 Measurement Group (for each graphicType)
	      // Use TID1500MeasurementReport utility to create a single report from the created groups
	      // return report;

	      var allMeasurementGroups = [];
	      var measurementGroups = [];
	      Object.keys(measurementsByGraphicType).forEach(function (graphicType) {
	        var measurements = measurementsByGraphicType[graphicType];
	        var group = getMeasurementGroup$1(graphicType, measurements);

	        if (group) {
	          measurementGroups.push(group);
	        }

	        allMeasurementGroups = allMeasurementGroups.concat(measurementGroups);
	      });
	      var MeasurementReport = new TID1500MeasurementReport(allMeasurementGroups, options); // TODO: what is the correct metaheader
	      // http://dicom.nema.org/medical/Dicom/current/output/chtml/part10/chapter_7.html
	      // TODO: move meta creation to happen in derivations.js

	      var fileMetaInformationVersionArray = new Uint8Array(2);
	      fileMetaInformationVersionArray[1] = 1; // TODO: Find out how to reference the data from dicom-microscopy-viewer

	      var studyInstanceUID = "12.4";
	      var seriesInstanceUID = "12.4";
	      var derivationSourceDataset = {
	        StudyInstanceUID: studyInstanceUID,
	        SeriesInstanceUID: seriesInstanceUID //SOPInstanceUID: sopInstanceUID, // TODO: Necessary?
	        //SOPClassUID: sopClassUID,

	      };
	      var _meta = {
	        FileMetaInformationVersion: {
	          Value: [fileMetaInformationVersionArray.buffer],
	          vr: "OB"
	        },
	        //MediaStorageSOPClassUID
	        //MediaStorageSOPInstanceUID: sopCommonModule.sopInstanceUID,
	        TransferSyntaxUID: {
	          Value: ["1.2.840.10008.1.2.1"],
	          vr: "UI"
	        },
	        ImplementationClassUID: {
	          Value: [DicomMetaDictionary.uid()],
	          // TODO: could be git hash or other valid id
	          vr: "UI"
	        },
	        ImplementationVersionName: {
	          Value: ["dcmjs"],
	          vr: "SH"
	        }
	      };
	      var _vrMap = {
	        PixelData: "OW"
	      };
	      derivationSourceDataset._meta = _meta;
	      derivationSourceDataset._vrMap = _vrMap;
	      var report = new StructuredReport([derivationSourceDataset]);
	      var contentItem = MeasurementReport.contentItem(derivationSourceDataset); // Merge the derived dataset with the content from the Measurement Report

	      report.dataset = Object.assign(report.dataset, contentItem);
	      report.dataset._meta = _meta;
	      return report;
	    } //@ToDo

	  }, {
	    key: "generateToolState",
	    value: function generateToolState(dataset) {
	      // For now, bail out if the dataset is not a TID1500 SR with length measurements
	      if (dataset.ContentTemplateSequence.TemplateIdentifier !== "1500") {
	        throw new Error("This package can currently only interpret DICOM SR TID 1500");
	      }

	      var REPORT = "Imaging Measurements";
	      var GROUP = "Measurement Group"; // Split the imagingMeasurementContent into measurement groups by their code meaning

	      var imagingMeasurementContent = toArray(dataset.ContentSequence).find(codeMeaningEquals(REPORT)); // Retrieve the Measurements themselves

	      var measurementGroupContent = toArray(imagingMeasurementContent.ContentSequence).find(codeMeaningEquals(GROUP)); // // For each of the supported measurement types, compute the measurement data

	      var measurementData = {};
	      Object.keys(MeasurementReport.MICROSCOPY_TOOL_CLASSES_BY_UTILITY_TYPE).forEach(function (measurementType) {
	        // Find supported measurement types in the Structured Report
	        var measurementGroups = toArray(measurementGroupContent.ContentSequence);
	        var measurementContent = measurementGroups.filter(graphicTypeEquals(measurementType.toUpperCase()));

	        if (!measurementContent || measurementContent.length === 0) {
	          return;
	        }

	        var toolClass = MeasurementReport.MICROSCOPY_TOOL_CLASSES_BY_UTILITY_TYPE[measurementType];
	        var toolType = toolClass.toolType;

	        if (!toolClass.getMeasurementData) {
	          throw new Error("MICROSCOPY Tool Adapters must define a getMeasurementData static method.");
	        } // measurementContent = measurementContent.map(item => item.ContentSequence.GraphicData)
	        //     .filter((graphicData, index, self) => self.indexOf(graphicData) === index)
	        // measurementData[toolType] = new Array()


	        measurementData[toolType] = toolClass.getMeasurementData(measurementContent); // measurementContent.forEach(measurement =>{
	        // })
	        // Retrieve Length Measurement Data
	      });
	      return measurementData;
	    }
	  }, {
	    key: "registerTool",
	    value: function registerTool(toolClass) {
	      MeasurementReport.MICROSCOPY_TOOL_CLASSES_BY_UTILITY_TYPE[toolClass.utilityToolType] = toolClass;
	      MeasurementReport.MICROSCOPY_TOOL_CLASSES_BY_TOOL_TYPE[toolClass.graphicType] = toolClass;
	      MeasurementReport.MEASUREMENT_BY_TOOLTYPE[toolClass.graphicType] = toolClass.utilityToolType;
	    }
	  }]);

	  return MeasurementReport;
	}();
	MeasurementReport$1.MEASUREMENT_BY_TOOLTYPE = {};
	MeasurementReport$1.MICROSCOPY_TOOL_CLASSES_BY_UTILITY_TYPE = {};
	MeasurementReport$1.MICROSCOPY_TOOL_CLASSES_BY_TOOL_TYPE = {};

	var Polyline$1 =
	/*#__PURE__*/
	function () {
	  function Polyline$$1() {
	    _classCallCheck(this, Polyline$$1);
	  }

	  _createClass(Polyline$$1, null, [{
	    key: "getMeasurementData",
	    value: function getMeasurementData(measurementContent) {
	      // removing duplication and Getting only the graphicData information
	      var measurement = measurementContent.map(function (item) {
	        return item.ContentSequence.GraphicData;
	      }).filter(function (s) {
	        return function (a) {
	          return function (j) {
	            return !s.has(j) && s.add(j);
	          }(JSON.stringify(a));
	        };
	      }(new Set())); // Chunking the array into size of three

	      return measurement.map(function (measurement) {
	        return measurement.reduce(function (all, one, i) {
	          var ch = Math.floor(i / 3);
	          all[ch] = [].concat(all[ch] || [], one);
	          return all;
	        }, []);
	      });
	    }
	  }, {
	    key: "getTID300RepresentationArguments",
	    value: function getTID300RepresentationArguments(scoord3d) {
	      if (scoord3d.graphicType !== "POLYLINE") {
	        throw new Error("We expected a POLYLINE graphicType");
	      }

	      var points = scoord3d.graphicData;
	      var lengths = 1;
	      return {
	        points: points,
	        lengths: lengths
	      };
	    }
	  }]);

	  return Polyline$$1;
	}();

	Polyline$1.graphicType = "POLYLINE";
	Polyline$1.toolType = "Polyline";
	Polyline$1.utilityToolType = "Polyline";
	Polyline$1.TID300Representation = Polyline;
	MeasurementReport$1.registerTool(Polyline$1);

	var DICOMMicroscopyViewer = {
	  Polyline: Polyline$1,
	  MeasurementReport: MeasurementReport$1
	};

	var adapters = {
	  Cornerstone: Cornerstone,
	  VTKjs: VTKjs,
	  DICOMMicroscopyViewer: DICOMMicroscopyViewer
	};

	var TID1500 = {
	  TID1500MeasurementReport: TID1500MeasurementReport,
	  TID1501MeasurementGroup: TID1501MeasurementGroup
	};

	// - Cornerstone Probe
	// Note: OHIF currently uses Cornerstone's 'dragProbe'. We need to add the regular Probe tool, which drops a single point.
	//
	// Hierarchy
	// TID 1500 MeasurementReport
	// --TID 1501 Measurement Group
	// ---Measurement Group (DCM 125007)
	// ----TID 300 Measurement
	// ------SCOORD. Graphic Type: POINT
	//
	//
	// - Cornerstone Ellipse:
	//
	// Hierarchy
	// TID 1500 MeasurementReport
	// -TID 1410 Planar ROI Measurements
	// --TID 1501 Measurement Group
	// ---Measurement Group (DCM 125007)
	// ----TID 300 Measurement
	// ------SCOORD. Graphic Type: ELLIPSE
	//        (ftp://dicom.nema.org/MEDICAL/dicom/current/output/chtml/part03/sect_C.10.5.html)
	//
	// If Graphic Type (0070,0023) is ELLIPSE, then exactly four points shall be present; the first two points are to be interpreted as the endpoints of the major axis and the second two points as the endpoints of the minor axis of an ellipse, some form of implementation dependent representation of which is to be drawn.
	//
	// TID 1401 Area Measurement: http://dicom.nema.org/medical/dicom/current/output/html/part16.html#sect_TID_1401
	// Should be a sibling of the SCOORD
	// Should specify the Mean Modality Pixel Value measured in whatever units the image is in
	// Should specify the Standard Deviation Modality Pixel Value measured in whatever units the image is in
	//
	//
	// - Cornerstone Rectangle ROI
	//
	// Hierarchy
	// TID 1500 MeasurementReport
	// --TID 1501 Measurement Group
	// ---Measurement Group (DCM 125007)
	// ----TID 300 Measurement
	// ------SCOORD. Graphic Type: POLYLINE
	// ------ Use concept corresponding to Rectangle measurement
	//
	//                 http://dicom.nema.org/medical/dicom/current/output/html/part16.html#sect_TID_4019
	//
	// OR
	// Note: This should be the same as a Freehand ROI, more or less. We add a TID 4019: Algorithm Identification flag to specify that this was created (and should be rehydrated) into a Rectangle ROI.
	// TODO: Should we use a Derivation instead? http://dicom.nema.org/medical/dicom/current/output/html/part16.html#DCM_121401
	// Should specify the Area measured in mmˆ2, including the units in UCUM
	// Should specify the Mean Modality Pixel Value measured in whatever units the image is in
	// Should specify the Standard Deviation Modality Pixel Value measured in whatever units the image is in
	//
	//
	// - Cornerstone Simple Angle tool
	//
	// Hierarchy
	// TID 1500 MeasurementReport
	// --TID 1501 Measurement Group
	// ---Measurement Group (DCM 125007)
	// ----TID 300 Measurement
	// ------SCOORD. Graphic Type: POLYLINE
	//        (ftp://dicom.nema.org/MEDICAL/dicom/current/output/chtml/part03/sect_C.10.5.html)
	// ----TID 300 Measurement
	// ------SCOORD. Graphic Type: POLYLINE
	//        (ftp://dicom.nema.org/MEDICAL/dicom/current/output/chtml/part03/sect_C.10.5.html)
	//
	// ------ Use concept corresponding to Angle measurement
	//
	// Two lines specify the angle
	// Should specify the Angle measured in Degrees, including the units in UCUM
	//

	var TID300 = {
	  TID300Measurement: TID300Measurement,
	  Length: Length,
	  Bidirectional: Bidirectional,
	  Polyline: Polyline
	};

	/**
	 * Converts a Uint8Array to a String.
	 * @param {Uint8Array} array that should be converted
	 * @param {Number} offset array offset in case only subset of array items should be extracted (default: 0)
	 * @param {Number} limit maximum number of array items that should be extracted (defaults to length of array)
	 * @returns {String}
	 */
	function uint8ArrayToString(arr, offset, limit) {
	  offset = offset || 0;
	  limit = limit || arr.length - offset;
	  var str = "";

	  for (var i = offset; i < offset + limit; i++) {
	    str += String.fromCharCode(arr[i]);
	  }

	  return str;
	}
	/**
	 * Converts a String to a Uint8Array.
	 * @param {String} str string that should be converted
	 * @returns {Uint8Array}
	 */


	function stringToUint8Array(str) {
	  var arr = new Uint8Array(str.length);

	  for (var i = 0, j = str.length; i < j; i++) {
	    arr[i] = str.charCodeAt(i);
	  }

	  return arr;
	}
	/**
	 * Identifies the boundary in a multipart/related message header.
	 * @param {String} header message header
	 * @returns {String} boundary
	 */


	function identifyBoundary(header) {
	  var parts = header.split("\r\n");

	  for (var i = 0; i < parts.length; i++) {
	    if (parts[i].substr(0, 2) === "--") {
	      return parts[i];
	    }
	  }
	}
	/**
	 * Checks whether a given token is contained by a message at a given offset.
	 * @param {Uint8Array} message message content
	 * @param {Uint8Array} token substring that should be present
	 * @param {Number} offset offset in message content from where search should start
	 * @returns {Boolean} whether message contains token at offset
	 */


	function containsToken(message, token) {
	  var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

	  if (offset + token.length > message.length) {
	    return false;
	  }

	  var index = offset;

	  for (var i = 0; i < token.length; i++) {
	    if (token[i] !== message[index++]) {
	      return false;
	    }
	  }

	  return true;
	}
	/**
	 * Finds a given token in a message at a given offset.
	 * @param {Uint8Array} message message content
	 * @param {Uint8Array} token substring that should be found
	 * @param {Number} offset message body offset from where search should start
	 * @returns {Boolean} whether message has a part at given offset or not
	 */


	function findToken(message, token) {
	  var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
	  var maxSearchLength = arguments.length > 3 ? arguments[3] : undefined;
	  var searchLength = message.length;

	  if (maxSearchLength) {
	    searchLength = Math.min(offset + maxSearchLength, message.length);
	  }

	  for (var i = offset; i < searchLength; i++) {
	    // If the first value of the message matches
	    // the first value of the token, check if
	    // this is the full token.
	    if (message[i] === token[0]) {
	      if (containsToken(message, token, i)) {
	        return i;
	      }
	    }
	  }

	  return -1;
	}
	/**
	 * @typedef {Object} MultipartEncodedData
	 * @property {ArrayBuffer} data The encoded Multipart Data
	 * @property {String} boundary The boundary used to divide pieces of the encoded data
	 */

	/**
	 * Encode one or more DICOM datasets into a single body so it can be
	 * sent using the Multipart Content-Type.
	 *
	 * @param {ArrayBuffer[]} datasets Array containing each file to be encoded in the multipart body, passed as ArrayBuffers.
	 * @param {String} [boundary] Optional string to define a boundary between each part of the multipart body. If this is not specified, a random GUID will be generated.
	 * @return {MultipartEncodedData} The Multipart encoded data returned as an Object. This contains both the data itself, and the boundary string used to divide it.
	 */


	function multipartEncode(datasets) {
	  var boundary = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : guid();
	  var contentType = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "application/dicom";
	  var contentTypeString = "Content-Type: ".concat(contentType);
	  var header = "\r\n--".concat(boundary, "\r\n").concat(contentTypeString, "\r\n\r\n");
	  var footer = "\r\n--".concat(boundary, "--");
	  var headerArray = stringToUint8Array(header);
	  var footerArray = stringToUint8Array(footer);
	  var headerLength = headerArray.length;
	  var footerLength = footerArray.length;
	  var length = 0; // Calculate the total length for the final array

	  var contentArrays = datasets.map(function (datasetBuffer) {
	    var contentArray = new Uint8Array(datasetBuffer);
	    var contentLength = contentArray.length;
	    length += headerLength + contentLength + footerLength;
	    return contentArray;
	  }); // Allocate the array

	  var multipartArray = new Uint8Array(length); // Set the initial header

	  multipartArray.set(headerArray, 0); // Write each dataset into the multipart array

	  var position = 0;
	  contentArrays.forEach(function (contentArray) {
	    var contentLength = contentArray.length;
	    multipartArray.set(headerArray, position);
	    multipartArray.set(contentArray, position + headerLength);
	    position += headerLength + contentArray.length;
	  });
	  multipartArray.set(footerArray, position);
	  return {
	    data: multipartArray.buffer,
	    boundary: boundary
	  };
	}
	/**
	 * Decode a Multipart encoded ArrayBuffer and return the components as an Array.
	 *
	 * @param {ArrayBuffer} response Data encoded as a 'multipart/related' message
	 * @returns {Array} The content
	 */


	function multipartDecode(response) {
	  var message = new Uint8Array(response);
	  /* Set a maximum length to search for the header boundaries, otherwise
	     findToken can run for a long time
	  */

	  var maxSearchLength = 1000; // First look for the multipart mime header

	  var separator = stringToUint8Array("\r\n\r\n");
	  var headerIndex = findToken(message, separator, 0, maxSearchLength);

	  if (headerIndex === -1) {
	    throw new Error("Response message has no multipart mime header");
	  }

	  var header = uint8ArrayToString(message, 0, headerIndex);
	  var boundaryString = identifyBoundary(header);

	  if (!boundaryString) {
	    throw new Error("Header of response message does not specify boundary");
	  }

	  var boundary = stringToUint8Array(boundaryString);
	  var components = [];
	  var offset = headerIndex + separator.length; // Loop until we cannot find any more boundaries

	  var boundaryIndex;

	  while (boundaryIndex !== -1) {
	    // Search for the next boundary in the message, starting
	    // from the current offset position
	    boundaryIndex = findToken(message, boundary, offset); // If no further boundaries are found, stop here.

	    if (boundaryIndex === -1) {
	      break;
	    } // Extract data from response message, excluding "\r\n"


	    var spacingLength = 2;
	    var length = boundaryIndex - offset - spacingLength;
	    var data = response.slice(offset, offset + length); // Add the data to the array of results

	    components.push(data); // find the end of the boundary

	    var boundaryEnd = findToken(message, separator, boundaryIndex + 1, maxSearchLength);
	    if (boundaryEnd === -1) break; // Move the offset to the end of the identified boundary

	    offset = boundaryEnd + separator.length;
	  }

	  return components;
	}
	/**
	 * Create a random GUID
	 *
	 * @return {string}
	 */


	function guid() {
	  function s4() {
	    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	  }

	  return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
	}

	var message = {
	  containsToken: containsToken,
	  findToken: findToken,
	  identifyBoundary: identifyBoundary,
	  uint8ArrayToString: uint8ArrayToString,
	  stringToUint8Array: stringToUint8Array,
	  multipartEncode: multipartEncode,
	  multipartDecode: multipartDecode,
	  guid: guid
	};

	var utilities = {
	  TID1500: TID1500,
	  TID300: TID300,
	  message: message
	};

	var data = {
	  BitArray: BitArray,
	  ReadBufferStream: ReadBufferStream,
	  WriteBufferStream: WriteBufferStream,
	  DicomDict: DicomDict,
	  DicomMessage: DicomMessage,
	  DicomMetaDictionary: DicomMetaDictionary,
	  Tag: Tag,
	  ValueRepresentation: ValueRepresentation,
	  Colors: Colors,
	  datasetToDict: datasetToDict,
	  datasetToBuffer: datasetToBuffer,
	  datasetToBlob: datasetToBlob
	};
	var derivations = {
	  DerivedDataset: DerivedDataset,
	  DerivedPixels: DerivedPixels,
	  DerivedImage: DerivedImage,
	  Segmentation: Segmentation,
	  StructuredReport: StructuredReport,
	  ParametricMap: ParametricMap
	};
	var normalizers = {
	  Normalizer: Normalizer,
	  ImageNormalizer: ImageNormalizer,
	  MRImageNormalizer: MRImageNormalizer,
	  EnhancedMRImageNormalizer: EnhancedMRImageNormalizer,
	  EnhancedUSVolumeNormalizer: EnhancedUSVolumeNormalizer,
	  CTImageNormalizer: CTImageNormalizer,
	  PETImageNormalizer: PETImageNormalizer,
	  SEGImageNormalizer: SEGImageNormalizer,
	  DSRNormalizer: DSRNormalizer
	};

	exports.data = data;
	exports.derivations = derivations;
	exports.normalizers = normalizers;
	exports.adapters = adapters;
	exports.utilities = utilities;
	exports.DICOMWEB = DICOMWEB;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=dcmjs.js.map
