# ColdChain

## COVID-19 Vaccine Transportation.


|Table of contents|
|:----|
| [Objective](#objective)|
| [Features](#features)|
| [Ecosystem](#ecosystem)|
| [Solution Architecture](#solution-architecture)|
| [Technology Stack](#technology-stack)|
| [Why QLDB](#why-qldb)|
| [Push Notification](#push-notification)|
| [MVP Deployment](#mvp-deployment)|
| [API Documentation](#api-documentation)|

## Objective

Develop a Blockchain/DLT and IOT sensor-based <b>Cold Chain</b> solution that provides real-time tracking and monitoring of environment-sensitive Covid-19 Vaccine. 

In the pharma industry,  <b>Cold Chain</b> refers to the process of storing & transporting vaccines while maintaining temperature, humidity and other conditions at well defined threshold values. The potency of these vaccines decreases if they are not maintained under these conditions. 

It is expected that since the storage & transportation involves multiple entities(Manufacturers, Logistics, Wholesalers, Retailers, Hospitals etc.), the syndicate will need to look beyond the insured entity to manage the risk effectively. 
 
## Features

#### =>   User-friendly dashboards provided the product status, location, temperature, and humidity levels all in a single view and instantly.
#### =>   IOT based tracking using tamper-proof sensors to detect temperatures, humidity levels allow for assured quality deliveries.
#### =>   Real time alerts & notifications to stakeholders.
#### =>   Product recall : manufacturers can use Blockchain transaction log to easily trace the history of the entire production (SKU) and distribution lifecycle of a product.
#### =>   Flawless delivery Covid-19 Vaccine from the manufacture to the hospitals or customers location.
#### =>   Ensuring high quality of goods shipped to the end consumer.

![ConsoleOutPut](images/dashboard.png)
![ConsoleOutPut](images/tracking.png)

## Ecosystem
       
![ConsoleOutPut](images/Ecosystem.PNG)

## Solution Architecture
### why Serverless 

Serverless is a concept for operating cloud applications in comparison to VM based or container based architectures. The code is executed by Function-as-a-Service (FaaS) services like AWS Lambda. You only provide your source code (think NodeJs files and libraries). AWS takes care of the execution, scaling and so on.  The idea of Serverless architectures is using additional services like S3 for storage, QLDB as a database, Cognito for user management and so on. All these services scale with your demand, you only pay for used resources (not for idle) and they are all operated by your cloud vendor, e.g. AWS.
Serverless applications can be a cost saver, but above all, they remove most of the operational complexity. Serverless allows writing cloud applications with high availability and scalability easily.

![ConsoleOutPut](images/coldchain-qldb.png)

![ConsoleOutPut](images/Arch-Layers.png)

##### ReactJS Web Application deployed in S3 (1). 

[Web Application Repository](https://localhost)

##### Web Application does REST calls to API Gateway (2). 

##### For handling an HTTP (REST) request, API Gateway invokes Lambda function (3). 

##### The Lambda function retrieves data from QLDB (4) and sends a (JSON) response back to API Gateway which responds the HTTP request.

### Push Notification

![ConsoleOutPut](images/pub-sub-http.png)

[A2A-Messaging](https://localhost/InsuranceInnovation/A2A-Messaging-FanoutToHTTP)

## Technology Stack

|                              | Technology                        |
| ---------------------------- | --------------------------------- |
| Blockchain/Database/DLT      | QLDB                              |
| Middleware                   | AWS Lambda & NodeJS               |
| Backend Interface            | AWS API Gateway                   |
| API Authentication           | Cognito user pools                |
| Deployment Model             | SAM(Serverless Application Model) |
| UI Framework                 | REACT JS                          |
| Alert/Notification           | SNS, Web Push, Server Side Events |

## Why QLDB

#### =>   Fully Managed - QLDB is a fully serverless offering that automatically scales to meet demand.
#### =>   Ledger Database - QLDB is a new class of database built around a centralised ledger.
#### =>   Transparent and Immutable - QLDB has a built-in immutable journal that is append-only with no ability to delete a record. It allows you to easily access the entire change history of any record.
#### =>   Cryptographically Verified - QLDB uses a SHA-256 crytographic hash function with each transaction it commits which then uses hash chaining. This can prove the integrity of any transaction.
#### =>   Familiarity - QLDB supports PartiQL which is a SQL-compatible open standard query language. QLDB supports Amazon ION document data format. This is a superset of JSON that supports a rich type system.
#### =>   Central trusted authority - QLDB is focused on use cases where there is a single owner of the ledger. This is where it differentiates from distributed ledger technologies that require multiple parties to agree a transaction is valid with no single owner.

![ConsoleOutPut](images/blockchain-qldb.png)

### How QLDB works

![ConsoleOutPut](images/QLDB-Works.png)

## MVP Deployment

### Backend	 

This MVP backend implementation is built using the [Serverless Framework](https://serverless.com/).

To build & deploy ColdChain MVP backend, use the following commands:

Step 1. Checkout code from github repository. 

    	$ git clone https://localhost/InsuranceInnovation/Coldchain.git

    	$ git checkout master

Step 2. Go to <b>Coldchain/aws-qldb/serverless-backend/  </b> directory
    
This repository contains the artifcats required for build & deploy ColdChain backend.
    
Step 3. This simple demo application is built using the Serverless Framework. To run the application use the following command:
	
    	$ sls deploy

This will create a <b>CloudFormation stack</b> and deploy all AWS resources;

	Amazon QLDB
	API Gateway
	AWS Lambda
	S3
	SNS
	CloudWatch
	CloudFormation

<b>Note :</b> While it is completely possible to setup entire systems using just the AWS Management Console, there has been a facility for provisioning resources required for given systems using code, typically configuration files in formats such as JavaScript Object Notation (JSON) or YAML Ain’t Markup Language (YAML). While incurring an initial overhead versus using a web-based UI, advantages such as <b>repeatability, consistency, reduced risk and greater agility at scale</b> make this approach desirable. It has become known as <b>Infrastructure as Code (IaC)</b>, and is central to paradigm shift in the development of IT systems towards a DevOps way of working.

### Pre requisites

#### Install Serverless CLI & Setting up AWS credentials

i) Install Serverless CLI

ii) Setup AWS credentials
To set AWS credentials, you must have the access key ID and your secret access key for the IAM user you want to configure. 
[AWS credentials](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-getting-started-set-up-credentials.html)

	serverless config credentials --provider provider --key key --secret secret

[Setup AWS credentials](https://www.serverless.com/framework/docs/providers/aws/cli-reference/config-credentials/)

#### Create Tables/Indexes

Create a QLDB legder and create the below listed Tables and Indexes

#### Ledger	:  coldchain

#### Tables & Indexes	

![ConsoleOutPut](images/Tables_Indexes.PNG)

#### Insert Master Data for Party Table with Party data in following JSON format.    
	
	{
	  PartyName: "",
	  PartyRole: "",
	  PartyAddress: ""
	}
 
#### SNS Topic 

Create a SNS topic and subscribe http endpoint in SNS. 

[A2A-Messaging](https://localhost/InsuranceInnovation/A2A-Messaging-FanoutToHTTP)

#### ARN Configuration
	
Modify Coldchain QLDB & SNS Topic ARN in serverless.yaml	
	   
## API Documentation

Coldchain application APIs is implemented as Lambda functions and deployed into S3 by AWS SAM deployment model.

[API Documentation](http://localhost:8080/docs/)



