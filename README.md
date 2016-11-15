infiniband_topology
===================

A small web application to visualize an Infiniband fabric

It consists of two parts: a parser written in Python and a visualization application written in Javascript.

The parser:
- takes the output of the "ibnetdiscover" utility as it's input
- parses all the nodes and connections
- outputs this info into a .json file

The visualizer:
- loads the .json file (via the topofile URL parameter )
- displays the fabric topology using d3.js force layout
- allow you to interact with the visualization

Note: 
Chrome may be started with the following parameter to allow local file access:

    google-chrome --allow-file-access-from-files

![Example topology](https://github.com/kalcher/infiniband_topology/blob/master/topo-examples/topo.PNG)
