let HANDLERS = {
	"ZEN": function (args) {
		let result = { status: 1, message: "HANDLED" };
		let CONTEXT = args.CONTEXT;

		return (result);
	}
};

module.exports = {
	getHandlers: function () {
		return (HANDLERS);
	}
}


