const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const url = require('url');
const stream = require('stream');
const zlib = require('zlib');
const WebSocketServer = require('websocket').server;
const utf8 = require("utf8");
const Buffer = require("buffer").Buffer;

const getHandlers = require("./handlers.js").getHandlers;
const HANDLERS = getHandlers();

/*var nock = require('nock');

nock.recorder.rec({
  output_objects: true
});*/

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const mimeType = {
	'.ico': 'image/x-icon',
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.json': 'application/json',
	'.css': 'text/css',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.wav': 'audio/wav',
	'.mp3': 'audio/mpeg',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
	'.doc': 'application/msword',
	'.eot': 'appliaction/vnd.ms-fontobject',
	'.ttf': 'aplication/font-sfnt'
};

//Lets define a port we want to listen to
let PORT = 8080;
let SOLRHOST = "localhost";
let SOLRPORT = 443;
let SOLRCOLLECTION = "tagger";
let DOCUMENTROOT = "./";
let DEBUG = 0;
let AUTHKEY = "";
let AUTHMODE = false;
let HTTPSSOLR = true;
let SOLRPREFIX = "/solr/";
let IGNORESSLCHECK = true;
let IGNORELOGIN = true;
let USERSPECIFIC = true;

let commandLine = {};

function writeLog(level, message) {
	if (level <= DEBUG) {
		console.log(message);
	}
}

console.log(process.env);

if( process.env ){
	let env = process.env;

	for(let e in env){
		commandLine[e] = env[e];
	}
}

process.argv.forEach((val, index) => {
	writeLog(1, `${index}: ${val}`);
	if (index > 1) {
		let v = val;

		if (v.indexOf("=")) {
			let name = v.substring(0, v.indexOf("="));
			commandLine[name] = v.substring(v.indexOf("=") + 1);
		}
	}
});

if (DEBUG > 1) console.log("commandline", commandLine);

if (commandLine.info) {
	console.log("node .\\server.js authkey=c29scjpTb2xyUm9ja3M= debug=11");
	process.exit(0);
}
if (Object.prototype.hasOwnProperty.call(commandLine, "port"))
	PORT = parseInt(commandLine.port);
if (Object.prototype.hasOwnProperty.call(commandLine, "solrhost"))
	SOLRHOST = commandLine.solrhost;
if (Object.prototype.hasOwnProperty.call(commandLine, "solrport"))
	SOLRPORT = parseInt(commandLine.solrport);
if (Object.prototype.hasOwnProperty.call(commandLine, "documentroot"))
	DOCUMENTROOT = commandLine.documentroot;
if (Object.prototype.hasOwnProperty.call(commandLine, "solrcollection"))
	SOLRCOLLECTION = commandLine.solrcollection;
if (Object.prototype.hasOwnProperty.call(commandLine, "debug"))
	DEBUG = parseInt(commandLine.debug);
if (Object.prototype.hasOwnProperty.call(commandLine, "authkey"))
	AUTHKEY = commandLine.authkey;
if (Object.prototype.hasOwnProperty.call(commandLine, "authmode"))
	AUTHMODE = commandLine.authmode;
if (Object.prototype.hasOwnProperty.call(commandLine, "httpssolr"))
	HTTPSSOLR = commandLine.httpssolr == "true";
if (Object.prototype.hasOwnProperty.call(commandLine, "solrprefix"))
	SOLRPREFIX = commandLine.solrprefix;
if (Object.prototype.hasOwnProperty.call(commandLine, "ignoresslcheck"))
	IGNORESSLCHECK = commandLine.ignoresslcheck == "true";
if (Object.prototype.hasOwnProperty.call(commandLine, "ignorelogin"))
	IGNORELOGIN = commandLine.ignorelogin == "true";
if (Object.prototype.hasOwnProperty.call(commandLine, "userspecific"))
	USERSPECIFIC = commandLine.userspecific == "true";

if( IGNORESSLCHECK )
	process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const CONTEXT = {
	commandLine: commandLine,
	PORT: PORT,
	HTTPSSOLR: HTTPSSOLR,
	SOLRPREFIX: SOLRPREFIX,
	IGNORESSLCHECK: IGNORESSLCHECK,
	IGNORELOGIN: IGNORELOGIN,
	SOLRHOST: SOLRHOST,
	SOLRPORT: SOLRPORT,
	DOCUMENTROOT: DOCUMENTROOT,
	SOLRCOLLECTION: SOLRCOLLECTION,
	DEBUG: DEBUG,
	AUTHKEY: AUTHKEY,
	AUTHMODE: AUTHMODE,
	USERSPECIFIC: USERSPECIFIC,
	lib: {
		http: http,
		https: https,
		URL: url,
		fs: fs,
		path: path,
		stream: stream,
		readline: readline,
		utf8: utf8,
		Buffer: Buffer,
		zlib: zlib
	}
};

