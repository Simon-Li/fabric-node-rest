#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

jq --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
	echo "Please Install 'jq' https://stedolan.github.io/jq/ to execute this script"
	echo
	exit 1
fi
starttime=$(date +%s)

echo "POST request Enroll on Org1  ..."
echo
ORG1_TOKEN=$(curl -s -X POST \
  http://localhost:4000/users \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Tim&orgName=org1')
echo $ORG1_TOKEN
ORG1_TOKEN=$(echo $ORG1_TOKEN | jq ".token" | sed "s/\"//g")
echo
echo "ORG1 token is $ORG1_TOKEN"
echo
echo "POST request Enroll on Org2 ..."
echo
ORG2_TOKEN=$(curl -s -X POST \
  http://localhost:4000/users \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Barry&orgName=org2')
echo $ORG2_TOKEN
ORG2_TOKEN=$(echo $ORG2_TOKEN | jq ".token" | sed "s/\"//g")
echo
echo "ORG2 token is $ORG2_TOKEN"
echo
echo "POST request Enroll on Org3 ..."
echo
ORG3_TOKEN=$(curl -s -X POST \
  http://localhost:4000/users \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Jack&orgName=org3')
echo $ORG3_TOKEN
ORG3_TOKEN=$(echo $ORG3_TOKEN | jq ".token" | sed "s/\"//g")
echo
echo "ORG3 token is $ORG3_TOKEN"
echo
echo "POST request Create channel  ..."
echo
curl -s -X POST \
  http://localhost:4000/channels \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"channelName":"test-network",
	"channelConfigPath":"../fixtures/channel/channel.tx"
}'
echo
echo
sleep 5
echo "POST request Join channel on Org1"
echo
curl -s -X POST \
  http://localhost:4000/channels/test-network/peers \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer1"]
}'
echo
echo

echo "POST request Join channel on Org2"
echo
curl -s -X POST \
  http://localhost:4000/channels/test-network/peers \
  -H "authorization: Bearer $ORG2_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer1"]
}'
echo
echo

echo "POST request Join channel on Org3"
echo
curl -s -X POST \
  http://localhost:4000/channels/test-network/peers \
  -H "authorization: Bearer $ORG3_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer1"]
}'
echo
echo

echo "POST Install chaincode on Org1"
echo
curl -s -X POST \
  http://localhost:4000/chaincodes \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer1"],
	"chaincodeName":"demo_cc",
	"chaincodePath":"github.com/demo_cc",
	"chaincodeVersion":"v0"
}'
echo
echo

echo "POST Install chaincode on Org2"
echo
curl -s -X POST \
  http://localhost:4000/chaincodes \
  -H "authorization: Bearer $ORG2_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer1"],
	"chaincodeName":"demo_cc",
	"chaincodePath":"github.com/demo_cc",
	"chaincodeVersion":"v0"
}'
echo
echo

echo "POST Install chaincode on Org3"
echo
curl -s -X POST \
  http://localhost:4000/chaincodes \
  -H "authorization: Bearer $ORG3_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"peers": ["peer1"],
	"chaincodeName":"demo_cc",
	"chaincodePath":"github.com/demo_cc",
	"chaincodeVersion":"v0"
}'
echo
echo

echo "POST instantiate chaincode on peer1 of Org1"
echo
curl -s -X POST \
  http://localhost:4000/channels/test-network/chaincodes \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d '{
  "chaincodePath":"github.com/demo_cc",
  "chaincodeName":"demo_cc",
  "chaincodeVersion":"v0",
  "fcn":"Init",
  "args":"{\"ObjectType\":\"loanForm\", \"Name\":\"AIPU\", \"OwnerName\":\"simon\"}"
}'
echo
echo

echo "POST invoke chaincode on peers of Org1 and Org2"
echo
TRX_ID=$(curl -s -X POST \
  http://localhost:4000/channels/test-network/chaincodes/demo_cc \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d '{
	"fcn":"createLoanForm",
	"args":"{\"ObjectType\": \"loanForm\", \"Name\": \"HuiHanAgent5\", \"OwnerName\": \"HhUser002\"}"
}')
echo "Transacton ID is $TRX_ID"
echo
echo

echo "GET query chaincode on peer1 of Org1"
echo
curl -G -s -X GET \
  "http://localhost:4000/channels/test-network/chaincodes/demo_cc" \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  --data-urlencode "peer=peer1" \
  --data-urlencode "fcn=queryLoanForms" \
  --data-urlencode "args={\"selector\": { \"objectType\": \"loanForm\" }}"
echo
echo

echo "GET query Block by blockNumber"
echo
curl -G -s -X GET \
  "http://localhost:4000/channels/test-network/blocks/1" \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  --data-urlencode "peer=peer1"
echo
echo

echo "GET query Transaction by TransactionID"
echo
curl -s -X GET http://localhost:4000/channels/test-network/transactions/$TRX_ID?peer=peer1 \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json"
echo
echo

############################################################################
### TODO: What to pass to fetch the Block information
############################################################################
#echo "GET query Block by Hash"
#echo
#hash=????
#curl -s -X GET \
#  "http://localhost:4000/channels/mychannel/blocks?hash=$hash&peer=peer1" \
#  -H "authorization: Bearer $ORG1_TOKEN" \
#  -H "cache-control: no-cache" \
#  -H "content-type: application/json" \
#  -H "x-access-token: $ORG1_TOKEN"
#echo
#echo

echo "GET query ChainInfo"
echo
curl -s -X GET \
  "http://localhost:4000/channels/test-network?peer=peer1" \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json"
echo
echo

echo "GET query Installed chaincodes"
echo
curl -s -X GET \
  "http://localhost:4000/chaincodes?peer=peer1&type=installed" \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json"
echo
echo

echo "GET query Instantiated chaincodes"
echo
curl -s -X GET \
  "http://localhost:4000/chaincodes?peer=peer1&type=instantiated" \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json"
echo
echo

echo "GET query Channels"
echo
curl -s -X GET \
  "http://localhost:4000/channels?peer=peer1" \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json"
echo
echo


echo "Total execution time : $(($(date +%s)-starttime)) secs ..."
