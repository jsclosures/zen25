/*
    node loadentity.js debug=11 mode=file entity=INTENT inputfile=intents.csv
    node loadentity.js debug=11 mode=facet entity=LANGUAGE inputfile=language-codes.csv
    */
   const http = require('http');
   const https = require('https');
   const fs = require('fs');
   const readline = require('readline');
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
   
   commandLine.entity = Object.prototype.hasOwnProperty.call(commandLine,'entity') ? commandLine['entity'] : 'LANGUAGE';
   commandLine.field = Object.prototype.hasOwnProperty.call(commandLine,'field') ? commandLine['field'] : 'language_s';
   commandLine.tagfield = Object.prototype.hasOwnProperty.call(commandLine,'tagfield') ? commandLine['tagfield'] : 'tagger_text';
   commandLine.outputfield = Object.prototype.hasOwnProperty.call(commandLine,'outputfield') ? commandLine['outputfield'] : 'output';
   commandLine.suggestfield = Object.prototype.hasOwnProperty.call(commandLine,'suggestfield') ? commandLine['suggestfield'] : 'suggest_text';
   commandLine.inputfile = Object.prototype.hasOwnProperty.call(commandLine,'inputfile') ? commandLine['inputfile'] : 'language-codes.csv';
   commandLine.entityfile = Object.prototype.hasOwnProperty.call(commandLine,'entityfile') ? commandLine['entityfile'] : commandLine.entity + '.txt';
   commandLine.promptfile = Object.prototype.hasOwnProperty.call(commandLine,'promptfile') ? commandLine['promptfile'] : commandLine.entity + '_prompt.txt';
   commandLine.mode = Object.prototype.hasOwnProperty.call(commandLine,'mode') ? commandLine['mode'] : 'facet';
   commandLine.shingle = Object.prototype.hasOwnProperty.call(commandLine,'shingle') ? commandLine['shingle'] : 'true';
   commandLine.dedupe = Object.prototype.hasOwnProperty.call(commandLine,'dedupe') ? commandLine['dedupe'] : 'true';
   commandLine.filter = Object.prototype.hasOwnProperty.call(commandLine,'filter') ? commandLine['filter'] : false;
   commandLine.batchsize = Object.prototype.hasOwnProperty.call(commandLine,'batchsize') ? parseInt(commandLine['batchsize']) : 5000;
   commandLine.batchload = Object.prototype.hasOwnProperty.call(commandLine,'batchload') ? commandLine['batchload'] : 'false';
   
   commandLine.sourceSolrIdField = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrIdField') ? commandLine['sourceSolrIdField'] : "id";
   commandLine.sourceSolrQuery = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrQuery') ? commandLine['sourceSolrQuery'] : "*:*";
   commandLine.sourceSolrQueryFilter = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrQueryFilter') ? commandLine['sourceSolrQueryFilter'] : "";
   
   commandLine.sourceSolrHost = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrHost') ? commandLine['sourceSolrHost'] : "localhost";
   commandLine.sourceSolrPort = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPort') ? commandLine['sourceSolrPort'] : 8443;
   commandLine.sourceSolrCollection = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrCollection') ? commandLine['sourceSolrCollection'] : 'data';
   commandLine.sourceSolrPath = Object.prototype.hasOwnProperty.call(commandLine,'sourceSolrPath') ? commandLine['sourceSolrPath'] : "/solr/" + commandLine.sourceSolrCollection + "/select?wt=json&" + (commandLine.sourceSolrQueryFilter ? "fq=" + commandLine.sourceSolrQueryFilter + "&" : "") + "q=" + commandLine.sourceSolrQuery;
   
   commandLine.destinationSolrHost = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrHost') ? commandLine['destinationSolrHost'] : "localhost";
   commandLine.destinationSolrPort = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrPort') ? commandLine['destinationSolrPort'] : 8443;
   commandLine.destinationSolrCollection = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrCollection') ? commandLine['destinationSolrCollection'] : 'tagger';
   commandLine.destinationSolrUpdatePath = Object.prototype.hasOwnProperty.call(commandLine,'destinationSolrUpdatePath') ? commandLine['destinationSolrUpdatePath'] : "/solr/" + commandLine.destinationSolrCollection + "/update";
   commandLine.authKey = Object.prototype.hasOwnProperty.call(commandLine,'authKey') ? commandLine['authKey'] : '';
   commandLine.sslMode = Object.prototype.hasOwnProperty.call(commandLine,'sslMode') ? commandLine['sslMode'] === 'true' : true;
   commandLine.debug = Object.prototype.hasOwnProperty.call(commandLine,'debug') ? commandLine['debug'] : 0;
   
   console.log(process.env);
   
   if( process.env ){
       let env = process.env;
   
       for(let e in env){
           commandLine[e] = env[e];
       }
   }
   
   if( commandLine.debug > 0 ) console.log("commandline",commandLine);
   
   //const getHandlers = require("./handlers.js").getHandlers;
   //const HANDLERS = getHandlers();
   let HANDLERS = false;
   
   let CONTEXT = {commandLine,HANDLERS,lib: {http,https,fs,readline}};
   
   if( commandLine.mode != 'file' && commandLine.inputfile ){
       const instream = CONTEXT.lib.fs.createReadStream(commandLine.inputfile);
       instream.readable = true;
   
       const rl = CONTEXT.lib.readline.createInterface({
       input: instream,
       terminal: false
       });
   
       CONTEXT.rowCounter = 0;
       CONTEXT.languages = {};
       
       function readFunc(line) {
           //onsole.log(line);
           if( this.ctx.rowCounter > 0 ){
               let parts = line.split("\",\"");
               if( parts.length > 1 ){
                   let code = parts[0].substring(1);
                   let lang = parts[1].substring(0,parts[1].length-1);
                   if( lang.indexOf(";") > -1 )
                       lang = lang.split(";");
                   else {
                       lang = lang.replace(new RegExp("[^a-z0-9 ]","ig")," ").split(" ");
                   }
                   lang.push(code.toLowerCase());
                   for(let lIdx = lang.length-1;lIdx >= 0;lIdx--){
                       lang[lIdx] = lang[lIdx].trim().toLowerCase();
                       if( !lang[lIdx] )
                           lang.splice(lIdx,1);
                   }
                   this.ctx.languages[parts[0].substring(1)] = lang;
               }
           }
          
           this.ctx.rowCounter++;
       }
   
       function closeFunc(){
           console.log("done loading " + this.ctx.inputfile);
           doWork(this.ctx);
       }
       if( rl ) rl.on('line', readFunc.bind({ctx: CONTEXT}));
       if( rl ) rl.on('close', closeFunc.bind({ctx: CONTEXT}));
   }
   else{
       doWork(CONTEXT);
   }
   
   function writeEntityFile(ctx,batch){
       let list = [];
       let prompt = "`reduce items in this list: TOKEN` format as json with language codes";
       let listStr = "";
       for(let entityIdx in batch){
           let entity = batch[entityIdx]["original_txt"];
   
           list.push(entity);
   
           if( entityIdx > 0 ){
               listStr += ",";
           }
           listStr += "'" + entity + "'";
       }
       listStr = "[" + listStr + "]";
       prompt = prompt.replace("TOKEN",listStr);
       fs.writeFileSync(ctx.commandLine.entityfile,JSON.stringify(list));
       fs.writeFileSync(ctx.commandLine.promptfile,prompt);
   }
   
   function doWork(ctx){
   
       function findInMap(map,token){
           let result = false;
   
           for(let code in map){
               let variants = map[code];
               if( variants.indexOf(token) > -1 || code == token ){
                   result = {code,variants,token };
                   break;
               }
           }
   
           return( result );
       }
   
       function mergeArray(arr1,arr2){
           for(let e of arr2){
               if( e && arr1.indexOf(e) < 0 ){
                   arr1.push(e);
               }
           }
   
           return( arr1 );
       }
   
       function dedupeEntities(ctx,list){
           let result = [];
           let map = {};
           let languages = ctx.languages;
   
           for(let rec of list){
               for(let tagIdx in rec[ctx.commandLine.tagfield]){
                   let tag = rec[ctx.commandLine.tagfield][tagIdx];
                   let lang = findInMap(languages,tag.trim().toLowerCase());
                   if( lang ){
                       map[lang.code] = {list: mergeArray(lang.variants,rec[ctx.commandLine.tagfield]),token: lang.token};
                       break;
                   }
                   else {
                       console.log("rejected " + tag);
                   }
               }
           }
   
           for(let code in map){
               let newRec = {code};
               newRec[ctx.commandLine.tagfield] = map[code].list;
               newRec[ctx.commandLine.outputfield] = code.toUpperCase();
               newRec["original_txt"] = map[code].token;
               newRec["type_s"] = ctx.commandLine.entity;
               newRec[ctx.commandLine.suggestfield] = map[code].list;
               newRec["suggest_text2"] = map[code].list;
               newRec["suggest_text3"] = map[code].list;
               result.push(newRec);
           }
   
           return( result );
       }
   
       function shingleFacet(str){
           let result = [];
   
           if( str ){
           let stripped = str.replace(new RegExp("[^a-z0-9]","ig")," ");
           let list = stripped.split(" ");
   
           for(let token of list){
               let newToken = token.trim();
               console.log(newToken);
               if( newToken && ["and","to"].indexOf(newToken.toLowerCase()) < 0 ){
                   result.push(newToken.toLowerCase());
               }
           }
           }
           console.log(result);
           return( result );
       }
       /*
       function shingleFacet(arr) {
           const combinations = [];
       
           function generate(currentCombination, remainingElements, start) {
           combinations.push([...currentCombination]);
       
           for (let i = start; i < remainingElements.length; i++) {
               currentCombination.push(remainingElements[i]);
               generate(currentCombination, remainingElements, i + 1);
               currentCombination.pop(); // Backtrack
           }
           }
       
           generate([], arr, 0);
           return combinations;
       }
       */
   
       function queryCallback(res) {
           let str = "";
           let ctx = this.ctx;
           let contentLength = res.headers['Content-Length'];
           if(!contentLength )
               contentLength = res.headers['content-length'];
           
           console.log("Content-Length: " + contentLength);
   
           res.on('data', function (chunk) {
                   str += chunk; 
           });
   
           res.on('end', function () {
                   try {
                       let data = JSON.parse(str);
                       let qtime = data?.responseHeader?.QTime;
                       
   
                       console.log("got " + str.length + " characters with a qtime: " + qtime);
                       let field = ctx.commandLine.field;
                       let entity = ctx.commandLine.entity;
                       if( data.facet_counts && data.facet_counts.facet_fields && data.facet_counts.facet_fields[field] ){
                           let facetData = data.facet_counts.facet_fields[field];
                           if( ctx.HANDLERS[field] ){
                               ctx.HANDLERS[field](ctx,field,facetData);
                           }
                           else {
                               let batch = [];
   
                               for(let i = 0;i < facetData.length;i+=2){
                                   let facetStr = facetData[i];
                                   console.log(facetStr);
   
                                   let newRec = {id: entity + i,type_s: entity};
                                   let parts = ctx.commandLine.shingle == "true" ? shingleFacet(facetStr) : [];
                                   newRec[ctx.commandLine.tagfield] = parts.length > 0 ? parts : [facetStr];
                                   //newRec[ctx.commandLine.outputfield] = facetStr.replace(new RegExp("[^a-z0-9]","ig"),"").toUpperCase();
                                   newRec[ctx.commandLine.outputfield] = facetStr.replace(new RegExp("[^a-z0-9]","ig"),"").toUpperCase();
                                   newRec["original_txt"] = facetStr;
                                   batch.push(newRec);
                               }
   
                               if( ctx.commandLine.dedupe == "true" )
                                   batch = dedupeEntities(ctx,batch);
   
                               loadEntities(ctx,batch);
   
                               writeEntityFile(ctx,batch);
                           }
   
                       }
   
                       
                   }
                   catch(e){
                       //failed
                       console.log("failed to parse " + e + " " + str);
                   }
           });
       }
   
       function updateCallback(res) {
           let str = "";
           let loopCtx = this.loopCtx;
           let next = this.next;
           let docCount = this.hasOwnProperty("docCount") ? this.docCount : loopCtx.docCount;
          
       res.on('data', function (chunk) {
                   str += chunk;
                   
               });
   
       res.on('end', function () {
               console.log("UPDATE " + docCount,str);	
   
               if( next ){
                   next(loopCtx);
               }
       });
       }
   
       function batchLoad(loopCtx){
           let ctx = loopCtx.ctx;
           
           if( loopCtx.docs.length > 0 ){
               let docs = [];
               for(let i = 0;i < ctx.commandLine.batchsize;i++){
                   let doc = loopCtx.docs.shift();
                   if( doc ){
                       docs.push(doc);
                   }
                   else {
                       break;
                   } 
               }
   
               if( docs.length > 0 ){
                   loopCtx.docCount += docs.length;
   
                   let tCallback = updateCallback.bind({ctx,loopCtx,next: batchLoad});
                   //console.log("hasmore",hasMore);
                   let conf = {hostname: ctx.commandLine.destinationSolrHost,port: ctx.commandLine.destinationSolrPort,path: ctx.commandLine.destinationSolrUpdatePath,method: 'POST',headers: {'Content-Type': 'application/json'}};
   
                   if( ctx.commandLine.authKey ){
                       conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
                   }
                       
                   let t = (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).request(conf, tCallback);
                   t.on('error', (err) => console.log(err));
                   t.write(JSON.stringify(docs));
                   t.end();
               }
               else {
                   console.log("done");
               }
           }
           else {
               console.log("done");
           }
       }
   
       function loadEntities(ctx,batch){
           if( ctx.commandLine.batchload == "true" ){
               let loopCtx = {ctx,docCount: 0,docs: batch};
               batchLoad(loopCtx);
           }
           else {
               let tCallback = updateCallback.bind({ctx,docCount: batch.length});
               //console.log("hasmore",hasMore);
               let conf = {hostname: ctx.commandLine.destinationSolrHost,port: ctx.commandLine.destinationSolrPort,path: ctx.commandLine.destinationSolrUpdatePath,method: 'POST',headers: {'Content-Type': 'application/json'}}
   
               if( ctx.commandLine.authKey ){
                   conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
               }
                   
               let t = (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).request(conf, tCallback);
               t.on('error', (err) => console.log(err));
               t.write(JSON.stringify(batch));
               t.end();
           }
       }
   
       function loadEntityData(ctx){
           if( ctx.commandLine.mode == "facet") {
               let tCallback = queryCallback.bind({ctx});
               
               let tSourceSolrPath = ctx.commandLine.sourceSolrPath + "&rows=0&facet=true&facet.mincount=1&facet.limit=-1&facet.field=" + ctx.commandLine.field;
               if( ctx.commandLine.filter ){
                   tSourceSolrPath += "&fq=" + ctx.commandLine.filter;
               }
   
               console.log("query: " + tSourceSolrPath);
   
               let conf = {hostname: ctx.commandLine.sourceSolrHost,port: ctx.commandLine.sourceSolrPort,path: tSourceSolrPath,method: 'GET',headers: {'Content-Type': 'application/json'}};
   
               if( ctx.commandLine.authKey ){
                   conf.headers['Authorization'] = 'Basic ' + ctx.commandLine.authKey;
               }
   
               let t =  (ctx.commandLine.sslMode ? ctx.lib.https : ctx.lib.http).request(conf, tCallback);
               t.on('error', (err) => console.log(err));
               t.end();
           }
           else {
               //file
               const instream = CONTEXT.lib.fs.createReadStream(commandLine.inputfile);
               instream.readable = true;
   
               const rl = CONTEXT.lib.readline.createInterface({
               input: instream,
               terminal: false
               });
   
               CONTEXT.rowCounter = 0;
               CONTEXT.rows = [];
               
               function readFunc(line) {
                   //onsole.log(line);
                   if( this.ctx.rowCounter == 0 ){
                       this.ctx.headers = line.split(",");
                       this.ctx.rowCounter++;
                   }
                   else {
                       let parts = line.split("\",\"");
                       if( parts.length > 1 ){
                           let newRec = {id: this.ctx.commandLine.entity + this.ctx.rowCounter,type_s: this.ctx.commandLine.entity};
                           for(let i in parts){
                               let data = parts[i].startsWith("\"") ? parts[i].substring(1) : parts[i];
                               data = data.endsWith("\"") ? data.substring(0,data.length-1) : data;
                               if( ctx.headers[i]== 'client_ss' ){
                                   newRec[ctx.headers[i]] = data.split(",");
                               }
                               else if( ctx.headers[i]== 'tagger_text' ){
                                   newRec[ctx.headers[i]] = [data];
                                   newRec[this.ctx.commandLine.suggestfield] = [data];
                                   newRec["suggest_text2"] = [data];
                                   newRec["suggest_text3"] = [data];
                               }
                               else {
                                   newRec[ctx.headers[i]] = [data];
                               }
                           }
                           if( newRec.tagger_text.length > 0 && newRec.output.length > 0 ){
                               this.ctx.rows.push(newRec);
                               this.ctx.rowCounter++;
                           }
                       }
                   }
               }
   
               function closeFunc(){
                   console.log("done loading " + this.ctx.inputfile);
                   loadEntities(this.ctx,this.ctx.rows);
               }
               if( rl ) rl.on('line', readFunc.bind({ctx: CONTEXT}));
               if( rl ) rl.on('close', closeFunc.bind({ctx: CONTEXT}));
           }
       }
   
       loadEntityData(ctx);
   }
   
   