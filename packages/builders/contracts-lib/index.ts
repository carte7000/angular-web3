/**
 * Created by Evgeny Barabanov on 28/06/2018.
 */

import { BuilderContext, BuilderConfiguration, BuildEvent } from '@angular-devkit/architect';
import { NgPackagrBuilder, NgPackagrBuilderOptions } from '@angular-devkit/build-ng-packagr';
import { Observable, forkJoin, Observer, iif } from 'rxjs';
import { switchMap, catchError, filter } from 'rxjs/operators';

import * as solc from 'solc';
import { generateSource } from 'typechain/dist/generateSource';
import { RawAbiDefinition } from 'typechain/dist/abiParser';
import { copyRuntime } from 'typechain/dist/copyRuntime';
import { Path } from '@angular-devkit/core';
import * as fs from 'fs';
import * as truffleCompile from 'truffle-compile';
import * as truffleResolver from 'truffle-resolver';
import * as p from 'path';

export class NgPackagrContractsBuilder extends NgPackagrBuilder {

    constructor(public context: BuilderContext) {
        super(context);
    }

    private stringToArrayBuffer(str) {
        var buf = new ArrayBuffer(str.length * 1); // 2 bytes for each char
        var bufView = new Uint8Array(buf);
        for (var i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }

    private write(path: Path, str: string) {
        return this.context.host.write(path, this.stringToArrayBuffer(str));
    }

    run(builderConfig: BuilderConfiguration<NgPackagrBuilderOptions>): Observable<BuildEvent> {
        const working_directory = p.resolve(this.context.workspace.root + '/' + builderConfig.root);
        const contracts_dir = p.resolve(this.context.workspace.root + '/' + builderConfig.root + '/' + 'contracts') as Path;
        const contracts_build_dir = p.resolve(this.context.workspace.root + '/' + builderConfig.root + '/' + 'build') as Path;
        const contracts_build_ts_dir = p.resolve(this.context.workspace.root + '/' + builderConfig.root + '/' + 'buildTs') as Path;
        const RUNTIME_FILE_NAME = 'typechainRuntime';

        const pathOption = {
            working_directory: working_directory,
            contracts_directory: contracts_dir,
            contracts_build_directory: contracts_build_dir
        }

        const options = {
            solc,
            resolver: new truffleResolver(pathOption),
            ...pathOption
        }
        copyRuntime(`${contracts_build_ts_dir}/${RUNTIME_FILE_NAME}.ts`);
        const obs: Observable<void> = Observable.create((observer: Observer<void>) => {
            const hasContract = fs.existsSync(contracts_dir) && fs.readdirSync(contracts_dir).filter((x) => x.endsWith('.sol')).length > 0;
            if (hasContract) {
                truffleCompile.all(options, (err, result) => {
                    if (!err) {
                        forkJoin(Object.keys(result).map((contractName) => {
                            const name = result[contractName].contract_name;
                            const buildPath = `${contracts_build_dir}/${name}.json`;
                            const buildPathTs = `${contracts_build_ts_dir}/${name}.ts`;
                            const newSource = generateSource(result[contractName].abi as Array<RawAbiDefinition>, {
                                fileName: name,
                                relativeRuntimePath: `./${RUNTIME_FILE_NAME}`
                            })
                            return forkJoin(
                                this.write(buildPath as Path, JSON.stringify(result)),
                                this.write(buildPathTs as Path, newSource)
                            );
                        }))
                            .pipe(
                                catchError((err) => {
                                    observer.error(err);
                                    return Observable.create();
                                })
                            )
                            .subscribe(() => {
                                observer.next(void 0);
                            });
                    } else {
                        observer.error(err);
                    }
                })
            } else {
                observer.next(void 0);
            }
        })
        return obs.pipe(switchMap(() => super.run(builderConfig)));
    }
}

export default NgPackagrContractsBuilder;