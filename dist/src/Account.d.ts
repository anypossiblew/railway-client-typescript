export declare class Account {
    userName: string;
    userPassword: string;
    TRAIN_DATE: string;
    BACK_TRAIN_DATE: string;
    PLAN_TRAINS: Array<string>;
    PLAN_PEPOLES: Array<string>;
    FROM_STATION: string;
    TO_STATION: string;
    FROM_STATION_NAME: string;
    TO_STATION_NAME: string;
    private stations;
    private SYSTEM_BUSSY;
    private SYSTEM_MOVED;
    private request;
    private cookiejar;
    headers: object;
    constructor(name: string, userPassword: string);
    /**
     * 检查网络异常
     */
    private isSystemBussy(body);
    setRequest(): void;
    createOrder(trainDate: string, backTrainDate: string, fromStationName: string, toStationName: string, planTrains: Array<string>, planPepoles: Array<string>): this;
    cancelOrderQueue(): void;
    private sjLoginInit;
    private sjCaptcha;
    private sjLogin;
    private sjNewAppToken;
    private sjAppToken;
    private sjMyPage;
    private sjLfTicketInit;
    private sjQueryLfTicket;
    private sjSmOReqCheckUser;
    private sjSmOrderReq;
    private sjCPasInitDc;
    private sjGetPassengers;
    private sjCheckOrderInfo;
    private sjGetQueueCount;
    private sjGetPassCodeNew;
    private sjConfirmSingle4Q;
    private sjQueryOrderWaitT;
    private buildOrderFlow();
    private buildLoginFlow();
    submit(): void;
    leftTicketReport(): void;
    loginInit(): Promise<void>;
    private getCaptcha();
    private checkCaptcha();
    private userAuthenticate();
    private getNewAppToken();
    private getMy12306();
    private checkAuthentication(cookies);
    /**
     *
     */
    private getAppToken(newapptk);
    private leftTicketInit();
    private queryLeftTicket();
    private checkUser();
    private submitOrderRequest(secretStr);
    private confirmPassengerInitDc();
    private getPassengers(token);
    private getPassengerTickets(passengers);
    private getOldPassengers(passengers);
    private checkOrderInfo(submitToken, passengers);
    private getQueueCount(token, orderRequestDTO, ticketInfo);
    private getPassCodeNew();
    private checkRandCodeAnsyn();
    private confirmSingleForQueue(token, passengers, ticketInfoForPassengerForm);
    private queryOrderWaitTime(token);
    private cancelQueueNoCompleteOrder();
}
