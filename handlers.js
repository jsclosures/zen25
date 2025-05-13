let HANDLERS = {
	"ZEN": function (args) {
		let result = { status: 1, message: "HANDLED" };
		let ctx = args.CONTEXT;
		let input = args.queryObj.input;
		
		let callback = function(test){
			args.callback(test);
		}
		let payload = input;
		let path = "/solr/" + ctx.SOLRCOLLECTION + "/tag";
		ctx.lib.getRESTData({host: ctx.SOLRHOST, port: ctx.SOLRPORT, path, payload,callback });

		return (result);
	}
};

module.exports = {
	getHandlers: function () {
		return (HANDLERS);
	}
}


