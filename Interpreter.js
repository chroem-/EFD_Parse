var parseDocument = require('excel')
var Map = require('collections/map')
var Set = require('collections/set')
var filesystem = require('fs')
var convertToXLS = require('json2xls')

var ExcelDate = require('timezonecomplete').DateTime

var data = new Map()
var districts = new Map()


//read in fire district codings
filesystem.readFile('districts.json', 'utf8', function(error, rawString) {
	if (!error) {
		districts = new Map(JSON.parse(rawString))
	} else {
		try {
			parseDocument('districts.xlsx', function(error, document) {
				for (var i = 1; i < document.length; i++) {	
					var row = document[i]
					console.log(row)
					districts.set(row[0], row[1])
					console.log(districts.get(row[0]))
				}
				filesystem.writeFile('districts.json', JSON.stringify(districts.toObject()))
			})

		} catch (e) {
			console.log(e)
		}
	}
})

var year = 2012 // first year to read in excel data

filesystem.readFile('data.json', 'utf8', function(error, rawString) {
	if (!error) {
		data = new Map(JSON.parse(rawString))
		runQueries()
	} else {
		loadFromExcel()
	}
})

function loadFromExcel() {
	try { parseDocument(year.toString() + ' data.xlsx', readDocument) } catch (e) {console.log(e)}
	
}

function readDocument(error, document) {
	for (var i = 1; i < document.length; i++) {	
		var row = document[i]
		var incidentID = row[0]
	/*//*/if (!data.has(incidentID)) {
			data.set( /*i*/ incidentID, {
				apparatus: row[19],
				responders: 1,
				date: parseDate(row[20]),
				cancelled: (row[27] == 'Yes'),
				resultedInTransport: !isNaN(parseFloat(row[24])),
				actionTaken: row[3],
				incidentCode: row[4],
				incidentType: row[6],
				finalIncidentCode: row[7],
				address: row[11] + ' ' + row[12] + ' ' + row[13] + ' ' + row[14] + ', ' + row[15]+ ', WA, ' + row[16],
				fireZone: parseZone(row[17]),
				locationType: row[18],
				firstResponse: (row[22] != 'NULL') ? parseDate(row[22]) : null
			})
		} else {
			incident = data.get(incidentID)
			incident.responders++
			if (row[22] != 'NULL') {
				//console.log(row[25])
				incident.resultedInTransport = (incident.resultedInTransport || !isNaN(parseFloat(row[24])))
				var responseDate = parseDate(row[22])				
				if (responseDate < incident.firstResponse) incident.firstResponse = responseDate
				var dispatchDate = parseDate(row[20])
				if (dispatchDate < incident.date) incident.date = dispatchDate
			}
		}
	}
	if (year < 2013) {
		year++
		console.log('About to parse ' + year)
		try { parseDocument(year.toString() + ' data.xlsx', readDocument) } catch (e) {console.log(e)}
	} else if (year == 2013) {
		try {
			console.log('data')
			filesystem.writeFileSync('data.json', JSON.stringify(data.toObject()))
			runQueries()
		} catch (e) {
			console.log(e)
		}
	}
}

function parseZone(zone) {
	return zone.toUpperCase()
}

var formatting = {caption: 'responseTime', type: 'number'}


