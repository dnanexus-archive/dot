var Dot = function(element, config) {
	
	this.element = element;

	this.validateConfig(config);

	this.config = config;
	
	// Set up config variables
	this.height = config.height;
	this.width = config.width;
	this.data = config.data;

	this.settings = {
		padding: {left: 70, bottom: 70}
	}


	// Keys hardcoded for now, but check periodically that plot still works when these are swapped
	this.k = { x: "ref", y: "query" };

	// scales
	this.scales = {};
	this.scales.x = new MultiSegmentScale({data: this.data, key_name: this.k.x, length_name: [this.k.x + "_length"], padding_fraction: _settings.padding_fraction});
	this.scales.y = new MultiSegmentScale({data: this.data, key_name: this.k.y, length_name: [this.k.y + "_length"], padding_fraction: _settings.padding_fraction});

	this.setUp();
	this.draw();
}

Dot.prototype.setUp = function() {
	// Set up the static parts of the view that only change when width or height change, but not when zooming or changing data

	// Draw initial canvas
	this.canvas = this.element.append('canvas')
			.attr('width', this.width)
			.attr('height', this.height)
			.node().getContext('2d');



	// Draw outside border rectangle
	this.canvas.setTransform(1, 0, 0, 1, 0, 0);
	this.canvas.rect(0,0,this.width,this.height);
	this.canvas.stroke();

	// Inside plotting area:
	this.layout = {
		left: this.settings.padding.left,
		top: 0,
		width: this.width - this.settings.padding.left,
		height: this.height - this.settings.padding.bottom
	}

	// Set scales with the correct inner size, but don't use them to translate, since we will be applying a translate in the draw function itself
	this.scales.x.range([0, this.layout.width]);
	this.scales.y.range([this.layout.height, 0]);

}

Dot.prototype.draw = function() {

	// Translate() shifts things over everytime we call it, so reset first to clear any previous translations
	this.canvas.setTransform(1, 0, 0, 1, 0, 0);

	this.canvas.translate(this.layout.left, this.layout.top);
	this.canvas.rect(0,0,this.layout.width, this.layout.height);

	// Blue background for testing
	this.canvas.fillStyle = "#dbf0ff";
	this.canvas.fillRect(0,0,this.layout.width, this.layout.height);
	


	// Draw lines
	for (var i = 0; i < this.data.length; i++) {
		var d = this.data[i];
		this.canvas.moveTo(this.scales.x.get( d[this.k.x], d[this.k.x + '_start'] ),this.scales.y.get( d[this.k.y], d[this.k.y + '_start'] ));
		this.canvas.lineTo(this.scales.x.get( d[this.k.x], d[this.k.x + '_end'] ),this.scales.y.get( d[this.k.y], d[this.k.y + '_end'] ));
	}
	this.canvas.stroke();
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
		}
	}
}
