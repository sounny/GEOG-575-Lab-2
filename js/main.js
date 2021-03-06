var attrArray = ['AllClasses', 'BodyAttack', 'BodyCombat', 'BodyPump', 'BodyStep', 'Sprint', 'BodyAttack_Count', 'BodyCombat_Count', 'BodyPump_Count', 'BodyStep_Count', 'Sprint_Count']; // List of attributes
var expressed = attrArray[1]; // Initial attribute

// Chart frame dimensions
var chartWidth = $('#chart').width(),
    chartHeight = chartWidth * 0.5,
    leftPadding = 28,
    rightPadding = 2,
    topBottomPadding = 10,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = 'translate(' + leftPadding + ',' + topBottomPadding + ')';



// Create a scale to size bars proportionally to frame
var yScale = d3.scaleLinear()
    .range([chartInnerHeight, 0])
    .domain([0, 35]);

// Begin script when window loads
window.onload = setMap();


// Set up choropleth map
function setMap() {
    // Map frame dimensions
    let width = $('#map').width(),
        height = width * 0.5;

    // Create new svg container for the map
    let map = d3.select('#map')
        .append('svg')
        .attr('class', 'map')
        .attr('width', width)
        .attr('height', height);

    // Create Albers equal area conic projection centered on United States
    let projection = d3.geoAlbers()
        .center([0, 38.6])
        .rotate([99, 0, 0])
        .parallels([43, 62])
        .scale(width + 30)
        .translate([width / 2, height / 2]);
        

    let path = d3.geoPath()
        .projection(projection);

    // Use queue to parrallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, 'data/ClassesByState.csv')
        .defer(d3.json, 'data/states.topojson')
        .await(callback);

    function callback(error, csvData, states) {
        // Set up graticule
        add_graticule(map, path);


        // Use topojson to translate topojson to geojson
        let dataStates = topojson.feature(states, states.objects.states).features;

        // Join topojson with csv data
        dataStates = join_data(dataStates, csvData)


        let colorScale = make_color_scale(csvData);

        let lyrStates = map.selectAll('.states')
            .data(dataStates)
            .enter()
            .append('path')
            .attr('class', function (d) {
                return 'states ' + d.properties.postal;
            })
            .attr('d', path)
            .style('fill', function (d) {
                return colorScale(d.properties[expressed])
            })
            .on('mouseover', function (d) {
                highlight(d.properties);
            })
            .on('mouseout', function (d) {
                dehighlight(d.properties);
            })
            .on('mousemove', function () {
                moveLabel();
            });

        var desc = lyrStates.append("desc")
            .text('{"stroke": "black", "stroke-width": "0.75px"}');

        // Add coordinated visualization to the map
        setChart(csvData, colorScale);

        // Setup event listeners for the class buttons
        set_class_buttons(csvData);

        // Set style for BodyAttack button
        $('#defButton').click();
    }


    function add_graticule(map, path) {
        // Create graticule generator
        let graticule = d3.geoGraticule()
            .step([10, 10]); // Place graticule lines every 5* of lat/lng

        // Create graticule lines
        let gatLines = map.selectAll('.gratLines') // Select graticule elements that will be created
            .data(graticule.lines()) // Bind graticule lines to each element to be created
            .enter() // Create an element for each datum
            .append('path') // Append each element to the svg as a path element
            .attr('class', 'gratLines')
            .attr('d', path) // Project graticule lines
    }


    function join_data(dataStates, csvData) {
        // Join dataStates and csvData by postal code

        // Loop through csv to assign each set of csv attribute values to geojson state
        for (let i = 0; i < csvData.length; i++) {
            let csvState = csvData[i]; // The curent state
            let csvKey = csvState.postal; // The CSV primary key

            // Loop through geoson states to find correct state
            for (let a = 0; a < dataStates.length; a++) {
                let geojsonProps = dataStates[a].properties; // The current state geojson properties
                let geojsonKey = geojsonProps.postal; // The geojson primary key

                // Assign all attributes and values
                if (geojsonKey == csvKey) {
                    attrArray.forEach(function (attr) {
                        let val = parseFloat(csvState[attr]); // Get csv attribute value
                        geojsonProps[attr] = val; // Assign attribute and value to geojson properties
                    });
                };
            };
        };

        return dataStates
    }


}

function make_color_scale(data) {
    // Color palette for each class
    let classPalette = {
        'BodyAttack': ['#664f0e', '#8c6c14', '#b48b1a', '#daa81f', '#fec424'],
        'BodyCombat': ['#353200', '#413e00', '#4e4a00', '#686300', '#817b00'],
        'BodyPump': ['#660000', '#8c0000', '#b30000', '#da0000', '#fe0000'],
        'BodyStep': ['#002e36', '#004450', '#005a69', '#006f83', '#00859c'],
        'Sprint': ['#4e4620', '#675d2b', '#8d803b', '#b4a24a', '#d2be57']
    }
    
    // Assign color based on selected class
    // As cool as it is to change colors, it made it difficult to read
    // differences in the map between attributes, so all classes will use
    // BodyAttack's gold color.
    let colorClasses = classPalette['BodyAttack'];

    // Create color scale generator
    let colorScale = d3.scaleQuantile()
        .range(colorClasses);

    // Build array of all values of the expressed attribute
    let domainArray = [];
    for (let i = 0; i < data.length; i++) {
        let val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    }

    // Assign array of epxressed values as scale domain
    colorScale.domain(domainArray);

    return colorScale
}

