// Auto-generated , DO NOT EDIT
import {Entity, FunctionPropertyNames} from "@subql/types";
import assert from 'assert';




export type LiquidityCertificateProps = Omit<LiquidityCertificate, NonNullable<FunctionPropertyNames<LiquidityCertificate>>| '_name'>;

export class LiquidityCertificate implements Entity {

    constructor(id: string) {
        this.id = id;
    }


    public id: string;

    public protocol: string;

    public owner: string;

    public certificateId: bigint;

    public enteredEpochIndex: bigint;

    public exitedEpochIndex: bigint;

    public rewardDebtEpochIndex: bigint;

    public liquidity: bigint;

    public SPSLocked: bigint;

    public isValid: boolean;


    get _name(): string {
        return 'LiquidityCertificate';
    }

    async save(): Promise<void>{
        let id = this.id;
        assert(id !== null, "Cannot save LiquidityCertificate entity without an ID");
        await store.set('LiquidityCertificate', id.toString(), this);
    }
    static async remove(id:string): Promise<void>{
        assert(id !== null, "Cannot remove LiquidityCertificate entity without an ID");
        await store.remove('LiquidityCertificate', id.toString());
    }

    static async get(id:string): Promise<LiquidityCertificate | undefined>{
        assert((id !== null && id !== undefined), "Cannot get LiquidityCertificate entity without an ID");
        const record = await store.get('LiquidityCertificate', id.toString());
        if (record){
            return this.create(record as LiquidityCertificateProps);
        }else{
            return;
        }
    }



    static create(record: LiquidityCertificateProps): LiquidityCertificate {
        assert(typeof record.id === 'string', "id must be provided");
        let entity = new this(record.id);
        Object.assign(entity,record);
        return entity;
    }
}
