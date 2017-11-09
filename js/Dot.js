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
			inner: {height: null, width: null, left: null, top: null},

		},
		all_refs: null,
		all_queries: null,
		selected_refs: null,
		selected_queries: null,
		data_by_chromosome: {},
		annotationData: {},
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
	this.svg.append("g").attr("class","brush");

	this.xAnnotations = this.svg.append("g");
	this.yAnnotations = this.svg.append("g");

}

DotPlot.prototype.setData = function(data) {
	this.data = data;

	// Set reference and query sequence sizes:
	this.state.all_refs = R.compose( R.uniq, R.map(R.props(["ref", "ref_length"])))(data);
	this.state.all_queries = R.compose( R.uniq, R.map(R.props(["query", "query_length"])))(data);

	this.selectRefs();
	this.selectQueries();

	// Store data indexed by chromosome:
	this.state.data_by_chromosome = R.groupBy(R.prop("ref"), data);

	// scales
	this.scales = {x: null, y: null, zoom: {area: null, x: null, y: null}};
	this.updateScales();

	this.setUp();
	this.draw();
}

DotPlot.prototype.draw = function() {
	this.drawGrid();
	this.drawAlignments();
	this.drawAnnotationTracks();
}

DotPlot.prototype.updateScales = function() {
	this.scales.x = new MultiSegmentScale({data: this.state.selected_refs, key_name: 0, length_name: 1});
	this.scales.y = new MultiSegmentScale({data: this.state.selected_queries, key_name: 0, length_name: 1});

	this.scales.zoom.x = d3.scaleLinear();
	this.scales.zoom.y = d3.scaleLinear();
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

DotPlot.prototype.addAnnotationData = function(dataset) {
	var xSide = this.k.x;
	var ySide = this.k.y;
	if (this.state.annotationData[dataset.key] === undefined) {
		var plottableAnnotations = null;
		var side = null;

		if (R.any(R.equals(xSide), R.keys(dataset.data[0]))) {
			side = "x";			
		} else if (R.any(R.equals(ySide), R.keys(dataset.data[0]))) {
			side = "y";
		} else {
			throw("annotation file does not contain ref or query in the header");
		}

		var seqSide = this.k[side];
		var annotSeqs = R.uniq(R.pluck(seqSide, dataset.data));

		var alignmentSeqs = (seqSide === "ref" ? R.pluck(0, this.state.all_refs) : R.pluck(0, this.state.all_queries));

		var sharedSeqs = R.intersection(alignmentSeqs, annotSeqs);
		var annotSeqsNotInAlignments = R.difference(annotSeqs, alignmentSeqs);
		if (annotSeqsNotInAlignments.length > 0) {
			console.warn("Some annotations are on the following sequences that are not in the alignments input:", R.join(", ", annotSeqsNotInAlignments));
		}

		var seqMatchesSharedList = R.compose(R.contains(R.__, sharedSeqs), R.prop(seqSide));

		plottableAnnotations = R.filter(seqMatchesSharedList, dataset.data);
		
		this.addAnnotationTrack(side, plottableAnnotations);
		this.state.annotationData[dataset.key] = plottableAnnotations;
	}
}

DotPlot.prototype.addAnnotationTrack = function(side, data) {
	if (side == "x") {
		this.state.xAnnotations.push(new Track({side: side, element: this.xAnnotations.append("g"), data: data, parent: this}));
	} else if (side == "y") {
		this.state.yAnnotations.push(new Track({side: side, element: this.yAnnotations.append("g"), data: data, parent: this}));
	} else {
		throw("in addAnnotationTrack, side must by 'x' or 'y'");
	}

	this.setUp();
	this.draw();
}

DotPlot.prototype.drawAnnotationTracks = function() {
	this.xAnnotations
		.attr("transform","translate(" + this.state.layout.annotations.x.left + "," + this.state.layout.annotations.x.top + ")");
	this.yAnnotations
		.attr("transform","translate(" + this.state.layout.annotations.y.left + "," + this.state.layout.annotations.y.top + ")");

	for (var i in this.state.xAnnotations) {
		this.state.xAnnotations[i].width(this.state.layout.inner.width);
		this.state.xAnnotations[i].draw();
	}
	for (var i in this.state.yAnnotations) {
		this.state.yAnnotations[i].height(this.state.layout.inner.height);
		this.state.yAnnotations[i].draw();
	}
}


DotPlot.prototype.setUp = function() {
	
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

	this.svg.select("g.brush")
		.attr("transform", "translate(" + this.state.layout.inner.left + "," + this.state.layout.inner.top + ")");


	// Intialize brush to zoom functionality
	var plot = this;
	var brush = d3.brush()
		.extent([[0, 0], [plot.state.layout.inner.width, plot.state.layout.inner.height]])
		.on("end", brushended);
	
	var brushArea = this.svg.select("g.brush").call(brush);
	
	var x = plot.scales.zoom.x;
	var y = plot.scales.zoom.y;

	

	function setZoom(s) {
		x.domain([s[0][0], s[1][0]].map(x.invert, x));
		y.domain([s[1][1], s[0][1]].map(y.invert, y));

		plot.draw();
		brushArea.call(brush.move, null);
	}

	var idleTimeout, idleDelay = 350;

	function idled() {
		idleTimeout = null;
	}


	function brushended() {
		var s = d3.event.selection;
		if (s !== null) {
			setZoom(s);
		} else {
			// check for double-click
			if (!idleTimeout) {
				return idleTimeout = setTimeout(idled, idleDelay);
			}
			// zoom out
			var s = plot.scales.zoom.area;
			x.domain([s[0][0], s[1][0]]);
			y.domain([s[1][1], s[0][1]]);
			plot.draw();
		}
	}

	this.canvas
		.style("top", this.state.layout.inner.top + "px")
		.style("left", this.state.layout.inner.left + "px")
		.attr('width', this.state.layout.inner.width)
		.attr('height', this.state.layout.inner.height);


	//////////////////////////////////////    Set up scales for plotting    //////////////////////////////////////

	// Set scales with the correct inner size, but don't use them to translate, since we will be applying a translate in the draw function itself
	var xRange = [0, this.state.layout.inner.width];
	var yRange = [this.state.layout.inner.height, 0];
	this.scales.x.range(xRange);
	this.scales.y.range(yRange);
	this.scales.zoom.area = [[xRange[0], yRange[1]], [xRange[1], yRange[0]]];
	this.scales.zoom.x.domain(xRange).range(xRange);
	this.scales.zoom.y.domain(yRange).range(yRange);

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
		.style("fill","transparent")
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

function zoomFilterSnap(area, zoomScales, side) {
	var xOrY = (side == "x" ? 0 : 1);
	var zoom = zoomScales[side];

	var inside = R.curry(function(xOrY, point) {
		return (point >= area[0][xOrY] && point <= area[1][xOrY]);
	});

	var overlaps = R.curry(function(xOrY, d) {
		return (!((d.start < area[0][xOrY] && d.end < area[0][xOrY]) || (d.start > area[1][xOrY] && d.end > area[1][xOrY])));
	});

	var zoomTransform = R.map(function(d) {d.start = zoom(d.start); d.end = zoom(d.end); return d});
	var zoomFilter = function(xOrY) {
		return R.filter(overlaps(xOrY));
	}
	var zoomSnap = function(xOrY) {
		return R.map(function(d) {
			if (!inside(xOrY)(d.start)) {
				d.start = area[xOrY][xOrY];
			}
			if (!inside(xOrY)(d.end)) {
				d.end = area[Number(!xOrY)][xOrY];
			}
			return d;
		});
	};
	return R.compose(zoomSnap(xOrY), zoomFilter(xOrY), zoomTransform);
}

DotPlot.prototype.drawGrid = function() {

	var c = this.context;

	// Translate everything relative to the inner plotting area
	c.setTransform(1, 0, 0, 1, 0, 0);
	
	/////////////////////////////////////////    Grid and axis labels    //////////////////////////////////////////

	var area = this.scales.zoom.area;

	

	var boundariesX = zoomFilterSnap(area, this.scales.zoom, "x")(this.scales.x.getBoundaries());
	var boundariesY = zoomFilterSnap(area, this.scales.zoom, "y")(this.scales.y.getBoundaries());



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

	xLabels.exit().remove();
	
	newXLabels.append("text")
		.style("text-anchor","end")
		.style("font-size", 10)
		.attr("transform", "rotate(-45)")

	var labelHeight = this.state.layout.outer.height + 20;
	xLabels = xLabels.merge(newXLabels)
		.attr("transform",function(d) {return "translate(" + (d.start+d.end)/2 + "," + labelHeight + ")"})
	
	xLabels.select("text").datum(function(d) {return d})
			.text(function(d) {return d.name});

	var inner = this.state.layout.inner;

	var yLabels = this.svg.select("g.innerPlot")
		.selectAll("text.yLabels").data(boundariesY);

	yLabels.exit().remove();

	var newYLabels = yLabels.enter().append("text")
		.attr("class","yLabels")
		.style("text-anchor","end")
		.style("font-size", 10);

	yLabels.merge(newYLabels)
		.attr("x", -10 + this.state.layout.annotations.y.left - this.state.layout.inner.left)
		.attr("y", function(d) {return inner.top + (d.start+d.end)/2})
		.text(function(d) {return d.name});

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
	c.clearRect(0, 0, this.state.layout.inner.width, this.state.layout.inner.height);
	
	var zoomX = this.scales.zoom.x;
	var zoomY = this.scales.zoom.y;

	function getLine(d) {
		return {
			start: {
				x: zoomX(scales.x.get(d[x], d[x + '_start'])),
				y: zoomY(scales.y.get(d[y], d[y + '_start']))
			},
			end: {
				x: zoomX(scales.x.get(d[x], d[x + '_end'])),
				y: zoomY(scales.y.get(d[y], d[y + '_end']))
			}
		};
	}
	var area = scales.zoom.area;

	function bothEndsLeft(line) {
		return (line.start.x < area[0][0] && line.end.x < area[0][0])
	}
	function bothEndsRight(line) {
		return (line.start.x > area[1][0] && line.end.x > area[1][0])
	}
	function bothEndsAbove(line) {
		return (line.start.y < area[0][1] && line.end.y < area[0][1])
	}
	function bothEndsBelow(line) {
		return (line.start.y > area[1][1] && line.end.y > area[1][1])
	}

	var tagColors = {repetitive: "#f00", unique: "#000"};

	var drawLine = function(d) {
		var line = getLine(d);
		if (!(bothEndsAbove(line) || bothEndsBelow(line) || bothEndsLeft(line) || bothEndsRight(line))) {
			c.moveTo(line.start.x, line.start.y);
			c.lineTo(line.end.x, line.end.y);
		}
	};


	for (var tag in tagColors) {
		c.beginPath();
		c.strokeStyle = tagColors[tag]

		R.map(function(refInfo) {
			var ref = refInfo[0];
			R.compose(
				R.map(drawLine),
				R.filter(R.propEq("tag",tag))
			)(state.data_by_chromosome[ref]);
		}, state.selected_refs);

		c.stroke();
	}
}

function validateConfig(config) {
	var requiredTypes = {
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

	this.parent = config.parent;

	this.state = {left: 0, top: 0, height: 30, width: 30};
	this.side = config.side;

	this.data = config.data;
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


	var xOrY = this.side;
	var scale = this.parent.scales[xOrY];

	var refOrQuery = this.parent.k[xOrY];
	
	function scaleAnnot(d) {
		return {
			start: scale.get(d[refOrQuery], d[refOrQuery + '_start']),
			end: scale.get(d[refOrQuery], d[refOrQuery + '_end']),
			name: d.name,
			seq: d[refOrQuery],
		};
	}

	var dataToPlot = R.map(scaleAnnot, this.data);

	var dataZoomed = zoomFilterSnap(this.parent.scales.zoom.area, this.parent.scales.zoom, xOrY)(dataToPlot);

	var annots = this.element.selectAll(".annot").data(dataZoomed);
	var newAnnots = annots.enter().append("rect")
		.attr("class","annot");

	annots.exit().remove();

	var rectHeight = this.height()/2;
	var rectY = (this.height() - rectHeight)/2;

	if (xOrY == "x") {
		annots = annots.merge(newAnnots)
			.attr("x", function(d) {return d.start})
			.attr("width", function(d) {return d.end-d.start})
			.attr("y", rectY)
			.attr("height", rectHeight);
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

	this.dotplot = new DotPlot(this.plot_element, {height: config.height, width: config.width});
}


DotApp.prototype.setData = function(data) {
	this.data = data;

	this.dotplot.setData(data);
}

DotApp.prototype.addAnnotationData = function(dataset) {
	this.dotplot.addAnnotationData(dataset);
}





