# RESTful API server for Hyperledger Fabric 1.0

This server provides a RESTful interface for applications to transact on Hyperledger Fabric 1.0 network. It uses Node.js SDK API to call peers, orderer and CA servers of Fabric network's members.

## REST Server

The server can be instantiated for a Fabric network in which consists of three organizations and one Orderer and one CouchDB server.

The server should be run by each member organization, it manages user authentication, interacts with peers and pass events to the API clients.

## Setup

1. `git clone git@github.com:Simon-Li/fabric-node-rest.git`
2. `cd fabric-node-rest`
3. `./runApp.sh`
4. `./testAPIs.sh` (when the server is running)
