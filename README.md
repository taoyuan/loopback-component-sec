# loopback-component-sec

[![NPM version](http://img.shields.io/npm/v/loopback-component-sec.svg?style=flat-square)](https://www.npmjs.com/package/loopback-component-sec)
[![NPM downloads](http://img.shields.io/npm/dm/loopback-component-sec.svg?style=flat-square)](https://www.npmjs.com/package/loopback-component-sec)
[![Build Status](http://img.shields.io/travis/taoyuan/loopback-component-sec/master.svg?style=flat-square)](https://travis-ci.org/taoyuan/loopback-component-sec)
[![Coverage Status](https://img.shields.io/coveralls/taoyuan/loopback-component-sec.svg?style=flat-square)](https://coveralls.io/taoyuan/loopback-component-sec)

> A loopback security component with scoped roles management and permission access control

### Introduction

`loopback-component-sec` using [nsec](//github.com/taoyuan/nsec) enables you to add multi-tenant style access controls to a loopback application. 
It enables you to restrict access to model data based on a user's roles within a specific context.

The main concept is borrowed from [loopback-component-access-groups](//github.com/fullcube/loopback-component-access-groups).

`loopback-component-sec` provide a inheritable roles management and a row level access controller.

There are three types of access restrictions implemented in this component:

__1) Role Resolvers__

`loopback-component-sec` attach a dynamic [Role Resolver](https://docs.strongloop.com/display/public/LB/Defining+and+using+roles#Definingandusingroles-Dynamicroles) 
named `$sec` to the application. The Role Resolver is responsible for determining whether or not a user has the 
relevant roles required to access data that belongs to a group context.


__2) Query Filters__

An 'access' [Operation Hook](https://docs.strongloop.com/display/public/LB/Operation+hooks) is injected into each Group Content model. 
This is used to filter search results to ensure that only items that a user has access to (based on their scoped User Role Mappings) are returned.

__3) Row Level Secure__

A model (Group or Group context model) 'access' operation hook or connector 'execute' operation hook according to database 
connector is injected to add additional filter based on model permissions attached with `acl.allow()`.
This is used to filter search results to ensure that only items that a user has access to (based on model's permission lists) are returned.

### How to Install

1. Install in you loopback project:

	```sh
	$ npm install --save loopback-component-sec
	```

2. Create a component-config.json file in your server folder (if you don't already have one)

3. Configure options inside `component-config.json`. *(see configuration section)*

	```json
	{
		"loopback-component-sec": {
			"{option}": "{value}"
		}
	}
	```

### Usage

...

### How to Test

Run one, or a combination of the following commands to lint and test your code:

```sh
$ npm run lint          # Lint the source code with ESLint
$ npm test              # Lint and Run unit tests with Mocha
```

A sample application is provided in the test directory. This demonstrates how you can integrate the component with a loopback application.

The following group roles roles are configured in the test data.

 - **member**  
read

 - **manager**  
read, write

 - **admin**  
read, write, delete

There are a number of test user accounts in the sample application.

 - generalUser
  - (no group roles)
 - storeAdminA
  - ($group:admin of Store A)
 - storeManagerA
  - ($group:manager of Store A)
 - storeMemberA
  - ($group:member of Store A)
 - storeAdminB
  - ($group:admin of Store B)
 - storeManagerB
  - ($group:manager of Store B)
 - storeMemberB
  - ($group:member of Store B)


### Creds

* [mrfelton](https://github.com/mrfelton)

### License

MIT © [Yuan Tao]()
