// Auto-generated , DO NOT EDIT
import {Entity, FunctionPropertyNames} from "@subql/types";
import assert from 'assert';




export type PolicyProps = Omit<Policy, NonNullable<FunctionPropertyNames<Policy>>| '_name'>;

export class Policy implements Entity {

    constructor(id: string) {
        this.id = id;
    }


    public id: string;

    public protocol: string;

    public epochManage: string;

    public beneficiary: string;

    public policyId: bigint;

    public coverage: bigint;

    public fee: bigint;

    public timestamp: bigint;

    public duration: bigint;

    public standardRisk: bigint;

    public enteredEpochIndex: bigint;

    public SPS: bigint;

    public isClaimed: boolean;

    public isClaimApplying: boolean;

    public isSettled: boolean;


    get _name(): string {
        return 'Policy';
    }

    async save(): Promise<void>{
        let id = this.id;
        assert(id !== null, "Cannot save Policy entity without an ID");
        await store.set('Policy', id.toString(), this);
    }
    static async remove(id:string): Promise<void>{
        assert(id !== null, "Cannot remove Policy entity without an ID");
        await store.remove('Policy', id.toString());
    }

    static async get(id:string): Promise<Policy | undefined>{
        assert((id !== null && id !== undefined), "Cannot get Policy entity without an ID");
        const record = await store.get('Policy', id.toString());
        if (record){
            return this.create(record as PolicyProps);
        }else{
            return;
        }
    }



    static create(record: PolicyProps): Policy {
        assert(typeof record.id === 'string', "id must be provided");
        let entity = new this(record.id);
        Object.assign(entity,record);
        return entity;
    }
}
