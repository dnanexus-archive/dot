var InputPanel = function(opts) {
	this.spec = opts.spec;
	this.element = opts.element;
	this.values = {};

	for (var key in this.spec) {
		this.values[key] = {};
	}

	if (opts.spec == undefined || opts.element == undefined) {
		console.error("InputPanel needs an input object with keys 'spec' and 'element'");
	}

	var _this = this;

	_this.inputs = _this.element.html("")
		.selectAll(".input").data(R.values(_this.spec))
		.enter().append("div")
			.attr("class","input");

	_this.inputs.append("h4").html(function(d) {return d.name});
	_this.inputs.append("label").html("From a URL:");
	_this.inputs.append("input").property("type","text").on("keyup", setOnEnter(_this))
	_this.inputs.append("label").html("From a local file:");
	_this.inputs.append("input").property("type","file").on("change", setLocalFile(_this));

	_this.readUrlParameters();
};

var setLocalFile = R.curry(function(inputPanel, d) {
	inputPanel.set(d.name, "File", this.files[0]);
})

var setOnEnter = R.curry(function(inputPanel, d) {
	var keyCode = d3.event.keyCode;
	if (keyCode === 13) {
		inputPanel.set(d.name, "url", d3.event.target.value)
	}
});

InputPanel.prototype.updateUI= function() {
	var _this = this;
	_this.inputs.selectAll("input[type=text]")
		.filter(function(d) {return _this.values[d.name].inputType === "url";})
			.property("value", function(d) {return _this.values[d.name].value});

	_this.inputs.selectAll("input[type=text]")
		.filter(function(d) {return _this.values[d.name].inputType === "File";})
			.property("value", "");
	
	_this.inputs.selectAll("input[type=file]")
		.filter(function(d) {return _this.values[d.name].inputType === "url";})
		.property("value", "");
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

	// this.updateUI();

};

InputPanel.prototype.set = function(variable, inputType, value) {
	this.values[variable] = {value: value, inputType: inputType};
	if (typeof(this.spec[variable].callback) === "function") {
		this.spec[variable].callback(value, inputType);
	}

	console.log("set", variable, "as", inputType, "with value:", value);

	this.updateUI();
};
