# Getting started

This repository contains a set of tools to help you create and manage angular based dApp

## Use in an existing project

run `npm install @angular-web3/schematics@latest --save` inside your current angular project

then run `ng g @angular-web3/schematics:contracts-lib <your-lib-name-here>`

You know have a new angular library project to contains your smart contract

you can run `ng g @angular-web3/schematics:contract <your-contract-name-here>` to generate a new smart contract

simply run `ng build <your-lib-name-here>` to obtains typescript binding class to your smart contracts