function parseCookies(request) {
	let list = {},
		rc = request?.headers?.cookie;
	if( rc ){
		rc.split(';').forEach(function (cookie) {
			let parts = cookie.trim().split('=');
			let value = parts.length > 1 ? parts[1] : "";
			if( value && value != 'undefined' )
				list[parts[0]] = value;
		});
	}
	else if( request.cookies ) {
		rc = request.cookies;
		rc.forEach(function (cookie) {
			let name = cookie.name;
			let value = cookie.value;
			if( value && value != 'undefined' )
				list[name] = value;
		});
	}

	return list;
}

function checkHasAuth(request){
	let result = "";
	let cookieObj = parseCookies(request);
	if ( cookieObj.zen ) {
		result = cookieObj.zen;
	}
	else if( CONTEXT.IGNORELOGIN ){
		result= "zen";
	}

	return( result );
}

function fileUnderRoot(context,fileName){
	let filePath = context.lib.path.resolve(fileName);
	let directoryPath = context.lib.path.resolve(context.DOCUMENTROOT);


	return( filePath.startsWith(directoryPath) );
}

function handleRequest(request, response) {
	if (request.method == 'POST' || request.method == 'DELETE' || request.method == 'PUT') {
		writeLog(1, 'POST')
		let body = ''
		request.on('data', function (data) {
			body += data
			writeLog(1, 'Partial body: ' + body)
		});
		request.on('end', function () {
			writeLog(1, 'Body: ' + body)
			let data = body ? JSON.parse(body) : {};
			actualHandleRequest(request, response, data);
		});
	}
	else if (request.method == 'GET') {
		actualHandleRequest(request, response);
	}


}

//We need a function which handles requests and send response
function actualHandleRequest(request, response, bodyData) {
	writeLog(1, "handle request");
	let result = { status: 0 };

	let cookieObj = parseCookies(request);
	let requestUrl = request.url;
	let requestObj = url.parse(requestUrl, true);
	let queryObj = requestObj.query;
	if (bodyData) {
		for (let p in bodyData) {
			if (Object.prototype.hasOwnProperty.call(bodyData, p)) {
				queryObj[p] = bodyData[p];
			}
		}


	}
	writeLog(1, "query obj", queryObj);
	let contentType = queryObj.contenttype;
	let pathname = requestObj.pathname;
	if (DEBUG > 1) console.log(pathname, requestUrl);

	if (requestUrl.lastIndexOf('/authservice', 0) > -1) {
		//handle auth request
		if (contentType === 'AUTH') {
			let cookieObj = parseCookies(request);
			if (cookieObj.zen || IGNORELOGIN ) {
				result.status = 1;
				result.message = "AOK";
				let userName = cookieObj.zen;
				result.user = { "alias": userName, "id": userName, "username": userName };
				result.role = { "id": "ADMINISTRATOR", "label": "ADMINISTRATOR" };
				result.role.views = [{ "id": "main", "name": "main", "autoStart": "true", "buildwith": "buildMainPage", "loadfile": "js/mainpage.js" }];
			}
			else {
				result.message = "FAILURE";
			}

			//response.end(JSON.stringify(result));
		}
		else if (contentType === 'LOGIN') {
			if (DEBUG > 1) console.log("login", queryObj);
			let isDelete = request.method == 'DELETE';
			let userName = queryObj.user;
			let userKey = queryObj.password;

			if (userName === userKey || IGNORELOGIN ) {
				result.status = 1;
				result.message = "AOK";
				result.alias = userName;

				result.user = { "alias": userName, "id": userName, "username": userName };
				result.role = { "id": "ADMINISTRATOR", "label": "ADMINISTRATOR" };
				result.role.views = [{ "id": "main", "name": "main", "autostart": "true", "buildwith": "buildMainPage", "loadfile": "js/mainpage.js" }];

				if (isDelete) {
					response.writeHead(200, {
						'Set-Cookie': 'zen=' + userName + ";expires=0;",
						'Content-Type': 'application/json'
					});
				}
				else {
					response.writeHead(200, {
						'Set-Cookie': 'zen=' + userName,
						'Content-Type': 'application/json'
					});
				}
			}
			else {
				if (isDelete) {
					response.writeHead(200, {
						'Set-Cookie': 'zen=' + ";expires=" + new Date().toISOString(),
						'Content-Type': 'application/json'
					});
				}
				else {
					response.writeHead(200, {
						'Set-Cookie': 'zen=',
						'Content-Type': 'application/json'
					});
				}
				result.status = -1;
				result.message = "FAILURE";
			}
		}

		if (DEBUG > 1) console.log("auth response", result);
		result.contenttype = contentType;
		response.end(JSON.stringify(result));
	}
	else if (pathname === '/restservice' && checkHasAuth(request) ) {
		//handle auth request
		if (cookieObj.zen || IGNORELOGIN ) {
			queryObj._username = cookieObj.zen;
		}
		writeLog(1, "contentType " + contentType);
		if (Object.prototype.hasOwnProperty.call(HANDLERS, contentType)) {
			let handlerCallback = function (resp) {
				if (DEBUG > 1) console.log("handler called back", this.contentType);
				let parsedResponse = {};

				try {

					if (resp && resp.payload && resp.headers) {
						for (let h in resp.headers) {
							response.setHeader(resp.headers[h].name, resp.headers[h].value);
							//writeLog(1, "set header");
						}
						parsedResponse = resp.payload;

					}
					else
						parsedResponse = JSON.stringify(resp);
				}
				catch (exception) {
					if (DEBUG > 0) console.log(exception);
				}

				try {
					this.response.end(parsedResponse);
				}
				catch (ee) { if (DEBUG > 0) console.log(ee); }
			}

			HANDLERS[contentType]({ CONTEXT: CONTEXT, requestUrl: requestUrl, requestObj: requestObj, queryObj: queryObj, contentType: contentType, pathName: pathname, callback: handlerCallback.bind({ response: response, contentType: contentType }) });
		}
		else {
			result.status = 1;
			result.message = "AOK";
			result.items = new Array();
			result.totalCount = 0;

			response.end(JSON.stringify(result));
		}


	}
	else {
		pathname = "./htdocs" + pathname;

		if( fileUnderRoot(CONTEXT,pathname) ){
			fs.exists(pathname, function (exist) {
				if (!exist) {
					// if the file is not found, return 404
					response.statusCode = 404;
					response.end(`File ${pathname} not found!`);
					return;
				}
				// if is a directory, then look for index.html
				if (fs.statSync(pathname).isDirectory()) {
					pathname += '/index.html';
				}
				// read file from file system
				fs.readFile(pathname, function (err, data) {
					if (err) {
						response.statusCode = 500;
						response.end(`Error getting the file: ${err}.`);
					} else {
						// based on the URL path, extract the file extention. e.g. .js, .doc, ...
						const ext = path.parse(pathname).ext;
						// if the file is found, set Content-type and send data
						response.setHeader('Content-type', mimeType[ext] || 'text/plain');
						response.end(data);
					}
				});
			});
		}
		else {
			response.setHeader('Content-type','text/plain');
			response.end(data);
		}
	}



}

