import {Station} from './Station';

export interface IOrder {
  trainDate: string
  ,backTrainDate: string
  ,fromStationName: string
  ,toStationName: string
  ,passStationName?: string
  ,planTrains: ReadonlyArray<string>
  ,planPepoles: ReadonlyArray<string>
  ,planTimes?: Array<string>
  ,fromStation: string
  ,toStation: string
  ,passStation?: string
  ,seatClasses: ReadonlyArray<string>
  trains?: Array<Array<string>>;
  request: any;
}

export class Order implements IOrder {
  public trainDate: string;
  public backTrainDate: string;
  public fromStationName: string;
  public toStationName: string;
  public passStationName?: string;
  public fromStation: string;
  public toStation: string;
  public passStation?: string;
  public planTrains: ReadonlyArray<string>;
  public planPepoles: ReadonlyArray<string>;
  public seatClasses: ReadonlyArray<string>;
  public trains?: Array<Array<string>>;

  private stations: Station = new Station();

  constructor(trainDate: string, backTrainDate: string, fromStationName: string, toStationName: string, passStationName: string,
              planTrains: ReadonlyArray<string>, planPepoles: ReadonlyArray<string>, seatClasses: ReadonlyArray<string>) {
    this.trainDate = trainDate;
    this.backTrainDate = backTrainDate;
    this.fromStationName = fromStationName;
    this.toStationName = toStationName;
    this.passStationName = passStationName;
    this.planTrains = planTrains;
    this.planPepoles = planPepoles;
    this.fromStation = this.stations.getStationCode(fromStationName);
    this.toStation = this.stations.getStationCode(toStationName);
    this.passStation = this.stations.getStationCode(passStationName);
    this.seatClasses = seatClasses;
  }
}
