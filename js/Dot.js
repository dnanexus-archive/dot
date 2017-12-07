////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////      Dot Plot       /////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////

var DotPlot = function(element, config) {
	
	this.element = element;

	this.config = config;
	this.data = undefined;

	this.state = {
		layout: {
			whole: {height: config.height, width: config.width},
			inner: {height: null, width: null, left: null, top: null},
		},
		allRefs: null,
		allQueries: null,
		selectedRefs: null,
		selectedQueries: null,
		dataByQuery: {},
		queryInfo: [],
		refInfo: [],
		queryIndex: {},
		annotationData: {},
		xAnnotations: [],
		yAnnotations: [],
	};

	this.scales = {x: null, y: null, zoom: {area: null, x: d3.scaleLinear(), y: d3.scaleLinear()}};

	this.k = { x: "ref", y: "query" };


	// Set up permanent DOM elements
	this.element
		.style("position","relative");

	this.canvas = this.element.append('canvas')
		.style("position", "absolute")
		.style("top", 0)
		.style("left", 0);
		
	this.context = this.canvas
			.node().getContext('2d');
	this.svg = this.element.append("svg")
		.style("position", "absolute")
		.style("top", 0)
		.style("left", 0);

	this.svg.append("rect").attr("class","innerBorder");
	this.svg.append("text").attr("class","xTitle");
	this.svg.append("g").attr("class","yTitle").append("text").attr("class","yTitle");

	this.svg.append("g").attr("class","innerPlot");
	this.svg.append("g").attr("class","brush");

	this.xAnnotations = this.svg.append("g");
	this.yAnnotations = this.svg.append("g");

	this.reset_styles();

}

DotPlot.prototype.setData = function(data) {
	this.data = data;

	// Set reference and query sequence sizes:
	this.state.allRefs = R.compose( R.uniq, R.map(R.props(["ref", "ref_length"])))(data);
	this.state.allQueries = R.compose( R.uniq, R.map(R.props(["query", "query_length"])))(data);

	this.initializePlot();
	
}

DotPlot.prototype.initializePlot = function(data) {
	this.state.selectedRefs = this.state.allRefs;
	this.state.selectedQueries = this.state.allQueries;

	// Store data indexed by query:

	this.state.dataByQuery = R.compose(R.map(R.groupBy(R.prop("tag"))), R.groupBy(R.prop("query")))(this.data);

	// scales
	this.setScalesFromSelectedSeqs();

	this.layoutPlot();
	this.initializeZoom()
	this.setScaleRanges();

	this.draw();
}

DotPlot.prototype.setCoords = function(coords, index) {
	this.coords = coords;

	this.parseIndex(index);

	this.state.allRefs = R.map(R.props(["ref","ref_length"]), this.state.refInfo);
	this.state.allQueries = R.map(R.props(["query","query_length"]), this.state.queryInfo)

	this.initializePlot();
}

DotPlot.prototype.parseIndex = function(index) {

	var lines = index.split("\n");
	
	var refCSV = "";
	var queryCSV = "";
	var overviewCSV = "";
	var reading = "";

	for (var i in lines) {
		if (lines[i][0] === "#") {
			if (lines[i] === "#ref") {
				reading = "ref";
			} else if (lines[i] === "#query") {
				reading = "query";
			} else if (lines[i] === "#overview") {
				reading = "overview";
			} else {
				console.log("Unrecognized # line in index file:", lines[i]);
			}
		} else {
			if (reading == "ref") {
				refCSV += lines[i] + "\n";
			} else if (reading == "query") {
				queryCSV += lines[i] + "\n";
			} else if (reading == "overview") {
				overviewCSV += lines[i] + "\n";
			} else {
				console.log("Unrecognized line in index file:");
				console.log(lines[i]);
			}
		}
	}

	var parseCSV = function(CSVString) {
		var parsed = Papa.parse(CSVString, {header: true, dynamicTyping: true, skipEmptyLines: true});
		if (parsed.errors.length > 0) {
			console.log(CSVString)
			console.log(parsed.errors);

			throw "Error parsing index file";
		}
		return parsed.data;
	}

	var splitBySquiggly = function(prop, arr) {
		return R.map(function(d) {d[prop] = d[prop].split("~"); return d}, arr);
	};

	this.state.refInfo = splitBySquiggly("matching_queries", parseCSV(refCSV));
	this.state.queryInfo = splitBySquiggly("matching_refs", parseCSV(queryCSV));

	this.state.queryIndex = R.zipObj(R.pluck("query", this.state.queryInfo), this.state.queryInfo);

	this.data = parseCSV(overviewCSV);
}