//Create a server
let server = http.createServer(handleRequest);

//Lets start our server
server.listen(PORT, function () {
	//Callback triggered when server is successfully listening. Hurray!
	if (DEBUG > 0) console.log("Server listening on: http://localhost:%s", PORT);
});

let wsServer = new WebSocketServer({
	httpServer: server,
	autoAcceptConnections: false
});

function originIsAllowed(origin) {
	// put logic here to detect whether the specified origin is allowed.
	return true;
}

let logMultiplexer = {
	sockets: {},
	register: function (key, conn) {
		logMultiplexer.sockets[key] = conn;
	},
	deregister: function (key) {
		delete logMultiplexer.sockets[key];
	},
	notify: function (rec) {
		let message = false;

		for (let c in logMultiplexer.sockets) {
			let parts = c.split("-");

			if( (parts[0] == '*' || parts[0] == '' || parts[0] == rec.username ) ){
				if( !message )
					message = JSON.stringify(rec);
				try {
					logMultiplexer.sockets[c].sendUTF(message);
				}
				catch (e) {
					if (CONTEXT.DEBUG > 0) console.log(e);
					logMultiplexer.deregister(c);
				}
			}
		}
	}
};

let messageQueue = [];

function clearLogQueue() {

	for (let i = 0; i < 100; i++) {
		let m = messageQueue.shift();
		if (m)
			logMultiplexer.notify(m);
		else
			break;
	}
	setTimeout(clearLogQueue, 100);
}

clearLogQueue();


console.wslog = function (rec) {
	if (CONTEXT.DEBUG > 1) console.log(arguments);
	logMultiplexer.notify(rec);
};

