import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/forkJoin';
import { Account } from './Account';
export declare class Manager {
    private accountConfigs;
    defaultAccount?: Account;
    accounts: Array<Account>;
    private captchLock;
    private captchLockRelease;
    constructor(path: string);
    getCaptchaLock(): Observable<string>;
    releaseCaptchaLock(): void;
    start(): void;
    getAccount(userName: string): any;
}