DotPlot.prototype.draw = function() {
	this.drawGrid();
	this.drawAlignments();
	this.drawAnnotationTracks();
}

DotPlot.prototype.setScaleRanges = function() {
	//////////////////////////////////////    Set up scales for plotting    //////////////////////////////////////

	// Set scales with the correct inner size, but don't use them to translate, since we will be applying a translate in the draw function itself
	var xRange = [0, this.state.layout.inner.width];
	var yRange = [this.state.layout.inner.height, 0];
	this.scales.x.range(xRange);
	this.scales.y.range(yRange);
	this.scales.zoom.area = [[xRange[0], yRange[1]], [xRange[1], yRange[0]]];
	this.scales.zoom.x.domain(xRange).range(xRange);
	this.scales.zoom.y.domain(yRange).range(yRange);

}

DotPlot.prototype.setScalesFromSelectedSeqs = function() {
	this.scales.x = new MultiSegmentScale({data: this.state.selectedRefs, key_name: 0, length_name: 1});
	this.scales.y = new MultiSegmentScale({data: this.state.selectedQueries, key_name: 0, length_name: 1});

	this.scales.x.range([0, this.state.layout.inner.width]);
	this.scales.y.range([this.state.layout.inner.height, 0]);
}

function parseCoords(coords, query, tag) {
	
	var parsed = Papa.parse("ref_start,ref_end,query_start,query_end,ref\n" + coords, {header: true, dynamicTyping: true, skipEmptyLines: true});
	if (parsed.errors.length > 0) {
		console.log("Error parsing a chunk of the coords file");
		console.log(parsed.errors);
		console.log(coords);
	}

	return R.map(function(d) {d.query = query; d.tag = tag; return d}, parsed.data);
}

var setAlignments = R.curry(function(_this, query, tag, data) {
	var lines = data.split("\n");
	
	var content = {unique: "", repetitive: ""};
	var reading = undefined;
	for (var i in lines) {
		if (lines[i][0] === "!") {
			if (lines[i] == "!" + query + "!unique") {
				reading = "unique";
			} else if (lines[i] == "!" + query + "!repetitive") {
				reading = "repetitive";
			} else {
				reading = undefined;
			}
		} else if (reading !== undefined) {
			content[reading] += lines[i] + "\n";
		}
	}

	

	if (tag === "both") {
		var before = 0;
		if (_this.state.dataByQuery[query]["unique"]) {
			before = _this.state.dataByQuery[query]["unique"].length;
		}
		_this.state.dataByQuery[query]["unique"] = parseCoords(content["unique"], query, "unique");
		console.log(query, ": Replaced overview of", before, "unique alignments with", _this.state.dataByQuery[query]["unique"].length);


		before = 0;
		if (_this.state.dataByQuery[query]["repetitive"]) {
			before = _this.state.dataByQuery[query]["repetitive"].length;
		}
		_this.state.dataByQuery[query]["repetitive"] = parseCoords(content["repetitive"], query, "repetitive");
		console.log(query, ": Replaced overview of", before, "repetitive alignments with", _this.state.dataByQuery[query]["repetitive"].length);

	} else {
		var before = 0;
		if (_this.state.dataByQuery[query][tag]) {
			before = _this.state.dataByQuery[query][tag].length; 
		}
		_this.state.dataByQuery[query][tag] = parseCoords(content[tag], query, tag);
		console.log(query, ": Replaced overview of", before, tag, "alignments with", _this.state.dataByQuery[query][tag].length);
	}

	_this.draw();

});

