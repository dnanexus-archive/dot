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
		xAnnotations: [],
		yAnnotations: [],
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

	this.svg.xAnnotations = this.svg.append("g");
	this.svg.yAnnotations = this.svg.append("g");

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


	///////////////////////////////////////////////////////////////
	// TESTING ANNOTATION TRACKS:
	this.addAnnotationTrack("x", "data goes here");
	this.addAnnotationTrack("x", "data goes here");
	this.addAnnotationTrack("y", "data goes here");
	this.addAnnotationTrack("y", "data goes here");
	///////////////////////////////////////////////////////////////


	this.drawLayout();
	this.drawGrid();
	this.drawAlignments();
	this.drawAnnotationTracks();


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

DotPlot.prototype.addAnnotationTrack = function(side, data) {
	if (side == "x") {
		this.state.xAnnotations.push(new Track({side: side, element: this.svg.xAnnotations.append("g"), data: data}));
	} else if (side == "y") {
		this.state.yAnnotations.push(new Track({side: side, element: this.svg.yAnnotations.append("g"), data: data}));
	} else {
		throw("in addAnnotationTrack, side must by 'x' or 'y'");
	}
}

DotPlot.prototype.drawAnnotationTracks = function() {
	this.svg.xAnnotations
		.attr("transform","translate(" + this.state.layout.annotations.x.left + "," + this.state.layout.annotations.x.top + ")");
	this.svg.yAnnotations
		.attr("transform","translate(" + this.state.layout.annotations.y.left + "," + this.state.layout.annotations.y.top + ")");

	for (var i in this.state.xAnnotations) {
		this.state.xAnnotations[i].width(this.state.layout.inner.width);
		this.state.xAnnotations[i].draw();
	}
	for (var i in this.state.yAnnotations) {
		this.state.yAnnotations[i].height(this.state.layout.inner.height);
		this.state.yAnnotations[i].draw();
	}
	console.log(this.state.yAnnotations);
}

