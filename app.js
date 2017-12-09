
function main(loadedData) {
	

	// _dot.setData(loadedData.alignments);
	_dot.setCoords(loadedData.coords, loadedData.index);

	if (loadedData.annotations !== undefined) {
		console.log("Found", loadedData.annotations.length, "annotation tracks");
		for (var key in loadedData.annotations) {
			_dot.addAnnotationData({key: "source", data: loadedData.annotations[key]});
		}
	}
}
