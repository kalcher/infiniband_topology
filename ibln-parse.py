#!/usr/bin/env python2

import re
import sys
import jsonpickle
import sys, hashlib

class IBNode:
	def __init__(self):
		pass

class IBLink:
	def __init__(self):
		#The LID of the port on the first host
		self.host1_portlid = None
		#The port nr on the first host
		self.host1_port = None
		
		self.host2_portlid = None
		self.host2_port = None

		self.linktype = None


def parseTopologyfile(topofile):
	nodes = {}
	links = {}
	curswitch=None
	gcount=0

	for line in topofile:
		if line.startswith('\n') or line.startswith('#'):
			curswitch=None
			continue

		if line.startswith('SX6036'):
			curswitch = IBNode()
			m=re.search('SX6036\s*([^"]+)', line)
			print m.groups()
			curswitch.name = m.group(1).strip()
			curswitch.guid = hashlib.md5(m.group(1).strip()+str(gcount)).hexdigest()[:8]
			curswitch.type = 'switch'
                        curswitch.connected_ports = 0
			#gcount+=1

			nodes[curswitch.guid] = curswitch
			continue

		if line.startswith('\t') and curswitch:
			curswitch.connected_ports+=1
			m=re.search('P([0-9]+)\s*->\s*([^"]+)\s+([^"]+)\s+P([0-9]+)', line)
			nodename=m.group(3)
			nodeguid=hashlib.md5(m.group(3)+str(gcount)).hexdigest()[:8]
			nodeport=m.group(4)
			switchport=m.group(1)
			#gcount+=1

			print m.groups()
			#For a switch the LID is global, for a Ca it is per port

			if nodename.lower().startswith('s'):
				nodetype = 'switch'
			elif nodename.lower().startswith('h'):
				nodetype = 'HCA'
			else:
				print 'Unknown prefix for host : %s' % nodename
				print 'Should be "H-" or "S-"'
				sys.exit(1)

			try:
				node = nodes[nodeguid]
				if node.type != 'switch':
					node.connected_ports+=1
			except KeyError:
				node = IBNode()
				node.name = nodename
				node.type = nodetype
				node.guid = nodeguid
				node.connected_ports = 1
				nodes[nodeguid] = node


			host1=node
			host2=curswitch

			#We add the current ports and LIDs (these are acutally valid only for
			#links not nodes)
			curswitch.port = switchport
			node.port = nodeport
			#node.lid = portlid

			linkhash = "%s%s%s%s" % (host1.name,host2.name,host1.port,host2.port)
			print linkhash
			try:
				link = links[linkhash]
			except KeyError:
				linkhash2 = "%s%s%s%s" % (host2.name,host1.name,host2.port,host1.port)
				
				# remove backward link
				try:
					link = links[linkhash2]
				except KeyError:

					link = IBLink()
	#				link.host1_portlid = host1.lid
	#				link.host2_portlid = host2.lid
					link.host1_port = host1.port
					link.host2_port = host2.port
					link.host1_guid = host1.guid
					link.host2_guid = host2.guid
					if host1.type == "switch" and host2.type == "switch":
						link.linktype = "swsw"
					else:
						link.linktype = "regular"

					links[linkhash] = link
				continue

			continue

		if line.startswith('Ca'):
			m=re.search('Ca\s+([0-9]+)\s+"([^"]+)"', line)
			portcount=m.group(1)
			nodeguid=m.group(2).lstrip('H-')
			node=nodes[nodeguid]
			node.available_ports=portcount

			# print switchport,nodeguid,nodeport,nodename,portlid,linktype
	return nodes, links

#This function is UT cluster specific and removes some clutter from
#the names of our nodes
def beautifyNames(nodes):
	for node in nodes:
		node.name = node.name.rstrip('mlx4_0')
		if node.type=='switch':
			node.name = node.name.replace('MF0;','')

if __name__=='__main__':
	if len(sys.argv) != 2:
		print "Please point to the output of ibnetdiscover:"
		print "  %s [ibnetdiscover_output]" % sys.argv[0]
		sys.exit(1)

	topofile = open(sys.argv[1], 'r')
	nodes, links = parseTopologyfile(topofile)
	topofile.close()
	print "Nodes parsed %d, connections parsed: %d" % (len(nodes),len(links))

	#beautifyNames(nodes.values())

	outfile = open('%s.json' % sys.argv[1], 'w')
	outfile.write(jsonpickle.encode(
		{'nodes': nodes.values(), 'links':links.values()}, unpicklable=False))
	outfile.close()


