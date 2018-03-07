export interface OrderSubmitRequest {
    token: string;
    ticketInfo: object;
    orderRequest: object;
}
export interface IOrder {
    trainDate: string;
    backTrainDate: string;
    fromStationName: string;
    toStationName: string;
    passStationName?: string;
    planTrains?: ReadonlyArray<string>;
    planPepoles?: ReadonlyArray<string>;
    fromStation: string;
    toStation: string;
    passStation?: string;
    seatClasses: ReadonlyArray<string>;
    trains?: Array<Array<string>>;
    request?: any;
    planTimes?: ReadonlyArray<string>;
    availableTrains?: Array<Array<string>>;
    planOrderBy?: Array<string | number>;
}
export declare class Order implements IOrder {
    trainDate: string;
    backTrainDate: string;
    fromStationName: string;
    toStationName: string;
    passStationName?: string;
    fromStation: string;
    toStation: string;
    passStation?: string;
    planTrains: ReadonlyArray<string>;
    planPepoles?: ReadonlyArray<string>;
    seatClasses: ReadonlyArray<string>;
    trains?: Array<Array<string>>;
    private stations;
    constructor(trainDate: string, backTrainDate: string, fromStationName: string, toStationName: string, passStationName: string, planTrains: ReadonlyArray<string>, planPepoles: ReadonlyArray<string>, seatClasses: ReadonlyArray<string>);
}
