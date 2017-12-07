var InputPanel = function(opts) {
	this.spec = opts.spec;
	this.element = opts.element;
	this.values = {};

	for (var key in this.spec) {
		this.values[key] = {};
		this.spec[key].id = key;
	}

	if (opts.spec == undefined || opts.element == undefined) {
		console.error("InputPanel needs an input object with keys 'spec' and 'element'");
	}

	var singleInput = R.length(R.values(this.spec)) === 1;


	var _this = this;

	_this.element.html("");
	
	_this.inputs = _this.element
		.selectAll(".input").data(R.values(_this.spec))
		.enter().append("div")
			.attr("class","InputPanelItem form-group");

	_this.inputs.append("h4").html(function(d) {
		if (d.required) {
			return "<span class='req' title='Required input'>* </span>" + d.name;
		} else {
			return d.name;
		}
	});

	
	_this.inputs.append("label")
		.property("for", function(d){return d.id + "_" + "url"})
		.html("Enter a URL:");

	_this.inputs.append("input")
		.property("type","text")
		.attr("class","form-control")
		.attr("id", function(d){return d.id + "_" + "url"})
		.on("keyup", setOnEnter(_this));
	
	_this.inputs.append("label")
		.property("for", function(d){return d.id + "_" + "file"})
		.html("or pick a local file:");

	_this.inputs.append("input")
		.property("type","file")
		.attr("class","form-control-file")
		.attr("id", function(d){return d.id + "_" + "file"})
		.on("change", setLocalFile(_this));

	_this.inputs.append("hr");

	_this.readUrlParameters();
};

var setLocalFile = R.curry(function(inputPanel, d) {
	inputPanel.set(d.id, "File", this.files[0]);
})

var setOnEnter = R.curry(function(inputPanel, d) {
	var keyCode = d3.event.keyCode;
	if (keyCode === 13) {
		inputPanel.set(d.id, "url", d3.event.target.value)
	}
});

InputPanel.prototype.updateUI= function() {
	var _this = this;

	_this.inputs.selectAll("input[type=text]")
		.filter(function(d) {return _this.values[d.id].inputType === "url";})
			.property("value", function(d) {return _this.values[d.id].value});

	_this.inputs.selectAll("input[type=text]")
		.filter(function(d) {return _this.values[d.id].inputType !== "url";})
			.property("value", "");
	
	_this.inputs.selectAll("input[type=file]")
		.filter(function(d) {return _this.values[d.id].inputType !== "File";})
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
};

InputPanel.prototype.clearInputs= function() {
	for (var variable in this.values) {
		this.set(variable, "empty", "");
	}
}

InputPanel.prototype.set = function(variable, inputType, value) {
	this.values[variable] = {value: value, inputType: inputType};
	if (typeof(this.spec[variable].callback) === "function") {
		this.spec[variable].callback(value, inputType, variable);
	}

	this.updateUI();
};