function runQueries() {
	//console.log(data.get(data.keys().toArray()[0]))

	generateReplicates()
	

	
	//Number of incidents by district
	function incidentsByDistrict(input) {
		var incidentsByDistrict = groupByCriteria(input, districtCriteria)
		for (var i = 1; i <= 7; i++) {
			console.log('District ' + i + ' had ' + incidentsByDistrict.get(i.toString()).length +  ' incidents')
		}
	}

	console.log('Total Incidents:')
	incidentsByDistrict(data.values())
	console.log()

	console.log('MedX Incidents:')
	incidentsByDistrict(applyPredicates([isMedX]).toArray())
	console.log()

	console.log('Transport Incidents:')
	incidentsByDistrict(applyPredicates([resultedInTransport]).toArray())
	console.log()

	//var incidentsByStreet = groupByCriteria(data.values(), streetCriteria).values()
	function incidentsByStreet(input) {
		var byStreet = groupByCriteria(input, addressCriteria).values()
		//console.log(byStreet[0])
		byStreet.sort(function(left, right) {
			return right.length - left.length
		})
		for (var i = 0; i < 20; i++) {
			var street = byStreet[i]
			//console.log(street[0])
			console.log(street[0].address + ' had ' + street.length +  ' incidents')
		}
	}

	incidentsByStreet(data.values())

	console.log()
	console.log('MedX Incidents:')
	incidentsByStreet(applyPredicates([isMedX]).toArray())

	console.log()
	console.log('Transport Incidents:')
	incidentsByStreet(applyPredicates([resultedInTransport]).toArray())

	console.log()
	function percentagesOfTotal(input) {
		var byStreet = groupByCriteria(input, addressCriteria).values()
		//console.log(byStreet[0])
		byStreet.sort(function(left, right) {
			return right.length - left.length
		})
		var totalIncidents = data.values().length
		var total = 0
		for (var i = 0; i < 10; i++) {
			var street = byStreet[i]
			//console.log(street[0])
			var percentage = (street.length * 100 / totalIncidents)
			total += percentage
			console.log(street[0].address + ' had ' + percentage   +  '% of all incidents')
		}
		console.log('Worst incident generators as a percentage of all incidents: ' + total)
	}

	percentagesOfTotal(data.values())

	function incidentsPercentagesByDistrict(input) {
		var totalIncidents = data.values().length
		var incidentsByDistrict = groupByCriteria(input, districtCriteria)
		for (var i = 1; i <= 7; i++) {
			var percentage = (incidentsByDistrict.get(i.toString()).length * 100 / totalIncidents)
			console.log('District ' + i + ' had ' + percentage +  '% of all incidents')
		}
	}

	incidentsPercentagesByDistrict(data.values())

	console.log(groupByCriteria(data.values(), addressCriteria).length)

	//var insideAndOut = groupByCriteria(data.values(), outsideDistrictCriteria)
	//console.log(insideAndOut.get('inside').length)

	//var formatting = {[caption: 'apparatus', type: 'string'], [, caption: 'date', type:'']}
	//var inside = insideAndOut.get('inside').toArra
	//var insideArray = new Array()
	/*
	filesystem.writeFileSync('inside.xls', convertToXLS(insideAndOut.get('inside').toArray().toObject()), 'binary')
	filesystem.writeFileSync('outside.xls', convertToXLS(insideAndOut.get('outside').toArray().toObject()), 'binary')
	*/

	/*console.log(data.length)
	console.log('running queries!')
	var result = applyPredicates([isOutside]).length
	console.log('There were a total of ' + result + ' calls to outside locations.')
	console.log(applyPredicates([isOutside, resultedInTransport]).length)

	var group = groupByCriteria(data.values(), function(element) {
		return element.fireZone
	})

	var sorted = group.entries().sort(function(left, right) {
		//console.log(right[0])		
		return  right[1].length - left[1].length
	})
	console.log('Largest: ' + sorted[1][0])
	console.log('Smallest: ' + sorted[sorted.length - 1][0])

	var addresses = groupByCriteria(data.values(), addressCriteria)
	console.log("Number of : " + addresses.length)
	//console.log(addresses)
	var keys = addresses.keys();
	//console.log(keys)
	
	var results = new Array()
	for (var i = 0; i < keys.length; i++) {
		var string = keys[i].trim().replace('   ', ' ').replace('  ', ' ').replace(' ,', ',')
		results[i] = {address: string}
	}
	filesystem.writeFile('addresses.xls', convertToXLS(results, formatting), 'binary')*/
	
	
}




	function generateReplicates() {
		console.log('binning data')
		// bin the data
		var morningVsNight = groupByCriteria(data.values(), morningCriteria)
		var designMatrix = [morningVsNight.get('morning'), morningVsNight.get('night')]
		var timeData = designMatrix	
		for (var isMorning = 0; isMorning < 2; isMorning++) {
			
			//console.log('Is array: ' + timeData/*&.toArray()*/)
			var summerVsWinter = groupByCriteria(timeData[isMorning], seasonCriteria)
			designMatrix[isMorning] = [summerVsWinter.get('summer'), summerVsWinter.get('winter')]
			var seasonData = designMatrix[isMorning]
			console.log('timeOfDayBin')
			for (var isWinter = 0; isWinter < 2; isWinter++) {

				console.log(seasonData.length)
				console.log('binning for prank call')
				var noneVsFullResponse = groupByCriteria(seasonData[isWinter], fullResponseCriteria)
				console.log('bin created!')
				designMatrix[isMorning][isWinter] = [noneVsFullResponse.get('none'), noneVsFullResponse.get('full')]
				console.log(typeof(noneVsFullResponse.get('full')))
			}

		}
		
		console.log(designMatrix.length)
		console.log(designMatrix[0][1][0].length)
		console.log(designMatrix[0][1][1].length)
		console.log(designMatrix[0][0][0].length)
		console.log(designMatrix[0][0][1].length)
		console.log(designMatrix[1][0][0].length)
		console.log(designMatrix[1][0][1].length)
		console.log(designMatrix[1][1][0].length)
		console.log(designMatrix[1][1][1].length)

		// find the best replicates and build the test matrix
		var matrix = new Array()
		var index = 0
		for (var i = 0; i < 2; i++) {
			for (var j = 0; j < 2; j++) {
				for (var k = 0; k < 2; k++) {
					
					
					//compute averages
					var elements = designMatrix[i][j][k]
					var runningTotal = 0
					for (var iterator = 0; iterator < elements.length; iterator++) {
						var element = elements[iterator]
						var time = (element.firstResponse - element.date) / 60000
						if (time > 0 && time < 120)runningTotal += time
					}
		
					var avgTime = runningTotal / elements.length
		
					//add the best fits to the result matrix
					matrix[index] = {daytime: i, 
									winter: j,
									recentFullResponse: k, 
									responseTime: avgTime}
					index++
				}
			}
		}
		var formatting = [{caption: 'daytime', type: 'number'}, {caption: 'winter', type: 'number'}, {caption: 'recentFullResponse', type: 'number'}, {caption: 'responseTime', type: 'number'}]
		filesystem.writeFile('DOE.xls', convertToXLS(matrix, formatting), 'binary')
	}