wsServer.on('request', function (request) {
	let requestUrl = request.resourceURL;
	console.log(requestUrl.query);
	let username = "";
	if (!originIsAllowed(request.origin)) {
		// Make sure we only accept requests from an allowed origin
		request.reject();
		if (CONTEXT.DEBUG > 1) console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
		return;
	}
	else if( (username = checkHasAuth(request)) ){
		if (CONTEXT.DEBUG > 1) console.log('brequest', requestUrl.query);
		let key = requestUrl?.query?.key ? requestUrl.query.key : username;
		key += "-" + request.origin;

		var connection = request.accept('echo-protocol', request.origin);

		if (CONTEXT.DEBUG > 1) console.log((new Date()) + ' Connection accepted.');

		connection["_socketkey"] = key;

		logMultiplexer.register(key, connection);

		connection.on('message', function (message) {
			if (message.type === 'utf8') {
				if (CONTEXT.DEBUG > 1) console.log('Received Message: ' + message.utf8Data);
				connection.sendUTF(message.utf8Data);
			}
			else if (message.type === 'binary') {
				if (CONTEXT.DEBUG > 1) console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
				connection.sendBytes(message.binaryData);
			}
		});
		connection.on('close', function (reasonCode, description) {
			if (CONTEXT.DEBUG > 1) console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
			logMultiplexer.deregister(this.key);
		}.bind({key}));
	}
	else  {
		// Make sure we only accept requests from an allowed origin
		request.reject();
		if (CONTEXT.DEBUG > 1) console.log((new Date()) + 'unauthorized amd rejected.');
		return;
	}
});

///solr/validate/select?facet.field=contenttype&facet=on&fq=testname%3Aorder_product_en&q=*%3A*&rows=0
function getRESTData(args) {

	let callback = function (res) {
		let str = "";
		let args = this.args;

		res.on('data', function (chunk) {
			str += chunk;

		});

		res.on('end', function () {
			//console.log("sample complete",str);
			let data = JSON.parse(str);
			if (data.response && data.response.docs) {
				if (args.type == 'facet') {
					let facetData = { items: [] };
					if (data.facet_counts && data.facet_counts.facet_fields) {
						let ff = data.facet_counts.facet_fields;
						for (let f in ff) {
							let tempItems = ff[f];
							for (let i = 0; i < tempItems.length; i += 2) {
								facetData.items.push({ id: tempItems[i], value: tempItems[i + 1] });
							}
							facetData._totalItems = data.response.numFound;
							break;
						}
					}

					args.callback(facetData);
				}
				else if (args.type == 'query') {
					let docData = { items: [] };
					let docs = data.response.docs;
					docData.totalItems = data.response.numFound;
					for (let i in docs) {
						docData.items.push({ id: args.entry.label, value: docs[i][args.entry.field] });
					}
					docData._totalItems = docs.length;
					args.callback(docData);
				}
				else if (args.type == 'raw') {
					args.callback(data);
				}
				else {
					let docData = { items: [] };

					if (data.response && data.response.docs) {
						let docs = data.response.docs;

						docData.items = docs;
						docData.totalItems = data.response.numFound;
					}
					args.callback(docData);
				}
			}
			else
				args.callback(data);
		});
	}

	let config = { host: args.host, port: args.port, path: args.path };
	if (AUTHKEY)
		config.headers = { "Authorization": "Basic " + AUTHKEY };

	if( args.payload ){
		config.method = "POST";
	}

	let t = (HTTPSSOLR ? https : http).request(config, callback.bind({ args: args }));
	t.on('error', function (e) {
		if (DEBUG > 1) console.log("Got error: " + e.message);
		args.callback({ error: e.message });
	});
	if( args.payload ){
		t.write(args.payload);
	}
	t.end();
}

CONTEXT.lib.getRESTData = getRESTData;

function replaceAll(str, find) {
	let re = new RegExp(find, 'g');

	return (str.replace(re, ''));
}


function parseArgs(line) {
	let result = {};

	if (line) {
		let fields = line.split(" ");

		for (let i in fields) {
			if( fields[i].indexOf("=") > -1 ){
				let idx = fields[i].indexOf("=");
				result[fields[i].substring(0,idx)] = fields[i].substring(idx+1);
			}
		}
	}
	if (DEBUG > 1) console.log("parsed", result);
	return (result);
}

CONTEXT.lib.parseArgs = parseArgs;


function parseRunnerArgs(line) {
	let result = {};

	if (line) {
		let fields = line.split(" ");

		for (let i in fields) {
			if( fields[i].indexOf("=") > -1 ){
				let idx = fields[i].indexOf("=");
				result[fields[i].substring(0,idx)] = fields[i].substring(idx+1);
			}
		}
	}
	if (DEBUG > 1) console.log("runnerparsed", result);
	return (result);
}

CONTEXT.lib.parseRunnerArgs = parseRunnerArgs;


