/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { parseJson, strings } from '@angular-devkit/core';
import {
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  noop,
  // schematic,
  template,
  url,
} from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import {
  WorkspaceProject,
  WorkspaceSchema,
  addProjectToWorkspace,
  getWorkspace,
} from '../utility/config';
import {
  NodeDependencyType,
  addPackageJsonDependency,
} from '../utility/dependencies';
import { latestVersions } from '../utility/latest-versions';
import { validateProjectName } from '../utility/validation';
import { Schema as LibraryOptions } from './schema';

interface UpdateJsonFn<T> {
  (obj: T): T | void;
}

type TsConfigPartialType = {
  compilerOptions: {
    baseUrl: string,
    paths: {
      [key: string]: string[];
    },
  },
};

function updateJsonFile<T>(host: Tree, path: string, callback: UpdateJsonFn<T>): Tree {
  const source = host.read(path);
  if (source) {
    const sourceText = source.toString('utf-8');
    const json = parseJson(sourceText);
    callback(json as {} as T);
    host.overwrite(path, JSON.stringify(json, null, 2));
  }

  return host;
}

function updateTsConfig(packageName: string, distRoot: string) {

  return (host: Tree) => {
    if (!host.exists('tsconfig.json')) { return host; }

    return updateJsonFile(host, 'tsconfig.json', (tsconfig: TsConfigPartialType) => {
      if (!tsconfig.compilerOptions.paths) {
        tsconfig.compilerOptions.paths = {};
      }
      if (!tsconfig.compilerOptions.paths[packageName]) {
        tsconfig.compilerOptions.paths[packageName] = [];
      }
      tsconfig.compilerOptions.paths[packageName].push(distRoot);

      // deep import & secondary entrypoint support
      const deepPackagePath = packageName + '/*';
      if (!tsconfig.compilerOptions.paths[deepPackagePath]) {
        tsconfig.compilerOptions.paths[deepPackagePath] = [];
      }
      tsconfig.compilerOptions.paths[deepPackagePath].push(distRoot + '/*');
    });
  };
}

function addDependenciesToPackageJson() {

  return (host: Tree) => {
    [
      {
        type: NodeDependencyType.Dev,
        name: '@angular-web3/builders',
        version: '*'
      },
      {
        type: NodeDependencyType.Dev,
        name: '@angular/compiler-cli',
        version: latestVersions.Angular,
      },
      {
        type: NodeDependencyType.Dev,
        name: '@angular-devkit/build-ng-packagr',
        version: latestVersions.DevkitBuildNgPackagr,
      },
      {
        type: NodeDependencyType.Dev,
        name: '@angular-devkit/build-angular',
        version: latestVersions.DevkitBuildNgPackagr,
      },
      {
        type: NodeDependencyType.Dev,
        name: 'ng-packagr',
        version: '^4.0.0',
      },
      {
        type: NodeDependencyType.Dev,
        name: 'tsickle',
        version: '>=0.29.0',
      },
      {
        type: NodeDependencyType.Dev,
        name: 'tslib',
        version: '^1.9.0',
      },
      {
        type: NodeDependencyType.Dev,
        name: 'typescript',
        version: latestVersions.TypeScript,
      },
    ].forEach(dependency => addPackageJsonDependency(host, dependency));

    return host;
  };
}

function addAppToWorkspaceFile(options: LibraryOptions, workspace: WorkspaceSchema,
  projectRoot: string, packageName: string): Rule {

  const project: WorkspaceProject = {
    root: `${projectRoot}`,
    sourceRoot: `${projectRoot}/src`,
    projectType: 'library',
    prefix: options.prefix || 'contract',
    architect: {
      build: {
        builder: "@angular-web3/builders:contracts-builder",
        options: {
          tsConfig: `${projectRoot}/tsconfig.lib.json`,
          project: `${projectRoot}/ng-package.json`,
        },
      },
      test: {
        builder: '@angular-devkit/build-angular:karma',
        options: {
          main: `${projectRoot}/src/test.ts`,
          tsConfig: `${projectRoot}/tsconfig.spec.json`,
          karmaConfig: `${projectRoot}/karma.conf.js`,
        },
      },
      lint: {
        builder: '@angular-devkit/build-angular:tslint',
        options: {
          tsConfig: [
            `${projectRoot}/tsconfig.lib.json`,
            `${projectRoot}/tsconfig.spec.json`,
          ],
          exclude: [
            '**/node_modules/**',
          ],
        },
      },
    },
  };

  return addProjectToWorkspace(workspace, packageName, project);
}

export function contractsLib(options: LibraryOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    if (!options.name) {
      throw new SchematicsException(`Invalid options, "name" is required.`);
    }
    const prefix = options.prefix || 'contract';

    validateProjectName(options.name);

    // If scoped project (i.e. "@foo/bar"), convert projectDir to "foo/bar".
    const packageName = options.name;
    let scopeName = null;
    if (/^@.*\/.*/.test(options.name)) {
      const [scope, name] = options.name.split('/');
      scopeName = scope.replace(/^@/, '');
      options.name = name;
    }

    const workspace = getWorkspace(host);
    const newProjectRoot = workspace.newProjectRoot;

    const scopeFolder = scopeName ? strings.dasherize(scopeName) + '/' : '';
    const folderName = `${scopeFolder}${strings.dasherize(options.name)}`;
    const projectRoot = `${newProjectRoot}/${folderName}`;
    const distRoot = `dist/${folderName}`;

    // const sourceDir = `${projectRoot}/src/lib`;
    const relativePathToWorkspaceRoot = projectRoot.split('/').map(() => '..').join('/');

    const templateSource = apply(url('./files'), [
      template({
        ...strings,
        ...options,
        packageName,
        projectRoot,
        distRoot,
        relativePathToWorkspaceRoot,
        prefix,
      }),
      // TODO: Moving inside `branchAndMerge` should work but is bugged right now.
      // The __projectRoot__ is being used meanwhile.
      // move(projectRoot),
    ]);

    return chain([
      branchAndMerge(mergeWith(templateSource)),
      addAppToWorkspaceFile(options, workspace, projectRoot, packageName),
      options.skipPackageJson ? noop() : addDependenciesToPackageJson(),
      options.skipTsConfig ? noop() : updateTsConfig(packageName, distRoot),
      (_tree: Tree, context: SchematicContext) => {
        if (!options.skipPackageJson && !options.skipInstall) {
          context.addTask(new NodePackageInstallTask());
        }
      },
    ])(host, context);
  };
}