function parseDate(string) {
	//var unixTime = (parseFloat(string) - 25569) * 86400 * 1000
	var date = new ExcelDate(parseFloat(string)).unixUtcMillis()
	//var unixTime = (parseFloat(string) * 24 * 60)/*86400) - 2208988800*/
	return unixTime
}


function applyPredicates(searchPredicates) {
	copy = data.values()

	var result = new Set()
	//for (searchPredicate in searchPredicates) {
	//copy.forEach( function(element) {
	for (var i = 0; i < copy.length; i++) {
		var element = copy[i]
		//console.log('lol')
		var allMatch = true
		for (var j = 0; j < searchPredicates.length; j++) {				
			var searchPredicate = searchPredicates[j]
			allMatch = (allMatch && searchPredicate(element))
		}
		if (allMatch) result.add(element)
	}
	return result
}

function isOutside(element) {
	return element.locationType.indexOf('9') === 0
}

function resultedInTransport(element) {
	return element.resultedInTransport
}

function matchesFireZone(zone, element) {
	return element.fireZone == zone
}

function isMedX(element) {
	return element.incidentCode == 'MEDIC UPGRADE RESPONSE'
}

function occurredBetween(startTime, endTime) {
		//(parseFloat(string) - 25569) * 86400 * 1000
	return function(element) {
		//console.log(element.firstResponse - element.date)
		return element.date > startTime && element.date < endTime
	}
}

function wasFullResponse(element) {
	//console.log(element.incidentCode)
	//if (element.incidentCode.indexOf('FULL') == 0) console.log('FULL RESPONSE!!!')
	return element.incidentCode.indexOf('FULL') == 0
	//return true
}


function groupByCriteria (dataElements, getCriteria) {
	var map = new Map()
	for (var i = 0; i < dataElements.length; i++) {
		element = dataElements[i]
		//console.log(element)
		var criteria = getCriteria(element)
		if (!map.has(criteria)) {
			map.set(criteria, [element])
		} else {
			var array = map.get(criteria)
			array.push(element)
		}
	}
	return map
}

function isDay() {
	return 
}

function morningCriteria(element) {
	
	if ((new Date(element.date * 1000)).getHours() < 12) {
		return 'morning'
	} else {
		return 'night'
	}
}

function seasonCriteria(element) {
	//return Math.round(new Date(element.date * 1000).getMonth / 12)
	//console.log(typeof(element))
	if (new Date(element.date * 1000).getMonth() < 3 || new Date(element.date * 1000).getMonth() > 9) {
		//console.log('winter')
		return 'winter'
	} else {
		//console.log('summer')
		return 'summer'
	}
}



function fullResponseCriteria(element) {
	//try {
		//console.log('Prank call criteria')
		var time = element.date
		var wasPrank = applyPredicates([wasFullResponse, occurredBetween((time - (1000 * 60 * 60 * 2)), time)]).length > 0
	/*} catch (e) {
		console.log(element)
	}*/
	//console.log(wasPrank)
	if (wasPrank) {
		//console.log('Full!')
		return 'full'
	} else {
		return 'none'
	}
}

function outsideDistrictCriteria(element) {
	if (element.apparatus.indexOf('BAE') == 0) {
		if (element.apparatus.charAt(3) == districts.get(element.fireZone)) {
			//console.log('in')			
			return 'inside'
		} else {
			return 'outside'
		}
	} else {
		return 'junk'
	}
}

function districtCriteria(element) {
	return districts.get(element.fireZone)
}

function addressCriteria(element) {
	return element.address
}

function fireZoneCriteria(element) {
	return new Date(element.date * 1000).getHours() < 12
}

function monthCriteria(element) {
	return new Date(element.date * 1000).getMonth()
}

function hourCriteria(element) {
	return new Date(element.date * 1000).getHours()
}