function setChart(csvData, colorScale) {
    // Create a second svg element to hold the bar chart
    var chart = d3.select('#chart')
        .append('svg')
        .attr('width', chartWidth)
        .attr('height', chartHeight)
        .attr('class', 'chart');
    
    // Create chart outline
    var outline = chart.append('rect')
        .attr('x', leftPadding)
        .attr('y', topBottomPadding)
        .attr('width', chartInnerWidth)
        .attr('height', chartInnerHeight)
        .attr('stroke', 'grey')
        .attr('stroke-width', '1px')
        .attr('fill', 'transparent');

    // Set bars for each state
    var bars = chart.selectAll('.bars')
        .data(csvData)
        .enter()
        .append('rect')
        .sort(function (a, b) {
            return b[expressed] - a[expressed]
        })
        .attr('class', function (d) {
            return 'bars ' + d.postal;
        })
        .attr('width', chartInnerWidth / csvData.length - 1)
        .attr('x', function (d, i) {
            return i * (chartInnerWidth / csvData.length);
        })
        .attr('height', function (d) {
            return chartInnerHeight - yScale(parseFloat(d[expressed]));
        })
        .attr('y', function (d) {
            return yScale(parseFloat(d[expressed]));
        })
        .style('fill', function (d) {
            return colorScale(d[expressed])
        })
        .attr('transform', translate)
        .on('mouseover', highlight)
        .on('mouseout', dehighlight)
        .on('mousemove', moveLabel);

    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');

    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale)

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);
}

function createDropdown(csvData) {
    let dropdown = d3.select('body')
        .append('select')
        .attr('class', 'dropdown')
        .on('change', function () {
            changeAttribute(this.value, csvData)
        });

    //add initial option
    let titleOption = dropdown.append('option')
        .attr('class', 'titleOption')
        .attr('disabled', 'true')
        .text('Select Attribute');

    // Add attribute name options
    let attrOptions = dropdown.selectAll('attrOptions')
        .data(attrArray)
        .enter()
        .append('option')
        .attr('value', function (d) {
            return d
        })
        .text(function (d) {
            return d
        });
}

// Called when new attribute is selected
function changeAttribute(attribute, csvData) {
    expressed = attribute;

    var colorScale = make_color_scale(csvData)

    var states = d3.selectAll('.states')
        .transition()
        .duration(500)
        .style('fill', function (d) {
            return colorScale(d.properties[expressed])
        });

    // Re-sort, resize, and recolor bars
    var bars = d3.selectAll('.bars')
        //re-sort bars
        .sort(function (a, b) {
            return b[expressed] - a[expressed];
        })
        .transition()
        .delay(function (d, i) {
            return i * 20
        })
        .attr('x', function (d, i) {
            return i * (chartInnerWidth / csvData.length);
        })
        .attr('height', function (d) {
            return chartInnerHeight - yScale(parseFloat(d[expressed]));
        })
        .attr('y', function (d) {
            return yScale(parseFloat(d[expressed]));
        })
        .attr("class", function (d) {
            return "bars " + d.postal;
        })
        .style('fill', function (d) {
            return colorScale(d[expressed])
        });
    // Update chart title        
    $('#lblClass').text(expressed);

}

// Function to highlight states and bars
function highlight(props) {
    // Change stroke
    var selected = d3.selectAll('.' + props.postal)
        .style('stroke', '#c8c8c8')
        .style('stroke-width', '2');

    setLabel(props);
}

//function to reset the element style on mouseout
function dehighlight(props) {
    var selected = d3.selectAll("." + props.postal)
        .style("stroke", "black")
        .style("stroke-width", "0.5px");

    d3.select(".infolabel")
        .remove();
};

//function to create dynamic label
function setLabel(props) {
    //label content
    
    var classState = "<p><b>" + props[expressed + "_Count"] + "</b><small> gyms offer " + expressed + " in <b>" + props.postal + "</b></small></p>";
    var count = "<p>(<b>" + props[expressed] + "</b><small> gyms per million people)</small></p>";
    var labelAttribute = classState + count;

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.postal + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.name);
};

//function to move info label with mouse
function moveLabel() {
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;
    
    var labelHeight = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .height;
    
    //use coordinates of mousemove event to set label coordinates    
    var x1 = d3.event.pageX + 10,
        y1 = d3.event.pageY - labelHeight - 10,
        x2 = d3.event.pageX - labelWidth - 5,
        y2 = d3.event.pageY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.pageX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //vertical label coordinate, testing for overflow
    var y = d3.event.pageY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
