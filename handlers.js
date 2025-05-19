let HANDLERS = {
	"ZEN": function (args) {
		let result = { status: 1, message: "HANDLED" };
		let ctx = args.CONTEXT;
		let input = args.queryObj.input;
		
		let callback = function(data){
			let stateFrame = {input: this.input,location: "lat,long"};
			let response = data.response;

			if( response && response.docs ){
				stateFrame.tagsCount = data.tagsCount;
				stateFrame.tags = data.tags;
				stateFrame.intent = [];
				stateFrame.entity = [];
				for(let tag of response.docs){
					if( !tag.output )
						tag.output = ["MISSING"];
					if( tag.type_s == "INTENT" ){
						stateFrame.intent.push(tag.output[0] + " - " + tag.tagger_text[0]);
					}
					else {
						stateFrame.entity.push(tag.type_s + " - " + tag.output[0] + " - " + tag.tagger_text[0]);
					}	
				}
			}
			else {
				stateFrame.tagsCount = 0;
			}

			args.callback(stateFrame);
		}.bind({args,input});

		let payload = input;
		let path = "/solr/" + ctx.SOLRCOLLECTION + "/tag";
		ctx.lib.getRESTData({host: ctx.SOLRHOST, port: ctx.SOLRPORT,type: "raw", path, payload,callback });

		return (result);
	}
};

module.exports = {
	getHandlers: function () {
		return (HANDLERS);
	}
}


