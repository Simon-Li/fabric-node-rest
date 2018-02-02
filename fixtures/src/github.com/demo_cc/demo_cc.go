/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

package main

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// SimpleChaincode example simple Chaincode implementation
type DemoChaincode struct {
}

type LoanForm struct {
	ObjectType   string `json:"objectType"` //docType is used to distinguish the various types of objects in state database
	Name         string `json:"name"`    //the fieldtags are needed to keep case from bouncing around
	OwnerName    string `json:"ownerName"`
	OwnerId      string `json:"ownerId"`
	AssetAddress string `json:"assetAddress"`
	AssetPrice   int    `json:"assetPrice"`
	Loan         int    `json:"loan"`
	AgentId      string `json:"agentId"`
}

func main() {
	err := shim.Start(new(DemoChaincode))
	if err != nil {
		fmt.Printf("Error starting Demo chaincode: %s", err)
	}
}

// Init initializes chaincode
func (t *DemoChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	//
	_, args := stub.GetFunctionAndParameters()

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments, Expecting 1")
	}

	fmt.Println("- start create loan form")
	if len(args[0]) <= 0 {
		return shim.Error("1st argument must be a non-empty string")
	}

	formBlob := []byte(args[0])

	var loanForm LoanForm
	err := json.Unmarshal(formBlob, &loanForm)
	if err != nil {
		fmt.Println("error:", err)
	}
	fmt.Printf("loan form %+v", loanForm)

	loanFormJSONasBytes, err := json.Marshal(&loanForm)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(loanForm.Name, loanFormJSONasBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end create loan form")

	return shim.Success(nil)
}

// Invoke - Our entry point for Invocations
func (t *DemoChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()
	fmt.Println("invoke is running " + function)

	// Handle different functions
	if function == "createLoanForm" { //create a new loan form
		return t.createLoanForm(stub, args)
	} else if function == "readLoanForm" { //read a loan form
		return t.readLoanForm(stub, args)
	} else if function == "queryLoanForms" { //find loan forms based on an ad hoc rich query
		return t.queryLoanForms(stub, args)
	}

	fmt.Println("invoke did not find func: " + function)
	return shim.Error("Received unknown function invocation")
}

// ==================================================================
// createLoanForm - create a new loan form, store into chaincode state
// ==================================================================
func (t *DemoChaincode) createLoanForm(stub shim.ChaincodeStubInterface, args []string) pb.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments, Expecting 1")
	}

	fmt.Println("- start create loan form")
	if len(args[0]) <= 0 {
		return shim.Error("1st argument must be a non-empty string")
	}

	formBlob := []byte(args[0])

	var loanForm LoanForm
	err := json.Unmarshal(formBlob, &loanForm)
	if err != nil {
		fmt.Println("error:", err)
	}
	fmt.Printf("loan form %+v", loanForm)

	loanFormJSONasBytes, err := json.Marshal(&loanForm)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(loanForm.Name, loanFormJSONasBytes)
	if err != nil {
		return shim.Error(err.Error())
	}
	fmt.Println("- end create loan form")

	return shim.Success(nil)
}

// ==================================================================
// readLoanForm - read a loan form from chaincode state
// ==================================================================
func (t *DemoChaincode) readLoanForm(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	//var name, jsonResp string
	//var err error

	return shim.Success(nil)
}

// ==================================================================
// queryLoanForms - ad hoc queries from chaincode state
// ==================================================================
func (t *DemoChaincode) queryLoanForms(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	//  0
	// "queryString"
	if len(args) < 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	queryString := args[0]

	queryResults, err := getQueryResultForQueryString(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(queryResults)
}

// =========================================================================================
// getQueryResultForQueryString executes the passed in query string.
// Result set is built and returned as a byte array containing the JSON results.
// =========================================================================================
func getQueryResultForQueryString(stub shim.ChaincodeStubInterface, queryString string) ([]byte, error) {

	fmt.Printf("- getQueryResultForQueryString queryString:\n%s\n", queryString)

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryRecords
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- getQueryResultForQueryString queryResult:\n%s\n", buffer.String())

	return buffer.Bytes(), nil
}
