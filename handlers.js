let FUNCTIONS = {
	"REDUCETAGS": function (args) {
		let stateFrame = {input: args.input,location: args.location,state: "UNKNOWN"};
		let data = args.data;
		let response = data.response;

		if( response && response.docs ){
			stateFrame.tagsCount = data.tagsCount;
			if( stateFrame.tagsCount > 0 ){
				stateFrame.state = "ACTIVE";
			}
			let newTags = [];
			let slag = stateFrame.input;

			for(let tagIdx = data.tags.length -1;tagIdx >= 0;tagIdx--){//in data.tags){
				let tag = data.tags[tagIdx];
				let anchor = stateFrame.input.substring(tag[1],tag[3]);
				slag = slag.substring(0,tag[1]) + slag.substring(tag[3]+1);
				let ids = tag[5];

				let newTag = {anchor,idx: tagIdx,ids,offset: {start: tag[1],end: tag[3]}};

				newTags.unshift(newTag);
			}
			stateFrame.slag = slag;
			stateFrame.tags = newTags;
			stateFrame.entity = [];
			for(let tag of response.docs){
				if( !tag.output )
					tag.output = ["MISSING"];
				if( tag.type_s == "INTENT" ){
					if( !stateFrame.intent )
						stateFrame.intent = [];
					stateFrame.intent.push(tag.output[0] + " - " + tag.tagger_text[0]);
				}
				else {
					stateFrame.entity.push(JSON.stringify(tag));
				}	
			}
		}
		else {
			stateFrame.tagsCount = 0;
		}

		return( stateFrame );
	},
	"MERGEFRAMES": function(parentFrame,childFrame){
		let result = parentFrame;

		result.locations = childFrame;

		return( result );
	}
};

let HANDLERS = {
	"ZEN": function (args) {
		let result = { status: 1, message: "HANDLED" };
		let ctx = args.CONTEXT;
		let input = args.queryObj.input;
		
		let callback = function(data){
			let stateFrame = FUNCTIONS["REDUCETAGS"]({input: this.input,data,location: "lat,long"}); //{input: this.input,location: "lat,long"};
			let ctx = this.args.CONTEXT;

			if( stateFrame.slag ){
				let locationCB = function(data){
					let locationFrame = FUNCTIONS["REDUCETAGS"]({input: this.input,data,location: "lat,long"}); //{input: this.input,location: "lat,long"};
					let parentFrame = this.stateFrame;
					let finalFrame = FUNCTIONS["MERGEFRAMES"](parentFrame,locationFrame);
					this.args.callback(finalFrame);
				}.bind({args: this.args,input: stateFrame.slag,stateFrame});

				let payload = stateFrame.slag;
				let path = "/solr/" + ctx.SOLRCOLLECTION + "/tag?field=tagger_location";
				ctx.lib.getRESTData({host: ctx.SOLRHOST, port: ctx.SOLRPORT,type: "raw", path, payload,callback: locationCB });
			}
			else {
				this.args.callback(stateFrame);
			}
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
	},
	getFunctions: function () {
		return (FUNCTIONS);
	}
}
