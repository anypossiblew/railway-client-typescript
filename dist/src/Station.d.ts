export declare class Station {
    stations: Array<Array<string>>;
    constructor();
    getStations(): any[];
    getStationCode(name: string): string;
    getStationName(code: string): string;
    stationNames: string;
}
