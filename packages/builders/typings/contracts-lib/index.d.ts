/**
 * Created by Evgeny Barabanov on 28/06/2018.
 */
import { BuilderContext, BuilderConfiguration, BuildEvent } from '@angular-devkit/architect';
import { NgPackagrBuilder, NgPackagrBuilderOptions } from '@angular-devkit/build-ng-packagr';
import { Observable } from 'rxjs';
export declare class NgPackagrContractsBuilder extends NgPackagrBuilder {
    context: BuilderContext;
    constructor(context: BuilderContext);
    private stringToArrayBuffer;
    private write;
    run(builderConfig: BuilderConfiguration<NgPackagrBuilderOptions>): Observable<BuildEvent>;
}
export default NgPackagrContractsBuilder;
