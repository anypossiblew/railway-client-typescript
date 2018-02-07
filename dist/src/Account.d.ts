export declare class Account {
    userName: string;
    userPassword: string;
    private request;
    private cookiejar;
    headers: object;
    constructor(name: string, userPassword: string);
    setRequest(): void;
    login(): Promise;
    private captcha();
    private tryUserAuth();
    /**
     *
     */
    private tryGetAppToken(newapptk);
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
}
