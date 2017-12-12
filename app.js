
function main(loadedData) {
	

	// _dot.setData(loadedData.alignments);
	_dot.setCoords(loadedData.coords, loadedData.index);

	if (loadedData.annotations !== undefined) {
		for (var key in loadedData.annotations) {
			_dot.addAnnotationData({key: key, data: loadedData.annotations[key]});
		}
	}
}
