////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////      Dot Plot       /////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////

var DotPlot = function(element, config) {
	
	this.element = element;

	validateConfig(config);

	this.config = config;
	this.data = undefined;

	this.state = {
		layout: {
			whole: {height: config.height, width: config.width},
			inner: {height: null, width: null},

		},
		all_refs: null,
		all_queries: null,
		selected_refs: null,
		selected_queries: null,
		data_by_chromosome: {},
	};

	this.k = { x: "ref", y: "query" };


	// Set up permanent DOM elements
	this.canvas = this.element.append('canvas');
	this.context = this.canvas
			.node().getContext('2d');
	this.svg = this.element.append("svg");
	this.svg.append("rect").attr("class","innerBorder");
	this.svg.append("text").attr("class","xTitle");
	this.svg.append("g").attr("class","yTitle").append("text").attr("class","yTitle");
	this.svg.append("g").attr("class","innerPlot");

}

DotPlot.prototype.setData = function(data) {
	this.data = data;

	// Set reference and query sequence sizes:
	this.state.all_refs = R.compose( R.uniq, R.map(R.props(["ref", "ref_length"])))(data);
	this.state.all_queries = R.compose( R.uniq, R.map(R.props(["query", "query_length"])))(data);

	this.selectRefs([0,1]); // testing chromosome selection
	this.selectQueries();

	// Store data indexed by chromosome:
	this.state.data_by_chromosome = R.groupBy(R.prop("ref"), data);

	// scales
	this.scales = {};
	this.updateScales();

	this.drawStatics();

	this.drawGrid();
	this.drawAlignments();
}



DotPlot.prototype.updateScales = function() {
	this.scales.x = new MultiSegmentScale({data: this.state.selected_refs, key_name: 0, length_name: 1});
	this.scales.y = new MultiSegmentScale({data: this.state.selected_queries, key_name: 0, length_name: 1});
}

DotPlot.prototype.selectRefs = function(refIndices) {
	var state = this.state;
	if (refIndices === undefined) {
		state.selected_refs = state.all_refs;
	} else {
		state.selected_refs = R.map( function(i) {return state.all_refs[i]}, refIndices);
	}
}
DotPlot.prototype.selectQueries = function(queryIndices) {
	var state = this.state;
	if (queryIndices === undefined) {
		state.selected_queries = state.all_queries;
	} else {
		state.selected_queries = R.map( function(i) {return state.all_queries[i]}, queryIndices);
	}
}

DotPlot.prototype.drawStatics = function() {
	
	// Set up the static parts of the view that only change when width or height change, but not when zooming or changing data
	var paddingLeft = 120;
	var paddingBottom = 100;
	var paddingTop = 10;
	var paddingRight = 10;

	// Inside plotting area:
	this.state.layout.inner = {
		left: paddingLeft,
		top: paddingTop,
		width: this.state.layout.whole.width - paddingLeft - paddingRight,
		height: this.state.layout.whole.height - paddingBottom - paddingTop,
	}

	this.svg
		.attr("width", this.state.layout.whole.width)
		.attr("height", this.state.layout.whole.height);

	this.svg.select("g.innerPlot")
		.attr("transform", "translate(" + this.state.layout.inner.left + "," + this.state.layout.inner.top + ")");

	this.canvas
		.attr('width', this.state.layout.whole.width)
		.attr('height', this.state.layout.whole.height);


	//////////////////////////////////////    Set up scales for plotting    //////////////////////////////////////

	// Set scales with the correct inner size, but don't use them to translate, since we will be applying a translate in the draw function itself
	this.scales.x.range([0, this.state.layout.inner.width]);
	this.scales.y.range([this.state.layout.inner.height, 0]);

	var c = this.context;

	// Draw outside border rectangle
	// c.setTransform(1, 0, 0, 1, 0, 0);
	// c.strokeStyle = "#f0f";
	// c.rect(0,0,this.state.layout.whole.width,this.state.layout.whole.height);
	// c.stroke();

	////////////////////////////////////////    Borders    ////////////////////////////////////////
	
	// Inner plot border
	this.svg.select("rect.innerBorder")
		.attr("x", this.state.layout.inner.left)
		.attr("y", this.state.layout.inner.top)
		.attr("width", this.state.layout.inner.width)
		.attr("height", this.state.layout.inner.height)
		.style("stroke","red");

	//////////////////////////////////////    Axis titles    //////////////////////////////////////
	// Ref
	this.svg.select("text.xTitle")
		.attr("x", this.state.layout.inner.left + this.state.layout.inner.width/2)
		.attr("y", this.state.layout.whole.height-10)
		.style("dominant-baseline","middle")
		.style("text-anchor","middle")
		.style("font-size", 20)
		.text(this.k.x);
	
	// Query
	this.svg.select("g.yTitle")
		.attr("transform", "translate(20," + this.state.layout.inner.height/2 + ")")
		.select("text.yTitle")
			.attr("transform", "rotate(-90)")
			.style("dominant-baseline","middle")
			.style("text-anchor","middle")
			.style("font-size", 20)
			.text(this.k.y);
}

