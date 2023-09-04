// Auto-generated , DO NOT EDIT
import {Entity, FunctionPropertyNames} from "@subql/types";
import assert from 'assert';




export type MarketProps = Omit<Market, NonNullable<FunctionPropertyNames<Market>>| '_name'>;

export class Market implements Entity {

    constructor(id: string) {
        this.id = id;
    }


    public id: string;

    public protocol: string;

    public liquidityCertificate: string;

    public policy: string;

    public epochManage: string;

    public marketName: string;

    public marketDescription: string;

    public marketPaymentToken: string;

    public marketProtectionType: string;

    public network: string;

    public isValid: boolean;


    get _name(): string {
        return 'Market';
    }

    async save(): Promise<void>{
        let id = this.id;
        assert(id !== null, "Cannot save Market entity without an ID");
        await store.set('Market', id.toString(), this);
    }
    static async remove(id:string): Promise<void>{
        assert(id !== null, "Cannot remove Market entity without an ID");
        await store.remove('Market', id.toString());
    }

    static async get(id:string): Promise<Market | undefined>{
        assert((id !== null && id !== undefined), "Cannot get Market entity without an ID");
        const record = await store.get('Market', id.toString());
        if (record){
            return this.create(record as MarketProps);
        }else{
            return;
        }
    }



    static create(record: MarketProps): Market {
        assert(typeof record.id === 'string', "id must be provided");
        let entity = new this(record.id);
        Object.assign(entity,record);
        return entity;
    }
}
