/*
	node ./cursorentity.js debug=11 entity=DOCTOR field=doctor_name_ss filter=type_s:PRIVATE
*/
const http = require('http');
const https = require('https');

const maxStringLength = 1000000000;

console.log("Maximum string length: " + maxStringLength);

const commandLine = {};

process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`);
  if( index > 1 ){
	let v = val;
	
	if( v.indexOf("=") ){
		let name = v.substring(0,v.indexOf("="));
		commandLine[name] = v.substring(v.indexOf("=")+1);
	}
  }
});

process.env.NODE_TLS_REJECT_UNAUTHORIZED=0;

commandLine.retryTimeout = Object.prototype.hasOwnProperty.call(commandLine,'retryTimeout') ? parseInt(commandLine['retryTimeout']) : 60000;
commandLine.batchSize = Object.prototype.hasOwnProperty.call(commandLine,'batchSize') ? parseInt(commandLine['batchSize']) : 5000;
commandLine.maxBatchSize = Object.prototype.hasOwnProperty.call(commandLine,'maxBatchSize') ? parseInt(commandLine['maxBatchSize']) : 10000;
commandLine.sourceSolrIdField = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrIdField') ? commandLine['sourceSolrIdField'] : "id";
commandLine.sourceSolrQuery = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrQuery') ? commandLine['sourceSolrQuery'] : "*:*";
commandLine.sortDirection = Object.prototype.hasOwnProperty.call(commandLine,'sortDirection') ? commandLine['sortDirection'] : "asc";
commandLine.filter = Object.prototype.hasOwnProperty.call(commandLine,'filter') ? commandLine['filter'] : "type_s:P";
commandLine.entity = Object.prototype.hasOwnProperty.call(commandLine,'entity') ? commandLine['entity'] : 'DOCTOR';
commandLine.field = Object.prototype.hasOwnProperty.call(commandLine,'field') ? commandLine['field'] : 'doctor_name_ss';
commandLine.tagfield = Object.prototype.hasOwnProperty.call(commandLine,'tagfield') ? commandLine['tagfield'] : 'tagger_text';
commandLine.outputfield = Object.prototype.hasOwnProperty.call(commandLine,'outputfield') ? commandLine['outputfield'] : 'output';
commandLine.suggestfield = Object.prototype.hasOwnProperty.call(commandLine,'suggestfield') ? commandLine['suggestfield'] : 'suggest_text';
commandLine.includefields = Object.prototype.hasOwnProperty.call(commandLine,'includefields') ? commandLine['includefields'].split(",") : ["doctor_id_ss"];
commandLine.keyfield = Object.prototype.hasOwnProperty.call(commandLine,'keyfield') ? commandLine['keyfield'] : 'provider_id_ss';
commandLine.fieldlist = Object.prototype.hasOwnProperty.call(commandLine,'fieldlist') ? commandLine['fieldlist'] : 'doctor_id_ss,doctor_name_ss';

commandLine.sourceSolrHost = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrHost') ? commandLine['sourceSolrHost'] : "localhost";
commandLine.sourceSolrPort = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPort') ? commandLine['sourceSolrPort'] : 8443;
commandLine.sourceSolrCollection = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrCollection') ? commandLine['sourceSolrCollection'] : 'data';
commandLine.sourceSolrPath = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPath') ? commandLine['sourceSolrPath'] : "/solr/" + commandLine.sourceSolrCollection + "/select?wt=json&" + (commandLine.filter ? "fq=" + commandLine.filter + "&" : "") + "sort=" + commandLine.sourceSolrIdField + "+" + commandLine.sortDirection + "&q=" + commandLine.sourceSolrQuery;
if( commandLine.fieldlist  ){
    commandLine.sourceSolrPath += "&fl=" + commandLine.fieldlist;
}
commandLine.destinationSolrHost = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrHost') ? commandLine['destinationSolrHost'] : "localhost";
commandLine.destinationSolrPort = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrPort') ? commandLine['destinationSolrPort'] : 8443;
commandLine.destinationSolrCollection = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrCollection') ? commandLine['destinationSolrCollection'] : 'tagger';
commandLine.destinationSolrUpdatePath = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrUpdatePath') ? commandLine['destinationSolrUpdatePath'] : "/solr/" + commandLine.destinationSolrCollection + "/update";
commandLine.authKey = Object.prototype.hasOwnProperty.call(commandLine,'authKey') ? commandLine['authKey'] : '';
commandLine.async = Object.prototype.hasOwnProperty.call(commandLine,'async') ? commandLine['async'] === 'true' : false;
commandLine.sslMode = Object.prototype.hasOwnProperty.call(commandLine,'sslMode') ? commandLine['sslMode'] === 'true' : true;
commandLine.debug = Object.prototype.hasOwnProperty.call(commandLine,'debug') ? commandLine['debug'] : 0;

if( commandLine.debug > 0 ) console.log("commandline",commandLine);

commandLine.originalSize = commandLine.batchSize;

let CONTEXT = {stats: {queried: 0,loaded: 0},cursorMark:"*",maxStringLength,lastSize: commandLine.batchSize,commandLine,lib: {http,https}};

let HANDLERS = false;

function inExcludeList(ctx,fieldName){
	let result = false;
        for(let i in ctx.commandLine.fieldsToExclude){
		if( fieldName.indexOf(ctx.commandLine.fieldsToExclude[i]) > -1 ){
			result = true;
			break;
		}
	}

	return( result );
}

function queryCallback(res) {
	let str = "";
	let ctx = this.ctx;
	let failed = false;
	let contentLength = res.headers['Content-Length'];
	if(!contentLength )
		contentLength = res.headers['content-length'];
	
		console.log("Content-Length: " + contentLength);
	  
	  if( contentLength && contentLength > ctx.maxStringLength ){
		console.log("init lastSize was set to " + ctx.lastSize + " reseting and doubling batchsize");
		ctx.lastSize = ctx.commandLine.batchSize;
		ctx.commandLine.batchSize = Math.round(ctx.commandLine.batchSize/2);
		failed = true;
		loadQueryBatch(ctx);
	  }
	  else {
			res.on('data', function (chunk) {
				if( !failed ){
					try{
						str += chunk;
					}catch(e){
						console.log("payload too big so resizing and trying again " + ctx.commandLine.batchSize + " exp: " + e + " size: " + str.length);
						ctx.lastSize = ctx.commandLine.batchSize;
						ctx.commandLine.batchSize = Math.round(ctx.commandLine.batchSize/2);
						failed = true;
					} 
				}    
			});

			res.on('end', function () {
					//console.log(res.field);
					//console.log(str);
					if( failed ){
						loadQueryBatch(ctx);
					}
					else {
						try {
							let data = JSON.parse(str);
							let qtime = data?.responseHeader?.QTime;
							

							console.log("got " + str.length + " characters with a qtime: " + qtime);

							if( ctx.commandLine.batchSize < ctx.commandLine.originalSize ){
								console.log("lastSize was set to " + ctx.batchSize + " reseting and doubling batchsize");
								ctx.lastSize = ctx.commandLine.batchSize;
								ctx.commandLine.batchSize = ctx.commandLine.originalSize;
							}
							
							if( data.response && data.response.docs ){
								ctx.stats.queried += data.response.docs.length;
								ctx.stats.numFound = data.response.numFound;
                                let newDocs = [];

								for(let d in data.response.docs){
									let doc = data.response.docs[d];
									let newRec = {id:  ctx.commandLine.entity + doc[ctx.commandLine.keyfield]};
                                    newRec[ctx.commandLine.tagfield] = doc[ctx.commandLine.field];
                                    newRec[ctx.commandLine.outputfield] = doc[ctx.commandLine.field];
                                    newRec["original_txt"] = doc[ctx.commandLine.field];
                                    newRec["type_s"] = ctx.commandLine.entity;
                                    newRec[ctx.commandLine.suggestfield] = doc[ctx.commandLine.field];
                                    newRec["suggest_text2"] = doc[ctx.commandLine.field];
                                    newRec["suggest_text3"] = doc[ctx.commandLine.field];
                                    for(let addField of ctx.commandLine.includefields){
                                        if( doc[addField] ){
                                            newRec[addField] = doc[addField];
                                        }
                                    }
                                    newDocs.push(newRec);
									
								}
								
								if( ctx.HANDLERS && ctx.HANDLERS["documents"] )
									ctx.HANDLERS["documents"]({docs: newDocs,hasMore: data.nextCursorMark && data.nextCursorMark != ctx.cursorMark});
								else
									copyDocuments(ctx,newDocs,data.nextCursorMark && data.nextCursorMark != ctx.cursorMark);
							}
							//console.log(data);
							if( data.nextCursorMark ){
								if( ctx.cursorMark != data.nextCursorMark ){	
									ctx.cursorMark = data.nextCursorMark;
									if( ctx.commandLine.async ) loadQueryBatch(ctx);
								}
								else {
									console.log("complete");
									doCommit(ctx);
								}
							}
						}
						catch(e){
							//failed
							console.log("failed to parse " + e + " " + str);
							setTimeout(loadQueryBatch,ctx.commandLine.retryTimeout,ctx);
						}
					}
			});
	  }
}

function updateCallback(res) {
	let str = "";
	let hasMore = this.hasMore;
	let ctx = this.ctx;
	let docCount = this.docCount;

  res.on('data', function (chunk) {
              str += chunk;
              
        });

  res.on('end', function () {
		if( ctx.commandLine.debug > 0 ) console.log("UPDATE",hasMore,str);
		ctx.stats.loaded += docCount;
	if( !ctx.commandLine.async && hasMore ){
		loadQueryBatch(ctx);
	}
  });
}

function commitCallback(res) {
	let str = "";
	let ctx = this.ctx;

  res.on('data', function (chunk) {
              str += chunk;
              
        });

  res.on('end', function () {
        console.log("COMMIT",str);
	console.log("stats: " + JSON.stringify(ctx.stats));
	
  });
}

function failedHttpRequest(e){
	console.log("Got error: " + e.message);

	if( this.docs ){
		setTimeout(copyDocuments,this.ctx.commandLine.retryTimeout,this.ctx,this.docs,this.hasMore);
	}
	else
		setTimeout(loadQueryBatch,this.ctx.commandLine.retryTimeout,this.ctx);
}

function copyDocuments(ctx,docs,hasMore){
	let tCallback = updateCallback.bind({ctx,hasMore,docCount: docs.length});
	//console.log("hasmore",hasMore);
	let conf = {hostname: ctx.commandLine.destinationSolrHost,port: ctx.commandLine.destinationSolrPort,path: ctx.commandLine.destinationSolrUpdatePath,method: 'POST',headers: {'Content-Type': 'application/json'}}

	if( ctx.commandLine.authKey ){
		conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
	}
		
	let t = (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).request(conf, tCallback);
	t.on('error', failedHttpRequest.bind({ctx,docs,hasMore,docCount: docs.length}));
	t.write(JSON.stringify(docs));
	t.end();
}

function loadQueryBatch(ctx){
	let tCallback = queryCallback.bind({ctx});
	
	let tSourceSolrPath = ctx.commandLine.sourceSolrPath + "&cursorMark=" + ctx.cursorMark + "&rows=" + ctx.commandLine.batchSize;

	console.log("query: " + tSourceSolrPath);

	let conf = {hostname: ctx.commandLine.sourceSolrHost,port: ctx.commandLine.sourceSolrPort,path: tSourceSolrPath,method: 'GET',headers: {'Content-Type': 'application/json'}};

	if( ctx.commandLine.authKey ){
		conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
	}

	let t =  (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).request(conf, tCallback);
	t.on('error', failedHttpRequest.bind({ctx}));
	t.end();
}

function doCommit(ctx){

	let tCallback = commitCallback.bind({ctx});

	let conf = {host: ctx.commandLine.destinationSolrHost,port: ctx.commandLine.destinationSolrPort,path: ctx.commandLine.destinationSolrUpdatePath + "?commit=true"};

	if( ctx.commandLine.authKey ){
		conf.headers = {};
		conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
	}

	let t =  (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).get(conf, tCallback);
	t.on('error', function(e) {console.log("Got error: " + e.message);});
	t.end();
}



loadQueryBatch(CONTEXT);



