//A utility function for parsing URL parameters
function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
//Define some global variables
var svg = d3.select("#chart");
var width  = svg.style('width').replace('px','');
var height = svg.style('height').replace('px','');

//Set up the colour scale
var color = d3.scale.category10();

//The scales for implementing zoom, every coordinate used for
//drawing will have to go through these.
var xzoom = d3.scale.linear()
    .domain([0,width])
    .range([0,width]);

var yzoom = d3.scale.linear()
    .domain([0,height])
    .range([0,height]);

//Assign the zoom behaviour to our SVG object.
//The zoom behavior makes changes to our xzoom and yzoom scales based on
//user input and calls the updateCoordinates function to update the coordinates
//of our graph based on these updated scales.
svg.call(d3.behavior.zoom()
        .x(xzoom)
        .y(yzoom)
        .scaleExtent([0.1,8])
        .on("zoom", updateCoordinates))
        //Do not "zoom" on double-click
        .on('dblclick.zoom', null);

//On window resize, we want the graph to also resize, so we have to update
//the zoom scales, the force layout size and update all the coordinates of our elements.
window.onresize = function(){
    width = window.innerWidth;
    height = window.innerHeight;
    force.size([width,height]);
    xzoom.range([0,width]);
    yzoom.range([0,height]);
    updateCoordinates();
};

//Set up the force layout
var force = d3.layout.force()
    .charge(-2000)
    .linkDistance(65)
    .size([width, height])
    .on("tick", updateCoordinates);

force.linkStrength(function(link) {
        if (link.linktype === 'regular')  return 0.9;
        return 1;
});

//Make the nodes draggable
var drag = force.drag()
    //Once a node's been dragged it will stay fixed
    .on('dragstart', function(d){
        d.fixed = true;

        //Do not propagate the drag event to svg element, which would
        //activate the zoom behavior's drag event and pan the entire view
        d3.event.sourceEvent.stopPropagation();
        mode='drag';
    })
    .on('dragend', function(d){
        mode='idle';
    })
    .on('drag', function(d){

    });


//Variables to hold the different components of our graph
//we declare them here so they can be accessed from different functions
var link, circle, text, node, mode, linktext;

//This will contain the currently selected node, used to display
//connectivity
var selectedNode = null;
//This will contain the node that has been hovered on
var activeNode=null;

svg.on("click", function(){
    mode='idle';
    unselectNodes();
});
//This function will update the coordinates of our nodes and links
//based on the data. This basically carries out the layout animation
//as it is used for the tick function of the force layout
function updateCoordinates() {
    //We draw the links as curved paths, with the radius of the curve
    //being dependant on the distance between the nodes
    link.attr('d', function(d){
        var src_x = xzoom(d.source.x);
        var src_y = yzoom(d.source.y);
        var dst_x = xzoom(d.target.x);
        var dst_y = yzoom(d.target.y);

        var dx = dst_x - src_x;
        var dy = dst_y - src_y;

        //The radius is also dependant of the "rank" of the link
        dr = 5*Math.sqrt(dx*dx + dy*dy)*d.rank;

        //And we alternate the "direction" of the curve for even and odd ranks
        //The direction can be altered by swapping the endpoints of the curve.
        if(d.rank%2 === 0){
            var swap=src_x;
            src_x=dst_x;
            dst_x=swap;

            swap=src_y;
            src_y=dst_y;
            dst_y=swap;
        }
        return "M" + 
            src_x + "," + 
            src_y + "A" +
            dr + "," + dr + " 0 0,1 " +
            dst_x + "," +
            dst_y;
    });

    //Causes some weird yanking when dragging a node
    // node.attr('transform', function(d) {
    //     return 'translate(' + d.x + ',' + d.y +')'
    // })

    //Changing the coordinates of the circle and text
    //separately makes dragging smooth.
    circle.attr("cx", function (d) {
        return xzoom(d.x);
    })
    .attr("cy", function (d) {
        return yzoom(d.y);
    });

    text.attr("x", function (d) {
        return xzoom(d.x);
    })
    .attr("y", function (d) {
        return yzoom(d.y);
    });

    linktext.attr("x", function (d) {
        return xzoom(d.dx);
    })
    .attr("y", function (d) {
        return yzoom(d.dy);
    });

}

var topofile = getParameterByName('topofile') || 'default topofile';

//We load the topology data from file as JSON
d3.json(topofile, function(error, topoData){
    // console.log(topofile);
    if(error){
        alert('Unable to load ' + topofile);
	console.log(error);
        return;
    }
    //Each node has a unique GUID, we use it to index the nodes for
    //accessing them later on
    nodeindex={};
    for(var i=0; i < topoData.nodes.length; i++){
        node = topoData.nodes[i];
        nodeindex[node.guid] = node;
        node.connections={};
        node.connected_nodes=0;
    }
    //For each link we create references to nodes at both sides,
    //this is needed by the force layout.
    //Also add to each node the GUID's of nodes they are connected to.
    //This is used later for visualizing directly connected nodes
    for(i = 0; i < topoData.links.length; i++){
        link = topoData.links[i];
        link.source = nodeindex[link.host1_guid];
        link.target = nodeindex[link.host2_guid];

        //We also add how many connections we have from each node to each node
        if(link.source.connections[link.target.guid])
            link.source.connections[link.target.guid]++;
        else{
            link.source.connections[link.target.guid]=1;
            link.source.connected_nodes++;
        }

        if(link.target.connections[link.source.guid])
            link.target.connections[link.source.guid]++;
        else{
            link.target.connections[link.source.guid]=1;
            link.target.connected_nodes++;
        }

        //The rank on the link will symbolize what "nth" connection
        //between the same nodes this link is, this is used to visualize
        //many connections between the same two nodes in a visually pleasing way
        link.rank = link.source.connections[link.target.guid]-1;
    }
    updateGraph({nodes:topoData.nodes,links:topoData.links});
});

