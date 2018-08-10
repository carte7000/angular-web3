"use strict";
/**
 * Created by Evgeny Barabanov on 28/06/2018.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const build_ng_packagr_1 = require("@angular-devkit/build-ng-packagr");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const solc = require("solc");
const generateSource_1 = require("typechain/dist/generateSource");
const copyRuntime_1 = require("typechain/dist/copyRuntime");
const truffleCompile = require("truffle-compile");
const truffleResolver = require("truffle-resolver");
const p = require("path");
class NgPackagrContractsBuilder extends build_ng_packagr_1.NgPackagrBuilder {
    constructor(context) {
        super(context);
        this.context = context;
    }
    stringToArrayBuffer(str) {
        var buf = new ArrayBuffer(str.length * 1); // 2 bytes for each char
        var bufView = new Uint8Array(buf);
        for (var i = 0, strLen = str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }
    write(path, str) {
        return this.context.host.write(path, this.stringToArrayBuffer(str));
    }
    run(builderConfig) {
        const working_directory = p.resolve(this.context.workspace.root + '/' + builderConfig.root);
        const contracts_dir = p.resolve(this.context.workspace.root + '/' + builderConfig.root + '/' + 'contracts');
        const contracts_build_dir = p.resolve(this.context.workspace.root + '/' + builderConfig.root + '/' + 'build');
        const contracts_build_ts_dir = p.resolve(this.context.workspace.root + '/' + builderConfig.root + '/' + 'buildTs');
        const RUNTIME_FILE_NAME = 'typechainRuntime';
        const pathOption = {
            working_directory: working_directory,
            contracts_directory: contracts_dir,
            contracts_build_directory: contracts_build_dir
        };
        const options = Object.assign({ solc, resolver: new truffleResolver(pathOption) }, pathOption);
        copyRuntime_1.copyRuntime(`${contracts_build_ts_dir}/${RUNTIME_FILE_NAME}.ts`);
        const obs = rxjs_1.Observable.create((observer) => {
            truffleCompile.all(options, (err, result) => {
                if (!err) {
                    rxjs_1.forkJoin(Object.keys(result).map((contractName) => {
                        const name = result[contractName].contract_name;
                        const buildPath = `${contracts_build_dir}/${name}.json`;
                        const buildPathTs = `${contracts_build_ts_dir}/${name}.ts`;
                        const newSource = generateSource_1.generateSource(result[contractName].abi, {
                            fileName: name,
                            relativeRuntimePath: `./${RUNTIME_FILE_NAME}`
                        });
                        return rxjs_1.forkJoin(this.write(buildPath, JSON.stringify(result)), this.write(buildPathTs, newSource));
                    }))
                        .pipe(operators_1.catchError((err) => {
                        observer.error(err);
                        return rxjs_1.Observable.create();
                    }))
                        .subscribe(() => {
                        observer.next(void 0);
                    });
                }
                else {
                    observer.error(err);
                }
            });
        });
        return obs.pipe(operators_1.switchMap(() => super.run(builderConfig)));
    }
}
exports.NgPackagrContractsBuilder = NgPackagrContractsBuilder;
exports.default = NgPackagrContractsBuilder;
//# sourceMappingURL=index.js.map