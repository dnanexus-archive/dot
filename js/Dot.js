////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////      Dot Plot       /////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////


var DotPlot = function(element, config) {
	
	this.element = element;

	this.validateConfig(config);

	this.config = config;
	
	// Set up config variables
	this.height = config.height;
	this.width = config.width;
	this.data = undefined;

	this.settings = {
		padding: {left: 120, bottom: 100}
	}

}

DotPlot.prototype.setData = function(data) {
	this.data = data

	// Keys hardcoded for now, but check periodically that plot still works when these are swapped
	this.k = { x: "ref", y: "query" };

	// scales
	this.scales = {};
	this.scales.x = new MultiSegmentScale({data: this.data, key_name: this.k.x, length_name: [this.k.x + "_length"]});
	this.scales.y = new MultiSegmentScale({data: this.data, key_name: this.k.y, length_name: [this.k.y + "_length"]});

	this.drawStatics();

	this.drawGrid();
	this.drawAlignments();
}

DotPlot.prototype.drawStatics = function() {
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

	
	var c = this.canvas;
	c.setTransform(1, 0, 0, 1, this.layout.left, this.layout.top);

	////////////////////////////////////////    Borders    ////////////////////////////////////////
	
	// Inner plot border
	c.rect(0,0,this.layout.width, this.layout.height);

	// Blue background on inner plot for testing
	c.fillStyle = "#ffffff"; //"#dbf0ff";
	c.fillRect(0,0,this.layout.width, this.layout.height);
	
	//////////////////////////////////////    Axis titles    //////////////////////////////////////
	
	// X-axis label (this.k.x is "ref" by default)
	c.fillStyle = "#000000";
	c.font="20px Arial";
	c.textAlign = "center";
	c.fillText(this.k.x, this.layout.width/2, this.config.height - 10);

	// Y-axis label (this.k.y is "query" by default)
	c.save()
	c.rotate(-Math.PI/2);
	c.textAlign = "center";
	c.fillText(this.k.y, -this.layout.height/2, -this.layout.left + 20);
	c.restore() // undo the rotation so we don't mess up everything else!

	//////////////////////////////////////    Set up scales for plotting    //////////////////////////////////////

	// Set scales with the correct inner size, but don't use them to translate, since we will be applying a translate in the draw function itself
	this.scales.x.range([0, this.layout.width]);
	this.scales.y.range([this.layout.height, 0]);

}

DotPlot.prototype.drawGrid = function() {

	var c = this.canvas;

	// Translate everything relative to the inner plotting area
	c.setTransform(1, 0, 0, 1, this.layout.left, this.layout.top);

	
	/////////////////////////////////////////    Grid and axis labels    //////////////////////////////////////////

	c.strokeStyle = "#AAAAAA";
	c.fillStyle = "#000000";

	// Vertical lines for sequence boundaries along the x-axis
	const boundariesX = this.scales.x.getBoundaries();
	c.font="10px Arial";
	c.textAlign = "right";
	for (var i = 0; i < boundariesX.length; i++) {
		// Scale has already been applied inside getBoundaries()
		c.moveTo(boundariesX[i].start,0);
		c.lineTo(boundariesX[i].start,this.layout.height);
		// rotated axis labels
		c.save();
		c.translate((boundariesX[i].start+boundariesX[i].end)/2,this.layout.height + 20);
		c.rotate(-Math.PI/4);
		c.fillText(boundariesX[i].name, 0, 0);
		c.restore();
	}
	
	// Horizontal lines for sequence boundaries along the y-axis
	c.font="10px Arial";
	c.textAlign = "right";
	const boundariesY = this.scales.y.getBoundaries();
	for (var i = 0; i < boundariesY.length; i++) {
		// Scale has already been applied inside getBoundaries()
		c.moveTo(0,boundariesY[i].start);
		c.lineTo(this.layout.width,boundariesY[i].start);
		c.fillText(boundariesY[i].name, -10, (boundariesY[i].start+boundariesY[i].end)/2);
	}
	c.stroke();	
}

DotPlot.prototype.drawAlignments = function() {
	var c = this.canvas;

	/////////////////////////////////////////    Alignments    /////////////////////////////////////////
	
	// Draw lines
	c.beginPath();
	c.strokeStyle = "#000000";
	for (var i = 0; i < this.data.length; i++) {
		var d = this.data[i];
		c.moveTo(this.scales.x.get( d[this.k.x], d[this.k.x + '_start'] ),this.scales.y.get( d[this.k.y], d[this.k.y + '_start'] ));
		c.lineTo(this.scales.x.get( d[this.k.x], d[this.k.x + '_end'] ),this.scales.y.get( d[this.k.y], d[this.k.y + '_end'] ));
	}
	c.stroke();
}

DotPlot.prototype.validateConfig = function(config) {
	const requiredTypes = {
		height: "number",
		width: "number"
	}

	for (var key in requiredTypes) {
		if (config[key] === undefined) {
			console.error(key, "is undefined in Dot's config");
		} else if (typeof(config[key]) !== requiredTypes[key]){
			console.error(key, "should be of type:", requiredTypes[key], "but is instead of type:", typeof(config[key]));
		}
	}
}



////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////      Dot App       //////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////


var DotApp = function(element, config) {

	this.element = element;

	this.plot_element = this.element.append("div");
	this.dataLoader = config.dataLoader;

	this.dotplot = new DotPlot(this.plot_element, {height: config.height, width: config.width});	
	this.dataLoader(this.setData.bind(this));
}


DotApp.prototype.setData = function(data) {
	this.data = data;

	this.dotplot.setData(data);
}





