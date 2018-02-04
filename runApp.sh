#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

function dkkill() {
	CONTAINER_IDS=$(docker ps | grep "dev\|peer[0-9]" | awk '{print $1}')
	echo
        if [ -z "$CONTAINER_IDS" -o "$CONTAINER_IDS" = " " ]; then
                echo "========== No containers available to kill =========="
        else
                docker kill $CONTAINER_IDS
        fi
	echo
}

function dkcl(){
        CONTAINER_IDS=$(docker ps | grep "dev\|peer[0-9]" | awk '{print $1}')
	echo
        if [ -z "$CONTAINER_IDS" -o "$CONTAINER_IDS" = " " ]; then
                echo "========== No containers available for deletion =========="
        else
                docker rm -f $CONTAINER_IDS
        fi
	echo
}

function dkrm(){
        DOCKER_IMAGE_IDS=$(docker images | grep "dev\|peer[0-9]" | awk '{print $3}')
	echo
        if [ -z "$DOCKER_IMAGE_IDS" -o "$DOCKER_IMAGE_IDS" = " " ]; then
		echo "========== No images available for deletion ==========="
        else
                docker rmi -f $DOCKER_IMAGE_IDS
        fi
	echo
}

function restartNetwork() {
	echo

        #teardown the network and clean the containers and intermediate images
	cd fixtures
	docker-compose -f docker-compose.yaml down
	dkkill
	dkcl
	dkrm
	sleep 2

	#Cleanup the material
	rm -rf /tmp/hfc-test-kvs_peerOrg* $HOME/.hfc-key-store/ /tmp/fabric-client-kvs_peerOrg*

	#Start the network
	docker-compose -f docker-compose.yaml up -d
	cd -
	echo
}

function installNodeModules() {
	echo
	if [ -d node_modules ]; then
		echo "============== node modules installed already ============="
	else
		echo "============== Installing node modules ============="
		npm install
	fi
	echo
}


restartNetwork

installNodeModules

PORT=4000 node app