DotPlot.prototype.loadAlignmentsByQuery = function(query) {
	var toGet = {unique: true, repetitive: true};

	if (this.state.queryIndex[query]["loaded_unique"]) {
		toGet.unique = false;
	}

	if (this.state.queryIndex[query]["loaded_repetitive"] || this.styles["show repetitive alignments"] === false) {
		toGet.repetitive = false;
	}

	var uniq = this.state.queryIndex[query]["bytePosition_unique"];
	var rep = uniq + this.state.queryIndex[query]["bytePosition_repetitive"];
	var end = rep + this.state.queryIndex[query]["bytePosition_end"];

	if (this.state.dataByQuery[query] === undefined) {
		this.state.dataByQuery[query] = {};
	}

	if (toGet.unique && toGet.repetitive) {
		// console.log("get both");
		this.coords(uniq, end, setAlignments(this, query, "both"));
		this.state.queryIndex[query]["loaded_unique"] = true;
		this.state.queryIndex[query]["loaded_repetitive"] = true;
	} else if (toGet.unique) {
		// console.log("get unique only");
		this.coords(uniq, rep, setAlignments(this, query, "unique"));
		this.state.queryIndex[query]["loaded_unique"] = true;
	} else if (toGet.repetitive) {
		// console.log("get repetitive only");
		this.coords(rep, end, setAlignments(this, query, "repetitive"));
		this.state.queryIndex[query]["loaded_repetitive"] = true;
	}
}

DotPlot.prototype.loadDataFromSelection = function() {

	// var showRepeats = this.styles["show repetitive alignments"];

	var _this = this;

	R.map(function(d) {

		_this.loadAlignmentsByQuery(d[0]);

		// _this.loadAlignmentsByQueryAndTag(d[0], "unique");
		// if (showRepeats) {
		// 	_this.loadAlignmentsByQueryAndTag(d[0], "repetitive");
		// }
	}, this.state.selectedQueries);

}

DotPlot.prototype.seqSelectionDidChange = function() {
	this.setScalesFromSelectedSeqs();
	this.resetZoom();
}

DotPlot.prototype.resetRefQuerySelections = function(refNames) {
	this.state.selectedRefs = this.state.allRefs;
	this.state.selectedQueries = this.state.allQueries;

	this.seqSelectionDidChange();
	
}
DotPlot.prototype.selectRefs = function(refNames) {
	var state = this.state;

	state.selectedRefs = R.filter(function(d) {return R.contains(d[0], refNames)}, state.allRefs);

	var matchNames = R.filter(function(d) {return R.contains(d.ref, refNames)});
	var getQueries = R.compose(R.uniq, R.flatten, R.pluck("matching_queries"), matchNames);
	var queryNames = getQueries(state.refInfo);

	state.selectedQueries = R.filter(function(d) {return R.contains(d[0], queryNames)}, state.allQueries);

	this.loadDataFromSelection();
	this.seqSelectionDidChange();
}

DotPlot.prototype.selectQueries = function(queryNames) {
	var state = this.state;

	state.selectedQueries = R.filter(function(d) {return R.contains(d[0], queryNames)}, state.allQueries);

	var matchNames = R.filter(function(d) {return R.contains(d.query, queryNames)});
	var getRefs = R.compose(R.uniq, R.flatten, R.pluck("matching_refs"), matchNames);
	var refNames = getRefs(state.queryInfo);

	state.selectedRefs = R.filter(function(d) {return R.contains(d[0], refNames)}, state.allRefs);

	this.loadDataFromSelection();
	this.seqSelectionDidChange();
}

