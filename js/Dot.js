var Dot = function(element, config) {
	
	this.element = element;

	this.validateConfig(config);

	this.config = config;
	
	// Set up config variables
	this.height = config.height;
	this.width = config.width;
	this.data = config.data;


	// Keys hardcoded for now, but check periodically that plot still works when these are swapped
	this.k = { x: "ref", y:"query" };

	// scales
	this.scales = {};
	this.scales.x = new MultiSegmentScale({data: _data, key_name: this.k.x, length_name: [this.k.x + "_length"], padding_fraction: _settings.padding_fraction});
	this.scales.y = new MultiSegmentScale({data: _data, key_name: this.k.y, length_name: [this.k.y + "_length"], padding_fraction: _settings.padding_fraction});

	this.scales.x.range([0, this.width]);
	this.scales.y.range([this.height, 0]);

	// Draw initial canvas
	this.canvas = this.element.append('canvas')
			.attr('width', _map.width)
			.attr('height', _map.height)
			.node().getContext('2d');
	
	
}

Dot.prototype.draw = function() {

	// Draw outside border rectangle
	this.canvas.rect(0,0,_map.width,_map.height);
	this.canvas.stroke();

	
	// Draw lines
	for (var i = 0; i < this.data.length; i++) {
		var d = this.data[i];
		this.canvas.moveTo(this.scales.x.get( d[this.k.x], d[this.k.x + '_start'] ),this.scales.y.get( d[this.k.y], d[this.k.y + '_start'] ));
		this.canvas.lineTo(this.scales.x.get( d[this.k.x], d[this.k.x + '_end'] ),this.scales.y.get( d[this.k.y], d[this.k.y + '_end'] ));
		this.canvas.stroke();
	}
	
}


Dot.prototype.validateConfig = function(config) {
	const requiredTypes = {
		height: "number",
		width: "number",
		data: "object"
	}

	for (var key in requiredTypes) {
		if (config[key] === undefined) {
			console.error(key, "is undefined in Dot's config");
		} else if (typeof(config[key]) !== requiredTypes[key]){
			console.error(key, "should be of type:", requiredTypes[key], "but is instead of type:", typeof(config[key]));
		} else {
			console.log(key, "type is correct");
		}
	}
}
