function main(loadedData) {
	var layout = VTTGlobal.layout;

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////// This is where you can do all your visualization magic with the data you just loaded /////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


	console.log(loadedData);


	var _app_area = d3.select('#plotting-area');

	var _scales = {x: null, y: null};


	/* Set up the Dot app */
	var _dot = new DotApp(_app_area, {height: layout.svg.height, width: layout.svg.width});
	_dot.setData(loadedData.alignments);
	if (loadedData.annotations !== undefined) {
		_dot.addAnnotationData({key: "source", data: loadedData.annotations});
	}

}