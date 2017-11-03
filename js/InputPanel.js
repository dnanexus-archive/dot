var InputPanel = function(opts) {
	this.spec = opts.spec;
	this.element = opts.element;
	this.values = {};

	for (var key in this.spec) {
		this.values[key] = "";
	}

	if (opts.spec == undefined || opts.element == undefined) {
		console.error("InputPanel needs an input object with keys 'spec' and 'element'");
	}

	var _this = this;

	_this.inputs = _this.element.html("").selectAll(".input").data(R.values(_this.spec)).enter().append("div").attr("class","input");

	_this.inputs.append("h3").html(function(d) {return d.name});
	_this.inputs.append("label").html("From a URL:");
	_this.inputs.append("input").property("type","text").on("keyup", setOnEnter(_this));

	_this.readUrlParameters();
};

var setOnEnter = R.curry(function(inputPanel, d) {
	var keyCode = d3.event.keyCode;
	if (keyCode === 13) {
		inputPanel.set(d.name, "url", d3.event.target.value)
	}
});

InputPanel.prototype.updateUI = function() {
	var _this = this;
	_this.inputs.selectAll("input").property("value", function(d) {return _this.values[d.name]});
}

InputPanel.prototype.readUrlParameters = function() {
	var vars = {};
	var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
			vars[key] = value;
	});

	for (var key in vars) {
		if (this.values[key] !== undefined) {
			this.set(key, "url", vars[key]);
		} else {
			console.warn("Unrecognized URL parameter:", key);
		}
	}

	this.updateUI();

};

InputPanel.prototype.set = function(variable, inputType, value) {
	this.values[variable] = value;
	if (typeof(this.spec[variable].callback) === "function") {
		this.spec[variable].callback(value);
	}

	console.log("set", variable, "as", inputType, "with value:", value);
};