function updateNodeinfo(node) {
    var info = d3.select('#infoview');
    info.select('#name').html(node.name);
    info.select('#guid').html('0x'+node.guid);
    info.select('#type').html(node.type);
    info.select('#portcount').html(node.available_ports+' ('+node.connected_ports+')');
    info.select('#connections').html(node.connected_nodes);
}


var contains = function(needle) {
    // Per spec, the way to identify NaN is that it is not equal to itself
    var findNaN = needle !== needle;
    var indexOf;

    if(!findNaN && typeof Array.prototype.indexOf === 'function') {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function(needle) {
            var i = -1, index = -1;

            for(i = 0; i < this.length; i++) {
                var item = this[i];

                if((findNaN && item !== item) || item === needle) {
                    index = i;
                    break;
                }
            }

            return index;
        };
    }

    return indexOf.call(this, needle) > -1;
};

//This function highlights all the nodes and links
//directly connected to the node with the guid given as argument
//and fades everything else
function selectNodes(curnode){
    updateNodeinfo(curnode);
    d3.select('#infoview').classed('hidden', false);
    node.classed({
        'faded': function(d) {
            return !(d.guid==curnode.guid || d.connections[curnode.guid]);
        },
        'highlight': function(d) {
            return d.guid==curnode.guid || d.connections[curnode.guid];
        }
    });
    link.classed({
        'faded': function(d){
	    // check whether link is part of a route to lid
	    return !contains.call(d.DLIDS, curnode.lid);
 //           return !(d.source.guid == curnode.guid || 
 //                   d.target.guid == curnode.guid);
        },
        'linkhl': function(d){
	    return contains.call(d.DLIDS, curnode.lid);

            //return d.source.guid == curnode.guid || 
            //        d.target.guid == curnode.guid;
        }
    });
}

//This function displays all the nodes and links as unselected
function unselectNodes(){
    node.classed('selected', false);
    node.classed('faded',false);
    node.classed('highlight',false);
    link.classed('faded',false);
    link.classed('linkhl',false);
    d3.select('#infoview').classed('hidden',true);
}
//This function takes care of drawing the graph once the data has been
//loaded and formatted correctly
function updateGraph(graph){
    //We add our nodes and links and start the force layout generation.
    force.nodes(graph.nodes)
        .links(graph.links)
        .start();

    //Create all the line svgs but without locations yet
    link = svg.append("g").selectAll(".link")
        .data(graph.links)
	.enter().append("path")
	.attr("id",function(d,i) { return "linkId_" + i; })
        .attr("class", "link");

    linktext = svg.append("g").selectAll("g.linklabelholder").data(graph.links);

    linktext.enter().append("g").attr("class", "linklabelholder")
     .append("text")
     .attr("class", "linklabel")
	 .style("font-size", "10px")
     .attr("x", "170")
	 .attr("y", "50")
     .attr("text-anchor", "start")
	   .style("fill","#000")
	 .append("textPath")
	.attr('startOffset', '8%')
    .attr("xlink:href",function(d,i) { return "#linkId_" + i;})
     .text(function(d) { 
	 return d.DLIDS; 
	 });

/*
    linktext = svg.selectAll(".link")
    .data(graph.links)
    .enter().append("text")
    .attr("class","linktext")
    .attr("dx",20)
    .attr("dy",0)
    .style("fill","red")
    .append("textPath")
    .attr("xlink:href",function(d,i) { return "#linkId_" + i;})
    .text(function(d,i) { return "text for link " + i;});
*/
//    .text(function(d,i) { return "gra" + i; });

//    linktext = link.append('text')
//             .text(function(d) {console.log(d.DLIDS); return "8";})
//             .attr('class', 'nodename')
//             .attr('dx', 8).attr('dy', ".20em");

    //A node is a g element containing a circle and some text
    node = svg.selectAll(".node")
        .data(graph.nodes)
      .enter().append("g")
        .on('mouseover', function(){
            if(mode=='drag'||mode=='selected')
                return;
            selectNodes(this.__data__);
        })
        .on('click', function(){
            d3.event.stopPropagation();
            // d3.select(this).classed('selected',true);
            // mode='selected';
        })
        .on('dblclick', function(d){
            d.fixed=false;
        })
        .on('mouseout', function(){
            unselectNodes();
        })
        .call(force.drag);
    
    circle = node.append('circle')
        .attr("class", "node")
        .attr("r", 8)
        .style("fill", function (d) {
            return color(d.type);
        });
    text = node.append('text')
        .text(function(d) { return d.name; })
        .attr('class', 'nodename')
        .attr('dx', 8)
        .attr('dy', ".35em");
}
