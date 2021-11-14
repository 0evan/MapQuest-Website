function sendJsonObject(json) {
	var jsonString = JSON.stringify(json);
	a=$.ajax({
		url: 'http://spenslep.aws.csi.miamioh.edu/final.php',
		method: "POST",
		dataType: 'json',
		data: {
			'method'   : 'setLookup',
			'location' : json.from + ',' + json.to,
			'sensor'   : 1,
			'value'    : jsonString
		}
	}).fail(function(error) {
		console.log("error",error.statusText);
	});
}

function getSearchResults(date, max) {
	a=$.ajax({
		url: 'http://spenslep.aws.csi.miamioh.edu/final.php',
		method: "GET",
		dataType: 'json',
		data: {
			'method'   : 'getLookup',
			'date'     :  date,
		}
	}).done(function(response) {
		addResultsToTable(response.result, max);
	});
}

var searchResults;
function addResultsToTable(results, max) {
	searchResults = [];
	results.slice().reverse().forEach( (result, index) => {
		if (index < max) {
			var dateTime = result.date.split(" ");
			var json = JSON.parse(result.value);
			searchResults.push(json);
			var button = $('<button/>', {
				html : 'Get Directions',
				'class' : 'btn btn-primary btn-sm',
				'id'   : index,
				on    : {
					click: function() {
						// change input
						$("#from").val(searchResults[this.id].from);
						$("#to").val(searchResults[this.id].to);

						// change tabs
						$('[href="#nav-directions"]').tab('show');
						setDirections(searchResults[this.id].maneuvers);
					}
				}
			});
			var tableButton = $('<th/>', {'scope': 'row'}).append(button);
			$('#results-table').append(
				$('<tr/>').append( 
					tableButton,
					'<td>' + dateTime[0] + '</td>',
					'<td>' + dateTime[1] + '</td>', 
					'<td>' + json.from + '</td>',
					'<td>' + json.to + '</td>',
					'<td>' + Object.keys(json.maneuvers).length + '</td>',
				)
			);
		}
	});
}

function callMapQuestApi(from, to, url) {
	var apiInformation = {dateTime: new Date().toLocaleString(), from: from, to: to, url: '', maneuvers: ''};
	apiInformation.url = url;
	a=$.ajax({
		url: url,
		method: "GET",
		dataType: 'json'
	}).done(function(data) {
		//check status code
		var statuscode = data.info.statuscode;
		if (statuscode == 0) {
			var maneuvers = data.route.legs[0].maneuvers;
			setDirections(maneuvers);
			apiInformation.maneuvers = maneuvers;
			//setElevation(data.route.locations);

			// send api information to ec2 server 
			sendJsonObject(apiInformation);
		} else {
			$("#results").addClass("hidden");
			if (statuscode == 402 || statuscode == 612) {
				$("#directions-error").html("Invalid location");
			} else {
				$("#directions-error").html("An error occured");
			}
		}
	}).fail(function(error) {
		$("#directions-error").html("Server error");
		console.log("error",error.statusText);
	});
}

function setElevation(locations) {
	//clear last chart
	$("#elevation").empty();

	//construct url and append
	var url = "https://open.mapquestapi.com/elevation/v1/chart?key=bxgf6spwB3PR6gA2ykxOC3tLmqifEc3j&shapeFormat=raw&width=425&height=350&latLngCollection=" + locations;
	$("#elevation").append("<img alt='elevationChart' class='img-fluid' src='"+url+"'>");
}

function getMapQuestDirections(from, to) {
	var url = "https://www.mapquestapi.com/directions/v2/route?key=bxgf6spwB3PR6gA2ykxOC3tLmqifEc3j&from="+from+"&to="+to;
	callMapQuestApi(from, to, url, setDirections);
}

function parseTime(time) {
	timeSplit = time.split(":")
	if (parseInt(timeSplit[0]) > 0) {
		return parseInt(timeSplit[0], 10) + " hours";
	} else if (parseInt(timeSplit[1]) > 0) {
		return parseInt(timeSplit[1], 10) + " minutes";
	} else if (parseInt(timeSplit[2]) > 0) {
		return parseInt(timeSplit[2], 10)+ " seconds";
	}
}

function setDirections(maneuvers) {
	//first clear the directions
	$("#maneuvers").empty();	

	//make results visible
	$("#results").removeClass("hidden");

	//append each maneuver
	var latLngCollection = '';
	maneuvers.forEach( maneuver => {

		//get latitude and longitude
		var lat = maneuver.startPoint.lat;	
		var lng = maneuver.startPoint.lng;	
		latLngCollection += lat + ', ' + lng + ', ';

		if (maneuver.distance != 0) {			
			var item = $('<li/>',{
				'class':'list-group-item d-flex justify-content-between align-items-center directions-list-item',
				html   :	'<img src="' + maneuver.mapUrl + '" class="img-fluid" alt="map image">' +
				maneuver.narrative + 
				'<div>' + 
				'<small class="text-muted">' + maneuver.distance + ' miles</small><br>' +
				'<small class="text-muted">' + parseTime(maneuver.formattedTime) + '</small>'
				+ '</div>'
			});
			$("#maneuvers").append(item);
		} else {
			var item = $('<li/>',{
				'class':'list-group-item d-flex justify-content-between align-items-center',
				html   : maneuver.narrative 
			});
			$("#maneuvers").append(item);
		}
	});
	setElevation(latLngCollection);
}

$(document).ready(function() {
	$("#getDirectionsButton").click( function() {
		//clear invalid inputs 
		$("#from").removeClass("is-invalid");
		$("#to").removeClass("is-invalid");
		$("#directions-error").html("");

		var from = $("#from").val();
		var to = $("#to").val();

		if (from === '' || to == '') {
			if (from === '') {
				$("#from").addClass("is-invalid");
			} 
			if (to === '') {
				$("#to").addClass("is-invalid");
			}
		} else {
			getMapQuestDirections(from, to);	
		}
	});

	$("#searchButton").click( function() {
		//clear invalid inputs
		$("#date").removeClass("is-invalid");
		$("#max-lines").removeClass("is-invalid");
		$("#results-table").empty();

		var date = $("#date").val();
		var maxLines = $("#max-lines").val();

		if (date === '' || maxLines == '') {
			if (date === '') {
				$("#date").addClass("is-invalid");
			} 
			if (maxLines === '') {
				$("#max-lines").addClass("is-invalid");
			}
		} else {
			getSearchResults(date, maxLines);		
		}
	});
});
