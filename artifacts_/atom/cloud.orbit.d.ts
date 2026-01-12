import CloudElectrons from './cloud.electrons';
export default function (electrons: CloudElectrons, cloud: any, config: IAtomOptions<any>, quarkBus: any): {
    atom: {
        valence: Record<string, any>;
        core: IDeepAtomCore<any>;
    };
};
