/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Schema as ContractOptions } from './schema';


describe('Contract Schematic', () => {

  const appSchematicRunner = new SchematicTestRunner(
    '@schematics/angular',
    path.join(__dirname, '../../node_modules/@schematics/angular/collection.json')
  )

  const schematicRunner = new SchematicTestRunner(
    '@angular-web3/schematics',
    path.join(__dirname, '../collection.json'),
  );
  const defaultOptions: ContractOptions = {
    name: 'foo',
    project: 'bar',
  };

  const workspaceOptions: any = {
    name: 'workspace',
    newProjectRoot: 'projects',
    version: '6.0.0',
  };

  const appOptions: any = {
    name: 'bar',
    inlineStyle: false,
    inlineTemplate: false,
    routing: false,
    style: 'css',
    skipTests: false,
    skipPackageJson: false,
  };
  let appTree: UnitTestTree;
  beforeEach(() => {
    appTree = appSchematicRunner.runSchematic('workspace', workspaceOptions);
    appTree = appSchematicRunner.runSchematic('application', appOptions, appTree);
  });

  it('should create an contract', () => {
    const tree = schematicRunner.runSchematic('contract', defaultOptions, appTree);
    const files = tree.files;
    expect(files.indexOf('/projects/bar/src/app/foo.sol')).toBeGreaterThanOrEqual(0);
  });
  it('should create a contract', () => {
    const tree = schematicRunner.runSchematic('contract', defaultOptions, appTree);
    const content = tree.readContent('/projects/bar/src/app/foo.sol');
    expect(content).toContain('pragma solidity ^0.4.0;');
    expect(content).toContain('contract Foo {');
  });

  it('should respect the sourceRoot value', () => {
    const config = JSON.parse(appTree.readContent('/angular.json'));
    config.projects.bar.sourceRoot = 'projects/bar/custom';
    appTree.overwrite('/angular.json', JSON.stringify(config, null, 2));
    appTree = schematicRunner.runSchematic('contract', defaultOptions, appTree);
    expect(appTree.files.indexOf('/projects/bar/custom/app/foo.sol')).toBeGreaterThanOrEqual(0);
  });
});