DotPlot.prototype.drawGrid = function() {

	var c = this.context;

	// Translate everything relative to the inner plotting area
	c.setTransform(1, 0, 0, 1, this.state.layout.inner.left, this.state.layout.inner.top);
	
	/////////////////////////////////////////    Grid and axis labels    //////////////////////////////////////////

	const boundariesX = this.scales.x.getBoundaries();
	const boundariesY = this.scales.y.getBoundaries();



	// //////////////////////    Grid by canvas    //////////////////////
	// c.strokeStyle = "#AAAAAA";
	// c.fillStyle = "#000000";

	// // Vertical lines for sequence boundaries along the x-axis
	// c.font="10px Arial";
	// c.textAlign = "right";
	// for (var i = 0; i < boundariesX.length; i++) {
	// 	// Scale has already been applied inside getBoundaries()
	// 	c.moveTo(boundariesX[i].start,0);
	// 	c.lineTo(boundariesX[i].start,this.state.layout.inner.height);
	// 	// rotated axis labels
	// 	c.save();
	// 	c.translate((boundariesX[i].start+boundariesX[i].end)/2,this.state.layout.inner.height + 20);
	// 	c.rotate(-Math.PI/4);
	// 	c.fillText(boundariesX[i].name, 0, 0);
	// 	c.restore();
	// }
	
	// // Horizontal lines for sequence boundaries along the y-axis
	// c.font="10px Arial";
	// c.textAlign = "right";
	
	// for (var i = 0; i < boundariesY.length; i++) {
	// 	// Scale has already been applied inside getBoundaries()
	// 	c.moveTo(0,boundariesY[i].start);
	// 	c.lineTo(this.state.layout.inner.width, boundariesY[i].start);
	// 	c.fillText(boundariesY[i].name, -10, (boundariesY[i].start+boundariesY[i].end)/2);
	// }
	// c.stroke();	




	//////////////////////    Grid by svg    //////////////////////

	var verticalLines = this.svg.select("g.innerPlot")
		.selectAll("line.verticalGrid").data(boundariesX);

	var newVerticalLines = verticalLines.enter().append("line")
		.attr("class","verticalGrid");
	
	verticalLines.merge(newVerticalLines)
		.style("stroke","red")
		.attr("x1", function(d) {return d.start})
		.attr("y1", 0)
		.attr("x2", function(d) {return d.start})
		.attr("y2", this.state.layout.inner.height);

	verticalLines.exit().remove();


	var horizontalLines = this.svg.select("g.innerPlot")
		.selectAll("line.horizontalGrid").data(boundariesY);

	var newHorizontalLines = horizontalLines.enter().append("line")
		.attr("class","horizontalGrid");

	horizontalLines.merge(newHorizontalLines)
		.style("stroke","red")
		.attr("x1", 0)
		.attr("y1", function(d) {return d.start})
		.attr("x2", this.state.layout.inner.width)
		.attr("y2", function(d) {return d.start});

	horizontalLines.exit().remove();


	//////////////////////    Labels by svg    //////////////////////

	// c.translate((boundariesX[i].start+boundariesX[i].end)/2,this.state.layout.inner.height + 20);

	var xLabels = this.svg.select("g.innerPlot")
		.selectAll("g.xLabels").data(boundariesX);

	var newXLabels = xLabels.enter().append("g")
		.attr("class","xLabels")
	
	newXLabels.append("text")
		.style("text-anchor","end")
		.style("font-size", 10)
		.text("hello")
		.attr("transform", "rotate(-45)")

	var innerHeight = this.state.layout.inner.height;
	xLabels = xLabels.merge(newXLabels)
		.attr("transform",function(d) {return "translate(" + (d.start+d.end)/2 + "," + (innerHeight + 20) + ")"})
	
	xLabels.select("text").datum(function(d) {return d})
			.text(function(d) {return d.name});

	xLabels.exit().remove();



	var yLabels = this.svg.select("g.innerPlot")
		.selectAll("text.yLabels").data(boundariesY);

	var newYLabels = yLabels.enter().append("text")
		.attr("class","yLabels")
		.style("text-anchor","end")
		.style("font-size", 10);

	yLabels.merge(newYLabels)
		.attr("x", -10)
		.attr("y", function(d) {return (d.start+d.end)/2})
		.text(function(d) {return d.name});

	yLabels.exit().remove();

}

DotPlot.prototype.drawAlignments = function() {
	var c = this.context;

	/////////////////////////////////////////    Alignments    /////////////////////////////////////////
	
	var state = this.state;
	var scales = this.scales;
	var x = this.k.x;
	var y = this.k.y;
	
	// Draw lines

	c.setTransform(1, 0, 0, 1, this.state.layout.inner.left, this.state.layout.inner.top);

	c.beginPath();
	c.strokeStyle = "#000000";
	
	R.map( function(refInfo) {
		var ref = refInfo[0];
		R.map( function(d) {
			c.moveTo(scales.x.get( d[x], d[x + '_start'] ), scales.y.get( d[y], d[y + '_start'] ));
			c.lineTo(scales.x.get( d[x], d[x + '_end']   ), scales.y.get( d[y], d[y + '_end'] ));
		}, state.data_by_chromosome[ref])
	}, state.selected_refs)

	c.stroke();
}

function validateConfig(config) {
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