DotPlot.prototype.addAnnotationData = function(dataset) {
	if (this.state.annotationData[dataset.key] === undefined) {
		var plottableAnnotations = null;
		var side = null;

		if (R.any(R.equals(this.k.x), R.keys(dataset.data[0]))) {
			side = "x";			
		} else if (R.any(R.equals(this.k.y), R.keys(dataset.data[0]))) {
			side = "y";
		} else {
			throw("annotation file does not contain ref or query in the header");
		}

		var seqSide = this.k[side];
		var annotSeqs = R.uniq(R.pluck(seqSide, dataset.data));

		var alignmentSeqs = (seqSide === "ref" ? R.pluck(0, this.state.allRefs) : R.pluck(0, this.state.allQueries));
		var tmpScale = (seqSide === "ref" ? new MultiSegmentScale({data: this.state.allRefs, key_name: 0, length_name: 1}) : new MultiSegmentScale({data: this.state.allQueries, key_name: 0, length_name: 1}));

		var sharedSeqs = R.intersection(alignmentSeqs, annotSeqs);
		var annotSeqsNotInAlignments = R.difference(annotSeqs, alignmentSeqs);
		if (annotSeqsNotInAlignments.length > 0) {
			console.warn("Some annotations are on the following sequences that are not in the alignments input:", R.join(", ", annotSeqsNotInAlignments));
		}

		var annotMatches = function(d) {
			return tmpScale.contains(d[seqSide], d[seqSide+"_start"]) && tmpScale.contains(d[seqSide], d[seqSide+"_end"])
		};

		plottableAnnotations = R.filter(annotMatches, dataset.data);

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

	this.layoutPlot();
	this.initializeZoom()
	this.setScaleRanges();

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

DotPlot.prototype.resetZoom = function() {
	this.state.isZoomed = false;
	var s = this.scales.zoom.area;
	this.scales.zoom.x.domain([s[0][0], s[1][0]]);
	this.scales.zoom.y.domain([s[1][1], s[0][1]]);
	this.draw();
}

DotPlot.prototype.layoutPlot = function() {
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

	this.canvas
		.style("top", this.state.layout.inner.top + "px")
		.style("left", this.state.layout.inner.left + "px")
		.attr('width', this.state.layout.inner.width)
		.attr('height', this.state.layout.inner.height);



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

DotPlot.prototype.initializeZoom = function() {
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

	plot.state.isZoomed = true;

	function brushended() {
		var s = d3.event.selection;
		if (s !== null) {
			setZoom(s);
			plot.state.isZoomed = true;
		} else {
			// check for double-click
			if (!idleTimeout) {
				return idleTimeout = setTimeout(idled, idleDelay);
			}
			// zoom out
			if (plot.state.isZoomed) {
				plot.resetZoom();
				plot.state.isZoomed = false;
			} else {
				plot.resetRefQuerySelections();
			}
			
		}
	}
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
		.style("stroke", this.styles["color of reference grid lines"])
		.style("stroke-width", this.styles["width of reference grid lines"])
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
		.style("stroke", this.styles["color of query grid lines"])
		.style("stroke-width",this.styles["width of query grid lines"])
		.attr("x1", 0)
		.attr("y1", function(d) {return d.start})
		.attr("x2", this.state.layout.inner.width)
		.attr("y2", function(d) {return d.start});

	horizontalLines.exit().remove();


	//////////////////////    Labels by svg    //////////////////////
	var _this = this;

	function setRef(d, i) {
		_this.selectRefs([d.name]);
	}

	function setQuery(d, i) {
		_this.selectQueries([d.name]);
	}

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
			.text(function(d) {return d.name})
			.style("cursor", "pointer")
			.on("click", setRef);

	var inner = this.state.layout.inner;

	var yLabels = this.svg.select("g.innerPlot")
		.selectAll("text.yLabels").data(boundariesY);

	yLabels.exit().remove();

	var newYLabels = yLabels.enter().append("text")
		.attr("class","yLabels")
		.style("text-anchor","end")
		.style("font-size", 10);

	var yLabels = yLabels.merge(newYLabels)
		.attr("x", -10 + this.state.layout.annotations.y.left - this.state.layout.inner.left)
		.attr("y", function(d) {return inner.top + (d.start+d.end)/2})
		.text(function(d) {return d.name})
		.style("cursor", "pointer")
		.on("click", setQuery);

	var queryIndex = this.state.queryIndex;

	var showRepetitiveAlignments = this.styles["show repetitive alignments"];
	
	var loaded = function(query) {
		if (queryIndex[query] === undefined) {
			return false;
		}
		if (!queryIndex[query]["loaded_unique"]) {
			return false;
		}
		if (showRepetitiveAlignments && queryIndex[query]["loaded_repetitive"] === false) {
			return false;
		}
		return true;
	}
	if (this.styles["highlight loaded queries"]) {
		yLabels.style("fill", function(d) {if (loaded(d.name)) {return "green"} else {return "black"}})
	} else {
		yLabels.style("fill", function(d) {return "black"})
	}
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

	var tagColors = {repetitive: {forward: this.styles["color of repetitive alignments"], reverse: this.styles["color of repetitive alignments"]}, unique: {forward: this.styles["color of unique forward alignments"], reverse: this.styles["color of unique reverse alignments"]}};


	var count = 0;
	var drawLine = function(d) {
		var line = getLine(d);
		if (!(bothEndsAbove(line) || bothEndsBelow(line) || bothEndsLeft(line) || bothEndsRight(line))) {
			c.moveTo(line.start.x, line.start.y);
			c.lineTo(line.end.x, line.end.y);
		}
		count++;
	};

	var dotSize = this.styles["alignment line thickness"];

	var drawCircles = function(d) {
		var line = getLine(d);
		if (!(bothEndsAbove(line) || bothEndsBelow(line) || bothEndsLeft(line) || bothEndsRight(line))) {
			c.beginPath();
			c.fillStyle = getColor(d);
			c.arc(line.start.x, line.start.y, dotSize, 0, 2*Math.PI);
			c.arc(line.end.x, line.end.y, dotSize, 0, 2*Math.PI);
			c.fill();
		}
	}

	var forward = function(d) {
		return (d.query_start <= d.query_end);
	}

	var reverse = function(d) {
		return (d.query_start > d.query_end);
	}

	var getColor = function(d) {
		if (forward(d)) {
			return tagColors[d.tag].forward;
		} else {
			return tagColors[d.tag].reverse;
		}
	}

	var showRepetitiveAlignments = this.styles["show repetitive alignments"];
	var thickness = this.styles["alignment line thickness"];

	for (var tag in tagColors) {
		if (tag === "unique" || showRepetitiveAlignments) {
			R.map(function(queryInfo) {
				var query = queryInfo[0];
				if (state.dataByQuery[query] !== undefined && state.dataByQuery[query][tag] !== undefined) {
					c.beginPath();
					c.strokeStyle = tagColors[tag].forward;
					c.lineWidth = thickness;
					R.compose(R.map(drawLine), R.filter(forward))(state.dataByQuery[query][tag]);
					c.stroke();

					c.beginPath();
					c.strokeStyle = tagColors[tag].reverse;
					c.lineWidth = thickness;
					R.compose(R.map(drawLine), R.filter(reverse))(state.dataByQuery[query][tag]);
					c.stroke();
				}
			}, state.selectedQueries);
		}
	}

	if (this.styles["alignment symbol"] == "dotted ends") {
		for (var tag in tagColors) {
			if (tag === "unique" || showRepetitiveAlignments) {
				R.map(function(queryInfo) {
					var query = queryInfo[0];
					if (state.dataByQuery[query] !== undefined && state.dataByQuery[query][tag] !== undefined) {
						R.map(drawCircles, state.dataByQuery[query][tag]);
					}
				}, state.selectedQueries);
			}
		}
	}

	console.log("Number of alignments drawn:", count);
}

DotPlot.prototype.style_schema = function() {
	var styles = [
		{name: "Fundamentals", type: "section"},
		{name: "show repetitive alignments", type: "bool", default: true},
		{name: "highlight loaded queries", type: "bool", default: true},

		{name: "Alignments", type: "section"},
		{name: "alignment symbol", type: "selection", default:"dotted ends", options: ["line","dotted ends"]},
		{name: "alignment line thickness", type: "number", default: 2},
		{name: "color of unique forward alignments", type: "color", default: "#0000ff"},
		{name: "color of unique reverse alignments", type: "color", default: "#ff0000"},
		{name: "color of repetitive alignments", type: "color", default: "#ef8717"},
		
		{name: "Grid lines", type: "section"},
		{name: "width of reference grid lines", type:"range", default: 0.2, min: 0, max: 10, step: 0.2},
		// {name: "width of reference grid lines", type:"number", default: 0.6},
		{name: "color of reference grid lines", type:"color", default: "#aaaaaa"},
		{name: "width of query grid lines", type:"range", default: 0.2, min: 0, max: 10, step: 0.2},
		// {name: "width of query grid lines", type:"number", default: 0.6},
		{name: "color of query grid lines", type:"color", default: "#aaaaaa"},
		
		
		// {name:"a percentage", type:"percentage", default:0.0015, min:0, max:0.1, step:0.0005},
		// {name:"a range", type:"range", default:2},
		// {name:"a bool", type:"bool", default:true},
		// {name:"a selection", type:"selection", default:"B", options: ["A","B","C","D"]},
		
		
	];

	return styles;
}

DotPlot.prototype.reset_styles = function() {
	var style_schema = this.style_schema();
	this.styles = {};
	for (var i in style_schema) {
		this.styles[style_schema[i].name] = style_schema[i].default;
	}
}

DotPlot.prototype.set_style = function(style,value) {
	
	this.styles[style] = value;

	console.log(this.styles);

	this.draw();
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

	this.styles = {
		shape: "rectangle"
	}

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
		return this.state.width;
	} else {
		this.state.width = newWidth;
	}
}

Track.prototype.draw = function() {
	this.element.attr("transform", "translate(" + this.state.left + "," + this.state.top + ")");

	// Add background or border to track
	// this.element.select("rect.trackBackground")
	// 	.style("fill","lightblue")
	// 	.style("stroke","blue")
	// 	.attr("width", this.state.width)
	// 	.attr("height", this.state.height);


	var xOrY = this.side;
	var scale = this.parent.scales[xOrY];

	var refOrQuery = this.parent.k[xOrY];
	
	function scaleAnnot(d) {
		return {
			start: scale.get(d[refOrQuery], d[refOrQuery + '_start']),
			end: scale.get(d[refOrQuery], d[refOrQuery + '_end']),
			seq: d[refOrQuery],
			hover: d.name + " (" + d[refOrQuery] + ":" + d[refOrQuery + '_start'] + "-" + d[refOrQuery + '_end'] + ")",
		};
	}

	var dataToPlot = R.map(scaleAnnot, this.data);
	var dataZoomed = zoomFilterSnap(this.parent.scales.zoom.area, this.parent.scales.zoom, xOrY)(dataToPlot);

	var annots = this.element.selectAll(".annot").data(dataZoomed);
	var newAnnots = annots.enter().append("rect")
		.attr("class","annot");

	var colorScale = d3.scaleOrdinal(d3.schemeAccent);

	annots.exit().remove();

	if (xOrY == "x") {
		var rectHeight = this.height()/2;
		var rectY = (this.height() - rectHeight)/2;

		annots = annots.merge(newAnnots)
			.attr("x", function(d) {return d.start})
			.attr("width", function(d) {return d.end-d.start})
			.attr("y", rectY)
			.attr("height", rectHeight)
			.attr("fill",function(d) {return colorScale(d.seq)})
			.on("click", function(d) {console.log(d.hover)});

	} else if (xOrY == "y") {
		var rectWidth = this.width()/2;
		var rectX = (this.width() - rectWidth)/2;

		annots = annots.merge(newAnnots)
			.attr("x", rectX)
			.attr("width", rectWidth)
			.attr("y", function(d) {return d.end})
			.attr("height", function(d) {return d.start-d.end})
			.attr("fill",function(d) {return colorScale(d.seq)})
			.on("click", function(d) {console.log(d.hover)});

	} else {
		throw("side must be x or y in Track.draw");
	}
}


////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////      Dot App       //////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////


var DotApp = function(element, config) {

	this.element = element;

	var frac = 0.25;

	this.plot_element = this.element.append("div").attr("id", "dotplot")
		.style("height", config.height + "px")
		.style("width", config.width*(1-frac) + "px")
		.style("display", "inline-block");

	this.dotplot = new DotPlot(this.plot_element, {height: config.height, width: config.width*(1-frac)});

	this.style_panel = this.element.append("div")
		.attr("id","UI_container")
		.style("width", config.width*frac + "px")
		.style("display", "inline-block")
		.style("vertical-align", "top")
		.call(d3.superUI().object(this.dotplot));

	this.messageCallback = function(message, sentiment) {
		console.log(message);
	}

	if (typeof(config.messageCallback) === "function") {
		this.messageCallback = config.messageCallback;
	}
}

DotApp.prototype.setData = function(data) {
	this.data = data;

	this.dotplot.setData(data);
}

DotApp.prototype.setCoords = function(coords, index) {
	this.coords = coords;
	this.index = index;

	this.dotplot.setCoords(coords, index);
}

DotApp.prototype.addAnnotationData = function(dataset) {
	this.dotplot.addAnnotationData(dataset);
}