DotPlot.prototype.drawLayout = function() {
	
	// Set up the static parts of the view that only change when width or height change, but not when zooming or changing data
	var paddingLeft = 120;
	var paddingBottom = 100;
	var paddingTop = 10;
	var paddingRight = 10;

	var annotationThicknessX = 0;
	for (var i in this.state.xAnnotations) {
		this.state.xAnnotations[i].top(annotationThicknessX);
		annotationThicknessX += this.state.xAnnotations[i].height();
	}
	var annotationThicknessY = 0;
	for (var i in this.state.yAnnotations) {
		this.state.yAnnotations[i].left(annotationThicknessY);
		annotationThicknessY += this.state.yAnnotations[i].width();
	}

	// Inside plotting area:
	this.state.layout.inner = {
		left: paddingLeft + annotationThicknessY,
		top: paddingTop,
		width: this.state.layout.whole.width - annotationThicknessY - paddingLeft - paddingRight,
		height: this.state.layout.whole.height - annotationThicknessX - paddingBottom - paddingTop,
	}

	this.state.layout.annotations = {
		x: { 
			top: (this.state.layout.inner.top + this.state.layout.inner.height),
			left: this.state.layout.inner.left,
		},
		y: { 
			top: (this.state.layout.inner.top),
			left: this.state.layout.inner.left - annotationThicknessY,
		}
	}

	this.state.layout.outer = {
		left: paddingLeft,
		top: paddingTop,
		width: this.state.layout.inner.width + annotationThicknessY,
		height: this.state.layout.inner.height + annotationThicknessX,
	}

	this.svg
		.attr("width", this.state.layout.whole.width)
		.attr("height", this.state.layout.whole.height);

	this.svg.select("g.innerPlot")
		.attr("transform", "translate(" + this.state.layout.inner.left + "," + this.state.layout.inner.top + ")");

	this.canvas
		.style("top", this.state.layout.inner.top + "px")
		.style("left", this.state.layout.inner.left + "px")
		.attr('width', this.state.layout.inner.width)
		.attr('height', this.state.layout.inner.height);


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
		.style("stroke","black");

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
	c.setTransform(1, 0, 0, 1, 0, 0);
	
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
	// }
	
	// // Horizontal lines for sequence boundaries along the y-axis
	// c.font="10px Arial";
	// c.textAlign = "right";
	
	// for (var i = 0; i < boundariesY.length; i++) {
	// 	// Scale has already been applied inside getBoundaries()
	// 	c.moveTo(0,boundariesY[i].start);
	// 	c.lineTo(this.state.layout.inner.width, boundariesY[i].start);
	// }
	// c.stroke();	

	//////////////////////    Grid by svg    //////////////////////

	var verticalLines = this.svg.select("g.innerPlot")
		.selectAll("line.verticalGrid").data(boundariesX);

	var newVerticalLines = verticalLines.enter().append("line")
		.attr("class","verticalGrid");
	
	verticalLines.merge(newVerticalLines)
		.style("stroke","#AAAAAA")
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
		.style("stroke","#AAAAAA")
		.attr("x1", 0)
		.attr("y1", function(d) {return d.start})
		.attr("x2", this.state.layout.inner.width)
		.attr("y2", function(d) {return d.start});

	horizontalLines.exit().remove();


	//////////////////////    Labels by svg    //////////////////////

	var xLabels = this.svg.select("g.innerPlot")
		.selectAll("g.xLabels").data(boundariesX);

	var newXLabels = xLabels.enter().append("g")
		.attr("class","xLabels")
	
	newXLabels.append("text")
		.style("text-anchor","end")
		.style("font-size", 10)
		.attr("transform", "rotate(-45)")

	var labelHeight = this.state.layout.outer.height + 20;
	xLabels = xLabels.merge(newXLabels)
		.attr("transform",function(d) {return "translate(" + (d.start+d.end)/2 + "," + labelHeight + ")"})
	
	xLabels.select("text").datum(function(d) {return d})
			.text(function(d) {return d.name});

	xLabels.exit().remove();


	var inner = this.state.layout.inner;

	var yLabels = this.svg.select("g.innerPlot")
		.selectAll("text.yLabels").data(boundariesY);

	var newYLabels = yLabels.enter().append("text")
		.attr("class","yLabels")
		.style("text-anchor","end")
		.style("font-size", 10);

	yLabels.merge(newYLabels)
		.attr("x", -10 + this.state.layout.annotations.y.left - this.state.layout.inner.left)
		.attr("y", function(d) {return inner.top + (d.start+d.end)/2})
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
	c.setTransform(1, 0, 0, 1, 0, 0);

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
//////////////////////////////////////////      Track       ////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////

var Track = function(config) {
	this.element = config.element;
	
	this.element.append("rect")
		.attr("class","trackBackground");

	this.state = {left: 0, top: 0, height: 30, width: 30};

	this.draw();
}

Track.prototype.top = function(newTop) {
	if (newTop === undefined) {
		return this.state.top;
	} else {
		this.state.top = newTop;
	}
}

Track.prototype.left = function(newLeft) {
	if (newLeft === undefined) {
		return this.state.left;
	} else {
		this.state.left = newLeft;
	}
}

Track.prototype.height = function(newHeight) {
	if (newHeight === undefined) {
		return this.state.height;
	} else {
		this.state.height = newHeight;
	}
}

Track.prototype.width = function(newWidth) {
	if (newWidth === undefined) {
		return this.state.height;
	} else {
		this.state.width = newWidth;
	}
}

Track.prototype.draw = function() {
	this.element.attr("transform", "translate(" + this.state.left + "," + this.state.top + ")");

	this.element.select("rect.trackBackground")
		.style("fill","lightblue")
		.style("stroke","blue")
		.attr("width", this.state.width)
		.attr("height", this.state.height);
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





